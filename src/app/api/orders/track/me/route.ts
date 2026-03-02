import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import {
  findOrderForTracking,
  mapOrderForTracking,
  normalizeIdentifier,
  toStringValue,
} from "@/app/api/orders/track/helpers";

interface AuthPayload {
  id: string;
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    const user = await User.findById(payload.id).select("_id");
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { identifier?: unknown };
    const identifier = normalizeIdentifier(body.identifier);
    if (!identifier) {
      return NextResponse.json({ message: "Order ID or Tracking ID is required." }, { status: 400 });
    }

    const order = await findOrderForTracking(identifier);
    if (!order) {
      return NextResponse.json({ message: "Order not found." }, { status: 404 });
    }

    const isOrderOwner = toStringValue(order.user) === toStringValue(user._id);
    if (!isOrderOwner) {
      return NextResponse.json(
        { message: "This order is made from another account." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        order: mapOrderForTracking(order),
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
