import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import {
  normalizeAuthProviders,
  serializeAuthProvidersForSchema,
} from "@/app/api/lib/authHelpers";

const JWT_SECRET = process.env.JWT_SECRET!;

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

dbConnect();

export async function POST(request: NextRequest) {
  try {
    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const reqBody = await request.json();
    const currentPassword =
      typeof reqBody?.currentPassword === "string" ? reqBody.currentPassword : "";
    const newPassword =
      typeof reqBody?.newPassword === "string" ? reqBody.newPassword.trim() : "";

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: "New password must be at least 6 characters.",
        },
        { status: 400 },
      );
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 },
      );
    }

    const providers = normalizeAuthProviders(user.authProvider);
    const requiresCurrentPassword = !user.mustChangePassword;

    if (requiresCurrentPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, message: "Current password is required." },
          { status: 400 },
        );
      }

      if (!user.password) {
        return NextResponse.json(
          { success: false, message: "Password is not available for this account." },
          { status: 400 },
        );
      }

      const isValidPassword = await bcryptjs.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return NextResponse.json(
          { success: false, message: "Current password is incorrect." },
          { status: 400 },
        );
      }
    }

    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    const authProviderSchemaInstance = User.schema.path("authProvider")?.instance;

    user.password = hashedPassword;
    user.authProvider = serializeAuthProvidersForSchema(
      providers.includes("local") ? providers : [...providers, "local"],
      authProviderSchemaInstance,
    );
    user.mustChangePassword = false;
    await user.save();

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to update password.",
      },
      { status: 500 },
    );
  }
}
