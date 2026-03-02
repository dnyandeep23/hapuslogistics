import { NextResponse } from "next/server";
import { ADMIN_OTP_COOKIE } from "@/app/api/lib/authHelpers";

export async function GET() {
    try {
        const response = NextResponse.json({
            message: "Logout successful",
            success: true,
        });
        response.cookies.set("token", "", {
            httpOnly: true,
            expires: new Date(0),
            path: "/",
        });
        response.cookies.set(ADMIN_OTP_COOKIE, "", {
            httpOnly: true,
            expires: new Date(0),
            path: "/",
        });
        return response;
    } catch (error: unknown) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Logout failed.",
            },
            { status: 500 },
        );
    }
}
