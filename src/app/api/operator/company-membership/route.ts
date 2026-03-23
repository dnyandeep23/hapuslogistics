import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import TravelCompany from "@/app/api/models/travelCompanyModel";
import { createNotification } from "@/app/api/lib/notifications";
import { permanentlyDeleteUserAccount } from "@/app/api/lib/accountDeletion";

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

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const operator = await User.findById(userId).select(
      "role travelCompanyId operatorApprovalStatus pendingTravelCompanyId",
    );
    if (!operator || operator.role !== "operator") {
      return NextResponse.json({ success: false, message: "Operator access required." }, { status: 403 });
    }

    if (!operator.travelCompanyId || operator.operatorApprovalStatus !== "approved") {
      return NextResponse.json(
        { success: true, hasCompany: false, company: null },
        { status: 200 },
      );
    }

    const company = await TravelCompany.findById(operator.travelCompanyId)
      .select("_id name")
      .lean<{ _id: { toString(): string }; name: string } | null>();

    if (!company) {
      return NextResponse.json(
        { success: true, hasCompany: false, company: null },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        hasCompany: true,
        company: {
          companyId: company._id.toString(),
          companyName: company.name,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch company membership.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const operator = await User.findById(userId);
    if (!operator || operator.role !== "operator") {
      return NextResponse.json({ success: false, message: "Operator access required." }, { status: 403 });
    }

    if (!operator.travelCompanyId || operator.operatorApprovalStatus !== "approved") {
      return NextResponse.json(
        { success: false, message: "You are not linked to any approved company." },
        { status: 400 },
      );
    }

    const company = await TravelCompany.findById(operator.travelCompanyId)
      .select("_id name ownerUserId")
      .lean<{ _id: { toString(): string }; name: string; ownerUserId?: { toString(): string } | null } | null>();

    if (company?.ownerUserId) {
      await createNotification({
        recipientUserId: company.ownerUserId.toString(),
        title: "Operator Left Company",
        message: `${operator.name} (${operator.email}) left ${company.name} and the operator account was deleted.`,
        type: "warning",
        metadata: {
          operatorId: operator._id.toString(),
          companyId: company._id.toString(),
          accountDeleted: true,
        },
      });
    }

    await permanentlyDeleteUserAccount(operator);

    const response = NextResponse.json(
      {
        success: true,
        accountDeleted: true,
        message: `You left ${company?.name ?? "your company"} and your operator account was deleted.`,
        redirectPath: "/operator/login?accountDeleted=true",
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
        message: error instanceof Error ? error.message : "Failed to leave current company.",
      },
      { status: 500 },
    );
  }
}
