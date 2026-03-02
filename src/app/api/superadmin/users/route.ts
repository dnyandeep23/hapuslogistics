import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";

const JWT_SECRET = process.env.JWT_SECRET!;

type QueryRole = "admin" | "operator" | "customer";

const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

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

const hasProvider = (providers: unknown, provider: "local" | "google") => {
  if (!Array.isArray(providers)) return false;
  return providers.some((item) => String(item).trim().toLowerCase() === provider);
};

const isValidRole = (value: unknown): value is "user" | "operator" | "admin" => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "user" || normalized === "operator" || normalized === "admin";
};

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const actor = await User.findById(userId).select("isSuperAdmin role").lean<{ isSuperAdmin?: boolean } | null>();
    if (!actor?.isSuperAdmin) {
      return NextResponse.json({ success: false, message: "Super admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const categoryRaw = String(searchParams.get("category") ?? "customer").trim().toLowerCase();
    const searchTerm = String(searchParams.get("q") ?? searchParams.get("email") ?? "").trim();
    const category: QueryRole =
      categoryRaw === "admin" || categoryRaw === "operator" || categoryRaw === "customer"
        ? (categoryRaw as QueryRole)
        : "customer";

    const roleFilter = category === "customer" ? "user" : category;
    const query: Record<string, unknown> = {
      role: roleFilter,
      ...(category === "admin" ? { isSuperAdmin: { $ne: true } } : {}),
    };
    if (searchTerm) {
      const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { email: { $regex: escapedSearchTerm, $options: "i" } },
        { name: { $regex: escapedSearchTerm, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .populate("travelCompanyId", "name")
      .select("name email role phone isSuperAdmin authProvider travelCompanyId createdAt operatorApprovalStatus")
      .sort({ createdAt: -1 })
      .lean<
        Array<{
          _id: { toString: () => string };
          name?: string;
          email?: string;
          role?: string;
          phone?: string;
          isSuperAdmin?: boolean;
          authProvider?: unknown[];
          createdAt?: Date;
          operatorApprovalStatus?: string;
          travelCompanyId?: { name?: string } | null;
        }>
      >();

    return NextResponse.json(
      {
        success: true,
        category,
        users: users.map((user) => ({
          id: user._id.toString(),
          name: String(user.name ?? ""),
          email: String(user.email ?? ""),
          role: String(user.role ?? ""),
          phone: String(user.phone ?? ""),
          isSuperAdmin: Boolean(user.isSuperAdmin),
          authProvider: Array.isArray(user.authProvider)
            ? user.authProvider.map((provider) => String(provider))
            : [],
          isGoogleOnly: hasProvider(user.authProvider, "google") && !hasProvider(user.authProvider, "local"),
          operatorApprovalStatus: String(user.operatorApprovalStatus ?? ""),
          companyName: String(user.travelCompanyId?.name ?? ""),
          createdAt: user.createdAt ? user.createdAt.toISOString() : new Date().toISOString(),
        })),
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load users.",
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
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const actor = await User.findById(userId).select("isSuperAdmin role").lean<{ isSuperAdmin?: boolean } | null>();
    if (!actor?.isSuperAdmin) {
      return NextResponse.json({ success: false, message: "Super admin access required." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      userId?: unknown;
      name?: unknown;
      email?: unknown;
      phone?: unknown;
      role?: unknown;
    };

    const targetUserId = String(body.userId ?? "").trim();
    if (!targetUserId) {
      return NextResponse.json({ success: false, message: "userId is required." }, { status: 400 });
    }

    const targetUser = await User.findById(targetUserId).select(
      "_id name email phone role isSuperAdmin authProvider",
    );
    if (!targetUser) {
      return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
    }
    if (targetUser.isSuperAdmin) {
      return NextResponse.json({ success: false, message: "Super admin accounts cannot be edited here." }, { status: 403 });
    }

    const nextName = String(body.name ?? "").trim();
    const nextEmail = String(body.email ?? "").trim().toLowerCase();
    const nextPhone = String(body.phone ?? "").trim();
    const nextRoleRaw = String(body.role ?? "").trim().toLowerCase();

    const isGoogleOnly = hasProvider(targetUser.authProvider, "google") && !hasProvider(targetUser.authProvider, "local");
    const emailChanged = nextEmail && nextEmail !== String(targetUser.email ?? "").trim().toLowerCase();

    if (isGoogleOnly && emailChanged) {
      return NextResponse.json(
        {
          success: false,
          message: "This is a Google-based user. Email cannot be modified. Update name/contact only.",
        },
        { status: 400 },
      );
    }

    if (nextPhone && !PHONE_PATTERN.test(nextPhone.replace(/[\s()-]/g, ""))) {
      return NextResponse.json(
        { success: false, message: "Phone must be 10-15 digits (optional leading +)." },
        { status: 400 },
      );
    }

    if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid email address." },
        { status: 400 },
      );
    }

    if (nextName) {
      targetUser.name = nextName;
    }
    if (nextPhone || nextPhone === "") {
      targetUser.phone = nextPhone;
    }

    if (!isGoogleOnly && nextEmail) {
      targetUser.email = nextEmail;
    }

    if (!isGoogleOnly && nextRoleRaw) {
      if (!isValidRole(nextRoleRaw)) {
        return NextResponse.json(
          { success: false, message: "Role must be user, operator, or admin." },
          { status: 400 },
        );
      }
      targetUser.role = nextRoleRaw;
    }

    await targetUser.save();

    return NextResponse.json(
      {
        success: true,
        message: "User updated successfully.",
        user: {
          id: String(targetUser._id),
          name: String(targetUser.name ?? ""),
          email: String(targetUser.email ?? ""),
          phone: String(targetUser.phone ?? ""),
          role: String(targetUser.role ?? ""),
          isGoogleOnly,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const isDuplicateEmail =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000;
    const message =
      isDuplicateEmail
        ? "Email is already used by another user."
        : error instanceof Error
          ? error.message
          : "Failed to update user.";

    return NextResponse.json({ success: false, message }, { status: isDuplicateEmail ? 409 : 500 });
  }
}
