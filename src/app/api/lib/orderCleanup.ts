import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import { deleteCloudinaryImageByUrl, isCloudinaryImageUrl } from "@/app/api/lib/cloudinary";
import Order from "@/app/api/models/orderModel";
import User from "@/app/api/models/userModel";

const ORDER_RETENTION_MONTHS = 3;
const ORDER_CLEANUP_BATCH_LIMIT = 100;
const ORDER_CLEANUP_COOLDOWN_MS = 60_000;

declare global {
  var __orderCleanupRunning: boolean | undefined;
  var __orderCleanupLastRunAt: number | undefined;
}

export interface CleanupExpiredOrdersResult {
  scanned: number;
  deletedOrders: number;
  deletedImages: number;
  imageDeleteFailed: number;
  skipped: boolean;
}

type CleanupOrderDoc = {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  expiresAt?: Date;
  pickupProofImage?: string;
  dropProofImage?: string;
  packages?: unknown[];
};

function getExpiryCutoffDate(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - ORDER_RETENTION_MONTHS);
  return cutoff;
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return "";
}

function collectImageUrls(order: CleanupOrderDoc): string[] {
  const urls = new Set<string>();
  const pickupProofImage = toStringValue(order.pickupProofImage);
  const dropProofImage = toStringValue(order.dropProofImage);

  if (pickupProofImage) urls.add(pickupProofImage);
  if (dropProofImage) urls.add(dropProofImage);

  if (Array.isArray(order.packages)) {
    for (const item of order.packages) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const packageImage = toStringValue((item as { packageImage?: unknown }).packageImage);
      if (packageImage) urls.add(packageImage);
    }
  }

  return Array.from(urls);
}

export async function cleanupExpiredOrders(now: Date = new Date()): Promise<CleanupExpiredOrdersResult> {
  await dbConnect();

  const expiryCutoff = getExpiryCutoffDate(now);
  const expiredOrders = await Order.find({
    $or: [
      { expiresAt: { $lte: now } },
      { expiresAt: { $exists: false }, createdAt: { $lte: expiryCutoff } },
      { expiresAt: null, createdAt: { $lte: expiryCutoff } },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(ORDER_CLEANUP_BATCH_LIMIT)
    .select("_id packages pickupProofImage dropProofImage expiresAt createdAt")
    .lean<CleanupOrderDoc[]>();

  if (!expiredOrders.length) {
    return {
      scanned: 0,
      deletedOrders: 0,
      deletedImages: 0,
      imageDeleteFailed: 0,
      skipped: false,
    };
  }

  const orderIds = expiredOrders.map((order) => order._id);
  const imageUrls = new Set<string>();
  for (const order of expiredOrders) {
    for (const imageUrl of collectImageUrls(order)) {
      imageUrls.add(imageUrl);
    }
  }

  let deletedImages = 0;
  let imageDeleteFailed = 0;
  if (imageUrls.size > 0) {
    const cloudinaryUrls = Array.from(imageUrls).filter((url) => isCloudinaryImageUrl(url));
    const imageDeleteResults = await Promise.allSettled(
      cloudinaryUrls.map((url) => deleteCloudinaryImageByUrl(url))
    );

    for (const result of imageDeleteResults) {
      if (result.status === "fulfilled" && result.value) {
        deletedImages += 1;
      } else {
        imageDeleteFailed += 1;
      }
    }
  }

  const deleteOrderResult = await Order.deleteMany({ _id: { $in: orderIds } });
  const deletedOrderCount =
    typeof deleteOrderResult.deletedCount === "number" ? deleteOrderResult.deletedCount : 0;

  if (deletedOrderCount > 0) {
    await User.updateMany(
      { orders: { $in: orderIds } },
      { $pull: { orders: { $in: orderIds } } }
    );
  }

  return {
    scanned: expiredOrders.length,
    deletedOrders: deletedOrderCount,
    deletedImages,
    imageDeleteFailed,
    skipped: false,
  };
}

export async function runOrderCleanupSafely(now: Date = new Date()): Promise<CleanupExpiredOrdersResult> {
  const nowMs = Date.now();
  if (global.__orderCleanupRunning) {
    return {
      scanned: 0,
      deletedOrders: 0,
      deletedImages: 0,
      imageDeleteFailed: 0,
      skipped: true,
    };
  }

  if (
    typeof global.__orderCleanupLastRunAt === "number" &&
    nowMs - global.__orderCleanupLastRunAt < ORDER_CLEANUP_COOLDOWN_MS
  ) {
    return {
      scanned: 0,
      deletedOrders: 0,
      deletedImages: 0,
      imageDeleteFailed: 0,
      skipped: true,
    };
  }

  global.__orderCleanupRunning = true;
  try {
    const result = await cleanupExpiredOrders(now);
    global.__orderCleanupLastRunAt = nowMs;
    if (result.deletedOrders > 0 || result.imageDeleteFailed > 0) {
      // console.log(
      //   `[order-cleanup] Deleted ${result.deletedOrders} expired order(s), removed ${result.deletedImages} image(s), failed image deletions ${result.imageDeleteFailed}.`
      // );
    }
    return result;
  } finally {
    global.__orderCleanupRunning = false;
  }
}
