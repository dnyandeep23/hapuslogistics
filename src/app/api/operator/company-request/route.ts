import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import { sendEmail } from "@/app/api/lib/mailer";
import { createNotification } from "@/app/api/lib/notifications";
import { resolveOperatorCompany } from "@/app/api/lib/companyResolver";
import { isValidIndiaPhone } from "@/lib/phone";

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

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const operator = await User.findById(userId);
    if (!operator || operator.role !== "operator") {
      return NextResponse.json({ success: false, message: "Operator access required." }, { status: 403 });
    }

    const operatorPhone = String(operator.phone ?? "").trim();
    if (!operatorPhone || !isValidIndiaPhone(operatorPhone)) {
      return NextResponse.json(
        {
          success: false,
          code: "OPERATOR_PHONE_REQUIRED",
          message: "Add a valid Indian contact number in Profile before requesting a company.",
        },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { companyId?: unknown; companyName?: unknown };
    const requestedCompanyId =
      typeof body?.companyId === "string" ? body.companyId.trim() : "";
    const requestedCompanyName =
      typeof body?.companyName === "string" ? body.companyName.trim() : "";

    const { company, reason } = await resolveOperatorCompany({
      companyId: requestedCompanyId,
      companyName: requestedCompanyName,
    });

    if (!company) {
      const message =
        reason === "INVALID_ID"
          ? "Valid company selection is required."
          : reason === "MULTIPLE_COMPANIES"
            ? "Multiple travel companies are configured. A company selection is required."
            : reason === "NO_COMPANY"
              ? "No travel company is configured yet."
              : "Selected travel company was not found.";

      return NextResponse.json(
        { success: false, message },
        {
          status:
            reason === "NO_COMPANY"
              ? 404
              : reason === "NOT_FOUND"
                ? 404
                : 400,
        },
      );
    }

    if (
      operator.operatorApprovalStatus === "approved" &&
      String(operator.travelCompanyId ?? "") === company._id.toString()
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
