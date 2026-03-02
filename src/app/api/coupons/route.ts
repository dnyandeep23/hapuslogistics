import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '../lib/db';
import Coupon from '../models/couponModel';
import CouponUsage from '../models/couponUsageModel';

export async function POST(req: NextRequest) {
    await dbConnect();

    try {
        const { code, userId } = await req.json();

        if (!code) {
            return NextResponse.json({ message: 'Coupon code is required' }, { status: 400 });
        }

        const coupon = await Coupon.findOne({
            code: code.toUpperCase(),
            isActive: true,
            expiryDate: { $gt: new Date() },
        }).lean<{
            _id: mongoose.Types.ObjectId;
            discount: number;
            maxUsesPerUser?: number;
        } | null>();

        if (!coupon) {
            return NextResponse.json({ message: 'Invalid or expired coupon' }, { status: 404 });
        }

        const maxUsesPerUser = Math.max(1, Math.floor(Number(coupon.maxUsesPerUser ?? 1)));
        let usedCount = 0;

        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(String(userId))) {
                return NextResponse.json({ message: 'Invalid user id' }, { status: 400 });
            }

            const usage = await CouponUsage.findOne({
                couponId: coupon._id,
                userId,
            }).select("uses").lean<{ uses?: number } | null>();

            usedCount = Number(usage?.uses ?? 0);
            if (usedCount >= maxUsesPerUser) {
                return NextResponse.json({ message: 'Coupon usage limit reached for this account' }, { status: 409 });
            }
        }

        return NextResponse.json({
            message: 'Coupon applied successfully',
            discount: coupon.discount,
            remainingUses: Math.max(0, maxUsesPerUser - usedCount),
            maxUsesPerUser,
        }, { status: 200 });

    } catch (error) {
        console.error('Error validating coupon:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
