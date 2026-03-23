import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import { randomBytes } from "crypto";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import TravelCompany from "@/app/api/models/travelCompanyModel";
import { sendEmail, wasEmailAccepted } from "@/app/api/lib/mailer";
import { createNotification } from "@/app/api/lib/notifications";
import {
  normalizeAuthProviders,
  serializeAuthProvidersForSchema,
} from "@/app/api/lib/authHelpers";

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

const createTemporaryPassword = () => {
  const raw = randomBytes(9).toString("base64url").replace(/[^a-zA-Z0-9]/g, "");
  return `${raw.slice(0, 4)}${Math.floor(1000 + Math.random() * 9000)}Aa`;
};

export async function POST(request: NextRequest) {
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

    const authProviderSchemaInstance = User.schema.path("authProvider")?.instance;
    const operator = await User.findOne({ email }).select("+password");

    if (operator && operator.role !== "operator") {
      return NextResponse.json(
        { success: false, message: "This email belongs to another role." },
        { status: 400 },
      );
    }

    if (
      operator &&
      operator.operatorApprovalStatus === "approved" &&
      String(operator.travelCompanyId ?? "") === String(admin.travelCompanyId ?? "")
    ) {
      return NextResponse.json(
        { success: false, message: "This operator already exists in your company." },
        { status: 400 },
      );
    }

    if (
      operator &&
      operator.operatorApprovalStatus === "approved" &&
      String(operator.travelCompanyId ?? "") !== String(admin.travelCompanyId ?? "")
    ) {
      return NextResponse.json(
        { success: false, message: "This operator is already linked to another company." },
        { status: 400 },
      );
    }

    const temporaryPassword = createTemporaryPassword();
    const hashedPassword = await bcryptjs.hash(temporaryPassword, 10);

    let savedOperator = operator;

    if (!savedOperator) {
      savedOperator = await User.create({
        name: email.split("@")[0] || "Operator",
        email,
        password: hashedPassword,
        role: "operator",
        isVerified: true,
        authProvider: serializeAuthProvidersForSchema(["local"], authProviderSchemaInstance),
        travelCompanyId: admin.travelCompanyId,
        pendingTravelCompanyId: undefined,
        invitedByAdminId: admin._id,
        operatorApprovalStatus: "approved",
        mustChangePassword: true,
      });
    } else {
      const providers = normalizeAuthProviders(savedOperator.authProvider);
      const nextProviders = providers.includes("local") ? providers : [...providers, "local"];

      savedOperator.name = savedOperator.name || email.split("@")[0] || "Operator";
      savedOperator.password = hashedPassword;
      savedOperator.role = "operator";
      savedOperator.isVerified = true;
      savedOperator.authProvider = serializeAuthProvidersForSchema(
        nextProviders,
        authProviderSchemaInstance,
      );
      savedOperator.travelCompanyId = admin.travelCompanyId;
      savedOperator.pendingTravelCompanyId = undefined;
      savedOperator.invitedByAdminId = admin._id;
      savedOperator.operatorApprovalStatus = "approved";
      savedOperator.mustChangePassword = true;
      savedOperator.accountDeletionRequestedAt = undefined;
      savedOperator.accountDeletionExpiresAt = undefined;
      await savedOperator.save();
    }

    let emailSent = false;
    try {
      const result = await sendEmail({
        email,
        emailType: "OPERATOR_ACCOUNT_CREATED",
        operatorName: savedOperator.name,
        companyName,
        temporaryPassword,
      });
      emailSent = wasEmailAccepted(result);
    } catch {
      emailSent = false;
    }

    await createNotification({
      recipientUserId: savedOperator._id.toString(),
      title: "Operator Account Created",
      message: `${companyName} created your operator account. Sign in with the temporary password and update it immediately.`,
      type: "info",
      metadata: {
        companyId: admin.travelCompanyId?.toString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: emailSent
        ? "Operator account created and temporary credentials sent."
        : "Operator account created, but credential email could not be delivered.",
      operatorId: savedOperator._id.toString(),
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
