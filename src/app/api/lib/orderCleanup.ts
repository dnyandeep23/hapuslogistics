import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import { deleteCloudinaryImageByUrl, isCloudinaryImageUrl } from "@/app/api/lib/cloudinary";
import { resolveOrderStartDateTime } from "@/app/api/lib/orderCancellation";
import Order from "@/app/api/models/orderModel";
import Bus from "@/app/api/models/busModel";
import User from "@/app/api/models/userModel";

const ORDER_RETENTION_MONTHS = 3;
const ORDER_CLEANUP_BATCH_LIMIT = 100;
const ORDER_CLEANUP_COOLDOWN_MS = 60_000;

declare global {
  var __orderCleanupRunning: boolean | undefined;
  var __orderCleanupLastRunAt: number | undefined;
}

export interface CleanupExpiredOrdersResult {
  scanned: number;
  deletedOrders: number;
  deletedImages: number;
  imageDeleteFailed: number;
  autoMarkedMissedPackages: number;
  skipped: boolean;
}

type CleanupOrderDoc = {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  expiresAt?: Date;
  pickupProofImage?: string;
  dropProofImage?: string;
  packages?: unknown[];
};

type MissedOrderDoc = {
  _id: mongoose.Types.ObjectId;
  trackingId?: string;
  status?: string;
  orderDate?: Date | string;
  totalAmount?: number;
  adjustmentPendingAmount?: number;
  adjustmentRefundAmount?: number;
  totalWeightKg?: number;
  assignedBus?: unknown;
  bus?: unknown;
  operatorNote?: string;
  adminNote?: string;
  orderReports?: unknown[];
  missedPackageDetails?: {
    markedAt?: unknown;
  };
};

function getExpiryCutoffDate(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - ORDER_RETENTION_MONTHS);
  return cutoff;
}

function collectImageUrls(order: CleanupOrderDoc): string[] {
  const urls = new Set<string>();
  const pickupProofImage = toStringValue(order.pickupProofImage);
  const dropProofImage = toStringValue(order.dropProofImage);

  if (pickupProofImage) urls.add(pickupProofImage);
  if (dropProofImage) urls.add(dropProofImage);

  if (Array.isArray(order.packages)) {
    for (const item of order.packages) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const packageImage = toStringValue((item as { packageImage?: unknown }).packageImage);
      if (packageImage) urls.add(packageImage);
    }
  }

  return Array.from(urls);
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object") {
    const maybeHex = (value as { toHexString?: () => string }).toHexString;
    if (typeof maybeHex === "function") return maybeHex.call(value);
    const maybeToString = (value as { toString?: () => string }).toString;
    if (typeof maybeToString === "function") {
      const rendered = maybeToString.call(value);
      if (rendered && rendered !== "[object Object]") return rendered;
    }
  }
  return "";
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function extractRefId(value: unknown): string {
  if (value && typeof value === "object") {
    const nestedId = toStringValue((value as { _id?: unknown })._id);
    if (nestedId) return nestedId;
  }
  return toStringValue(value);
}

function getUtcDayRange(date: Date) {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart, dayEnd };
}

function toDateKeyInBusinessTimezone(value: unknown): string | null {
  const parsed = new Date(toStringValue(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function hasOperationalReport(order: MissedOrderDoc): boolean {
  if (toStringValue(order.operatorNote) || toStringValue(order.adminNote)) {
    return true;
  }

  if (!Array.isArray(order.orderReports)) return false;
  return order.orderReports.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const record = entry as { createdByRole?: unknown; reportType?: unknown };
    const createdByRole = toStringValue(record.createdByRole).toLowerCase();
    const reportType = toStringValue(record.reportType).toLowerCase();
    return (
      createdByRole === "operator" ||
      createdByRole === "admin" ||
      reportType === "operator_incident"
    );
  });
}

async function autoMarkMissedOrders(now: Date): Promise<number> {
  const todayKey = toDateKeyInBusinessTimezone(now);
  if (!todayKey) return 0;

  let ordersQuery = Order.find({
    status: { $in: ["pending", "confirmed", "allocated"] },
  }).select(
    "_id trackingId status orderDate totalAmount adjustmentPendingAmount adjustmentRefundAmount totalWeightKg assignedBus bus operatorNote adminNote orderReports missedPackageDetails",
  );

  if (Order.schema.path("assignedBus")) {
    ordersQuery = ordersQuery.populate("assignedBus", "routePath pricing");
  }
  if (Order.schema.path("bus")) {
    ordersQuery = ordersQuery.populate("bus", "routePath pricing");
  }

  const candidates = await ordersQuery.lean<MissedOrderDoc[]>();
  if (!Array.isArray(candidates) || candidates.length === 0) return 0;

  let markedCount = 0;

  for (const order of candidates) {
    const orderDateKey = toDateKeyInBusinessTimezone(order.orderDate);
    if (!orderDateKey || orderDateKey >= todayKey) continue;
    if (hasOperationalReport(order)) continue;
    if (order.missedPackageDetails?.markedAt) continue;

    const orderStartDateTime = resolveOrderStartDateTime(order.orderDate, order.assignedBus, order.bus);
    const baseAmount = Math.max(
      0,
      roundCurrency(
        toNumberValue(order.totalAmount, 0) +
          Math.max(0, toNumberValue(order.adjustmentRefundAmount, 0)) -
          Math.max(0, toNumberValue(order.adjustmentPendingAmount, 0)),
      ),
    );

    const effectiveBusId = extractRefId(order.assignedBus) || extractRefId(order.bus);
    const orderDateValue = new Date(toStringValue(order.orderDate));
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (effectiveBusId && mongoose.Types.ObjectId.isValid(effectiveBusId) && !Number.isNaN(orderDateValue.getTime())) {
          const { dayStart, dayEnd } = getUtcDayRange(orderDateValue);
          await Bus.updateOne(
            {
              _id: new mongoose.Types.ObjectId(effectiveBusId),
              availability: {
                $elemMatch: {
                  date: { $gte: dayStart, $lt: dayEnd },
                },
              },
            },
            { $inc: { "availability.$.availableCapacityKg": Math.max(0, roundCurrency(toNumberValue(order.totalWeightKg))) } },
            { session },
          );
        }

        const txOrder = await Order.findById(order._id).session(session);
        if (!txOrder) return;
        txOrder.status = "missed_package";
        txOrder.missedPackageDetails = {
          markedAt: now,
          markedByRole: "system",
          reason: orderStartDateTime
            ? "Order did not move to in-transit within the pickup date and no staff report was attached."
            : "Order did not move to in-transit within the pickup date.",
          exemptedByReport: false,
          refundBaseAmount: baseAmount,
          refundAmount: baseAmount,
          refundProcessingStatus: baseAmount > 0 ? "not_started" : "not_required",
          paymentRefundId: "",
          paymentRefundStatus: baseAmount > 0 ? "" : "not_required",
          paymentRefundError: "",
          refundTriggeredAt: null,
          refundTriggeredBy: null,
          refundTriggeredByRole: "",
          refundedAt: null,
        };
        txOrder.orderReports = Array.isArray(txOrder.orderReports) ? txOrder.orderReports : [];
        txOrder.orderReports.push({
          reportType: "missed_package_auto_mark",
          category: "missed_package",
          title: "Order auto-marked as missed package",
          description:
            "The pickup date passed without the order reaching in-transit status and without an operator/admin report.",
          createdBy: null,
          createdByRole: "system",
          createdAt: now,
          data: {
            refundBaseAmount: baseAmount,
            refundAmount: baseAmount,
            statusAtMarkTime: toStringValue(order.status) || "pending",
          },
        });
        await txOrder.save({ session });
      });
      markedCount += 1;
    } finally {
      await session.endSession();
    }
  }

  return markedCount;
}

export async function cleanupExpiredOrders(now: Date = new Date()): Promise<CleanupExpiredOrdersResult> {
  await dbConnect();
  const autoMarkedMissedPackages = await autoMarkMissedOrders(now);

  const expiryCutoff = getExpiryCutoffDate(now);
  const expiredOrders = await Order.find({
    $or: [
      { expiresAt: { $lte: now } },
      { expiresAt: { $exists: false }, createdAt: { $lte: expiryCutoff } },
      { expiresAt: null, createdAt: { $lte: expiryCutoff } },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(ORDER_CLEANUP_BATCH_LIMIT)
    .select("_id packages pickupProofImage dropProofImage expiresAt createdAt")
    .lean<CleanupOrderDoc[]>();

  if (!expiredOrders.length) {
    return {
      scanned: 0,
      deletedOrders: 0,
      deletedImages: 0,
      imageDeleteFailed: 0,
      autoMarkedMissedPackages,
      skipped: false,
    };
  }

  const orderIds = expiredOrders.map((order) => order._id);
  const imageUrls = new Set<string>();
  for (const order of expiredOrders) {
    for (const imageUrl of collectImageUrls(order)) {
      imageUrls.add(imageUrl);
    }
  }

  let deletedImages = 0;
  let imageDeleteFailed = 0;
  if (imageUrls.size > 0) {
    const cloudinaryUrls = Array.from(imageUrls).filter((url) => isCloudinaryImageUrl(url));
    const imageDeleteResults = await Promise.allSettled(
      cloudinaryUrls.map((url) => deleteCloudinaryImageByUrl(url))
    );

    for (const result of imageDeleteResults) {
      if (result.status === "fulfilled" && result.value) {
        deletedImages += 1;
      } else {
        imageDeleteFailed += 1;
      }
    }
  }

  const deleteOrderResult = await Order.deleteMany({ _id: { $in: orderIds } });
  const deletedOrderCount =
    typeof deleteOrderResult.deletedCount === "number" ? deleteOrderResult.deletedCount : 0;

  if (deletedOrderCount > 0) {
    await User.updateMany(
      { orders: { $in: orderIds } },
      { $pull: { orders: { $in: orderIds } } }
    );
  }

  return {
    scanned: expiredOrders.length,
    deletedOrders: deletedOrderCount,
    deletedImages,
    imageDeleteFailed,
    autoMarkedMissedPackages,
    skipped: false,
  };
}

export async function runOrderCleanupSafely(now: Date = new Date()): Promise<CleanupExpiredOrdersResult> {
  const nowMs = Date.now();
  if (global.__orderCleanupRunning) {
    return {
      scanned: 0,
      deletedOrders: 0,
      deletedImages: 0,
      imageDeleteFailed: 0,
      autoMarkedMissedPackages: 0,
      skipped: true,
    };
  }

  if (
    typeof global.__orderCleanupLastRunAt === "number" &&
    nowMs - global.__orderCleanupLastRunAt < ORDER_CLEANUP_COOLDOWN_MS
  ) {
    return {
      scanned: 0,
      deletedOrders: 0,
      deletedImages: 0,
      imageDeleteFailed: 0,
      autoMarkedMissedPackages: 0,
      skipped: true,
    };
  }

  global.__orderCleanupRunning = true;
  try {
    const result = await cleanupExpiredOrders(now);
    global.__orderCleanupLastRunAt = nowMs;
    if (result.deletedOrders > 0 || result.imageDeleteFailed > 0) {
      // console.log(
      //   `[order-cleanup] Deleted ${result.deletedOrders} expired order(s), removed ${result.deletedImages} image(s), failed image deletions ${result.imageDeleteFailed}.`
      // );
    }
    return result;
  } finally {
    global.__orderCleanupRunning = false;
  }
}
