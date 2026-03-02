import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/app/api/lib/db";
import Order from "@/app/api/models/orderModel";
import Bus from "@/app/api/models/busModel";
import mongoose from "mongoose";

dbConnect();

const extractLocationId = (location: unknown): string => {
  if (!location || typeof location !== "object") return "";
  const candidate = (location as { _id?: unknown })._id;
  if (!candidate) return "";
  return String(candidate);
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

const isPricingEntryActiveOnDate = (entry: BusPricingEntry, date: Date) => {
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

const resolvePointCategory = (point: BusRoutePathPoint, index: number): "pickup" | "drop" => {
  const raw = String(point?.pointCategory ?? "").trim().toLowerCase();
  if (raw === "pickup" || raw === "drop") return raw;
  return index === 0 ? "pickup" : "drop";
};

const busSupportsRouteOnDate = (
  pricingEntries: BusPricingEntry[],
  routePath: BusRoutePathPoint[],
  pickupLocationId: string,
  dropLocationId: string,
  date: Date,
) => {
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

  // Fallback for older buses with direct pricing rows.
  return pricingEntries.some(
    (entry) =>
      String(entry?.pickupLocation ?? "") === pickupLocationId &&
      String(entry?.dropLocation ?? "") === dropLocationId &&
      isPricingEntryActiveOnDate(entry, date),
  );
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await context.params;
    const { busId } = await request.json();

    if (!busId) {
      return NextResponse.json({ error: "busId is required" }, { status: 400 });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.status !== 'pending') {
      return NextResponse.json({ error: "Order has already been processed" }, { status: 400 });
    }

    const pickupLocationId = extractLocationId(order.pickupLocation);
    const dropLocationId = extractLocationId(order.dropLocation);

    const candidateBusIds = Array.isArray(order.candidateRoutes)
      ? order.candidateRoutes.map((id: unknown) => String(id))
      : [];

    let isCandidate = candidateBusIds.some((candidateId: string) => candidateId === String(busId));

    if (
      !isCandidate &&
      pickupLocationId &&
      dropLocationId &&
      mongoose.Types.ObjectId.isValid(pickupLocationId) &&
      mongoose.Types.ObjectId.isValid(dropLocationId)
    ) {
      const orderDate = new Date(order.orderDate);
      orderDate.setUTCHours(0, 0, 0, 0);

      const supportedBus = await Bus.findOne({ _id: busId })
        .select("pricing routePath")
        .lean<{ pricing?: BusPricingEntry[]; routePath?: BusRoutePathPoint[] } | null>();

      if (supportedBus) {
        const pricingEntries = Array.isArray(supportedBus.pricing) ? supportedBus.pricing : [];
        const routePath = Array.isArray(supportedBus.routePath) ? supportedBus.routePath : [];
        isCandidate = busSupportsRouteOnDate(
          pricingEntries,
          routePath,
          pickupLocationId,
          dropLocationId,
          orderDate,
        );
      }
    }

    if (!isCandidate) {
      return NextResponse.json({ error: "Provided busId is not a candidate for this order" }, { status: 400 });
    }

    // Normalize date to midnight UTC for matching, as time is irrelevant for daily availability
    const orderDateStart = new Date(order.orderDate);
    orderDateStart.setUTCHours(0, 0, 0, 0);

    // Atomically find the bus and update the availability for the specific date if capacity is sufficient
    const updatedBus = await Bus.findOneAndUpdate(
      {
        _id: busId,
        "availability": {
          $elemMatch: {
            "date": orderDateStart,
            "availableCapacityKg": { $gte: order.totalWeightKg }
          }
        }
      },
      {
        // Use the positional '$' operator to update the matched array element
        $inc: { "availability.$.availableCapacityKg": -order.totalWeightKg }
      },
      { new: true } // Return the updated document
    );

    if (!updatedBus) {
      return NextResponse.json({ error: "Failed to allocate. Bus may not have availability on this date or capacity is insufficient." }, { status: 409 });
    }

    // If capacity update was successful, assign bus to the order
    order.assignedBus = busId;
    order.status = "allocated";
    await order.save();

    return NextResponse.json(order, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
