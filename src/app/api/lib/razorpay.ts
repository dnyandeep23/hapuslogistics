import crypto from "crypto";
import { getServerRazorpayKeySecret } from "@/app/api/lib/razorpayServer";

export function validateRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", getServerRazorpayKeySecret())
    .update(body.toString())
    .digest("hex");
  return expectedSignature === signature;
}
