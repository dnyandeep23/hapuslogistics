import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
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

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const operator = await User.findById(userId).select(
      "role operatorApprovalStatus pendingTravelCompanyId",
    );
    if (!operator || operator.role !== "operator") {
      return NextResponse.json({ success: false, message: "Operator access required." }, { status: 403 });
    }

    const hasPendingOffer =
      (operator.operatorApprovalStatus === "company_requested" ||
        operator.operatorApprovalStatus === "pending") &&
      Boolean(operator.pendingTravelCompanyId);

    if (!hasPendingOffer) {
      return NextResponse.json(
        { success: true, hasOffer: false, offer: null },
        { status: 200 },
      );
    }

    const company = await TravelCompany.findById(operator.pendingTravelCompanyId)
      .select("_id name ownerEmail contact")
      .lean();

    if (!company) {
      return NextResponse.json(
        { success: true, hasOffer: false, offer: null },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        hasOffer: true,
        offer: {
          companyId: company._id.toString(),
          companyName: company.name,
          adminEmail: company.ownerEmail || company.contact?.email || "",
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch company offer.",
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

    const operator = await User.findById(userId);
    if (!operator || operator.role !== "operator") {
      return NextResponse.json({ success: false, message: "Operator access required." }, { status: 403 });
    }

    const body = await request.json();
    const action = body?.action;

    if (action !== "accept" && action !== "reject") {
      return NextResponse.json(
        { success: false, message: "Invalid action." },
        { status: 400 },
      );
    }

    if (
      operator.operatorApprovalStatus !== "company_requested" &&
      operator.operatorApprovalStatus !== "pending"
    ) {
      return NextResponse.json(
        { success: false, message: "No pending company offer found." },
        { status: 400 },
      );
    }

    if (!operator.pendingTravelCompanyId) {
      return NextResponse.json(
        { success: false, message: "Offer company reference is missing." },
        { status: 400 },
      );
    }

    if (action === "accept") {
      const operatorPhone = String(operator.phone ?? "").trim().replace(/[\s()-]/g, "");
      if (!operatorPhone || !PHONE_PATTERN.test(operatorPhone)) {
        return NextResponse.json(
          {
            success: false,
            code: "OPERATOR_PHONE_REQUIRED",
            message: "Add a valid contact number in Profile before accepting company request.",
          },
          { status: 400 },
        );
      }
    }

    const company = await TravelCompany.findById(operator.pendingTravelCompanyId)
      .select("_id name ownerUserId ownerEmail contact")
      .lean();

    if (!company) {
      return NextResponse.json(
        { success: false, message: "Offer company no longer exists." },
        { status: 404 },
      );
    }

    if (action === "accept") {
      operator.travelCompanyId = company._id;
      operator.pendingTravelCompanyId = undefined;
      operator.operatorApprovalStatus = "approved";
    } else {
      operator.travelCompanyId = undefined;
      operator.pendingTravelCompanyId = undefined;
      operator.operatorApprovalStatus = "rejected";
    }

    await operator.save();

    const adminEmail = company.ownerEmail || company.contact?.email || "";

    if (adminEmail) {
      try {
        await sendEmail({
          email: adminEmail,
          emailType: action === "accept" ? "OPERATOR_OFFER_ACCEPTED" : "OPERATOR_OFFER_REJECTED",
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
        emailType: action === "accept" ? "OPERATOR_APPROVED" : "OPERATOR_REJECTED",
        operatorName: operator.name,
        companyName: company.name,
      });
    } catch {
      // Non-blocking
    }

    if (company.ownerUserId) {
      await createNotification({
        recipientUserId: company.ownerUserId.toString(),
        title: action === "accept" ? "Operator Accepted Offer" : "Operator Rejected Offer",
        message:
          action === "accept"
            ? `${operator.name} accepted your company offer.`
            : `${operator.name} rejected your company offer.`,
        type: action === "accept" ? "success" : "warning",
        metadata: {
          operatorId: operator._id.toString(),
          companyId: company._id.toString(),
          action,
        },
      });
    }

    await createNotification({
      recipientUserId: operator._id.toString(),
      title: action === "accept" ? "Offer Accepted" : "Offer Rejected",
      message:
        action === "accept"
          ? `You are now linked to ${company.name}.`
          : `You rejected the offer from ${company.name}.`,
      type: action === "accept" ? "success" : "warning",
      metadata: {
        companyId: company._id.toString(),
        action,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message:
          action === "accept"
            ? `Offer accepted. You are now linked to ${company.name}.`
            : `Offer rejected for ${company.name}.`,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to update company offer.",
      },
      { status: 500 },
    );
  }
}
