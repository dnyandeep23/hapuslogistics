
import { NextRequest, NextResponse } from "next/server";
import { createRazorpayClient } from "@/app/api/lib/razorpayServer";

export async function POST(request: NextRequest) {
    const { amount, currency = "INR" } = await request.json();

    const razorpay = createRazorpayClient();

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
