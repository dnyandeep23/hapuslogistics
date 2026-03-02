import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import BookingSession from "@/app/api/models/bookingSessionModel";
import Bus from "@/app/api/models/busModel";

export interface CleanupExpiredSessionsResult {
  scanned: number;
  restored: number;
  skipped: number;
  failed: number;
}

function getUtcDayRange(date: Date) {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart, dayEnd };
}

export async function cleanupExpiredBookingSessions(
  now: Date = new Date()
): Promise<CleanupExpiredSessionsResult> {
  await dbConnect();

  const expiredCandidates = await BookingSession.find({
    status: "HOLD",
    expiresAt: { $lt: now },
  }).select("_id");

  let restored = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of expiredCandidates) {
    const txSession = await mongoose.startSession();

    try {
      txSession.startTransaction();

      // Claim session inside transaction so capacity restore happens only once.
      const expiredSession = await BookingSession.findOneAndUpdate(
        {
          _id: candidate._id,
          status: "HOLD",
          expiresAt: { $lt: now },
        },
        {
          $set: { status: "EXPIRED" },
        },
        {
          new: true,
          session: txSession,
        }
      );

      if (!expiredSession) {
        skipped += 1;
        await txSession.commitTransaction();
        continue;
      }

      const { dayStart, dayEnd } = getUtcDayRange(expiredSession.orderDate);
      const restoreResult = await Bus.updateOne(
        {
          _id: expiredSession.busId,
          availability: {
            $elemMatch: {
              date: { $gte: dayStart, $lt: dayEnd },
            },
          },
        },
        {
          $inc: {
            "availability.$.availableCapacityKg": expiredSession.totalWeightKg,
          },
        },
        { session: txSession }
      );

      if (restoreResult.modifiedCount === 0) {
        throw new Error(
          `Bus availability not found for expired session ${expiredSession._id.toString()}`
        );
      }

      await txSession.commitTransaction();
      restored += 1;
    } catch (error: unknown) {
      failed += 1;
      await txSession.abortTransaction();
      console.error("[booking-cleanup] Failed to expire session:", error);
    } finally {
      txSession.endSession();
    }
  }

  // console.log(
  //   `[booking-cleanup] Restored ${restored} expired session(s). Scanned ${expiredCandidates.length}, skipped ${skipped}, failed ${failed}.`
  // );

  return {
    scanned: expiredCandidates.length,
    restored,
    skipped,
    failed,
  };
}
