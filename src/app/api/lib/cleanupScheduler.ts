import { cleanupExpiredBookingSessions } from "@/app/api/lib/bookingSessionCleanup";
import { cleanupExpiredUserAccounts } from "@/app/api/lib/accountDeletion";
import { runOrderCleanupSafely } from "@/app/api/lib/orderCleanup";
import { cleanupExpiredTemporaryPackageImages } from "@/app/api/lib/packageImageCleanup";

const CLEANUP_INTERVAL_MS = 60_000;

declare global {
  var __bookingCleanupSchedulerStarted: boolean | undefined;
  var __bookingCleanupSchedulerTimer: NodeJS.Timeout | undefined;
}

async function runCleanupCycle() {
  try {
    await cleanupExpiredBookingSessions();
    await runOrderCleanupSafely();
    await cleanupExpiredUserAccounts();
    await cleanupExpiredTemporaryPackageImages();
  } catch (error: unknown) {
    console.error("[booking-cleanup] Scheduler cycle failed:", error);
  }
}

export function startBookingCleanupScheduler() {
  if (global.__bookingCleanupSchedulerStarted) {
    return;
  }

  global.__bookingCleanupSchedulerStarted = true;
  global.__bookingCleanupSchedulerTimer = setInterval(() => {
    void runCleanupCycle();
  }, CLEANUP_INTERVAL_MS);

  global.__bookingCleanupSchedulerTimer.unref?.();

  // console.log("[booking-cleanup] Scheduler started (runs every 1 minute).");

  // Run once immediately on startup.
  void runCleanupCycle();
}

startBookingCleanupScheduler();
