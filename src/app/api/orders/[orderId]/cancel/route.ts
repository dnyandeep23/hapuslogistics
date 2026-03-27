import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import { sendEmail } from "@/app/api/lib/mailer";
import {
  applyDeductionPercentToRefundPreview,
  calculateCancellationRefund,
  canAutoRefundPayment,
  CUSTOMER_CANCELLATION_DEDUCTION_PERCENT,
  normalizeRefundPolicySnapshot,
  processGatewayRefund,
  resolveOrderStartDateTime,
  type RefundMode,
} from "@/app/api/lib/orderCancellation";
import Bus from "@/app/api/models/busModel";
import Order from "@/app/api/models/orderModel";
import User from "@/app/api/models/userModel";

type UnknownRecord = Record<string, unknown>;

type ActorDoc = {
  _id?: unknown;
  role?: string;
  travelCompanyId?: unknown;
  buses?: unknown[];
};

type ParamsContext = {
  params: Promise<{ orderId: string }>;
};

const CANCELLABLE_USER_STATUSES = new Set(["pending", "confirmed", "allocated"]);

const toStringValue = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object") {
    const maybeHex = (value as { toHexString?: () => string }).toHexString;
    if (typeof maybeHex === "function") {
      const hex = maybeHex.call(value);
      if (hex) return hex;
    }
    const maybeToString = (value as { toString?: () => string }).toString;
    if (typeof maybeToString === "function") {
      const rendered = maybeToString.call(value);
      if (rendered && rendered !== "[object Object]") return rendered;
    }
  }
  return fallback;
};

const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;
const clampPercent = (value: number): number => Math.min(100, Math.max(0, roundCurrency(value)));

const extractRefId = (value: unknown): string => {
  if (value && typeof value === "object") {
    const record = value as UnknownRecord;
    const nestedId = toStringValue(record._id);
    if (nestedId) return nestedId;
  }
  return toStringValue(value);
};

const getCollectedAmount = (order: UnknownRecord): number => {
  const totalAmount = toNumberValue(order.totalAmount, 0);
  const adjustmentPendingAmount = Math.max(0, toNumberValue(order.adjustmentPendingAmount, 0));
  const adjustmentRefundAmount = Math.max(0, toNumberValue(order.adjustmentRefundAmount, 0));
  return Math.max(0, roundCurrency(totalAmount + adjustmentRefundAmount - adjustmentPendingAmount));
};

const normalizeDateOnly = (value: unknown): Date | null => {
  const date = new Date(toStringValue(value));
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const getUtcDayRange = (date: Date) => {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart, dayEnd };
};

const getTokenUserId = (request: NextRequest): string | null => {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id?: string };
    return payload.id ?? null;
  } catch {
    return null;
  }
};

const releaseBusCapacityForDay = async (
  session: mongoose.ClientSession,
  busId: mongoose.Types.ObjectId,
  dayStart: Date,
  dayEnd: Date,
  weightKg: number,
) => {
  const result = await Bus.updateOne(
    {
      _id: busId,
      availability: {
        $elemMatch: {
          date: { $gte: dayStart, $lt: dayEnd },
        },
      },
    },
    { $inc: { "availability.$.availableCapacityKg": weightKg } },
    { session },
  );

  return result.modifiedCount > 0;
};

export async function POST(request: NextRequest, context: ParamsContext) {
  try {
    await dbConnect();

    const actorId = getTokenUserId(request);
    if (!actorId || !mongoose.Types.ObjectId.isValid(actorId)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const actor = await User.findById(actorId)
      .select("_id role travelCompanyId buses")
      .lean<ActorDoc | null>();
    if (!actor) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const actorRole = toStringValue(actor.role) as "user" | "admin" | "operator";
    if (actorRole !== "user" && actorRole !== "admin") {
      return NextResponse.json(
        { success: false, message: "Only user or admin can cancel an order." },
        { status: 403 },
      );
    }

    const { orderId } = await context.params;
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json({ success: false, message: "Invalid order id." }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      reasonCode?: string;
      reasonDescription?: string;
      refundMode?: RefundMode;
      deductionPercentOverride?: unknown;
    };

    const reasonCode = toStringValue(body.reasonCode).trim().toLowerCase();
    const reasonDescription = toStringValue(body.reasonDescription).trim();
    if (!reasonCode && !reasonDescription) {
      return NextResponse.json(
        { success: false, message: "Cancellation reason is required." },
        { status: 400 },
      );
    }

    let orderQuery = Order.findById(orderId).select(
      "_id user trackingId status orderDate assignedBus bus totalAmount totalWeightKg paymentId adjustmentPendingAmount adjustmentRefundAmount adjustmentStatus refundPolicySnapshot cancellationDetails orderReports",
    );
    if (Order.schema.path("assignedBus")) {
      orderQuery = orderQuery.populate("assignedBus", "travelCompanyId routePath pricing");
    }
    if (Order.schema.path("bus")) {
      orderQuery = orderQuery.populate("bus", "travelCompanyId routePath pricing");
    }

    const order = await orderQuery.lean<UnknownRecord | null>();
    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found." }, { status: 404 });
    }

    const orderUserId = toStringValue(order.user);
    if (actorRole === "user") {
      if (orderUserId !== toStringValue(actor._id)) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
      }
    } else {
      const busIds = [extractRefId(order.assignedBus), extractRefId(order.bus)].filter(
        (busId) => Boolean(busId && mongoose.Types.ObjectId.isValid(busId)),
      );
      if (busIds.length === 0) {
        return NextResponse.json(
          { success: false, message: "This order does not have a valid bus assignment." },
          { status: 400 },
        );
      }

      const adminBusIds = Array.isArray(actor.buses) ? actor.buses.map((id) => toStringValue(id)) : [];
      const adminCompanyId = toStringValue(actor.travelCompanyId);
      const canManageOrder = [order.assignedBus, order.bus].some((busValue) => {
        if (!busValue || typeof busValue !== "object") return false;
        const busRecord = busValue as UnknownRecord;
        const busId = toStringValue(busRecord._id);
        const busCompanyId = toStringValue(busRecord.travelCompanyId);
        return (
          (adminCompanyId && busCompanyId && adminCompanyId === busCompanyId) ||
          (busId && adminBusIds.includes(busId))
        );
      });

      if (!canManageOrder) {
        return NextResponse.json(
          { success: false, message: "You can cancel only your company orders." },
          { status: 403 },
        );
      }
    }

    const currentStatus = toStringValue(order.status, "pending").toLowerCase();
    if (currentStatus === "cancelled") {
      return NextResponse.json(
        { success: false, message: "This order is already cancelled." },
        { status: 409 },
      );
    }
    if (currentStatus === "delivered" || currentStatus === "missed_package") {
      return NextResponse.json(
        { success: false, message: "Delivered or missed package orders cannot be cancelled." },
        { status: 409 },
      );
    }

    const orderStartDateTime = resolveOrderStartDateTime(order.orderDate, order.assignedBus, order.bus);
    if (actorRole === "user") {
      if (!CANCELLABLE_USER_STATUSES.has(currentStatus)) {
        return NextResponse.json(
          { success: false, message: "This order can no longer be cancelled by the customer." },
          { status: 409 },
        );
      }
      if (!orderStartDateTime || new Date() >= orderStartDateTime) {
        return NextResponse.json(
          { success: false, message: "Customer cancellation closes once the trip start time is reached." },
          { status: 409 },
        );
      }
    }

    const refundMode: RefundMode =
      actorRole === "admin" && body.refundMode === "full_refund" ? "full_refund" : "deduction_policy";
    const refundPreview = calculateCancellationRefund({
      baseAmount: getCollectedAmount(order),
      orderStartDateTime,
      refundPolicy: normalizeRefundPolicySnapshot(order.refundPolicySnapshot),
      mode: refundMode,
    });
    const deductionPercentOverride =
      actorRole === "admin" && refundMode === "deduction_policy"
        ? clampPercent(toNumberValue(body.deductionPercentOverride, refundPreview.deductionPercent))
        : refundPreview.deductionPercent;
    const finalRefundPreview =
      actorRole === "user"
        ? applyDeductionPercentToRefundPreview(
            refundPreview,
            CUSTOMER_CANCELLATION_DEDUCTION_PERCENT,
            `Customer cancellation deduction: ${CUSTOMER_CANCELLATION_DEDUCTION_PERCENT}%`,
          )
        : actorRole === "admin" && refundMode === "deduction_policy"
          ? applyDeductionPercentToRefundPreview(
              refundPreview,
              deductionPercentOverride,
              deductionPercentOverride === refundPreview.deductionPercent
                ? refundPreview.policyLabel
                : `Admin adjusted deduction: ${deductionPercentOverride}%`,
            )
          : refundPreview;

    const effectiveBusId = extractRefId(order.assignedBus) || extractRefId(order.bus);
    const shouldReleaseCapacity =
      ["pending", "confirmed", "allocated"].includes(currentStatus) &&
      mongoose.Types.ObjectId.isValid(effectiveBusId);
    const orderDateOnly = normalizeDateOnly(order.orderDate);
    const initialProcessingStatus =
      finalRefundPreview.refundAmount <= 0
        ? "not_required"
        : canAutoRefundPayment(order.paymentId)
          ? "processing"
          : "manual_review";
    const cancellationTimestamp = new Date();
    const reportType = actorRole === "admin" ? "admin_cancellation" : "user_cancellation";
    const reportTitle =
      actorRole === "admin" ? "Admin cancellation report" : "Customer cancellation request";
    const reportDescription = reasonDescription || reasonCode.replaceAll("_", " ");

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (shouldReleaseCapacity && effectiveBusId && orderDateOnly) {
          const { dayStart, dayEnd } = getUtcDayRange(orderDateOnly);
          const released = await releaseBusCapacityForDay(
            session,
            new mongoose.Types.ObjectId(effectiveBusId),
            dayStart,
            dayEnd,
            Math.max(0, roundCurrency(toNumberValue(order.totalWeightKg))),
          );
          if (!released) {
            throw new Error("Failed to release bus capacity for the cancelled order.");
          }
        }

        const txOrder = await Order.findById(orderId).session(session);
        if (!txOrder) {
          throw new Error("Order not found during cancellation.");
        }

        txOrder.status = "cancelled";
        txOrder.adjustmentPendingAmount = 0;
        txOrder.adjustmentRefundAmount = 0;
        txOrder.adjustmentStatus = "settled";
        txOrder.cancellationDetails = {
          reasonCode,
          reasonDescription,
          refundMode,
          refundBaseAmount: finalRefundPreview.baseAmount,
          deductionPercent: finalRefundPreview.deductionPercent,
          deductionAmount: finalRefundPreview.deductionAmount,
          refundAmount: finalRefundPreview.refundAmount,
          policyLabel: finalRefundPreview.policyLabel,
          hoursUntilStart: finalRefundPreview.hoursUntilStart,
          processingStatus: initialProcessingStatus,
          paymentRefundId: "",
          paymentRefundStatus:
            initialProcessingStatus === "not_required"
              ? "not_required"
              : initialProcessingStatus === "manual_review"
                ? "manual_review"
                : "processing",
          paymentRefundError: "",
          processedAt: initialProcessingStatus === "not_required" ? cancellationTimestamp : null,
          cancelledAt: cancellationTimestamp,
          cancelledBy: actor._id,
          cancelledByRole: actorRole,
        };
        txOrder.orderReports = Array.isArray(txOrder.orderReports) ? txOrder.orderReports : [];
        txOrder.orderReports.push({
          reportType,
          category: reasonCode,
          title: reportTitle,
          description: reportDescription,
          createdBy: actor._id,
          createdByRole: actorRole,
          createdAt: cancellationTimestamp,
          data: {
            refundMode,
            refundAmount: finalRefundPreview.refundAmount,
            deductionAmount: finalRefundPreview.deductionAmount,
            deductionPercent: finalRefundPreview.deductionPercent,
            policyLabel: finalRefundPreview.policyLabel,
            hoursUntilStart: finalRefundPreview.hoursUntilStart,
          },
        });
        await txOrder.save({ session });
      });
    } finally {
      await session.endSession();
    }

    let finalCancellationDetails = {
      reasonCode,
      reasonDescription,
      refundMode,
      refundBaseAmount: finalRefundPreview.baseAmount,
      deductionPercent: finalRefundPreview.deductionPercent,
      deductionAmount: finalRefundPreview.deductionAmount,
      refundAmount: finalRefundPreview.refundAmount,
      policyLabel: finalRefundPreview.policyLabel,
      hoursUntilStart: finalRefundPreview.hoursUntilStart,
      processingStatus: initialProcessingStatus,
      paymentRefundId: "",
      paymentRefundStatus:
        initialProcessingStatus === "not_required"
          ? "not_required"
          : initialProcessingStatus === "manual_review"
            ? "manual_review"
            : "processing",
      paymentRefundError: "",
      processedAt: initialProcessingStatus === "not_required" ? cancellationTimestamp : null,
      cancelledAt: cancellationTimestamp,
      cancelledBy: actor._id,
      cancelledByRole: actorRole,
    };

    if (initialProcessingStatus === "processing") {
      const refundResult = await processGatewayRefund({
        paymentId: order.paymentId,
        refundAmount: finalRefundPreview.refundAmount,
        trackingId: toStringValue(order.trackingId, "TRACKING-PENDING"),
        requestedByRole: actorRole,
      });

      finalCancellationDetails = {
        ...finalCancellationDetails,
        processingStatus: refundResult.processingStatus,
        paymentRefundId: refundResult.paymentRefundId,
        paymentRefundStatus: refundResult.paymentRefundStatus,
        paymentRefundError: refundResult.paymentRefundError,
        processedAt: refundResult.processedAt,
      };

      await Order.findByIdAndUpdate(orderId, {
        $set: {
          "cancellationDetails.processingStatus": refundResult.processingStatus,
          "cancellationDetails.paymentRefundId": refundResult.paymentRefundId,
          "cancellationDetails.paymentRefundStatus": refundResult.paymentRefundStatus,
          "cancellationDetails.paymentRefundError": refundResult.paymentRefundError,
          "cancellationDetails.processedAt": refundResult.processedAt,
        },
      });
    }

    const orderOwner = await User.findById(orderUserId).select("email").lean<{ email?: string } | null>();
    const ownerEmail = toStringValue(orderOwner?.email);
    if (ownerEmail) {
      try {
        const refundMessage =
          finalCancellationDetails.refundAmount > 0
            ? `Refund Rs ${finalCancellationDetails.refundAmount.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })} (${finalCancellationDetails.paymentRefundStatus || finalCancellationDetails.processingStatus}).`
            : "No refund was applicable.";
        await sendEmail({
          email: ownerEmail,
          emailType: "ORDER_CANCELLED",
          trackingId: toStringValue(order.trackingId, "TRACKING-PENDING"),
          orderStatus: "cancelled",
          orderNote: [reportDescription, refundMessage].filter(Boolean).join(" "),
        });
      } catch {
        // Email is best-effort only.
      }
    }

    return NextResponse.json(
      {
        success: true,
        message:
          finalCancellationDetails.processingStatus === "processed"
            ? "Order cancelled and refund processed."
            : finalCancellationDetails.processingStatus === "manual_review"
              ? "Order cancelled. Refund marked for manual review."
              : finalCancellationDetails.processingStatus === "failed"
                ? "Order cancelled, but automatic refund failed."
                : "Order cancelled successfully.",
        order: {
          id: orderId,
          status: "cancelled",
          cancellationDetails: finalCancellationDetails,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to cancel order.",
      },
      { status: 500 },
    );
  }
}
