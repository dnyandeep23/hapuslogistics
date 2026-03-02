import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import { dbConnect } from "@/app/api/lib/db";
import { sendEmail, wasEmailAccepted } from "@/app/api/lib/mailer";
import User from "@/app/api/models/userModel";
import OrderTrackingCode from "@/app/api/models/orderTrackingCodeModel";
import {
  findOrderForTracking,
  normalizeEmail,
  normalizeIdentifier,
  toStringValue,
} from "@/app/api/orders/track/helpers";

function generateOtp(length = 6): string {
  const digits = "0123456789";
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return value;
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = (await request.json().catch(() => ({}))) as {
      identifier?: unknown;
      email?: unknown;
    };

    const identifier = normalizeIdentifier(body.identifier);
    const email = normalizeEmail(body.email);

    if (!identifier) {
      return NextResponse.json({ message: "Order ID or Tracking ID is required." }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ message: "Email is required." }, { status: 400 });
    }

    const order = await findOrderForTracking(identifier);
    if (!order) {
      return NextResponse.json({ message: "Order not found." }, { status: 404 });
    }

    const orderOwner = await User.findById(order.user).select("email").lean<{ email?: string } | null>();
    const ownerEmail = normalizeEmail(orderOwner?.email);
    if (!ownerEmail || ownerEmail !== email) {
      return NextResponse.json(
        { message: "This order is made from another account." },
        { status: 403 },
      );
    }

    const otp = generateOtp();
    const otpHash = await bcryptjs.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OrderTrackingCode.findOneAndUpdate(
      { orderId: order._id, email },
      {
        orderId: order._id,
        email,
        codeHash: otpHash,
        expiresAt,
      },
      { upsert: true, setDefaultsOnInsert: true },
    );

    const mailResponse = await sendEmail({
      email,
      emailType: "ORDER_TRACKING_OTP",
      securityCode: otp,
      trackingId: toStringValue(order.trackingId, "TRACKING-PENDING"),
    });

    if (!wasEmailAccepted(mailResponse)) {
      return NextResponse.json(
        { message: "Verification email could not be delivered. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Verification code sent to your email.",
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
