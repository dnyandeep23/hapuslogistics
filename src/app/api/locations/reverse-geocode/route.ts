import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
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

export async function GET(request: NextRequest) {
  try {
    const latitude = Number(request.nextUrl.searchParams.get("lat"));
    const longitude = Number(request.nextUrl.searchParams.get("lng"));

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { success: false, message: "Valid lat and lng are required." },
        { status: 400 },
      );
    }

    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));

    const response = await fetch(url.toString(), {
      headers: NOMINATIM_HEADERS,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: "Failed to resolve address from map coordinates." },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const displayName = String(payload?.display_name ?? "").trim();
    const name = String(payload?.name ?? "").trim();
    const address =
      payload?.address && typeof payload.address === "object"
        ? (payload.address as NominatimAddress)
        : {};

    const addressLine = buildAddressLine(address) || displayName;
    const city = pickCity(address);
    const state = String(address.state || address.state_district || "").trim();
    const zip = String(address.postcode || "").trim();
    const country = String(address.country || "").trim();
    const fallbackName = city || displayName.split(",")[0]?.trim() || "";

    return NextResponse.json(
      {
        success: true,
        result: {
          latitude,
          longitude,
          displayName,
          name: name || fallbackName,
          addressLine,
          city,
          state,
          zip,
          country,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to reverse geocode location.",
      },
      { status: 500 },
    );
  }
}
