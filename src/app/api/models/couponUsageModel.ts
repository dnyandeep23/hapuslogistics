import mongoose, { Document, Schema } from "mongoose";

export interface ICouponUsage extends Document {
  couponId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  uses: number;
  createdAt: Date;
  updatedAt: Date;
}

const CouponUsageSchema: Schema = new Schema(
  {
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    uses: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true },
);

CouponUsageSchema.index({ couponId: 1, userId: 1 }, { unique: true, name: "uniq_coupon_user_usage" });

const CouponUsage =
  mongoose.models.CouponUsage ||
  mongoose.model<ICouponUsage>("CouponUsage", CouponUsageSchema);

export default CouponUsage;
