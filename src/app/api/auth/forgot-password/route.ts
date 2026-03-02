import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/app/api/lib/mailer";
import { normalizeAuthProviders } from "@/app/api/lib/authHelpers";

dbConnect();

// Function to generate a random alphanumeric string
const generateSecurityCode = (length: number): string => {
  const characters = '0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

export async function POST(request: NextRequest) {
  try {
    const reqBody = await request.json();
    const { email } = reqBody;

    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const providers = normalizeAuthProviders(user.authProvider);
    if (!providers.includes("local")) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This account uses Google login. Please sign in with Google instead.",
        },
        { status: 400 },
      );
    }

    // Generate and save security code
    const securityCode = generateSecurityCode(8);
    user.securityCode = securityCode;
    user.securityCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    await user.save();

    // Send password reset email with the security code
    await sendEmail({
      email,
      emailType: "RESET",
      securityCode,
    });

    return NextResponse.json({
      message: "Password reset code sent to your email.",
      success: true,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to process request.",
      },
      { status: 500 },
    );
  }
}
