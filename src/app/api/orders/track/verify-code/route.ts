import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import OrderTrackingCode from "@/app/api/models/orderTrackingCodeModel";
import {
  findOrderForTracking,
  mapOrderForTracking,
  normalizeEmail,
  normalizeIdentifier,
} from "@/app/api/orders/track/helpers";

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = (await request.json().catch(() => ({}))) as {
      identifier?: unknown;
      email?: unknown;
      code?: unknown;
    };

    const identifier = normalizeIdentifier(body.identifier);
    const email = normalizeEmail(body.email);
    const code = normalizeIdentifier(body.code);

    if (!identifier) {
      return NextResponse.json({ message: "Order ID or Tracking ID is required." }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ message: "Email is required." }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ message: "Verification code is required." }, { status: 400 });
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

    const codeRecord = await OrderTrackingCode.findOne({ orderId: order._id, email })
      .sort({ updatedAt: -1 })
      .lean<{ _id: unknown; codeHash?: string; expiresAt?: Date } | null>();

    if (!codeRecord?.codeHash || !codeRecord.expiresAt) {
      return NextResponse.json({ message: "No active verification code found." }, { status: 400 });
    }

    if (new Date(codeRecord.expiresAt).getTime() < Date.now()) {
      await OrderTrackingCode.deleteOne({ _id: codeRecord._id });
      return NextResponse.json({ message: "Verification code has expired." }, { status: 400 });
    }

    const isValidCode = await bcryptjs.compare(code, codeRecord.codeHash);
    if (!isValidCode) {
      return NextResponse.json({ message: "Invalid verification code." }, { status: 400 });
    }

    await OrderTrackingCode.deleteOne({ _id: codeRecord._id });

    return NextResponse.json(
      {
        success: true,
        order: mapOrderForTracking(order),
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
