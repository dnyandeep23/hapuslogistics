import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import { runOrderCleanupSafely } from "@/app/api/lib/orderCleanup";
import { sendEmail } from "@/app/api/lib/mailer";
import User from "@/app/api/models/userModel";
import Bus from "@/app/api/models/busModel";
import Order from "@/app/api/models/orderModel";

const JWT_SECRET = process.env.JWT_SECRET!;
const OPERATOR_ACTIONS = ["mark_in_transit", "mark_delivered"] as const;
type OperatorAction = (typeof OPERATOR_ACTIONS)[number];

type UnknownRecord = Record<string, unknown>;

type UserDoc = {
  _id?: unknown;
  role?: string;
  isSuperAdmin?: boolean;
  travelCompanyId?: unknown;
  buses?: unknown[];
  phone?: unknown;
};

type OperatorPeriod = {
  operatorId?: unknown;
  operatorName?: string;
  operatorPhone?: string;
  startDate?: string | Date;
  endDate?: string | Date;
};

type BusDoc = {
  _id?: unknown;
  travelCompanyId?: unknown;
  busName?: string;
  busNumber?: string;
  busImages?: string[];
  operatorContactPeriods?: OperatorPeriod[];
};

type OrderDoc = {
  _id?: unknown;
  user?: unknown;
  assignedBus?: unknown;
  bus?: unknown;
  trackingId?: string;
  status?: string;
  orderDate?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  totalAmount?: number;
  totalWeightKg?: number;
  pickupLocation?: UnknownRecord;
  dropLocation?: UnknownRecord;
  senderInfo?: UnknownRecord;
  receiverInfo?: UnknownRecord;
  pickupProofImage?: string;
  dropProofImage?: string;
  adminNote?: string;
  operatorNote?: string;
  customerNote?: string;
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

const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toIsoDate = (value: unknown): string => {
  const date = new Date(toStringValue(value));
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
};

const normalizeDateOnly = (value: unknown): Date | null => {
  const date = new Date(toStringValue(value));
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const parseDate = (value: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const mapLocation = (value: unknown) => {
  const source = (value && typeof value === "object" ? value : {}) as UnknownRecord;
  return {
    name: toStringValue(source.name),
    city: toStringValue(source.city),
    state: toStringValue(source.state),
    address: toStringValue(source.address),
    zip: toStringValue(source.zip),
  };
};

const getTokenUserId = (request: NextRequest): string | null => {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id?: string };
    // console.log(payload.id);
    return payload.id ?? null;
  } catch {
    return null;
  }
};

const getBusImage = (bus: unknown): string => {
  if (!bus || typeof bus !== "object") return "";
  const busImages = (bus as { busImages?: unknown }).busImages;
  return Array.isArray(busImages) ? toStringValue(busImages[0]) : "";
};

const isOrderInOperatorPeriods = (
  orderDateValue: unknown,
  operatorId: string,
  periods: unknown,
): boolean => {
  const orderDate = normalizeDateOnly(orderDateValue);
  if (!orderDate || !Array.isArray(periods)) return false;

  return periods.some((period) => {
    if (!period || typeof period !== "object") return false;
    const record = period as UnknownRecord;
    if (toStringValue(record.operatorId) !== operatorId) return false;
    const startDate = normalizeDateOnly(record.startDate);
    const endDate = normalizeDateOnly(record.endDate);
    if (!startDate || !endDate) return false;
    return orderDate >= startDate && orderDate <= endDate;
  });
};

const isBusAssignedToOperator = (operatorId: string, periods: unknown): boolean => {
  if (!Array.isArray(periods)) return false;
  return periods.some((period) => {
    if (!period || typeof period !== "object") return false;
    return toStringValue((period as UnknownRecord).operatorId) === operatorId;
  });
};

const getOperatorAllowedActions = (statusValue: unknown): OperatorAction[] => {
  const status = toStringValue(statusValue, "pending").toLowerCase();
  if (status === "pending" || status === "confirmed" || status === "allocated") {
    return ["mark_in_transit"];
  }
  if (status === "in-transit") {
    return ["mark_delivered"];
  }
  return [];
};

const buildOrderItem = (order: OrderDoc, role: "admin" | "superadmin" | "operator") => {
  const assignedBus = order.assignedBus as UnknownRecord | undefined;
  const bookingBus = order.bus as UnknownRecord | undefined;
  const busRef = assignedBus && Object.keys(assignedBus).length > 0 ? assignedBus : bookingBus;
  const userRef = order.user as UnknownRecord | undefined;
  const allowedActions = role === "operator" ? getOperatorAllowedActions(order.status) : [];
  const operatorNote = toStringValue(order.operatorNote) || toStringValue(order.adminNote);
  const customerNote = toStringValue(order.customerNote);

  return {
    id: toStringValue(order._id),
    trackingId: toStringValue(order.trackingId, "TRACKING-PENDING"),
    status: toStringValue(order.status, "pending"),
    orderDate: toIsoDate(order.orderDate),
    createdAt: toIsoDate(order.createdAt),
    updatedAt: toIsoDate(order.updatedAt),
    totalAmount: toNumberValue(order.totalAmount),
    totalWeightKg: toNumberValue(order.totalWeightKg),
    pickupLocation: mapLocation(order.pickupLocation),
    dropLocation: mapLocation(order.dropLocation),
    pickupProofImage: toStringValue(order.pickupProofImage),
    dropProofImage: toStringValue(order.dropProofImage),
    operatorNote,
    customerNote: role === "operator" ? "" : customerNote,
    user: {
      id: toStringValue(userRef?._id),
      name: toStringValue(userRef?.name),
      email: toStringValue(userRef?.email),
      phone: toStringValue(userRef?.phone),
    },
    bus: {
      id: toStringValue(busRef?._id),
      busName: toStringValue(busRef?.busName),
      busNumber: toStringValue(busRef?.busNumber),
      busImage: getBusImage(busRef),
    },
    allowedActions,
  };
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

    const user = await User.findById(userId)
      .select("role isSuperAdmin travelCompanyId buses phone")
      .lean<UserDoc | null>();

    // console.log(user)
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const role = user.isSuperAdmin ? "superadmin" : toStringValue(user.role) as "admin" | "operator" | "user";
    if (role !== "admin" && role !== "superadmin" && role !== "operator") {
      return NextResponse.json(
        { success: false, message: "Only admin or operator can access this API." },
        { status: 403 },
      );
    }
    if (!toStringValue((user as { phone?: unknown }).phone).trim()) {
      return NextResponse.json(
        { success: false, message: "Add your contact number before continuing." },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const q = toStringValue(searchParams.get("q")).trim().toLowerCase();
    const busIdParam = toStringValue(searchParams.get("busId")).trim();
    const fromDate = parseDate(searchParams.get("fromDate"));
    const toDate = parseDate(searchParams.get("toDate"));

    const selectedStatuses = statusFilter
      ? statusFilter
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
      : [];

    if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
      return NextResponse.json(
        { success: false, message: "Invalid fromDate or toDate." },
        { status: 400 },
      );
    }

    if (fromDate && toDate && toDate < fromDate) {
      return NextResponse.json(
        { success: false, message: "toDate cannot be before fromDate." },
        { status: 400 },
      );
    }

    let buses: BusDoc[] = [];

    if (role === "superadmin") {
      const busQuery: Record<string, unknown> = {};
      if (busIdParam) {
        if (!mongoose.Types.ObjectId.isValid(busIdParam)) {
          return NextResponse.json({ success: false, message: "Invalid busId." }, { status: 400 });
        }
        busQuery._id = new mongoose.Types.ObjectId(busIdParam);
      }
      buses = await Bus.find(busQuery)
        .select("travelCompanyId busName busNumber busImages operatorContactPeriods")
        .lean<BusDoc[]>();
    } else if (role === "admin") {
      const busQuery: Record<string, unknown> = {};
      if (user.travelCompanyId) {
        busQuery.travelCompanyId = user.travelCompanyId;
      } else if (Array.isArray(user.buses) && user.buses.length > 0) {
        busQuery._id = { $in: user.buses };
      } else {
        return NextResponse.json({
          success: true,
          role,
          buses: [],
          groupedByBus: [],
          orders: [],
          summary: {
            totalBuses: 0,
            totalOrders: 0,
            activeOrders: 0,
            deliveredOrders: 0,
            cancelledOrders: 0,
          },
        });
      }

      if (busIdParam) {
        if (!mongoose.Types.ObjectId.isValid(busIdParam)) {
          return NextResponse.json({ success: false, message: "Invalid busId." }, { status: 400 });
        }
        busQuery._id = new mongoose.Types.ObjectId(busIdParam);
      }

      buses = await Bus.find(busQuery)
        .select("travelCompanyId busName busNumber busImages operatorContactPeriods")
        .lean<BusDoc[]>();
    } else {
      buses = await Bus.find({
        "operatorContactPeriods.operatorId": userId,
      })
        .select("travelCompanyId busName busNumber busImages operatorContactPeriods")
        .lean<BusDoc[]>();

      if (busIdParam) {
        buses = buses.filter((bus) => toStringValue(bus._id) === busIdParam);
      }
    }

    const busIds = buses.map((bus) => toStringValue(bus._id)).filter(Boolean);
    const busObjectIds = busIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (busIds.length === 0) {
      return NextResponse.json({
        success: true,
        role,
        buses: [],
        groupedByBus: [],
        orders: [],
        summary: {
          totalBuses: 0,
          totalOrders: 0,
          activeOrders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
        },
      });
    }

    const orderQuery: Record<string, unknown> = {
      $or: [{ assignedBus: { $in: busObjectIds } }, { bus: { $in: busObjectIds } }],
    };
    if (selectedStatuses.length > 0) {
      orderQuery.status = { $in: selectedStatuses };
    }
    if (fromDate || toDate) {
      orderQuery.orderDate = {};
      if (fromDate) (orderQuery.orderDate as Record<string, unknown>).$gte = fromDate;
      if (toDate) (orderQuery.orderDate as Record<string, unknown>).$lte = toDate;
    }

    let ordersQuery = Order.find(orderQuery).sort({ orderDate: -1, createdAt: -1 });
    if (Order.schema.path("assignedBus")) {
      ordersQuery = ordersQuery.populate(
        "assignedBus",
        "travelCompanyId busName busNumber busImages operatorContactPeriods",
      );
    }
    if (Order.schema.path("bus")) {
      ordersQuery = ordersQuery.populate(
        "bus",
        "travelCompanyId busName busNumber busImages operatorContactPeriods",
      );
    }
    if (Order.schema.path("user")) {
      ordersQuery = ordersQuery.populate({
        path: "user",
        model: "users",
        select: "name email phone",
      });
    }

    let rawOrders = await ordersQuery.lean<OrderDoc[]>();

    if (role === "operator" && rawOrders.length === 0 && busIds.length > 0) {
      // Legacy data fallback: in some older records bus refs may not match strict query casting.
      let fallbackQuery = Order.find({})
        .sort({ orderDate: -1, createdAt: -1 })
        .limit(500);
      if (Order.schema.path("assignedBus")) {
        fallbackQuery = fallbackQuery.populate(
          "assignedBus",
          "travelCompanyId busName busNumber busImages operatorContactPeriods",
        );
      }
      if (Order.schema.path("bus")) {
        fallbackQuery = fallbackQuery.populate(
          "bus",
          "travelCompanyId busName busNumber busImages operatorContactPeriods",
        );
      }
      if (Order.schema.path("user")) {
        fallbackQuery = fallbackQuery.populate({
          path: "user",
          model: "users",
          select: "name email phone",
        });
      }

      const fallbackOrders = await fallbackQuery.lean<OrderDoc[]>();
      rawOrders = fallbackOrders.filter((order) => {
        const assignedBus = order.assignedBus as BusDoc | undefined;
        const bookingBus = order.bus as BusDoc | undefined;
        const busRef = assignedBus && toStringValue(assignedBus._id) ? assignedBus : bookingBus;
        if (!busRef) return false;
        const busRefId = toStringValue(busRef._id);
        if (!busIds.includes(busRefId)) return false;
        return isBusAssignedToOperator(userId, busRef.operatorContactPeriods);
      });
    }

    if (role === "operator") {
      rawOrders = rawOrders.filter((order) => {
        const assignedBus = order.assignedBus as BusDoc | undefined;
        const bookingBus = order.bus as BusDoc | undefined;
        const busRef = assignedBus && toStringValue(assignedBus._id) ? assignedBus : bookingBus;
        if (!busRef) return false;
        const hasOperatorAssignment = isBusAssignedToOperator(userId, busRef.operatorContactPeriods);
        if (!hasOperatorAssignment) return false;

        // Primary check: order date is in assigned period.
        if (isOrderInOperatorPeriods(order.orderDate, userId, busRef.operatorContactPeriods)) {
          return true;
        }

        // Fallback: if period/date data mismatches (timezone or legacy data), still show bus-assigned order.
        return true;
      });
    }

    if (q) {
      rawOrders = rawOrders.filter((order) => {
        const busRef = (order.assignedBus as UnknownRecord | undefined) || (order.bus as UnknownRecord | undefined);
        const userRef = order.user as UnknownRecord | undefined;
        const joined = [
          toStringValue(order.trackingId),
          toStringValue(order.status),
          toStringValue(busRef?._id),
          toStringValue(busRef?.busName),
          toStringValue(busRef?.busNumber),
          toStringValue(userRef?.name),
          toStringValue(userRef?.email),
        ]
          .join(" ")
          .toLowerCase();
        return joined.includes(q);
      });
    }

    const mappedOrders = rawOrders.map((order) =>
      buildOrderItem(order, role === "superadmin" ? "superadmin" : role),
    );

    const groupedMap = new Map<string, { busId: string; busName: string; busNumber: string; busImage: string; orders: typeof mappedOrders }>();
    mappedOrders.forEach((order) => {
      const busId = toStringValue(order.bus.id, "unassigned");
      if (!groupedMap.has(busId)) {
        groupedMap.set(busId, {
          busId,
          busName: order.bus.busName || "Unassigned",
          busNumber: order.bus.busNumber || "",
          busImage: order.bus.busImage || "",
          orders: [],
        });
      }
      groupedMap.get(busId)!.orders.push(order);
    });

    const groupedByBus = Array.from(groupedMap.values()).map((group) => ({
      ...group,
      ordersCount: group.orders.length,
    }));

    const summary = {
      totalBuses: busIds.length,
      totalOrders: mappedOrders.length,
      activeOrders: mappedOrders.filter((order) =>
        ["pending", "confirmed", "allocated", "in-transit"].includes(order.status.toLowerCase()),
      ).length,
      deliveredOrders: mappedOrders.filter((order) => order.status.toLowerCase() === "delivered").length,
      cancelledOrders: mappedOrders.filter((order) => order.status.toLowerCase() === "cancelled").length,
    };

    return NextResponse.json(
      {
        success: true,
        role,
        buses: buses.map((bus) => ({
          id: toStringValue(bus._id),
          busName: toStringValue(bus.busName),
          busNumber: toStringValue(bus.busNumber),
          busImage: Array.isArray(bus.busImages) ? toStringValue(bus.busImages[0]) : "",
        })),
        groupedByBus,
        orders: mappedOrders,
        summary,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load dashboard orders.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(userId)
      .select("role isSuperAdmin travelCompanyId buses phone")
      .lean<UserDoc | null>();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const role = user.isSuperAdmin
      ? "superadmin"
      : (toStringValue(user.role) as "admin" | "operator" | "user");
    if (role !== "operator" && role !== "admin" && role !== "superadmin") {
      return NextResponse.json(
        { success: false, message: "Access denied for this operation." },
        { status: 403 },
      );
    }
    if (!toStringValue((user as { phone?: unknown }).phone).trim()) {
      return NextResponse.json(
        { success: false, message: "Add your contact number before continuing." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      orderId?: string;
      action?: string;
      note?: string;
      operatorNote?: string;
      customerNote?: string;
      senderInfo?: Record<string, unknown>;
      receiverInfo?: Record<string, unknown>;
    };
    const orderId = toStringValue(body?.orderId).trim();
    const action = toStringValue(body?.action).trim().toLowerCase();

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json(
        { success: false, message: "Valid orderId is required." },
        { status: 400 },
      );
    }

    const order = await Order.findById(orderId).select(
      "_id user trackingId assignedBus bus orderDate status pickupProofImage dropProofImage senderInfo receiverInfo adminNote operatorNote customerNote",
    );
    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found." }, { status: 404 });
    }

    const effectiveBusId = toStringValue(order.assignedBus) || toStringValue(order.bus);
    if (!effectiveBusId || !mongoose.Types.ObjectId.isValid(effectiveBusId)) {
      return NextResponse.json(
        { success: false, message: "Order does not have a valid bus assignment." },
        { status: 400 },
      );
    }

    const bus = await Bus.findById(effectiveBusId).select("operatorContactPeriods");
    if (!bus) {
      return NextResponse.json({ success: false, message: "Bus not found." }, { status: 404 });
    }

    if (role === "operator") {
      const operatorAction = action as OperatorAction;
      if (!OPERATOR_ACTIONS.includes(operatorAction)) {
        return NextResponse.json(
          { success: false, message: "Unsupported action. Use mark_in_transit or mark_delivered." },
          { status: 400 },
        );
      }

      const canOperate =
        isOrderInOperatorPeriods(order.orderDate, userId, bus.operatorContactPeriods) ||
        isBusAssignedToOperator(userId, bus.operatorContactPeriods);
      if (!canOperate) {
        return NextResponse.json(
          { success: false, message: "You can operate only orders from your assigned bus period." },
          { status: 403 },
        );
      }

      const currentStatus = toStringValue(order.status, "pending").toLowerCase();
      if (operatorAction === "mark_in_transit") {
        if (!["pending", "confirmed", "allocated"].includes(currentStatus)) {
          return NextResponse.json(
            { success: false, message: "Only pending/confirmed/allocated orders can move to in-transit." },
            { status: 400 },
          );
        }
        order.status = "in-transit";
      }

      if (operatorAction === "mark_delivered") {
        if (currentStatus !== "in-transit") {
          return NextResponse.json(
            { success: false, message: "Only in-transit orders can be marked delivered." },
            { status: 400 },
          );
        }
        if (!order.pickupProofImage || !order.dropProofImage) {
          return NextResponse.json(
            {
              success: false,
              message: "Pickup and drop proof are required before marking delivered.",
            },
            { status: 400 },
          );
        }
        order.status = "delivered";
      }

      await order.save();

      return NextResponse.json(
        {
          success: true,
          message:
            operatorAction === "mark_in_transit"
              ? "Order moved to in-transit."
              : "Order marked as delivered.",
          order: {
            id: order._id.toString(),
            status: order.status,
            allowedActions: getOperatorAllowedActions(order.status),
          },
        },
        { status: 200 },
      );
    }

    const busForAccess = await Bus.findById(effectiveBusId).select("_id travelCompanyId");
    if (!busForAccess) {
      return NextResponse.json({ success: false, message: "Bus not found." }, { status: 404 });
    }

    if (role === "admin" && !user.isSuperAdmin) {
      const adminCompanyId = toStringValue(user.travelCompanyId);
      const adminBusIds = Array.isArray(user.buses) ? user.buses.map((id) => toStringValue(id)) : [];
      const canManageOrder =
        (adminCompanyId && toStringValue(busForAccess.travelCompanyId) === adminCompanyId) ||
        adminBusIds.includes(toStringValue(busForAccess._id));

      if (!canManageOrder) {
        return NextResponse.json(
          { success: false, message: "You can manage only your company orders." },
          { status: 403 },
        );
      }
    }

    const legacyNote = toStringValue(body.note).trim();
    const operatorNoteInput = toStringValue(body.operatorNote).trim();
    const customerNoteInput = toStringValue(body.customerNote).trim();
    const nextOperatorNote = operatorNoteInput || legacyNote;
    const nextCustomerNote = customerNoteInput;
    const currentStatus = toStringValue(order.status, "pending").toLowerCase();

    if (action === "cancel_order") {
      if (["delivered", "cancelled"].includes(currentStatus)) {
        return NextResponse.json(
          { success: false, message: "Delivered or cancelled orders cannot be cancelled again." },
          { status: 400 },
        );
      }
      order.status = "cancelled";
      if (nextOperatorNote) {
        order.operatorNote = nextOperatorNote;
        order.adminNote = nextOperatorNote;
        order.adminNoteUpdatedAt = new Date();
      }
      if (nextCustomerNote) {
        order.customerNote = nextCustomerNote;
      }
    } else if (action === "add_note") {
      if (!nextOperatorNote) {
        return NextResponse.json(
          { success: false, message: "Note is required." },
          { status: 400 },
        );
      }
      order.operatorNote = nextOperatorNote;
      order.adminNote = nextOperatorNote;
      order.adminNoteUpdatedAt = new Date();
    } else if (action === "add_operator_note") {
      if (!nextOperatorNote) {
        return NextResponse.json(
          { success: false, message: "Operator note is required." },
          { status: 400 },
        );
      }
      order.operatorNote = nextOperatorNote;
      order.adminNote = nextOperatorNote;
      order.adminNoteUpdatedAt = new Date();
    } else if (action === "add_customer_note") {
      if (!nextCustomerNote) {
        return NextResponse.json(
          { success: false, message: "Customer note is required." },
          { status: 400 },
        );
      }
      order.customerNote = nextCustomerNote;
      order.adminNoteUpdatedAt = new Date();
    } else if (action === "update_contacts") {
      if (!body.senderInfo || typeof body.senderInfo !== "object") {
        return NextResponse.json(
          { success: false, message: "Valid senderInfo is required." },
          { status: 400 },
        );
      }
      if (!body.receiverInfo || typeof body.receiverInfo !== "object") {
        return NextResponse.json(
          { success: false, message: "Valid receiverInfo is required." },
          { status: 400 },
        );
      }
      order.senderInfo = body.senderInfo;
      order.receiverInfo = body.receiverInfo;
      if (nextOperatorNote) {
        order.operatorNote = nextOperatorNote;
        order.adminNote = nextOperatorNote;
        order.adminNoteUpdatedAt = new Date();
      }
      if (nextCustomerNote) {
        order.customerNote = nextCustomerNote;
      }
    } else {
      return NextResponse.json(
        { success: false, message: "Unsupported action for admin." },
        { status: 400 },
      );
    }

    await order.save();

    const orderUser = await User.findById(order.user).select("email").lean<{ email?: string } | null>();
    const orderUserEmail = String(orderUser?.email ?? "").trim();
    if (orderUserEmail) {
      try {
        if (action === "cancel_order") {
          await sendEmail({
            email: orderUserEmail,
            emailType: "ORDER_CANCELLED",
            trackingId: toStringValue(order.trackingId),
            orderStatus: toStringValue(order.status),
            orderNote: nextCustomerNote || toStringValue(order.customerNote) || nextOperatorNote || toStringValue(order.operatorNote),
          });
        } else {
          await sendEmail({
            email: orderUserEmail,
            emailType: "ORDER_UPDATED",
            trackingId: toStringValue(order.trackingId),
            orderStatus: toStringValue(order.status),
            orderNote: nextCustomerNote || toStringValue(order.customerNote) || nextOperatorNote || toStringValue(order.operatorNote),
          });
        }
      } catch {
        // Non-blocking mail.
      }
    }

    return NextResponse.json(
      {
        success: true,
        message:
          action === "cancel_order"
            ? "Order cancelled successfully."
            : action === "add_note" || action === "add_operator_note"
            ? "Operator note saved."
            : action === "add_customer_note"
            ? "Customer note saved."
            : "Order contact details updated.",
        order: {
          id: order._id.toString(),
          status: order.status,
          operatorNote: toStringValue(order.operatorNote) || toStringValue(order.adminNote),
          customerNote: toStringValue(order.customerNote),
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to update order status.",
      },
      { status: 500 },
    );
  }
}
