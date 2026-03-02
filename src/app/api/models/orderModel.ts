import mongoose, { Schema } from "mongoose";

function buildOrderExpiryDate() {
  const expiryDate = new Date();
  expiryDate.setUTCMonth(expiryDate.getUTCMonth() + 3);
  return expiryDate;
}

const orderSchema = new mongoose.Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  pickupLocation: {
    type: Object,
    required: true,
  },
  dropLocation: {
    type: Object,
    required: true,
  },
  packages: {
    type: Array,
    default: [],
  },
  totalWeightKg: {
    type: Number,
    required: true,
  },
  // Candidate buses that match the pickup/drop locations
  candidateRoutes: [{
    type: Schema.Types.ObjectId,
    ref: "Bus",
  }],
  // The bus that is ultimately assigned to this order
  assignedBus: {
    type: Schema.Types.ObjectId,
    ref: "Bus",
    default: null,
  },
  // Bus captured at booking confirmation stage.
  bus: {
    type: Schema.Types.ObjectId,
    ref: "Bus",
    default: null,
  },
  // The date the order is intended for, to check against bus availability
  orderDate: {
    type: Date,
    required: true,
  },
  senderInfo: {
    type: Object,
    required: true,
  },
  receiverInfo: {
    type: Object,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "confirmed", "allocated", "in-transit", "delivered", "cancelled"],
    default: "pending",
  },
  paymentId: {
    type: String,
  },
  razorpayOrderId: {
    type: String,
  },
  razorpaySignature: {
    type: String,
  },
  totalAmount: {
    type: Number,
  },
  couponCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
  },
  couponDiscount: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
  trackingId: {
    type: String,
  },
  pickupProofImage: {
    type: String,
    default: "",
  },
  pickupProofAt: {
    type: Date,
  },
  dropProofImage: {
    type: String,
    default: "",
  },
  dropProofAt: {
    type: Date,
  },
  operatorVerifiedBy: {
    type: Schema.Types.ObjectId,
    ref: "users",
  },
  adminNote: {
    type: String,
    default: "",
    trim: true,
  },
  operatorNote: {
    type: String,
    default: "",
    trim: true,
  },
  customerNote: {
    type: String,
    default: "",
    trim: true,
  },
  adjustmentPendingAmount: {
    type: Number,
    min: 0,
    default: 0,
  },
  adjustmentRefundAmount: {
    type: Number,
    min: 0,
    default: 0,
  },
  adjustmentStatus: {
    type: String,
    enum: ["none", "pending_payment", "pending_refund", "settled"],
    default: "none",
  },
  adjustmentRazorpayOrderId: {
    type: String,
    default: "",
  },
  adjustmentRazorpayPaymentId: {
    type: String,
    default: "",
  },
  adjustmentRazorpaySignature: {
    type: String,
    default: "",
  },
  adjustmentUpdatedAt: {
    type: Date,
  },
  adminNoteUpdatedAt: {
    type: Date,
  },
  bookedByAdmin: {
    type: Boolean,
    default: false,
  },
  bookedByAdminId: {
    type: Schema.Types.ObjectId,
    ref: "users",
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: buildOrderExpiryDate,
    index: true,
  },
}, { timestamps: true });

if (process.env.NODE_ENV !== "production" && mongoose.models.Order) {
  delete mongoose.models.Order;
}

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;
