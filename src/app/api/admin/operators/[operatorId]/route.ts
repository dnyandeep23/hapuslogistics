import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import Bus from "@/app/api/models/busModel";
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ operatorId: string }> },
) {
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

    const { operatorId } = await context.params;
    const reqBody = await request.json();
    const action = reqBody?.action;

    if (action !== "approve" && action !== "reject" && action !== "remove") {
      return NextResponse.json(
        { success: false, message: "Invalid action." },
        { status: 400 },
      );
    }

    const operator = await User.findById(operatorId);
    if (!operator || operator.role !== "operator") {
      return NextResponse.json(
        { success: false, message: "Operator not found." },
        { status: 404 },
      );
    }

    const isCompanyOperator =
      String(operator.travelCompanyId ?? "") === String(admin.travelCompanyId ?? "");
    const isPendingForCompany =
      String(operator.pendingTravelCompanyId ?? "") === String(admin.travelCompanyId ?? "");
    const previousCompanyId = operator.travelCompanyId;
    const wasApproved = operator.operatorApprovalStatus === "approved";

    if (!admin.isSuperAdmin && !isCompanyOperator && !isPendingForCompany) {
      return NextResponse.json(
        { success: false, message: "You can manage only your company operators." },
        { status: 403 },
      );
    }

    const isPendingState =
      operator.operatorApprovalStatus === "operator_requested" ||
      operator.operatorApprovalStatus === "company_requested" ||
      operator.operatorApprovalStatus === "pending";

    if (!isPendingState && action === "reject") {
      return NextResponse.json(
        { success: false, message: "Only pending operator requests can be rejected." },
        { status: 400 },
      );
    }

    if (action === "approve") {
      if (!admin.isSuperAdmin && !isPendingForCompany && !isCompanyOperator) {
        return NextResponse.json(
          { success: false, message: "This request is not linked to your company." },
          { status: 403 },
        );
      }
      const targetCompanyId = isPendingForCompany
        ? operator.pendingTravelCompanyId
        : operator.travelCompanyId || admin.travelCompanyId;
      operator.travelCompanyId = targetCompanyId;
      operator.pendingTravelCompanyId = undefined;
      operator.operatorApprovalStatus = "approved";
    } else if (action === "reject") {
      operator.pendingTravelCompanyId = undefined;
      operator.operatorApprovalStatus = "rejected";
    } else {
      if (!wasApproved) {
        return NextResponse.json(
          { success: false, message: "Only approved operators can be removed from company." },
          { status: 400 },
        );
      }
      if (!admin.isSuperAdmin && !isCompanyOperator) {
        return NextResponse.json(
          { success: false, message: "Only approved operators from your company can be removed." },
          { status: 400 },
        );
      }
      operator.travelCompanyId = undefined;
      operator.pendingTravelCompanyId = undefined;
      operator.invitedByAdminId = undefined;
      operator.operatorApprovalStatus = "none";
    }
    await operator.save();

    const companyIdForNotification =
      action === "remove"
        ? (admin.isSuperAdmin ? previousCompanyId : admin.travelCompanyId || previousCompanyId)
        : operator.travelCompanyId;
    const company = companyIdForNotification
      ? await TravelCompany.findById(companyIdForNotification)
      : null;

    if (action === "remove" && companyIdForNotification) {
      await Bus.updateMany(
        { travelCompanyId: companyIdForNotification },
        { $pull: { operatorContactPeriods: { operatorId: operator._id } } },
      );
    }

    if (action === "remove") {
      let emailSent = false;
      try {
        const mailResult = await sendEmail({
          email: operator.email,
          emailType: "OPERATOR_REMOVED_FROM_COMPANY",
          operatorName: operator.name,
          companyName: company?.name ?? "Hapus Logistics",
        });
        emailSent = wasEmailAccepted(mailResult);
      } catch {
        emailSent = false;
      }

      await createNotification({
        recipientUserId: operator._id.toString(),
        title: "Removed From Company",
        message: `You were removed from ${company?.name ?? "the company"}. You can request to join another company.`,
        type: "warning",
        metadata: {
          companyId: company?._id?.toString(),
          action,
        },
      });

      return NextResponse.json({
        success: true,
        message: emailSent
          ? "Operator removed from company, unassigned from company buses, and email sent."
          : "Operator removed from company and unassigned from company buses. Email was not delivered.",
      });
    }

    let emailSent = false;
    try {
      const mailResult = await sendEmail({
        email: operator.email,
        emailType: action === "approve" ? "OPERATOR_APPROVED" : "OPERATOR_REJECTED",
        operatorName: operator.name,
        companyName: company?.name ?? "Hapus Logistics",
      });
      emailSent = wasEmailAccepted(mailResult);
    } catch {
      emailSent = false;
    }

    await createNotification({
      recipientUserId: operator._id.toString(),
      title: action === "approve" ? "Company Request Approved" : "Company Request Rejected",
      message:
        action === "approve"
          ? `Your operator request for ${company?.name ?? "Hapus Logistics"} was approved.`
          : `Your operator request for ${company?.name ?? "Hapus Logistics"} was rejected.`,
      type: action === "approve" ? "success" : "warning",
      metadata: {
        companyId: company?._id?.toString(),
        action,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        action === "approve"
          ? emailSent
            ? "Operator approved and confirmation email sent."
            : "Operator approved, but email was not delivered."
          : emailSent
            ? "Operator request rejected and email sent."
            : "Operator request rejected.",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to update operator status.",
      },
      { status: 500 },
    );
  }
}
