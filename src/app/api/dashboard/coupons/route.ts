import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import Coupon from "@/app/api/models/couponModel";

const JWT_SECRET = process.env.JWT_SECRET!;

type AuthUser = {
  _id: string;
  isSuperAdmin?: boolean;
};

const getAuthUser = async (request: NextRequest): Promise<AuthUser | null> => {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id?: string };
    if (!payload.id) return null;
    const user = await User.findById(payload.id).select("_id isSuperAdmin").lean<AuthUser | null>();
    return user;
  } catch {
    return null;
  }
};

const normalizeCode = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const parseDiscount = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > 100) return null;
  return parsed;
};

const parseExpiryDateInput = (
  value: unknown,
): { valid: boolean; value: Date | null } => {
  if (value === undefined || value === null) {
    return { valid: true, value: null };
  }

  const raw = String(value).trim();
  if (!raw) {
    return { valid: true, value: null };
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { valid: false, value: null };
  }
  return { valid: true, value: parsed };
};

const parseMaxUsesPerUser = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  if (rounded < 1) return null;
  return rounded;
};

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const user = await getAuthUser(request);
    if (!user || !user.isSuperAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const coupons = await Coupon.find({})
      .sort({ createdAt: -1 })
      .lean<Array<{ _id: unknown; code: string; discount: number; isActive: boolean; expiryDate?: Date | null; maxUsesPerUser?: number }>>();

    return NextResponse.json(
      {
        success: true,
        coupons: coupons.map((coupon) => ({
          id: String(coupon._id),
          code: coupon.code,
          discount: coupon.discount,
          isActive: Boolean(coupon.isActive),
          expiryDate: coupon.expiryDate ? new Date(coupon.expiryDate).toISOString() : null,
          maxUsesPerUser: Number.isFinite(Number(coupon.maxUsesPerUser))
            ? Math.max(1, Math.floor(Number(coupon.maxUsesPerUser)))
            : 1,
        })),
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load coupons." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const user = await getAuthUser(request);
    if (!user || !user.isSuperAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      code?: unknown;
      discount?: unknown;
      expiryDate?: unknown;
      isActive?: unknown;
      maxUsesPerUser?: unknown;
    };

    const code = normalizeCode(body.code);
    const discount = parseDiscount(body.discount);
    const expiryDateParsed = parseExpiryDateInput(body.expiryDate);
    const isActive = body.isActive === undefined ? true : Boolean(body.isActive);
    const maxUsesPerUser = parseMaxUsesPerUser(body.maxUsesPerUser ?? 1);

    if (!code) {
      return NextResponse.json({ success: false, message: "Coupon code is required." }, { status: 400 });
    }
    if (discount === null) {
      return NextResponse.json({ success: false, message: "Discount must be between 0 and 100." }, { status: 400 });
    }
    if (!expiryDateParsed.valid) {
      return NextResponse.json({ success: false, message: "Expiry date must be a valid date." }, { status: 400 });
    }
    if (maxUsesPerUser === null) {
      return NextResponse.json({ success: false, message: "Max uses per user must be at least 1." }, { status: 400 });
    }

    const coupon = await Coupon.create({
      code,
      discount,
      expiryDate: expiryDateParsed.value,
      isActive,
      maxUsesPerUser,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Coupon created successfully.",
        coupon: {
          id: String(coupon._id),
          code: coupon.code,
          discount: coupon.discount,
          isActive: coupon.isActive,
          expiryDate: coupon.expiryDate ? coupon.expiryDate.toISOString() : null,
          maxUsesPerUser: coupon.maxUsesPerUser,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      Number((error as { code?: unknown }).code) === 11000
    ) {
      return NextResponse.json({ success: false, message: "Coupon code already exists." }, { status: 409 });
    }

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to create coupon." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();
    const user = await getAuthUser(request);
    if (!user || !user.isSuperAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      code?: unknown;
      discount?: unknown;
      expiryDate?: unknown;
      isActive?: unknown;
      maxUsesPerUser?: unknown;
    };

    const id = String(body.id ?? "").trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Valid coupon id is required." }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.code !== undefined) {
      const code = normalizeCode(body.code);
      if (!code) {
        return NextResponse.json({ success: false, message: "Coupon code cannot be empty." }, { status: 400 });
      }
      updates.code = code;
    }
    if (body.discount !== undefined) {
      const discount = parseDiscount(body.discount);
      if (discount === null) {
        return NextResponse.json({ success: false, message: "Discount must be between 0 and 100." }, { status: 400 });
      }
      updates.discount = discount;
    }
    if (body.expiryDate !== undefined) {
      const expiryDateParsed = parseExpiryDateInput(body.expiryDate);
      if (!expiryDateParsed.valid) {
        return NextResponse.json({ success: false, message: "Expiry date must be a valid date." }, { status: 400 });
      }
      updates.expiryDate = expiryDateParsed.value;
    }
    if (body.isActive !== undefined) {
      updates.isActive = Boolean(body.isActive);
    }
    if (body.maxUsesPerUser !== undefined) {
      const maxUsesPerUser = parseMaxUsesPerUser(body.maxUsesPerUser);
      if (maxUsesPerUser === null) {
        return NextResponse.json({ success: false, message: "Max uses per user must be at least 1." }, { status: 400 });
      }
      updates.maxUsesPerUser = maxUsesPerUser;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, message: "No update fields provided." }, { status: 400 });
    }

    const updated = await Coupon.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean<{
      _id: unknown;
      code: string;
      discount: number;
      isActive: boolean;
      expiryDate?: Date | null;
      maxUsesPerUser?: number;
    } | null>();

    if (!updated) {
      return NextResponse.json({ success: false, message: "Coupon not found." }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Coupon updated successfully.",
        coupon: {
          id: String(updated._id),
          code: updated.code,
          discount: updated.discount,
          isActive: updated.isActive,
          expiryDate: updated.expiryDate ? new Date(updated.expiryDate).toISOString() : null,
          maxUsesPerUser: Number.isFinite(Number(updated.maxUsesPerUser))
            ? Math.max(1, Math.floor(Number(updated.maxUsesPerUser)))
            : 1,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to update coupon." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    const user = await getAuthUser(request);
    if (!user || !user.isSuperAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { id?: unknown };
    const id = String(body.id ?? "").trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: "Valid coupon id is required." }, { status: 400 });
    }

    const deleted = await Coupon.findByIdAndDelete(id).lean<{ _id: unknown } | null>();
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Coupon not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Coupon removed successfully." }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to remove coupon." },
      { status: 500 },
    );
  }
}
