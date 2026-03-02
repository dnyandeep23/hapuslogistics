import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import Bus from "@/app/api/models/busModel";
import Notification from "@/app/api/models/notificationModel";

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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ busId: string }> },
) {
  try {
    await dbConnect();

    const adminUserId = getTokenUserId(request);
    if (!adminUserId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const admin = await User.findById(adminUserId).select("role isSuperAdmin travelCompanyId buses");
    if (!admin || (admin.role !== "admin" && !admin.isSuperAdmin)) {
      return NextResponse.json({ success: false, message: "Admin access required." }, { status: 403 });
    }

    const { busId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return NextResponse.json({ success: false, message: "Invalid bus id." }, { status: 400 });
    }

    const body = await request.json();
    const operatorId = String(body?.operatorId ?? "").trim();
    const startDateRaw = String(body?.startDate ?? "").trim();
    const endDateRaw = String(body?.endDate ?? "").trim();

    if (!operatorId || !startDateRaw || !endDateRaw) {
      return NextResponse.json(
        {
          success: false,
          message: "operatorId, startDate and endDate are required.",
        },
        { status: 400 },
      );
    }

    if (!mongoose.Types.ObjectId.isValid(operatorId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid operator id.",
        },
        { status: 400 },
      );
    }

    const startDate = new Date(startDateRaw);
    const endDate = new Date(endDateRaw);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, message: "Invalid date range." },
        { status: 400 },
      );
    }
    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(0, 0, 0, 0);

    if (endDate < startDate) {
      return NextResponse.json(
        { success: false, message: "End date cannot be before start date." },
        { status: 400 },
      );
    }

    const bus = await Bus.findById(busId);
    if (!bus) {
      return NextResponse.json({ success: false, message: "Bus not found." }, { status: 404 });
    }

    if (
      !admin.isSuperAdmin &&
      String(bus.travelCompanyId ?? "") !== String(admin.travelCompanyId ?? "")
    ) {
      const canAccessByBusList = Array.isArray(admin.buses)
        ? admin.buses.some((id: unknown) => String(id) === busId)
        : false;
      if (!canAccessByBusList) {
        return NextResponse.json(
          { success: false, message: "You can assign operators only to your company buses." },
          { status: 403 },
        );
      }
    }

    const operator = await User.findById(operatorId).select(
      "role name email phone operatorApprovalStatus travelCompanyId",
    );
    if (!operator || operator.role !== "operator") {
      return NextResponse.json(
        { success: false, message: "Operator not found." },
        { status: 404 },
      );
    }

    if (
      operator.operatorApprovalStatus !== "approved" ||
      String(operator.travelCompanyId ?? "") !== String(bus.travelCompanyId ?? "")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Only approved operators from this company can be assigned.",
        },
        { status: 400 },
      );
    }

    const operatorPhone = String(operator.phone ?? "").trim();
    if (!operatorPhone) {
      return NextResponse.json(
        {
          success: false,
          message: "Operator phone number is required before assignment.",
        },
        { status: 400 },
      );
    }

    const existingPeriods = Array.isArray(bus.operatorContactPeriods)
      ? bus.operatorContactPeriods
      : [];

    const filteredPeriods = existingPeriods.filter((period) => {
      const periodStart = new Date(period.startDate);
      const periodEnd = new Date(period.endDate);
      periodStart.setUTCHours(0, 0, 0, 0);
      periodEnd.setUTCHours(0, 0, 0, 0);
      return periodEnd < startDate || periodStart > endDate;
    });

    bus.operatorContactPeriods = [
      ...filteredPeriods,
      {
        operatorId: operator._id as mongoose.Types.ObjectId,
        operatorName: operator.name || operator.email || "Operator",
        operatorPhone,
        startDate,
        endDate,
        assignedAt: new Date(),
      },
    ].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    await bus.save();

    await Notification.create({
      recipientUserId: operator._id,
      title: "Bus assignment updated",
      message: `You have been assigned to ${bus.busName} (${bus.busNumber}) from ${startDateRaw} to ${endDateRaw}.`,
      type: "info",
      metadata: {
        busId: bus._id.toString(),
        busName: bus.busName,
        busNumber: bus.busNumber,
        startDate: startDateRaw,
        endDate: endDateRaw,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Operator contact assigned for selected period.",
        operatorContactPeriods: bus.operatorContactPeriods,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to assign operator.",
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

    const adminUserId = getTokenUserId(request);
    if (!adminUserId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const admin = await User.findById(adminUserId).select("role isSuperAdmin travelCompanyId buses");
    if (!admin || (admin.role !== "admin" && !admin.isSuperAdmin)) {
      return NextResponse.json({ success: false, message: "Admin access required." }, { status: 403 });
    }

    const { busId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return NextResponse.json({ success: false, message: "Invalid bus id." }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 },
      );
    }

    const operatorId = String(body?.operatorId ?? "").trim();
    if (!operatorId || !mongoose.Types.ObjectId.isValid(operatorId)) {
      return NextResponse.json(
        { success: false, message: "Valid operatorId is required." },
        { status: 400 },
      );
    }

    const bus = await Bus.findById(busId);
    if (!bus) {
      return NextResponse.json({ success: false, message: "Bus not found." }, { status: 404 });
    }

    if (
      !admin.isSuperAdmin &&
      String(bus.travelCompanyId ?? "") !== String(admin.travelCompanyId ?? "")
    ) {
      const canAccessByBusList = Array.isArray(admin.buses)
        ? admin.buses.some((id: unknown) => String(id) === busId)
        : false;
      if (!canAccessByBusList) {
        return NextResponse.json(
          { success: false, message: "You can update operators only for your company buses." },
          { status: 403 },
        );
      }
    }

    const existingPeriods = Array.isArray(bus.operatorContactPeriods)
      ? bus.operatorContactPeriods
      : [];

    const filteredPeriods = existingPeriods.filter(
      (period) => String(period.operatorId) !== operatorId,
    );

    if (filteredPeriods.length === existingPeriods.length) {
      return NextResponse.json(
        { success: false, message: "Selected operator is not assigned to this bus." },
        { status: 404 },
      );
    }

    bus.operatorContactPeriods = filteredPeriods;
    await bus.save();

    return NextResponse.json(
      {
        success: true,
        message: "Operator removed from this bus.",
        operatorContactPeriods: bus.operatorContactPeriods,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to remove operator.",
      },
      { status: 500 },
    );
  }
}
