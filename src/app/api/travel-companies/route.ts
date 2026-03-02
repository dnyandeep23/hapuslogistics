import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import TravelCompany from "@/app/api/models/travelCompanyModel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    const excludeCompanyId = request.nextUrl.searchParams.get("excludeCompanyId")?.trim() || "";
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const findQuery: Record<string, unknown> = {};

    if (query) {
      findQuery.name = { $regex: escapedQuery, $options: "i" };
    }
    if (excludeCompanyId && mongoose.Types.ObjectId.isValid(excludeCompanyId)) {
      findQuery._id = { $ne: new mongoose.Types.ObjectId(excludeCompanyId) };
    }

    const companies = await TravelCompany.find(findQuery)
      .select("_id name ownerUserId ownerEmail contact")
      .sort({ name: 1 })
      .limit(100)
      .lean();

    return NextResponse.json(
      { success: true, companies },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch travel companies.",
      },
      { status: 500 },
    );
  }
}
