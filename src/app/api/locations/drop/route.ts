import { NextResponse, NextRequest } from "next/server";
import { dbConnect } from "@/app/api/lib/db";
import Bus from "@/app/api/models/busModel";
import Location from "@/app/api/models/locationModel";
import mongoose from "mongoose";

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

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const pickupLocationId = searchParams.get("pickupLocationId");

    if (!pickupLocationId) {
      return NextResponse.json({ error: "pickupLocationId is required" }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(pickupLocationId)) {
      return NextResponse.json({ error: "Invalid pickupLocationId." }, { status: 400 });
    }

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

    const dropLocationIds = new Set<string>();
    for (const bus of availableBuses) {
      const pricingEntries = Array.isArray(bus.pricing) ? bus.pricing : [];
      const routePath = Array.isArray(bus.routePath) ? bus.routePath : [];
      const sortedRoutePath = [...routePath].sort(
        (left, right) => Number(left?.sequence ?? 0) - Number(right?.sequence ?? 0),
      );

      if (sortedRoutePath.length >= 2) {
        const pickupIndexes: number[] = [];
        for (let index = 0; index < sortedRoutePath.length - 1; index += 1) {
          const routePointCategory = String(sortedRoutePath[index]?.pointCategory ?? "").trim().toLowerCase();
          if (routePointCategory !== "pickup") continue;

          const routePickupId = String(sortedRoutePath[index]?.location ?? "").trim();
          if (routePickupId === pickupLocationId) {
            pickupIndexes.push(index);
          }
        }

        for (const pickupIndex of pickupIndexes) {
          for (let dropIndex = pickupIndex + 1; dropIndex < sortedRoutePath.length; dropIndex += 1) {
            const dropPointCategory = String(sortedRoutePath[dropIndex]?.pointCategory ?? "").trim().toLowerCase();
            if (dropPointCategory !== "drop") continue;

            const dropId = String(sortedRoutePath[dropIndex]?.location ?? "").trim();
            if (!dropId || dropId === pickupLocationId) continue;
            dropLocationIds.add(dropId);
          }
        }
        continue;
      }

      // Fallback for older buses without routePath.
      for (const entry of pricingEntries) {
        const pickupId = String(entry?.pickupLocation ?? "").trim();
        const dropId = String(entry?.dropLocation ?? "").trim();
        if (pickupId !== pickupLocationId || !dropId || dropId === pickupLocationId) continue;
        if (!isPricingEntryActiveOnDate(entry, today)) continue;
        dropLocationIds.add(dropId);
      }
    }

    if (dropLocationIds.size === 0) {
      return NextResponse.json([]);
    }

    const uniqueLocations = await Location.find({
      _id: { $in: Array.from(dropLocationIds) },
    }).sort({ name: 1, city: 1 });

    return NextResponse.json(uniqueLocations);

  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: "Internal Server Error", details: errorMessage }, { status: 500 });
  }
}
