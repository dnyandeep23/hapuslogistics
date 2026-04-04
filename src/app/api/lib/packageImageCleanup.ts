import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import PackageImageLease from "@/app/api/models/packageImageLeaseModel";
import { deleteCloudinaryImageByUrl, isCloudinaryImageUrl } from "@/app/api/lib/cloudinary";

const TEMP_PACKAGE_IMAGE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_LIMIT = 50;

function normalizeImageUrl(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function collectPackageImageUrls(packages: unknown): string[] {
  if (!Array.isArray(packages)) return [];

  const urls = new Set<string>();
  for (const entry of packages) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const imageUrl = normalizeImageUrl((entry as { packageImage?: unknown }).packageImage);
    if (!imageUrl || !isCloudinaryImageUrl(imageUrl)) continue;
    urls.add(imageUrl);
  }

  return Array.from(urls);
}

export async function registerTemporaryPackageImageLease(input: {
  userId: string;
  imageUrl: string;
  expiresAt?: Date;
}) {
  const imageUrl = normalizeImageUrl(input.imageUrl);
  if (!imageUrl || !isCloudinaryImageUrl(imageUrl)) return;
  if (!mongoose.Types.ObjectId.isValid(input.userId)) return;

  await dbConnect();

  const expiresAt = input.expiresAt ?? new Date(Date.now() + TEMP_PACKAGE_IMAGE_LIFETIME_MS);
  await PackageImageLease.findOneAndUpdate(
    { imageUrl },
    {
      $set: {
        userId: new mongoose.Types.ObjectId(input.userId),
        imageUrl,
        expiresAt,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function releaseTemporaryPackageImageLeases(imageUrls: string[]) {
  const normalized = Array.from(
    new Set(imageUrls.map((url) => normalizeImageUrl(url)).filter((url) => isCloudinaryImageUrl(url))),
  );
  if (!normalized.length) return 0;

  await dbConnect();
  const result = await PackageImageLease.deleteMany({ imageUrl: { $in: normalized } });
  return typeof result.deletedCount === "number" ? result.deletedCount : 0;
}

export async function deleteTemporaryPackageImageLease(input: {
  userId: string;
  imageUrl: string;
}) {
  const imageUrl = normalizeImageUrl(input.imageUrl);
  if (!imageUrl || !isCloudinaryImageUrl(imageUrl)) {
    return { deleted: false, reason: "invalid_image" as const };
  }
  if (!mongoose.Types.ObjectId.isValid(input.userId)) {
    return { deleted: false, reason: "unauthorized" as const };
  }

  await dbConnect();

  const lease = await PackageImageLease.findOne({
    imageUrl,
    userId: new mongoose.Types.ObjectId(input.userId),
  }).select("_id imageUrl");

  if (!lease) {
    return { deleted: false, reason: "not_found" as const };
  }

  await PackageImageLease.deleteOne({ _id: lease._id });
  const deleted = await deleteCloudinaryImageByUrl(imageUrl);
  return { deleted, reason: deleted ? "deleted" as const : "cloudinary_failed" as const };
}

export async function cleanupExpiredTemporaryPackageImages(now: Date = new Date()) {
  await dbConnect();

  const expiredLeases = await PackageImageLease.find({
    expiresAt: { $lte: now },
  })
    .sort({ expiresAt: 1 })
    .limit(CLEANUP_BATCH_LIMIT)
    .select("_id imageUrl")
    .lean<Array<{ _id: mongoose.Types.ObjectId; imageUrl?: string }>>();

  let deleted = 0;
  let failed = 0;

  for (const lease of expiredLeases) {
    const claimed = await PackageImageLease.findOneAndDelete({
      _id: lease._id,
      expiresAt: { $lte: now },
    }).select("imageUrl");

    if (!claimed?.imageUrl) continue;

    const removed = await deleteCloudinaryImageByUrl(claimed.imageUrl);
    if (removed) {
      deleted += 1;
    } else {
      failed += 1;
    }
  }

  return {
    scanned: expiredLeases.length,
    deleted,
    failed,
  };
}
