import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import { processGatewayRefund } from "@/app/api/lib/orderCancellation";
import { sendEmail } from "@/app/api/lib/mailer";
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
    const nestedId = toStringValue((value as { _id?: unknown })._id);
    if (nestedId) return nestedId;
  }
  return toStringValue(value);
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

export async function POST(request: NextRequest, context: ParamsContext) {
  try {
    await dbConnect();

    const actorId = getTokenUserId(request);
    if (!actorId || !mongoose.Types.ObjectId.isValid(actorId)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const actor = await User.findById(actorId).select("_id role travelCompanyId buses").lean<ActorDoc | null>();
    if (!actor) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const actorRole = toStringValue(actor.role) as "admin" | "operator" | "user";
    if (actorRole !== "admin" && actorRole !== "operator") {
      return NextResponse.json(
        { success: false, message: "Only admin or operator can process missed package refunds." },
        { status: 403 },
      );
    }

    const { orderId } = await context.params;
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json({ success: false, message: "Invalid order id." }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      waiverPercent?: unknown;
    };

    let orderQuery = Order.findById(orderId).select(
      "_id user trackingId status paymentId assignedBus bus missedPackageDetails orderReports",
    );
    if (Order.schema.path("assignedBus")) {
      orderQuery = orderQuery.populate("assignedBus", "travelCompanyId operatorContactPeriods");
    }
    if (Order.schema.path("bus")) {
      orderQuery = orderQuery.populate("bus", "travelCompanyId operatorContactPeriods");
    }

    const order = await orderQuery.lean<UnknownRecord | null>();
    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found." }, { status: 404 });
    }

    const currentStatus = toStringValue(order.status).toLowerCase();
    if (currentStatus !== "missed_package") {
      return NextResponse.json(
        { success: false, message: "Refund is available only for missed package orders." },
        { status: 409 },
      );
    }

    const effectiveBus = (order.assignedBus as UnknownRecord | null) || (order.bus as UnknownRecord | null);
    if (actorRole === "admin") {
      const adminCompanyId = toStringValue(actor.travelCompanyId);
      const adminBusIds = Array.isArray(actor.buses) ? actor.buses.map((id) => toStringValue(id)) : [];
      const busId = extractRefId(order.assignedBus) || extractRefId(order.bus);
      const busCompanyId = effectiveBus ? toStringValue(effectiveBus.travelCompanyId) : "";
      const canManage =
        (adminCompanyId && busCompanyId && adminCompanyId === busCompanyId) ||
        (busId && adminBusIds.includes(busId));
      if (!canManage) {
        return NextResponse.json(
          { success: false, message: "You can process refunds only for your company orders." },
          { status: 403 },
        );
      }
    } else {
      const effectiveBusId = extractRefId(order.assignedBus) || extractRefId(order.bus);
      if (!effectiveBusId || !mongoose.Types.ObjectId.isValid(effectiveBusId)) {
        return NextResponse.json({ success: false, message: "Bus not found." }, { status: 404 });
      }
      const bus = await Bus.findById(effectiveBusId).select("operatorContactPeriods").lean<UnknownRecord | null>();
      if (!bus) {
        return NextResponse.json({ success: false, message: "Bus not found." }, { status: 404 });
      }
      const canOperate = Array.isArray(bus.operatorContactPeriods)
        ? bus.operatorContactPeriods.some((period) => {
            if (!period || typeof period !== "object") return false;
            return toStringValue((period as UnknownRecord).operatorId) === toStringValue(actor._id);
          })
        : false;
      if (!canOperate) {
        return NextResponse.json(
          { success: false, message: "You can refund only orders from your assigned bus." },
          { status: 403 },
        );
      }
    }

    const missedDetails =
      order.missedPackageDetails && typeof order.missedPackageDetails === "object"
        ? (order.missedPackageDetails as UnknownRecord)
        : null;
    if (!missedDetails) {
      return NextResponse.json(
        { success: false, message: "Missed package details are not available for this order." },
        { status: 409 },
      );
    }

    const currentRefundStatus = toStringValue(missedDetails.refundProcessingStatus, "not_started");
    if (currentRefundStatus === "processed") {
      return NextResponse.json(
        { success: false, message: "Refund was already processed for this missed package." },
        { status: 409 },
      );
    }
    if (currentRefundStatus === "processing") {
      return NextResponse.json(
        { success: false, message: "Refund is already processing with Razorpay." },
        { status: 409 },
      );
    }

    const refundBaseAmount = Math.max(0, roundCurrency(toNumberValue(missedDetails.refundBaseAmount)));
    const requestedWaiverPercent =
      actorRole === "admin"
        ? clampPercent(toNumberValue(body.waiverPercent, toNumberValue(missedDetails.waiverPercent, 0)))
        : 0;
    const waiverAmount = roundCurrency((refundBaseAmount * requestedWaiverPercent) / 100);
    const refundAmount = Math.max(0, roundCurrency(refundBaseAmount - waiverAmount));
    if (refundAmount <= 0) {
      await Order.findByIdAndUpdate(orderId, {
        $set: {
          "missedPackageDetails.waiverPercent": requestedWaiverPercent,
          "missedPackageDetails.waiverAmount": waiverAmount,
          "missedPackageDetails.refundAmount": 0,
          "missedPackageDetails.refundProcessingStatus": "not_required",
          "missedPackageDetails.paymentRefundStatus": "not_required",
          "missedPackageDetails.paymentRefundError": "",
          "missedPackageDetails.refundTriggeredAt": new Date(),
          "missedPackageDetails.refundTriggeredBy": actor._id,
          "missedPackageDetails.refundTriggeredByRole": actorRole,
          "missedPackageDetails.refundedAt": new Date(),
        },
        $push: {
          orderReports: {
            reportType: "missed_package_refund",
            category: "missed_package_refund",
            title: "Missed package refund closed",
            description: "No refund amount remained for this missed package order.",
            createdBy: actor._id,
            createdByRole: actorRole,
            createdAt: new Date(),
            data: {
              refundBaseAmount,
              waiverPercent: requestedWaiverPercent,
              waiverAmount,
              refundAmount: 0,
              processingStatus: "not_required",
            },
          },
        },
      });
      return NextResponse.json(
        {
          success: true,
          message: "Missed package refund closed with no payout required.",
          refund: {
            refundBaseAmount,
            waiverPercent: requestedWaiverPercent,
            waiverAmount,
            refundAmount: 0,
            processingStatus: "not_required",
          },
        },
        { status: 200 },
      );
    }

    await Order.findByIdAndUpdate(orderId, {
      $set: {
        "missedPackageDetails.waiverPercent": requestedWaiverPercent,
        "missedPackageDetails.waiverAmount": waiverAmount,
        "missedPackageDetails.refundAmount": refundAmount,
        "missedPackageDetails.refundProcessingStatus": "processing",
        "missedPackageDetails.paymentRefundStatus": "processing",
        "missedPackageDetails.paymentRefundError": "",
        "missedPackageDetails.refundTriggeredAt": new Date(),
        "missedPackageDetails.refundTriggeredBy": actor._id,
        "missedPackageDetails.refundTriggeredByRole": actorRole,
      },
    });

    const refundResult = await processGatewayRefund({
      paymentId: order.paymentId,
      refundAmount,
      trackingId: toStringValue(order.trackingId, "TRACKING-PENDING"),
      requestedByRole: actorRole,
    });

    const finalStatus = refundResult.processingStatus;
    await Order.findByIdAndUpdate(orderId, {
      $set: {
        "missedPackageDetails.refundProcessingStatus": finalStatus,
        "missedPackageDetails.paymentRefundId": refundResult.paymentRefundId,
        "missedPackageDetails.paymentRefundStatus": refundResult.paymentRefundStatus,
        "missedPackageDetails.paymentRefundError": refundResult.paymentRefundError,
        "missedPackageDetails.refundedAt": refundResult.processedAt,
      },
      $push: {
        orderReports: {
          reportType: "missed_package_refund",
          category: "missed_package_refund",
          title: "Missed package refund triggered",
          description:
            actorRole === "operator"
              ? "Operator triggered the missed package auto refund flow."
              : "Admin triggered the missed package refund flow.",
          createdBy: actor._id,
          createdByRole: actorRole,
          createdAt: new Date(),
          data: {
            refundBaseAmount,
            waiverPercent: requestedWaiverPercent,
            waiverAmount,
            refundAmount,
            processingStatus: finalStatus,
            paymentRefundStatus: refundResult.paymentRefundStatus,
          },
        },
      },
    });

    const orderUser = await User.findById(order.user).select("email").lean<{ email?: string } | null>();
    const orderUserEmail = toStringValue(orderUser?.email);
    if (orderUserEmail) {
      try {
        const note =
          finalStatus === "processed"
            ? `Missed package refund of Rs ${refundAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })} was processed.`
            : finalStatus === "processing"
              ? `Missed package refund of Rs ${refundAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })} is processing with Razorpay.`
            : finalStatus === "manual_review"
              ? `Missed package refund of Rs ${refundAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })} was marked for manual review.`
              : finalStatus === "failed"
                ? `Missed package refund attempt failed. ${refundResult.paymentRefundError}`
                : `Missed package refund is ${refundResult.paymentRefundStatus || finalStatus}.`;
        await sendEmail({
          email: orderUserEmail,
          emailType: "ORDER_UPDATED",
          trackingId: toStringValue(order.trackingId, "TRACKING-PENDING"),
          orderStatus: "missed_package",
          orderNote: note,
        });
      } catch {
        // Best-effort only.
      }
    }

    return NextResponse.json(
      {
        success: true,
        message:
          finalStatus === "processed"
            ? "Missed package refund processed."
            : finalStatus === "processing"
              ? "Missed package refund is processing with Razorpay."
            : finalStatus === "manual_review"
              ? "Missed package refund marked for manual review."
              : finalStatus === "failed"
                ? "Missed package refund failed."
                : "Missed package refund started.",
        refund: {
          refundBaseAmount,
          waiverPercent: requestedWaiverPercent,
          waiverAmount,
          refundAmount,
          processingStatus: finalStatus,
          paymentRefundStatus: refundResult.paymentRefundStatus,
          paymentRefundId: refundResult.paymentRefundId,
          paymentRefundError: refundResult.paymentRefundError,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to process missed package refund.",
      },
      { status: 500 },
    );
  }
}
