import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import CompanyProfile from "@/app/api/models/companyProfileModel";

const JWT_SECRET = process.env.JWT_SECRET!;

type UnknownRecord = Record<string, unknown>;

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

const cleanText = (value: unknown): string => String(value ?? "").trim();

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(userId)
      .select("_id")
      .lean<UnknownRecord | null>();

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
    }

    let profile = await CompanyProfile.findOne()
      .sort({ createdAt: 1 })
      .select("companyName supportEmail supportPhone")
      .lean<{
        companyName?: string;
        supportEmail?: string;
        supportPhone?: string;
      } | null>();

    if (!profile) {
      const createdProfile = await CompanyProfile.create({});
      profile = {
        companyName: cleanText(createdProfile.companyName),
        supportEmail: cleanText(createdProfile.supportEmail),
        supportPhone: cleanText(createdProfile.supportPhone),
      };
    }

    return NextResponse.json(
      {
        success: true,
        support: {
          name: cleanText(profile?.companyName) || "Support",
          email: cleanText(profile?.supportEmail),
          phone: cleanText(profile?.supportPhone),
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load support details.",
      },
      { status: 500 },
    );
  }
}
