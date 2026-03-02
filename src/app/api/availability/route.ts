import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/app/api/lib/db";
import Bus from "@/app/api/models/busModel";
import mongoose from "mongoose";

type BusAvailabilitySlot = {
  date?: string | Date;
  availableCapacityKg?: number;
};

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

const isPricingActiveOnDate = (entry: BusPricingEntry, date: Date) => {
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
};

const hasActivePricingPairOnDate = (
  entries: BusPricingEntry[],
  pickupLocationId: string,
  dropLocationId: string,
  date: Date,
) => {
  return entries.some(
    (entry) =>
      String(entry?.pickupLocation ?? "") === pickupLocationId &&
      String(entry?.dropLocation ?? "") === dropLocationId &&
      isPricingActiveOnDate(entry, date),
  );
};

const resolvePointCategory = (point: BusRoutePathPoint, index: number) => {
  const raw = String(point?.pointCategory ?? "").trim().toLowerCase();
  if (raw === "pickup" || raw === "drop") return raw;
  return index === 0 ? "pickup" : "drop";
};

const getRoutePathIntervals = (
  routePath: BusRoutePathPoint[],
  pickupLocationId: string,
  dropLocationId: string,
) => {
  const pickupIndexes: number[] = [];
  for (let index = 0; index < routePath.length - 1; index += 1) {
    const pointCategory = resolvePointCategory(routePath[index], index);
    const locationId = String(routePath[index]?.location ?? "").trim();
    if (pointCategory === "pickup" && locationId === pickupLocationId) {
      pickupIndexes.push(index);
    }
  }

  const intervals: Array<{ startIndex: number; endIndex: number }> = [];
  for (const pickupIndex of pickupIndexes) {
    for (let dropIndex = pickupIndex + 1; dropIndex < routePath.length; dropIndex += 1) {
      const pointCategory = resolvePointCategory(routePath[dropIndex], dropIndex);
      const locationId = String(routePath[dropIndex]?.location ?? "").trim();
      if (pointCategory === "drop" && locationId === dropLocationId) {
        intervals.push({ startIndex: pickupIndex, endIndex: dropIndex });
      }
    }
  }

  return intervals;
};

const hasActivePathPricingOnDate = (
  pricingEntries: BusPricingEntry[],
  routePath: BusRoutePathPoint[],
  startIndex: number,
  endIndex: number,
  date: Date,
) => {
  if (startIndex < 0 || endIndex <= startIndex || endIndex >= routePath.length) return false;

  for (let index = startIndex; index < endIndex; index += 1) {
    const fromLocationId = String(routePath[index]?.location ?? "").trim();
    const toLocationId = String(routePath[index + 1]?.location ?? "").trim();
    if (!fromLocationId || !toLocationId || fromLocationId === toLocationId) return false;

    const hasSegmentPricing = hasActivePricingPairOnDate(
      pricingEntries,
      fromLocationId,
      toLocationId,
      date,
    );
    if (!hasSegmentPricing) return false;
  }

  return true;
};

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const pickupLocationId = searchParams.get("pickupLocationId");
    const dropLocationId = searchParams.get("dropLocationId");
    const userTimestamp = searchParams.get("userTimestamp");

    if (!pickupLocationId || !dropLocationId || !userTimestamp) {
      return NextResponse.json(
        { message: "pickupLocationId, dropLocationId and userTimestamp are required" },
        { status: 400 },
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(pickupLocationId) ||
      !mongoose.Types.ObjectId.isValid(dropLocationId)
    ) {
      return NextResponse.json({ message: "Invalid pickup/drop location id." }, { status: 400 });
    }

    const userDate = new Date(userTimestamp);
    if (Number.isNaN(userDate.getTime())) {
      return NextResponse.json({ message: "Invalid userTimestamp format" }, { status: 400 });
    }

    userDate.setUTCHours(0, 0, 0, 0);

    const buses = await Bus.find({
      availability: {
        $elemMatch: {
          date: { $gte: userDate },
          availableCapacityKg: { $gt: 0 },
        },
      },
    })
      .select("availability pricing routePath")
      .lean<Array<{ availability?: BusAvailabilitySlot[]; pricing?: BusPricingEntry[]; routePath?: BusRoutePathPoint[] }>>();

    if (!buses.length) {
      return NextResponse.json([]);
    }

    const availableDates = new Set<string>();

    for (const bus of buses) {
      const pricingEntries = Array.isArray(bus.pricing) ? bus.pricing : [];
      const routePath = Array.isArray(bus.routePath)
        ? [...bus.routePath].sort((left, right) => Number(left?.sequence ?? 0) - Number(right?.sequence ?? 0))
        : [];
      const matchingIntervals =
        routePath.length >= 2
          ? getRoutePathIntervals(routePath, pickupLocationId, dropLocationId)
          : [];

      for (const slot of bus.availability ?? []) {
        const slotDate = new Date(slot?.date ?? "");
        slotDate.setUTCHours(0, 0, 0, 0);
        if (Number.isNaN(slotDate.getTime()) || slotDate < userDate) continue;
        if (Number(slot?.availableCapacityKg ?? 0) <= 0) continue;

        let hasActiveRoutePricing = false;
        if (matchingIntervals.length > 0) {
          hasActiveRoutePricing = matchingIntervals.some((interval) =>
            hasActivePathPricingOnDate(
              pricingEntries,
              routePath,
              interval.startIndex,
              interval.endIndex,
              slotDate,
            ),
          );
        } else {
          // Fallback for older buses that only have direct pricing rows.
          hasActiveRoutePricing = hasActivePricingPairOnDate(
            pricingEntries,
            pickupLocationId,
            dropLocationId,
            slotDate,
          );
        }

        if (!hasActiveRoutePricing) continue;

        availableDates.add(slotDate.toISOString().split("T")[0]);
      }
    }

    return NextResponse.json(Array.from(availableDates).sort());
  } catch {
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
