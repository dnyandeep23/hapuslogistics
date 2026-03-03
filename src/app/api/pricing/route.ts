import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "../lib/db";
import { deleteCloudinaryImageByUrl, isDataImageUrl, uploadImageDataUrl } from "../lib/cloudinary";
import Coupon from "../models/couponModel";
import CouponUsage from "../models/couponUsageModel";
import Bus from "../models/busModel";
import BookingSession from "../models/bookingSessionModel";
import User from "../models/userModel";
import { cleanupExpiredBookingSessions } from "../lib/bookingSessionCleanup";
import { resolveActivePackageCatalog } from "@/app/api/lib/packageCatalog";

const PRICE_PER_KG = 2;
const HOLD_DURATION_MS = 20 * 60 * 1000;
const MAX_HOLD_TX_RETRIES = 5;
const HOLD_TX_RETRY_BASE_DELAY_MS = 40;

interface CartItem {
  packageType: string;
  packageSize: string;
  packageWeight: number;
  packageQuantities: number;
  pickUpDate?: string;
  [key: string]: unknown;
}

interface BusAvailabilitySlot {
  date: Date;
  availableCapacityKg: number;
}

interface BusPricingEntry {
  pickupLocation: mongoose.Types.ObjectId;
  dropLocation: mongoose.Types.ObjectId;
  fares: Record<string, number>;
  effectiveStartDate?: Date;
  effectiveEndDate?: Date;
  dateOverrides?: {
    date: Date;
    fares: Record<string, number>;
  }[];
}

interface BusRoutePathPoint {
  sequence?: number;
  location?: mongoose.Types.ObjectId | string;
  pointCategory?: string;
}

interface CandidateBus {
  _id: mongoose.Types.ObjectId;
  busName: string;
  availability: BusAvailabilitySlot[];
  pricing: BusPricingEntry[];
  routePath?: BusRoutePathPoint[];
}

interface EffectivePricingProfile {
  fares: Record<string, number>;
}

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const buildActiveCouponFilter = () => ({
  isActive: true,
  $or: [
    { expiryDate: { $exists: false } },
    { expiryDate: null },
    { expiryDate: { $gt: new Date() } },
  ],
});

function isRetryableTransactionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const code = (error as { code?: number }).code;
  if (code === 112) return true; // WriteConflict

  const hasErrorLabel = (error as { hasErrorLabel?: (label: string) => boolean })
    .hasErrorLabel;
  if (typeof hasErrorLabel === "function") {
    return (
      hasErrorLabel("TransientTransactionError") ||
      hasErrorLabel("UnknownTransactionCommitResult")
    );
  }

  return false;
}

function normalizeDate(dateInput: string): Date {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    throw new ApiError("Invalid pickup date format", 400);
  }
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function isSameUtcDate(first: Date, second: Date) {
  const firstDate = new Date(first);
  const secondDate = new Date(second);
  firstDate.setUTCHours(0, 0, 0, 0);
  secondDate.setUTCHours(0, 0, 0, 0);
  return firstDate.getTime() === secondDate.getTime();
}

function isPricingEntryActiveOnDate(entry: BusPricingEntry, orderDate: Date): boolean {
  if (entry.effectiveStartDate) {
    const start = new Date(entry.effectiveStartDate);
    start.setUTCHours(0, 0, 0, 0);
    if (orderDate < start) return false;
  }

  if (entry.effectiveEndDate) {
    const end = new Date(entry.effectiveEndDate);
    end.setUTCHours(0, 0, 0, 0);
    if (orderDate > end) return false;
  }

  return true;
}

function getEffectiveEntryFares(entry: BusPricingEntry, orderDate: Date): Record<string, number> {
  const override = entry.dateOverrides?.find((item) => isSameUtcDate(new Date(item.date), orderDate));
  if (!override) {
    return entry.fares;
  }
  return override.fares;
}

function resolvePointCategory(point: BusRoutePathPoint, index: number): "pickup" | "drop" {
  const raw = String(point?.pointCategory ?? "").trim().toLowerCase();
  if (raw === "pickup" || raw === "drop") return raw;
  return index === 0 ? "pickup" : "drop";
}

function getSortedRoutePath(routePath: BusRoutePathPoint[] | undefined): BusRoutePathPoint[] {
  if (!Array.isArray(routePath)) return [];
  return [...routePath].sort((left, right) => Number(left?.sequence ?? 0) - Number(right?.sequence ?? 0));
}

function getMatchingIntervals(
  routePath: BusRoutePathPoint[],
  pickupLocationId: string,
  dropLocationId: string,
): Array<{ startIndex: number; endIndex: number }> {
  const pickupIndexes: number[] = [];
  for (let index = 0; index < routePath.length - 1; index += 1) {
    const locationId = String(routePath[index]?.location ?? "");
    if (resolvePointCategory(routePath[index], index) === "pickup" && locationId === pickupLocationId) {
      pickupIndexes.push(index);
    }
  }

  const intervals: Array<{ startIndex: number; endIndex: number }> = [];
  for (const pickupIndex of pickupIndexes) {
    for (let dropIndex = pickupIndex + 1; dropIndex < routePath.length; dropIndex += 1) {
      const locationId = String(routePath[dropIndex]?.location ?? "");
      if (resolvePointCategory(routePath[dropIndex], dropIndex) === "drop" && locationId === dropLocationId) {
        intervals.push({ startIndex: pickupIndex, endIndex: dropIndex });
      }
    }
  }
  return intervals;
}

function buildProfileFromInterval(
  pricingEntries: BusPricingEntry[],
  routePath: BusRoutePathPoint[],
  interval: { startIndex: number; endIndex: number },
  orderDate: Date,
): EffectivePricingProfile | null {
  const aggregatedFares: Record<string, number> = {};

  for (let index = interval.startIndex; index < interval.endIndex; index += 1) {
    const fromLocationId = String(routePath[index]?.location ?? "");
    const toLocationId = String(routePath[index + 1]?.location ?? "");
    if (!fromLocationId || !toLocationId || fromLocationId === toLocationId) {
      return null;
    }

    const segmentEntry = pricingEntries.find(
      (entry) =>
        entry.pickupLocation.toString() === fromLocationId &&
        entry.dropLocation.toString() === toLocationId &&
        isPricingEntryActiveOnDate(entry, orderDate),
    );
    if (!segmentEntry) {
      return null;
    }

    const segmentFares = getEffectiveEntryFares(segmentEntry, orderDate);
    for (const [category, fare] of Object.entries(segmentFares ?? {})) {
      const parsedFare = Number(fare);
      if (!Number.isFinite(parsedFare)) continue;
      aggregatedFares[category] = Number((aggregatedFares[category] ?? 0) + parsedFare);
    }
  }

  if (Object.keys(aggregatedFares).length === 0) {
    return null;
  }

  return { fares: aggregatedFares };
}

function findPricingProfile(
  bus: CandidateBus,
  pickupLocationId: string,
  dropLocationId: string,
  orderDate: Date,
): EffectivePricingProfile | null {
  const routePath = getSortedRoutePath(bus.routePath);
  if (routePath.length >= 2) {
    const intervals = getMatchingIntervals(routePath, pickupLocationId, dropLocationId);
    for (const interval of intervals) {
      const profile = buildProfileFromInterval(bus.pricing, routePath, interval, orderDate);
      if (profile) {
        return profile;
      }
    }
  }

  // Fallback for older buses that only have direct pricing rows.
  const directEntry = bus.pricing.find(
    (entry) =>
      entry.pickupLocation.toString() === pickupLocationId &&
      entry.dropLocation.toString() === dropLocationId &&
      isPricingEntryActiveOnDate(entry, orderDate),
  );
  if (!directEntry) return null;
  return { fares: getEffectiveEntryFares(directEntry, orderDate) };
}

function calculateItemPrice(
  item: CartItem,
  pricingProfile: EffectivePricingProfile,
  sizeMultipliers: Record<string, number>,
): number {
  const baseFare = pricingProfile.fares[item.packageType];
  if (baseFare === undefined) {
    throw new ApiError(`Fare for package type "${item.packageType}" not found`, 400);
  }

  const sizeMultiplier = sizeMultipliers[item.packageSize];
  if (!Number.isFinite(sizeMultiplier) || sizeMultiplier <= 0) {
    throw new ApiError(`Package size "${item.packageSize}" is not supported`, 400);
  }
  return (baseFare + item.packageWeight * PRICE_PER_KG) * sizeMultiplier * item.packageQuantities;
}

function findAvailabilitySlot(bus: CandidateBus, orderDate: Date): BusAvailabilitySlot | null {
  const targetTime = orderDate.getTime();
  for (const slot of bus.availability) {
    const slotDate = new Date(slot.date);
    slotDate.setUTCHours(0, 0, 0, 0);
    if (slotDate.getTime() === targetTime) {
      return slot;
    }
  }
  return null;
}

function getUtcDayRange(date: Date) {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart, dayEnd };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function normalizeCartImageUrls(
  packageItems: CartItem[],
  uploadedImageUrls: string[],
): Promise<CartItem[]> {
  const normalizedItems: CartItem[] = [];

  for (const item of packageItems) {
    const normalizedItem: CartItem = { ...item };
    const packageImage =
      typeof normalizedItem.packageImage === "string"
        ? normalizedItem.packageImage.trim()
        : "";

    if (packageImage && isDataImageUrl(packageImage)) {
      const cloudinaryUrl = await uploadImageDataUrl(packageImage, {
        folder: "orders/packages",
      });
      uploadedImageUrls.push(cloudinaryUrl);
      normalizedItem.packageImage = cloudinaryUrl;
    }

    normalizedItems.push(normalizedItem);
  }

  return normalizedItems;
}

async function reserveBusCapacityForDay(
  tx: mongoose.ClientSession,
  busId: mongoose.Types.ObjectId,
  dayStart: Date,
  dayEnd: Date,
  requiredWeightKg: number
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
    { session: tx }
  );

  return result.modifiedCount > 0;
}

async function restoreBusCapacityForDay(
  tx: mongoose.ClientSession,
  busId: mongoose.Types.ObjectId,
  dayStart: Date,
  dayEnd: Date,
  restoreWeightKg: number
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
    { $inc: { "availability.$.availableCapacityKg": restoreWeightKg } },
    { session: tx }
  );

  return result.modifiedCount > 0;
}

export async function POST(req: NextRequest) {
  await dbConnect();
  let holdSessionId = "";
  let holdPersisted = false;
  const uploadedPackageImageUrls: string[] = [];

  try {
    const { cart, couponCode, userId, pickupLocationId, dropLocationId } = await req.json();
    const packageItemsRaw = cart as CartItem[];

    if (!packageItemsRaw || !Array.isArray(packageItemsRaw) || packageItemsRaw.length === 0) {
      throw new ApiError("Cart is empty", 400);
    }
    if (!userId || !pickupLocationId || !dropLocationId) {
      throw new ApiError("userId, pickupLocationId and dropLocationId are required", 400);
    }
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(pickupLocationId) ||
      !mongoose.Types.ObjectId.isValid(dropLocationId)
    ) {
      throw new ApiError("Invalid user or location ID format", 400);
    }
    if (pickupLocationId === dropLocationId) {
      throw new ApiError("Pickup and drop locations cannot be the same", 400);
    }

    const pickupDateRaw = packageItemsRaw[0]?.pickUpDate;
    if (!pickupDateRaw) {
      throw new ApiError("Pickup date is required", 400);
    }
    if (packageItemsRaw.some((item) => item.pickUpDate !== pickupDateRaw)) {
      throw new ApiError("All cart items must have the same pickup date", 400);
    }

    const packageCatalog = await resolveActivePackageCatalog();
    const allowedCategoryNames = new Set(
      packageCatalog.categories.map((entry) => String(entry.name).trim()).filter(Boolean),
    );
    const sizeConstraints = new Map(
      packageCatalog.sizes.map((entry) => [
        String(entry.name).trim(),
        {
          maxWeightKg: Number(entry.maxWeightKg),
          priceMultiplier: Number(entry.priceMultiplier),
        },
      ]),
    );
    const sizeMultipliers: Record<string, number> = {};
    sizeConstraints.forEach((config, sizeName) => {
      sizeMultipliers[sizeName] = Number.isFinite(config.priceMultiplier) && config.priceMultiplier > 0
        ? config.priceMultiplier
        : 1;
    });

    for (const item of packageItemsRaw) {
      if (!item.packageType || !item.packageSize) {
        throw new ApiError("Each item must include packageType and packageSize", 400);
      }
      if (!allowedCategoryNames.has(String(item.packageType))) {
        throw new ApiError(`Package type \"${item.packageType}\" is not supported`, 400);
      }
      const sizeConfig = sizeConstraints.get(String(item.packageSize));
      if (!sizeConfig) {
        throw new ApiError(`Package size \"${item.packageSize}\" is not supported`, 400);
      }
      if (typeof item.packageWeight !== "number" || item.packageWeight <= 0) {
        throw new ApiError("Each item must include positive packageWeight", 400);
      }
      if (
        Number.isFinite(sizeConfig.maxWeightKg) &&
        sizeConfig.maxWeightKg > 0 &&
        item.packageWeight > sizeConfig.maxWeightKg
      ) {
        throw new ApiError(
          `Weight for ${item.packageSize} cannot exceed ${sizeConfig.maxWeightKg} kg`,
          400,
        );
      }
      if (typeof item.packageQuantities !== "number" || item.packageQuantities <= 0) {
        throw new ApiError("Each item must include packageQuantities > 0", 400);
      }
    }

    const packageItems = await normalizeCartImageUrls(
      packageItemsRaw,
      uploadedPackageImageUrls
    );

    const user = await User.findById(userId)
      .select("_id role")
      .lean<{ _id: mongoose.Types.ObjectId; role?: string } | null>();
    if (!user) {
      throw new ApiError("User not found", 404);
    }

    const orderDate = normalizeDate(pickupDateRaw);
    const { dayStart, dayEnd } = getUtcDayRange(orderDate);
    const totalWeightKg = packageItems.reduce(
      (sum, item) => sum + item.packageWeight * item.packageQuantities,
      0
    );
    if (totalWeightKg <= 0) {
      throw new ApiError("Total package weight must be positive", 400);
    }

    // Best effort cleanup to avoid stale holds affecting capacity.
    try {
      await cleanupExpiredBookingSessions();
    } catch (cleanupError: unknown) {
      console.error("[pricing-hold] Cleanup before pricing failed:", cleanupError);
    }

    const now = new Date();
    const pickupLocationObjectId = new mongoose.Types.ObjectId(pickupLocationId);
    const dropLocationObjectId = new mongoose.Types.ObjectId(dropLocationId);
    const existingHold = await BookingSession.findOne({
      userId,
      pickupLocationId,
      dropLocationId,
      orderDate: { $gte: dayStart, $lt: dayEnd },
      status: "HOLD",
      expiresAt: { $gt: now },
    })
      .select("_id busId totalWeightKg")
      .lean<{
        _id: mongoose.Types.ObjectId;
        busId: mongoose.Types.ObjectId;
        totalWeightKg: number;
      } | null>();

    const candidateBuses = await Bus.find({
      $or: [
        {
          "routePath.location": {
            $all: [pickupLocationObjectId, dropLocationObjectId],
          },
        },
        {
          pricing: {
            $elemMatch: {
              pickupLocation: pickupLocationObjectId,
              dropLocation: dropLocationObjectId,
            },
          },
        },
      ],
      availability: {
        $elemMatch: {
          date: { $gte: dayStart, $lt: dayEnd },
        },
      },
    })
      .select("busName pricing routePath availability")
      .lean<CandidateBus[]>();

    if (!candidateBuses.length) {
      throw new ApiError("No route found for selected pickup/drop", 404);
    }

    let selectedBus: CandidateBus | null = null;
    let selectedBusPricingProfile: EffectivePricingProfile | null = null;

    for (const bus of candidateBuses) {
      const pricingProfile = findPricingProfile(bus, pickupLocationId, dropLocationId, orderDate);
      if (!pricingProfile) continue;

      const slot = findAvailabilitySlot(bus, orderDate);
      if (!slot) continue;

      const ownReservedWeight =
        existingHold && existingHold.busId.toString() === bus._id.toString()
          ? existingHold.totalWeightKg
          : 0;
      const effectiveAvailable = slot.availableCapacityKg + ownReservedWeight;

      if (effectiveAvailable >= totalWeightKg) {
        selectedBus = bus;
        selectedBusPricingProfile = pricingProfile;
        break;
      }
    }

    if (!selectedBus || !selectedBusPricingProfile) {
      throw new ApiError("No route pricing found with enough capacity for this date", 409);
    }

    const pricedItems = packageItems.map((item) => ({
      ...item,
      price: calculateItemPrice(item, selectedBusPricingProfile, sizeMultipliers),
    }));
    const subtotal = pricedItems.reduce((sum, item) => sum + item.price, 0);

    let discount = 0;
    let appliedCoupon: { code: string; discount: number; maxUsesPerUser: number; remainingUses: number } | null = null;
    if (couponCode) {
      const normalizedCoupon = String(couponCode).trim().toUpperCase();
      const coupon = await Coupon.findOne({
        ...buildActiveCouponFilter(),
        code: normalizedCoupon,
      })
        .select("_id code discount maxUsesPerUser")
        .lean<{
          _id: mongoose.Types.ObjectId;
          code: string;
          discount: number;
          maxUsesPerUser?: number;
        } | null>();

      if (coupon) {
        const maxUsesPerUser = Math.max(1, Math.floor(Number(coupon.maxUsesPerUser ?? 1)));
        let usedCount = 0;
        if (user.role === "user") {
          const couponUsage = await CouponUsage.findOne({
            couponId: coupon._id,
            userId: user._id,
          })
            .select("uses")
            .lean<{ uses?: number } | null>();
          usedCount = Number(couponUsage?.uses ?? 0);
          if (usedCount >= maxUsesPerUser) {
            throw new ApiError("Coupon usage limit reached for this account", 409);
          }
        }

        discount = (subtotal * coupon.discount) / 100;
        appliedCoupon = {
          code: coupon.code,
          discount: coupon.discount,
          maxUsesPerUser,
          remainingUses: Math.max(0, maxUsesPerUser - usedCount),
        };
      }
    }

    const total = subtotal - discount;
    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS);
    for (let attempt = 1; attempt <= MAX_HOLD_TX_RETRIES; attempt += 1) {
      const tx = await mongoose.startSession();
      try {
        tx.startTransaction();

        const activeHold = await BookingSession.findOne({
          userId,
          pickupLocationId,
          dropLocationId,
          orderDate: { $gte: dayStart, $lt: dayEnd },
          status: "HOLD",
          expiresAt: { $gt: now },
        }).session(tx);

        if (activeHold) {
          const oldBusId = activeHold.busId.toString();
          const newBusId = selectedBus._id.toString();

          if (oldBusId === newBusId) {
            const delta = totalWeightKg - activeHold.totalWeightKg;

            if (delta > 0) {
              const reserveDeltaOk = await reserveBusCapacityForDay(
                tx,
                selectedBus._id,
                dayStart,
                dayEnd,
                delta
              );

              if (!reserveDeltaOk) {
                throw new ApiError("Selected bus does not have enough remaining capacity", 409);
              }
            } else if (delta < 0) {
              const restoreDeltaOk = await restoreBusCapacityForDay(
                tx,
                selectedBus._id,
                dayStart,
                dayEnd,
                -delta
              );

              if (!restoreDeltaOk) {
                throw new ApiError("Failed to restore reduced capacity on selected bus", 500);
              }
            }
          } else {
            const restoreOldBusOk = await restoreBusCapacityForDay(
              tx,
              activeHold.busId as mongoose.Types.ObjectId,
              dayStart,
              dayEnd,
              activeHold.totalWeightKg
            );

            if (!restoreOldBusOk) {
              throw new ApiError("Failed to restore previous bus capacity", 500);
            }

            const reserveNewBusOk = await reserveBusCapacityForDay(
              tx,
              selectedBus._id,
              dayStart,
              dayEnd,
              totalWeightKg
            );

            if (!reserveNewBusOk) {
              throw new ApiError("Failed to reserve capacity on selected bus", 409);
            }
          }

          activeHold.busId = selectedBus._id;
          activeHold.packages = packageItems;
          activeHold.totalWeightKg = totalWeightKg;
          activeHold.totalAmount = total;
          activeHold.couponCode = appliedCoupon?.code ?? null;
          activeHold.couponDiscount = appliedCoupon?.discount ?? null;
          activeHold.orderDate = orderDate;
          activeHold.expiresAt = holdExpiresAt;
          activeHold.senderInfo =
            activeHold.senderInfo && typeof activeHold.senderInfo === "object"
              ? activeHold.senderInfo
              : {};
          activeHold.receiverInfo =
            activeHold.receiverInfo && typeof activeHold.receiverInfo === "object"
              ? activeHold.receiverInfo
              : {};
          activeHold.razorpayOrderId = undefined;
          activeHold.razorpayPaymentId = undefined;
          activeHold.razorpaySignature = undefined;
          activeHold.failureReason = undefined;
          await activeHold.save({ session: tx });
          holdSessionId = activeHold._id.toString();
        } else {
          const reserveOk = await reserveBusCapacityForDay(
            tx,
            selectedBus._id,
            dayStart,
            dayEnd,
            totalWeightKg
          );

          if (!reserveOk) {
            throw new ApiError("Failed to reserve capacity for hold session", 409);
          }

          const newHold = new BookingSession({
            userId,
            busId: selectedBus._id,
            pickupLocationId,
            dropLocationId,
            packages: packageItems,
            senderInfo: {},
            receiverInfo: {},
            orderDate,
            totalAmount: total,
            totalWeightKg,
            couponCode: appliedCoupon?.code ?? null,
            couponDiscount: appliedCoupon?.discount ?? null,
            status: "HOLD",
            expiresAt: holdExpiresAt,
          });

          await newHold.save({ session: tx });
          holdSessionId = newHold._id.toString();
        }

        await tx.commitTransaction();
        holdPersisted = true;
        break;
      } catch (error: unknown) {
        if (tx.inTransaction()) {
          await tx.abortTransaction();
        }

        if (isRetryableTransactionError(error) && attempt < MAX_HOLD_TX_RETRIES) {
          console.warn(
            `[pricing-hold] Write conflict, retrying transaction attempt ${attempt + 1}/${MAX_HOLD_TX_RETRIES}`
          );
          const retryDelayMs =
            HOLD_TX_RETRY_BASE_DELAY_MS * attempt + Math.floor(Math.random() * HOLD_TX_RETRY_BASE_DELAY_MS);
          await delay(retryDelayMs);
          continue;
        }

        throw error;
      } finally {
        tx.endSession();
      }
    }

    if (!holdSessionId) {
      throw new ApiError("Failed to create hold session. Please retry.", 409);
    }

    return NextResponse.json(
      {
        items: pricedItems,
        subtotal,
        discount,
        total,
        coupon: appliedCoupon,
        busId: selectedBus._id.toString(),
        orderDate: orderDate.toISOString(),
        totalWeightKg,
        sessionId: holdSessionId,
        sessionExpiresAt: holdExpiresAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (!holdPersisted && uploadedPackageImageUrls.length > 0) {
      const cleanupResults = await Promise.allSettled(
        uploadedPackageImageUrls.map((url) => deleteCloudinaryImageByUrl(url))
      );
      const cleanupFailures = cleanupResults.filter(
        (result) => result.status !== "fulfilled" || !result.value
      ).length;
      if (cleanupFailures > 0) {
        console.error(
          `[pricing-hold] Failed to cleanup ${cleanupFailures} uploaded package image(s) after error.`
        );
      }
    }

    console.error("Pricing Error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
