import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import Order from "@/app/api/models/orderModel";
import OrderFeedback from "@/app/api/models/orderFeedbackModel";

const JWT_SECRET = process.env.JWT_SECRET!;

type AuthPayload = {
  id?: string;
};

type UnknownRecord = Record<string, unknown>;

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

const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getTokenUserId = (request: NextRequest): string | null => {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
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

    const body = (await request.json()) as {
      orderId?: string;
      rating?: number | string;
      comment?: string;
    };

    const orderId = toStringValue(body?.orderId).trim();
    const rating = Math.round(toNumberValue(body?.rating));
    const comment = toStringValue(body?.comment).trim();

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json(
        { success: false, message: "Valid orderId is required." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, message: "Rating must be between 1 and 5." },
        { status: 400 },
      );
    }

    const order = await Order.findById(orderId).select("_id user status trackingId").lean<UnknownRecord | null>();
    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found." }, { status: 404 });
    }

    if (toStringValue(order.user) !== userId) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    if (toStringValue(order.status).toLowerCase() !== "delivered") {
      return NextResponse.json(
        { success: false, message: "Feedback is available only after delivery is completed." },
        { status: 409 },
      );
    }

    const feedback = await OrderFeedback.findOneAndUpdate(
      { orderId: new mongoose.Types.ObjectId(orderId), userId: new mongoose.Types.ObjectId(userId) },
      {
        $set: {
          orderId: new mongoose.Types.ObjectId(orderId),
          userId: new mongoose.Types.ObjectId(userId),
          trackingId: toStringValue(order.trackingId),
          rating,
          comment,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    ).lean<UnknownRecord | null>();

    return NextResponse.json(
      {
        success: true,
        message: "Feedback saved successfully.",
        feedback: feedback
          ? {
              id: toStringValue(feedback._id),
              orderId: toStringValue(feedback.orderId),
              trackingId: toStringValue(feedback.trackingId),
              rating: toNumberValue(feedback.rating),
              comment: toStringValue(feedback.comment),
              createdAt: toStringValue(feedback.createdAt),
              updatedAt: toStringValue(feedback.updatedAt),
            }
          : null,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("Error saving feedback:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = toStringValue(searchParams.get("orderId")).trim();
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json(
        { success: false, message: "Valid orderId is required." },
        { status: 400 },
      );
    }

    const feedback = await OrderFeedback.findOne({
      orderId: new mongoose.Types.ObjectId(orderId),
      userId: new mongoose.Types.ObjectId(userId),
    }).lean<UnknownRecord | null>();

    return NextResponse.json(
      {
        success: true,
        feedback: feedback
          ? {
              id: toStringValue(feedback._id),
              orderId: toStringValue(feedback.orderId),
              trackingId: toStringValue(feedback.trackingId),
              rating: toNumberValue(feedback.rating),
              comment: toStringValue(feedback.comment),
              createdAt: toStringValue(feedback.createdAt),
              updatedAt: toStringValue(feedback.updatedAt),
            }
          : null,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("Error loading feedback:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
