import { NextResponse } from "next/server";
import { cleanupExpiredBookingSessions } from "@/app/api/lib/bookingSessionCleanup";
import { cleanupExpiredOrders } from "@/app/api/lib/orderCleanup";

export async function POST() {
  try {
    const [bookingResult, orderResult] = await Promise.all([
      cleanupExpiredBookingSessions(),
      cleanupExpiredOrders(),
    ]);

    return NextResponse.json(
      {
        message: `Cleanup completed. Restored ${bookingResult.restored} expired booking session(s) and deleted ${orderResult.deletedOrders} expired order(s).`,
        bookingSessions: bookingResult,
        orders: orderResult,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[booking-cleanup] Cleanup endpoint failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
