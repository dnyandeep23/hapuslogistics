import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import {
  ADMIN_OTP_COOKIE,
  normalizeAuthProviders,
  signAuthToken,
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

    const reqBody = await request.json();
    const { code } = reqBody as { code?: string };

    if (!code) {
      return NextResponse.json(
        { success: false, message: "Access code is required." },
        { status: 400 },
      );
    }

    const user = await User.findById(pendingPayload.id);
    if (!user || (user.role !== "admin" && !user.isSuperAdmin)) {
      return NextResponse.json(
        { success: false, message: "Admin account not found." },
        { status: 404 },
      );
    }

    if (
      !user.adminAccessCode ||
      user.adminAccessCode !== code ||
      !user.adminAccessCodeExpiry ||
      user.adminAccessCodeExpiry.getTime() < Date.now()
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired access code." },
        { status: 400 },
      );
    }

    user.role = "admin";
    user.isVerified = true;
    user.adminAccessCode = undefined;
    user.adminAccessCodeExpiry = undefined;
    await user.save();

    const token = signAuthToken({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      authProvider: normalizeAuthProviders(user.authProvider),
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      message: "Admin login verified successfully.",
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
        message:
          error instanceof Error ? error.message : "OTP verification failed.",
      },
      { status: 500 },
    );
  }
}
