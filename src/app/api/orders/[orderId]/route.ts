import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import { runOrderCleanupSafely } from "@/app/api/lib/orderCleanup";
import { resolveBusContactForDate } from "@/app/api/lib/busContact";
import { sendEmail } from "@/app/api/lib/mailer";
import User from "@/app/api/models/userModel";
import Bus from "@/app/api/models/busModel";
import Order from "@/app/api/models/orderModel";
import TravelCompany from "@/app/api/models/travelCompanyModel";

type Role = "user" | "operator" | "admin";

interface AuthPayload {
  id: string;
}

type UnknownRecord = Record<string, unknown>;
type BusPricingEntry = {
  pickupLocation?: unknown;
  dropLocation?: unknown;
  effectiveStartDate?: string | Date;
  effectiveEndDate?: string | Date;
};
type BusRoutePathPoint = {
  sequence?: number;
  location?: unknown;
  pointCategory?: unknown;
};

interface ParamsContext {
  params: Promise<{ orderId: string }>;
}

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

function normalizeEmail(value: unknown): string {
  return toStringValue(value).trim().toLowerCase();
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

function normalizeDateOnly(value: unknown): Date | null {
  const date = new Date(toStringValue(value));
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function mapLocation(value: unknown) {
  if (!isRecord(value)) {
    return {
      _id: "",
      id: "",
      name: "",
      address: "",
      city: "",
      state: "",
      zip: "",
    };
  }

  return {
    _id: toStringValue(value._id),
    id: toStringValue(value.id),
    name: toStringValue(value.name),
    address: toStringValue(value.address),
    city: toStringValue(value.city),
    state: toStringValue(value.state),
    zip: toStringValue(value.zip),
  };
}

function mapPackages(packages: unknown) {
  if (!Array.isArray(packages)) return [];

  return packages.map((pkg, idx) => {
    if (!isRecord(pkg)) {
      return {
        id: String(idx),
        packageName: `Package ${idx + 1}`,
        packageType: "",
        packageSize: "",
        packageWeight: 0,
        packageQuantities: 0,
        pickUpDate: "",
        packageImage: "",
        description: "",
      };
    }

    const rawPackage = pkg as UnknownRecord;

    return {
      ...rawPackage,
      id: toStringValue(rawPackage._id, String(idx)),
      packageName:
        toStringValue(rawPackage.packageName) ||
        toStringValue(rawPackage.description) ||
        toStringValue(rawPackage.packageType) ||
        `Package ${idx + 1}`,
      packageType: toStringValue(rawPackage.packageType),
      packageSize: toStringValue(rawPackage.packageSize),
      packageWeight: toNumberValue(rawPackage.packageWeight ?? rawPackage.weightKg),
      packageQuantities: toNumberValue(rawPackage.packageQuantities ?? rawPackage.quantity, 1),
      pickUpDate: toStringValue(rawPackage.pickUpDate),
      packageImage: toStringValue(rawPackage.packageImage),
      description: toStringValue(rawPackage.description),
    };
  });
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizePackagesForUpdate(packages: unknown): UnknownRecord[] {
  if (!Array.isArray(packages)) return [];

  return packages
    .filter((pkg): pkg is UnknownRecord => isRecord(pkg))
    .map((pkg, idx) => {
      const packageWeight = Math.max(0, toNumberValue(pkg.packageWeight ?? pkg.weightKg, 0));
      const packageQuantities = Math.max(0, toNumberValue(pkg.packageQuantities ?? pkg.quantity, 1));
      const packagePrice = Math.max(0, toNumberValue(pkg.price));
      return {
        ...pkg,
        id: toStringValue(pkg.id || pkg._id, String(idx)),
        packageName:
          toStringValue(pkg.packageName) ||
          toStringValue(pkg.description) ||
          toStringValue(pkg.packageType) ||
          `Package ${idx + 1}`,
        packageType: toStringValue(pkg.packageType),
        packageSize: toStringValue(pkg.packageSize),
        packageWeight,
        packageQuantities,
        price: packagePrice,
        pickUpDate: toStringValue(pkg.pickUpDate),
        packageImage: toStringValue(pkg.packageImage),
        description: toStringValue(pkg.description),
      } as UnknownRecord;
    })
    .filter((pkg) => toNumberValue(pkg.packageWeight) > 0 && toNumberValue(pkg.packageQuantities, 1) > 0);
}

function computePackageWeight(packages: UnknownRecord[]): number {
  const total = packages.reduce((sum, pkg) => {
    const weight = Math.max(0, toNumberValue(pkg.packageWeight ?? pkg.weightKg));
    const quantity = Math.max(0, toNumberValue(pkg.packageQuantities ?? pkg.quantity, 1));
    return sum + weight * quantity;
  }, 0);
  return roundCurrency(total);
}

function computePackageAmount(packages: UnknownRecord[]): number {
  const total = packages.reduce((sum, pkg) => {
    const price = Math.max(0, toNumberValue(pkg.price));
    const quantity = Math.max(0, toNumberValue(pkg.packageQuantities ?? pkg.quantity, 1));
    if (!price) return sum;
    return sum + price * quantity;
  }, 0);
  return roundCurrency(total);
}

function parseTimeToMinutes(value: unknown): number | null {
  const raw = toStringValue(value).trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function pickBusStartTimeMinutes(busValue: unknown): number | null {
  if (!isRecord(busValue)) return null;

  const routePathRaw = Array.isArray(busValue.routePath) ? busValue.routePath : [];
  if (routePathRaw.length > 0) {
    const normalizedRoutePath = routePathRaw
      .filter((entry): entry is UnknownRecord => isRecord(entry))
      .sort((a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0));

    for (const point of normalizedRoutePath) {
      if (toStringValue(point.pointCategory).toLowerCase() !== "pickup") continue;
      const minutes = parseTimeToMinutes(point.pointTime);
      if (minutes !== null) return minutes;
    }

    const fallbackRouteMinutes = parseTimeToMinutes(normalizedRoutePath[0]?.pointTime);
    if (fallbackRouteMinutes !== null) return fallbackRouteMinutes;
  }

  const pricingRaw = Array.isArray(busValue.pricing) ? busValue.pricing : [];
  if (pricingRaw.length > 0) {
    const normalizedPricing = pricingRaw
      .filter((entry): entry is UnknownRecord => isRecord(entry))
      .sort((a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0));

    for (const pricePoint of normalizedPricing) {
      const minutes = parseTimeToMinutes(pricePoint.pickupTime);
      if (minutes !== null) return minutes;
    }
  }

  return null;
}

function resolveOrderStartDateTime(orderDateValue: unknown, ...busCandidates: unknown[]): Date | null {
  const orderDate = new Date(toStringValue(orderDateValue));
  if (Number.isNaN(orderDate.getTime())) return null;

  const minutesFromMidnight = busCandidates
    .map((busCandidate) => pickBusStartTimeMinutes(busCandidate))
    .find((minutes): minutes is number => minutes !== null);

  const start = new Date(orderDate);
  start.setHours(0, 0, 0, 0);

  if (minutesFromMidnight === undefined) {
    return start;
  }

  start.setMinutes(minutesFromMidnight);
  return start;
}

function getEditDeadline(startDateTime: Date | null, hoursBeforeStart: number): Date | null {
  if (!startDateTime || Number.isNaN(startDateTime.getTime())) return null;
  return new Date(startDateTime.getTime() - hoursBeforeStart * 60 * 60 * 1000);
}

function canOwnerEditContacts(orderStatus: unknown, startDateTime: Date | null): boolean {
  const status = toStringValue(orderStatus, "pending").toLowerCase();
  if (!["pending", "confirmed", "allocated"].includes(status)) {
    return false;
  }
  const deadline = getEditDeadline(startDateTime, 3);
  if (!deadline) return false;
  return new Date() < deadline;
}

function canAdminEditOrder(orderStatus: unknown, startDateTime: Date | null): boolean {
  const status = toStringValue(orderStatus, "pending").toLowerCase();
  if (!["pending", "confirmed", "allocated"].includes(status)) {
    return false;
  }
  const deadline = getEditDeadline(startDateTime, 1);
  if (!deadline) return false;
  return new Date() < deadline;
}

function isPricingEntryActiveOnDate(entry: BusPricingEntry, date: Date) {
  if (entry.effectiveStartDate) {
    const startDate = new Date(entry.effectiveStartDate);
    startDate.setUTCHours(0, 0, 0, 0);
    if (Number.isNaN(startDate.getTime()) || date < startDate) return false;
  }

  if (entry.effectiveEndDate) {
    const endDate = new Date(entry.effectiveEndDate);
    endDate.setUTCHours(0, 0, 0, 0);
    if (Number.isNaN(endDate.getTime()) || date > endDate) return false;
  }

  return true;
}

function resolvePointCategory(point: BusRoutePathPoint, index: number): "pickup" | "drop" {
  const raw = String(point?.pointCategory ?? "").trim().toLowerCase();
  if (raw === "pickup" || raw === "drop") return raw;
  return index === 0 ? "pickup" : "drop";
}

function busSupportsRouteOnDate(
  pricingEntries: BusPricingEntry[],
  routePath: BusRoutePathPoint[],
  pickupLocationId: string,
  dropLocationId: string,
  date: Date,
) {
  const sortedRoutePath = [...routePath].sort(
    (left, right) => Number(left?.sequence ?? 0) - Number(right?.sequence ?? 0),
  );

  if (sortedRoutePath.length >= 2) {
    const pickupIndexes: number[] = [];
    for (let index = 0; index < sortedRoutePath.length - 1; index += 1) {
      const category = resolvePointCategory(sortedRoutePath[index], index);
      const locationId = String(sortedRoutePath[index]?.location ?? "");
      if (category === "pickup" && locationId === pickupLocationId) {
        pickupIndexes.push(index);
      }
    }

    for (const pickupIndex of pickupIndexes) {
      for (let dropIndex = pickupIndex + 1; dropIndex < sortedRoutePath.length; dropIndex += 1) {
        const category = resolvePointCategory(sortedRoutePath[dropIndex], dropIndex);
        const locationId = String(sortedRoutePath[dropIndex]?.location ?? "");
        if (category !== "drop" || locationId !== dropLocationId) continue;

        let allSegmentsAvailable = true;
        for (let segmentIndex = pickupIndex; segmentIndex < dropIndex; segmentIndex += 1) {
          const fromId = String(sortedRoutePath[segmentIndex]?.location ?? "");
          const toId = String(sortedRoutePath[segmentIndex + 1]?.location ?? "");
          if (!fromId || !toId || fromId === toId) {
            allSegmentsAvailable = false;
            break;
          }

          const hasSegmentPricing = pricingEntries.some(
            (entry) =>
              String(entry?.pickupLocation ?? "") === fromId &&
              String(entry?.dropLocation ?? "") === toId &&
              isPricingEntryActiveOnDate(entry, date),
          );
          if (!hasSegmentPricing) {
            allSegmentsAvailable = false;
            break;
          }
        }

        if (allSegmentsAvailable) {
          return true;
        }
      }
    }
  }

  return pricingEntries.some(
    (entry) =>
      String(entry?.pickupLocation ?? "") === pickupLocationId &&
      String(entry?.dropLocation ?? "") === dropLocationId &&
      isPricingEntryActiveOnDate(entry, date),
  );
}

function getUtcDayRange(date: Date) {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart, dayEnd };
}

function extractLocationId(location: unknown): string {
  if (!isRecord(location)) return "";
  const fromUnderscore = toStringValue(location._id).trim();
  if (fromUnderscore) return fromUnderscore;
  const fromId = toStringValue(location.id).trim();
  if (fromId) return fromId;
  return "";
}

async function reserveBusCapacityForDay(
  tx: mongoose.ClientSession,
  busId: mongoose.Types.ObjectId,
  dayStart: Date,
  dayEnd: Date,
  requiredWeightKg: number,
) {
  const result = await Bus.updateOne(
    {
      _id: busId,
      availability: {
        $elemMatch: {
          date: { $gte: dayStart, $lt: dayEnd },
          availableCapacityKg: { $gte: requiredWeightKg },
        },
      },
    },
    { $inc: { "availability.$.availableCapacityKg": -requiredWeightKg } },
    { session: tx },
  );
  return result.modifiedCount > 0;
}

async function releaseBusCapacityForDay(
  tx: mongoose.ClientSession,
  busId: mongoose.Types.ObjectId,
  dayStart: Date,
  dayEnd: Date,
  releasedWeightKg: number,
) {
  const result = await Bus.updateOne(
    {
      _id: busId,
      availability: {
        $elemMatch: {
          date: { $gte: dayStart, $lt: dayEnd },
        },
      },
    },
    { $inc: { "availability.$.availableCapacityKg": releasedWeightKg } },
    { session: tx },
  );
  return result.modifiedCount > 0;
}

function getTravelCompanyIdFromBus(busValue: unknown): string {
  if (!isRecord(busValue)) return "";
  return toStringValue(busValue.travelCompanyId);
}

function readFirstDefinedValue(recordValue: unknown, keys: string[]): string | null {
  if (!isRecord(recordValue)) return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(recordValue, key)) {
      return toStringValue(recordValue[key]).trim();
    }
  }
  return null;
}

function mergeOwnerEditableContacts(
  currentSenderInfo: unknown,
  senderInput: unknown,
  currentReceiverInfo: unknown,
  receiverInput: unknown,
): { senderInfo: UnknownRecord; receiverInfo: UnknownRecord } {
  const nextSenderInfo: UnknownRecord = isRecord(currentSenderInfo) ? { ...currentSenderInfo } : {};
  const nextReceiverInfo: UnknownRecord = isRecord(currentReceiverInfo) ? { ...currentReceiverInfo } : {};

  const senderName = readFirstDefinedValue(senderInput, ["name", "senderName"]);
  if (senderName !== null) {
    nextSenderInfo.name = senderName;
    nextSenderInfo.senderName = senderName;
  }

  const senderContact = readFirstDefinedValue(senderInput, [
    "contact",
    "senderContact",
    "phone",
    "senderPhone",
  ]);
  if (senderContact !== null) {
    nextSenderInfo.contact = senderContact;
    nextSenderInfo.senderContact = senderContact;
    nextSenderInfo.phone = senderContact;
  }

  const receiverContact = readFirstDefinedValue(receiverInput, [
    "contact",
    "receiverContact",
    "phone",
    "receiverPhone",
  ]);
  if (receiverContact !== null) {
    nextReceiverInfo.contact = receiverContact;
    nextReceiverInfo.receiverContact = receiverContact;
    nextReceiverInfo.phone = receiverContact;
  }

  return { senderInfo: nextSenderInfo, receiverInfo: nextReceiverInfo };
}

export async function GET(request: NextRequest, context: ParamsContext) {
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
    const user = await User.findById(payload.id).select("_id role isSuperAdmin travelCompanyId buses");
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await context.params;
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }

    const userRole = toStringValue((user as { role?: unknown }).role) as Role;
    const isSuperAdmin = Boolean((user as { isSuperAdmin?: unknown }).isSuperAdmin);

    let orderQuery = Order.findOne({ _id: orderId });
    if (Order.schema.path("assignedBus")) {
      orderQuery = orderQuery.populate(
        "assignedBus",
        "travelCompanyId busName busNumber busImages contactPersonName contactPersonNumber operatorContactPeriods routePath pricing"
      );
    }
    if (Order.schema.path("bus")) {
      orderQuery = orderQuery.populate(
        "bus",
        "travelCompanyId busName busNumber busImages contactPersonName contactPersonNumber operatorContactPeriods routePath pricing"
      );
    }
    if (Order.schema.path("user")) {
      orderQuery = orderQuery.populate({
        path: "user",
        model: "users",
        select: "email",
      });
    }

    const order = await orderQuery.lean<UnknownRecord | null>();
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const orderUserId = isRecord(order.user) ? toStringValue(order.user._id) : toStringValue(order.user);
    const isOrderOwner = orderUserId === toStringValue(user._id);
    const assignedBus = isRecord(order.assignedBus) ? order.assignedBus : null;
    const bookedBus = isRecord(order.bus) ? order.bus : null;
    const candidateBusRefs = [assignedBus, bookedBus].filter(
      (bus): bus is UnknownRecord => Boolean(bus),
    );
    if (!isOrderOwner && !isSuperAdmin && userRole === "admin") {
      const userTravelCompanyId = toStringValue((user as { travelCompanyId?: unknown }).travelCompanyId);
      const userBusIds = Array.isArray((user as { buses?: unknown[] }).buses)
        ? (user as { buses?: unknown[] }).buses!.map((id) => toStringValue(id))
        : [];

      const adminHasAccess = candidateBusRefs.some((busRef) => {
        const busTravelCompanyId = toStringValue(busRef.travelCompanyId);
        const busId = toStringValue(busRef._id);
        return (
          (userTravelCompanyId && busTravelCompanyId && userTravelCompanyId === busTravelCompanyId) ||
          (busId && userBusIds.includes(busId))
        );
      });

      if (!adminHasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!isOrderOwner && !isSuperAdmin && userRole === "operator") {
      const orderDate = normalizeDateOnly(order.orderDate);
      const hasOperatorAccess = candidateBusRefs.some((busRef) => {
        const periodsRaw = Array.isArray(busRef.operatorContactPeriods)
          ? (busRef.operatorContactPeriods as unknown[])
          : [];

        return periodsRaw.some((periodRaw) => {
          if (!isRecord(periodRaw)) return false;
          if (toStringValue(periodRaw.operatorId) !== toStringValue(user._id)) return false;
          const startDate = normalizeDateOnly(periodRaw.startDate);
          const endDate = normalizeDateOnly(periodRaw.endDate);
          if (!startDate || !endDate || !orderDate) return false;
          return orderDate >= startDate && orderDate <= endDate;
        });
      });

      if (!hasOperatorAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!isOrderOwner && !isSuperAdmin && userRole !== "admin" && userRole !== "operator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const assignedBusContact = resolveBusContactForDate(order.assignedBus, order.orderDate);
    const bookedBusContact = resolveBusContactForDate(order.bus, order.orderDate);
    const contactSource = (assignedBusContact || bookedBusContact) as UnknownRecord | null;
    const orderStartDateTime = resolveOrderStartDateTime(order.orderDate, order.assignedBus, order.bus);
    const ownerRecord = isRecord(order.user) ? order.user : null;
    const ownerEmail = normalizeEmail(ownerRecord?.email);
    const status = toStringValue(order.status, "pending");
    const normalizedStatus = status.toLowerCase();
    const orderDateIso = toIsoDate(order.orderDate);
    const contactRevealAt = subtractDays(new Date(orderDateIso), 1);
    const shouldHideForCompletedForOwner =
      isOrderOwner && (normalizedStatus === "delivered" || normalizedStatus === "cancelled");
    const hasContactInfo = Boolean(
      contactSource &&
      (toStringValue(contactSource.contactPersonName) || toStringValue(contactSource.contactPersonNumber)),
    );
    const shouldLockContactForOwner =
      isOrderOwner &&
      hasContactInfo &&
      !shouldHideForCompletedForOwner &&
      new Date() < contactRevealAt;

    const busContact = !contactSource
      ? null
      : shouldLockContactForOwner || shouldHideForCompletedForOwner
        ? {
            ...contactSource,
            contactPersonName: "",
            contactPersonNumber: "",
          }
        : contactSource;
    const supportTravelCompanyId =
      getTravelCompanyIdFromBus(order.assignedBus) || getTravelCompanyIdFromBus(order.bus);
    let supportContact: { name: string; phone: string } | null = null;
    if (supportTravelCompanyId) {
      const company = await TravelCompany.findById(supportTravelCompanyId)
        .select("_id name ownerUserId contact")
        .lean<UnknownRecord | null>();

      if (company) {
        const ownerUserId = toStringValue(company.ownerUserId);
        const owner = ownerUserId
          ? await User.findById(ownerUserId).select("_id name phone").lean<UnknownRecord | null>()
          : null;
        const companyContact = isRecord(company.contact) ? company.contact : null;
        const supportPhone =
          toStringValue(companyContact?.phone) ||
          toStringValue(owner?.phone);
        const supportName =
          toStringValue(owner?.name) ||
          (company ? `${toStringValue(company?.name, "Company")} Admin` : "");
        if (supportPhone || supportName) {
          supportContact = {
            name: supportName || "Company Support",
            phone: supportPhone,
          };
        }
      }
    }

    const adminCanEditOrder =
      userRole === "admin" || isSuperAdmin ? canAdminEditOrder(order.status, orderStartDateTime) : false;
    const effectiveBusId = toStringValue(order.assignedBus) || toStringValue(order.bus);
    let transferCandidates: Array<{
      id: string;
      busName: string;
      busNumber: string;
      companyId: string;
      companyName: string;
      availableCapacityKg: number;
      totalCapacityKg: number;
    }> = [];

    if ((userRole === "admin" || isSuperAdmin) && adminCanEditOrder) {
      const pickupLocationId = extractLocationId(order.pickupLocation);
      const dropLocationId = extractLocationId(order.dropLocation);
      const orderDateOnly = normalizeDateOnly(order.orderDate);
      const requiredWeightKg = toNumberValue(order.totalWeightKg);

      if (
        pickupLocationId &&
        dropLocationId &&
        orderDateOnly &&
        requiredWeightKg > 0 &&
        mongoose.Types.ObjectId.isValid(pickupLocationId) &&
        mongoose.Types.ObjectId.isValid(dropLocationId)
      ) {
        const { dayStart, dayEnd } = getUtcDayRange(orderDateOnly);
        const busQuery: Record<string, unknown> = {};
        if (effectiveBusId && mongoose.Types.ObjectId.isValid(effectiveBusId)) {
          busQuery._id = { $ne: new mongoose.Types.ObjectId(effectiveBusId) };
        }

        const allCandidateBuses = await Bus.find(busQuery)
          .select("_id busName busNumber travelCompanyId availability pricing routePath")
          .populate("travelCompanyId", "name")
          .lean<UnknownRecord[]>();

        transferCandidates = allCandidateBuses
          .filter((busCandidate) => {
            const pricingEntries = Array.isArray(busCandidate.pricing)
              ? (busCandidate.pricing as BusPricingEntry[])
              : [];
            const routePath = Array.isArray(busCandidate.routePath)
              ? (busCandidate.routePath as BusRoutePathPoint[])
              : [];
            const supportsRoute = busSupportsRouteOnDate(
              pricingEntries,
              routePath,
              pickupLocationId,
              dropLocationId,
              orderDateOnly,
            );
            if (!supportsRoute) return false;

            const capacitySlot = Array.isArray(busCandidate.availability)
              ? busCandidate.availability.find((slot) => {
                  if (!isRecord(slot)) return false;
                  const slotDate = new Date(toStringValue(slot.date));
                  if (Number.isNaN(slotDate.getTime())) return false;
                  return slotDate >= dayStart && slotDate < dayEnd;
                })
              : null;
            const availableCapacityKg = isRecord(capacitySlot)
              ? toNumberValue(capacitySlot.availableCapacityKg)
              : 0;
            return availableCapacityKg >= requiredWeightKg;
          })
          .map((busCandidate) => {
            const capacitySlot = Array.isArray(busCandidate.availability)
              ? busCandidate.availability.find((slot) => {
                  if (!isRecord(slot)) return false;
                  const slotDate = new Date(toStringValue(slot.date));
                  if (Number.isNaN(slotDate.getTime())) return false;
                  return slotDate >= dayStart && slotDate < dayEnd;
                })
              : null;
            const travelCompanyRecord = isRecord(busCandidate.travelCompanyId)
              ? busCandidate.travelCompanyId
              : null;
            return {
              id: toStringValue(busCandidate._id),
              busName: toStringValue(busCandidate.busName, "Bus"),
              busNumber: toStringValue(busCandidate.busNumber),
              companyId: travelCompanyRecord
                ? toStringValue(travelCompanyRecord._id)
                : toStringValue(busCandidate.travelCompanyId),
              companyName: toStringValue(travelCompanyRecord?.name),
              availableCapacityKg: isRecord(capacitySlot)
                ? toNumberValue(capacitySlot.availableCapacityKg)
                : 0,
              totalCapacityKg: isRecord(capacitySlot)
                ? toNumberValue(capacitySlot.totalCapacityKg)
                : 0,
            };
          })
          .sort((left, right) =>
            `${left.companyName} ${left.busName} ${left.busNumber}`.localeCompare(
              `${right.companyName} ${right.busName} ${right.busNumber}`,
            ),
          );
      }
    }

    const response = {
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
      senderInfo: isRecord(order.senderInfo) ? order.senderInfo : {},
      receiverInfo: isRecord(order.receiverInfo) ? order.receiverInfo : {},
      busContact,
      supportContact,
      contactLocked: shouldLockContactForOwner,
      pickupProofImage: toStringValue(order.pickupProofImage),
      dropProofImage: toStringValue(order.dropProofImage),
      operatorNote:
        userRole === "operator" || userRole === "admin" || isSuperAdmin
          ? toStringValue(order.operatorNote) || toStringValue(order.adminNote)
          : "",
      customerNote:
        userRole === "operator"
          ? ""
          : toStringValue(order.customerNote),
      customerEmail: userRole === "admin" || isSuperAdmin ? ownerEmail : "",
      canUserEditContacts: isOrderOwner ? canOwnerEditContacts(order.status, orderStartDateTime) : false,
      canAdminEditOrder: adminCanEditOrder,
      canTransferOrder: adminCanEditOrder,
      canAdminUpdateAll: adminCanEditOrder,
      currentBusId: effectiveBusId,
      transferCandidates,
      adjustmentPendingAmount: toNumberValue(order.adjustmentPendingAmount),
      adjustmentRefundAmount: toNumberValue(order.adjustmentRefundAmount),
      adjustmentStatus: toStringValue(order.adjustmentStatus, "none"),
      packageCount: Array.isArray(order.packages) ? order.packages.length : 0,
      packages: mapPackages(order.packages),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    console.error("Error loading order details:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: ParamsContext) {
  try {
    await dbConnect();

    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    const actor = await User.findById(payload.id).select("_id role isSuperAdmin travelCompanyId buses");
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await context.params;
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }

    const body = (await request.json()) as {
      senderInfo?: Record<string, unknown>;
      receiverInfo?: Record<string, unknown>;
      pickupLocation?: Record<string, unknown>;
      dropLocation?: Record<string, unknown>;
      packages?: unknown[];
      note?: string;
      operatorNote?: string;
      customerNote?: string;
      customerEmail?: string;
      transferBusId?: string;
    };

    const order = await Order.findById(orderId).select(
      "_id user trackingId status orderDate assignedBus bus pickupLocation dropLocation totalAmount totalWeightKg packages senderInfo receiverInfo adminNote operatorNote customerNote adjustmentPendingAmount adjustmentRefundAmount adjustmentStatus adjustmentRazorpayOrderId adjustmentRazorpayPaymentId adjustmentRazorpaySignature adjustmentUpdatedAt adminNoteUpdatedAt",
    );
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const actorRole = toStringValue((actor as { role?: unknown }).role);
    const isSuperAdmin = Boolean((actor as { isSuperAdmin?: unknown }).isSuperAdmin);
    const isOwner = toStringValue(order.user) === toStringValue(actor._id);
    const isAdminActor = actorRole === "admin" || isSuperAdmin;

    const legacyNote = toStringValue(body.note).trim();
    const operatorNoteInput = toStringValue(body.operatorNote).trim();
    const customerNoteInput = toStringValue(body.customerNote).trim();
    const customerEmailInput = normalizeEmail(body.customerEmail);
    const transferBusIdInput = toStringValue(body.transferBusId).trim();
    const didTransfer = Boolean(transferBusIdInput);
    const hasSenderInfo = isRecord(body.senderInfo);
    const hasReceiverInfo = isRecord(body.receiverInfo);
    const hasPickupLocation = isRecord(body.pickupLocation);
    const hasDropLocation = isRecord(body.dropLocation);
    const hasPackages = Array.isArray(body.packages);
    const previousTotalAmount = roundCurrency(toNumberValue(order.totalAmount));
    const previousTotalWeight = roundCurrency(toNumberValue(order.totalWeightKg));

    if (!isOwner && !isSuperAdmin && actorRole === "admin") {
      const busIds = Array.from(
        new Set(
          [toStringValue(order.assignedBus), toStringValue(order.bus)].filter((id) =>
            Boolean(id && mongoose.Types.ObjectId.isValid(id)),
          ),
        ),
      );
      if (busIds.length === 0) {
        return NextResponse.json({ error: "Order bus assignment missing." }, { status: 400 });
      }
      const orderBuses = await Bus.find({ _id: { $in: busIds } }).select("_id travelCompanyId").lean<UnknownRecord[]>();
      if (!orderBuses.length) {
        return NextResponse.json({ error: "Bus not found." }, { status: 404 });
      }
      const adminCompanyId = toStringValue((actor as { travelCompanyId?: unknown }).travelCompanyId);
      const adminBusIds = Array.isArray((actor as { buses?: unknown[] }).buses)
        ? (actor as { buses?: unknown[] }).buses!.map((id) => toStringValue(id))
        : [];
      const hasAdminAccess = orderBuses.some((bus) =>
        (adminCompanyId && toStringValue(bus.travelCompanyId) === adminCompanyId) ||
        adminBusIds.includes(toStringValue(bus._id)),
      );
      if (!hasAdminAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!isOwner && !isSuperAdmin && actorRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const busScheduleIds = Array.from(
      new Set(
        [toStringValue(order.assignedBus), toStringValue(order.bus)].filter((id) =>
          Boolean(id && mongoose.Types.ObjectId.isValid(id)),
        ),
      ),
    );
    const busScheduleCandidates = busScheduleIds.length
      ? await Bus.find({ _id: { $in: busScheduleIds } }).select("routePath pricing").lean<UnknownRecord[]>()
      : [];
    const orderStartDateTime = resolveOrderStartDateTime(order.orderDate, ...busScheduleCandidates);

    if (isAdminActor) {
      if (!canAdminEditOrder(order.status, orderStartDateTime)) {
        return NextResponse.json(
          { error: "Order details can be edited only until 1 hour before bus start time." },
          { status: 403 },
        );
      }
    } else if (isOwner) {
      if (!canOwnerEditContacts(order.status, orderStartDateTime)) {
        return NextResponse.json(
          { error: "Contact details can be edited only until 3 hours before bus start time." },
          { status: 403 },
        );
      }
    }

    if (isAdminActor) {
      if (
        !hasSenderInfo &&
        !hasReceiverInfo &&
        !legacyNote &&
        !operatorNoteInput &&
        !customerNoteInput &&
        !customerEmailInput &&
        !hasPickupLocation &&
        !hasDropLocation &&
        !hasPackages &&
        !transferBusIdInput
      ) {
        return NextResponse.json(
          { error: "Provide at least one field to update." },
          { status: 400 },
        );
      }
      if (hasSenderInfo) {
        order.senderInfo = body.senderInfo!;
      }
      if (hasReceiverInfo) {
        order.receiverInfo = body.receiverInfo!;
      }
      if (hasPickupLocation) {
        order.pickupLocation = body.pickupLocation!;
      }
      if (hasDropLocation) {
        order.dropLocation = body.dropLocation!;
      }
      if (hasPackages) {
        const normalizedPackages = normalizePackagesForUpdate(body.packages);
        if (!normalizedPackages.length) {
          return NextResponse.json(
            { error: "At least one valid package is required for package update." },
            { status: 400 },
          );
        }

        const nextTotalWeight = computePackageWeight(normalizedPackages);
        if (nextTotalWeight <= 0) {
          return NextResponse.json(
            { error: "Updated package weight must be greater than 0." },
            { status: 400 },
          );
        }

        const explicitPackageAmount = computePackageAmount(normalizedPackages);
        const ratePerKg = previousTotalWeight > 0 ? previousTotalAmount / previousTotalWeight : 0;
        const nextTotalAmount = roundCurrency(
          explicitPackageAmount > 0
            ? explicitPackageAmount
            : ratePerKg > 0
              ? ratePerKg * nextTotalWeight
              : previousTotalAmount,
        );

        order.packages = normalizedPackages;
        order.totalWeightKg = nextTotalWeight;
        order.totalAmount = nextTotalAmount;

        const amountDelta = roundCurrency(nextTotalAmount - previousTotalAmount);
        if (amountDelta > 0) {
          order.adjustmentPendingAmount = amountDelta;
          order.adjustmentRefundAmount = 0;
          order.adjustmentStatus = "pending_payment";
        } else if (amountDelta < 0) {
          order.adjustmentPendingAmount = 0;
          order.adjustmentRefundAmount = Math.abs(amountDelta);
          order.adjustmentStatus = "pending_refund";
        } else {
          order.adjustmentPendingAmount = 0;
          order.adjustmentRefundAmount = 0;
          order.adjustmentStatus = "settled";
        }

        order.adjustmentRazorpayOrderId = "";
        order.adjustmentRazorpayPaymentId = "";
        order.adjustmentRazorpaySignature = "";
        order.adjustmentUpdatedAt = new Date();
      }
    } else {
      if (!hasSenderInfo || !hasReceiverInfo) {
        return NextResponse.json(
          { error: "senderInfo and receiverInfo are required." },
          { status: 400 },
        );
      }
      const ownerEditable = mergeOwnerEditableContacts(
        order.senderInfo,
        body.senderInfo,
        order.receiverInfo,
        body.receiverInfo,
      );
      order.senderInfo = ownerEditable.senderInfo;
      order.receiverInfo = ownerEditable.receiverInfo;
    }

    if (transferBusIdInput) {
      if (!isAdminActor) {
        return NextResponse.json({ error: "Only admin can transfer order to another bus." }, { status: 403 });
      }
      if (!mongoose.Types.ObjectId.isValid(transferBusIdInput)) {
        return NextResponse.json({ error: "Invalid target bus id." }, { status: 400 });
      }

      const sourceBusId = toStringValue(order.assignedBus) || toStringValue(order.bus);
      if (!sourceBusId || !mongoose.Types.ObjectId.isValid(sourceBusId)) {
        return NextResponse.json({ error: "Source bus assignment missing." }, { status: 400 });
      }
      if (sourceBusId === transferBusIdInput) {
        return NextResponse.json({ error: "Order is already assigned to this bus." }, { status: 400 });
      }

      const pickupLocationId = extractLocationId(order.pickupLocation);
      const dropLocationId = extractLocationId(order.dropLocation);
      if (
        !pickupLocationId ||
        !dropLocationId ||
        !mongoose.Types.ObjectId.isValid(pickupLocationId) ||
        !mongoose.Types.ObjectId.isValid(dropLocationId)
      ) {
        return NextResponse.json(
          { error: "Order pickup/drop locations are missing or invalid." },
          { status: 409 },
        );
      }

      const orderDateOnly = normalizeDateOnly(order.orderDate);
      if (!orderDateOnly) {
        return NextResponse.json({ error: "Order date is invalid." }, { status: 409 });
      }

      const reserveWeightKg = roundCurrency(toNumberValue(order.totalWeightKg));
      const releaseWeightKg = previousTotalWeight > 0 ? previousTotalWeight : reserveWeightKg;
      if (!Number.isFinite(reserveWeightKg) || reserveWeightKg <= 0) {
        return NextResponse.json({ error: "Order weight is invalid." }, { status: 409 });
      }

      const targetBus = await Bus.findById(transferBusIdInput)
        .select("_id pricing routePath")
        .lean<UnknownRecord | null>();
      if (!targetBus) {
        return NextResponse.json({ error: "Target bus not found." }, { status: 404 });
      }

      const supportsRoute = busSupportsRouteOnDate(
        Array.isArray(targetBus.pricing) ? (targetBus.pricing as BusPricingEntry[]) : [],
        Array.isArray(targetBus.routePath) ? (targetBus.routePath as BusRoutePathPoint[]) : [],
        pickupLocationId,
        dropLocationId,
        orderDateOnly,
      );
      if (!supportsRoute) {
        return NextResponse.json(
          { error: "Target bus does not support this route/date." },
          { status: 409 },
        );
      }

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const { dayStart, dayEnd } = getUtcDayRange(orderDateOnly);
          const reserved = await reserveBusCapacityForDay(
            session,
            new mongoose.Types.ObjectId(transferBusIdInput),
            dayStart,
            dayEnd,
            reserveWeightKg,
          );
          if (!reserved) {
            throw new Error("Target bus has insufficient capacity.");
          }

          const released = await releaseBusCapacityForDay(
            session,
            new mongoose.Types.ObjectId(sourceBusId),
            dayStart,
            dayEnd,
            releaseWeightKg,
          );
          if (!released) {
            throw new Error("Failed to release capacity from current bus.");
          }

          const txOrder = await Order.findById(order._id).session(session).select("_id status assignedBus");
          if (!txOrder) {
            throw new Error("Order not found while transferring.");
          }
          txOrder.assignedBus = new mongoose.Types.ObjectId(transferBusIdInput);
          if (["pending", "confirmed"].includes(toStringValue(txOrder.status).toLowerCase())) {
            txOrder.status = "allocated";
          }
          await txOrder.save({ session });
        });
      } catch (transferError: unknown) {
        return NextResponse.json(
          { error: transferError instanceof Error ? transferError.message : "Failed to transfer order." },
          { status: 409 },
        );
      } finally {
        await session.endSession();
      }

      order.assignedBus = new mongoose.Types.ObjectId(transferBusIdInput);
      if (["pending", "confirmed"].includes(toStringValue(order.status).toLowerCase())) {
        order.status = "allocated";
      }
    }

    if (isAdminActor && hasPackages && !transferBusIdInput) {
      const currentBusId = toStringValue(order.assignedBus) || toStringValue(order.bus);
      const nextWeight = roundCurrency(toNumberValue(order.totalWeightKg));
      const previousWeight = previousTotalWeight > 0 ? previousTotalWeight : 0;
      const weightDelta = roundCurrency(nextWeight - previousWeight);

      if (currentBusId && mongoose.Types.ObjectId.isValid(currentBusId) && Math.abs(weightDelta) > 0) {
        const orderDateOnly = normalizeDateOnly(order.orderDate);
        if (!orderDateOnly) {
          return NextResponse.json({ error: "Order date is invalid." }, { status: 409 });
        }

        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const { dayStart, dayEnd } = getUtcDayRange(orderDateOnly);
            if (weightDelta > 0) {
              const reserved = await reserveBusCapacityForDay(
                session,
                new mongoose.Types.ObjectId(currentBusId),
                dayStart,
                dayEnd,
                weightDelta,
              );
              if (!reserved) {
                throw new Error("Assigned bus has insufficient capacity for updated packages.");
              }
            } else {
              const released = await releaseBusCapacityForDay(
                session,
                new mongoose.Types.ObjectId(currentBusId),
                dayStart,
                dayEnd,
                Math.abs(weightDelta),
              );
              if (!released) {
                throw new Error("Failed to release extra capacity after package update.");
              }
            }
          });
        } catch (weightError: unknown) {
          return NextResponse.json(
            { error: weightError instanceof Error ? weightError.message : "Failed to update package weight capacity." },
            { status: 409 },
          );
        } finally {
          await session.endSession();
        }
      }
    }

    if (isAdminActor && (hasPickupLocation || hasDropLocation)) {
      const busIdForRouteCheck = transferBusIdInput || toStringValue(order.assignedBus) || toStringValue(order.bus);
      if (busIdForRouteCheck && mongoose.Types.ObjectId.isValid(busIdForRouteCheck)) {
        const pickupLocationId = extractLocationId(order.pickupLocation);
        const dropLocationId = extractLocationId(order.dropLocation);
        const orderDateOnly = normalizeDateOnly(order.orderDate);

        if (
          pickupLocationId &&
          dropLocationId &&
          orderDateOnly &&
          mongoose.Types.ObjectId.isValid(pickupLocationId) &&
          mongoose.Types.ObjectId.isValid(dropLocationId)
        ) {
          const routeBus = await Bus.findById(busIdForRouteCheck)
            .select("_id pricing routePath")
            .lean<UnknownRecord | null>();
          if (!routeBus) {
            return NextResponse.json({ error: "Assigned bus not found for route validation." }, { status: 404 });
          }

          const supportsRoute = busSupportsRouteOnDate(
            Array.isArray(routeBus.pricing) ? (routeBus.pricing as BusPricingEntry[]) : [],
            Array.isArray(routeBus.routePath) ? (routeBus.routePath as BusRoutePathPoint[]) : [],
            pickupLocationId,
            dropLocationId,
            orderDateOnly,
          );
          if (!supportsRoute) {
            return NextResponse.json(
              { error: "Selected bus does not support updated pickup/drop route. Transfer to a compatible bus." },
              { status: 409 },
            );
          }
        }
      }
    }

    const previousCustomerId = toStringValue(order.user);
    if (isAdminActor && customerEmailInput) {
      const nextCustomer = await User.findOne({ email: customerEmailInput }).select("_id email role");
      if (!nextCustomer || nextCustomer.role !== "user") {
        return NextResponse.json(
          { error: "No customer account found for this email." },
          { status: 404 },
        );
      }
      order.user = nextCustomer._id;
    }

    if (isAdminActor) {
      if (operatorNoteInput || legacyNote) {
        const value = operatorNoteInput || legacyNote;
        order.operatorNote = value;
        order.adminNote = value;
      }
      if (customerNoteInput) {
        order.customerNote = customerNoteInput;
      }
      order.adminNoteUpdatedAt = new Date();
    }

    await order.save();

    const nextCustomerId = toStringValue(order.user);
    if (
      previousCustomerId &&
      nextCustomerId &&
      previousCustomerId !== nextCustomerId &&
      mongoose.Types.ObjectId.isValid(previousCustomerId) &&
      mongoose.Types.ObjectId.isValid(nextCustomerId)
    ) {
      await Promise.all([
        User.findByIdAndUpdate(previousCustomerId, { $pull: { orders: order._id } }),
        User.findByIdAndUpdate(nextCustomerId, { $addToSet: { orders: order._id } }),
      ]);
    }

    let activeCustomerEmail = "";
    if (isAdminActor) {
      const customer = await User.findById(order.user).select("email").lean<{ email?: string } | null>();
      activeCustomerEmail = normalizeEmail(customer?.email);
      if (!isOwner && activeCustomerEmail) {
        try {
          await sendEmail({
            email: activeCustomerEmail,
            emailType: "ORDER_UPDATED",
            trackingId: toStringValue(order.trackingId),
            orderStatus: toStringValue(order.status),
            orderNote: customerNoteInput || toStringValue(order.customerNote),
          });
        } catch {
          // Mail is best-effort only.
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: didTransfer
          ? "Order updated and transferred successfully."
          : hasPackages
            ? "Order updated with revised package and amount details."
            : "Order details updated successfully.",
        order: {
          id: toStringValue(order._id),
          status: toStringValue(order.status),
          currentBusId: toStringValue(order.assignedBus) || toStringValue(order.bus),
          totalAmount: roundCurrency(toNumberValue(order.totalAmount)),
          totalWeightKg: roundCurrency(toNumberValue(order.totalWeightKg)),
          packageCount: Array.isArray(order.packages) ? order.packages.length : 0,
          packages: mapPackages(order.packages),
          adjustmentPendingAmount: roundCurrency(toNumberValue(order.adjustmentPendingAmount)),
          adjustmentRefundAmount: roundCurrency(toNumberValue(order.adjustmentRefundAmount)),
          adjustmentStatus: toStringValue(order.adjustmentStatus, "none"),
          senderInfo: order.senderInfo,
          receiverInfo: order.receiverInfo,
          operatorNote: toStringValue(order.operatorNote) || toStringValue(order.adminNote),
          customerNote: toStringValue(order.customerNote),
          customerEmail: activeCustomerEmail,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("Error updating order details:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
