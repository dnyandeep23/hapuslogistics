import mongoose from "mongoose";
import Coupon from "@/app/api/models/couponModel";
import CouponUsage from "@/app/api/models/couponUsageModel";

export class CouponUsageLimitError extends Error {
  status: number;

  constructor(message: string, status = 409) {
    super(message);
    this.name = "CouponUsageLimitError";
    this.status = status;
  }
}

function normalizeCouponCode(couponCode: unknown): string {
  return typeof couponCode === "string" ? couponCode.trim().toUpperCase() : "";
}

export async function reserveCouponUsageForUser(params: {
  session: mongoose.ClientSession;
  couponCode?: unknown;
  userId: mongoose.Types.ObjectId | string;
}) {
  const normalizedCode = normalizeCouponCode(params.couponCode);
  if (!normalizedCode) {
    return;
  }

  const userObjectId =
    typeof params.userId === "string"
      ? new mongoose.Types.ObjectId(params.userId)
      : params.userId;

  const coupon = await Coupon.findOne({ code: normalizedCode })
    .select("_id maxUsesPerUser")
    .lean<{ _id: mongoose.Types.ObjectId; maxUsesPerUser?: number } | null>()
    .session(params.session);

  if (!coupon) {
    throw new CouponUsageLimitError("Applied coupon is no longer available. Please recalculate pricing.");
  }

  const maxUsesPerUser = Math.max(1, Math.floor(Number(coupon.maxUsesPerUser ?? 1)));

  try {
    const updateResult = await CouponUsage.updateOne(
      {
        couponId: coupon._id,
        userId: userObjectId,
        uses: { $lt: maxUsesPerUser },
      },
      {
        $inc: { uses: 1 },
        $setOnInsert: {
          couponId: coupon._id,
          userId: userObjectId,
        },
      },
      {
        upsert: true,
        session: params.session,
      },
    );

    if (updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0) {
      return;
    }

    throw new CouponUsageLimitError("Coupon usage limit reached for this account.");
  } catch (error: unknown) {
    const mongoCode = (error as { code?: number })?.code;
    if (mongoCode === 11000) {
      throw new CouponUsageLimitError("Coupon usage limit reached for this account.");
    }
    throw error;
  }
}
