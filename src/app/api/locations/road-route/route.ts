import { NextRequest, NextResponse } from "next/server";

const ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";
const OPENROUTESERVICE_API_KEY = process.env.OPENROUTESERVICE_API_KEY;

type CoordinateInput = {
  latitude?: unknown;
  longitude?: unknown;
};

type RouteCoordinate = [number, number];

type RouteGeometryPoint = {
  latitude: number;
  longitude: number;
};

type OrsRouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: RouteGeometryPoint[];
};

class OrsApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "OrsApiError";
    this.statusCode = statusCode;
  }
}

const roundTo = (value: number, decimals: number) => {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
};

const getOrsErrorMessage = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return "Failed to fetch road route from OpenRouteService.";
  }

  if (
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    payload.error.message
  ) {
    return String((payload.error as { message?: unknown }).message ?? "");
  }

  if ("message" in payload && payload.message) {
    return String((payload as { message?: unknown }).message ?? "");
  }

  return "Failed to fetch road route from OpenRouteService.";
};

const requestOrsRoute = async (
  coordinates: RouteCoordinate[],
  apiKey: string,
): Promise<OrsRouteResult> => {
  const orsResponse = await fetch(ORS_DIRECTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      coordinates,
      instructions: false,
    }),
    cache: "no-store",
  });

  const orsPayload = await orsResponse.json().catch(() => null);
  if (!orsResponse.ok) {
    const statusCode = orsResponse.status >= 400 && orsResponse.status < 600 ? orsResponse.status : 502;
    throw new OrsApiError(getOrsErrorMessage(orsPayload), statusCode);
  }

  const feature =
    orsPayload &&
    typeof orsPayload === "object" &&
    Array.isArray((orsPayload as { features?: unknown[] }).features)
      ? (orsPayload as { features: unknown[] }).features[0]
      : null;

  if (!feature || typeof feature !== "object") {
    throw new OrsApiError("No route geometry returned by OpenRouteService.", 502);
  }

  const properties =
    (feature as { properties?: unknown }).properties &&
    typeof (feature as { properties?: unknown }).properties === "object"
      ? ((feature as { properties?: Record<string, unknown> }).properties ?? {})
      : {};

  const summaryRaw =
    properties.summary && typeof properties.summary === "object"
      ? (properties.summary as Record<string, unknown>)
      : {};

  const distanceMeters = Number(summaryRaw.distance);
  const durationSeconds = Number(summaryRaw.duration);
  if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds)) {
    throw new OrsApiError("OpenRouteService route summary is missing distance or duration.", 502);
  }

  const geometryCoordinatesRaw = Array.isArray((feature as { geometry?: { coordinates?: unknown[] } }).geometry?.coordinates)
    ? ((feature as { geometry: { coordinates: unknown[] } }).geometry.coordinates as unknown[])
    : [];

  const geometry = geometryCoordinatesRaw
    .map((coord) => {
      if (!Array.isArray(coord)) return null;
      const longitude = Number(coord[0]);
      const latitude = Number(coord[1]);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return { latitude, longitude };
    })
    .filter((coord): coord is RouteGeometryPoint => Boolean(coord));

  return {
    distanceMeters,
    durationSeconds,
    geometry,
  };
};

export async function POST(request: NextRequest) {
  try {
    if (!OPENROUTESERVICE_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing OPENROUTESERVICE_API_KEY in environment configuration.",
        },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => null);
    const pointsInput = Array.isArray(body?.points) ? (body.points as CoordinateInput[]) : [];
    if (pointsInput.length < 2) {
      return NextResponse.json(
        {
          success: false,
          message: "At least two coordinates are required.",
        },
        { status: 400 },
      );
    }

    const coordinates: RouteCoordinate[] = [];
    for (const point of pointsInput) {
      const latitude = Number(point?.latitude);
      const longitude = Number(point?.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return NextResponse.json(
          {
            success: false,
            message: "Each point must include valid latitude and longitude.",
          },
          { status: 400 },
        );
      }

      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return NextResponse.json(
          {
            success: false,
            message: "Coordinates are out of valid latitude/longitude range.",
          },
          { status: 400 },
        );
      }

      coordinates.push([longitude, latitude]);
    }

    const legCoordinates: RouteCoordinate[][] = [];
    for (let index = 0; index < coordinates.length - 1; index += 1) {
      legCoordinates.push([coordinates[index], coordinates[index + 1]]);
    }

    const legResults = await Promise.all(
      legCoordinates.map((leg) => requestOrsRoute(leg, OPENROUTESERVICE_API_KEY)),
    );

    const segments = legResults.map((segment) => ({
      distanceKm: roundTo(segment.distanceMeters / 1000, 2),
      durationMinutes: roundTo(segment.durationSeconds / 60, 1),
    }));

    const totalDistanceMeters = legResults.reduce((sum, segment) => sum + segment.distanceMeters, 0);
    const totalDurationSeconds = legResults.reduce((sum, segment) => sum + segment.durationSeconds, 0);

    const geometryCoordinates: RouteGeometryPoint[] = [];
    legResults.forEach((segment, segmentIndex) => {
      segment.geometry.forEach((point, pointIndex) => {
        if (segmentIndex > 0 && pointIndex === 0) return;
        geometryCoordinates.push(point);
      });
    });

    return NextResponse.json(
      {
        success: true,
        provider: "openrouteservice",
        profile: "driving-car",
        summary: {
          distanceKm: roundTo(totalDistanceMeters / 1000, 2),
          durationMinutes: roundTo(totalDurationSeconds / 60, 1),
        },
        segments,
        geometry: {
          type: "LineString",
          coordinates: geometryCoordinates,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (error instanceof OrsApiError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch route preview.",
      },
      { status: 500 },
    );
  }
}
