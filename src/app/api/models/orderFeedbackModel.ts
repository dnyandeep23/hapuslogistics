import mongoose from "mongoose";

const orderFeedbackSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    trackingId: {
      type: String,
      trim: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

orderFeedbackSchema.index({ orderId: 1, userId: 1 }, { unique: true });

const OrderFeedback =
  mongoose.models.OrderFeedback || mongoose.model("OrderFeedback", orderFeedbackSchema);

export default OrderFeedback;
