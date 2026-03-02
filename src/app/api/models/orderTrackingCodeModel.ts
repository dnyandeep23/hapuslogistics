import mongoose, { Schema } from "mongoose";

const orderTrackingCodeSchema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

orderTrackingCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
orderTrackingCodeSchema.index({ orderId: 1, email: 1 }, { unique: true });

if (process.env.NODE_ENV !== "production" && mongoose.models.OrderTrackingCode) {
  delete mongoose.models.OrderTrackingCode;
}

const OrderTrackingCode =
  mongoose.models.OrderTrackingCode ||
  mongoose.model("OrderTrackingCode", orderTrackingCodeSchema);

export default OrderTrackingCode;
