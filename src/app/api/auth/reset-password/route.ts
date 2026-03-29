import { NextRequest, NextResponse } from "next/server";
import User from "@/app/api/models/userModel";
import bcryptjs from "bcryptjs";
import { dbConnect } from "@/app/api/lib/db";
import {
    getEmailValidationMessage,
    getOtpValidationMessage,
    getPasswordValidationMessage,
    normalizeEmail,
} from "@/lib/authFlow";

dbConnect();

export async function POST(request: NextRequest) {
    try {
        const reqBody = await request.json()
        const normalizedEmail = normalizeEmail(
            typeof reqBody?.email === "string" ? reqBody.email : "",
        )
        const securityCode = typeof reqBody?.securityCode === "string" ? reqBody.securityCode : ""
        const password = typeof reqBody?.password === "string" ? reqBody.password : ""
        const emailError = getEmailValidationMessage(normalizedEmail)
        const securityCodeError = getOtpValidationMessage(securityCode, 8, "Security code")
        const passwordError = getPasswordValidationMessage(password)

        if (emailError || securityCodeError || passwordError) {
            return NextResponse.json(
                {
                    success: false,
                    message: emailError ?? securityCodeError ?? passwordError,
                },
                { status: 400 },
            )
        }

        const user = await User.findOne({
            email: normalizedEmail,
            securityCode: securityCode,
            securityCodeExpiry: { $gt: Date.now() }
        });

        if (!user) {
            return NextResponse.json({ success: false, message: "Invalid or expired security code" }, { status: 400 })
        }

        // Hash new password
        const salt = await bcryptjs.genSalt(10)
        const hashedPassword = await bcryptjs.hash(password, salt)

        user.password = hashedPassword
        user.securityCode = undefined;
        user.securityCodeExpiry = undefined;
        await user.save();

        return NextResponse.json({
            message: "Password updated successfully",
            success: true
        })

    } catch (error: unknown) {
        return NextResponse.json(
            {
                success: false,
                message: error instanceof Error ? error.message : "Failed to reset password.",
            },
            { status: 500 },
        )
    }
}
