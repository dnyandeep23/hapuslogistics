import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";

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
    if (!admin || (admin.role !== "admin" && !admin.isSuperAdmin)) {
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
      .select("name email phone operatorApprovalStatus travelCompanyId pendingTravelCompanyId createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, operators });
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
