import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
import { runOrderCleanupSafely } from "@/app/api/lib/orderCleanup";
import { resolveBusContactForDate } from "@/app/api/lib/busContact";
import TravelCompany from "@/app/api/models/travelCompanyModel";
import User from "@/app/api/models/userModel";
import "@/app/api/models/busModel";
import Order from "@/app/api/models/orderModel";

interface AuthPayload {
  id: string;
}

interface BusContact {
  _id: string;
  busName: string;
  busNumber: string;
  busImage: string;
  contactPersonName: string;
  contactPersonNumber: string;
}

interface SupportContact {
  name: string;
  phone: string;
}

interface RecentOrderResponseItem {
  id: string;
  trackingId: string;
  status: string;
  orderDate: string;
  createdAt: string;
  updatedAt: string;
  totalAmount: number;
  totalWeightKg: number;
  pickupLocation: {
    name: string;
    city: string;
    state: string;
  };
  dropLocation: {
    name: string;
    city: string;
    state: string;
  };
  packageCount: number;
  packageNames: string[];
  busContact: BusContact | null;
  supportContact: SupportContact | null;
  contactLocked: boolean;
  pickupProofImage?: string;
  dropProofImage?: string;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function toStringValue(value: unknown, fallback = ""): string {
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
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoDate(value: unknown): string {
  const date = new Date(toStringValue(value));
  if (isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function subtractDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

function mapLocation(value: unknown): { name: string; city: string; state: string } {
  if (!isRecord(value)) return { name: "", city: "", state: "" };
  return {
    name: toStringValue(value.name),
    city: toStringValue(value.city),
    state: toStringValue(value.state),
  };
}

function mapPackageNames(packagesValue: unknown): { packageCount: number; packageNames: string[] } {
  if (!Array.isArray(packagesValue)) {
    return { packageCount: 0, packageNames: [] };
  }

  const names = packagesValue
    .map((pkg) => {
      if (!isRecord(pkg)) return "Package";
      return (
        toStringValue(pkg.packageName) ||
        toStringValue(pkg.description) ||
        toStringValue(pkg.packageType) ||
        "Package"
      );
    })
    .filter((name) => name.length > 0);

  return {
    packageCount: packagesValue.length,
    packageNames: names,
  };
}

function getTravelCompanyIdFromBus(busValue: unknown): string {
  if (!isRecord(busValue)) return "";
  return toStringValue(busValue.travelCompanyId);
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    try {
      await runOrderCleanupSafely();
    } catch (cleanupError: unknown) {
      console.error("[order-cleanup] Pre-read cleanup failed:", cleanupError);
    }

    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    const user = await User.findById(payload.id).select("_id");
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let ordersQuery = Order.find({ user: user._id }).sort({ orderDate: -1, createdAt: -1 });

    if (Order.schema.path("assignedBus")) {
      ordersQuery = ordersQuery.populate(
        "assignedBus",
        "travelCompanyId busName busNumber busImages contactPersonName contactPersonNumber operatorContactPeriods"
      );
    }

    if (Order.schema.path("bus")) {
      ordersQuery = ordersQuery.populate(
        "bus",
        "travelCompanyId busName busNumber busImages contactPersonName contactPersonNumber operatorContactPeriods"
      );
    }

    const rawOrders = await ordersQuery.lean<UnknownRecord[]>();
    const travelCompanyIds = Array.from(
      new Set(
        rawOrders
          .flatMap((order) => [
            getTravelCompanyIdFromBus(order.assignedBus),
            getTravelCompanyIdFromBus(order.bus),
          ])
          .filter(Boolean),
      ),
    );

    const travelCompanyById = new Map<string, UnknownRecord>();
    const ownerUserById = new Map<string, UnknownRecord>();

    if (travelCompanyIds.length > 0) {
      const companies = await TravelCompany.find({ _id: { $in: travelCompanyIds } })
        .select("_id name ownerUserId contact")
        .lean<UnknownRecord[]>();

      for (const company of companies) {
        const companyId = toStringValue(company._id);
        if (!companyId) continue;
        travelCompanyById.set(companyId, company);
      }

      const ownerUserIds = Array.from(
        new Set(
          companies
            .map((company) => toStringValue(company.ownerUserId))
            .filter(Boolean),
        ),
      );

      if (ownerUserIds.length > 0) {
        const owners = await User.find({ _id: { $in: ownerUserIds } })
          .select("_id name phone")
          .lean<UnknownRecord[]>();
        for (const owner of owners) {
          const ownerId = toStringValue(owner._id);
          if (!ownerId) continue;
          ownerUserById.set(ownerId, owner);
        }
      }
    }

    const response: RecentOrderResponseItem[] = rawOrders.map((order) => {
      const { packageCount, packageNames } = mapPackageNames(order.packages);
      const assignedBusContact = resolveBusContactForDate(order.assignedBus, order.orderDate);
      const bookingBusContact = resolveBusContactForDate(order.bus, order.orderDate);
      const contactSource = (assignedBusContact || bookingBusContact) as BusContact | null;
      const status = toStringValue(order.status, "pending");
      const normalizedStatus = status.toLowerCase();
      const orderDateIso = toIsoDate(order.orderDate);
      const orderDate = new Date(orderDateIso);
      const contactRevealAt = subtractDays(orderDate, 1);
      const hasContactInfo = Boolean(
        contactSource?.contactPersonNumber || contactSource?.contactPersonName,
      );
      const shouldLockContact =
        Boolean(contactSource) &&
        hasContactInfo &&
        normalizedStatus !== "delivered" &&
        normalizedStatus !== "cancelled" &&
        new Date() < contactRevealAt;

      const busContact: BusContact | null = !contactSource
        ? null
        : shouldLockContact || normalizedStatus === "delivered" || normalizedStatus === "cancelled"
          ? {
              ...contactSource,
              contactPersonName: "",
              contactPersonNumber: "",
            }
          : contactSource;

      const companyId =
        getTravelCompanyIdFromBus(order.assignedBus) || getTravelCompanyIdFromBus(order.bus);
      const company = companyId ? travelCompanyById.get(companyId) : undefined;
      const companyContact = company && isRecord(company.contact) ? company.contact : null;
      const ownerUser = company
        ? ownerUserById.get(toStringValue(company.ownerUserId))
        : undefined;
      const supportPhone =
        toStringValue(companyContact?.phone) ||
        toStringValue(ownerUser?.phone);
      const supportName =
        toStringValue(ownerUser?.name) ||
        (company ? `${toStringValue(company?.name, "Company")} Admin` : "");
      const supportContact =
        supportPhone || supportName
          ? {
              name: supportName || "Company Support",
              phone: supportPhone,
            }
          : null;

      return {
        id: toStringValue(order._id),
        trackingId: toStringValue(order.trackingId, "TRACKING-PENDING"),
        status,
        orderDate: orderDateIso,
        createdAt: toIsoDate(order.createdAt),
        updatedAt: toIsoDate(order.updatedAt),
        totalAmount: toNumberValue(order.totalAmount),
        totalWeightKg: toNumberValue(order.totalWeightKg),
        pickupLocation: mapLocation(order.pickupLocation),
        dropLocation: mapLocation(order.dropLocation),
        packageCount,
        packageNames,
        busContact,
        supportContact,
        contactLocked: shouldLockContact,
        pickupProofImage: toStringValue(order.pickupProofImage),
        dropProofImage: toStringValue(order.dropProofImage),
      };
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    console.error("Error loading recent orders:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
