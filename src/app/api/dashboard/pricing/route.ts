import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import Bus from "@/app/api/models/busModel";
import Order from "@/app/api/models/orderModel";
import TravelCompany from "@/app/api/models/travelCompanyModel";

const JWT_SECRET = process.env.JWT_SECRET!;

type UnknownRecord = Record<string, unknown>;

type ActorDoc = {
  _id?: unknown;
  role?: string;
  isSuperAdmin?: boolean;
  travelCompanyId?: unknown;
  buses?: unknown[];
};

type BusDoc = {
  _id?: unknown;
  busName?: unknown;
  busNumber?: unknown;
  travelCompanyId?: unknown;
};

type CompanyDoc = {
  _id?: unknown;
  name?: unknown;
};

const toStringValue = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
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

const parseDateRangeStart = (raw: string | null): Date | null => {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const parseDateRangeEnd = (raw: string | null): Date | null => {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(23, 59, 59, 999);
  return parsed;
};

const isObjectIdLike = (value: string) => mongoose.Types.ObjectId.isValid(value);

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

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const actorId = getTokenUserId(request);
    if (!actorId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const actor = await User.findById(actorId)
      .select("_id role isSuperAdmin travelCompanyId buses")
      .lean<ActorDoc | null>();

    if (!actor) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const role = actor.isSuperAdmin ? "superadmin" : toStringValue(actor.role);
    if (role !== "admin" && role !== "superadmin") {
      return NextResponse.json({ success: false, message: "Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const fromDate = parseDateRangeStart(searchParams.get("fromDate"));
    const toDate = parseDateRangeEnd(searchParams.get("toDate"));
    const companyIdParam = toStringValue(searchParams.get("companyId")).trim();
    const busIdParam = toStringValue(searchParams.get("busId")).trim();

    if ((searchParams.get("fromDate") && !fromDate) || (searchParams.get("toDate") && !toDate)) {
      return NextResponse.json({ success: false, message: "Invalid date filter." }, { status: 400 });
    }

    if (fromDate && toDate && toDate < fromDate) {
      return NextResponse.json(
        { success: false, message: "toDate cannot be before fromDate." },
        { status: 400 },
      );
    }

    const busQuery: Record<string, unknown> = {};

    if (role === "superadmin") {
      if (companyIdParam) {
        if (!isObjectIdLike(companyIdParam)) {
          return NextResponse.json({ success: false, message: "Invalid companyId." }, { status: 400 });
        }
        busQuery.travelCompanyId = new mongoose.Types.ObjectId(companyIdParam);
      }
    } else {
      if (actor.travelCompanyId) {
        busQuery.travelCompanyId = actor.travelCompanyId;
      } else if (Array.isArray(actor.buses) && actor.buses.length > 0) {
        busQuery._id = { $in: actor.buses };
      } else {
        return NextResponse.json(
          {
            success: true,
            role,
            summary: {
              totalRevenue: 0,
              totalOrders: 0,
              totalBuses: 0,
              totalCompanies: 0,
            },
            companies: [],
            buses: [],
            orders: [],
          },
          { status: 200 },
        );
      }
    }

    if (busIdParam) {
      if (!isObjectIdLike(busIdParam)) {
        return NextResponse.json({ success: false, message: "Invalid busId." }, { status: 400 });
      }
      busQuery._id = new mongoose.Types.ObjectId(busIdParam);
    }

    const buses = await Bus.find(busQuery)
      .select("_id busName busNumber travelCompanyId")
      .lean<BusDoc[]>();

    if (!Array.isArray(buses) || buses.length === 0) {
      return NextResponse.json(
        {
          success: true,
          role,
          summary: {
            totalRevenue: 0,
            totalOrders: 0,
            totalBuses: 0,
            totalCompanies: 0,
          },
          companies: [],
          buses: [],
          orders: [],
        },
        { status: 200 },
      );
    }

    const busById = new Map<
      string,
      { busName: string; busNumber: string; travelCompanyId: string }
    >();

    const busObjectIds: mongoose.Types.ObjectId[] = [];
    const companyIds = new Set<string>();

    for (const bus of buses) {
      const busId = toStringValue(bus._id);
      if (!busId || !isObjectIdLike(busId)) continue;

      const travelCompanyId = toStringValue(bus.travelCompanyId);
      busById.set(busId, {
        busName: toStringValue(bus.busName, "--"),
        busNumber: toStringValue(bus.busNumber, "--"),
        travelCompanyId,
      });
      busObjectIds.push(new mongoose.Types.ObjectId(busId));
      if (travelCompanyId) companyIds.add(travelCompanyId);
    }

    const companyObjectIds = Array.from(companyIds)
      .filter((id) => isObjectIdLike(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const companies = await TravelCompany.find({ _id: { $in: companyObjectIds } })
      .select("_id name")
      .lean<CompanyDoc[]>();

    const companyById = new Map<string, string>();
    for (const company of companies) {
      const id = toStringValue(company._id);
      if (!id) continue;
      companyById.set(id, toStringValue(company.name, "Unassigned Company"));
    }

    const orderQuery: Record<string, unknown> = {
      $or: [{ assignedBus: { $in: busObjectIds } }, { bus: { $in: busObjectIds } }],
      status: { $ne: "cancelled" },
    };

    if (fromDate || toDate) {
      orderQuery.createdAt = {
        ...(fromDate ? { $gte: fromDate } : {}),
        ...(toDate ? { $lte: toDate } : {}),
      };
    }

    const orderDocs = await Order.find(orderQuery)
      .select(
        "_id trackingId status totalAmount assignedBus bus user bookedByAdmin bookedByAdminId createdAt orderDate paymentId",
      )
      .populate("user", "name email")
      .populate("bookedByAdminId", "name email")
      .sort({ createdAt: -1 })
      .lean<UnknownRecord[]>();

    const busRevenueMap = new Map<
      string,
      {
        busId: string;
        busName: string;
        busNumber: string;
        companyId: string;
        companyName: string;
        totalRevenue: number;
        totalOrders: number;
        collectedByMap: Map<string, { name: string; email: string; type: string; revenue: number; orders: number }>;
      }
    >();

    const companyRevenueMap = new Map<
      string,
      { companyId: string; companyName: string; totalRevenue: number; totalOrders: number; busIds: Set<string> }
    >();

    const orderRows: Array<{
      orderId: string;
      trackingId: string;
      status: string;
      createdAt: string;
      orderDate: string;
      amount: number;
      busId: string;
      busName: string;
      busNumber: string;
      companyId: string;
      companyName: string;
      customerName: string;
      customerEmail: string;
      collectedByName: string;
      collectedByEmail: string;
      collectedByType: string;
    }> = [];

    for (const order of orderDocs) {
      const assignedBusId = toStringValue(order.assignedBus);
      const bookedBusId = toStringValue(order.bus);
      const busId = assignedBusId || bookedBusId;
      const busMeta = busById.get(busId);
      if (!busMeta) continue;

      const amount = Math.max(0, toNumberValue(order.totalAmount, 0));
      const companyId = busMeta.travelCompanyId;
      const companyName = companyById.get(companyId) || "Unassigned Company";

      const customerRecord = (order.user && typeof order.user === "object"
        ? (order.user as UnknownRecord)
        : {}) as UnknownRecord;
      const collectedByRecord = (order.bookedByAdminId && typeof order.bookedByAdminId === "object"
        ? (order.bookedByAdminId as UnknownRecord)
        : {}) as UnknownRecord;

      const bookedByAdmin = Boolean(order.bookedByAdmin) || toStringValue(order.paymentId) === "MANUAL_ADMIN_BOOKING";
      const collectedByName = bookedByAdmin
        ? toStringValue(collectedByRecord.name) || toStringValue(collectedByRecord.email) || "Admin (Unassigned)"
        : "Online Payment";
      const collectedByEmail = bookedByAdmin ? toStringValue(collectedByRecord.email) : "";
      const collectedByType = bookedByAdmin ? "admin" : "online";

      orderRows.push({
        orderId: toStringValue(order._id),
        trackingId: toStringValue(order.trackingId, "TRACKING-PENDING"),
        status: toStringValue(order.status, "pending"),
        createdAt: new Date(order.createdAt ? String(order.createdAt) : Date.now()).toISOString(),
        orderDate: new Date(order.orderDate ? String(order.orderDate) : Date.now()).toISOString(),
        amount,
        busId,
        busName: busMeta.busName,
        busNumber: busMeta.busNumber,
        companyId,
        companyName,
        customerName: toStringValue(customerRecord.name),
        customerEmail: toStringValue(customerRecord.email),
        collectedByName,
        collectedByEmail,
        collectedByType,
      });

      const busEntry =
        busRevenueMap.get(busId) ||
        {
          busId,
          busName: busMeta.busName,
          busNumber: busMeta.busNumber,
          companyId,
          companyName,
          totalRevenue: 0,
          totalOrders: 0,
          collectedByMap: new Map<string, { name: string; email: string; type: string; revenue: number; orders: number }>(),
        };

      busEntry.totalRevenue += amount;
      busEntry.totalOrders += 1;
      const collectorKey = `${collectedByType}:${collectedByName}:${collectedByEmail}`;
      const collector =
        busEntry.collectedByMap.get(collectorKey) ||
        { name: collectedByName, email: collectedByEmail, type: collectedByType, revenue: 0, orders: 0 };
      collector.revenue += amount;
      collector.orders += 1;
      busEntry.collectedByMap.set(collectorKey, collector);
      busRevenueMap.set(busId, busEntry);

      const companyEntry =
        companyRevenueMap.get(companyId) ||
        {
          companyId,
          companyName,
          totalRevenue: 0,
          totalOrders: 0,
          busIds: new Set<string>(),
        };
      companyEntry.totalRevenue += amount;
      companyEntry.totalOrders += 1;
      companyEntry.busIds.add(busId);
      companyRevenueMap.set(companyId, companyEntry);
    }

    const busesPayload = Array.from(busRevenueMap.values())
      .map((entry) => ({
        busId: entry.busId,
        busName: entry.busName,
        busNumber: entry.busNumber,
        companyId: entry.companyId,
        companyName: entry.companyName,
        totalRevenue: entry.totalRevenue,
        totalOrders: entry.totalOrders,
        collectedBy: Array.from(entry.collectedByMap.values())
          .sort((a, b) => b.revenue - a.revenue)
          .map((collector) => ({
            name: collector.name,
            email: collector.email,
            type: collector.type,
            revenue: collector.revenue,
            orders: collector.orders,
          })),
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    const companiesPayload = Array.from(companyRevenueMap.values())
      .map((entry) => ({
        companyId: entry.companyId,
        companyName: entry.companyName,
        totalRevenue: entry.totalRevenue,
        totalOrders: entry.totalOrders,
        totalBuses: entry.busIds.size,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    const availableCompanies = Array.from(companyIds).map((companyId) => ({
      companyId,
      companyName: companyById.get(companyId) || "Unassigned Company",
    }));

    const totalRevenue = orderRows.reduce((sum, row) => sum + row.amount, 0);

    return NextResponse.json(
      {
        success: true,
        role,
        summary: {
          totalRevenue,
          totalOrders: orderRows.length,
          totalBuses: busesPayload.length,
          totalCompanies: new Set(busesPayload.map((entry) => entry.companyId)).size,
        },
        availableCompanies,
        companies: companiesPayload,
        buses: busesPayload,
        orders: orderRows,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load pricing analytics.",
      },
      { status: 500 },
    );
  }
}
