import { NextResponse } from "next/server";
import { cleanupExpiredBookingSessions } from "@/app/api/lib/bookingSessionCleanup";
import { cleanupExpiredOrders } from "@/app/api/lib/orderCleanup";
import { cleanupExpiredTemporaryPackageImages } from "@/app/api/lib/packageImageCleanup";

export async function POST() {
  try {
    const [bookingResult, orderResult, tempImageResult] = await Promise.all([
      cleanupExpiredBookingSessions(),
      cleanupExpiredOrders(),
      cleanupExpiredTemporaryPackageImages(),
    ]);

    return NextResponse.json(
      {
        message: `Cleanup completed. Restored ${bookingResult.restored} expired booking session(s), auto-marked ${orderResult.autoMarkedMissedPackages} missed package order(s), deleted ${orderResult.deletedOrders} expired order(s), and removed ${tempImageResult.deleted} expired temporary package image(s).`,
        bookingSessions: bookingResult,
        orders: orderResult,
        temporaryPackageImages: tempImageResult,
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
