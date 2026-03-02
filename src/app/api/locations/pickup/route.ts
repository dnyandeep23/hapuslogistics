import { NextResponse } from "next/server";
import { dbConnect } from "@/app/api/lib/db";
import Bus from "@/app/api/models/busModel";
import Location from "@/app/api/models/locationModel";

type PricingEntry = {
  pickupLocation?: unknown;
  dropLocation?: unknown;
  effectiveStartDate?: string | Date;
  effectiveEndDate?: string | Date;
};

type RoutePathPoint = {
  sequence?: number;
  location?: unknown;
  pointCategory?: unknown;
};

const isPricingEntryActiveOnDate = (entry: PricingEntry, date: Date) => {
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

export async function GET() {
  try {
    await dbConnect();

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const availableBuses = await Bus.find({
      availability: {
        $elemMatch: {
          date: { $gte: today },
          availableCapacityKg: { $gt: 0 },
        },
      },
    })
      .select("pricing routePath")
      .lean<Array<{ pricing?: PricingEntry[]; routePath?: RoutePathPoint[] }>>();

    if (!availableBuses.length) {
      return NextResponse.json([]);
    }

    const pickupLocationIds = new Set<string>();

    for (const bus of availableBuses) {
      const pricingEntries = Array.isArray(bus.pricing) ? bus.pricing : [];
      const routePath = Array.isArray(bus.routePath) ? bus.routePath : [];
      const sortedRoutePath = [...routePath].sort(
        (left, right) => Number(left?.sequence ?? 0) - Number(right?.sequence ?? 0),
      );

      if (sortedRoutePath.length >= 2) {
        for (let pickupIndex = 0; pickupIndex < sortedRoutePath.length - 1; pickupIndex += 1) {
          const pointCategory = String(sortedRoutePath[pickupIndex]?.pointCategory ?? "").trim().toLowerCase();
          if (pointCategory !== "pickup") continue;

          const pickupLocationId = String(sortedRoutePath[pickupIndex]?.location ?? "").trim();
          if (!pickupLocationId) continue;

          let hasDownstreamPoint = false;
          for (let dropIndex = pickupIndex + 1; dropIndex < sortedRoutePath.length; dropIndex += 1) {
            const dropPointCategory = String(sortedRoutePath[dropIndex]?.pointCategory ?? "").trim().toLowerCase();
            if (dropPointCategory !== "drop") continue;

            const dropLocationId = String(sortedRoutePath[dropIndex]?.location ?? "").trim();
            if (!dropLocationId || dropLocationId === pickupLocationId) continue;
            hasDownstreamPoint = true;
            break;
          }

          if (hasDownstreamPoint) {
            pickupLocationIds.add(pickupLocationId);
          }
        }
        continue;
      }

      // Fallback for older buses that do not have routePath yet.
      for (const entry of pricingEntries) {
        const pickupLocationId = String(entry?.pickupLocation ?? "").trim();
        const dropLocationId = String(entry?.dropLocation ?? "").trim();
        if (!pickupLocationId || !dropLocationId || pickupLocationId === dropLocationId) continue;
        if (!isPricingEntryActiveOnDate(entry, today)) continue;

        pickupLocationIds.add(pickupLocationId);
      }
    }

    if (pickupLocationIds.size === 0) {
      return NextResponse.json([]);
    }

    const uniqueLocations = await Location.find({
      _id: { $in: Array.from(pickupLocationIds) },
    }).sort({ name: 1, city: 1 });

    return NextResponse.json(uniqueLocations);
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: "Internal Server Error", details: errorMessage }, { status: 500 });
  }
}
