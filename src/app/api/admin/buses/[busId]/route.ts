import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import {
  deleteCloudinaryImageByUrl,
  isCloudinaryImageUrl,
  uploadImageFile,
} from "@/app/api/lib/cloudinary";
import User from "@/app/api/models/userModel";
import Bus from "@/app/api/models/busModel";
import Order from "@/app/api/models/orderModel";
import Location from "@/app/api/models/locationModel";

const JWT_SECRET = process.env.JWT_SECRET!;
const BUS_NUMBER_PATTERN = /^[A-Z]{2}-\d{2}-[A-Z]{2}-\d{4}$/;

type RouteConfigInput = {
  pickupLocationId: string;
  dropLocationId: string;
  distanceKm: number;
  pickupTime: string;
  dropTime: string;
  materialFares: Record<string, number>;
  dateOverrides: {
    date: string;
    fares: Record<string, number>;
  }[];
};

type RoutePointInput = {
  locationId: string;
  pointCategory: "pickup" | "drop";
  pointTime: string;
  distanceToNextKm: number;
  durationToNextMinutes: number;
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

type BlockingOrderDoc = {
  _id: mongoose.Types.ObjectId;
  trackingId?: string;
  status?: string;
  orderDate: Date;
  totalWeightKg?: number;
  assignedBus?: mongoose.Types.ObjectId | null;
  bus?: mongoose.Types.ObjectId | null;
  pickupLocation?: unknown;
  dropLocation?: unknown;
  senderInfo?: Record<string, unknown>;
};

const ACTIVE_ORDER_STATUSES = ["pending", "confirmed", "allocated", "in-transit"] as const;

const toStringValue = (value: unknown, fallback = ""): string => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
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

const getUtcDayRange = (date: Date) => {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return { dayStart, dayEnd };
};

const extractLocationId = (location: unknown): string => {
  if (!location || typeof location !== "object") return "";
  const candidate = (location as { _id?: unknown })._id;
  if (!candidate) return "";
  return String(candidate);
};

const reserveBusCapacityForDay = async (
  tx: mongoose.ClientSession,
  busId: mongoose.Types.ObjectId,
  dayStart: Date,
  dayEnd: Date,
  requiredWeightKg: number,
) => {
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
};

const pickSenderName = (senderInfo: Record<string, unknown> | undefined) =>
  toStringValue(senderInfo?.name) ||
  toStringValue(senderInfo?.fullName) ||
  toStringValue(senderInfo?.senderName);

const pickSenderContact = (senderInfo: Record<string, unknown> | undefined) =>
  toStringValue(senderInfo?.contact) ||
  toStringValue(senderInfo?.phone) ||
  toStringValue(senderInfo?.phoneNumber) ||
  toStringValue(senderInfo?.mobile) ||
  toStringValue(senderInfo?.contactNumber);

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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

const normalizeRoutePoints = (
  routePointsConfigRaw: string,
  routes: RouteConfigInput[],
): { routePoints?: RoutePointInput[]; error?: string } => {
  const defaultPoints: RoutePointInput[] = [];
  if (routes.length > 0) {
    defaultPoints.push({
      locationId: routes[0].pickupLocationId,
      pointCategory: "pickup",
      pointTime: routes[0].pickupTime,
      distanceToNextKm: Number(routes[0].distanceKm.toFixed(2)),
      durationToNextMinutes: 0,
    });

    for (let index = 0; index < routes.length; index += 1) {
      const route = routes[index];
      if (index > 0) {
        defaultPoints[index - 1].distanceToNextKm = Number(routes[index - 1].distanceKm.toFixed(2));
      }

      defaultPoints.push({
        locationId: route.dropLocationId,
        pointCategory: "drop",
        pointTime: route.dropTime,
        distanceToNextKm: index < routes.length - 1 ? Number(routes[index + 1].distanceKm.toFixed(2)) : 0,
        durationToNextMinutes: 0,
      });
    }
  }

  if (!routePointsConfigRaw) {
    return { routePoints: defaultPoints };
  }

  let parsedRoutePoints: unknown;
  try {
    parsedRoutePoints = JSON.parse(routePointsConfigRaw);
  } catch {
    return { error: "Invalid route points configuration." };
  }

  if (!Array.isArray(parsedRoutePoints) || parsedRoutePoints.length === 0) {
    return { routePoints: defaultPoints };
  }

  if (parsedRoutePoints.length !== routes.length + 1) {
    return { error: "Route points must contain all points in sequence from first pickup to final drop." };
  }

  const normalizedPoints: RoutePointInput[] = [];
  for (let index = 0; index < parsedRoutePoints.length; index += 1) {
    const current = parsedRoutePoints[index];
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return { error: `Route point ${index + 1} is invalid.` };
    }

    const point = current as Record<string, unknown>;
    const locationId = String(point.locationId ?? "").trim();
    if (!locationId || !mongoose.Types.ObjectId.isValid(locationId)) {
      return { error: `Route point ${index + 1}: invalid location.` };
    }

    const pointCategoryCandidate = String(point.pointCategory ?? "").trim().toLowerCase();
    const pointCategory = pointCategoryCandidate === "pickup" || pointCategoryCandidate === "drop"
      ? (pointCategoryCandidate as "pickup" | "drop")
      : index === 0
      ? "pickup"
      : "drop";

    const pointTime = String(point.pointTime ?? "").trim();
    if (!pointTime) {
      return { error: `Route point ${index + 1}: point time is required.` };
    }

    const fallbackDistance = index < routes.length ? Number(routes[index].distanceKm ?? 0) : 0;
    const distanceToNextKm = Number(point.distanceToNextKm ?? fallbackDistance);
    if (!Number.isFinite(distanceToNextKm) || distanceToNextKm < 0) {
      return { error: `Route point ${index + 1}: distance to next point must be 0 or greater.` };
    }

    const durationToNextMinutes = Number(point.durationToNextMinutes ?? 0);
    if (!Number.isFinite(durationToNextMinutes) || durationToNextMinutes < 0) {
      return { error: `Route point ${index + 1}: duration to next point must be 0 or greater.` };
    }

    normalizedPoints.push({
      locationId,
      pointCategory,
      pointTime,
      distanceToNextKm: Number(distanceToNextKm.toFixed(2)),
      durationToNextMinutes: Number(durationToNextMinutes.toFixed(1)),
    });
  }

  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const route = routes[routeIndex];
    const fromPoint = normalizedPoints[routeIndex];
    const toPoint = normalizedPoints[routeIndex + 1];
    if (fromPoint.locationId !== route.pickupLocationId || toPoint.locationId !== route.dropLocationId) {
      return { error: `Route points sequence does not match route segment ${routeIndex + 1}.` };
    }
    fromPoint.distanceToNextKm = Number(route.distanceKm.toFixed(2));
  }

  const lastPoint = normalizedPoints[normalizedPoints.length - 1];
  if (lastPoint) {
    lastPoint.distanceToNextKm = 0;
    lastPoint.durationToNextMinutes = 0;
  }

  return { routePoints: normalizedPoints };
};

const parseRoutes = (routesConfigRaw: string) => {
  let parsedRoutes: unknown;
  try {
    parsedRoutes = JSON.parse(routesConfigRaw || "[]");
  } catch {
    return { error: "Invalid route configuration." };
  }

  if (!Array.isArray(parsedRoutes) || parsedRoutes.length === 0) {
    return { error: "At least one pickup/drop point is required." };
  }

  const normalizedRoutes: RouteConfigInput[] = [];
  for (let index = 0; index < parsedRoutes.length; index += 1) {
    const current = parsedRoutes[index];
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return { error: `Route ${index + 1} is invalid.` };
    }

    const route = current as Record<string, unknown>;
    const pickupLocationId = String(route.pickupLocationId ?? "").trim();
    const dropLocationId = String(route.dropLocationId ?? "").trim();
    const distanceKm = Number(route.distanceKm ?? route.km ?? 0);
    const pickupTime = String(route.pickupTime ?? "").trim();
    const dropTime = String(route.dropTime ?? "").trim();

    if (!pickupLocationId || !dropLocationId || !pickupTime || !dropTime) {
      return { error: `Route ${index + 1}: pickup, drop, pickup time and drop time are required.` };
    }
    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
      return { error: `Route ${index + 1}: distance in KM must be 0 or greater.` };
    }

    if (
      !mongoose.Types.ObjectId.isValid(pickupLocationId) ||
      !mongoose.Types.ObjectId.isValid(dropLocationId)
    ) {
      return { error: `Route ${index + 1}: invalid pickup/drop location.` };
    }

    if (pickupLocationId === dropLocationId) {
      return { error: `Route ${index + 1}: pickup and drop must be different.` };
    }

    const faresCandidate = route.materialFares;
    if (!faresCandidate || typeof faresCandidate !== "object" || Array.isArray(faresCandidate)) {
      return { error: `Route ${index + 1}: material prices are required.` };
    }

    const materialFares = Object.entries(faresCandidate as Record<string, unknown>).reduce<
      Record<string, number>
    >((acc, [key, value]) => {
      const parsedValue = Number(value);
      if (!Number.isNaN(parsedValue) && parsedValue >= 0) {
        acc[key] = parsedValue;
      }
      return acc;
    }, {});

    if (Object.values(materialFares).every((fare) => fare <= 0)) {
      return { error: `Route ${index + 1}: add at least one valid price.` };
    }

    const overridesCandidate = Array.isArray(route.dateOverrides) ? route.dateOverrides : [];
    const dateOverrides: { date: string; fares: Record<string, number> }[] = [];

    for (let overrideIndex = 0; overrideIndex < overridesCandidate.length; overrideIndex += 1) {
      const override = overridesCandidate[overrideIndex];
      if (!override || typeof override !== "object" || Array.isArray(override)) {
        return { error: `Route ${index + 1}: invalid override at row ${overrideIndex + 1}.` };
      }

      const overrideRecord = override as Record<string, unknown>;
      const overrideDate = String(overrideRecord.date ?? "").trim();
      const parsedOverrideDate = new Date(overrideDate);
      if (!overrideDate || Number.isNaN(parsedOverrideDate.getTime())) {
        return { error: `Route ${index + 1}: valid override date is required.` };
      }

      const overrideFaresCandidate = overrideRecord.fares;
      if (
        !overrideFaresCandidate ||
        typeof overrideFaresCandidate !== "object" ||
        Array.isArray(overrideFaresCandidate)
      ) {
        return { error: `Route ${index + 1}: invalid override fares.` };
      }

      const overrideFares = Object.entries(overrideFaresCandidate as Record<string, unknown>).reduce<
        Record<string, number>
      >((acc, [key, value]) => {
        const parsedValue = Number(value);
        if (!Number.isNaN(parsedValue) && parsedValue >= 0) {
          acc[key] = parsedValue;
        }
        return acc;
      }, {});

      if (Object.values(overrideFares).every((fare) => fare <= 0)) {
        return { error: `Route ${index + 1}: override requires at least one valid price.` };
      }

      dateOverrides.push({
        date: overrideDate,
        fares: overrideFares,
      });
    }

    normalizedRoutes.push({
      pickupLocationId,
      dropLocationId,
      distanceKm,
      pickupTime,
      dropTime,
      materialFares,
      dateOverrides,
    });
  }

  return { routes: normalizedRoutes };
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ busId: string }> },
) {
  let newlyUploadedBusImageUrl: string | null = null;
  let replacedBusImageUrl: string | null = null;
  let busSaved = false;
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(userId).select("role isSuperAdmin travelCompanyId buses");
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      return NextResponse.json({ success: false, message: "Admin access required." }, { status: 403 });
    }

    const { busId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return NextResponse.json({ success: false, message: "Invalid bus id." }, { status: 400 });
    }

    const bus = await Bus.findById(busId);
    if (!bus) {
      return NextResponse.json({ success: false, message: "Bus not found." }, { status: 404 });
    }

    if (
      !user.isSuperAdmin &&
      String(bus.travelCompanyId ?? "") !== String(user.travelCompanyId ?? "")
    ) {
      const canAccessByBusList = Array.isArray(user.buses)
        ? user.buses.some((id: unknown) => String(id) === busId)
        : false;

      if (!canAccessByBusList) {
        return NextResponse.json(
          { success: false, message: "You can edit only your company buses." },
          { status: 403 },
        );
      }
    }

    const formData = await request.formData();

    const busName = String(formData.get("busName") ?? "").trim();
    const busNumber = String(formData.get("busNumber") ?? "")
      .trim()
      .toUpperCase();
    const rawCapacity = Number(formData.get("capacity") ?? 0);
    const autoRenewCapacity = String(formData.get("autoRenewCapacity") ?? "").trim() === "true";
    const availabilityStartDateRaw = String(
      formData.get("availabilityStartDate") ?? formData.get("availabilityDate") ?? "",
    ).trim();
    const availabilityEndDateRaw = String(
      formData.get("availabilityEndDate") ?? formData.get("availabilityDate") ?? "",
    ).trim();
    const routesConfigRaw = String(
      formData.get("routePairsConfig") ?? formData.get("routesConfig") ?? "",
    ).trim();
    const routePointsConfigRaw = String(formData.get("routePointsConfig") ?? "").trim();

    if (!busName || !busNumber || rawCapacity <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Bus name, bus number and valid capacity are required.",
        },
        { status: 400 },
      );
    }

    if (!BUS_NUMBER_PATTERN.test(busNumber)) {
      return NextResponse.json(
        {
          success: false,
          message: "Bus number format must be like MH-02-BL-2254.",
        },
        { status: 400 },
      );
    }

    if (!availabilityStartDateRaw || !availabilityEndDateRaw) {
      return NextResponse.json(
        {
          success: false,
          message: "Availability start and end date are required.",
        },
        { status: 400 },
      );
    }

    const availabilityStartDate = new Date(availabilityStartDateRaw);
    const availabilityEndDate = new Date(availabilityEndDateRaw);
    if (
      Number.isNaN(availabilityStartDate.getTime()) ||
      Number.isNaN(availabilityEndDate.getTime())
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid availability date range." },
        { status: 400 },
      );
    }
    availabilityStartDate.setUTCHours(0, 0, 0, 0);
    availabilityEndDate.setUTCHours(0, 0, 0, 0);

    if (availabilityEndDate < availabilityStartDate) {
      return NextResponse.json(
        { success: false, message: "Availability end date cannot be before start date." },
        { status: 400 },
      );
    }

    const availabilitySlots: { date: Date; totalCapacityKg: number; availableCapacityKg: number }[] = [];
    const cursorDate = new Date(availabilityStartDate);
    while (cursorDate <= availabilityEndDate) {
      availabilitySlots.push({
        date: new Date(cursorDate),
        totalCapacityKg: rawCapacity,
        availableCapacityKg: rawCapacity,
      });
      cursorDate.setUTCDate(cursorDate.getUTCDate() + 1);
      if (availabilitySlots.length > 370) {
        return NextResponse.json(
          { success: false, message: "Availability range is too large. Keep it under 12 months." },
          { status: 400 },
        );
      }
    }

    const parsedRoutesResult = parseRoutes(routesConfigRaw);
    if (parsedRoutesResult.error || !parsedRoutesResult.routes) {
      return NextResponse.json(
        { success: false, message: parsedRoutesResult.error || "Invalid route configuration." },
        { status: 400 },
      );
    }

    const normalizedRoutes = parsedRoutesResult.routes;
    const routePointsResult = normalizeRoutePoints(routePointsConfigRaw, normalizedRoutes);
    if (routePointsResult.error || !routePointsResult.routePoints) {
      return NextResponse.json(
        { success: false, message: routePointsResult.error || "Invalid route points configuration." },
        { status: 400 },
      );
    }
    const normalizedRoutePoints = routePointsResult.routePoints;

    const routeSummaryDistanceKm = Number(
      normalizedRoutePoints.reduce((sum, point) => sum + Number(point.distanceToNextKm || 0), 0).toFixed(2),
    );
    const routeSummaryDurationMinutes = Number(
      normalizedRoutePoints.reduce((sum, point) => sum + Number(point.durationToNextMinutes || 0), 0).toFixed(1),
    );

    const normalizedRoutesWithOverrides: Array<
      Omit<RouteConfigInput, "dateOverrides"> & {
        dateOverrides: { date: Date; fares: Record<string, number> }[];
      }
    > = [];

    for (let routeIndex = 0; routeIndex < normalizedRoutes.length; routeIndex += 1) {
      const route = normalizedRoutes[routeIndex];
      const dateOverrides: { date: Date; fares: Record<string, number> }[] = [];

      for (const override of route.dateOverrides) {
        const overrideDate = new Date(override.date);
        overrideDate.setUTCHours(0, 0, 0, 0);
        if (overrideDate < availabilityStartDate || overrideDate > availabilityEndDate) {
          return NextResponse.json(
            {
              success: false,
              message: `Route ${routeIndex + 1}: override date must be within selected availability range.`,
            },
            { status: 400 },
          );
        }
        dateOverrides.push({
          date: overrideDate,
          fares: override.fares,
        });
      }

      normalizedRoutesWithOverrides.push({
        ...route,
        dateOverrides,
      });
    }

    const locationIds = Array.from(
      new Set([
        ...normalizedRoutes.flatMap((route) => [route.pickupLocationId, route.dropLocationId]),
        ...normalizedRoutePoints.map((point) => point.locationId),
      ]),
    ).map((id) => new mongoose.Types.ObjectId(id));

    const locationDocs = await Location.find({ _id: { $in: locationIds } }).select("_id").lean();

    if (locationDocs.length !== locationIds.length) {
      return NextResponse.json(
        { success: false, message: "One or more selected locations were not found." },
        { status: 404 },
      );
    }

    const uploadedFiles = formData
      .getAll("busImages")
      .filter((file): file is File => file instanceof File && file.size > 0);

    if (uploadedFiles.length > 1) {
      return NextResponse.json(
        { success: false, message: "Only one bus image can be uploaded." },
        { status: 400 },
      );
    }

    if (uploadedFiles.length > 0) {
      const file = uploadedFiles[0];
      newlyUploadedBusImageUrl = await uploadImageFile(file, { folder: "buses" });
      if (Array.isArray(bus.busImages) && bus.busImages.length > 0) {
        replacedBusImageUrl = String(bus.busImages[0] ?? "");
      }
      bus.busImages = [newlyUploadedBusImageUrl];
    } else if (Array.isArray(bus.busImages) && bus.busImages.length > 1) {
      bus.busImages = [bus.busImages[0]];
    }

    if (!Array.isArray(bus.busImages) || bus.busImages.length === 0) {
      return NextResponse.json(
        { success: false, message: "Upload one bus image." },
        { status: 400 },
      );
    }

    bus.busName = busName;
    bus.busNumber = busNumber;
    bus.capacity = rawCapacity;
    bus.autoRenewCapacity = autoRenewCapacity;
    bus.availability = availabilitySlots;
    bus.routePath = normalizedRoutePoints.map((point, index) => ({
      sequence: index + 1,
      location: new mongoose.Types.ObjectId(point.locationId),
      pointCategory: point.pointCategory,
      pointTime: point.pointTime,
      distanceToNextKm: point.distanceToNextKm,
      durationToNextMinutes: point.durationToNextMinutes,
    }));
    bus.routeSummary = {
      totalDistanceKm: routeSummaryDistanceKm,
      totalDurationMinutes: routeSummaryDurationMinutes,
    };
    bus.pricing = normalizedRoutesWithOverrides.map((route, index) => ({
      sequence: index + 1,
      pickupLocation: new mongoose.Types.ObjectId(route.pickupLocationId),
      dropLocation: new mongoose.Types.ObjectId(route.dropLocationId),
      distanceKm: route.distanceKm,
      effectiveStartDate: availabilityStartDate,
      effectiveEndDate: availabilityEndDate,
      pickupTime: route.pickupTime,
      dropTime: route.dropTime,
      fares: route.materialFares,
      dateOverrides: route.dateOverrides,
    }));

    await bus.save();
    busSaved = true;

    if (
      replacedBusImageUrl &&
      replacedBusImageUrl !== newlyUploadedBusImageUrl &&
      isCloudinaryImageUrl(replacedBusImageUrl)
    ) {
      const deleted = await deleteCloudinaryImageByUrl(replacedBusImageUrl);
      if (!deleted) {
        console.error("[bus-image] Failed to delete replaced Cloudinary image:", replacedBusImageUrl);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Bus updated successfully.",
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (!busSaved && newlyUploadedBusImageUrl) {
      const deleted = await deleteCloudinaryImageByUrl(newlyUploadedBusImageUrl);
      if (!deleted) {
        console.error("[bus-image] Failed to cleanup newly uploaded image after update failure.");
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to update bus.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ busId: string }> },
) {
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(userId).select("role isSuperAdmin travelCompanyId buses");
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      return NextResponse.json({ success: false, message: "Admin access required." }, { status: 403 });
    }

    const { busId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return NextResponse.json({ success: false, message: "Invalid bus id." }, { status: 400 });
    }

    const bus = await Bus.findById(busId);
    if (!bus) {
      return NextResponse.json({ success: false, message: "Bus not found." }, { status: 404 });
    }

    if (
      !user.isSuperAdmin &&
      String(bus.travelCompanyId ?? "") !== String(user.travelCompanyId ?? "")
    ) {
      const canAccessByBusList = Array.isArray(user.buses)
        ? user.buses.some((id: unknown) => String(id) === busId)
        : false;

      if (!canAccessByBusList) {
        return NextResponse.json(
          { success: false, message: "You can delete only your company buses." },
          { status: 403 },
        );
      }
    }

    const body = (await request.json().catch(() => ({}))) as { replacementBusId?: unknown };
    const replacementBusId = toStringValue(body?.replacementBusId);
    const replacementBusObjectId =
      replacementBusId && mongoose.Types.ObjectId.isValid(replacementBusId)
        ? new mongoose.Types.ObjectId(replacementBusId)
        : null;

    const rawBlockingOrders = await Order.find({
      status: { $in: [...ACTIVE_ORDER_STATUSES] },
      $or: [{ assignedBus: bus._id }, { bus: bus._id }],
    })
      .select("_id trackingId status orderDate totalWeightKg assignedBus bus pickupLocation dropLocation senderInfo")
      .lean<BlockingOrderDoc[]>();

    const blockingOrders = rawBlockingOrders.filter((order) => {
      const effectiveBusId = toStringValue(order.assignedBus) || toStringValue(order.bus);
      return effectiveBusId === busId;
    });

    const replacementBusCandidates = await Bus.find({
      _id: { $ne: bus._id },
      travelCompanyId: bus.travelCompanyId,
    })
      .select("_id busName busNumber")
      .sort({ busName: 1, busNumber: 1 })
      .lean<Array<{ _id: mongoose.Types.ObjectId; busName?: string; busNumber?: string }>>();

    const mappedBlockingOrders = blockingOrders.map((order) => ({
      id: toStringValue(order._id),
      trackingId: toStringValue(order.trackingId),
      status: toStringValue(order.status, "pending"),
      orderDate: order.orderDate ? new Date(order.orderDate).toISOString() : "",
      senderName: pickSenderName(order.senderInfo),
      senderContact: pickSenderContact(order.senderInfo),
    }));

    if (blockingOrders.length > 0 && !replacementBusObjectId) {
      return NextResponse.json(
        {
          success: false,
          requiresReschedule: true,
          message:
            replacementBusCandidates.length > 0
              ? "This bus has active assigned orders. Reschedule them to another bus before delete."
              : "This bus has active assigned orders. Add another bus first, then reschedule and delete.",
          blockingOrders: mappedBlockingOrders,
          replacementBusCandidates: replacementBusCandidates.map((candidate) => ({
            id: toStringValue(candidate._id),
            busName: toStringValue(candidate.busName, "Bus"),
            busNumber: toStringValue(candidate.busNumber),
          })),
        },
        { status: 409 },
      );
    }

    if (blockingOrders.length > 0 && replacementBusObjectId && String(replacementBusObjectId) === busId) {
      return NextResponse.json(
        { success: false, message: "Select a different bus for rescheduling." },
        { status: 400 },
      );
    }

    if (blockingOrders.length > 0 && replacementBusObjectId && replacementBusCandidates.length === 0) {
      return NextResponse.json(
        { success: false, message: "No replacement bus available. Add another bus first." },
        { status: 409 },
      );
    }

    let deletedBusImages: string[] = [];
    let rescheduledOrdersCount = 0;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const latestBus = await Bus.findById(busId).session(session);
        if (!latestBus) {
          throw new HttpError("Bus not found.", 404);
        }

        deletedBusImages = Array.isArray(latestBus.busImages)
          ? latestBus.busImages
              .map((image) => String(image ?? "").trim())
              .filter((url) => url.length > 0 && isCloudinaryImageUrl(url))
          : [];

        const txBlockingOrders = await Order.find({
          status: { $in: [...ACTIVE_ORDER_STATUSES] },
          $or: [{ assignedBus: latestBus._id }, { bus: latestBus._id }],
        })
          .select("_id trackingId status orderDate totalWeightKg assignedBus bus pickupLocation dropLocation senderInfo")
          .session(session);

        const effectiveBlockingOrders = txBlockingOrders.filter((order) => {
          const effectiveBusId = toStringValue(order.assignedBus) || toStringValue(order.bus);
          return effectiveBusId === busId;
        });

        if (effectiveBlockingOrders.length > 0) {
          if (!replacementBusObjectId) {
            throw new HttpError("Active orders must be rescheduled before deleting this bus.", 409);
          }

          const replacementBus = await Bus.findOne({
            _id: replacementBusObjectId,
            travelCompanyId: latestBus.travelCompanyId,
          })
            .select("_id busName busNumber pricing routePath")
            .session(session)
            .lean<{
              _id: mongoose.Types.ObjectId;
              busName?: string;
              busNumber?: string;
              pricing?: BusPricingEntry[];
              routePath?: BusRoutePathPoint[];
            } | null>();

          if (!replacementBus) {
            throw new HttpError("Replacement bus not found for this company.", 404);
          }

          for (const order of effectiveBlockingOrders) {
            const trackingLabel = toStringValue(order.trackingId) || toStringValue(order._id);
            const orderDate = new Date(order.orderDate);
            orderDate.setUTCHours(0, 0, 0, 0);

            const pickupLocationId = extractLocationId(order.pickupLocation);
            const dropLocationId = extractLocationId(order.dropLocation);
            if (!pickupLocationId || !dropLocationId) {
              throw new HttpError(
                `Cannot reschedule order ${trackingLabel}: pickup/drop location is missing.`,
                409,
              );
            }

            const pricingEntries = Array.isArray(replacementBus.pricing) ? replacementBus.pricing : [];
            const routePath = Array.isArray(replacementBus.routePath) ? replacementBus.routePath : [];
            const supportsRoute = busSupportsRouteOnDate(
              pricingEntries,
              routePath,
              pickupLocationId,
              dropLocationId,
              orderDate,
            );
            if (!supportsRoute) {
              throw new HttpError(
                `Cannot reschedule order ${trackingLabel}: replacement bus does not support this route/date.`,
                409,
              );
            }

            const requiredWeightKg = Number(order.totalWeightKg ?? 0);
            if (!Number.isFinite(requiredWeightKg) || requiredWeightKg <= 0) {
              throw new HttpError(`Cannot reschedule order ${trackingLabel}: invalid order weight.`, 409);
            }

            const { dayStart, dayEnd } = getUtcDayRange(orderDate);
            const reserved = await reserveBusCapacityForDay(
              session,
              replacementBus._id,
              dayStart,
              dayEnd,
              requiredWeightKg,
            );
            if (!reserved) {
              throw new HttpError(
                `Cannot reschedule order ${trackingLabel}: replacement bus has insufficient capacity.`,
                409,
              );
            }

            order.assignedBus = replacementBus._id;
            const normalizedStatus = toStringValue(order.status).toLowerCase();
            if (normalizedStatus === "pending" || normalizedStatus === "confirmed") {
              order.status = "allocated";
            }
            await order.save({ session });
          }

          rescheduledOrdersCount = effectiveBlockingOrders.length;
        }

        const deleteResult = await Bus.deleteOne({ _id: latestBus._id }, { session });
        if (deleteResult.deletedCount !== 1) {
          throw new HttpError("Failed to delete bus.", 500);
        }

        const usersWithBus = await User.find({ buses: latestBus._id }).select("buses").session(session);
        for (const currentUser of usersWithBus) {
          currentUser.buses = Array.isArray(currentUser.buses)
            ? currentUser.buses.filter((id: unknown) => String(id) !== busId)
            : [];
          await currentUser.save({ session });
        }
      });
    } finally {
      await session.endSession();
    }

    if (deletedBusImages.length > 0) {
      const results = await Promise.allSettled(
        deletedBusImages.map((url) => deleteCloudinaryImageByUrl(url)),
      );
      const failed = results.filter(
        (result) => result.status !== "fulfilled" || !result.value,
      ).length;
      if (failed > 0) {
        console.error(`[bus-image] Failed to delete ${failed} Cloudinary bus image(s) for bus ${busId}.`);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message:
          rescheduledOrdersCount > 0
            ? `Rescheduled ${rescheduledOrdersCount} order(s) and deleted bus successfully.`
            : "Bus deleted successfully.",
        rescheduledOrdersCount,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete bus.",
      },
      { status: 500 },
    );
  }
}
