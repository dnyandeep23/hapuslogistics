import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import TravelCompany from "@/app/api/models/travelCompanyModel";
import { sendEmail } from "@/app/api/lib/mailer";
import { createNotification } from "@/app/api/lib/notifications";

const JWT_SECRET = process.env.JWT_SECRET!;
const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

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

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const operator = await User.findById(userId);
    if (!operator || operator.role !== "operator") {
      return NextResponse.json({ success: false, message: "Operator access required." }, { status: 403 });
    }

    const operatorPhone = String(operator.phone ?? "").trim().replace(/[\s()-]/g, "");
    if (!operatorPhone || !PHONE_PATTERN.test(operatorPhone)) {
      return NextResponse.json(
        {
          success: false,
          code: "OPERATOR_PHONE_REQUIRED",
          message: "Add a valid contact number in Profile before requesting a company.",
        },
        { status: 400 },
      );
    }

    const body = await request.json();
    const companyId = typeof body?.companyId === "string" ? body.companyId.trim() : "";

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return NextResponse.json(
        { success: false, message: "Valid company selection is required." },
        { status: 400 },
      );
    }

    const company = await TravelCompany.findById(companyId)
      .select("_id name ownerUserId ownerEmail contact")
      .lean();

    if (!company) {
      return NextResponse.json(
        { success: false, message: "Selected travel company was not found." },
        { status: 404 },
      );
    }

    if (
      operator.operatorApprovalStatus === "approved" &&
      String(operator.travelCompanyId ?? "") === companyId
    ) {
      return NextResponse.json(
        { success: false, message: "You are already approved for this company." },
        { status: 400 },
      );
    }

    operator.pendingTravelCompanyId = company._id;
    operator.travelCompanyId = undefined;
    operator.operatorApprovalStatus = "operator_requested";
    await operator.save();

    const adminEmail = company.ownerEmail || company.contact?.email || "";

    if (adminEmail) {
      try {
        await sendEmail({
          email: adminEmail,
          emailType: "OPERATOR_REQUEST_TO_COMPANY",
          operatorName: operator.name,
          companyName: company.name,
          adminName: company.name,
        });
      } catch {
        // Non-blocking
      }
    }

    try {
      await sendEmail({
        email: operator.email,
        emailType: "OPERATOR_REQUEST_SUBMITTED",
        operatorName: operator.name,
        companyName: company.name,
      });
    } catch {
      // Non-blocking
    }

    if (company.ownerUserId) {
      await createNotification({
        recipientUserId: company.ownerUserId.toString(),
        title: "New Operator Join Request",
        message: `${operator.name} (${operator.email}) requested to join ${company.name}.`,
        type: "info",
        metadata: {
          operatorId: operator._id.toString(),
          companyId: company._id.toString(),
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: `Request sent to ${company.name}. You'll be notified once reviewed.`,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to send company request.",
      },
      { status: 500 },
    );
  }
}
