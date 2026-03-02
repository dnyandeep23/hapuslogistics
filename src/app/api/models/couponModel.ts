import mongoose, { Schema, Document } from 'mongoose';

export interface ICoupon extends Document {
    code: string;
    discount: number;
    isActive: boolean;
    expiryDate: Date;
    maxUsesPerUser: number;
}

const CouponSchema: Schema = new Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
    },
    discount: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    expiryDate: {
        type: Date,
        required: true,
    },
    maxUsesPerUser: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
    },
}, {
    timestamps: true,
});

if (process.env.NODE_ENV !== "production" && mongoose.models.Coupon) {
    delete mongoose.models.Coupon;
}

const Coupon = mongoose.models.Coupon || mongoose.model<ICoupon>('Coupon', CouponSchema);

export default Coupon;
