import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import {
  deleteCloudinaryImageByUrl,
  uploadImageFile,
} from "@/app/api/lib/cloudinary";
import User from "@/app/api/models/userModel";
import Order from "@/app/api/models/orderModel";
import Bus from "@/app/api/models/busModel";

const JWT_SECRET = process.env.JWT_SECRET!;

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

const normalizeDateOnly = (value: unknown): Date | null => {
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
};

const toStringValue = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object") {
    const maybeHex = (value as { toHexString?: () => string }).toHexString;
    if (typeof maybeHex === "function") {
      const hex = maybeHex.call(value);
      if (hex) return hex;
    }
    const maybeToString = (value as { toString?: () => string }).toString;
    if (typeof maybeToString === "function") {
      const stringified = maybeToString.call(value);
      if (stringified && stringified !== "[object Object]") return stringified;
    }
  }
  return fallback;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  let uploadedProofImageUrl: string | null = null;
  let orderSaved = false;
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const operator = await User.findById(userId).select("role");
    if (!operator || operator.role !== "operator") {
      return NextResponse.json(
        { success: false, message: "Operator access required." },
        { status: 403 },
      );
    }

    const { orderId } = await context.params;
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json({ success: false, message: "Invalid order id." }, { status: 400 });
    }

    const formData = await request.formData();
    const proofTypeRaw = String(formData.get("proofType") ?? "").trim().toLowerCase();
    const proofType = proofTypeRaw === "pickup" || proofTypeRaw === "drop" ? proofTypeRaw : "";
    const file = formData.get("image");

    if (!proofType) {
      return NextResponse.json(
        { success: false, message: "proofType must be pickup or drop." },
        { status: 400 },
      );
    }

    const isFileLike =
      file &&
      typeof file === "object" &&
      typeof (file as Blob).arrayBuffer === "function" &&
      typeof (file as Blob).size === "number";

    if (!isFileLike || (file as Blob).size <= 0) {
      return NextResponse.json(
        { success: false, message: "Proof image is required." },
        { status: 400 },
      );
    }

    const fileMimeType = String((file as File).type ?? "").toLowerCase();
    const fileName = String((file as File).name ?? "").toLowerCase();
    const hasImageMime = fileMimeType.startsWith("image/");
    const hasImageExtension = /\.(jpg|jpeg|png|webp|heic|heif|gif|bmp|tiff|avif)$/.test(fileName);
    const hasUnknownMime = !fileMimeType;
    if (!hasImageMime && !hasImageExtension && !hasUnknownMime) {
      return NextResponse.json(
        { success: false, message: "Only image files are allowed." },
        { status: 400 },
      );
    }

    if ((file as Blob).size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "Image size must be under 8MB." },
        { status: 400 },
      );
    }

    const order = await Order.findById(orderId).select(
      "_id orderDate status assignedBus bus pickupProofImage dropProofImage",
    );
    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found." }, { status: 404 });
    }

    const effectiveBusId = String(order.assignedBus ?? order.bus ?? "");
    if (!effectiveBusId || !mongoose.Types.ObjectId.isValid(effectiveBusId)) {
      return NextResponse.json(
        { success: false, message: "No bus assigned to this order yet." },
        { status: 400 },
      );
    }

    const bus = await Bus.findById(effectiveBusId).select("operatorContactPeriods");
    if (!bus) {
      return NextResponse.json({ success: false, message: "Assigned bus not found." }, { status: 404 });
    }

    const periods = Array.isArray(bus.operatorContactPeriods) ? bus.operatorContactPeriods : [];
    const isBusAssignedOperator = periods.some(
      (period) => toStringValue(period.operatorId) === toStringValue(operator._id),
    );
    const orderDate = normalizeDateOnly(order.orderDate);
    const isAssignedOperatorForDate =
      Boolean(orderDate) &&
      periods.some((period) => {
        if (toStringValue(period.operatorId) !== toStringValue(operator._id)) return false;
        const startDate = normalizeDateOnly(period.startDate);
        const endDate = normalizeDateOnly(period.endDate);
        if (!startDate || !endDate || !orderDate) return false;
        return orderDate >= startDate && orderDate <= endDate;
      });

    if (!isAssignedOperatorForDate && !isBusAssignedOperator) {
      return NextResponse.json(
        { success: false, message: "You are not assigned to this bus/operator period." },
        { status: 403 },
      );
    }

    if (proofType === "pickup") {
      const normalizedStatus = String(order.status ?? "").toLowerCase();
      if (["cancelled", "delivered"].includes(normalizedStatus)) {
        return NextResponse.json(
          { success: false, message: `Cannot capture pickup proof when order is ${normalizedStatus}.` },
          { status: 400 },
        );
      }
      if (String(order.pickupProofImage ?? "").trim()) {
        return NextResponse.json(
          { success: false, message: "Pickup proof already uploaded and locked. Changes are not allowed." },
          { status: 409 },
        );
      }
      const imageFile = file as File;
      uploadedProofImageUrl = await uploadImageFile(imageFile, { folder: "orders/proofs" });
      order.pickupProofImage = uploadedProofImageUrl;
      order.pickupProofAt = new Date();
      order.status = "in-transit";
    } else {
      if (!order.pickupProofImage) {
        return NextResponse.json(
          { success: false, message: "Upload pickup proof before drop proof." },
          { status: 400 },
        );
      }
      if (String(order.status ?? "").toLowerCase() !== "in-transit") {
        return NextResponse.json(
          { success: false, message: "Drop proof can be uploaded only when order is in-transit." },
          { status: 400 },
        );
      }
      if (String(order.dropProofImage ?? "").trim()) {
        return NextResponse.json(
          { success: false, message: "Drop proof already uploaded and locked. Changes are not allowed." },
          { status: 409 },
        );
      }
      const imageFile = file as File;
      uploadedProofImageUrl = await uploadImageFile(imageFile, { folder: "orders/proofs" });
      order.dropProofImage = uploadedProofImageUrl;
      order.dropProofAt = new Date();
      order.status = "delivered";
    }

    order.operatorVerifiedBy = operator._id;
    await order.save();
    orderSaved = true;

    return NextResponse.json(
      {
        success: true,
        message: proofType === "pickup" ? "Pickup verified." : "Drop verified. Order delivered.",
        order: {
          id: order._id.toString(),
          status: order.status,
          pickupProofImage: order.pickupProofImage || "",
          dropProofImage: order.dropProofImage || "",
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (!orderSaved && uploadedProofImageUrl) {
      const deleted = await deleteCloudinaryImageByUrl(uploadedProofImageUrl);
      if (!deleted) {
        console.error("[order-proof] Failed to cleanup proof image after failed save.");
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to upload proof image.",
      },
      { status: 500 },
    );
  }
}
