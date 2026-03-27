import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import Location from "@/app/api/models/locationModel";
import User from "@/app/api/models/userModel";
import Bus from "@/app/api/models/busModel";

const JWT_SECRET = process.env.JWT_SECRET!;

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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ locationId: string }> },
) {
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(userId).select("role");
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Admin access required." },
        { status: 403 },
      );
    }

    const { locationId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(locationId)) {
      return NextResponse.json(
        { success: false, message: "Invalid location id." },
        { status: 400 },
      );
    }

    const location = await Location.findById(locationId).select("_id name city state");
    if (!location) {
      return NextResponse.json(
        { success: false, message: "Location not found." },
        { status: 404 },
      );
    }

    const linkedBus = await Bus.findOne({
      $or: [
        { "routePath.location": location._id },
        { "pricing.pickupLocation": location._id },
        { "pricing.dropLocation": location._id },
      ],
    }).select("busName busNumber");

    if (linkedBus) {
      return NextResponse.json(
        {
          success: false,
          message: `This location is still used by bus ${linkedBus.busName} (${linkedBus.busNumber}). Remove it from bus routes first.`,
        },
        { status: 409 },
      );
    }

    await Location.deleteOne({ _id: location._id });

    return NextResponse.json(
      {
        success: true,
        message: `Location ${location.name} deleted successfully.`,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete location.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ locationId: string }> },
) {
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(userId).select("role");
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Admin access required." },
        { status: 403 },
      );
    }

    const { locationId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(locationId)) {
      return NextResponse.json(
        { success: false, message: "Invalid location id." },
        { status: 400 },
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

    const normalizeText = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");
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
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      city: { $regex: `^${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      state: { $regex: `^${state.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      _id: { $ne: locationId },
    })
      .select("_id name city state")
      .lean();

    if (existingLocation) {
      return NextResponse.json(
        {
          success: false,
          message: "Another location with this name and city already exists.",
          location: existingLocation,
        },
        { status: 409 },
      );
    }

    const updatedLocation = await Location.findByIdAndUpdate(
      locationId,
      { name, address, city, state, zip, latitude, longitude },
      { new: true }
    );

    if (!updatedLocation) {
      return NextResponse.json(
        { success: false, message: "Location not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Location updated successfully.",
        location: {
          _id: String(updatedLocation._id),
          name: updatedLocation.name,
          address: updatedLocation.address,
          city: updatedLocation.city,
          state: updatedLocation.state,
          zip: updatedLocation.zip,
          latitude: updatedLocation.latitude,
          longitude: updatedLocation.longitude,
        },
      },
      { status: 200 },
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
        message: error instanceof Error ? error.message : "Failed to update location.",
      },
      { status: 500 },
    );
  }
}
