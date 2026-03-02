import { NextRequest, NextResponse } from "next/server";
import User from "@/app/api/models/userModel";
import bcryptjs from "bcryptjs";
import { dbConnect } from "@/app/api/lib/db";

dbConnect();

export async function POST(request: NextRequest) {
    try {
        const reqBody = await request.json()
        const { email, securityCode, password } = reqBody

        const user = await User.findOne({
            email,
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
