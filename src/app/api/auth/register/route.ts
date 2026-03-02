import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import TravelCompany from "@/app/api/models/travelCompanyModel";
import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import mongoose from "mongoose";
import { sendEmail, wasEmailAccepted } from "@/app/api/lib/mailer";
import { createNotification } from "@/app/api/lib/notifications";
import {
  ADMIN_OTP_COOKIE,
  ADMIN_OTP_EXPIRY_MS,
  generateAdminOtp,
  normalizeRole,
  serializeAuthProvidersForSchema,
  signPendingAdminToken,
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

    if (role === "admin" && !companyName) {
      return NextResponse.json(
        {
          success: false,
          message: "Company name is required for admin registration.",
        },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      if (existingUser.isSuperAdmin && existingUser.role !== "admin") {
        existingUser.role = "admin";
        await existingUser.save();
      }

      return NextResponse.json(
        { success: false, message: "User already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);
    const authProviderSchemaInstance = User.schema.path("authProvider")?.instance;
    let travelCompanyId: string | undefined;

    if (role === "admin") {
      const existingCompany = await TravelCompany.findOne({
        name: { $regex: `^${companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      });

      if (existingCompany) {
        const currentAdminCount = await User.countDocuments({
          travelCompanyId: existingCompany._id,
          role: "admin",
          isSuperAdmin: { $ne: true },
        });
        if (currentAdminCount >= 4) {
          return NextResponse.json(
            {
              success: false,
              message: "This logistics company already has 4 admins (excluding super admins).",
            },
            { status: 400 },
          );
        }
        travelCompanyId = existingCompany._id.toString();
      } else {
        const company = await TravelCompany.create({
          name: companyName,
          ownerEmail: normalizedEmail,
          contact: {
            email: normalizedEmail,
          },
        });
        travelCompanyId = company._id.toString();
      }
    }

    let pendingTravelCompanyId: string | undefined;
    let operatorCompanyOwnerUserId: string | undefined;
    let operatorCompanyOwnerEmail: string | undefined;
    let operatorCompanyResolvedName: string | undefined;

    if (role === "operator" && (companyId || companyName)) {
      let requestedCompany:
        | {
            _id: mongoose.Types.ObjectId;
            name: string;
            ownerUserId?: mongoose.Types.ObjectId;
            ownerEmail?: string;
            contact?: { email?: string };
          }
        | null = null;

      if (companyId) {
        if (!mongoose.Types.ObjectId.isValid(companyId)) {
          return NextResponse.json(
            { success: false, message: "Invalid travel company selected." },
            { status: 400 },
          );
        }
        requestedCompany = await TravelCompany.findById(companyId)
          .select("_id name ownerUserId ownerEmail contact")
          .lean();
      }

      if (!requestedCompany && companyName) {
        requestedCompany = await TravelCompany.findOne({
          name: {
            $regex: `^${companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            $options: "i",
          },
        })
          .select("_id name ownerUserId ownerEmail contact")
          .lean();
      }

      if (!requestedCompany) {
        return NextResponse.json(
          {
            success: false,
            message: "Travel company not found. Please select a valid company.",
          },
          { status: 404 },
        );
      }

      pendingTravelCompanyId = requestedCompany._id.toString();
      operatorCompanyResolvedName = requestedCompany.name;
      if (requestedCompany.ownerUserId) {
        operatorCompanyOwnerUserId = requestedCompany.ownerUserId.toString();
      }
      operatorCompanyOwnerEmail =
        requestedCompany.ownerEmail || requestedCompany.contact?.email || undefined;
    }

    // Create a new user
    const newUser = await User.create({
      name: role === "admin" ? normalizedName || companyName : normalizedName,
      role,
      email: normalizedEmail,
      password: hashedPassword,
      authProvider: serializeAuthProvidersForSchema(["local"], authProviderSchemaInstance),
      travelCompanyId,
      hasRegisteredBus: role === "admin" ? false : undefined,
      buses: [],
      operatorApprovalStatus:
        role === "operator" && pendingTravelCompanyId ? "operator_requested" : "none",
      pendingTravelCompanyId,
    });

    // Save the user to the database
    const savedUser = await newUser.save();

    if (savedUser.isSuperAdmin && savedUser.role !== "admin") {
      savedUser.role = "admin";
      await savedUser.save();
    }

    if (role === "admin" && savedUser.travelCompanyId) {
      const company = await TravelCompany.findById(savedUser.travelCompanyId).select("ownerUserId ownerEmail");
      if (company && !company.ownerUserId) {
        company.ownerUserId = savedUser._id;
      }
      if (company && !company.ownerEmail) {
        company.ownerEmail = savedUser.email;
      }
      if (company) {
        await company.save();
      }
    }

    if (role === "admin") {
      const adminOtp = generateAdminOtp();
      savedUser.role = "admin";
      savedUser.isVerified = true;
      savedUser.adminAccessCode = adminOtp;
      savedUser.adminAccessCodeExpiry = new Date(Date.now() + ADMIN_OTP_EXPIRY_MS);
      await savedUser.save();

      let adminOtpSent = false;
      try {
        const otpEmailResult = await sendEmail({
          email: normalizedEmail,
          emailType: "ADMIN_OTP",
          securityCode: adminOtp,
        });
        adminOtpSent = wasEmailAccepted(otpEmailResult);
      } catch {
        adminOtpSent = false;
      }

      const pendingToken = signPendingAdminToken({
        id: savedUser._id.toString(),
        role: "admin",
        email: savedUser.email,
      });

      const response = NextResponse.json({
        message: adminOtpSent
          ? "Admin registration successful. Access code sent to your email."
          : "Admin registration successful, but access code email was not delivered. Please use Resend Access Code.",
        success: true,
        requiresOtp: true,
        deliveryStatus: adminOtpSent ? "sent" : "failed",
      });

      response.cookies.set(ADMIN_OTP_COOKIE, pendingToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: ADMIN_OTP_EXPIRY_MS / 1000,
      });

      return response;
    }

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
      message: "User created successfully",
      success: true,
      emailsent: res.accepted.length > 0 && res.rejected.length === 0,
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
