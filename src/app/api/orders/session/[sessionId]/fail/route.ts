import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import BookingSession from "@/app/api/models/bookingSessionModel";
import Bus from "@/app/api/models/busModel";

function getUtcDayRange(date: Date) {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart, dayEnd };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;

  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
    return NextResponse.json({ error: "Valid session ID is required." }, { status: 400 });
  }

  let body: {
    reason?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    razorpayOrderId?: string;
  } = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    await dbConnect();

    const bookingSession = await BookingSession.findById(sessionId).session(dbSession);

    if (!bookingSession) {
      throw new Error("Booking session not found.");
    }

    if (bookingSession.status !== "HOLD") {
      await dbSession.commitTransaction();
      return NextResponse.json(
        { message: `Session is already ${bookingSession.status}. No failure update needed.` },
        { status: 200 }
      );
    }

    const { dayStart, dayEnd } = getUtcDayRange(bookingSession.orderDate);
    const restoreResult = await Bus.updateOne(
      {
        _id: bookingSession.busId,
        availability: {
          $elemMatch: {
            date: { $gte: dayStart, $lt: dayEnd },
          },
        },
      },
      { $inc: { "availability.$.availableCapacityKg": bookingSession.totalWeightKg } },
      { session: dbSession }
    );

    if (restoreResult.modifiedCount === 0) {
      throw new Error("Failed to restore bus capacity for failed session.");
    }

    bookingSession.status = "FAILED";
    bookingSession.failureReason = body.reason || "PAYMENT_FAILED";
    bookingSession.razorpayOrderId = body.razorpayOrderId || bookingSession.razorpayOrderId;
    bookingSession.razorpayPaymentId =
      body.razorpayPaymentId || bookingSession.razorpayPaymentId;
    bookingSession.razorpaySignature =
      body.razorpaySignature || bookingSession.razorpaySignature;

    await bookingSession.save({ session: dbSession });
    await dbSession.commitTransaction();

    return NextResponse.json(
      {
        message: "Booking session marked as FAILED and capacity restored.",
        sessionId: bookingSession._id,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    await dbSession.abortTransaction();
    console.error(`Error marking session ${sessionId} as failed:`, error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    dbSession.endSession();
  }
}
