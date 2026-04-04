type RazorpayCreateOrderPayload = {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
};

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status?: string;
  [key: string]: unknown;
};

type RazorpayRefundPayload = {
  amount: number;
  speed?: "normal" | "optimum";
  notes?: Record<string, string>;
};

type RazorpayRefund = {
  id: string;
  status?: string;
  [key: string]: unknown;
};

type RazorpayClient = {
  orders: {
    create(payload: RazorpayCreateOrderPayload): Promise<RazorpayOrder>;
    fetch(orderId: string): Promise<RazorpayOrder>;
  };
  payments: {
    refund(paymentId: string, payload: RazorpayRefundPayload): Promise<RazorpayRefund>;
  };
};

const RAZORPAY_API_BASE_URL = "https://api.razorpay.com/v1";

function requireServerEnv(name: "RAZORPAY_KEY_ID" | "RAZORPAY_KEY_SECRET"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured on the server.`);
  }
  return value;
}

function getAuthorizationHeader(): string {
  const credentials = `${getServerRazorpayKeyId()}:${getServerRazorpayKeySecret()}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

async function parseRazorpayResponse<T>(response: Response): Promise<T> {
  const rawBody = await response.text();
  const trimmedBody = rawBody.trim();

  if (!trimmedBody) {
    if (!response.ok) {
      throw new Error(`Razorpay request failed with status ${response.status}.`);
    }

    throw new Error("Razorpay returned an empty response.");
  }

  let payload: unknown;

  try {
    payload = JSON.parse(trimmedBody);
  } catch {
    if (!response.ok) {
      throw new Error(`Razorpay request failed with status ${response.status}.`);
    }

    throw new Error("Razorpay returned an invalid JSON response.");
  }

  if (!response.ok) {
    const errorMessage =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "description" in payload.error &&
      typeof payload.error.description === "string"
        ? payload.error.description
        : `Razorpay request failed with status ${response.status}.`;

    throw new Error(errorMessage);
  }

  return payload as T;
}

async function razorpayRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${RAZORPAY_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: getAuthorizationHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  return parseRazorpayResponse<T>(response);
}

export function getServerRazorpayKeyId(): string {
  return requireServerEnv("RAZORPAY_KEY_ID");
}

export function getServerRazorpayKeySecret(): string {
  return requireServerEnv("RAZORPAY_KEY_SECRET");
}

export function createRazorpayClient(): RazorpayClient {
  return {
    orders: {
      create(payload) {
        return razorpayRequest<RazorpayOrder>("/orders", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      },
      fetch(orderId) {
        return razorpayRequest<RazorpayOrder>(`/orders/${encodeURIComponent(orderId)}`);
      },
    },
    payments: {
      refund(paymentId, payload) {
        return razorpayRequest<RazorpayRefund>(
          `/payments/${encodeURIComponent(paymentId)}/refund`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
      },
    },
  };
}
