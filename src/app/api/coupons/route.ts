import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '../lib/db';
import Coupon from '../models/couponModel';
import CouponUsage from '../models/couponUsageModel';

const buildActiveCouponFilter = () => ({
    isActive: true,
    $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gt: new Date() } },
    ],
});

export async function GET(req: NextRequest) {
    await dbConnect();

    try {
        const userId = req.nextUrl.searchParams.get("userId");
        let normalizedUserId: mongoose.Types.ObjectId | null = null;

        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return NextResponse.json({ message: 'Invalid user id' }, { status: 400 });
            }
            normalizedUserId = new mongoose.Types.ObjectId(userId);
        }

        const coupons = await Coupon.find(buildActiveCouponFilter())
            .select("_id code discount expiryDate maxUsesPerUser createdAt")
            .sort({ discount: -1, createdAt: -1 })
            .lean<Array<{
                _id: mongoose.Types.ObjectId;
                code: string;
                discount: number;
                expiryDate?: Date | null;
                maxUsesPerUser?: number;
            }>>();

        if (!coupons.length) {
            return NextResponse.json({ coupons: [] }, { status: 200 });
        }

        const usageByCouponId = new Map<string, number>();
        if (normalizedUserId) {
            const couponIds = coupons.map((coupon) => coupon._id);
            const usageRecords = await CouponUsage.find({
                userId: normalizedUserId,
                couponId: { $in: couponIds },
            })
                .select("couponId uses")
                .lean<Array<{ couponId: mongoose.Types.ObjectId; uses?: number }>>();

            usageRecords.forEach((record) => {
                usageByCouponId.set(String(record.couponId), Number(record.uses ?? 0));
            });
        }

        const availableCoupons = coupons
            .map((coupon) => {
                const maxUsesPerUser = Math.max(1, Math.floor(Number(coupon.maxUsesPerUser ?? 1)));
                const usedCount = usageByCouponId.get(String(coupon._id)) ?? 0;
                const remainingUses = Math.max(0, maxUsesPerUser - usedCount);

                return {
                    id: String(coupon._id),
                    code: coupon.code,
                    discount: coupon.discount,
                    expiryDate: coupon.expiryDate ? new Date(coupon.expiryDate).toISOString() : null,
                    maxUsesPerUser,
                    usedCount,
                    remainingUses,
                };
            })
            .filter((coupon) => !normalizedUserId || coupon.remainingUses > 0);

        return NextResponse.json({ coupons: availableCoupons }, { status: 200 });
    } catch (error) {
        console.error('Error loading coupons:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    await dbConnect();

    try {
        const { code, userId } = await req.json();
        const normalizedCode = String(code ?? "").trim().toUpperCase();

        if (!normalizedCode) {
            return NextResponse.json({ message: 'Coupon code is required' }, { status: 400 });
        }

        const coupon = await Coupon.findOne({
            ...buildActiveCouponFilter(),
            code: normalizedCode,
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
            usedCount,
            remainingUses: Math.max(0, maxUsesPerUser - usedCount),
            maxUsesPerUser,
        }, { status: 200 });

    } catch (error) {
        console.error('Error validating coupon:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
