import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import { sendEmail, wasEmailAccepted } from "@/app/api/lib/mailer";
import { createNotification } from "@/app/api/lib/notifications";
import { resolveOperatorCompany } from "@/app/api/lib/companyResolver";
import {
  normalizeRole,
  serializeAuthProvidersForSchema,
} from "@/app/api/lib/authHelpers";

// dbConnect to the database
dbConnect();

export async function POST(request: NextRequest) {
  try {
    const reqBody = await request.json();
    const {
      name,
      email,
      password,
      role: incomingRole,
      companyName: incomingCompanyName,
      companyId: incomingCompanyId,
    } = reqBody as {
      name?: string;
      email?: string;
      password?: string;
      role?: unknown;
      companyName?: unknown;
      companyId?: unknown;
    };
    const role = normalizeRole(incomingRole) ?? "user";
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const companyName =
      typeof incomingCompanyName === "string" ? incomingCompanyName.trim() : "";
    const companyId =
      typeof incomingCompanyId === "string" ? incomingCompanyId.trim() : "";

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required." },
        { status: 400 },
      );
    }

    if (role !== "admin" && !normalizedName) {
      return NextResponse.json(
        { success: false, message: "Name is required." },
        { status: 400 },
      );
    }

    if (role === "admin") {
      return NextResponse.json(
        {
          success: false,
          message: "Admin registration is disabled.",
        },
        { status: 403 },
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "User already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);
    const authProviderSchemaInstance = User.schema.path("authProvider")?.instance;
    let pendingTravelCompanyId: string | undefined;
    let operatorCompanyOwnerUserId: string | undefined;
    let operatorCompanyOwnerEmail: string | undefined;
    let operatorCompanyResolvedName: string | undefined;

    if (role === "operator") {
      const { company: requestedCompany, reason } = await resolveOperatorCompany({
        companyId,
        companyName,
      });

      if (!requestedCompany && (companyId || companyName)) {
        return NextResponse.json(
          {
            success: false,
            message:
              reason === "INVALID_ID"
                ? "Invalid travel company selected."
                : "Travel company not found. Please select a valid company.",
          },
          { status: reason === "INVALID_ID" ? 400 : 404 },
        );
      }

      if (!requestedCompany && reason === "MULTIPLE_COMPANIES") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Multiple travel companies are configured. Operator registration requires a company selection.",
          },
          { status: 400 },
        );
      }

      if (requestedCompany) {
        pendingTravelCompanyId = requestedCompany._id.toString();
        operatorCompanyResolvedName = requestedCompany.name;
        if (requestedCompany.ownerUserId) {
          operatorCompanyOwnerUserId = requestedCompany.ownerUserId.toString();
        }
        operatorCompanyOwnerEmail =
          requestedCompany.ownerEmail || requestedCompany.contact?.email || undefined;
      }
    }

    // Create a new user
    const newUser = await User.create({
      name: normalizedName,
      role,
      email: normalizedEmail,
      password: hashedPassword,
      authProvider: serializeAuthProvidersForSchema(["local"], authProviderSchemaInstance),
      travelCompanyId: undefined,
      buses: [],
      operatorApprovalStatus:
        role === "operator" && pendingTravelCompanyId ? "operator_requested" : "none",
      pendingTravelCompanyId,
    });

    // Save the user to the database
    const savedUser = await newUser.save();

    if (role === "operator" && pendingTravelCompanyId && operatorCompanyResolvedName) {
      if (operatorCompanyOwnerEmail) {
        try {
          await sendEmail({
            email: operatorCompanyOwnerEmail,
            emailType: "OPERATOR_REQUEST_TO_COMPANY",
            operatorName: savedUser.name,
            companyName: operatorCompanyResolvedName,
            adminName: operatorCompanyResolvedName,
          });
        } catch {
          // Non-blocking mail
        }
      }

      try {
        await sendEmail({
          email: savedUser.email,
          emailType: "OPERATOR_REQUEST_SUBMITTED",
          operatorName: savedUser.name,
          companyName: operatorCompanyResolvedName,
        });
      } catch {
        // Non-blocking mail
      }

      if (operatorCompanyOwnerUserId) {
        await createNotification({
          recipientUserId: operatorCompanyOwnerUserId,
          title: "New Operator Join Request",
          message: `${savedUser.name} (${savedUser.email}) requested to join your company.`,
          type: "info",
          metadata: {
            operatorId: savedUser._id.toString(),
            companyId: pendingTravelCompanyId,
          },
        });
      }
    }

    // Send verification email
    const res = await sendEmail({
      email: normalizedEmail,
      emailType: "VERIFY",
      userId: savedUser._id.toString(),
    });

    // Send response
    return NextResponse.json({
      message:
        role === "operator" && operatorCompanyResolvedName
          ? `User created successfully. Your operator request was sent to ${operatorCompanyResolvedName}.`
          : "User created successfully",
      success: true,
      emailsent: wasEmailAccepted(res),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Registration failed.",
      },
      { status: 500 },
    );
  }
}
