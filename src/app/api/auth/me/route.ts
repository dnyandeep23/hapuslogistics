import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import User from "@/app/api/models/userModel";
import Bus from "@/app/api/models/busModel";
import { dbConnect } from "@/app/api/lib/db";
import TravelCompany from "@/app/api/models/travelCompanyModel";
import { createNotification } from "@/app/api/lib/notifications";
import {
    isAccountDeletionExpired,
    permanentlyDeleteUserAccount,
    scheduleAccountDeletion,
} from "@/app/api/lib/accountDeletion";
import { normalizeIndiaPhone } from "@/lib/phone";

const JWT_SECRET = process.env.JWT_SECRET!;
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
    return normalizeIndiaPhone(value);
};

const normalizeName = (value: unknown): string | null => {
    const raw = String(value ?? "").trim().replace(/\s+/g, " ");
    if (!raw) return null;
    if (!NAME_PATTERN.test(raw)) {
        return null;
    }
    return raw;
};

const getActiveOperatorBusAssignmentCount = async (operatorId: string) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    return Bus.countDocuments({
        operatorContactPeriods: {
            $elemMatch: {
                operatorId,
                endDate: { $gte: today },
            },
        },
    });
};

const getOperatorAdminContactPhone = async (companyId: unknown) => {
    if (!companyId) return "";

    const company = await TravelCompany.findById(companyId)
        .select("ownerUserId contact")
        .lean<{
            ownerUserId?: { toString(): string } | null;
            contact?: { phone?: string | null } | null;
        } | null>();

    if (!company) return "";

    if (company.ownerUserId) {
        const owner = await User.findById(company.ownerUserId)
            .select("phone")
            .lean<{ phone?: string | null } | null>();
        const ownerPhone = String(owner?.phone ?? "").trim();
        if (ownerPhone) return ownerPhone;
    }

    return String(company.contact?.phone ?? "").trim();
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

        if (isAccountDeletionExpired(user)) {
            await permanentlyDeleteUserAccount(user);
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

        let assignedBusCount = 0;
        let adminContactPhone = "";
        if (user.role === "operator") {
            assignedBusCount = await getActiveOperatorBusAssignmentCount(user._id.toString());
            adminContactPhone = await getOperatorAdminContactPhone(
                user.travelCompanyId || user.pendingTravelCompanyId,
            );
        }

        const serializedUser =
            typeof user.toObject === "function"
                ? user.toObject()
                : user;

        return NextResponse.json(
            {
                authenticated: true,
                user: {
                    ...serializedUser,
                    assignedBusCount,
                    adminContactPhone,
                },
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

export async function DELETE(request: NextRequest) {
    try {
        await dbConnect();

        const userId = getTokenUserId(request);
        if (!userId) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 },
            );
        }

        const user = await User.findById(userId);
        if (!user) {
            const response = NextResponse.json(
                { success: false, message: "User not found." },
                { status: 404 },
            );
            response.cookies.set("token", "", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                path: "/",
                maxAge: 0,
            });
            return response;
        }

        if (user.role === "operator") {
            const assignedBusCount = await getActiveOperatorBusAssignmentCount(user._id.toString());
            if (assignedBusCount > 0) {
                const adminContactPhone = await getOperatorAdminContactPhone(
                    user.travelCompanyId || user.pendingTravelCompanyId,
                );

                return NextResponse.json(
                    {
                        success: false,
                        code: "OPERATOR_ASSIGNED_TO_BUSES",
                        assignedBusCount,
                        adminContactPhone,
                        message: adminContactPhone
                            ? `You are already assigned to ${assignedBusCount} bus${assignedBusCount === 1 ? "" : "es"}. Contact admin at ${adminContactPhone} before requesting account deletion.`
                            : `You are already assigned to ${assignedBusCount} bus${assignedBusCount === 1 ? "" : "es"}. Contact your admin before requesting account deletion.`,
                    },
                    { status: 409 },
                );
            }
        }

        const schedule = await scheduleAccountDeletion(user);
        const companyId = user.travelCompanyId || user.pendingTravelCompanyId;

        if (user.role === "operator" && companyId) {
            const company = await TravelCompany.findById(companyId).select("name ownerUserId");
            const ownerUserId = company?.ownerUserId?.toString();

            if (ownerUserId && ownerUserId !== user._id.toString()) {
                await createNotification({
                    recipientUserId: ownerUserId,
                    title: "Operator Account Deletion Scheduled",
                    message: `${user.name || "An operator"} (${user.email}) scheduled account deletion. The account will expire on ${schedule.expiresAt.toLocaleString("en-IN")}.`,
                    type: "warning",
                    metadata: {
                        operatorId: user._id.toString(),
                        companyId: company?._id?.toString(),
                        scheduledDeletionRequestedAt: schedule.requestedAt.toISOString(),
                        scheduledDeletionExpiresAt: schedule.expiresAt.toISOString(),
                    },
                });
            }
        }

        const response = NextResponse.json(
            {
                success: true,
                message: "Account deletion scheduled. Log in within 3 days to cancel it.",
                scheduledDeletionRequestedAt: schedule.requestedAt.toISOString(),
                scheduledDeletionExpiresAt: schedule.expiresAt.toISOString(),
            },
            { status: 200 },
        );

        response.cookies.set("token", "", {
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
                message: error instanceof Error ? error.message : "Failed to schedule account deletion.",
            },
            { status: 500 },
        );
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
            { success: false, message: "Enter a valid Indian mobile number." },
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
