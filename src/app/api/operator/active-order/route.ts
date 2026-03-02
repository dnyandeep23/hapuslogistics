import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import { runOrderCleanupSafely } from "@/app/api/lib/orderCleanup";
import User from "@/app/api/models/userModel";
import Bus from "@/app/api/models/busModel";
import Order from "@/app/api/models/orderModel";

const JWT_SECRET = process.env.JWT_SECRET!;
const ACTIVE_STATUSES = ["pending", "confirmed", "allocated", "in-transit"] as const;

type OrderStatus = (typeof ACTIVE_STATUSES)[number] | "delivered" | "cancelled";

type UnknownRecord = Record<string, unknown>;

type OperatorPeriod = {
  operatorId: unknown;
  operatorName?: string;
  operatorPhone?: string;
  startDate?: string | Date;
  endDate?: string | Date;
};

type BusLean = {
  _id: unknown;
  busName?: string;
  busNumber?: string;
  busImages?: string[];
  operatorContactPeriods?: OperatorPeriod[];
};

type OrderLean = {
  _id: unknown;
  trackingId?: string;
  status?: string;
  orderDate?: string | Date;
  pickupLocation?: UnknownRecord;
  dropLocation?: UnknownRecord;
  assignedBus?: unknown;
  bus?: unknown;
  senderInfo?: UnknownRecord;
  receiverInfo?: UnknownRecord;
  pickupProofImage?: string;
  dropProofImage?: string;
  operatorNote?: string;
  adminNote?: string;
  createdAt?: string | Date;
};

const getContactInfo = (value: unknown) => {
  const source = value && typeof value === "object" ? (value as UnknownRecord) : {};
  return {
    name:
      toStringValue(source.name) ||
      toStringValue(source.senderName) ||
      toStringValue(source.receiverName),
    phone:
      toStringValue(source.phone) ||
      toStringValue(source.contact) ||
      toStringValue(source.senderContact) ||
      toStringValue(source.receiverContact),
  };
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
      const stringified = maybeToString.call(value);
      if (stringified && stringified !== "[object Object]") return stringified;
    }
  }
  return fallback;
};

const normalizeDateOnly = (value: unknown): Date | null => {
  const parsed = new Date(toStringValue(value));
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
};

const getTokenUserId = (request: NextRequest): string | null => {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id?: string };
    return payload.id ?? null;
  } catch {
    return null;
  }
};

const statusPriority = (status: OrderStatus): number => {
  if (status === "in-transit") return 0;
  if (status === "allocated") return 1;
  if (status === "confirmed") return 2;
  if (status === "pending") return 3;
  return 9;
};

const isBusAssignedToOperator = (operatorId: string, periods: unknown): boolean => {
  if (!Array.isArray(periods)) return false;
  return periods.some((period) => {
    if (!period || typeof period !== "object") return false;
    return toStringValue((period as UnknownRecord).operatorId) === operatorId;
  });
};

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    try {
      await runOrderCleanupSafely();
    } catch (cleanupError: unknown) {
      console.error("[order-cleanup] Pre-read cleanup failed:", cleanupError);
    }

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const operator = await User.findById(userId).select("role");
    if (!operator || operator.role !== "operator") {
      return NextResponse.json(
        { success: false, message: "Operator access required." },
        { status: 403 },
      );
    }

    const buses = await Bus.find({
      "operatorContactPeriods.operatorId": operator._id,
    })
      .select("busName busNumber busImages operatorContactPeriods")
      .lean<BusLean[]>();

    if (!Array.isArray(buses) || buses.length === 0) {
      return NextResponse.json({ success: true, order: null }, { status: 200 });
    }

    const busById = new Map<string, BusLean>();
    const relevantPeriodsByBusId = new Map<string, OperatorPeriod[]>();

    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const bus of buses) {
      const busId = toStringValue(bus._id);
      if (!busId) continue;
      busById.set(busId, bus);

      const periods = Array.isArray(bus.operatorContactPeriods)
        ? bus.operatorContactPeriods.filter(
            (period) => toStringValue(period.operatorId) === toStringValue(operator._id),
          )
        : [];

      relevantPeriodsByBusId.set(busId, periods);

      for (const period of periods) {
        const startDate = normalizeDateOnly(period.startDate);
        const endDate = normalizeDateOnly(period.endDate);
        if (!startDate || !endDate) continue;
        if (!minDate || startDate < minDate) minDate = startDate;
        if (!maxDate || endDate > maxDate) maxDate = endDate;
      }
    }

    const busIds = Array.from(busById.keys());
    const busObjectIds = busIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (busIds.length === 0 || !minDate || !maxDate) {
      return NextResponse.json({ success: true, order: null }, { status: 200 });
    }

    const orders = await Order.find({
      $or: [{ assignedBus: { $in: busObjectIds } }, { bus: { $in: busObjectIds } }],
      status: { $in: ACTIVE_STATUSES },
      orderDate: {
        $gte: minDate,
        $lte: maxDate,
      },
    })
      .sort({ orderDate: 1, createdAt: -1 })
      .select(
        "_id trackingId status orderDate pickupLocation dropLocation assignedBus bus senderInfo receiverInfo pickupProofImage dropProofImage operatorNote adminNote createdAt",
      )
      .lean<OrderLean[]>();

    let candidateOrders = orders;
    if (candidateOrders.length === 0) {
      // Legacy fallback where orderDate range or strict query excludes valid assigned-bus orders.
      candidateOrders = await Order.find({
        $or: [{ assignedBus: { $in: busObjectIds } }, { bus: { $in: busObjectIds } }],
        status: { $in: ACTIVE_STATUSES },
      })
        .sort({ orderDate: 1, createdAt: -1 })
        .select(
          "_id trackingId status orderDate pickupLocation dropLocation assignedBus bus senderInfo receiverInfo pickupProofImage dropProofImage operatorNote adminNote createdAt",
        )
        .limit(500)
        .lean<OrderLean[]>();
    }

    const activeOrders = candidateOrders
      .map((order) => {
        const busId = toStringValue(order.assignedBus) || toStringValue(order.bus);
        const bus = busById.get(busId);
        if (!bus) return null;

        const orderDate = normalizeDateOnly(order.orderDate);
        if (!orderDate) return null;

        const periods = relevantPeriodsByBusId.get(busId) ?? [];
        const matchingPeriod = periods.find((period) => {
          const startDate = normalizeDateOnly(period.startDate);
          const endDate = normalizeDateOnly(period.endDate);
          if (!startDate || !endDate) return false;
          return orderDate >= startDate && orderDate <= endDate;
        });

        const hasOperatorAssignment = isBusAssignedToOperator(
          toStringValue(operator._id),
          bus.operatorContactPeriods,
        );
        if (!hasOperatorAssignment) return null;

        if (!matchingPeriod) {
          const firstPeriod = periods[0];
          if (!firstPeriod) return null;
          const fallbackName = toStringValue(firstPeriod.operatorName, "Operator");
          const fallbackPhone = toStringValue(firstPeriod.operatorPhone);
          return {
            id: toStringValue(order._id),
            trackingId: toStringValue(order.trackingId, "TRACKING-PENDING"),
            status: (toStringValue(order.status, "pending").toLowerCase() as OrderStatus),
            orderDate: new Date(order.orderDate ?? new Date()).toISOString(),
            sender: getContactInfo(order.senderInfo),
            receiver: getContactInfo(order.receiverInfo),
            pickupLocation: {
              name: toStringValue(order.pickupLocation?.name),
              city: toStringValue(order.pickupLocation?.city),
              state: toStringValue(order.pickupLocation?.state),
            },
            dropLocation: {
              name: toStringValue(order.dropLocation?.name),
              city: toStringValue(order.dropLocation?.city),
              state: toStringValue(order.dropLocation?.state),
            },
            pickupProofImage: toStringValue(order.pickupProofImage),
            dropProofImage: toStringValue(order.dropProofImage),
            operatorNote: toStringValue(order.operatorNote) || toStringValue(order.adminNote),
            bus: {
              id: busId,
              busName: toStringValue(bus.busName, "Assigned Bus"),
              busNumber: toStringValue(bus.busNumber),
              busImage: Array.isArray(bus.busImages) ? toStringValue(bus.busImages[0]) : "",
              operatorName: fallbackName,
              operatorPhone: fallbackPhone,
            },
          };
        }

        const status = (toStringValue(order.status, "pending").toLowerCase() as OrderStatus);

        return {
          id: toStringValue(order._id),
          trackingId: toStringValue(order.trackingId, "TRACKING-PENDING"),
          status,
          orderDate: new Date(order.orderDate ?? new Date()).toISOString(),
          sender: getContactInfo(order.senderInfo),
          receiver: getContactInfo(order.receiverInfo),
          pickupLocation: {
            name: toStringValue(order.pickupLocation?.name),
            city: toStringValue(order.pickupLocation?.city),
            state: toStringValue(order.pickupLocation?.state),
          },
          dropLocation: {
            name: toStringValue(order.dropLocation?.name),
            city: toStringValue(order.dropLocation?.city),
            state: toStringValue(order.dropLocation?.state),
          },
          pickupProofImage: toStringValue(order.pickupProofImage),
          dropProofImage: toStringValue(order.dropProofImage),
          operatorNote: toStringValue(order.operatorNote) || toStringValue(order.adminNote),
          bus: {
            id: busId,
            busName: toStringValue(bus.busName, "Assigned Bus"),
            busNumber: toStringValue(bus.busNumber),
            busImage: Array.isArray(bus.busImages) ? toStringValue(bus.busImages[0]) : "",
            operatorName: toStringValue(matchingPeriod.operatorName, "Operator"),
            operatorPhone: toStringValue(matchingPeriod.operatorPhone),
          },
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => {
        const statusCompare = statusPriority(a.status) - statusPriority(b.status);
        if (statusCompare !== 0) return statusCompare;
        return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
      });

    return NextResponse.json(
      {
        success: true,
        order: activeOrders[0] ?? null,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load active operator order.",
      },
      { status: 500 },
    );
  }
}
