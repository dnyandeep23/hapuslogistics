import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import BookingSession from "@/app/api/models/bookingSessionModel";
import { cleanupExpiredBookingSessions } from "@/app/api/lib/bookingSessionCleanup";

const HOLD_DURATION_MS = 20 * 60 * 1000;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function POST(request: NextRequest) {
  try {
    await cleanupExpiredBookingSessions();
  } catch (cleanupError: unknown) {
    console.error(
      "[booking-cleanup] Pre-booking cleanup failed. Continuing booking flow:",
      cleanupError
    );
  }

  let dbSession: mongoose.ClientSession | null = null;

  try {
    await dbConnect();

    const { sessionId, userId, senderInfo, receiverInfo } = await request.json();

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Valid userId is required" }, { status: 400 });
    }
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return NextResponse.json(
        { error: "Valid sessionId is required. Create HOLD from pricing first." },
        { status: 400 }
      );
    }
    if (!senderInfo || !receiverInfo) {
      return NextResponse.json(
        { error: "senderInfo and receiverInfo are required to continue payment" },
        { status: 400 }
      );
    }

    dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    const user = await User.findById(userId).session(dbSession);
    if (!user) {
      throw new ApiError("User not found", 404);
    }

    const now = new Date();
    const holdSession = await BookingSession.findOne({
      _id: sessionId,
      userId,
      status: "HOLD",
      expiresAt: { $gt: now },
    }).session(dbSession);

    if (!holdSession) {
      throw new ApiError("Active HOLD session not found or already expired", 409);
    }

    if (senderInfo && typeof senderInfo === "object") {
      holdSession.senderInfo = senderInfo;
    }
    if (receiverInfo && typeof receiverInfo === "object") {
      holdSession.receiverInfo = receiverInfo;
    }
    if (holdSession.totalAmount <= 0) {
      throw new ApiError("Invalid session total amount. Recalculate pricing.", 409);
    }

    holdSession.expiresAt = new Date(Date.now() + HOLD_DURATION_MS);

    if (!holdSession.razorpayOrderId) {
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(holdSession.totalAmount * 100),
        currency: "INR",
        receipt: holdSession._id.toString(),
      });
      holdSession.razorpayOrderId = razorpayOrder.id;
    }

    await holdSession.save({ session: dbSession });
    await dbSession.commitTransaction();

    return NextResponse.json(
      {
        sessionId: holdSession._id,
        razorpayOrderId: holdSession.razorpayOrderId,
        amount: Math.round(holdSession.totalAmount * 100),
        currency: "INR",
        continued: true,
        expiresAt: holdSession.expiresAt,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (dbSession?.inTransaction()) {
      await dbSession.abortTransaction();
    }
    console.error("Error continuing booking session:", error);

    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    dbSession?.endSession();
  }
}
