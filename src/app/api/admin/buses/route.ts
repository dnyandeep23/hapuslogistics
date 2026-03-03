import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import { deleteCloudinaryImageByUrl, uploadImageFile } from "@/app/api/lib/cloudinary";
import User from "@/app/api/models/userModel";
import Bus from "@/app/api/models/busModel";
import TravelCompany from "@/app/api/models/travelCompanyModel";
import Location from "@/app/api/models/locationModel";
import {
  normalizeCategoryFaresForAllowedNames,
  resolveActivePackageCatalog,
} from "@/app/api/lib/packageCatalog";

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
    date: Date;
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

export async function POST(request: NextRequest) {
  let uploadedBusImageUrl: string | null = null;
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(userId);
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      return NextResponse.json({ success: false, message: "Admin access required." }, { status: 403 });
    }
    const adminPhone = String(user.phone ?? "").trim();
    if (!adminPhone) {
      return NextResponse.json(
        {
          success: false,
          message: "Add your contact number before creating a bus.",
        },
        { status: 400 },
      );
    }

    const formData = await request.formData();

    const busName = String(formData.get("busName") ?? "").trim();
    const busNumber = String(formData.get("busNumber") ?? "")
      .trim()
      .toUpperCase();
    const companyName = String(formData.get("companyName") ?? "").trim();
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
    const packageCatalog = await resolveActivePackageCatalog();
    const allowedCategoryNames = packageCatalog.categories.map((entry) => entry.name);

    if (allowedCategoryNames.length === 0) {
      return NextResponse.json(
        { success: false, message: "No active package categories configured by super admin." },
        { status: 400 },
      );
    }

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

    let parsedRoutes: unknown;
    try {
      parsedRoutes = JSON.parse(routesConfigRaw || "[]");
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid route configuration." },
        { status: 400 },
      );
    }

    if (!Array.isArray(parsedRoutes) || parsedRoutes.length === 0) {
      return NextResponse.json(
        { success: false, message: "At least one pickup/drop point is required." },
        { status: 400 },
      );
    }

    const normalizedRoutes: RouteConfigInput[] = [];
    for (let index = 0; index < parsedRoutes.length; index += 1) {
      const current = parsedRoutes[index];
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return NextResponse.json(
          { success: false, message: `Route ${index + 1} is invalid.` },
          { status: 400 },
        );
      }

      const route = current as Record<string, unknown>;
      const pickupLocationId = String(route.pickupLocationId ?? "").trim();
      const dropLocationId = String(route.dropLocationId ?? "").trim();
      const distanceKm = Number(route.distanceKm ?? route.km ?? 0);
      const pickupTime = String(route.pickupTime ?? "").trim();
      const dropTime = String(route.dropTime ?? "").trim();

      if (!pickupLocationId || !dropLocationId || !pickupTime || !dropTime) {
        return NextResponse.json(
          {
            success: false,
            message: `Route ${index + 1}: pickup, drop, pickup time and drop time are required.`,
          },
          { status: 400 },
        );
      }
      if (!Number.isFinite(distanceKm) || distanceKm < 0) {
        return NextResponse.json(
          { success: false, message: `Route ${index + 1}: distance in KM must be 0 or greater.` },
          { status: 400 },
        );
      }

      if (
        !mongoose.Types.ObjectId.isValid(pickupLocationId) ||
        !mongoose.Types.ObjectId.isValid(dropLocationId)
      ) {
        return NextResponse.json(
          { success: false, message: `Route ${index + 1}: invalid pickup/drop location.` },
          { status: 400 },
        );
      }

      if (pickupLocationId === dropLocationId) {
        return NextResponse.json(
          { success: false, message: `Route ${index + 1}: pickup and drop must be different.` },
          { status: 400 },
        );
      }

      const faresCandidate = route.materialFares;
      const normalizedMaterialFares = normalizeCategoryFaresForAllowedNames(
        faresCandidate,
        allowedCategoryNames,
      );
      if (!normalizedMaterialFares.ok) {
        return NextResponse.json(
          { success: false, message: `Route ${index + 1}: material prices are required.` },
          { status: 400 },
        );
      }
      if (normalizedMaterialFares.unknownKeys.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Route ${index + 1}: unknown category keys: ${normalizedMaterialFares.unknownKeys.join(", ")}.`,
          },
          { status: 400 },
        );
      }

      const materialFares = normalizedMaterialFares.fares;

      if (Object.values(materialFares).every((fare) => fare <= 0)) {
        return NextResponse.json(
          { success: false, message: `Route ${index + 1}: add at least one valid price.` },
          { status: 400 },
        );
      }

      const overridesCandidate = Array.isArray(route.dateOverrides) ? route.dateOverrides : [];
      const dateOverrides: { date: Date; fares: Record<string, number> }[] = [];

      for (let overrideIndex = 0; overrideIndex < overridesCandidate.length; overrideIndex += 1) {
        const override = overridesCandidate[overrideIndex];
        if (!override || typeof override !== "object" || Array.isArray(override)) {
          return NextResponse.json(
            { success: false, message: `Route ${index + 1}: invalid override at row ${overrideIndex + 1}.` },
            { status: 400 },
          );
        }

        const overrideRecord = override as Record<string, unknown>;
        const overrideDateRaw = String(overrideRecord.date ?? "").trim();
        const overrideDate = new Date(overrideDateRaw);
        if (!overrideDateRaw || Number.isNaN(overrideDate.getTime())) {
          return NextResponse.json(
            { success: false, message: `Route ${index + 1}: valid override date is required.` },
            { status: 400 },
          );
        }
        overrideDate.setUTCHours(0, 0, 0, 0);

        if (overrideDate < availabilityStartDate || overrideDate > availabilityEndDate) {
          return NextResponse.json(
            {
              success: false,
              message: `Route ${index + 1}: override date must be within selected availability range.`,
            },
            { status: 400 },
          );
        }

        const overrideFaresCandidate = overrideRecord.fares;
        const normalizedOverrideFares = normalizeCategoryFaresForAllowedNames(
          overrideFaresCandidate,
          allowedCategoryNames,
        );
        if (!normalizedOverrideFares.ok) {
          return NextResponse.json(
            { success: false, message: `Route ${index + 1}: invalid override fares.` },
            { status: 400 },
          );
        }
        if (normalizedOverrideFares.unknownKeys.length > 0) {
          return NextResponse.json(
            {
              success: false,
              message: `Route ${index + 1}: unknown override category keys: ${normalizedOverrideFares.unknownKeys.join(", ")}.`,
            },
            { status: 400 },
          );
        }

        const overrideFares = normalizedOverrideFares.fares;

        if (Object.values(overrideFares).every((fare) => fare <= 0)) {
          return NextResponse.json(
            { success: false, message: `Route ${index + 1}: override requires at least one valid price.` },
            { status: 400 },
          );
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

    const uploadedFiles = formData
      .getAll("busImages")
      .filter((file): file is File => file instanceof File && file.size > 0);

    if (uploadedFiles.length !== 1) {
      return NextResponse.json(
        { success: false, message: "Upload exactly one bus image." },
        { status: 400 },
      );
    }

    const file = uploadedFiles[0];
    uploadedBusImageUrl = await uploadImageFile(file, { folder: "buses" });

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

    let travelCompanyId = user.travelCompanyId;
    if (!travelCompanyId) {
      const company = await TravelCompany.create({
        name: companyName || `${user.name || "Admin"} Travels`,
        ownerUserId: user._id,
        ownerEmail: user.email?.toLowerCase(),
        contact: {
          email: user.email?.toLowerCase(),
          phone: adminPhone,
        },
      });
      travelCompanyId = company._id;
      user.travelCompanyId = company._id;
    } else {
      await TravelCompany.findByIdAndUpdate(
        travelCompanyId,
        {
          $set: {
            "contact.phone": adminPhone,
            "contact.email": user.email?.toLowerCase(),
          },
        },
      );
    }

    const bus = await Bus.create({
      travelCompanyId,
      busName,
      busNumber,
      busImages: [uploadedBusImageUrl],
      capacity: rawCapacity,
      autoRenewCapacity,
      operatorContactPeriods: [],
      availability: availabilitySlots,
      routePath: normalizedRoutePoints.map((point, index) => ({
        sequence: index + 1,
        location: new mongoose.Types.ObjectId(point.locationId),
        pointCategory: point.pointCategory,
        pointTime: point.pointTime,
        distanceToNextKm: point.distanceToNextKm,
        durationToNextMinutes: point.durationToNextMinutes,
      })),
      routeSummary: {
        totalDistanceKm: routeSummaryDistanceKm,
        totalDurationMinutes: routeSummaryDurationMinutes,
      },
      pricing: normalizedRoutes.map((route, index) => ({
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
      })),
      sessions: [],
    });

    const existingBusIds = Array.isArray(user.buses)
      ? user.buses.map((id: unknown) => String(id))
      : [];

    if (!existingBusIds.includes(bus._id.toString())) {
      user.buses = [...(user.buses ?? []), bus._id];
    }
    user.hasRegisteredBus = true;
    await user.save();

    return NextResponse.json(
      {
        success: true,
        message: "Bus added successfully.",
        busId: bus._id.toString(),
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (uploadedBusImageUrl) {
      const deleted = await deleteCloudinaryImageByUrl(uploadedBusImageUrl);
      if (!deleted) {
        console.error("[bus-image] Failed to cleanup newly uploaded image after create failure.");
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to add bus.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const scope = String(searchParams.get("scope") ?? "all").trim().toLowerCase();
    const query: Record<string, unknown> = {};
    if (user.isSuperAdmin) {
      if (scope === "my_company") {
        if (!user.travelCompanyId) {
          return NextResponse.json({ success: true, buses: [] }, { status: 200 });
        }
        query.travelCompanyId = user.travelCompanyId;
      }
    } else {
      if (user.travelCompanyId) {
        query.travelCompanyId = user.travelCompanyId;
      } else if (Array.isArray(user.buses) && user.buses.length > 0) {
        query._id = { $in: user.buses };
      } else {
        return NextResponse.json({ success: true, buses: [] }, { status: 200 });
      }
    }

    const buses = await Bus.find(query)
      .sort({ createdAt: -1 })
      .populate("travelCompanyId", "name")
      .select(
        "busName busNumber busImages contactPersonName contactPersonNumber operatorContactPeriods capacity autoRenewCapacity availability routePath routeSummary pricing travelCompanyId createdAt updatedAt",
      )
      .lean<Array<Record<string, unknown>>>();

    const normalizedBuses = buses.map((bus) => ({
      ...bus,
      companyName:
        (typeof bus.travelCompanyId === "object" &&
        bus.travelCompanyId !== null &&
        "name" in bus.travelCompanyId
          ? String((bus.travelCompanyId as { name?: unknown }).name ?? "")
          : "") || "",
      companyId:
        (typeof bus.travelCompanyId === "object" &&
        bus.travelCompanyId !== null &&
        "_id" in bus.travelCompanyId
          ? String((bus.travelCompanyId as { _id?: unknown })._id ?? "")
          : String(bus.travelCompanyId ?? "")) || "",
    }));

    return NextResponse.json({ success: true, buses: normalizedBuses }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch buses.",
      },
      { status: 500 },
    );
  }
}
