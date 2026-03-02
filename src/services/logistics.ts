// Define a type for our location data for type safety
export interface Location {
  _id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface PricingInfo {
  items: PricingItem[];
  subtotal: number;
  discount: number;
  total: number;
  coupon: AppliedCoupon | null;
  busId: string;
  sessionId?: string;
  sessionExpiresAt?: string;
  orderDate?: string;
  totalWeightKg?: number;
}

export interface PricingItem {
  packageType?: string;
  packageSize?: string;
  packageWeight: number;
  packageQuantities: number;
  price?: number;
  [key: string]: unknown;
}

export interface UploadedImageResponse {
  success?: boolean;
  imageUrl?: string;
  error?: string;
  message?: string;
}

export interface AppliedCoupon {
  code: string;
  discount: number;
  [key: string]: unknown;
}

export interface AvailableCoupon {
  id: string;
  code: string;
  discount: number;
  expiryDate: string | null;
  maxUsesPerUser: number;
  usedCount: number;
  remainingUses: number;
}

export interface BookingSessionResponse {
  sessionId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  reused?: boolean;
  continued?: boolean;
  expiresAt?: string;
}

const getApiErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as { error?: string; message?: string };
  return data.error || data.message || fallback;
};

/**
 * Fetches the list of all available pickup locations.
 * @returns A promise that resolves to an array of Location objects.
 */
export const getPickupLocations = async (): Promise<Location[]> => {
  try {
    const response = await fetch('/api/locations/pickup', { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch pickup locations with status: ${response.status}`);
    }
    const data: Location[] = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    // In a real app, you might want to handle this more gracefully
    return [];
  }
};

/**
 * Fetches the list of available drop locations based on a selected pickup location.
 * @param pickupLocationId - The ID of the selected pickup location.
 * @returns A promise that resolves to an array of Location objects.
 */
export const getDropLocations = async (pickupLocationId: string): Promise<Location[]> => {
  if (!pickupLocationId) {
    return []; // Don't fetch if no pickup location is selected
  }
  try {
    const response = await fetch(
      `/api/locations/drop?pickupLocationId=${encodeURIComponent(pickupLocationId)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch drop locations with status: ${response.status}`);
    }
    const data: Location[] = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    return [];
  }
};

/**
 * Fetches the available dates for a given pickup and drop location.
 * @param pickupLocationId - The ID of the selected pickup location.
 * @param dropLocationId - The ID of the selected drop location.
 * @returns A promise that resolves to an array of date strings.
 */
export const getAvailableDates = async (
  pickupLocationId: string,
  dropLocationId: string
): Promise<string[]> => {
  if (!pickupLocationId || !dropLocationId) return [];

  try {
    // console.log(" Called Fetching available dates...");
    const userTimestamp = new Date().toISOString();

    const response = await fetch(
      `/api/availability?pickupLocationId=${encodeURIComponent(pickupLocationId)}&dropLocationId=${encodeURIComponent(dropLocationId)}&userTimestamp=${encodeURIComponent(userTimestamp)}`,
      { cache: "no-store" } // important in Next.js
    );

    if (!response.ok) {
      throw new Error(`Failed with status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("getAvailableDates error:", error);
    return [];
  }
};

/**
 * Calculates the price for the items in the cart.
 * @param cart - An array of package items.
 * @param couponCode - An optional coupon code.
 * @param pickupLocationId - The ID of the pickup location.
 * @param dropLocationId - The ID of the drop location.
 * @returns A promise that resolves to the pricing information.
 */
export const calculatePrice = async (
  cart: PricingItem[],
  couponCode: string | undefined,
  userId: string,
  pickupLocationId: string,
  dropLocationId: string
) => {
  try {
    const response = await fetch('/api/pricing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cart, couponCode, userId, pickupLocationId, dropLocationId }),
      cache: "no-store",
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(getApiErrorMessage(data, 'Failed to calculate price'));
    }

    return data as PricingInfo;
  } catch (error) {
    console.error('Error calculating price:', error);
    throw error;
  }
};

export const getAvailableCoupons = async (userId: string) => {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const response = await fetch(`/api/coupons${query}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(getApiErrorMessage(data, "Failed to fetch available coupons"));
    }

    const coupons = Array.isArray((data as { coupons?: unknown[] }).coupons)
      ? (data as { coupons: unknown[] }).coupons
      : [];

    return coupons as AvailableCoupon[];
  } catch (error) {
    console.error("Error loading available coupons:", error);
    return [];
  }
};

export const createBookingSession = async (sessionPayload: Record<string, unknown>) => {
    const response = await fetch('/api/orders/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionPayload),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(getApiErrorMessage(data, 'Failed to create booking session'));
    }

  return data as BookingSessionResponse;
};

export const confirmAdminBooking = async (payload: {
  sessionId: string;
  customerEmail: string;
  senderInfo: Record<string, unknown>;
  receiverInfo: Record<string, unknown>;
}) => {
  const response = await fetch("/api/orders/admin-confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Failed to confirm admin booking"));
  }

  return data as { success: boolean; orderId: string; trackingId: string; message?: string };
};

export const uploadPackageImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("folder", "orders/packages");

  const response = await fetch("/api/uploads/image", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || !data?.imageUrl) {
    throw new Error(getApiErrorMessage(data, "Failed to upload package image"));
  }

  return String(data.imageUrl);
};

export const confirmBookingPayment = async (payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) => {
  const response = await fetch('/api/orders/payment-callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Failed to confirm payment'));
  }

  return data as { message: string; orderId?: string; trackingId?: string };
};

export const markBookingSessionFailed = async (
  sessionId: string,
  payload?: {
    reason?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
  }
) => {
  if (!sessionId) return;

  const response = await fetch(`/api/orders/session/${sessionId}/fail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Failed to mark booking session as failed'));
  }

  return data as { message: string; sessionId?: string };
};
