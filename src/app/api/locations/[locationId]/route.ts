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
