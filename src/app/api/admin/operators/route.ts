import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
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

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const adminId = getTokenUserId(request);
    if (!adminId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const admin = await User.findById(adminId);
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ success: false, message: "Admin access required." }, { status: 403 });
    }

    if (!admin.travelCompanyId) {
      return NextResponse.json({ success: true, operators: [] });
    }

    const operators = await User.find({
      role: "operator",
      $or: [
        { travelCompanyId: admin.travelCompanyId },
        { pendingTravelCompanyId: admin.travelCompanyId },
      ],
    })
      .select("name email phone mustChangePassword operatorApprovalStatus travelCompanyId pendingTravelCompanyId accountDeletionRequestedAt accountDeletionExpiresAt createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const operatorIds = operators.map((operator) => String(operator._id)).filter(Boolean);
    const assignedBuses = operatorIds.length > 0
      ? await Bus.find({
          travelCompanyId: admin.travelCompanyId,
          "operatorContactPeriods.operatorId": { $in: operatorIds },
        })
          .select("busName busNumber operatorContactPeriods")
          .lean<Array<Record<string, unknown>>>()
      : [];

    const busAssignmentsByOperatorId = new Map<string, Array<{ busId: string; label: string }>>();
    for (const bus of assignedBuses) {
      const operatorPeriods = Array.isArray(bus.operatorContactPeriods) ? bus.operatorContactPeriods : [];
      const busLabel = `${String(bus.busName ?? "Bus").trim() || "Bus"} (${String(bus.busNumber ?? "--").trim() || "--"})`;
      const busId = String(bus._id ?? "");

      for (const period of operatorPeriods) {
        if (!period || typeof period !== "object") continue;
        const operatorId = String((period as { operatorId?: unknown }).operatorId ?? "");
        if (!operatorId) continue;
        const existing = busAssignmentsByOperatorId.get(operatorId) ?? [];
        if (!existing.some((entry) => entry.busId === busId)) {
          existing.push({ busId, label: busLabel });
          busAssignmentsByOperatorId.set(operatorId, existing);
        }
      }
    }

    const operatorsWithAssignments = operators.map((operator) => {
      const assignments = busAssignmentsByOperatorId.get(String(operator._id)) ?? [];
      return {
        ...operator,
        assignedBusCount: assignments.length,
        assignedBuses: assignments,
      };
    });

    return NextResponse.json({ success: true, operators: operatorsWithAssignments });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load operators.",
      },
      { status: 500 },
    );
  }
}
