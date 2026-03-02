import { dbConnect } from "@/app/api/lib/db";
import { NextRequest, NextResponse } from "next/server";
import User from "@/app/api/models/userModel";
import jwt from "jsonwebtoken";

dbConnect();

export async function POST(request: NextRequest) {
    try {
        const reqBody = await request.json()
        const { token } = reqBody

        const user = await User.findOne({ verifyToken: token, verifyTokenExpiry: { $gt: Date.now() } });

        if (!user) {
            return NextResponse.json({ success: false, message: "Invalid or expired token" }, { status: 400 })
        }

        user.isVerified = true;
        user.verifyToken = undefined;
        user.verifyTokenExpiry = undefined;

        // Create long-lived access token
        const accessTokenData = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        };
        const accessToken = jwt.sign(accessTokenData, process.env.JWT_SECRET!, {
            expiresIn: "30d",
        });

        user.accessToken = accessToken;

        await user.save();

        return NextResponse.json({
            message: "Email verified successfully. Access token granted.",
            success: true,
            accessToken,
        })

    } catch (error: unknown) {
        return NextResponse.json(
            {
                success: false,
                message: error instanceof Error ? error.message : "Email verification failed.",
            },
            { status: 500 },
        )
    }
}
