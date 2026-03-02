import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_HEADERS = {
  "Accept-Language": "en",
  "User-Agent": "hapuslogistics-location-geocoder/1.0",
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  state_district?: string;
  postcode?: string;
  country?: string;
};

type ParsedLocationResult = {
  latitude: number;
  longitude: number;
  displayName: string;
  name: string;
  addressLine: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

const pickCity = (address: NominatimAddress) =>
  String(
    address.city ||
      address.town ||
      address.village ||
      address.county ||
      address.state_district ||
      "",
  ).trim();

const buildAddressLine = (address: NominatimAddress) =>
  [address.house_number, address.road, address.neighbourhood || address.suburb]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(", ");

const parseLocationResult = (record: Record<string, unknown>): ParsedLocationResult | null => {
  const latitude = Number(record.lat);
  const longitude = Number(record.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const addressRaw =
    record.address && typeof record.address === "object"
      ? (record.address as NominatimAddress)
      : {};
  const displayName = String(record.display_name ?? "").trim();
  const addressLine = buildAddressLine(addressRaw);
  const city = pickCity(addressRaw);
  const state = String(addressRaw.state || addressRaw.state_district || "").trim();
  const zip = String(addressRaw.postcode || "").trim();
  const country = String(addressRaw.country || "").trim();
  const rawName = String(record.name ?? "").trim();
  const fallbackName = city || displayName.split(",")[0]?.trim() || "";

  return {
    latitude,
    longitude,
    displayName,
    name: rawName || fallbackName,
    addressLine: addressLine || displayName,
    city,
    state,
    zip,
    country,
  };
};

export async function GET(request: NextRequest) {
  try {
    const query = String(request.nextUrl.searchParams.get("q") ?? "").trim();

    if (query.length < 3) {
      return NextResponse.json(
        { success: false, message: "Location query must be at least 3 characters." },
        { status: 400 },
      );
    }

    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "in");
    url.searchParams.set("q", query);

    const response = await fetch(url.toString(), {
      headers: NOMINATIM_HEADERS,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: "Failed to fetch map location from OpenStreetMap." },
        { status: 502 },
      );
    }

    const payload = await response.json();
    const firstResult =
      Array.isArray(payload) && payload[0] && typeof payload[0] === "object"
        ? (payload[0] as Record<string, unknown>)
        : null;
    if (!firstResult) {
      return NextResponse.json(
        { success: false, message: "No matching map location found." },
        { status: 404 },
      );
    }

    const parsedResult = parseLocationResult(firstResult);
    if (!parsedResult) {
      return NextResponse.json(
        { success: false, message: "Invalid location result returned by map provider." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        result: parsedResult,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to geocode location.",
      },
      { status: 500 },
    );
  }
}
