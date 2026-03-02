import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { dbConnect } from "@/app/api/lib/db";
import {
  deleteCloudinaryImageByUrl,
  isDataImageUrl,
  uploadImageDataUrl,
} from "@/app/api/lib/cloudinary";
import { sendEmail } from "@/app/api/lib/mailer";
import { CouponUsageLimitError, reserveCouponUsageForUser } from "@/app/api/lib/couponUsage";
import BookingSession from "@/app/api/models/bookingSessionModel";
import Bus from "@/app/api/models/busModel";
import Location from "@/app/api/models/locationModel";
import Order from "@/app/api/models/orderModel";
import User from "@/app/api/models/userModel";

const JWT_SECRET = process.env.JWT_SECRET!;

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function toStringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value && typeof value === "object") {
    const maybeHex = (value as { toHexString?: () => string }).toHexString;
    if (typeof maybeHex === "function") {
      const hex = maybeHex.call(value);
      if (hex) return hex;
    }
    const maybeToString = (value as { toString?: () => string }).toString;
    if (typeof maybeToString === "function") {
      const stringified = maybeToString.call(value);
      if (stringified && stringified !== "[object Object]") return stringified;
    }
  }
  return fallback;
}

function extractTokenUserId(request: NextRequest): string {
  const token = request.cookies.get("token")?.value;
  if (!token) {
    throw new ApiError("Unauthorized", 401);
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id?: string };
    const userId = String(payload?.id ?? "").trim();
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError("Unauthorized", 401);
    }
    return userId;
  } catch {
    throw new ApiError("Unauthorized", 401);
  }
}

async function movePackageImagesToCloudinary(
  packages: unknown,
  uploadedUrls: string[],
): Promise<unknown[]> {
  if (!Array.isArray(packages)) return [];

  const nextPackages: unknown[] = [];
  for (let index = 0; index < packages.length; index += 1) {
    const current = packages[index];
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      nextPackages.push(current);
      continue;
    }

    const packageRecord: Record<string, unknown> = { ...(current as Record<string, unknown>) };
    const packageImage = typeof packageRecord.packageImage === "string"
      ? packageRecord.packageImage.trim()
      : "";

    if (packageImage && isDataImageUrl(packageImage)) {
      const uploadedUrl = await uploadImageDataUrl(packageImage, { folder: "orders/packages" });
      uploadedUrls.push(uploadedUrl);
      packageRecord.packageImage = uploadedUrl;
    }

    nextPackages.push(packageRecord);
  }

  return nextPackages;
}

export async function POST(request: NextRequest) {
  const tx = await mongoose.startSession();
  tx.startTransaction();
  const newlyUploadedPackageUrls: string[] = [];
  let transactionCommitted = false;
  let customerEmail = "";
  let trackingId = "";

  try {
    await dbConnect();

    const actorId = extractTokenUserId(request);
    const actor = await User.findById(actorId).select("_id role isSuperAdmin travelCompanyId buses");
    if (!actor || (actor.role !== "admin" && !actor.isSuperAdmin)) {
      throw new ApiError("Admin access required.", 403);
    }

    const {
      sessionId,
      customerEmail: rawCustomerEmail,
      senderInfo,
      receiverInfo,
    } = (await request.json()) as {
      sessionId?: string;
      customerEmail?: string;
      senderInfo?: Record<string, unknown>;
      receiverInfo?: Record<string, unknown>;
    };

    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      throw new ApiError("Valid sessionId is required.", 400);
    }

    customerEmail = String(rawCustomerEmail ?? "").trim().toLowerCase();
    if (!customerEmail) {
      throw new ApiError("Customer email is required.", 400);
    }

    const customer = await User.findOne({ email: customerEmail }).select("_id email role").session(tx);
    if (!customer || customer.role !== "user") {
      throw new ApiError("No customer account found for this email.", 404);
    }

    const now = new Date();
    const holdSession = await BookingSession.findOne({
      _id: sessionId,
      userId: actor._id,
      status: "HOLD",
      expiresAt: { $gt: now },
    }).session(tx);

    if (!holdSession) {
      throw new ApiError("Active hold session not found or already expired.", 409);
    }

    const bookingBus = await Bus.findById(holdSession.busId)
      .select("_id travelCompanyId")
      .session(tx);
    if (!bookingBus) {
      throw new ApiError("Selected bus not found.", 404);
    }

    if (!actor.isSuperAdmin) {
      const actorCompanyId = toStringValue(actor.travelCompanyId);
      const actorBusIds = Array.isArray(actor.buses)
        ? actor.buses.map((id: unknown) => toStringValue(id))
        : [];
      const hasBusAccess =
        (actorCompanyId && toStringValue(bookingBus.travelCompanyId) === actorCompanyId) ||
        actorBusIds.includes(toStringValue(bookingBus._id));
      if (!hasBusAccess) {
        throw new ApiError("You can book only for your company buses.", 403);
      }
    }

    const [pickupLocation, dropLocation] = await Promise.all([
      Location.findById(holdSession.pickupLocationId).lean(),
      Location.findById(holdSession.dropLocationId).lean(),
    ]);
    if (!pickupLocation || !dropLocation) {
      throw new ApiError("Pickup or drop location not found for this session.", 400);
    }

    if (!senderInfo || typeof senderInfo !== "object") {
      throw new ApiError("senderInfo is required.", 400);
    }
    if (!receiverInfo || typeof receiverInfo !== "object") {
      throw new ApiError("receiverInfo is required.", 400);
    }

    holdSession.senderInfo = senderInfo;
    holdSession.receiverInfo = receiverInfo;

    await reserveCouponUsageForUser({
      session: tx,
      couponCode: holdSession.couponCode,
      userId: customer._id as mongoose.Types.ObjectId,
    });

    holdSession.status = "CONFIRMED";
    holdSession.failureReason = undefined;
    holdSession.razorpayOrderId = undefined;
    holdSession.razorpayPaymentId = undefined;
    holdSession.razorpaySignature = undefined;

    const orderPackages = await movePackageImagesToCloudinary(
      holdSession.packages,
      newlyUploadedPackageUrls,
    );

    trackingId = "HAP-" + uuidv4().split("-")[0].toUpperCase();
    const order = new Order({
      user: customer._id,
      pickupLocation,
      dropLocation,
      packages: orderPackages,
      totalWeightKg: holdSession.totalWeightKg,
      orderDate: holdSession.orderDate,
      senderInfo: holdSession.senderInfo,
      receiverInfo: holdSession.receiverInfo,
      status: "confirmed",
      paymentId: "MANUAL_ADMIN_BOOKING",
      totalAmount: holdSession.totalAmount,
      trackingId,
      bus: holdSession.busId,
      couponCode: holdSession.couponCode ?? undefined,
      couponDiscount: holdSession.couponDiscount ?? undefined,
      bookedByAdmin: true,
      bookedByAdminId: actor._id,
    });

    await order.save({ session: tx });
    await holdSession.save({ session: tx });

    await User.findByIdAndUpdate(
      customer._id,
      { $push: { orders: order._id } },
      { session: tx },
    );

    await tx.commitTransaction();
    transactionCommitted = true;

    try {
      await sendEmail({
        email: customer.email,
        emailType: "ORDER_CONFIRMED",
        trackingId,
      });
    } catch {
      // Do not fail confirmed bookings due to mail transport errors.
    }

    return NextResponse.json(
      {
        success: true,
        message: "Order confirmed without online payment.",
        orderId: order._id.toString(),
        trackingId,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (tx.inTransaction()) {
      await tx.abortTransaction();
    }

    if (!transactionCommitted && newlyUploadedPackageUrls.length > 0) {
      const cleanupResult = await Promise.allSettled(
        newlyUploadedPackageUrls.map((url) => deleteCloudinaryImageByUrl(url)),
      );
      const failed = cleanupResult.filter(
        (result) => result.status !== "fulfilled" || !result.value,
      ).length;
      if (failed > 0) {
        console.error(`[admin-order] Failed to cleanup ${failed} package image(s) after error.`);
      }
    }

    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    if (error instanceof CouponUsageLimitError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to confirm admin booking.",
      },
      { status: 500 },
    );
  } finally {
    tx.endSession();
  }
}
