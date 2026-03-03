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
const FINAL_STATUSES = ["delivered", "cancelled"] as const;
const ALL_ORDER_STATUSES = [...ACTIVE_STATUSES, ...FINAL_STATUSES] as const;

type OrderStatus = (typeof ALL_ORDER_STATUSES)[number];

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

const toIsoDateTime = (value: unknown): string => {
  const parsed = new Date(toStringValue(value));
  if (Number.isNaN(parsed.getTime())) return new Date(0).toISOString();
  return parsed.toISOString();
};

const BUSINESS_TIMEZONE = "Asia/Kolkata";

const toDateKeyInBusinessTimezone = (value: unknown): string | null => {
  const parsed = new Date(toStringValue(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
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
      return NextResponse.json(
        { success: true, order: null, orders: [], upcomingOrders: [], pastOrders: [], processedCount: 0 },
        { status: 200 },
      );
    }

    const busById = new Map<string, BusLean>();
    const relevantPeriodsByBusId = new Map<string, OperatorPeriod[]>();

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
    }

    const busIds = Array.from(busById.keys());
    const busObjectIds = busIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (busIds.length === 0) {
      return NextResponse.json(
        { success: true, order: null, orders: [], upcomingOrders: [], pastOrders: [], processedCount: 0 },
        { status: 200 },
      );
    }

    const candidateOrders = await Order.find({
      $or: [{ assignedBus: { $in: busObjectIds } }, { bus: { $in: busObjectIds } }],
      status: { $in: ALL_ORDER_STATUSES },
    })
      .sort({ orderDate: 1, createdAt: -1 })
      .select(
        "_id trackingId status orderDate pickupLocation dropLocation assignedBus bus senderInfo receiverInfo pickupProofImage dropProofImage operatorNote adminNote createdAt",
      )
      .lean<OrderLean[]>();

    const mappedOrders = candidateOrders
      .map((order) => {
        const busId = toStringValue(order.assignedBus) || toStringValue(order.bus);
        const bus = busById.get(busId);
        if (!bus) return null;

        const orderDate = normalizeDateOnly(order.orderDate) ?? normalizeDateOnly(new Date().toISOString());
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
            orderDate: toIsoDateTime(order.orderDate),
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
          orderDate: toIsoDateTime(order.orderDate),
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
      .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

    const todayKey = toDateKeyInBusinessTimezone(new Date().toISOString());

    const activeOrders = mappedOrders
      .filter((order) => {
        const status = toStringValue(order.status).toLowerCase() as OrderStatus;
        if (!ACTIVE_STATUSES.includes(status as (typeof ACTIVE_STATUSES)[number])) return false;
        const orderDateKey = toDateKeyInBusinessTimezone(order.orderDate);
        if (!todayKey || !orderDateKey) return false;
        return orderDateKey === todayKey;
      })
      .sort((a, b) => {
        const statusCompare = statusPriority(a.status) - statusPriority(b.status);
        if (statusCompare !== 0) return statusCompare;
        return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
      });

    const upcomingOrders = mappedOrders
      .filter((order) => {
        const status = toStringValue(order.status).toLowerCase() as OrderStatus;
        if (FINAL_STATUSES.includes(status as (typeof FINAL_STATUSES)[number])) return false;
        const orderDateKey = toDateKeyInBusinessTimezone(order.orderDate);
        if (!todayKey || !orderDateKey) return true;
        return orderDateKey !== todayKey;
      })
      .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

    const pastOrders = mappedOrders
      .filter((order) => {
        const status = toStringValue(order.status).toLowerCase() as OrderStatus;
        return FINAL_STATUSES.includes(status as (typeof FINAL_STATUSES)[number]);
      })
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

    const processedCount = pastOrders.length;

    return NextResponse.json(
      {
        success: true,
        orders: activeOrders,
        upcomingOrders,
        pastOrders,
        processedCount,
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
