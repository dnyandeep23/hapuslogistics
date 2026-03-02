
import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(request: NextRequest) {
    const { amount, currency = "INR" } = await request.json();

    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID!,
        key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const options = {
        amount: amount,
        currency: currency,
        receipt: `receipt_order_${Date.now()}`,
    };


    try {
        const order = await razorpay.orders.create(options);
        // console.log("Razorpay order created:", order);
        return NextResponse.json(order);
    } catch (error) {
        console.error("Failed to create Razorpay order:", error);
        return NextResponse.json(
            { error: "Failed to create Razorpay order" },
            { status: 500 }
        );
    }
}
