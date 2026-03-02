import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import User from "@/app/api/models/userModel";
import { dbConnect } from "@/app/api/lib/db";

const JWT_SECRET = process.env.JWT_SECRET!;
const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;
const NAME_PATTERN = /^[a-zA-Z][a-zA-Z\s.'-]{1,79}$/;

const getTokenUserId = (request: NextRequest): string | null => {
    const token = request.cookies.get("token")?.value;
    if (!token) return null;

    try {
        const payload = jwt.verify(token, JWT_SECRET) as { id?: string };
        return payload.id ?? null;
    } catch {
        return null;
    }
};

const normalizePhone = (value: unknown): string | null => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";

    const cleaned = raw.replace(/[\s()-]/g, "");
    if (!PHONE_PATTERN.test(cleaned)) {
        return null;
    }
    return cleaned;
};

const normalizeName = (value: unknown): string | null => {
    const raw = String(value ?? "").trim().replace(/\s+/g, " ");
    if (!raw) return null;
    if (!NAME_PATTERN.test(raw)) {
        return null;
    }
    return raw;
};

export async function GET(request: NextRequest) {
    try {
        await dbConnect();

        const userId = getTokenUserId(request);
        if (!userId) {
            return NextResponse.json(
                { authenticated: false, reason: "NO_TOKEN" },
                { status: 401 }
            );
        }
        const user = await User.findById(userId);

        if (!user) {
            const res = NextResponse.json(
                { authenticated: false, reason: "USER_NOT_FOUND" },
                { status: 401 }
            );

            res.cookies.set("token", "", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                path: "/",
                maxAge: 0,
            });
            return res;
        }

        return NextResponse.json(
            {
                authenticated: true,
                user,
            },
            { status: 200 }
        );

    } catch {
        const res = NextResponse.json(
            { authenticated: false, reason: "TOKEN_INVALID" },
            { status: 401 }
        );

        res.cookies.delete("token");
        return res;
    }
}

export async function PATCH(request: NextRequest) {
    try {
        await dbConnect();

        const userId = getTokenUserId(request);
        if (!userId) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 },
            );
        }

        let reqBody: Record<string, unknown>;
        try {
            reqBody = await request.json();
        } catch {
            return NextResponse.json(
                { success: false, message: "Invalid request body." },
                { status: 400 },
            );
        }

        const hasPhone = "phone" in reqBody;
        const hasName = "name" in reqBody;

        if (!hasPhone && !hasName) {
            return NextResponse.json(
                { success: false, message: "At least one field (name or phone) is required." },
                { status: 400 },
            );
        }

        const normalizedPhone = hasPhone ? normalizePhone(reqBody.phone) : undefined;
        if (hasPhone && normalizedPhone === null) {
          return NextResponse.json(
            { success: false, message: "Enter a valid contact number (10-15 digits)." },
            { status: 400 },
          );
        }

        const normalizedName = hasName ? normalizeName(reqBody.name) : undefined;
        if (hasName && normalizedName === null) {
          return NextResponse.json(
            { success: false, message: "Enter a valid full name." },
            { status: 400 },
          );
        }

        const user = await User.findById(userId);
        if (!user) {
            return NextResponse.json(
                { success: false, message: "User not found." },
                { status: 404 },
            );
        }

        if (hasName && normalizedName) {
          user.name = normalizedName;
        }
        if (hasPhone) {
          user.phone = normalizedPhone || undefined;
        }
        await user.save();

        return NextResponse.json(
            {
                success: true,
                message: "Profile updated successfully.",
                user,
            },
            { status: 200 },
        );
    } catch (error: unknown) {
        return NextResponse.json(
            {
                success: false,
                message: error instanceof Error ? error.message : "Failed to update profile.",
            },
            { status: 500 },
        );
    }
}
