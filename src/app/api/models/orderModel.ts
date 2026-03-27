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
    enum: ["pending", "confirmed", "allocated", "in-transit", "delivered", "cancelled", "missed_package"],
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
  incidentReportType: {
    type: String,
    enum: ["customer_not_at_pickup", "customer_not_at_drop", ""],
    default: "",
  },
  incidentReportStatus: {
    type: String,
    enum: ["attention_needed", "office_collection_required", ""],
    default: "",
  },
  incidentReportNote: {
    type: String,
    default: "",
    trim: true,
  },
  incidentReportGuidance: {
    type: String,
    default: "",
    trim: true,
  },
  incidentReportAt: {
    type: Date,
    default: null,
  },
  incidentReportBy: {
    type: Schema.Types.ObjectId,
    ref: "users",
    default: null,
  },
  operatorIncidentType: {
    type: String,
    enum: ["customer_not_at_pickup", "customer_not_at_drop", ""],
    default: "",
  },
  operatorIncidentStatus: {
    type: String,
    enum: ["attention_needed", "office_collection_required", ""],
    default: "",
  },
  operatorIncidentNote: {
    type: String,
    default: "",
    trim: true,
  },
  operatorIncidentGuidance: {
    type: String,
    default: "",
    trim: true,
  },
  operatorIncidentAt: {
    type: Date,
    default: null,
  },
  operatorIncidentBy: {
    type: Schema.Types.ObjectId,
    ref: "users",
    default: null,
  },
  assignedOffice: {
    officeName: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      default: "",
      trim: true,
    },
    zip: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    assignmentReason: {
      type: String,
      default: "",
      trim: true,
    },
    customerMessage: {
      type: String,
      default: "",
      trim: true,
    },
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
  refundPolicySnapshot: {
    type: [
      {
        label: {
          type: String,
          required: true,
          trim: true,
        },
        minHoursBeforeStart: {
          type: Number,
          required: true,
          min: 0,
        },
        maxHoursBeforeStart: {
          type: Number,
          default: null,
          min: 0,
        },
        deductionPercent: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
      },
    ],
    default: [],
  },
  cancellationDetails: {
    reasonCode: {
      type: String,
      default: "",
      trim: true,
    },
    reasonDescription: {
      type: String,
      default: "",
      trim: true,
    },
    refundMode: {
      type: String,
      enum: ["deduction_policy", "full_refund"],
      default: "deduction_policy",
    },
    refundBaseAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    deductionPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    deductionAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    refundAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    policyLabel: {
      type: String,
      default: "",
      trim: true,
    },
    hoursUntilStart: {
      type: Number,
      default: null,
    },
    processingStatus: {
      type: String,
      enum: ["not_required", "processing", "processed", "manual_review", "failed"],
      default: "not_required",
    },
    paymentRefundId: {
      type: String,
      default: "",
      trim: true,
    },
    paymentRefundStatus: {
      type: String,
      default: "",
      trim: true,
    },
    paymentRefundError: {
      type: String,
      default: "",
      trim: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    cancelledByRole: {
      type: String,
      enum: ["user", "admin", "operator", "system", ""],
      default: "",
    },
  },
  missedPackageDetails: {
    markedAt: {
      type: Date,
      default: null,
    },
    markedByRole: {
      type: String,
      enum: ["user", "admin", "operator", "system", ""],
      default: "",
    },
    reason: {
      type: String,
      default: "",
      trim: true,
    },
    exemptedByReport: {
      type: Boolean,
      default: false,
    },
    refundBaseAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    waiverPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    waiverAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    refundAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    refundProcessingStatus: {
      type: String,
      enum: ["not_started", "processing", "processed", "manual_review", "failed", "not_required"],
      default: "not_started",
    },
    paymentRefundId: {
      type: String,
      default: "",
      trim: true,
    },
    paymentRefundStatus: {
      type: String,
      default: "",
      trim: true,
    },
    paymentRefundError: {
      type: String,
      default: "",
      trim: true,
    },
    refundTriggeredAt: {
      type: Date,
      default: null,
    },
    refundTriggeredBy: {
      type: Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    refundTriggeredByRole: {
      type: String,
      enum: ["user", "admin", "operator", "system", ""],
      default: "",
    },
    refundedAt: {
      type: Date,
      default: null,
    },
  },
  orderReports: {
    type: [
      {
        reportType: {
          type: String,
          enum: [
            "admin_cancellation",
            "operator_incident",
            "user_cancellation",
            "missed_package_auto_mark",
            "missed_package_refund",
            "customer_not_at_pickup",
            "customer_not_at_drop",
          ],
          required: true,
        },
        category: {
          type: String,
          default: "",
          trim: true,
        },
        title: {
          type: String,
          default: "",
          trim: true,
        },
        description: {
          type: String,
          default: "",
          trim: true,
        },
        createdBy: {
          type: Schema.Types.ObjectId,
          ref: "users",
          default: null,
        },
        createdByRole: {
          type: String,
          enum: ["user", "admin", "operator", "system", ""],
          default: "",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        data: {
          type: Schema.Types.Mixed,
          default: {},
        },
      },
    ],
    default: [],
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
