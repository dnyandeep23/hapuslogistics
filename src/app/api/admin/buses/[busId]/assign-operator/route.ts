import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import Bus from "@/app/api/models/busModel";
import Notification from "@/app/api/models/notificationModel";
import { normalizeIndiaPhone } from "@/lib/phone";

const JWT_SECRET = process.env.JWT_SECRET!;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const normalizeDateOnly = (value: Date | string) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const rangesOverlap = (leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date) =>
  leftStart.getTime() <= rightEnd.getTime() && leftEnd.getTime() >= rightStart.getTime();

const rangesTouchOrOverlap = (leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date) =>
  leftStart.getTime() <= rightEnd.getTime() + DAY_IN_MS && leftEnd.getTime() + DAY_IN_MS >= rightStart.getTime();

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

    const admin = await User.findById(adminUserId).select("role travelCompanyId buses");
    if (!admin || admin.role !== "admin") {
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

    if (String(bus.travelCompanyId ?? "") !== String(admin.travelCompanyId ?? "")) {
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
      "role name email phone operatorApprovalStatus travelCompanyId accountDeletionRequestedAt accountDeletionExpiresAt",
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

    if (operator.accountDeletionRequestedAt || operator.accountDeletionExpiresAt) {
      return NextResponse.json(
        {
          success: false,
          code: "OPERATOR_DELETION_SCHEDULED",
          message: "This operator has scheduled account deletion. Ask them to log in again and cancel deletion before assigning any bus.",
        },
        { status: 409 },
      );
    }

    const operatorPhone = normalizeIndiaPhone(operator.phone);
    if (!operatorPhone) {
      return NextResponse.json(
        {
          success: false,
          message: "Operator phone number must be a valid Indian mobile number before assignment.",
        },
        { status: 400 },
      );
    }

    const existingPeriods = Array.isArray(bus.operatorContactPeriods)
      ? bus.operatorContactPeriods
      : [];

    const sameOperatorPeriods = existingPeriods.filter((period) => {
      const periodOperatorId = String(period.operatorId ?? "");
      if (periodOperatorId !== operatorId) return false;
      const periodStart = normalizeDateOnly(period.startDate);
      const periodEnd = normalizeDateOnly(period.endDate);
      return rangesTouchOrOverlap(periodStart, periodEnd, startDate, endDate);
    });

    const conflictingPeriods = existingPeriods.filter((period) => {
      const periodOperatorId = String(period.operatorId ?? "");
      if (periodOperatorId === operatorId) return false;
      const periodStart = normalizeDateOnly(period.startDate);
      const periodEnd = normalizeDateOnly(period.endDate);
      return rangesOverlap(periodStart, periodEnd, startDate, endDate);
    });

    const alreadyCovered =
      conflictingPeriods.length === 0 &&
      sameOperatorPeriods.some((period) => {
        const periodStart = normalizeDateOnly(period.startDate);
        const periodEnd = normalizeDateOnly(period.endDate);
        return periodStart.getTime() <= startDate.getTime() && periodEnd.getTime() >= endDate.getTime();
      });

    if (alreadyCovered) {
      return NextResponse.json(
        {
          success: true,
          alreadyAssigned: true,
          message: `Operator is already assigned from ${sameOperatorPeriods[0]?.startDate?.toISOString?.().slice(0, 10) ?? startDateRaw} to ${sameOperatorPeriods[0]?.endDate?.toISOString?.().slice(0, 10) ?? endDateRaw}.`,
          operatorContactPeriods: existingPeriods,
        },
        { status: 200 },
      );
    }

    const unaffectedPeriods = existingPeriods.filter((period) => {
      const periodOperatorId = String(period.operatorId ?? "");
      const periodStart = normalizeDateOnly(period.startDate);
      const periodEnd = normalizeDateOnly(period.endDate);
      if (periodOperatorId === operatorId) {
        return !rangesTouchOrOverlap(periodStart, periodEnd, startDate, endDate);
      }
      return !rangesOverlap(periodStart, periodEnd, startDate, endDate);
    });

    const mergedStart = sameOperatorPeriods.reduce(
      (earliest, period) => {
        const periodStart = normalizeDateOnly(period.startDate);
        return periodStart.getTime() < earliest.getTime() ? periodStart : earliest;
      },
      startDate,
    );
    const mergedEnd = sameOperatorPeriods.reduce(
      (latest, period) => {
        const periodEnd = normalizeDateOnly(period.endDate);
        return periodEnd.getTime() > latest.getTime() ? periodEnd : latest;
      },
      endDate,
    );
    const mergedAssignedAt = sameOperatorPeriods.reduce<Date>(
      (earliest, period) => {
        const assignedAt = period.assignedAt ? new Date(period.assignedAt) : null;
        if (!assignedAt || Number.isNaN(assignedAt.getTime())) return earliest;
        return assignedAt.getTime() < earliest.getTime() ? assignedAt : earliest;
      },
      new Date(),
    );

    bus.operatorContactPeriods = [
      ...unaffectedPeriods,
      {
        operatorId: operator._id as mongoose.Types.ObjectId,
        operatorName: operator.name || operator.email || "Operator",
        operatorPhone,
        startDate: mergedStart,
        endDate: mergedEnd,
        assignedAt: mergedAssignedAt,
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
        message:
          sameOperatorPeriods.length > 0
            ? "Operator assignment updated without creating a duplicate period."
            : "Operator contact assigned for selected period.",
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

    const admin = await User.findById(adminUserId).select("role travelCompanyId buses");
    if (!admin || admin.role !== "admin") {
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

    if (String(bus.travelCompanyId ?? "") !== String(admin.travelCompanyId ?? "")) {
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
