import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import Razorpay from "razorpay";
import { dbConnect } from "@/app/api/lib/db";
import { validateRazorpaySignature } from "@/app/api/lib/razorpay";
import User from "@/app/api/models/userModel";
import Order from "@/app/api/models/orderModel";

interface AuthPayload {
  id: string;
}

function toStringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    await dbConnect();

    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    const actor = await User.findById(payload.id).select("_id role isSuperAdmin");
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await context.params;
    const order = await Order.findById(orderId).select(
      "_id user trackingId adjustmentPendingAmount adjustmentStatus",
    );
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const isOwner = toStringValue(order.user) === toStringValue(actor._id);
    const isAdmin = toStringValue(actor.role) === "admin" || Boolean(actor.isSuperAdmin);
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pendingAmount = toNumberValue(order.adjustmentPendingAmount);
    if (pendingAmount <= 0 || toStringValue(order.adjustmentStatus) !== "pending_payment") {
      return NextResponse.json(
        { error: "No pending additional amount for this order." },
        { status: 409 },
      );
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(pendingAmount * 100),
      currency: "INR",
      receipt: `adj_${toStringValue(order._id).slice(-10)}_${Date.now().toString().slice(-6)}`,
    });

    order.adjustmentRazorpayOrderId = razorpayOrder.id;
    order.adjustmentUpdatedAt = new Date();
    await order.save();

    return NextResponse.json(
      {
        success: true,
        orderId: toStringValue(order._id),
        trackingId: toStringValue(order.trackingId),
        adjustmentAmount: pendingAmount,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID || "",
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create payment order." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    await dbConnect();

    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    const actor = await User.findById(payload.id).select("_id role isSuperAdmin");
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await context.params;
    const order = await Order.findById(orderId).select(
      "_id user adjustmentPendingAmount adjustmentRefundAmount adjustmentStatus adjustmentRazorpayOrderId",
    );
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const isOwner = toStringValue(order.user) === toStringValue(actor._id);
    const isAdmin = toStringValue(actor.role) === "admin" || Boolean(actor.isSuperAdmin);
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    const razorpayOrderId = toStringValue(body.razorpay_order_id);
    const razorpayPaymentId = toStringValue(body.razorpay_payment_id);
    const razorpaySignature = toStringValue(body.razorpay_signature);
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { error: "Missing Razorpay payment details." },
        { status: 400 },
      );
    }

    if (toStringValue(order.adjustmentStatus) !== "pending_payment" || toNumberValue(order.adjustmentPendingAmount) <= 0) {
      return NextResponse.json(
        { error: "This order has no payable adjustment amount." },
        { status: 409 },
      );
    }

    if (toStringValue(order.adjustmentRazorpayOrderId) && toStringValue(order.adjustmentRazorpayOrderId) !== razorpayOrderId) {
      return NextResponse.json({ error: "Razorpay order mismatch." }, { status: 400 });
    }

    if (!validateRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
      return NextResponse.json({ error: "Invalid payment signature." }, { status: 400 });
    }

    order.adjustmentPendingAmount = 0;
    order.adjustmentStatus = toNumberValue(order.adjustmentRefundAmount) > 0 ? "pending_refund" : "settled";
    order.adjustmentRazorpayOrderId = razorpayOrderId;
    order.adjustmentRazorpayPaymentId = razorpayPaymentId;
    order.adjustmentRazorpaySignature = razorpaySignature;
    order.adjustmentUpdatedAt = new Date();
    await order.save();

    return NextResponse.json(
      {
        success: true,
        message: "Additional amount payment verified successfully.",
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify adjustment payment." },
      { status: 500 },
    );
  }
}

