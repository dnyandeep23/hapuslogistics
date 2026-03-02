import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
import { uploadImageFile } from "@/app/api/lib/cloudinary";
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
