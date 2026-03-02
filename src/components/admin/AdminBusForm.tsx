"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useDispatch } from "react-redux";
import Image from "next/image";
import CustomDateRangePicker from "@/components/CustomDateRangePicker";
import CustomTimePicker from "@/components/CustomTimePicker";
import { AppDispatch } from "@/lib/redux/store";
import { fetchUser } from "@/lib/redux/userSlice";
import { useAppSelector } from "@/lib/redux/hooks";

const OpenStreetMapPicker = dynamic(() => import("@/components/OpenStreetMapPicker"), {
  ssr: false,
});

const RoutePreviewMap = dynamic(() => import("@/components/RoutePreviewMap"), {
  ssr: false,
});

type AdminLocation = {
  _id: string;
  name: string;
  address?: string;
  city: string;
  state: string;
  zip?: string;
  latitude?: number | null;
  longitude?: number | null;
  geoPoint?: {
    type?: string;
    coordinates?: number[];
  };
};

type RoutePointForm = {
  locationId: string;
  pointCategory: "pickup" | "drop";
  pointTime: string;
};

type RouteConfigForm = {
  pickupLocationId: string;
  dropLocationId: string;
  distanceKm: number;
  pickupTime: string;
  dropTime: string;
  materialFares: Record<string, number>;
  dateOverrides: {
    date: string;
    fares: Record<string, number>;
    minimized: boolean;
  }[];
  minimized: boolean;
};

type BusPricing = {
  sequence?: number;
  pickupLocation: unknown;
  dropLocation: unknown;
  distanceKm?: number;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  pickupTime?: string;
  dropTime?: string;
  fares?: Record<string, number>;
  dateOverrides?: Array<{ date?: string; fares?: Record<string, number> }>;
};

type BusRoutePathPoint = {
  sequence?: number;
  location: unknown;
  pointCategory?: "pickup" | "drop";
  pointTime?: string;
  distanceToNextKm?: number;
  durationToNextMinutes?: number;
};

type AdminBus = {
  _id: string;
  busName: string;
  busNumber: string;
  busImages: string[];
  capacity: number;
  autoRenewCapacity?: boolean;
  availability?: { date?: string }[];
  pricing?: BusPricing[];
  routePath?: BusRoutePathPoint[];
  routeSummary?: {
    totalDistanceKm?: number;
    totalDurationMinutes?: number;
  };
};

type AdminBusFieldErrors = Record<string, string>;
type InlineLocationFieldErrors = Record<string, string>;
type InlineLocationTarget = {
  pointIndex: number;
} | null;
type RouteMetricSegment = {
  distanceKm: number;
  durationMinutes: number;
};
type RouteMetricSummary = RouteMetricSegment;
type ResolvedLocation = {
  latitude: number;
  longitude: number;
  displayName?: string;
  name?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  zip?: string;
};

type MaterialCategoryMeta = {
  key: string;
  icon: string;
};

const defaultMaterialFareMap: Record<string, number> = {
  Wooden: 70,
  "Plastic / Fibre": 60,
  Iron: 80,
  Electronics: 95,
  "Mango Box": 55,
  Other: 110,
};

const materialCategoryMeta: MaterialCategoryMeta[] = [
  { key: "Wooden", icon: "mdi:tree" },
  { key: "Plastic / Fibre", icon: "mdi:bottle-soda" },
  { key: "Iron", icon: "mdi:anvil" },
  { key: "Electronics", icon: "mdi:flash" },
  { key: "Mango Box", icon: "mdi:package-variant" },
  { key: "Other", icon: "mdi:shape-outline" },
];

const BUS_NUMBER_PATTERN = /^[A-Z]{2}-\d{2}-[A-Z]{2}-\d{4}$/;

const makeDefaultRouteConfig = (): RouteConfigForm => ({
  pickupLocationId: "",
  dropLocationId: "",
  distanceKm: 0,
  pickupTime: "08:00",
  dropTime: "18:00",
  materialFares: { ...defaultMaterialFareMap },
  dateOverrides: [],
  minimized: false,
});

const makeDefaultRoutePoint = (pointCategory: "pickup" | "drop"): RoutePointForm => ({
  locationId: "",
  pointCategory,
  pointTime: pointCategory === "pickup" ? "08:00" : "18:00",
});

const makeEmptyInlineLocationForm = () => ({
  name: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  latitude: "",
  longitude: "",
});

const getDefaultPricingRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};

const formatBusNumberInput = (value: string) => {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  const parts = [
    cleaned.slice(0, 2),
    cleaned.slice(2, 4),
    cleaned.slice(4, 6),
    cleaned.slice(6, 10),
  ].filter(Boolean);
  return parts.join("-");
};

type Props = {
  mode: "create" | "edit";
  busId?: string;
  successHref?: string;
  cancelHref?: string;
};

export default function AdminBusForm({
  mode,
  busId = "",
  successHref = "/dashboard/buses",
  cancelHref = "/dashboard/buses",
}: Props) {
  const { user } = useAppSelector((state) => state.user);
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const isEditMode = mode === "edit";
  const isAdminRole = user?.role === "admin" || user?.isSuperAdmin;
  const isLockedAdmin = user?.role === "admin" && !user?.isSuperAdmin && user?.hasRegisteredBus === false;

  const [busName, setBusName] = useState("");
  const [busNumber, setBusNumber] = useState("");
  const [capacity, setCapacity] = useState(40);
  const [autoRenewCapacity, setAutoRenewCapacity] = useState(false);
  const defaultPricingRange = useMemo(() => getDefaultPricingRange(), []);
  const [availabilityStartDate, setAvailabilityStartDate] = useState(defaultPricingRange.start);
  const [availabilityEndDate, setAvailabilityEndDate] = useState(defaultPricingRange.end);
  const [routePoints, setRoutePoints] = useState<RoutePointForm[]>([
    makeDefaultRoutePoint("pickup"),
    makeDefaultRoutePoint("drop"),
  ]);
  const [routeConfigs, setRouteConfigs] = useState<RouteConfigForm[]>([makeDefaultRouteConfig()]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [derivedLocationCoords, setDerivedLocationCoords] = useState<
    Record<string, { latitude: number; longitude: number }>
  >({});
  const [roadRouteSummary, setRoadRouteSummary] = useState<RouteMetricSummary | null>(null);
  const [roadRouteSegments, setRoadRouteSegments] = useState<RouteMetricSegment[]>([]);
  const [roadRouteGeometry, setRoadRouteGeometry] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [roadRouteLoading, setRoadRouteLoading] = useState(false);
  const [roadRouteError, setRoadRouteError] = useState("");
  const [fullRouteMaterialFares, setFullRouteMaterialFares] = useState<Record<string, number>>({
    ...defaultMaterialFareMap,
  });
  const [pricingFormulaText, setPricingFormulaText] = useState("");
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [showInlineLocationCreator, setShowInlineLocationCreator] = useState<InlineLocationTarget>(null);
  const [inlineLocationForm, setInlineLocationForm] = useState(makeEmptyInlineLocationForm());
  const [inlineLocationFieldErrors, setInlineLocationFieldErrors] = useState<InlineLocationFieldErrors>({});
  const [inlineLocationError, setInlineLocationError] = useState("");
  const [inlineLocationMessage, setInlineLocationMessage] = useState("");
  const [savingInlineLocation, setSavingInlineLocation] = useState(false);
  const [busImages, setBusImages] = useState<File[]>([]);
  const [savingBus, setSavingBus] = useState(false);
  const [initializingEdit, setInitializingEdit] = useState(false);
  const [editingBus, setEditingBus] = useState<AdminBus | null>(null);
  const [adminBusMessage, setAdminBusMessage] = useState("");
  const [adminBusError, setAdminBusError] = useState("");
  const [adminBusFieldErrors, setAdminBusFieldErrors] = useState<AdminBusFieldErrors>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);
  const [activeRoutePointIndex, setActiveRoutePointIndex] = useState(0);

  const routeTileRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const routeTimelineRef = useRef<HTMLDivElement | null>(null);
  const draggingPointIndexRef = useRef<number | null>(null);
  const resolvingLocationIdsRef = useRef<Set<string>>(new Set());
  const initialFormSnapshotRef = useRef("");
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location._id, location])),
    [locations],
  );

  const currentFormSnapshot = useMemo(
    () =>
      JSON.stringify({
        busName,
        busNumber,
        capacity,
        autoRenewCapacity,
        availabilityStartDate,
        availabilityEndDate,
        routePoints,
        routeConfigs,
        busImages: busImages.map((file) => ({
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
        })),
        existingBusImage: editingBus?.busImages?.[0] ?? "",
      }),
    [
      autoRenewCapacity,
      availabilityEndDate,
      availabilityStartDate,
      busImages,
      busName,
      busNumber,
      capacity,
      editingBus?.busImages,
      routeConfigs,
      routePoints,
    ],
  );
  const hasUnsavedChanges =
    Boolean(initialFormSnapshotRef.current) &&
    currentFormSnapshot !== initialFormSnapshotRef.current &&
    !savingBus;

  const formSteps = [
    { id: 1, label: "Bus Details", icon: "solar:bus-outline" },
    { id: 2, label: "Route Setup", icon: "solar:route-outline" },
    { id: 3, label: "Pricing", icon: "solar:card-outline" },
    { id: 4, label: "Media", icon: "solar:gallery-outline" },
  ];

  const busImagePreviews = useMemo(
    () =>
      busImages.map((file, index) => ({
        id: `${file.name}-${file.lastModified}-${index}`,
        file,
        preview: URL.createObjectURL(file),
      })),
    [busImages],
  );

  useEffect(() => {
    return () => {
      busImagePreviews.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, [busImagePreviews]);

  useEffect(() => {
    if (initialFormSnapshotRef.current) return;
    if (isEditMode && initializingEdit) return;
    initialFormSnapshotRef.current = currentFormSnapshot;
  }, [currentFormSnapshot, initializingEdit, isEditMode]);

  useEffect(() => {
    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, [hasUnsavedChanges]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    multiple: false,
    onDrop: (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      setBusImages([acceptedFiles[0]]);
    },
  });

  const parseLocationId = (value: unknown) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object" && "_id" in (value as Record<string, unknown>)) {
      return String((value as { _id?: unknown })._id ?? "");
    }
    if (typeof value === "object" && "toString" in (value as Record<string, unknown>)) {
      return String((value as { toString: () => string }).toString());
    }
    return "";
  };

  const parseFares = (fares: unknown) => {
    const fallback = { ...defaultMaterialFareMap };
    if (!fares || typeof fares !== "object") return fallback;

    const entries = fares instanceof Map
      ? Array.from(fares.entries())
      : Object.entries(fares as Record<string, unknown>);

    return entries.reduce<Record<string, number>>((acc, [key, value]) => {
      const parsed = Number(value);
      acc[key] = Number.isNaN(parsed) ? 0 : parsed;
      return acc;
    }, fallback);
  };

  const parseLocationCoords = (location?: AdminLocation | null) => {
    if (!location) return null;

    const lat = Number(location.latitude);
    const lng = Number(location.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }

    const coordinates = Array.isArray(location.geoPoint?.coordinates)
      ? location.geoPoint?.coordinates
      : [];
    const geoLng = Number(coordinates[0]);
    const geoLat = Number(coordinates[1]);
    if (Number.isFinite(geoLat) && Number.isFinite(geoLng)) {
      return { latitude: geoLat, longitude: geoLng };
    }

    return null;
  };

  const getDistanceFromPreviousPoint = useCallback(
    (points: RoutePointForm[], index: number) => {
      if (index <= 0) return 0;
      const roadSegmentDistance = Number(roadRouteSegments[index - 1]?.distanceKm);
      if (Number.isFinite(roadSegmentDistance) && roadSegmentDistance > 0) {
        return Number(roadSegmentDistance.toFixed(2));
      }
      return 0;
    },
    [roadRouteSegments],
  );

  const buildRouteConfigsFromPoints = useCallback(
    (points: RoutePointForm[]) => {
      const nextConfigs: RouteConfigForm[] = [];
      for (let index = 0; index < points.length - 1; index += 1) {
        const fromPoint = points[index];
        const toPoint = points[index + 1];
        const existing = routeConfigs[index];
        nextConfigs.push({
          pickupLocationId: fromPoint.locationId,
          dropLocationId: toPoint.locationId,
          distanceKm: Number((roadRouteSegments[index]?.distanceKm ?? getDistanceFromPreviousPoint(points, index + 1)).toFixed(2)),
          pickupTime: fromPoint.pointTime,
          dropTime: toPoint.pointTime,
          materialFares: existing?.materialFares ?? { ...defaultMaterialFareMap },
          dateOverrides: existing?.dateOverrides ?? [],
          minimized: existing?.minimized ?? false,
        });
      }
      return nextConfigs;
    },
    [getDistanceFromPreviousPoint, roadRouteSegments, routeConfigs],
  );

  const resetInlineLocationState = () => {
    setShowInlineLocationCreator(null);
    setInlineLocationForm(makeEmptyInlineLocationForm());
    setInlineLocationFieldErrors({});
    setInlineLocationError("");
    setInlineLocationMessage("");
  };

  const loadLocations = useCallback(async () => {
    if (!isAdminRole) return;
    try {
      setLoadingLocations(true);
      const response = await fetch("/api/locations", { method: "GET" });
      const payload = await response.json();
      if (!response.ok) {
        setAdminBusError(payload?.message || "Failed to load locations.");
        return;
      }
      const normalizedLocations: AdminLocation[] = [];
      for (const entry of Array.isArray(payload) ? payload : []) {
        if (!entry || typeof entry !== "object") continue;

        const raw = entry as Record<string, unknown>;
        const _id = parseLocationId(raw._id ?? raw.id ?? "");
        if (!_id) continue;

        const geoPointRaw =
          raw.geoPoint && typeof raw.geoPoint === "object"
            ? (raw.geoPoint as Record<string, unknown>)
            : undefined;

        const coordinates = Array.isArray(geoPointRaw?.coordinates)
          ? geoPointRaw?.coordinates
          : [];
        const geoLongitude = Number(coordinates[0]);
        const geoLatitude = Number(coordinates[1]);
        const latitudeValue = Number(raw.latitude);
        const longitudeValue = Number(raw.longitude);

        const latitude = Number.isFinite(latitudeValue)
          ? latitudeValue
          : Number.isFinite(geoLatitude)
          ? geoLatitude
          : null;
        const longitude = Number.isFinite(longitudeValue)
          ? longitudeValue
          : Number.isFinite(geoLongitude)
          ? geoLongitude
          : null;

        normalizedLocations.push({
          _id,
          name: String(raw.name ?? ""),
          address: raw.address ? String(raw.address) : "",
          city: String(raw.city ?? ""),
          state: String(raw.state ?? ""),
          zip: raw.zip ? String(raw.zip) : "",
          latitude,
          longitude,
          geoPoint:
            Number.isFinite(latitude) && Number.isFinite(longitude)
              ? {
                  type: "Point",
                  coordinates: [Number(longitude), Number(latitude)],
                }
              : undefined,
        });
      }

      setLocations(normalizedLocations);
    } catch (error: unknown) {
      setAdminBusError(error instanceof Error ? error.message : "Failed to load locations.");
    } finally {
      setLoadingLocations(false);
    }
  }, [isAdminRole]);

  const populateFormForEdit = useCallback((bus: AdminBus) => {
    setEditingBus(bus);
    setBusName(bus.busName ?? "");
    setBusNumber(formatBusNumberInput(bus.busNumber ?? ""));
    setCapacity(Number(bus.capacity) || 40);
    setAutoRenewCapacity(Boolean(bus.autoRenewCapacity));

    const availabilityDates = Array.isArray(bus.availability)
      ? bus.availability
          .map((slot) => slot.date)
          .filter((date): date is string => Boolean(date))
          .sort()
      : [];
    if (availabilityDates.length > 0) {
      setAvailabilityStartDate(availabilityDates[0].slice(0, 10));
      setAvailabilityEndDate(availabilityDates[availabilityDates.length - 1].slice(0, 10));
    } else {
      const defaultRange = getDefaultPricingRange();
      setAvailabilityStartDate(defaultRange.start);
      setAvailabilityEndDate(defaultRange.end);
    }

    const sortedPricing = Array.isArray(bus.pricing)
      ? [...bus.pricing].sort((left, right) => {
          const leftSequence = Number(left?.sequence ?? 0);
          const rightSequence = Number(right?.sequence ?? 0);
          if (leftSequence === rightSequence) return 0;
          if (!leftSequence) return 1;
          if (!rightSequence) return -1;
          return leftSequence - rightSequence;
        })
      : [];

    const nextRoutes =
      sortedPricing.length > 0
        ? sortedPricing.map((pricing) => ({
            pickupLocationId: parseLocationId(pricing.pickupLocation),
            dropLocationId: parseLocationId(pricing.dropLocation),
            distanceKm: Number(pricing.distanceKm) >= 0 ? Number(pricing.distanceKm) : 0,
            pickupTime: pricing.pickupTime || "08:00",
            dropTime: pricing.dropTime || "18:00",
            materialFares: parseFares(pricing.fares),
            dateOverrides: Array.isArray(pricing.dateOverrides)
              ? pricing.dateOverrides.map((override) => ({
                  date: override?.date ? String(override.date).slice(0, 10) : "",
                  fares: parseFares(override?.fares),
                  minimized: true,
                }))
              : [],
            minimized: false,
          }))
        : [makeDefaultRouteConfig()];

    const sortedRoutePath = Array.isArray(bus.routePath)
      ? [...bus.routePath].sort((left, right) => Number(left?.sequence ?? 0) - Number(right?.sequence ?? 0))
      : [];
    const nextRoutePointsFromPath = sortedRoutePath
      .map((point, index) => {
        const locationId = parseLocationId(point.location);
        if (!locationId) return null;
        const pointCategory = point.pointCategory === "pickup" || point.pointCategory === "drop"
          ? point.pointCategory
          : index === 0
          ? "pickup"
          : "drop";
        return {
          locationId,
          pointCategory,
          pointTime: point.pointTime || (pointCategory === "pickup" ? "08:00" : "18:00"),
        };
      })
      .filter((point): point is RoutePointForm => point !== null);

    const nextRoutePoints: RoutePointForm[] = nextRoutePointsFromPath.length >= 2
      ? nextRoutePointsFromPath
      : (() => {
          const fallbackPoints: RoutePointForm[] = [];
          if (nextRoutes.length > 0) {
            fallbackPoints.push({
              locationId: nextRoutes[0].pickupLocationId,
              pointCategory: "pickup",
              pointTime: nextRoutes[0].pickupTime || "08:00",
            });
            nextRoutes.forEach((route) => {
              fallbackPoints.push({
                locationId: route.dropLocationId,
                pointCategory: "drop",
                pointTime: route.dropTime || "18:00",
              });
            });
          }
          return fallbackPoints;
        })();

    setRoutePoints(
      nextRoutePoints.length >= 2
        ? nextRoutePoints
        : [makeDefaultRoutePoint("pickup"), makeDefaultRoutePoint("drop")],
    );
    setActiveRoutePointIndex(0);
    setRouteConfigs(nextRoutes);
    setBusImages([]);
    setCurrentStep(1);
  }, []);

  useEffect(() => {
    if (routePoints.length === 0) {
      setActiveRoutePointIndex(0);
      return;
    }
    if (activeRoutePointIndex > routePoints.length - 1) {
      setActiveRoutePointIndex(routePoints.length - 1);
    }
  }, [activeRoutePointIndex, routePoints.length]);

  useEffect(() => {
    if (!isAdminRole) return;
    loadLocations();
  }, [isAdminRole, loadLocations]);

  useEffect(() => {
    if (!isAdminRole || !isEditMode || !busId) return;

    const loadBusForEdit = async () => {
      try {
        setInitializingEdit(true);
        const response = await fetch("/api/admin/buses", { method: "GET" });
        const payload = await response.json();
        if (!response.ok) {
          setAdminBusError(payload?.message || "Failed to load bus details.");
          return;
        }
        const buses = Array.isArray(payload?.buses) ? payload.buses : [];
        const foundBus = buses.find((entry: { _id?: string }) => String(entry?._id ?? "") === busId);
        if (!foundBus) {
          setAdminBusError("Bus not found.");
          return;
        }
        populateFormForEdit(foundBus as AdminBus);
      } catch (error: unknown) {
        setAdminBusError(error instanceof Error ? error.message : "Failed to load bus details.");
      } finally {
        setInitializingEdit(false);
      }
    };

    loadBusForEdit();
  }, [busId, isAdminRole, isEditMode, populateFormForEdit]);

  useEffect(() => {
    draggingPointIndexRef.current = draggingPointIndex;
  }, [draggingPointIndex]);

  const resolveLocationCoordinates = useCallback(
    (locationId: string) => {
      if (!locationId) return null;
      const location = locationById.get(locationId);
      return parseLocationCoords(location) ?? derivedLocationCoords[locationId] ?? null;
    },
    [derivedLocationCoords, locationById],
  );

  useEffect(() => {
    const uniqueSelectedLocationIds = Array.from(
      new Set(routePoints.map((point) => point.locationId).filter(Boolean)),
    );

    uniqueSelectedLocationIds.forEach((locationId) => {
      if (!locationId) return;
      if (resolveLocationCoordinates(locationId)) return;
      if (resolvingLocationIdsRef.current.has(locationId)) return;

      const location = locationById.get(locationId);
      if (!location) return;

      const geocodeQuery = [
        location.name,
        location.address,
        location.city,
        location.state,
        location.zip,
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .join(", ");

      if (geocodeQuery.length < 3) return;

      resolvingLocationIdsRef.current.add(locationId);
      fetch(`/api/locations/geocode?q=${encodeURIComponent(geocodeQuery)}`, { method: "GET" })
        .then(async (response) => {
          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload?.result) return;

          const latitude = Number(payload.result.latitude);
          const longitude = Number(payload.result.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

          setDerivedLocationCoords((prev) => ({
            ...prev,
            [locationId]: { latitude, longitude },
          }));
        })
        .catch(() => {
          // Ignore geocode failures and keep manual map/location entry path available.
        })
        .finally(() => {
          resolvingLocationIdsRef.current.delete(locationId);
        });
    });
  }, [locationById, resolveLocationCoordinates, routePoints]);

  useEffect(() => {
    const resolvedRouteCoordinates = routePoints
      .map((point) => resolveLocationCoordinates(point.locationId))
      .filter((point): point is { latitude: number; longitude: number } => Boolean(point));

    if (resolvedRouteCoordinates.length < 2 || resolvedRouteCoordinates.length !== routePoints.length) {
      setRoadRouteSummary(null);
      setRoadRouteSegments([]);
      setRoadRouteGeometry([]);
      setRoadRouteError("");
      setRoadRouteLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setRoadRouteLoading(true);
        setRoadRouteError("");
        const response = await fetch("/api/locations/road-route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points: resolvedRouteCoordinates }),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          const message = String(payload?.message ?? "Failed to calculate road route.");
          if (!controller.signal.aborted) {
            setRoadRouteError(message);
            setRoadRouteSummary(null);
            setRoadRouteSegments([]);
            setRoadRouteGeometry([]);
          }
          return;
        }

        const summaryDistance = Number(payload?.summary?.distanceKm);
        const summaryDuration = Number(payload?.summary?.durationMinutes);
        const nextSummary =
          Number.isFinite(summaryDistance) && Number.isFinite(summaryDuration)
            ? {
                distanceKm: Number(summaryDistance.toFixed(2)),
                durationMinutes: Number(summaryDuration.toFixed(1)),
              }
            : null;

        const nextSegments: RouteMetricSegment[] = Array.isArray(payload?.segments)
          ? (payload.segments as unknown[])
              .map((segment: unknown) => {
                if (!segment || typeof segment !== "object") return null;
                const record = segment as Record<string, unknown>;
                const distanceKm = Number(record.distanceKm);
                const durationMinutes = Number(record.durationMinutes);
                if (!Number.isFinite(distanceKm) || !Number.isFinite(durationMinutes)) return null;
                return {
                  distanceKm: Number(distanceKm.toFixed(2)),
                  durationMinutes: Number(durationMinutes.toFixed(1)),
                };
              })
              .filter((segment): segment is RouteMetricSegment => segment !== null)
          : [];

        const geometryCoordinatesRaw: unknown[] = Array.isArray(payload?.geometry?.coordinates)
          ? (payload.geometry.coordinates as unknown[])
          : [];
        const nextGeometry: Array<{ latitude: number; longitude: number }> = geometryCoordinatesRaw
          .map((point: unknown) => {
            if (!point || typeof point !== "object") return null;
            const record = point as Record<string, unknown>;
            const latitude = Number(record.latitude);
            const longitude = Number(record.longitude);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
            return {
              latitude,
              longitude,
            };
          })
          .filter((point): point is { latitude: number; longitude: number } => point !== null);

        if (controller.signal.aborted) return;
        setRoadRouteSummary(nextSummary);
        setRoadRouteSegments(nextSegments);
        setRoadRouteGeometry(nextGeometry);
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        setRoadRouteError(error instanceof Error ? error.message : "Failed to calculate road route.");
        setRoadRouteSummary(null);
        setRoadRouteSegments([]);
        setRoadRouteGeometry([]);
      } finally {
        if (!controller.signal.aborted) {
          setRoadRouteLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [resolveLocationCoordinates, routePoints]);

  const updateRoutePoint = (index: number, updater: (current: RoutePointForm) => RoutePointForm) => {
    setRoutePoints((prev) =>
      prev.map((point, pointIndex) => (pointIndex === index ? updater(point) : point)),
    );
  };

  const reorderRoutePoints = useCallback((sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return;
    setRoutePoints((prev) => {
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setActiveRoutePointIndex((prev) => {
      if (prev === sourceIndex) return targetIndex;
      if (sourceIndex < targetIndex && prev > sourceIndex && prev <= targetIndex) return prev - 1;
      if (sourceIndex > targetIndex && prev >= targetIndex && prev < sourceIndex) return prev + 1;
      return prev;
    });
  }, []);

  const addRoutePoint = () => {
    setRoutePoints((prev) => [...prev, makeDefaultRoutePoint("drop")]);
    setActiveRoutePointIndex(routePoints.length);
  };

  const removeRoutePoint = (index: number) => {
    if (routePoints.length <= 2) return;
    setRoutePoints((prev) => (prev.length <= 2 ? prev : prev.filter((_, pointIndex) => pointIndex !== index)));
    setActiveRoutePointIndex((prev) => {
      if (index === prev) return Math.max(0, prev - 1);
      if (index < prev) return prev - 1;
      return prev;
    });
    resetInlineLocationState();
  };

  const findRouteTileIndexByPointerX = (clientX: number) => {
    let closestIndex = -1;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < routePoints.length; index += 1) {
      const element = routeTileRefs.current[index];
      if (!element) continue;
      const bounds = element.getBoundingClientRect();
      const center = (bounds.left + bounds.right) / 2;
      const distance = Math.abs(clientX - center);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    }
    return closestIndex;
  };

  const startRouteTileDrag = (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();

    const pointerId = event.pointerId;
    const timeline = routeTimelineRef.current;
    if (!timeline) return;

    setActiveRoutePointIndex(index);
    setDraggingPointIndex(index);

    const finishDrag = () => {
      setDraggingPointIndex(null);
      draggingPointIndexRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;

      const activeIndex = draggingPointIndexRef.current;
      if (activeIndex === null) return;

      const timelineBounds = timeline.getBoundingClientRect();
      const isWithinDragBand =
        moveEvent.clientY >= timelineBounds.top && moveEvent.clientY <= timelineBounds.bottom;
      if (!isWithinDragBand) return;

      if (moveEvent.clientX > timelineBounds.right - 40) {
        timeline.scrollBy({ left: 18, behavior: "auto" });
      } else if (moveEvent.clientX < timelineBounds.left + 40) {
        timeline.scrollBy({ left: -18, behavior: "auto" });
      }

      const hoverIndex = findRouteTileIndexByPointerX(moveEvent.clientX);
      if (hoverIndex >= 0 && hoverIndex !== activeIndex) {
        reorderRoutePoints(activeIndex, hoverIndex);
        setDraggingPointIndex(hoverIndex);
        draggingPointIndexRef.current = hoverIndex;
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      finishDrag();
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", handlePointerUp, { passive: true });
  };

  const openInlineLocationCreator = (targetIndex: number) => {
    setShowInlineLocationCreator({ pointIndex: targetIndex });
    setInlineLocationForm(makeEmptyInlineLocationForm());
    setInlineLocationFieldErrors({});
    setInlineLocationError("");
    setInlineLocationMessage("");
  };

  const handleInlineLocationCreate = async () => {
    if (!showInlineLocationCreator) return;

    setInlineLocationError("");
    setInlineLocationMessage("");
    const nextErrors: InlineLocationFieldErrors = {};

    if (!inlineLocationForm.name.trim()) nextErrors.name = "Location name is required.";
    if (!inlineLocationForm.address.trim()) nextErrors.address = "Address is required.";
    if (!inlineLocationForm.city.trim()) nextErrors.city = "City is required.";
    if (!inlineLocationForm.state.trim()) nextErrors.state = "State is required.";
    if (!inlineLocationForm.zip.trim()) nextErrors.zip = "ZIP code is required.";
    if (!inlineLocationForm.latitude || !inlineLocationForm.longitude) {
      nextErrors.coordinates = "Select coordinates from OpenStreetMap.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setInlineLocationFieldErrors(nextErrors);
      setInlineLocationError("Please complete all required location fields.");
      return;
    }

    setInlineLocationFieldErrors({});

    try {
      setSavingInlineLocation(true);
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...inlineLocationForm,
          latitude: Number(inlineLocationForm.latitude),
          longitude: Number(inlineLocationForm.longitude),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setInlineLocationError(payload?.message || "Failed to add location.");
        return;
      }

      const createdLocationId = String(payload?.location?._id ?? "");
      if (createdLocationId) {
        updateRoutePoint(showInlineLocationCreator.pointIndex, (current) => ({
          ...current,
          locationId: createdLocationId,
        }));
      }

      await loadLocations();
      setInlineLocationMessage(payload?.message || "Location added successfully.");
      setInlineLocationForm(makeEmptyInlineLocationForm());
      setInlineLocationFieldErrors({});
      setAdminBusMessage("Location added and assigned to route point.");
    } catch (error: unknown) {
      setInlineLocationError(error instanceof Error ? error.message : "Failed to add location.");
    } finally {
      setSavingInlineLocation(false);
    }
  };

  const locationNameById = useMemo(
    () =>
      new Map(
        locations.map((location) => [location._id, `${location.name} (${location.city})`]),
      ),
    [locations],
  );

  const inlineLocationSearchQuery = useMemo(() => {
    const parts = [
      inlineLocationForm.name,
      inlineLocationForm.address,
      inlineLocationForm.city,
      inlineLocationForm.state,
      inlineLocationForm.zip,
    ]
      .map((value) => value.trim())
      .filter(Boolean);
    return parts.join(", ");
  }, [
    inlineLocationForm.address,
    inlineLocationForm.city,
    inlineLocationForm.name,
    inlineLocationForm.state,
    inlineLocationForm.zip,
  ]);

  const applyResolvedInlineLocation = useCallback((resolved: ResolvedLocation) => {
    setInlineLocationForm((prev) => ({
      ...prev,
      name: prev.name.trim() ? prev.name : String(resolved.name ?? "").trim() || prev.name,
      address:
        String(resolved.addressLine ?? "").trim() ||
        String(resolved.displayName ?? "").trim() ||
        prev.address,
      city: String(resolved.city ?? "").trim() || prev.city,
      state: String(resolved.state ?? "").trim() || prev.state,
      zip: String(resolved.zip ?? "").trim() || prev.zip,
      latitude: Number(resolved.latitude).toFixed(6),
      longitude: Number(resolved.longitude).toFixed(6),
    }));

    setInlineLocationFieldErrors((prev) => ({
      ...prev,
      address: "",
      city: "",
      state: "",
      zip: "",
      coordinates: "",
    }));
  }, []);

  const routePreviewPoints = useMemo(() => {
    return routePoints
      .map((point, index) => {
        const location = locationById.get(point.locationId);
        const coordinates = resolveLocationCoordinates(point.locationId);
        if (!coordinates) return null;

        return {
          id: `route-map-${index}`,
          label: location?.name || `Point ${index + 1}`,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          pointCategory: point.pointCategory,
          pointTime: point.pointTime,
        };
      })
      .filter((point): point is NonNullable<typeof point> => Boolean(point));
  }, [locationById, resolveLocationCoordinates, routePoints]);

  const hasRoadSummary = useMemo(() => {
    return Boolean(roadRouteSummary?.distanceKm && roadRouteSummary.distanceKm > 0);
  }, [roadRouteSummary?.distanceKm]);

  const routeSegmentCount = useMemo(() => Math.max(0, routePoints.length - 1), [routePoints.length]);

  const hasSegmentRoadMetrics = useMemo(() => {
    return roadRouteSegments.length >= routeSegmentCount;
  }, [roadRouteSegments.length, routeSegmentCount]);

  const getRouteSegmentMetric = useCallback(
    (segmentIndex: number) => {
      if (segmentIndex < 0 || segmentIndex >= routeSegmentCount) return null;
      const segment = roadRouteSegments[segmentIndex];
      const distanceKm = Number(segment?.distanceKm);
      const durationMinutes = Number(segment?.durationMinutes);

      if (Number.isFinite(distanceKm) && distanceKm > 0) {
        return {
          distanceKm: Number(distanceKm.toFixed(2)),
          durationMinutes:
            Number.isFinite(durationMinutes) && durationMinutes > 0
              ? Number(durationMinutes.toFixed(1))
              : 0,
        };
      }

      return null;
    },
    [roadRouteSegments, routeSegmentCount],
  );

  const getRouteMetricForPoint = useCallback(
    (pointIndex: number) => {
      if (pointIndex <= 0) return null;
      return getRouteSegmentMetric(pointIndex - 1);
    },
    [getRouteSegmentMetric],
  );

  const formulaDistanceKm = useMemo(() => {
    return hasRoadSummary ? Number(roadRouteSummary?.distanceKm ?? 0) : 0;
  }, [hasRoadSummary, roadRouteSummary?.distanceKm]);

  const startRoutePointLabel = useMemo(() => {
    const firstPoint = routePoints[0];
    if (!firstPoint) return "Start";
    return locationNameById.get(firstPoint.locationId) || "Start";
  }, [locationNameById, routePoints]);

  const endRoutePointLabel = useMemo(() => {
    const lastPoint = routePoints[routePoints.length - 1];
    if (!lastPoint) return "End";
    return locationNameById.get(lastPoint.locationId) || "End";
  }, [locationNameById, routePoints]);

  const normalizeFullRouteFares = useCallback((rawFares: Record<string, number>) => {
    const normalized = { ...rawFares };
    const maxNonOtherFare = Math.max(
      ...Object.entries(normalized)
        .filter(([key]) => key !== "Other")
        .map(([, value]) => Number(value) || 0),
      0,
    );
    if ((Number(normalized.Other) || 0) <= maxNonOtherFare) {
      normalized.Other = maxNonOtherFare + 10;
    }
    return normalized;
  }, []);

  const applyFullRoutePricingFormula = useCallback(
    (sourceFares: Record<string, number>) => {
      const normalizedFares = normalizeFullRouteFares(sourceFares);
      setFullRouteMaterialFares(normalizedFares);

      const totalSegments = Math.max(1, routeConfigs.length);
      const totalDistance = hasRoadSummary ? Number(roadRouteSummary?.distanceKm ?? 0) : 0;
      const formulaLabel = hasRoadSummary && hasSegmentRoadMetrics
        ? "Segment Fare = Full Route Fare × (Segment Distance / Total Route Distance)"
        : "Segment Fare = Full Route Fare / Total Segments (ORS unavailable)";
      setPricingFormulaText(formulaLabel);

      setRouteConfigs((prev) =>
        prev.map((route, routeIndex) => {
          const segmentDistance = Number(roadRouteSegments[routeIndex]?.distanceKm ?? 0);
          const segmentFares = Object.entries(normalizedFares).reduce<Record<string, number>>(
            (acc, [material, value]) => {
              const fullFare = Number(value) || 0;
              let computedFare = 0;
              if (hasRoadSummary && hasSegmentRoadMetrics && totalDistance > 0 && segmentDistance > 0) {
                computedFare = fullFare * (segmentDistance / totalDistance);
              } else {
                computedFare = fullFare / totalSegments;
              }

              const rounded = Math.max(1, Math.round(computedFare));
              acc[material] = rounded;
              return acc;
            },
            {},
          );

          return {
            ...route,
            distanceKm: hasSegmentRoadMetrics ? Number(segmentDistance.toFixed(2)) : 0,
            materialFares: segmentFares,
          };
        }),
      );
    },
    [hasRoadSummary, hasSegmentRoadMetrics, normalizeFullRouteFares, roadRouteSegments, roadRouteSummary?.distanceKm, routeConfigs.length],
  );

  useEffect(() => {
    if (routeConfigs.length === 0) return;
    applyFullRoutePricingFormula(fullRouteMaterialFares);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeConfigs.length, hasRoadSummary, hasSegmentRoadMetrics, roadRouteSegments]);

  const totalRouteDistance = useMemo(() => {
    if (!hasRoadSummary) return 0;
    return Number((roadRouteSummary?.distanceKm ?? 0).toFixed(2));
  }, [hasRoadSummary, roadRouteSummary?.distanceKm]);

  const totalRouteDurationMinutes = useMemo(() => {
    if (!hasRoadSummary) return 0;
    return Number((roadRouteSummary?.durationMinutes ?? 0).toFixed(1));
  }, [hasRoadSummary, roadRouteSummary?.durationMinutes]);

  const activeRoutePoint = routePoints[activeRoutePointIndex];
  const activeRoadMetric = getRouteMetricForPoint(activeRoutePointIndex);
  const activeRoutePointDistance = activeRoutePointIndex > 0
    ? Number(activeRoadMetric?.distanceKm ?? 0)
    : 0;

  const validateBusBasics = (fieldErrors: AdminBusFieldErrors) => {
    if (!busName) fieldErrors.busName = "Bus name is required.";
    if (!busNumber) {
      fieldErrors.busNumber = "Bus number is required.";
    } else if (!BUS_NUMBER_PATTERN.test(busNumber)) {
      fieldErrors.busNumber = "Format must be like MH-02-BL-2254.";
    }
    if (capacity <= 0) fieldErrors.capacity = "Capacity must be greater than 0.";
    if (!availabilityStartDate || !availabilityEndDate) {
      fieldErrors.availabilityRange = "Availability date range is required.";
    } else if (availabilityEndDate < availabilityStartDate) {
      fieldErrors.availabilityRange = "End date cannot be before start date.";
    }
  };

  const validateRoutePoints = (fieldErrors: AdminBusFieldErrors) => {
    if (routePoints.length < 2) {
      fieldErrors.routePoints = "Add at least two route points.";
      return;
    }

    for (let index = 0; index < routePoints.length; index += 1) {
      const point = routePoints[index];
      const pointPrefix = `routePoint.${index}`;

      if (!point.locationId) fieldErrors[`${pointPrefix}.locationId`] = "Select location point.";
      if (!point.pointCategory) fieldErrors[`${pointPrefix}.pointCategory`] = "Select point category.";
      if (!point.pointTime) fieldErrors[`${pointPrefix}.pointTime`] = "Select point time.";

      if (index > 0 && point.locationId && point.locationId === routePoints[index - 1].locationId) {
        fieldErrors[`${pointPrefix}.locationId`] = "Consecutive route points must be different.";
      }
    }
  };

  const validateRoutePairs = (fieldErrors: AdminBusFieldErrors) => {
    for (let index = 0; index < routeConfigs.length; index += 1) {
      const route = routeConfigs[index];
      const routePrefix = `route.${index}`;

      if (!route.pickupLocationId) fieldErrors[`${routePrefix}.pickupLocationId`] = "Pickup location is required.";
      if (!route.dropLocationId) fieldErrors[`${routePrefix}.dropLocationId`] = "Drop location is required.";
      if (!Number.isFinite(route.distanceKm) || route.distanceKm < 0) {
        fieldErrors[`${routePrefix}.distanceKm`] = "Distance KM must be 0 or greater.";
      }
      if (!route.pickupTime) fieldErrors[`${routePrefix}.pickupTime`] = "Pickup time is required.";
      if (!route.dropTime) fieldErrors[`${routePrefix}.dropTime`] = "Drop time is required.";
      if (route.pickupLocationId && route.dropLocationId && route.pickupLocationId === route.dropLocationId) {
        fieldErrors[`${routePrefix}.dropLocationId`] = "Pickup and drop must be different.";
      }
      if (Object.values(route.materialFares).every((fare) => Number(fare) <= 0)) {
        fieldErrors[`${routePrefix}.materialFares`] = "Add at least one valid price.";
      }

      for (let overrideIndex = 0; overrideIndex < route.dateOverrides.length; overrideIndex += 1) {
        const override = route.dateOverrides[overrideIndex];
        const overridePrefix = `${routePrefix}.override.${overrideIndex}`;

        if (!override.date) {
          fieldErrors[`${overridePrefix}.date`] = "Override date is required.";
        } else if (
          availabilityStartDate &&
          availabilityEndDate &&
          (override.date < availabilityStartDate || override.date > availabilityEndDate)
        ) {
          fieldErrors[`${overridePrefix}.date`] = "Override date must be inside selected date range.";
        }

        if (Object.values(override.fares).every((fare) => Number(fare) <= 0)) {
          fieldErrors[`${overridePrefix}.fares`] = "Set at least one valid override price.";
        }
      }
    }
  };

  const validateBusImage = (fieldErrors: AdminBusFieldErrors) => {
    const existingImageCount = Array.isArray(editingBus?.busImages) ? editingBus.busImages.length : 0;
    if (busImages.length === 0 && existingImageCount === 0) {
      fieldErrors.busImages = "Upload one bus image.";
    }
    if (busImages.length > 1) {
      fieldErrors.busImages = "Only one bus image is allowed.";
    }
  };

  const handleNextStep = () => {
    const fieldErrors: AdminBusFieldErrors = {};

    if (currentStep === 1) validateBusBasics(fieldErrors);
    if (currentStep === 2) {
      validateRoutePoints(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        const nextConfigs = buildRouteConfigsFromPoints(routePoints);
        if (nextConfigs.length === 0) {
          fieldErrors.routePoints = "Unable to build route segments from selected points.";
        } else {
          setRouteConfigs(nextConfigs);
        }
      }
    }
    if (currentStep === 3) validateRoutePairs(fieldErrors);

    if (Object.keys(fieldErrors).length > 0) {
      setAdminBusFieldErrors(fieldErrors);
      setAdminBusError("Please fix the highlighted fields.");
      return;
    }

    setAdminBusError("");
    setAdminBusFieldErrors({});
    setCurrentStep((prev) => Math.min(prev + 1, formSteps.length));
  };

  const validateStepForNavigation = (step: number) => {
    const fieldErrors: AdminBusFieldErrors = {};
    let nextRouteConfigs: RouteConfigForm[] | null = null;

    if (step === 1) {
      validateBusBasics(fieldErrors);
    }
    if (step === 2) {
      validateRoutePoints(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        const builtConfigs = buildRouteConfigsFromPoints(routePoints);
        if (builtConfigs.length === 0) {
          fieldErrors.routePoints = "Unable to build route segments from selected points.";
        } else {
          nextRouteConfigs = builtConfigs;
        }
      }
    }
    if (step === 3) {
      validateRoutePairs(fieldErrors);
    }

    return { fieldErrors, nextRouteConfigs };
  };

  const handleStepChipClick = (targetStep: number) => {
    if (targetStep === currentStep) return;

    if (targetStep < currentStep) {
      setAdminBusError("");
      setAdminBusFieldErrors({});
      setCurrentStep(targetStep);
      return;
    }

    let builtConfigsToApply: RouteConfigForm[] | null = null;
    for (let step = currentStep; step < targetStep; step += 1) {
      const { fieldErrors, nextRouteConfigs } = validateStepForNavigation(step);
      if (Object.keys(fieldErrors).length > 0) {
        setAdminBusFieldErrors(fieldErrors);
        setAdminBusError("Please fix the highlighted fields.");
        return;
      }
      if (nextRouteConfigs) {
        builtConfigsToApply = nextRouteConfigs;
      }
    }

    if (builtConfigsToApply) {
      setRouteConfigs(builtConfigsToApply);
    }

    setAdminBusError("");
    setAdminBusFieldErrors({});
    setCurrentStep(targetStep);
  };

  const handlePreviousStep = () => {
    setAdminBusError("");
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleAdminBusSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (currentStep < formSteps.length) {
      handleNextStep();
      return;
    }

    setAdminBusError("");
    setAdminBusMessage("");
    const fieldErrors: AdminBusFieldErrors = {};
    validateBusBasics(fieldErrors);
    validateRoutePoints(fieldErrors);
    validateRoutePairs(fieldErrors);
    validateBusImage(fieldErrors);

    if (Object.keys(fieldErrors).length > 0) {
      setAdminBusFieldErrors(fieldErrors);
      setAdminBusError("Please fix the highlighted fields.");
      return;
    }
    setAdminBusFieldErrors({});

    try {
      setSavingBus(true);
      const formData = new FormData();
      formData.append("busName", busName);
      formData.append("busNumber", busNumber);
      formData.append("capacity", String(capacity));
      formData.append("autoRenewCapacity", String(autoRenewCapacity));
      formData.append("availabilityStartDate", availabilityStartDate);
      formData.append("availabilityEndDate", availabilityEndDate);

      const serializedRoutePairs = JSON.stringify(
        routeConfigs.map((route) => ({
          pickupLocationId: route.pickupLocationId,
          dropLocationId: route.dropLocationId,
          distanceKm: route.distanceKm,
          pickupTime: route.pickupTime,
          dropTime: route.dropTime,
          materialFares: route.materialFares,
          dateOverrides: route.dateOverrides.map((override) => ({
            date: override.date,
            fares: override.fares,
          })),
        })),
      );
      const serializedRoutePoints = JSON.stringify(
        routePoints.map((point, pointIndex) => {
          const segmentMetric = getRouteSegmentMetric(pointIndex);
          const fallbackDistance = pointIndex < routeConfigs.length ? Number(routeConfigs[pointIndex]?.distanceKm ?? 0) : 0;
          const distanceToNextKm = pointIndex < routePoints.length - 1
            ? Number((segmentMetric?.distanceKm ?? fallbackDistance).toFixed(2))
            : 0;
          const durationToNextMinutes = pointIndex < routePoints.length - 1
            ? Number((segmentMetric?.durationMinutes ?? 0).toFixed(1))
            : 0;

          return {
            locationId: point.locationId,
            pointCategory: point.pointCategory,
            pointTime: point.pointTime,
            distanceToNextKm,
            durationToNextMinutes,
          };
        }),
      );
      formData.append("routePairsConfig", serializedRoutePairs);
      formData.append("routesConfig", serializedRoutePairs);
      formData.append("routePointsConfig", serializedRoutePoints);

      if (busImages[0]) {
        formData.append("busImages", busImages[0]);
      }

      const endpoint = isEditMode && busId ? `/api/admin/buses/${busId}` : "/api/admin/buses";
      const response = await fetch(endpoint, {
        method: isEditMode ? "PATCH" : "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        setAdminBusError(payload?.message || `Failed to ${isEditMode ? "update" : "add"} bus.`);
        return;
      }

      setAdminBusMessage(payload?.message || (isEditMode ? "Bus updated successfully." : "Bus added successfully."));
      await dispatch(fetchUser()).unwrap();
      initialFormSnapshotRef.current = currentFormSnapshot;
      router.push(successHref);
    } catch (error: unknown) {
      setAdminBusError(error instanceof Error ? error.message : `Failed to ${isEditMode ? "update" : "add"} bus.`);
    } finally {
      setSavingBus(false);
    }
  };

  if (!isAdminRole) return null;

  if (isEditMode && initializingEdit) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/75">
        Loading bus details...
      </div>
    );
  }

  if (isEditMode && !busId) {
    return (
      <div className="rounded-2xl border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-300">
        Invalid bus id.
      </div>
    );
  }

  if (isEditMode && adminBusError === "Bus not found.") {
    return (
      <div className="rounded-2xl border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-300">
        Bus not found.
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(211,228,90,0.14),_transparent_45%),#1C2318] p-4 text-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.55)] sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#F3F8BC] sm:text-2xl">
            {isEditMode ? "Edit Bus Profile" : isLockedAdmin ? "Register Your First Bus" : "Bus Setup"}
          </h2>
          <p className="mt-1 text-sm text-white/65">
            Keep details accurate so routing, capacity and allocations work reliably.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (hasUnsavedChanges) {
              const shouldLeave = window.confirm(
                "Some saved changes might be lost if you leave this page. Continue?",
              );
              if (!shouldLeave) return;
            }
            router.push(cancelHref);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
        >
          <Icon icon="solar:close-circle-outline" className="text-base" />
          Cancel
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        {formSteps.map((step) => {
          const active = currentStep === step.id;
          const completed = currentStep > step.id;
          return (
            <button
              type="button"
              key={step.id}
              onClick={() => handleStepChipClick(step.id)}
              className={`rounded-2xl border px-3 py-3 transition ${
                active
                  ? "border-[#C9D957]/55 bg-[#2D3725]"
                  : completed
                  ? "border-[#C9D957]/35 bg-[#24301F]"
                  : "border-white/10 bg-white/5"
              } ${active ? "cursor-default" : "cursor-pointer hover:border-[#C9D957]/45 hover:bg-[#273222]"}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                    completed
                      ? "bg-[#C9D957] text-black"
                      : active
                      ? "bg-[#C9D957]/20 text-[#E5F38E]"
                      : "bg-white/10 text-white/70"
                  }`}
                >
                  {completed ? <Icon icon="solar:check-circle-bold" /> : <Icon icon={step.icon} />}
                </span>
                <p className={`text-xs font-semibold sm:text-sm ${active || completed ? "text-white" : "text-white/65"}`}>
                  {step.label}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleAdminBusSubmit} className="mt-7 w-full max-w-full space-y-6">
        {currentStep === 1 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/80">
              <span className="mb-1 inline-flex items-center gap-2 font-medium">
                <Icon icon="solar:bus-outline" className="text-base text-[#DDEB83]" />
                Bus Name <span className="text-red-400">*</span>
              </span>
              <input
                value={busName}
                onChange={(event) => setBusName(event.target.value)}
                placeholder="e.g. Hapus Express 01"
                className={`mt-2 w-full rounded-xl border bg-transparent px-3 py-2.5 text-white outline-none transition ${
                  adminBusFieldErrors.busName
                    ? "border-red-500"
                    : "border-white/15 focus:border-[#DDEB83]/60"
                }`}
              />
              {adminBusFieldErrors.busName && <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors.busName}</p>}
            </label>

            <label className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/80">
              <span className="mb-1 inline-flex items-center gap-2 font-medium">
                <Icon icon="solar:tag-horizontal-outline" className="text-base text-[#DDEB83]" />
                Bus Number <span className="text-red-400">*</span>
              </span>
              <input
                value={busNumber}
                onChange={(event) => setBusNumber(formatBusNumberInput(event.target.value))}
                placeholder="MH-02-BL-2254"
                className={`mt-2 w-full rounded-xl border bg-transparent px-3 py-2.5 text-white uppercase outline-none transition ${
                  adminBusFieldErrors.busNumber
                    ? "border-red-500"
                    : "border-white/15 focus:border-[#DDEB83]/60"
                }`}
              />
              <p className="mt-1 text-xs text-white/50">Format: AA-00-AA-0000</p>
              {adminBusFieldErrors.busNumber && <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors.busNumber}</p>}
            </label>

            <label className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/80">
              <span className="mb-1 inline-flex items-center gap-2 font-medium">
                <Icon icon="solar:weight-outline" className="text-base text-[#DDEB83]" />
                Capacity (KG) <span className="text-red-400">*</span>
              </span>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value) || 1)}
                placeholder="Capacity"
                className={`mt-2 w-full rounded-xl border bg-transparent px-3 py-2.5 text-white outline-none transition ${
                  adminBusFieldErrors.capacity
                    ? "border-red-500"
                    : "border-white/15 focus:border-[#DDEB83]/60"
                }`}
              />
              {adminBusFieldErrors.capacity && <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors.capacity}</p>}
            </label>

            <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/80">
              <p className="mb-1 inline-flex items-center gap-2 font-medium">
                <Icon icon="solar:calendar-outline" className="text-base text-[#DDEB83]" />
                Availability Date Range <span className="text-red-400">*</span>
              </p>
              <div className="mt-2">
                <CustomDateRangePicker
                  startDate={availabilityStartDate}
                  endDate={availabilityEndDate}
                  onChange={({ startDate, endDate }) => {
                    setAvailabilityStartDate(startDate);
                    setAvailabilityEndDate(endDate);
                  }}
                  error={adminBusFieldErrors.availabilityRange}
                  minDate={new Date().toISOString().slice(0, 10)}
                />
              </div>
              {adminBusFieldErrors.availabilityRange && (
                <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors.availabilityRange}</p>
              )}
            </div>

            <div className="md:col-span-2 rounded-2xl border border-white/12 bg-[#242D1D] p-4">
              <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-white/90">
                <input
                  type="checkbox"
                  checked={autoRenewCapacity}
                  onChange={(event) => setAutoRenewCapacity(event.target.checked)}
                  className="h-4 w-4 accent-[#DDEB83]"
                />
                Auto renew selected date capacity
              </label>
              <p className="mt-1 text-xs text-white/60">
                Keeps the selected default capacity for each new scheduling cycle.
              </p>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/5 p-4">
              <div>
                <p className="text-sm font-semibold text-[#E5F38E]">Route Timeline</p>
                <p className="text-xs text-white/65">Drag only from the handle to swap locations left or right.</p>
              </div>
              <button
                type="button"
                onClick={addRoutePoint}
                className="inline-flex items-center gap-2 rounded-xl bg-[#D1DF63] px-3 py-2 text-sm font-semibold text-[#171D13] transition hover:bg-[#DEE97A]"
              >
                <Icon icon="solar:add-circle-bold" />
                Add Point
              </button>
            </div>

            <div
              ref={routeTimelineRef}
              className="max-w-full overflow-x-auto rounded-2xl border border-white/12 bg-[#20281A] p-3 pb-4"
            >
              <div className="flex min-w-max snap-x snap-mandatory items-stretch gap-3">
                {routePoints.map((point, pointIndex) => {
                  const pointLabel = locationNameById.get(point.locationId) || "Select location";
                  const isActive = activeRoutePointIndex === pointIndex;
                  const isDragging = draggingPointIndex === pointIndex;
                  const segmentMetric = getRouteSegmentMetric(pointIndex);
                  const segmentDistance = Number(segmentMetric?.distanceKm ?? 0);
                  return (
                    <React.Fragment key={`route-point-chip-${pointIndex}`}>
                      <div
                        ref={(element) => {
                          routeTileRefs.current[pointIndex] = element;
                        }}
                        className={`group flex shrink-0 snap-start items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "border-[#D9E87B]/70 bg-[#2B361F]"
                            : "border-white/15 bg-[#252F1D] hover:border-[#D9E87B]/35"
                        } ${isDragging ? "scale-[1.02] border-[#D9E87B] shadow-lg shadow-[#D9E87B]/20" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveRoutePointIndex(pointIndex)}
                          className="flex items-center gap-2"
                        >
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isActive ? "bg-[#D9E87B] text-black" : "bg-white/15 text-white"}`}>
                            {pointIndex + 1}
                          </span>
                          <Icon
                            icon={point.pointCategory === "pickup" ? "solar:map-point-wave-bold" : "solar:map-point-bold"}
                            className={`text-base ${point.pointCategory === "pickup" ? "text-emerald-300" : "text-orange-300"}`}
                          />
                          <span className="max-w-[160px] truncate">{pointLabel}</span>
                        </button>
                        <button
                          type="button"
                          onPointerDown={(event) => startRouteTileDrag(pointIndex, event)}
                          className="ml-1 inline-flex h-7 w-7 touch-none cursor-grab items-center justify-center rounded-lg border border-white/15 bg-black/20 text-white/70 transition hover:border-[#D9E87B]/50 hover:text-[#E5F38E] active:cursor-grabbing"
                          title="Drag to reorder left/right"
                          aria-label={`Drag to reorder point ${pointIndex + 1}`}
                        >
                          <Icon icon="solar:hamburger-menu-linear" className="text-sm" />
                        </button>
                      </div>
                      {pointIndex < routePoints.length - 1 && (
                        <div className="flex items-center gap-2 px-1">
                          <Icon icon="solar:arrow-right-linear" className="text-white/50" />
                          <span className="text-xs text-white/55">
                            {segmentDistance > 0
                              ? `${segmentDistance.toFixed(2)} km`
                              : "--"}
                          </span>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {adminBusFieldErrors.routePoints && (
              <p className="text-xs text-red-400">{adminBusFieldErrors.routePoints}</p>
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
              <div className="min-w-0 space-y-4 rounded-2xl border border-white/12 bg-white/5 p-4 lg:col-span-3">
                {activeRoutePoint ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#E5F38E]">Point {activeRoutePointIndex + 1}</p>
                        <p className="text-xs text-white/60">
                          {activeRoutePointIndex === 0
                            ? "Starting point"
                            : activeRoutePointDistance > 0
                            ? `${activeRoutePointDistance.toFixed(2)} km${!hasSegmentRoadMetrics ? " (estimated)" : ""} from previous point`
                            : "Distance unavailable (OpenRouteService unavailable)"}
                        </p>
                      </div>
                      {routePoints.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeRoutePoint(activeRoutePointIndex)}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-300/35 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
                        >
                          <Icon icon="solar:trash-bin-trash-outline" />
                          Remove Point
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="text-sm text-white/80">
                        Location <span className="text-red-400">*</span>
                        <select
                          value={activeRoutePoint.locationId}
                          onChange={(event) =>
                            updateRoutePoint(activeRoutePointIndex, (current) => ({
                              ...current,
                              locationId: event.target.value,
                            }))
                          }
                          className={`mt-2 w-full rounded-xl border bg-transparent px-3 py-2.5 text-white outline-none transition ${
                            adminBusFieldErrors[`routePoint.${activeRoutePointIndex}.locationId`]
                              ? "border-red-500"
                              : "border-white/15 focus:border-[#DDEB83]/60"
                          }`}
                        >
                          <option value="">Select location</option>
                          {locations.map((location) => (
                            <option key={location._id} value={location._id}>
                              {location.name} ({location.city})
                            </option>
                          ))}
                        </select>
                        {adminBusFieldErrors[`routePoint.${activeRoutePointIndex}.locationId`] && (
                          <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors[`routePoint.${activeRoutePointIndex}.locationId`]}</p>
                        )}
                      </label>

                      <label className="text-sm text-white/80">
                        Category <span className="text-red-400">*</span>
                        <select
                          value={activeRoutePoint.pointCategory}
                          onChange={(event) =>
                            updateRoutePoint(activeRoutePointIndex, (current) => ({
                              ...current,
                              pointCategory: event.target.value as "pickup" | "drop",
                            }))
                          }
                          className={`mt-2 w-full rounded-xl border bg-transparent px-3 py-2.5 text-white outline-none transition ${
                            adminBusFieldErrors[`routePoint.${activeRoutePointIndex}.pointCategory`]
                              ? "border-red-500"
                              : "border-white/15 focus:border-[#DDEB83]/60"
                          }`}
                        >
                          <option value="pickup">Pickup</option>
                          <option value="drop">Drop</option>
                        </select>
                        {adminBusFieldErrors[`routePoint.${activeRoutePointIndex}.pointCategory`] && (
                          <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors[`routePoint.${activeRoutePointIndex}.pointCategory`]}</p>
                        )}
                      </label>

                      <label className="text-sm text-white/80 md:col-span-2">
                        Point Time <span className="text-red-400">*</span>
                        <div className="mt-2">
                          <CustomTimePicker
                            value={activeRoutePoint.pointTime}
                            onChange={(nextTime) =>
                              updateRoutePoint(activeRoutePointIndex, (current) => ({
                                ...current,
                                pointTime: nextTime,
                              }))
                            }
                            error={adminBusFieldErrors[`routePoint.${activeRoutePointIndex}.pointTime`]}
                          />
                        </div>
                        {adminBusFieldErrors[`routePoint.${activeRoutePointIndex}.pointTime`] && (
                          <p className="mt-1 text-xs text-red-400">{adminBusFieldErrors[`routePoint.${activeRoutePointIndex}.pointTime`]}</p>
                        )}
                      </label>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => openInlineLocationCreator(activeRoutePointIndex)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#D1DF63]/45 bg-[#293421] px-3 py-2 text-sm font-semibold text-[#E5F38E] transition hover:border-[#D1DF63]/70"
                      >
                        <Icon icon="solar:map-point-add-bold" />
                        Add New Location with Map
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-white/65">Select a route point to edit.</p>
                )}
              </div>

              <div className="min-w-0 rounded-2xl border border-white/12 bg-white/5 p-4 lg:col-span-2">
                <p className="text-sm font-semibold text-[#E5F38E]">Route Map</p>
                <p className="mt-1 text-xs text-white/65">
                  Real road distance and estimated time are fetched via OpenRouteService driving-car.
                </p>
                <div className="mt-3">
                  {routePreviewPoints.length > 0 ? (
                    <RoutePreviewMap
                      points={routePreviewPoints}
                      routeGeometry={roadRouteGeometry}
                      heightClassName="h-72"
                    />
                  ) : (
                    <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/20 p-4 text-center text-xs text-white/60">
                      Select mapped locations to generate route preview.
                    </div>
                  )}
                </div>
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                  <p>
                    Total route estimate:{" "}
                    <span className="font-semibold text-[#E5F38E]">
                      {hasRoadSummary
                        ? `${totalRouteDistance} km${totalRouteDurationMinutes > 0 ? ` • ${totalRouteDurationMinutes} min` : ""}`
                        : "--"}
                    </span>
                  </p>
                  {roadRouteLoading && <p className="mt-1 text-white/55">Calculating road route...</p>}
                  {!roadRouteLoading && roadRouteError && (
                    <p className="mt-1 text-amber-200">
                      OpenRouteService unavailable. Form still works, but distance is hidden.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {showInlineLocationCreator && (
              <div className="rounded-2xl border border-[#D1DF63]/35 bg-[#252F1D] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#E5F38E]">
                      Add Location for Point {showInlineLocationCreator.pointIndex + 1}
                    </p>
                    <p className="text-xs text-white/65">Pick map coordinates to enable distance estimation.</p>
                  </div>
                  <button
                    type="button"
                    onClick={resetInlineLocationState}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                  >
                    <Icon icon="solar:close-circle-outline" />
                    Close
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-sm text-white/80">
                    Location Name <span className="text-red-400">*</span>
                    <input
                      value={inlineLocationForm.name}
                      onChange={(event) =>
                        setInlineLocationForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-white/15 bg-transparent px-3 py-2.5 text-white outline-none focus:border-[#DDEB83]/60"
                      placeholder="e.g. Nashik Market Yard"
                    />
                    {inlineLocationFieldErrors.name && <p className="mt-1 text-xs text-red-400">{inlineLocationFieldErrors.name}</p>}
                  </label>

                  <label className="text-sm text-white/80">
                    Address <span className="text-red-400">*</span>
                    <input
                      value={inlineLocationForm.address}
                      onChange={(event) =>
                        setInlineLocationForm((prev) => ({ ...prev, address: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-white/15 bg-transparent px-3 py-2.5 text-white outline-none focus:border-[#DDEB83]/60"
                      placeholder="Street / area"
                    />
                    {inlineLocationFieldErrors.address && <p className="mt-1 text-xs text-red-400">{inlineLocationFieldErrors.address}</p>}
                  </label>

                  <label className="text-sm text-white/80">
                    City <span className="text-red-400">*</span>
                    <input
                      value={inlineLocationForm.city}
                      onChange={(event) =>
                        setInlineLocationForm((prev) => ({ ...prev, city: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-white/15 bg-transparent px-3 py-2.5 text-white outline-none focus:border-[#DDEB83]/60"
                    />
                    {inlineLocationFieldErrors.city && <p className="mt-1 text-xs text-red-400">{inlineLocationFieldErrors.city}</p>}
                  </label>

                  <label className="text-sm text-white/80">
                    State <span className="text-red-400">*</span>
                    <input
                      value={inlineLocationForm.state}
                      onChange={(event) =>
                        setInlineLocationForm((prev) => ({ ...prev, state: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-white/15 bg-transparent px-3 py-2.5 text-white outline-none focus:border-[#DDEB83]/60"
                    />
                    {inlineLocationFieldErrors.state && <p className="mt-1 text-xs text-red-400">{inlineLocationFieldErrors.state}</p>}
                  </label>

                  <label className="text-sm text-white/80">
                    ZIP <span className="text-red-400">*</span>
                    <input
                      value={inlineLocationForm.zip}
                      onChange={(event) =>
                        setInlineLocationForm((prev) => ({ ...prev, zip: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-white/15 bg-transparent px-3 py-2.5 text-white outline-none focus:border-[#DDEB83]/60"
                    />
                    {inlineLocationFieldErrors.zip && <p className="mt-1 text-xs text-red-400">{inlineLocationFieldErrors.zip}</p>}
                  </label>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                    <p className="font-medium text-white/80">Coordinates</p>
                    <p className="mt-1">Lat: {inlineLocationForm.latitude || "--"}</p>
                    <p>Lng: {inlineLocationForm.longitude || "--"}</p>
                    {inlineLocationFieldErrors.coordinates && (
                      <p className="mt-1 text-red-400">{inlineLocationFieldErrors.coordinates}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <OpenStreetMapPicker
                    value={
                      inlineLocationForm.latitude && inlineLocationForm.longitude
                        ? {
                            latitude: Number(inlineLocationForm.latitude),
                            longitude: Number(inlineLocationForm.longitude),
                          }
                        : null
                    }
                    searchQuery={inlineLocationSearchQuery}
                    onChange={({ latitude, longitude }) =>
                      setInlineLocationForm((prev) => ({
                        ...prev,
                        latitude: latitude.toFixed(6),
                        longitude: longitude.toFixed(6),
                      }))
                    }
                    onLocationResolved={applyResolvedInlineLocation}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleInlineLocationCreate}
                    disabled={savingInlineLocation}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#D1DF63] px-4 py-2 text-sm font-semibold text-[#1A2015] transition hover:bg-[#DEE97A] disabled:opacity-60"
                  >
                    <Icon icon="solar:diskette-linear" />
                    {savingInlineLocation ? "Saving..." : "Save Location"}
                  </button>
                  {inlineLocationMessage && <p className="text-xs text-emerald-300">{inlineLocationMessage}</p>}
                  {inlineLocationError && <p className="text-xs text-red-400">{inlineLocationError}</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-5">
            <div className="min-w-0 rounded-2xl border border-white/12 bg-white/5 p-5">
              <p className="text-lg font-semibold text-[#E5F38E]">Route-Wide Pricing</p>
              <p className="mt-1 text-sm text-white/70">
                Set fares once for the full route: <span className="font-semibold">{startRoutePointLabel}</span> to{" "}
                <span className="font-semibold">{endRoutePointLabel}</span>.
              </p>
              <p className="mt-2 text-sm text-white/70">
                {hasRoadSummary
                  ? `Total road distance: ${formulaDistanceKm.toFixed(2)} km`
                  : "OpenRouteService unavailable. Segment distances are hidden and fare is split equally."}
              </p>
              {roadRouteError && (
                <p className="mt-1 text-xs text-amber-200">
                  OpenRouteService unavailable. You can still continue.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/12 bg-white/5 p-5">
              <p className="text-lg font-semibold text-[#E5F38E]">Category Fare Input (INR)</p>
              <p className="mt-1 text-sm text-white/70">
                Enter full-route price per category. Segment fares are auto-calculated by formula.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {materialCategoryMeta.map((category) => (
                  <label
                    key={`formula-fare-${category.key}`}
                    className="rounded-xl border border-white/10 bg-black/20 p-3 text-white/85"
                  >
                    <span className="flex items-center gap-2 text-base font-medium">
                      <Icon icon={category.icon} className="text-xl text-[#DDEB83]" />
                      {category.key}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={fullRouteMaterialFares[category.key] ?? 0}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value) || 0;
                        const nextFares = {
                          ...fullRouteMaterialFares,
                          [category.key]: nextValue,
                        };
                        applyFullRoutePricingFormula(nextFares);
                      }}
                      className="mt-2 w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-lg font-semibold text-[#F4F7CE] outline-none focus:border-[#DDEB83]/60"
                    />
                    {category.key === "Other" && (
                      <p className="mt-1 text-xs text-white/55">
                        Other is auto-kept higher than all standard categories.
                      </p>
                    )}
                  </label>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-[#DDEB83]/25 bg-[#26311F] p-3">
                <p className="text-sm font-semibold text-[#E5F38E]">
                  Applied Formula
                </p>
                <p className="mt-1 text-sm text-white/80">
                  {pricingFormulaText || "Segment Fare = Full Route Fare × (Segment Distance / Total Route Distance)"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/12 bg-white/5 p-5">
              <p className="text-lg font-semibold text-[#E5F38E]">Segment Fare Preview</p>
              <p className="mt-1 text-sm text-white/70">
                Auto-distributed fares for each route segment.
              </p>
              <div className="mt-3 space-y-3">
                {routeConfigs.map((route, routeIndex) => {
                  const pickupLabel = locationNameById.get(route.pickupLocationId) || `Point ${routeIndex + 1}`;
                  const dropLabel = locationNameById.get(route.dropLocationId) || `Point ${routeIndex + 2}`;
                  const segmentMetric = getRouteSegmentMetric(routeIndex);
                  const segmentDistance = Number(segmentMetric?.distanceKm ?? 0);
                  return (
                    <div key={`formula-preview-${routeIndex}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="break-words text-sm font-semibold text-white">
                        Segment {routeIndex + 1}: {pickupLabel} → {dropLabel}
                      </p>
                      <p className="mt-1 text-xs text-white/65">
                        {segmentDistance > 0
                          ? `Distance: ${segmentDistance.toFixed(2)} km${!hasSegmentRoadMetrics ? " (estimated)" : ""}`
                          : "Distance: --"}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {materialCategoryMeta.map((category) => (
                          <div
                            key={`segment-preview-${routeIndex}-${category.key}`}
                            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80"
                          >
                            <span className="flex items-center gap-1">
                              <Icon icon={category.icon} className="text-sm text-[#DDEB83]" />
                              {category.key}
                            </span>
                            <p className="mt-0.5 text-sm font-semibold text-[#F4F7CE]">
                              ₹{Number(route.materialFares[category.key] ?? 0)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {adminBusFieldErrors["route.0.materialFares"] && (
                <p className="mt-2 text-xs text-red-400">{adminBusFieldErrors["route.0.materialFares"]}</p>
              )}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="min-w-0 rounded-2xl border border-white/12 bg-white/5 p-4 lg:col-span-3">
              <p className="text-sm font-semibold text-[#E5F38E]">Bus Image</p>
              <p className="mt-1 text-xs text-white/65">Upload one clear image for operator/admin listings.</p>

              <div
                {...getRootProps()}
                className={`mt-4 cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${
                  isDragActive
                    ? "border-[#DCEB81] bg-[#DCEB81]/10"
                    : adminBusFieldErrors.busImages
                    ? "border-red-500/70"
                    : "border-white/20 bg-black/20 hover:border-[#DCEB81]/55"
                }`}
              >
                <input {...getInputProps()} />
                <Icon icon="solar:gallery-add-outline" className="mx-auto text-3xl text-[#DCEB81]" />
                <p className="mt-2 text-sm text-white/80">
                  {isDragActive ? "Drop image here..." : "Drag & drop or click to upload"}
                </p>
                <p className="mt-1 text-xs text-white/55">PNG / JPG • Single image</p>
              </div>

              {adminBusFieldErrors.busImages && (
                <p className="mt-2 text-xs text-red-400">{adminBusFieldErrors.busImages}</p>
              )}

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {busImagePreviews.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-xl border border-white/15 bg-black/20">
                    <Image
                      src={item.preview}
                      alt={item.file.name}
                      width={640}
                      height={352}
                      unoptimized
                      className="h-44 w-full object-cover"
                    />
                    <p className="truncate px-3 py-2 text-xs text-white/70">{item.file.name}</p>
                  </div>
                ))}

                {busImagePreviews.length === 0 && editingBus?.busImages?.[0] && (
                  <div className="overflow-hidden rounded-xl border border-white/15 bg-black/20">
                    <Image
                      src={editingBus.busImages[0]}
                      alt="Current bus"
                      width={640}
                      height={352}
                      unoptimized
                      className="h-44 w-full object-cover"
                    />
                    <p className="px-3 py-2 text-xs text-white/70">Current uploaded image</p>
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 rounded-2xl border border-white/12 bg-white/5 p-4 lg:col-span-2">
              <p className="text-sm font-semibold text-[#E5F38E]">Submission Summary</p>
              <div className="mt-3 space-y-2 text-sm text-white/75">
                <div className="flex items-center justify-between">
                  <span>Bus</span>
                  <span className="font-medium text-white">{busName || "--"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Number</span>
                  <span className="font-medium text-white">{busNumber || "--"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Capacity</span>
                  <span className="font-medium text-white">{capacity} KG</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Route points</span>
                  <span className="font-medium text-white">{routePoints.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Route segments</span>
                  <span className="font-medium text-white">{routeConfigs.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Distance estimate</span>
                  <span className="font-medium text-[#DCEB81]">
                    {hasRoadSummary
                      ? `${totalRouteDistance} km`
                      : "--"}
                  </span>
                </div>
                <div className="border-t border-white/10 pt-2 text-xs text-white/60">
                  Availability: {availabilityStartDate || "--"} to {availabilityEndDate || "--"}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <div className="text-xs text-white/55">
            {loadingLocations ? "Loading location options..." : "Fields marked with * are required."}
          </div>
          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePreviousStep}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
              >
                <Icon icon="solar:arrow-left-outline" />
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={savingBus}
              className="inline-flex items-center gap-2 rounded-xl bg-[#D1DF63] px-5 py-2 text-sm font-semibold text-[#1A2015] transition hover:bg-[#DEE97A] disabled:opacity-60"
            >
              {currentStep === formSteps.length ? (
                <>
                  <Icon icon="solar:check-circle-bold" />
                  {savingBus ? "Saving..." : isEditMode ? "Update Bus" : "Create Bus"}
                </>
              ) : (
                <>
                  Next
                  <Icon icon="solar:arrow-right-outline" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {adminBusError && <p className="mt-4 text-sm text-red-400">{adminBusError}</p>}
      {adminBusMessage && <p className="mt-4 text-sm text-emerald-300">{adminBusMessage}</p>}
    </div>
  );
}
