import mongoose from "mongoose";
import Coupon from "@/app/api/models/couponModel";
import CouponUsage from "@/app/api/models/couponUsageModel";
import User from "@/app/api/models/userModel";

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

function getActiveCouponFilter(code: string) {
  return {
    code,
    isActive: true,
    $or: [
      { expiryDate: { $exists: false } },
      { expiryDate: null },
      { expiryDate: { $gt: new Date() } },
    ],
  };
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

  const coupon = await Coupon.findOne(getActiveCouponFilter(normalizedCode))
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
      const now = new Date();
      const incrementExistingResult = await User.updateOne(
        {
          _id: userObjectId,
          "couponUsageStats.couponId": coupon._id,
        },
        {
          $inc: { "couponUsageStats.$.uses": 1 },
          $set: {
            "couponUsageStats.$.couponCode": normalizedCode,
            "couponUsageStats.$.lastUsedAt": now,
          },
        },
        { session: params.session },
      );

      if (incrementExistingResult.modifiedCount === 0) {
        const addNewResult = await User.updateOne(
          {
            _id: userObjectId,
            "couponUsageStats.couponId": { $ne: coupon._id },
          },
          {
            $push: {
              couponUsageStats: {
                couponId: coupon._id,
                couponCode: normalizedCode,
                uses: 1,
                lastUsedAt: now,
              },
            },
          },
          { session: params.session },
        );

        if (addNewResult.modifiedCount === 0 && addNewResult.upsertedCount === 0) {
          // Rare race fallback: another write inserted row before $push matched.
          await User.updateOne(
            {
              _id: userObjectId,
              "couponUsageStats.couponId": coupon._id,
            },
            {
              $inc: { "couponUsageStats.$.uses": 1 },
              $set: {
                "couponUsageStats.$.couponCode": normalizedCode,
                "couponUsageStats.$.lastUsedAt": now,
              },
            },
            { session: params.session },
          );
        }
      }

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
