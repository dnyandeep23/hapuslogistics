
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { dbConnect } from '@/app/api/lib/db';
import { deleteCloudinaryImageByUrl, isDataImageUrl, uploadImageDataUrl } from '@/app/api/lib/cloudinary';
import BookingSession from '@/app/api/models/bookingSessionModel';
import Order from '@/app/api/models/orderModel';
import User from '@/app/api/models/userModel';
import Location from '@/app/api/models/locationModel';
import Bus from '@/app/api/models/busModel';
import { v4 as uuidv4 } from 'uuid';
import Razorpay from 'razorpay';
import { sendEmail } from '@/app/api/lib/mailer';
import { CouponUsageLimitError, reserveCouponUsageForUser } from '@/app/api/lib/couponUsage';

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

function getUtcDayRange(date: Date) {
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    return { dayStart, dayEnd };
}

function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(body.toString())
        .digest('hex');
    return expectedSignature === signature;
}

async function movePackageImagesToCloudinary(
    packages: unknown,
    uploadedUrls: string[],
): Promise<unknown[]> {
    if (!Array.isArray(packages)) {
        return [];
    }

    const normalizedPackages: unknown[] = [];
    for (let index = 0; index < packages.length; index += 1) {
        const current = packages[index];
        if (!current || typeof current !== "object" || Array.isArray(current)) {
            normalizedPackages.push(current);
            continue;
        }

        const packageRecord: Record<string, unknown> = { ...(current as Record<string, unknown>) };
        const packageImage = typeof packageRecord.packageImage === "string" ? packageRecord.packageImage.trim() : "";

        if (packageImage && isDataImageUrl(packageImage)) {
            const uploadedUrl = await uploadImageDataUrl(packageImage, { folder: "orders/packages" });
            uploadedUrls.push(uploadedUrl);
            packageRecord.packageImage = uploadedUrl;
        }

        normalizedPackages.push(packageRecord);
    }

    return normalizedPackages;
}

export async function POST(request: NextRequest) {
    const session = await mongoose.startSession();
    session.startTransaction();
    const newlyUploadedPackageUrls: string[] = [];
    let transactionCommitted = false;

    try {
        await dbConnect();
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return NextResponse.json({ error: 'Missing Razorpay payment details' }, { status: 400 });
        }

        let bookingSession = await BookingSession.findOne({
            razorpayOrderId: razorpay_order_id,
        }).session(session);

        // Backward compatibility for sessions created before razorpayOrderId was persisted.
        if (!bookingSession) {
            const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
            if (razorpayOrder?.receipt) {
                bookingSession = await BookingSession.findById(razorpayOrder.receipt).session(session);
                if (bookingSession && !bookingSession.razorpayOrderId) {
                    bookingSession.razorpayOrderId = razorpay_order_id;
                    await bookingSession.save({ session });
                }
            }
        }

        if (!bookingSession) {
            throw new ApiError('Booking session not found', 404);
        }

        const isSignatureValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (!isSignatureValid) {
            if (bookingSession.status === 'HOLD') {
                const { dayStart, dayEnd } = getUtcDayRange(bookingSession.orderDate);
                const restoreResult = await Bus.updateOne(
                    {
                        _id: bookingSession.busId,
                        availability: {
                            $elemMatch: {
                                date: { $gte: dayStart, $lt: dayEnd },
                            },
                        },
                    },
                    { $inc: { 'availability.$.availableCapacityKg': bookingSession.totalWeightKg } },
                    { session }
                );

                if (restoreResult.modifiedCount === 0) {
                    throw new ApiError('Failed to restore capacity for invalid payment session', 500);
                }

                bookingSession.status = 'FAILED';
                bookingSession.failureReason = 'INVALID_SIGNATURE';
                bookingSession.razorpayPaymentId = razorpay_payment_id;
                bookingSession.razorpaySignature = razorpay_signature;
                await bookingSession.save({ session });
            }

            throw new ApiError('Invalid Razorpay signature', 400);
        }

        if (bookingSession.status !== 'HOLD') {
            if (bookingSession.status === 'CONFIRMED') {
                const existingOrder = await Order.findOne({
                    razorpayOrderId: razorpay_order_id,
                }).select('_id trackingId').lean();

                return NextResponse.json(
                    {
                        message: `Session already processed. Status: ${bookingSession.status}`,
                        orderId: existingOrder?._id,
                        trackingId: existingOrder?.trackingId,
                    },
                    { status: 200 }
                );
            }

            return NextResponse.json(
                { message: `Session already processed. Status: ${bookingSession.status}` },
                { status: 409 }
            );
        }

        await reserveCouponUsageForUser({
            session,
            couponCode: bookingSession.couponCode,
            userId: bookingSession.userId as mongoose.Types.ObjectId,
        });

        bookingSession.status = 'CONFIRMED';
        bookingSession.razorpayOrderId = razorpay_order_id;
        bookingSession.razorpayPaymentId = razorpay_payment_id;
        bookingSession.razorpaySignature = razorpay_signature;
        bookingSession.failureReason = undefined;
        await bookingSession.save({ session });

        const [pickupLocation, dropLocation] = await Promise.all([
            Location.findById(bookingSession.pickupLocationId).lean(),
            Location.findById(bookingSession.dropLocationId).lean()
        ]);

        if (!pickupLocation || !dropLocation) {
            throw new ApiError('Pickup or drop location not found for booking session', 400);
        }

        const trackingId = "HAP-" + uuidv4().split('-')[0].toUpperCase();
        const orderPackages = await movePackageImagesToCloudinary(
            bookingSession.packages,
            newlyUploadedPackageUrls,
        );

        const newOrder = new Order({
            user: bookingSession.userId,
            pickupLocation,
            dropLocation,
            packages: orderPackages,
            totalWeightKg: bookingSession.totalWeightKg,
            orderDate: bookingSession.orderDate,
            senderInfo: bookingSession.senderInfo,
            receiverInfo: bookingSession.receiverInfo,
            status: 'confirmed', // Final order status
            paymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            razorpaySignature: razorpay_signature,
            totalAmount: bookingSession.totalAmount,
            trackingId,
            bus: bookingSession.busId,
            couponCode: bookingSession.couponCode ?? undefined,
            couponDiscount: bookingSession.couponDiscount ?? undefined,
        });

        await newOrder.save({ session });

        await User.findByIdAndUpdate(bookingSession.userId, {
            $push: { orders: newOrder._id },
        }, { session });
        
        await session.commitTransaction();
        transactionCommitted = true;

        const orderUserEmail = String(
          (await User.findById(bookingSession.userId).select("email").lean<{ email?: string } | null>())?.email ?? "",
        ).trim();
        if (orderUserEmail) {
          try {
            await sendEmail({
              email: orderUserEmail,
              emailType: "ORDER_CONFIRMED",
              trackingId,
            });
          } catch {
            // Non-blocking mail failure.
          }
        }

        return NextResponse.json({
            message: 'Order confirmed successfully!',
            orderId: newOrder._id,
            trackingId,
        }, { status: 201 });

    } catch (error) {
        await session.abortTransaction();
        if (!transactionCommitted && newlyUploadedPackageUrls.length > 0) {
            const cleanupResult = await Promise.allSettled(
                newlyUploadedPackageUrls.map((url) => deleteCloudinaryImageByUrl(url)),
            );
            const cleanupFailures = cleanupResult.filter(
                (result) => result.status !== "fulfilled" || !result.value,
            ).length;
            if (cleanupFailures > 0) {
                console.error(
                    `[order-image] Failed to cleanup ${cleanupFailures} uploaded package image(s) after callback error.`,
                );
            }
        }
        console.error('Error in Razorpay payment callback:', error);
        if (error instanceof ApiError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        if (error instanceof CouponUsageLimitError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
        session.endSession();
    }
}
