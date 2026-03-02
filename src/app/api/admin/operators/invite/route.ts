import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import TravelCompany from "@/app/api/models/travelCompanyModel";
import { sendEmail, wasEmailAccepted } from "@/app/api/lib/mailer";
import { createNotification } from "@/app/api/lib/notifications";

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

export async function POST(request: NextRequest) {
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
      return NextResponse.json(
        { success: false, message: "Admin company profile is missing." },
        { status: 400 },
      );
    }

    const reqBody = await request.json();
    const email = typeof reqBody?.email === "string" ? reqBody.email.trim().toLowerCase() : "";

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Operator email is required." },
        { status: 400 },
      );
    }

    const company = await TravelCompany.findById(admin.travelCompanyId);
    const companyName = company?.name ?? "Hapus Logistics";

    const operator = await User.findOne({ email });

    if (operator && operator.role !== "operator") {
      return NextResponse.json(
        { success: false, message: "This email belongs to another role." },
        { status: 400 },
      );
    }

    if (!operator) {
      return NextResponse.json(
        { success: false, message: "No operator found with this email." },
        { status: 404 },
      );
    }

    if (
      operator.operatorApprovalStatus === "approved" &&
      String(operator.travelCompanyId ?? "") === String(admin.travelCompanyId ?? "")
    ) {
      return NextResponse.json(
        { success: false, message: "This operator is already approved for your company." },
        { status: 400 },
      );
    }

    operator.name = operator.name || email.split("@")[0] || "Operator";
    operator.pendingTravelCompanyId = admin.travelCompanyId;
    operator.travelCompanyId = undefined;
    operator.invitedByAdminId = admin._id;
    operator.operatorApprovalStatus = "company_requested";
    await operator.save();

    let emailSent = false;
    try {
      const result = await sendEmail({
        email: operator.email,
        emailType: "COMPANY_OFFER_TO_OPERATOR",
        operatorName: operator.name,
        companyName,
      });
      emailSent = wasEmailAccepted(result);
    } catch {
      emailSent = false;
    }

    await createNotification({
      recipientUserId: operator._id.toString(),
      title: "New Company Offer",
      message: `${companyName} invited you to join as an operator.`,
      type: "info",
      metadata: {
        companyId: admin.travelCompanyId?.toString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: emailSent
        ? "Company offer sent to operator successfully."
        : "Offer created but email could not be delivered.",
      operatorId: operator._id.toString(),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to invite operator.",
      },
      { status: 500 },
    );
  }
}
