import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import { sendEmail, wasEmailAccepted } from "@/app/api/lib/mailer";
import {
  ADMIN_OTP_COOKIE,
  ADMIN_OTP_EXPIRY_MS,
  generateAdminOtp,
  normalizeAuthProviders,
  normalizeRole,
  signAuthToken,
  signPendingAdminToken,
} from "@/app/api/lib/authHelpers";

// dbConnect to the database
dbConnect();

export async function POST(request: NextRequest) {
  try {
    const reqBody = await request.json();
    const { email, password, role: incomingRole, adminLogin } = reqBody as {
      email?: string;
      password?: string;
      role?: unknown;
      adminLogin?: boolean;
    };
    const normalizedRole = normalizeRole(incomingRole);
    const role = normalizedRole === "operator" ? "operator" : "user";
    const isAdminLogin = Boolean(adminLogin);

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and password are required.",
        },
        { status: 400 },
      );
    }

    // Fetch user INCLUDING password (because it is select:false in schema)
    const user = isAdminLogin
      ? await User.findOne({ email }).select("+password")
      : await User.findOne({ email, role }).select("+password");

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: isAdminLogin
            ? "No admin account found for this email."
            : "No user exists for the selected role. Please sign up to continue.",
        },
        { status: 400 }
      );
    }

    if (isAdminLogin && user.role !== "admin" && !user.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          message: "This account does not have admin access.",
        },
        { status: 403 },
      );
    }

    // ---- SAFE CHECK FOR LOCAL LOGIN ----
    const providers = normalizeAuthProviders(user.authProvider);

    if (!providers.includes("local")) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This email is already associated with another login method. Please log in using your original method.",
        },
        { status: 400 }
      );
    }

    // Check if password exists (extra safety)
    if (!user.password) {
      return NextResponse.json(
        {
          success: false,
          message: "Password not set for this account.",
        },
        { status: 400 }
      );
    }

    // Check if password is correct
    const validPassword = await bcryptjs.compare(password, user.password);

    if (!validPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "Please check your email, password, and role.",
        },
        { status: 400 }
      );
    }

    // Check if user is verified
    if (!user.isVerified) {
      // Resend verification email
      const verifyEmailResult = await sendEmail({
        email,
        emailType: "VERIFY",
        userId: user._id.toString(),
      });

      const verifyEmailSent = wasEmailAccepted(verifyEmailResult);
      return NextResponse.json(
        {
          success: false,
          message: verifyEmailSent
            ? "Account not verified. A new verification email has been sent."
            : "Account not verified and verification email could not be delivered. Please try resend verification.",
        },
        { status: 401 }
      );
    }

    if (isAdminLogin) {
      user.role = "admin";
      const adminOtp = generateAdminOtp();
      user.adminAccessCode = adminOtp;
      user.adminAccessCodeExpiry = new Date(Date.now() + ADMIN_OTP_EXPIRY_MS);
      await user.save();

      const pendingToken = signPendingAdminToken({
        id: user._id.toString(),
        role: "admin",
        email: user.email,
      });

      let adminOtpSent = false;
      try {
        const otpEmailResult = await sendEmail({
          email: user.email,
          emailType: "ADMIN_OTP",
          securityCode: adminOtp,
        });
        adminOtpSent = wasEmailAccepted(otpEmailResult);
      } catch {
        adminOtpSent = false;
      }

      const response = NextResponse.json({
        message: adminOtpSent
          ? "One-time admin access code sent to your email."
          : "We couldn't deliver the access code email. Please use Resend Access Code.",
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

    // Create token data
    const token = signAuthToken({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      authProvider: providers,
      role: user.role,
    });

    const response = NextResponse.json({
      message: "Login successful",
      success: true,
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    response.cookies.set(ADMIN_OTP_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Login failed.",
      },
      { status: 500 }
    );
  }
}
