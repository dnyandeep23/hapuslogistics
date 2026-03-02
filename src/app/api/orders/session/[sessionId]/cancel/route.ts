
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/app/api/lib/db';
import BookingSession from '@/app/api/models/bookingSessionModel';
import Bus from '@/app/api/models/busModel';

function getUtcDayRange(date: Date) {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart, dayEnd };
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
  }

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    await dbConnect();

    const bookingSession = await BookingSession.findById(sessionId).session(dbSession);

    if (!bookingSession) {
      throw new Error('Booking session not found.');
    }

    if (bookingSession.status !== 'HOLD') {
      // Cannot cancel a session that is not on hold
      await dbSession.abortTransaction();
      return NextResponse.json({ message: `Session is already ${bookingSession.status} and cannot be cancelled.` }, { status: 409 });
    }

    // Restore capacity
    const { dayStart, dayEnd } = getUtcDayRange(bookingSession.orderDate);
    await Bus.updateOne(
      {
        _id: bookingSession.busId,
        availability: {
          $elemMatch: {
            date: { $gte: dayStart, $lt: dayEnd },
          },
        },
      },
      { $inc: { 'availability.$.availableCapacityKg': bookingSession.totalWeightKg } },
      { session: dbSession }
    );

    bookingSession.status = 'CANCELLED';
    await bookingSession.save({ session: dbSession });

    await dbSession.commitTransaction();

    return NextResponse.json({
      message: 'Booking session has been cancelled successfully.',
    }, { status: 200 });

  } catch (error) {
    await dbSession.abortTransaction();
    console.error(`Error cancelling session ${sessionId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    dbSession.endSession();
  }
}
