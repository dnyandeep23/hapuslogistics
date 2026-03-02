
import mongoose, { Document, Schema } from 'mongoose';

export interface IBookingSession extends Document {
  busId: mongoose.Schema.Types.ObjectId;
  userId: mongoose.Schema.Types.ObjectId;
  packages: unknown[];
  pickupLocationId: mongoose.Schema.Types.ObjectId;
  dropLocationId: mongoose.Schema.Types.ObjectId;
  senderInfo: Record<string, unknown>;
  receiverInfo: Record<string, unknown>;
  orderDate: Date;
  totalAmount: number;
  totalWeightKg: number;
  couponCode?: string;
  couponDiscount?: number;
  status: 'HOLD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' | 'FAILED';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  failureReason?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSessionSchema: Schema = new Schema(
  {
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    packages: {
      type: Array,
      required: true,
    },
    pickupLocationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        required: true,
    },
    dropLocationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        required: true,
    },
    senderInfo: {
        type: Object,
        required: true,
        default: {},
    },
    receiverInfo: {
        type: Object,
        required: true,
        default: {},
    },
    orderDate: {
        type: Date,
        required: true,
    },
    totalAmount: {
        type: Number,
        required: true,
    },
    totalWeightKg: {
      type: Number,
      required: true,
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
    status: {
      type: String,
      enum: ['HOLD', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'FAILED'],
      default: 'HOLD',
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL deletion at exact expiresAt; cleanup job still restores capacity.
    },
  },
  { timestamps: true }
);

BookingSessionSchema.index(
  {
    userId: 1,
    busId: 1,
    pickupLocationId: 1,
    dropLocationId: 1,
    orderDate: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: { status: "HOLD" },
    name: "uniq_active_hold_per_user_route_bus_date",
  }
);

const BookingSession =
  mongoose.models.BookingSession ||
  mongoose.model<IBookingSession>('BookingSession', BookingSessionSchema);

export default BookingSession;
