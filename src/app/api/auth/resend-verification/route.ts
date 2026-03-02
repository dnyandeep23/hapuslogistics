import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/app/api/lib/mailer";

dbConnect();

export async function POST(request: NextRequest) {
  try {
    const reqBody = await request.json();
    const { email } = reqBody;

    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    if (user.isVerified) {
      return NextResponse.json({ success: false, message: "This account is already verified." }, { status: 400 });
    }

    // Resend verification email
    await sendEmail({
      email,
      emailType: "VERIFY",
      userId: user._id.toString(),
    });

    return NextResponse.json({
      message: "Verification email sent successfully.",
      success: true,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to resend verification email.",
      },
      { status: 500 },
    );
  }
}
