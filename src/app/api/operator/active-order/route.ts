import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import { runOrderCleanupSafely } from "@/app/api/lib/orderCleanup";
import User from "@/app/api/models/userModel";
import Bus from "@/app/api/models/busModel";
import Order from "@/app/api/models/orderModel";

const JWT_SECRET = process.env.JWT_SECRET!;
const ACTIVE_STATUSES = ["pending", "confirmed", "allocated", "in-transit"] as const;
const FINAL_STATUSES = ["delivered", "cancelled", "missed_package"] as const;
const ALL_ORDER_STATUSES = [...ACTIVE_STATUSES, ...FINAL_STATUSES] as const;
type OrderStatus = (typeof ALL_ORDER_STATUSES)[number];
type IncidentReportType = "customer_not_at_pickup" | "customer_not_at_drop";
type IncidentReportStatus = "attention_needed" | "office_collection_required";

type UnknownRecord = Record<string, unknown>;

type OperatorPeriod = {
  operatorId: unknown;
  operatorName?: string;
  operatorPhone?: string;
  startDate?: string | Date;
  endDate?: string | Date;
};

type RoutePathPoint = {
  sequence?: number;
  location?: unknown;
  pointCategory?: string;
  pointTime?: string;
};

type BusLean = {
  _id: unknown;
  busName?: string;
  busNumber?: string;
  busImages?: string[];
  operatorContactPeriods?: OperatorPeriod[];
  offices?: UnknownRecord[];
  routePath?: RoutePathPoint[];
};

type OrderLean = {
  _id: unknown;
  trackingId?: string;
  status?: string;
  orderDate?: string | Date;
  pickupLocation?: UnknownRecord;
  dropLocation?: UnknownRecord;
  assignedBus?: unknown;
  bus?: unknown;
  senderInfo?: UnknownRecord;
  receiverInfo?: UnknownRecord;
  pickupProofImage?: string;
  dropProofImage?: string;
  operatorNote?: string;
  adminNote?: string;
  orderReports?: unknown[];
  incidentReportType?: unknown;
  incidentReportStatus?: unknown;
  incidentReportNote?: unknown;
  incidentReportGuidance?: unknown;
  incidentReportAt?: unknown;
  incidentReportBy?: unknown;
  operatorIncidentType?: unknown;
  operatorIncidentStatus?: unknown;
  operatorIncidentNote?: unknown;
  operatorIncidentGuidance?: unknown;
  operatorIncidentAt?: unknown;
  operatorIncidentBy?: unknown;
  assignedOffice?: UnknownRecord;
  createdAt?: string | Date;
};

type OrderReportEntry = {
  reportType?: unknown;
  category?: unknown;
  title?: unknown;
  description?: unknown;
  createdBy?: unknown;
  createdByRole?: unknown;
  createdAt?: unknown;
  data?: unknown;
};

type IncidentReport = {
  reportType: IncidentReportType;
  category: string;
  title: string;
  description: string;
  createdBy: string;
  createdByRole: string;
  createdAt: string;
  data: {
    note: string;
    guidance: string;
    processingStatus: IncidentReportStatus;
    orderId?: string;
    busId?: string;
    officeAction?: string;
    customerMessage?: string;
    assignedOffice?: {
      officeName: string;
      address?: string;
      city: string;
      state: string;
      zip?: string;
      phone: string;
      latitude?: number | null;
      longitude?: number | null;
    };
    operatorLocation?: {
      latitude: number;
      longitude: number;
    };
  };
  type: IncidentReportType;
  status: IncidentReportStatus;
  note: string;
  guidance: string;
  reportedAt?: string;
  reportedBy?: string;
};

type GeoCoordinates = {
  latitude: number;
  longitude: number;
};

type AssignedOffice = {
  officeName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  assignedAt?: Date;
  assignmentReason?: string;
  customerMessage?: string;
};

const getContactInfo = (value: unknown) => {
  const source = value && typeof value === "object" ? (value as UnknownRecord) : {};
  return {
    name:
      toStringValue(source.name) ||
      toStringValue(source.senderName) ||
      toStringValue(source.receiverName),
    phone:
      toStringValue(source.phone) ||
      toStringValue(source.contact) ||
      toStringValue(source.senderContact) ||
      toStringValue(source.receiverContact),
  };
};

const INCIDENT_NOTE_PATTERN = /^\[report:(customer_not_at_pickup|customer_not_at_drop)\]\s*(.*)$/i;

const INCIDENT_LABELS: Record<IncidentReportType, string> = {
  customer_not_at_pickup: "Customer not at pickup",
  customer_not_at_drop: "Customer not at drop",
};

const INCIDENT_GUIDANCE: Record<IncidentReportType, string> = {
  customer_not_at_pickup: "Hold the shipment and confirm with the customer before dispatch.",
  customer_not_at_drop: "Collect the package from office.",
};

const INCIDENT_STATUS: Record<IncidentReportType, IncidentReportStatus> = {
  customer_not_at_pickup: "attention_needed",
  customer_not_at_drop: "office_collection_required",
};

const getLatestOrderReportEntry = (orderReports: unknown): OrderReportEntry | null => {
  if (!Array.isArray(orderReports) || orderReports.length === 0) return null;

  for (let index = orderReports.length - 1; index >= 0; index -= 1) {
    const report = orderReports[index];
    if (report && typeof report === "object" && !Array.isArray(report)) {
      return report as OrderReportEntry;
    }
  }

  return null;
};

const toStringValue = (value: unknown, fallback = ""): string => {
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
};

const toNumberValue = (value: unknown, fallback = Number.NaN): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getGeoCoordinates = (value: unknown): GeoCoordinates | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as UnknownRecord;
  const latitude = toNumberValue(record.latitude);
  const longitude = toNumberValue(record.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude };
  }

  const geoPoint = record.geoPoint;
  if (!geoPoint || typeof geoPoint !== "object") return null;
  const coordinates = Array.isArray((geoPoint as UnknownRecord).coordinates)
    ? ((geoPoint as UnknownRecord).coordinates as unknown[])
    : [];
  const geoLongitude = toNumberValue(coordinates[0]);
  const geoLatitude = toNumberValue(coordinates[1]);
  if (Number.isFinite(geoLatitude) && Number.isFinite(geoLongitude)) {
    return { latitude: geoLatitude, longitude: geoLongitude };
  }

  return null;
};

const toAssignedOffice = (value: unknown): AssignedOffice | null => {
  if (!value || typeof value !== "object") return null;
  const office = value as UnknownRecord;
  const officeName = toStringValue(office.officeName);
  const city = toStringValue(office.city);
  const state = toStringValue(office.state);
  const phone = toStringValue(office.phone);

  if (!officeName || !city || !state || !phone) return null;

  return {
    officeName,
    address: toStringValue(office.address),
    city,
    state,
    zip: toStringValue(office.zip),
    phone,
    latitude: Number.isFinite(toNumberValue(office.latitude)) ? toNumberValue(office.latitude) : null,
    longitude: Number.isFinite(toNumberValue(office.longitude)) ? toNumberValue(office.longitude) : null,
    assignedAt: office.assignedAt ? new Date(toStringValue(office.assignedAt)) : undefined,
    assignmentReason: toStringValue(office.assignmentReason),
    customerMessage: toStringValue(office.customerMessage),
  };
};

const calculateDistanceKm = (from: GeoCoordinates, to: GeoCoordinates): number => {
  const earthRadiusKm = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusKm * c).toFixed(2));
};

const getRouteIndex = (
  routePath: unknown,
  locationValue: unknown,
  pointCategory?: "pickup" | "drop",
): number | null => {
  const locationId = toStringValue(
    locationValue && typeof locationValue === "object"
      ? ((locationValue as UnknownRecord)._id ?? (locationValue as UnknownRecord).id)
      : locationValue,
  );
  if (!locationId || !Array.isArray(routePath)) return null;

  const sortedRoutePath = [...routePath]
    .filter((entry): entry is RoutePathPoint => Boolean(entry && typeof entry === "object"))
    .sort((left, right) => Number(left.sequence ?? 0) - Number(right.sequence ?? 0));

  for (let index = 0; index < sortedRoutePath.length; index += 1) {
    const routePoint = sortedRoutePath[index];
    const routeLocationId = toStringValue(routePoint.location);
    const routeCategory = toStringValue(routePoint.pointCategory).toLowerCase();
    if (routeLocationId !== locationId) continue;
    if (pointCategory && routeCategory && routeCategory !== pointCategory) continue;
    return Number(routePoint.sequence ?? index + 1);
  }

  return null;
};

const selectNearestOffice = (
  offices: unknown,
  referenceLocation: unknown,
  operatorLocation?: GeoCoordinates | null,
): AssignedOffice | null => {
  if (!Array.isArray(offices) || offices.length === 0) return null;

  const normalizedOffices = offices
    .map((office) => toAssignedOffice(office))
    .filter((office): office is AssignedOffice => office !== null);

  if (normalizedOffices.length === 0) return null;
  if (normalizedOffices.length === 1) return normalizedOffices[0];

  const referenceGeo = getGeoCoordinates(referenceLocation) || operatorLocation || null;
  if (!referenceGeo) {
    return normalizedOffices[0];
  }

  return normalizedOffices.reduce((closest, current) => {
    const currentGeo =
      current.latitude !== null && current.longitude !== null
        ? { latitude: current.latitude, longitude: current.longitude }
        : null;
    const closestGeo =
      closest.latitude !== null && closest.longitude !== null
        ? { latitude: closest.latitude, longitude: closest.longitude }
        : null;

    if (!currentGeo) return closest;
    if (!closestGeo) return current;

    const currentDistance = calculateDistanceKm(referenceGeo, currentGeo);
    const closestDistance = calculateDistanceKm(referenceGeo, closestGeo);
    return currentDistance < closestDistance ? current : closest;
  });
};

const normalizeDateOnly = (value: unknown): Date | null => {
  const parsed = new Date(toStringValue(value));
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
};

const toIsoDateTime = (value: unknown): string => {
  const parsed = new Date(toStringValue(value));
  if (Number.isNaN(parsed.getTime())) return new Date(0).toISOString();
  return parsed.toISOString();
};

const BUSINESS_TIMEZONE = "Asia/Kolkata";

const toDateKeyInBusinessTimezone = (value: unknown): string | null => {
  const parsed = new Date(toStringValue(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
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

const statusPriority = (status: OrderStatus): number => {
  if (status === "in-transit") return 0;
  if (status === "allocated") return 1;
  if (status === "confirmed") return 2;
  if (status === "pending") return 3;
  return 9;
};

const isBusAssignedToOperator = (operatorId: string, periods: unknown): boolean => {
  if (!Array.isArray(periods)) return false;
  return periods.some((period) => {
    if (!period || typeof period !== "object") return false;
    return toStringValue((period as UnknownRecord).operatorId) === operatorId;
  });
};

const isOrderInOperatorPeriods = (
  orderDateValue: unknown,
  operatorId: string,
  periods: unknown,
): boolean => {
  const orderDate = normalizeDateOnly(orderDateValue);
  if (!orderDate || !Array.isArray(periods)) return false;

  return periods.some((period) => {
    if (!period || typeof period !== "object") return false;
    const record = period as UnknownRecord;
    if (toStringValue(record.operatorId) !== operatorId) return false;
    const startDate = normalizeDateOnly(record.startDate);
    const endDate = normalizeDateOnly(record.endDate);
    if (!startDate || !endDate) return false;
    return orderDate >= startDate && orderDate <= endDate;
  });
};

const normalizeIncidentType = (value: unknown): IncidentReportType | null => {
  const normalized = toStringValue(value).trim().toLowerCase();
  if (normalized === "customer_not_at_pickup" || normalized === "customer_not_at_drop") {
    return normalized;
  }
  return null;
};

const buildIncidentNote = (type: IncidentReportType, extraNote = ""): string => {
  const trimmedExtraNote = extraNote.trim();
  const suffix = trimmedExtraNote ? ` ${trimmedExtraNote}` : "";
  return `[report:${type}] ${INCIDENT_LABELS[type]}. ${INCIDENT_GUIDANCE[type]}${suffix}`.trim();
};

const parseIncidentReport = (order: OrderLean): IncidentReport | null => {
  const reportEntry = getLatestOrderReportEntry(order.orderReports);
  const explicitType =
    normalizeIncidentType(reportEntry?.reportType) ||
    normalizeIncidentType(order.operatorIncidentType) ||
    normalizeIncidentType(order.incidentReportType);
  const reportData = reportEntry && typeof reportEntry.data === "object" && reportEntry.data !== null
    ? (reportEntry.data as UnknownRecord)
    : {};
  const noteSource =
    toStringValue(reportData.note) ||
    toStringValue(order.operatorIncidentNote) ||
    toStringValue(order.incidentReportNote) ||
    toStringValue(order.operatorNote) ||
    toStringValue(order.adminNote);
  const noteMatch = noteSource.match(INCIDENT_NOTE_PATTERN);
  const inferredType = normalizeIncidentType(noteMatch?.[1] ?? "");
  const type = explicitType || inferredType;

  if (!type) {
    return null;
  }

  const guidance =
    toStringValue(reportData.guidance) ||
    toStringValue(order.operatorIncidentGuidance || order.incidentReportGuidance) ||
    INCIDENT_GUIDANCE[type];
  const rawStatus = toStringValue(
    reportData.processingStatus || order.operatorIncidentStatus || order.incidentReportStatus,
  ).toLowerCase();
  const status = rawStatus === "office_collection_required"
    ? "office_collection_required"
    : INCIDENT_STATUS[type];
  const rawNote = toStringValue(
    reportData.note ||
      order.operatorIncidentNote ||
      order.incidentReportNote ||
      noteMatch?.[2] ||
      noteSource,
  ).trim();
  const note = rawNote.replace(INCIDENT_NOTE_PATTERN, "$2").trim() || buildIncidentNote(type);
  const title = toStringValue(reportEntry?.title) || INCIDENT_LABELS[type];
  const assignedOffice = toAssignedOffice(reportData.assignedOffice) || toAssignedOffice(order.assignedOffice);
  const customerMessage =
    toStringValue(reportData.customerMessage) ||
    assignedOffice?.customerMessage ||
    "";
  const officeAction =
    toStringValue(reportData.officeAction) ||
    (assignedOffice ? `Package held at ${assignedOffice.officeName}, ${assignedOffice.city}.` : "");
  const description =
    toStringValue(reportEntry?.description) ||
    customerMessage ||
    INCIDENT_GUIDANCE[type];
  const createdBy = toStringValue(reportEntry?.createdBy || order.operatorIncidentBy || order.incidentReportBy);
  const createdByRole = toStringValue(reportEntry?.createdByRole || "operator");
  const createdAt = toIsoDateTime(reportEntry?.createdAt || order.operatorIncidentAt || order.incidentReportAt || order.createdAt);
  const operatorLocation =
    reportData.operatorLocation && typeof reportData.operatorLocation === "object"
      ? {
          latitude: toNumberValue((reportData.operatorLocation as UnknownRecord).latitude),
          longitude: toNumberValue((reportData.operatorLocation as UnknownRecord).longitude),
        }
      : null;

  return {
    reportType: type,
    category: toStringValue(reportEntry?.category, "incident"),
    title,
    description,
    createdBy,
    createdByRole,
    createdAt,
    data: {
      note,
      guidance,
      processingStatus: status,
      orderId: toStringValue(order._id),
      officeAction,
      customerMessage,
      assignedOffice: assignedOffice
        ? {
            officeName: assignedOffice.officeName,
            address: assignedOffice.address,
            city: assignedOffice.city,
            state: assignedOffice.state,
            zip: assignedOffice.zip,
            phone: assignedOffice.phone,
            latitude: assignedOffice.latitude,
            longitude: assignedOffice.longitude,
          }
        : undefined,
      operatorLocation:
        operatorLocation &&
        Number.isFinite(operatorLocation.latitude) &&
        Number.isFinite(operatorLocation.longitude)
          ? operatorLocation
          : undefined,
    },
    type,
    status,
    note,
    guidance,
    reportedAt: createdAt,
    reportedBy: createdBy,
  };
};

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    try {
      await runOrderCleanupSafely();
    } catch (cleanupError: unknown) {
      console.error("[order-cleanup] Pre-read cleanup failed:", cleanupError);
    }

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const operator = await User.findById(userId).select("role");
    if (!operator || operator.role !== "operator") {
      return NextResponse.json(
        { success: false, message: "Operator access required." },
        { status: 403 },
      );
    }

    const buses = await Bus.find({
      "operatorContactPeriods.operatorId": operator._id,
    })
      .select("busName busNumber busImages operatorContactPeriods offices routePath")
      .lean<BusLean[]>();

    if (!Array.isArray(buses) || buses.length === 0) {
      return NextResponse.json(
        { success: true, order: null, orders: [], upcomingOrders: [], pastOrders: [], processedCount: 0 },
        { status: 200 },
      );
    }

    const busById = new Map<string, BusLean>();
    const relevantPeriodsByBusId = new Map<string, OperatorPeriod[]>();

    for (const bus of buses) {
      const busId = toStringValue(bus._id);
      if (!busId) continue;
      busById.set(busId, bus);

      const periods = Array.isArray(bus.operatorContactPeriods)
        ? bus.operatorContactPeriods.filter(
            (period) => toStringValue(period.operatorId) === toStringValue(operator._id),
          )
        : [];

      relevantPeriodsByBusId.set(busId, periods);
    }

    const busIds = Array.from(busById.keys());
    const busObjectIds = busIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (busIds.length === 0) {
      return NextResponse.json(
        { success: true, order: null, orders: [], upcomingOrders: [], pastOrders: [], processedCount: 0 },
        { status: 200 },
      );
    }

    const candidateOrders = await Order.find({
      $or: [{ assignedBus: { $in: busObjectIds } }, { bus: { $in: busObjectIds } }],
      status: { $in: ALL_ORDER_STATUSES },
    })
      .sort({ orderDate: 1, createdAt: -1 })
      .select(
        "_id trackingId status orderDate pickupLocation dropLocation assignedBus bus senderInfo receiverInfo pickupProofImage dropProofImage operatorNote adminNote orderReports incidentReportType incidentReportStatus incidentReportNote incidentReportGuidance incidentReportAt incidentReportBy operatorIncidentType operatorIncidentStatus operatorIncidentNote operatorIncidentGuidance operatorIncidentAt operatorIncidentBy assignedOffice createdAt",
      )
      .lean<OrderLean[]>();

    const mappedOrders = candidateOrders
      .map((order) => {
        const busId = toStringValue(order.assignedBus) || toStringValue(order.bus);
        const bus = busById.get(busId);
        if (!bus) return null;
        const incidentReport = parseIncidentReport(order);

        const orderDate = normalizeDateOnly(order.orderDate) ?? normalizeDateOnly(new Date().toISOString());
        if (!orderDate) return null;

        const periods = relevantPeriodsByBusId.get(busId) ?? [];
        const matchingPeriod = periods.find((period) => {
          const startDate = normalizeDateOnly(period.startDate);
          const endDate = normalizeDateOnly(period.endDate);
          if (!startDate || !endDate) return false;
          return orderDate >= startDate && orderDate <= endDate;
        });

        const hasOperatorAssignment = isBusAssignedToOperator(
          toStringValue(operator._id),
          bus.operatorContactPeriods,
        );
        if (!hasOperatorAssignment) return null;

        const status = (toStringValue(order.status, "pending").toLowerCase() as OrderStatus);
        const pickupRouteIndex = getRouteIndex(bus.routePath, order.pickupLocation, "pickup");
        const dropRouteIndex = getRouteIndex(bus.routePath, order.dropLocation, "drop");
        const currentTask = status === "in-transit" ? "drop" : "pickup";
        const currentRouteIndex = currentTask === "drop" ? dropRouteIndex : pickupRouteIndex;
        const assignedOffice =
          toAssignedOffice(incidentReport?.data?.assignedOffice) || toAssignedOffice(order.assignedOffice);

        if (!matchingPeriod) {
          const firstPeriod = periods[0];
          if (!firstPeriod) return null;
          const fallbackName = toStringValue(firstPeriod.operatorName, "Operator");
          const fallbackPhone = toStringValue(firstPeriod.operatorPhone);
          return {
            id: toStringValue(order._id),
            trackingId: toStringValue(order.trackingId, "TRACKING-PENDING"),
            status,
            orderDate: toIsoDateTime(order.orderDate),
            sender: getContactInfo(order.senderInfo),
            receiver: getContactInfo(order.receiverInfo),
            pickupLocation: {
              id: toStringValue(order.pickupLocation?._id || order.pickupLocation?.id),
              name: toStringValue(order.pickupLocation?.name),
              address: toStringValue(order.pickupLocation?.address),
              city: toStringValue(order.pickupLocation?.city),
              state: toStringValue(order.pickupLocation?.state),
              latitude: getGeoCoordinates(order.pickupLocation)?.latitude ?? null,
              longitude: getGeoCoordinates(order.pickupLocation)?.longitude ?? null,
            },
            dropLocation: {
              id: toStringValue(order.dropLocation?._id || order.dropLocation?.id),
              name: toStringValue(order.dropLocation?.name),
              address: toStringValue(order.dropLocation?.address),
              city: toStringValue(order.dropLocation?.city),
              state: toStringValue(order.dropLocation?.state),
              latitude: getGeoCoordinates(order.dropLocation)?.latitude ?? null,
              longitude: getGeoCoordinates(order.dropLocation)?.longitude ?? null,
            },
            pickupProofImage: toStringValue(order.pickupProofImage),
            dropProofImage: toStringValue(order.dropProofImage),
            operatorNote:
              incidentReport?.note || toStringValue(order.operatorNote) || toStringValue(order.adminNote),
            report: incidentReport,
            assignedOffice,
            routeMeta: {
              pickupIndex: pickupRouteIndex,
              dropIndex: dropRouteIndex,
              currentTask,
              currentIndex: currentRouteIndex,
            },
            bus: {
              id: busId,
              busName: toStringValue(bus.busName, "Assigned Bus"),
              busNumber: toStringValue(bus.busNumber),
              busImage: Array.isArray(bus.busImages) ? toStringValue(bus.busImages[0]) : "",
              operatorName: fallbackName,
              operatorPhone: fallbackPhone,
            },
          };
        }

        return {
          id: toStringValue(order._id),
          trackingId: toStringValue(order.trackingId, "TRACKING-PENDING"),
          status,
          orderDate: toIsoDateTime(order.orderDate),
          sender: getContactInfo(order.senderInfo),
          receiver: getContactInfo(order.receiverInfo),
          pickupLocation: {
            id: toStringValue(order.pickupLocation?._id || order.pickupLocation?.id),
            name: toStringValue(order.pickupLocation?.name),
            address: toStringValue(order.pickupLocation?.address),
            city: toStringValue(order.pickupLocation?.city),
            state: toStringValue(order.pickupLocation?.state),
            latitude: getGeoCoordinates(order.pickupLocation)?.latitude ?? null,
            longitude: getGeoCoordinates(order.pickupLocation)?.longitude ?? null,
          },
          dropLocation: {
            id: toStringValue(order.dropLocation?._id || order.dropLocation?.id),
            name: toStringValue(order.dropLocation?.name),
            address: toStringValue(order.dropLocation?.address),
            city: toStringValue(order.dropLocation?.city),
            state: toStringValue(order.dropLocation?.state),
            latitude: getGeoCoordinates(order.dropLocation)?.latitude ?? null,
            longitude: getGeoCoordinates(order.dropLocation)?.longitude ?? null,
          },
          pickupProofImage: toStringValue(order.pickupProofImage),
          dropProofImage: toStringValue(order.dropProofImage),
          operatorNote:
            incidentReport?.note || toStringValue(order.operatorNote) || toStringValue(order.adminNote),
          report: incidentReport,
          assignedOffice,
          routeMeta: {
            pickupIndex: pickupRouteIndex,
            dropIndex: dropRouteIndex,
            currentTask,
            currentIndex: currentRouteIndex,
          },
          bus: {
            id: busId,
            busName: toStringValue(bus.busName, "Assigned Bus"),
            busNumber: toStringValue(bus.busNumber),
            busImage: Array.isArray(bus.busImages) ? toStringValue(bus.busImages[0]) : "",
            operatorName: toStringValue(matchingPeriod.operatorName, "Operator"),
            operatorPhone: toStringValue(matchingPeriod.operatorPhone),
          },
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

    const todayKey = toDateKeyInBusinessTimezone(new Date().toISOString());

    const activeOrders = mappedOrders
      .filter((order) => {
        const status = toStringValue(order.status).toLowerCase() as OrderStatus;
        if (!ACTIVE_STATUSES.includes(status as (typeof ACTIVE_STATUSES)[number])) return false;
        const orderDateKey = toDateKeyInBusinessTimezone(order.orderDate);
        if (!todayKey || !orderDateKey) return false;
        return orderDateKey === todayKey;
      })
      .sort((a, b) => {
        const statusCompare = statusPriority(a.status) - statusPriority(b.status);
        if (statusCompare !== 0) return statusCompare;
        const routeIndexCompare =
          Number(a.routeMeta?.currentIndex ?? Number.MAX_SAFE_INTEGER) -
          Number(b.routeMeta?.currentIndex ?? Number.MAX_SAFE_INTEGER);
        if (routeIndexCompare !== 0) return routeIndexCompare;
        return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
      });

    const upcomingOrders = mappedOrders
      .filter((order) => {
        const status = toStringValue(order.status).toLowerCase() as OrderStatus;
        if (FINAL_STATUSES.includes(status as (typeof FINAL_STATUSES)[number])) return false;
        const orderDateKey = toDateKeyInBusinessTimezone(order.orderDate);
        if (!todayKey || !orderDateKey) return true;
        return orderDateKey !== todayKey;
      })
      .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

    const pastOrders = mappedOrders
      .filter((order) => {
        const status = toStringValue(order.status).toLowerCase() as OrderStatus;
        return FINAL_STATUSES.includes(status as (typeof FINAL_STATUSES)[number]);
      })
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

    const processedCount = pastOrders.length;

    return NextResponse.json(
      {
        success: true,
        orders: activeOrders,
        upcomingOrders,
        pastOrders,
        processedCount,
        order: activeOrders[0] ?? null,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load active operator order.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const operator = await User.findById(userId).select("role");
    if (!operator || operator.role !== "operator") {
      return NextResponse.json(
        { success: false, message: "Operator access required." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      orderId?: string;
      reportType?: string;
      incidentType?: string;
      note?: string;
      incidentNote?: string;
      operatorLocation?: {
        latitude?: number;
        longitude?: number;
      };
    };

    const orderId = toStringValue(body.orderId).trim();
    const reportType =
      normalizeIncidentType(body.reportType) || normalizeIncidentType(body.incidentType);
    const noteInput = toStringValue(body.note || body.incidentNote).trim();

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json(
        { success: false, message: "Valid orderId is required." },
        { status: 400 },
      );
    }

    if (!reportType) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid reportType is required.",
        },
        { status: 400 },
      );
    }

    const order = await Order.findById(orderId).select(
      "_id trackingId status orderDate assignedBus bus pickupLocation dropLocation senderInfo receiverInfo pickupProofImage dropProofImage operatorNote adminNote orderReports incidentReportType incidentReportStatus incidentReportNote incidentReportGuidance incidentReportAt incidentReportBy operatorIncidentType operatorIncidentStatus operatorIncidentNote operatorIncidentGuidance operatorIncidentAt operatorIncidentBy createdAt totalAmount cancellationDetails",
    );
    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found." }, { status: 404 });
    }

    const effectiveBusId = toStringValue(order.assignedBus) || toStringValue(order.bus);
    if (!effectiveBusId || !mongoose.Types.ObjectId.isValid(effectiveBusId)) {
      return NextResponse.json(
        { success: false, message: "Order does not have a valid bus assignment." },
        { status: 400 },
      );
    }

    const operatorLocation =
      body.operatorLocation &&
      Number.isFinite(toNumberValue(body.operatorLocation.latitude)) &&
      Number.isFinite(toNumberValue(body.operatorLocation.longitude))
        ? {
            latitude: toNumberValue(body.operatorLocation.latitude),
            longitude: toNumberValue(body.operatorLocation.longitude),
          }
        : null;

    const bus = await Bus.findById(effectiveBusId).select("operatorContactPeriods offices");
    if (!bus) {
      return NextResponse.json({ success: false, message: "Bus not found." }, { status: 404 });
    }

    const canOperate =
      isOrderInOperatorPeriods(order.orderDate, toStringValue(operator._id), bus.operatorContactPeriods) ||
      isBusAssignedToOperator(toStringValue(operator._id), bus.operatorContactPeriods);
    if (!canOperate) {
      return NextResponse.json(
        { success: false, message: "You can report only orders from your assigned bus period." },
        { status: 403 },
      );
    }

    const currentStatus = toStringValue(order.status, "pending").toLowerCase();
    if (currentStatus === "delivered" || currentStatus === "cancelled" || currentStatus === "missed_package") {
      return NextResponse.json(
        { success: false, message: "Completed orders cannot be reported." },
        { status: 409 },
      );
    }

    const incidentGuidance = INCIDENT_GUIDANCE[reportType];
    const incidentStatus = INCIDENT_STATUS[reportType];
    const incidentNote = buildIncidentNote(reportType, noteInput);
    const reportedAt = new Date();
    const assignedOffice =
      reportType === "customer_not_at_drop"
        ? selectNearestOffice(bus.offices, order.dropLocation, operatorLocation)
        : null;
    const customerMessage = assignedOffice
      ? `Your package is dropped at ${assignedOffice.officeName}, ${assignedOffice.city}. Please collect it from the office.`
      : "";
    const officeAction = assignedOffice
      ? `Assigned nearest office ${assignedOffice.officeName}, ${assignedOffice.city} for customer collection.`
      : "";
    const existingReports = Array.isArray(order.orderReports)
      ? order.orderReports.filter((entry: unknown) => Boolean(entry && typeof entry === "object"))
      : [];
    const incidentReportEntry = {
      reportType,
      category: "incident",
      title: INCIDENT_LABELS[reportType],
      description: customerMessage || INCIDENT_GUIDANCE[reportType],
      createdBy: toStringValue(operator._id),
      createdByRole: "operator",
      createdAt: reportedAt,
      data: {
        note: incidentNote,
        guidance: incidentGuidance,
        processingStatus: incidentStatus,
        orderId: toStringValue(order._id),
        busId: effectiveBusId,
        officeAction,
        customerMessage,
        assignedOffice: assignedOffice
          ? {
              officeName: assignedOffice.officeName,
              address: assignedOffice.address,
              city: assignedOffice.city,
              state: assignedOffice.state,
              zip: assignedOffice.zip,
              phone: assignedOffice.phone,
              latitude: assignedOffice.latitude,
              longitude: assignedOffice.longitude,
            }
          : undefined,
        operatorLocation: operatorLocation || undefined,
      },
    };

    order.operatorNote = incidentNote;
    order.adminNote = incidentNote;
    order.orderReports = [...existingReports, incidentReportEntry];
    order.incidentReportType = reportType;
    order.incidentReportStatus = incidentStatus;
    order.incidentReportNote = incidentNote;
    order.incidentReportGuidance = incidentGuidance;
    order.incidentReportAt = reportedAt;
    order.incidentReportBy = toStringValue(operator._id);
    order.operatorIncidentType = reportType;
    order.operatorIncidentStatus = incidentStatus;
    order.operatorIncidentNote = incidentNote;
    order.operatorIncidentGuidance = incidentGuidance;
    order.operatorIncidentAt = reportedAt;
    order.operatorIncidentBy = toStringValue(operator._id);
    order.assignedOffice = assignedOffice
      ? {
          officeName: assignedOffice.officeName,
          address: assignedOffice.address,
          city: assignedOffice.city,
          state: assignedOffice.state,
          zip: assignedOffice.zip,
          phone: assignedOffice.phone,
          latitude: assignedOffice.latitude,
          longitude: assignedOffice.longitude,
          assignedAt: reportedAt,
          assignmentReason: "customer_not_at_drop",
          customerMessage,
        }
      : undefined;
    order.adminNoteUpdatedAt = reportedAt;

    const roundCurrency = (val: number) => Math.round(val * 100) / 100;

    if (reportType === "customer_not_at_pickup") {
      order.status = "cancelled";
      const totalAmount = toNumberValue(order.totalAmount, 0);
      const deductionPercent = 10;
      const deductionAmount = Math.max(0, roundCurrency(totalAmount * (deductionPercent / 100)));
      const refundAmount = Math.max(0, roundCurrency(totalAmount - deductionAmount));

      order.cancellationDetails = {
        reasonCode: "customer_not_at_pickup",
        reasonDescription: "not pickup present",
        refundMode: "deduction_policy",
        refundBaseAmount: totalAmount,
        deductionPercent,
        deductionAmount,
        refundAmount,
        policyLabel: "Customer not at pickup deduction",
        processingStatus: "pending_admin_action",
        cancelledAt: reportedAt,
        cancelledBy: operator._id,
        cancelledByRole: "operator",
      };
    }

    await order.save();

    return NextResponse.json(
      {
        success: true,
        message:
          reportType === "customer_not_at_drop" && assignedOffice
            ? `Customer not at drop reported. Package routed to ${assignedOffice.officeName}.`
            : reportType === "customer_not_at_pickup"
              ? "Customer not at pickup reported. Order automatically cancelled."
              : `${INCIDENT_LABELS[reportType]} reported successfully.`,
        report: parseIncidentReport(order),
        order: {
          id: toStringValue(order._id),
          status: toStringValue(order.status, "pending"),
          report: parseIncidentReport(order),
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to submit incident report.",
      },
      { status: 500 },
    );
  }
}
