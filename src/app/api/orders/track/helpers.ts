import mongoose from "mongoose";
import Order from "@/app/api/models/orderModel";

type UnknownRecord = Record<string, unknown>;

export interface TrackingOrderRecord extends UnknownRecord {
  _id: unknown;
  user: unknown;
  trackingId?: unknown;
  status?: unknown;
  orderDate?: unknown;
  pickupLocation?: unknown;
  dropLocation?: unknown;
  totalAmount?: unknown;
  totalWeightKg?: unknown;
  packages?: unknown;
  createdAt?: unknown;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

export function toStringValue(value: unknown, fallback = ""): string {
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

export function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeEmail(value: unknown): string {
  return toStringValue(value).trim().toLowerCase();
}

export function normalizeIdentifier(value: unknown): string {
  const raw = toStringValue(value).trim();
  if (!raw) return "";

  const normalized = raw.toUpperCase().replace(/\s+/g, "");
  if (normalized === "HAP" || normalized === "HAP-") {
    return "HAP-";
  }

  const hapMatch = normalized.match(/^HAP[-_]?([A-Z0-9]+)$/);
  if (hapMatch) {
    return `HAP-${hapMatch[1]}`;
  }

  return raw;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapLocation(value: unknown) {
  if (!isRecord(value)) {
    return {
      name: "",
      city: "",
      state: "",
      address: "",
      zip: "",
    };
  }

  return {
    name: toStringValue(value.name),
    city: toStringValue(value.city),
    state: toStringValue(value.state),
    address: toStringValue(value.address),
    zip: toStringValue(value.zip),
  };
}

function toIsoDate(value: unknown): string {
  const date = new Date(toStringValue(value));
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

export function mapOrderForTracking(order: TrackingOrderRecord) {
  const packages = Array.isArray(order.packages) ? order.packages : [];
  const packageNames = packages
    .map((pkg) => {
      if (!isRecord(pkg)) return "";
      return (
        toStringValue(pkg.packageName) ||
        toStringValue(pkg.description) ||
        toStringValue(pkg.packageType)
      );
    })
    .filter(Boolean);

  return {
    id: toStringValue(order._id),
    trackingId: toStringValue(order.trackingId, "TRACKING-PENDING"),
    status: toStringValue(order.status, "pending"),
    orderDate: toIsoDate(order.orderDate),
    createdAt: toIsoDate(order.createdAt),
    totalAmount: toNumberValue(order.totalAmount),
    totalWeightKg: toNumberValue(order.totalWeightKg),
    pickupLocation: mapLocation(order.pickupLocation),
    dropLocation: mapLocation(order.dropLocation),
    packageCount: packages.length,
    packageNames,
  };
}

export async function findOrderForTracking(identifier: string): Promise<TrackingOrderRecord | null> {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) return null;

  const baseSelect =
    "_id user trackingId status orderDate pickupLocation dropLocation totalAmount totalWeightKg packages createdAt";

  if (mongoose.Types.ObjectId.isValid(normalizedIdentifier)) {
    const orderById = await Order.findById(normalizedIdentifier).select(baseSelect).lean<TrackingOrderRecord | null>();
    if (orderById) return orderById;
  }

  return Order.findOne({
    trackingId: new RegExp(`^${escapeRegex(normalizedIdentifier)}$`, "i"),
  })
    .select(baseSelect)
    .lean<TrackingOrderRecord | null>();
}
