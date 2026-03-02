import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import { sendEmail, wasEmailAccepted } from "@/app/api/lib/mailer";
import {
  ADMIN_OTP_COOKIE,
  ADMIN_OTP_EXPIRY_MS,
  generateAdminOtp,
  signPendingAdminToken,
  verifyPendingAdminToken,
} from "@/app/api/lib/authHelpers";

dbConnect();

export async function POST(request: NextRequest) {
  try {
    const pendingToken = request.cookies.get(ADMIN_OTP_COOKIE)?.value;
    if (!pendingToken) {
      return NextResponse.json(
        { success: false, message: "Admin session expired. Please log in again." },
        { status: 401 },
      );
    }

    const pendingPayload = verifyPendingAdminToken(pendingToken);
    if (!pendingPayload) {
      return NextResponse.json(
        { success: false, message: "Invalid admin verification session." },
        { status: 401 },
      );
    }

    const user = await User.findById(pendingPayload.id);
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      return NextResponse.json(
        { success: false, message: "Admin account not found." },
        { status: 404 },
      );
    }

    const adminOtp = generateAdminOtp();
    user.role = "admin";
    user.adminAccessCode = adminOtp;
    user.adminAccessCodeExpiry = new Date(Date.now() + ADMIN_OTP_EXPIRY_MS);
    await user.save();

    const otpEmailResult = await sendEmail({
      email: user.email,
      emailType: "ADMIN_OTP",
      securityCode: adminOtp,
    });

    if (!wasEmailAccepted(otpEmailResult)) {
      return NextResponse.json(
        { success: false, message: "Access code email could not be delivered. Please try again." },
        { status: 500 },
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "A fresh admin access code has been sent to your email.",
    });

    const refreshedToken = signPendingAdminToken({
      id: user._id.toString(),
      role: "admin",
      email: user.email,
    });

    response.cookies.set(ADMIN_OTP_COOKIE, refreshedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_OTP_EXPIRY_MS / 1000,
    });

    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to resend OTP.",
      },
      { status: 500 },
    );
  }
}
