import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
import { uploadImageFile } from "@/app/api/lib/cloudinary";
import {
  cleanupExpiredTemporaryPackageImages,
  deleteTemporaryPackageImageLease,
  registerTemporaryPackageImageLease,
} from "@/app/api/lib/packageImageCleanup";
import User from "@/app/api/models/userModel";

const JWT_SECRET = process.env.JWT_SECRET!;
const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_FOLDERS = new Set(["orders/packages", "orders/proofs", "buses", "dashboard/banners"]);

const getTokenUserId = (request: NextRequest): string | null => {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id?: string };
    return payload.id ?? null;
  } catch {
    return null;
  }
};

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    void cleanupExpiredTemporaryPackageImages().catch((error: unknown) => {
      console.error("[package-image] Cleanup before upload failed:", error);
    });

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(userId).select("_id");
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("image");
    const requestedFolder = String(formData.get("folder") ?? "").trim();
    const folder = ALLOWED_FOLDERS.has(requestedFolder) ? requestedFolder : "orders/packages";

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json(
        { success: false, message: "Image file is required." },
        { status: 400 },
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, message: "Only image files are allowed." },
        { status: 400 },
      );
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, message: "Image size must be under 8MB." },
        { status: 400 },
      );
    }

    const imageUrl = await uploadImageFile(file, { folder });
    await registerTemporaryPackageImageLease({ userId, imageUrl });
    return NextResponse.json({ success: true, imageUrl }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to upload image.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    void cleanupExpiredTemporaryPackageImages().catch((error: unknown) => {
      console.error("[package-image] Cleanup before delete failed:", error);
    });

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(userId).select("_id");
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { imageUrl?: unknown };
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    if (!imageUrl) {
      return NextResponse.json(
        { success: false, message: "Image URL is required." },
        { status: 400 },
      );
    }

    const result = await deleteTemporaryPackageImageLease({ userId, imageUrl });
    if (result.reason === "not_found") {
      return NextResponse.json(
        { success: true, deleted: false, message: "Image already removed or not tracked." },
        { status: 200 },
      );
    }
    if (result.reason === "invalid_image") {
      return NextResponse.json(
        { success: false, deleted: false, message: "Invalid image URL." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: result.deleted,
        deleted: result.deleted,
        message: result.deleted ? "Image deleted." : "Image could not be deleted from storage.",
      },
      { status: result.deleted ? 200 : 500 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete image.",
      },
      { status: 500 },
    );
  }
}
