import Razorpay from "razorpay";

function requireServerEnv(name: "RAZORPAY_KEY_ID" | "RAZORPAY_KEY_SECRET"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured on the server.`);
  }
  return value;
}

export function getServerRazorpayKeyId(): string {
  return requireServerEnv("RAZORPAY_KEY_ID");
}

export function getServerRazorpayKeySecret(): string {
  return requireServerEnv("RAZORPAY_KEY_SECRET");
}

export function createRazorpayClient(): Razorpay {
  return new Razorpay({
    key_id: getServerRazorpayKeyId(),
    key_secret: getServerRazorpayKeySecret(),
  });
}
