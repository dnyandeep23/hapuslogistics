export type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayHandlerResponse) => void | Promise<void>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
};

export type RazorpayCheckoutFailure = {
  error?: {
    description?: string;
    reason?: string;
    step?: string;
    metadata?: {
      payment_id?: string;
      order_id?: string;
    };
  };
};

export type RazorpayCheckoutInstance = {
  open: () => void;
  on?: (event: string, handler: (response: RazorpayCheckoutFailure) => void) => void;
};

export type RazorpayConstructor = new (
  options: RazorpayCheckoutOptions,
) => RazorpayCheckoutInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
    __hapusRazorpayScriptPromise?: Promise<boolean>;
  }
}

const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export function getRazorpayConstructor(): RazorpayConstructor | null {
  if (typeof window === "undefined") return null;
  return window.Razorpay ?? null;
}

function waitForExistingScript(script: HTMLScriptElement): Promise<boolean> {
  if (getRazorpayConstructor()) {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    const handleLoad = () => {
      cleanup();
      resolve(Boolean(getRazorpayConstructor()));
    };
    const handleError = () => {
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
  });
}

export async function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (getRazorpayConstructor()) return true;

  const existingScript = document.querySelector(
    `script[src="${RAZORPAY_SCRIPT_SRC}"]`,
  ) as HTMLScriptElement | null;
  if (existingScript) {
    return waitForExistingScript(existingScript);
  }

  if (!window.__hapusRazorpayScriptPromise) {
    window.__hapusRazorpayScriptPromise = new Promise<boolean>((resolve) => {
      const script = document.createElement("script");
      script.src = RAZORPAY_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve(Boolean(getRazorpayConstructor()));
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  const didLoad = await window.__hapusRazorpayScriptPromise;
  if (!didLoad) {
    delete window.__hapusRazorpayScriptPromise;
  }
  return didLoad;
}

export function requireRazorpayKeyId(keyId: unknown): string {
  const normalizedKeyId = typeof keyId === "string" ? keyId.trim() : "";
  if (!normalizedKeyId) {
    throw new Error(
      "Razorpay key is not configured for this deployment. Set RAZORPAY_KEY_ID in production and redeploy.",
    );
  }
  return normalizedKeyId;
}
