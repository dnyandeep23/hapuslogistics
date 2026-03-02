import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
import Location from "@/app/api/models/locationModel";
import User from "@/app/api/models/userModel";

const JWT_SECRET = process.env.JWT_SECRET!;

const normalizeText = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

dbConnect();

export async function GET() {
  try {
    await dbConnect();

    const locations = await Location.find().sort({ name: 1, city: 1 }).lean();
    const normalizedLocations = locations.map((location) => {
      const latitudeValue = Number((location as { latitude?: unknown }).latitude);
      const longitudeValue = Number((location as { longitude?: unknown }).longitude);

      const geoPoint = (location as { geoPoint?: { coordinates?: unknown[] } }).geoPoint;
      const coordinates = Array.isArray(geoPoint?.coordinates) ? geoPoint.coordinates : [];
      const geoLongitude = Number(coordinates[0]);
      const geoLatitude = Number(coordinates[1]);

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

      return {
        ...location,
        _id: String((location as { _id?: unknown })._id ?? ""),
        latitude,
        longitude,
      };
    });

    return NextResponse.json(normalizedLocations, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch locations.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(userId).select("role isSuperAdmin");
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      return NextResponse.json(
        { success: false, message: "Admin access required." },
        { status: 403 },
      );
    }

    let reqBody: Record<string, unknown>;
    try {
      reqBody = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 },
      );
    }

    const name = normalizeText(reqBody.name);
    const address = normalizeText(reqBody.address);
    const city = normalizeText(reqBody.city);
    const state = normalizeText(reqBody.state);
    const zip = normalizeText(reqBody.zip);
    const latitude = Number(reqBody.latitude);
    const longitude = Number(reqBody.longitude);

    if (!name || !address || !city || !state || !zip) {
      return NextResponse.json(
        { success: false, message: "Name, address, city, state and zip are required." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { success: false, message: "Latitude and longitude are required from map selection." },
        { status: 400 },
      );
    }

    const existingLocation = await Location.findOne({
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
      city: { $regex: `^${escapeRegex(city)}$`, $options: "i" },
      state: { $regex: `^${escapeRegex(state)}$`, $options: "i" },
    })
      .select("_id name city state")
      .lean();

    if (existingLocation) {
      return NextResponse.json(
        {
          success: false,
          message: "This pickup/drop location already exists in dataset.",
          location: existingLocation,
        },
        { status: 409 },
      );
    }

    const location = await Location.create({
      name,
      address,
      city,
      state,
      zip,
      latitude,
      longitude,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Location added successfully.",
        location: {
          _id: String(location._id),
          name: location.name,
          address: location.address,
          city: location.city,
          state: location.state,
          zip: location.zip,
          latitude: location.latitude,
          longitude: location.longitude,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const maybeDuplicate =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000;

    if (maybeDuplicate) {
      return NextResponse.json(
        {
          success: false,
          message: "This pickup/drop location already exists in dataset.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to add location.",
      },
      { status: 500 },
    );
  }
}
