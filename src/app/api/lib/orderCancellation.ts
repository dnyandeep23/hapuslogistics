import Razorpay from "razorpay";

type UnknownRecord = Record<string, unknown>;

export type RefundPolicyTier = {
  label: string;
  minHoursBeforeStart: number;
  maxHoursBeforeStart: number | null;
  deductionPercent: number;
};

export type RefundMode = "deduction_policy" | "full_refund";

export type RefundProcessingStatus =
  | "not_required"
  | "processing"
  | "processed"
  | "manual_review"
  | "failed";

export type CancellationRefundPreview = {
  mode: RefundMode;
  baseAmount: number;
  deductionAmount: number;
  deductionPercent: number;
  refundAmount: number;
  policyLabel: string;
  hoursUntilStart: number | null;
};

export const CUSTOMER_CANCELLATION_DEDUCTION_PERCENT = 15;

const DEFAULT_REFUND_POLICY: RefundPolicyTier[] = [
  {
    label: "More than 24 hours before departure",
    minHoursBeforeStart: 24,
    maxHoursBeforeStart: null,
    deductionPercent: 0,
  },
  {
    label: "6 to 24 hours before departure",
    minHoursBeforeStart: 6,
    maxHoursBeforeStart: 24,
    deductionPercent: 10,
  },
  {
    label: "1 to 6 hours before departure",
    minHoursBeforeStart: 1,
    maxHoursBeforeStart: 6,
    deductionPercent: 25,
  },
  {
    label: "Less than 1 hour before departure",
    minHoursBeforeStart: 0,
    maxHoursBeforeStart: 1,
    deductionPercent: 50,
  },
];

const toStringValue = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
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
      const rendered = maybeToString.call(value);
      if (rendered && rendered !== "[object Object]") return rendered;
    }
  }
  return fallback;
};

const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, roundCurrency(value)));
};

const normalizeGatewayRefundStatus = (value: unknown): RefundProcessingStatus => {
  const normalized = toStringValue(value).trim().toLowerCase();
  if (!normalized) return "processing";
  if (normalized === "processed") return "processed";
  if (normalized === "failed") return "failed";
  return "processing";
};

function parseTimeToMinutes(value: unknown): number | null {
  const raw = toStringValue(value).trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function pickBusStartTimeMinutes(busValue: unknown): number | null {
  if (!busValue || typeof busValue !== "object") return null;

  const busRecord = busValue as UnknownRecord;
  const routePathRaw = Array.isArray(busRecord.routePath) ? busRecord.routePath : [];
  if (routePathRaw.length > 0) {
    const normalizedRoutePath = routePathRaw
      .filter((entry): entry is UnknownRecord => Boolean(entry && typeof entry === "object"))
      .sort((left, right) => Number(left.sequence ?? 0) - Number(right.sequence ?? 0));

    for (let index = 0; index < normalizedRoutePath.length; index += 1) {
      const point = normalizedRoutePath[index];
      const category = String(point.pointCategory ?? "").trim().toLowerCase();
      if (category === "pickup") {
        const minutes = parseTimeToMinutes(point.pointTime);
        if (minutes !== null) return minutes;
      }
    }

    const fallbackMinutes = parseTimeToMinutes(normalizedRoutePath[0]?.pointTime);
    if (fallbackMinutes !== null) return fallbackMinutes;
  }

  const pricingRaw = Array.isArray(busRecord.pricing) ? busRecord.pricing : [];
  for (const pricingEntry of pricingRaw) {
    if (!pricingEntry || typeof pricingEntry !== "object") continue;
    const minutes = parseTimeToMinutes((pricingEntry as UnknownRecord).pickupTime);
    if (minutes !== null) return minutes;
  }

  return null;
}

export function buildDefaultRefundPolicySnapshot(): RefundPolicyTier[] {
  return DEFAULT_REFUND_POLICY.map((tier) => ({ ...tier }));
}

export function normalizeRefundPolicySnapshot(value: unknown): RefundPolicyTier[] {
  if (!Array.isArray(value) || value.length === 0) {
    return buildDefaultRefundPolicySnapshot();
  }

  const normalized = value
    .filter((entry): entry is UnknownRecord => Boolean(entry && typeof entry === "object"))
    .map((entry) => ({
      label: toStringValue(entry.label, "Refund policy"),
      minHoursBeforeStart: Math.max(0, toNumberValue(entry.minHoursBeforeStart, 0)),
      maxHoursBeforeStart:
        entry.maxHoursBeforeStart === null || entry.maxHoursBeforeStart === undefined
          ? null
          : Math.max(0, toNumberValue(entry.maxHoursBeforeStart, 0)),
      deductionPercent: clampPercent(toNumberValue(entry.deductionPercent, 0)),
    }))
    .sort((left, right) => right.minHoursBeforeStart - left.minHoursBeforeStart);

  return normalized.length > 0 ? normalized : buildDefaultRefundPolicySnapshot();
}

export function resolveOrderStartDateTime(orderDateValue: unknown, ...busCandidates: unknown[]): Date | null {
  const orderDate = new Date(toStringValue(orderDateValue));
  if (Number.isNaN(orderDate.getTime())) return null;

  const startMinutes = busCandidates
    .map((busCandidate) => pickBusStartTimeMinutes(busCandidate))
    .find((minutes): minutes is number => minutes !== null);

  const startDate = new Date(orderDate);
  startDate.setHours(0, 0, 0, 0);
  if (startMinutes === undefined) return startDate;

  startDate.setMinutes(startMinutes);
  return startDate;
}

export function getHoursUntilStart(startDateTime: Date | null, now = new Date()): number | null {
  if (!startDateTime || Number.isNaN(startDateTime.getTime())) return null;
  return roundCurrency((startDateTime.getTime() - now.getTime()) / (1000 * 60 * 60));
}

function resolvePolicyTier(policy: RefundPolicyTier[], hoursUntilStart: number | null): RefundPolicyTier {
  if (hoursUntilStart === null) {
    return policy[policy.length - 1] ?? buildDefaultRefundPolicySnapshot()[0];
  }

  for (const tier of policy) {
    const withinMin = hoursUntilStart >= tier.minHoursBeforeStart;
    const withinMax = tier.maxHoursBeforeStart === null ? true : hoursUntilStart < tier.maxHoursBeforeStart;
    if (withinMin && withinMax) {
      return tier;
    }
  }

  return policy[policy.length - 1] ?? buildDefaultRefundPolicySnapshot()[0];
}

export function getCollectedAmount(order: UnknownRecord | null | undefined): number {
  if (!order) return 0;
  const totalAmount = toNumberValue(order.totalAmount, 0);
  const pendingAdjustment = Math.max(0, toNumberValue(order.adjustmentPendingAmount, 0));
  const refundAdjustment = Math.max(0, toNumberValue(order.adjustmentRefundAmount, 0));
  return Math.max(0, roundCurrency(totalAmount + refundAdjustment - pendingAdjustment));
}

export function calculateCancellationRefund(options: {
  baseAmount: number;
  orderStartDateTime: Date | null;
  refundPolicy: RefundPolicyTier[];
  mode: RefundMode;
  now?: Date;
}): CancellationRefundPreview {
  const baseAmount = Math.max(0, roundCurrency(options.baseAmount));
  const hoursUntilStart = getHoursUntilStart(options.orderStartDateTime, options.now);
  const policy = normalizeRefundPolicySnapshot(options.refundPolicy);
  const tier = resolvePolicyTier(policy, hoursUntilStart);
  const deductionPercent = options.mode === "full_refund" ? 0 : tier.deductionPercent;
  const policyLabel = options.mode === "full_refund" ? "Admin override: full refund" : tier.label;
  const deductionAmount = roundCurrency((baseAmount * deductionPercent) / 100);
  const refundAmount = Math.max(0, roundCurrency(baseAmount - deductionAmount));

  return {
    mode: options.mode,
    baseAmount,
    deductionAmount,
    deductionPercent,
    refundAmount,
    policyLabel,
    hoursUntilStart,
  };
}

export function applyDeductionPercentToRefundPreview(
  preview: CancellationRefundPreview,
  deductionPercent: number,
  policyLabel?: string,
): CancellationRefundPreview {
  const normalizedDeductionPercent = clampPercent(deductionPercent);
  const deductionAmount = roundCurrency((preview.baseAmount * normalizedDeductionPercent) / 100);
  const refundAmount = Math.max(0, roundCurrency(preview.baseAmount - deductionAmount));

  return {
    ...preview,
    mode: "deduction_policy",
    deductionPercent: normalizedDeductionPercent,
    deductionAmount,
    refundAmount,
    policyLabel: policyLabel || preview.policyLabel,
  };
}

export function canAutoRefundPayment(paymentId: unknown): boolean {
  const normalizedPaymentId = toStringValue(paymentId).trim();
  return Boolean(
    normalizedPaymentId &&
      normalizedPaymentId !== "MANUAL_ADMIN_BOOKING" &&
      process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET,
  );
}

export async function processGatewayRefund(options: {
  paymentId: unknown;
  refundAmount: number;
  trackingId: string;
  requestedByRole: string;
}): Promise<{
  processingStatus: RefundProcessingStatus;
  paymentRefundId: string;
  paymentRefundStatus: string;
  paymentRefundError: string;
  processedAt: Date | null;
}> {
  const refundAmount = Math.max(0, roundCurrency(options.refundAmount));
  if (refundAmount <= 0) {
    return {
      processingStatus: "not_required",
      paymentRefundId: "",
      paymentRefundStatus: "not_required",
      paymentRefundError: "",
      processedAt: new Date(),
    };
  }

  const paymentId = toStringValue(options.paymentId).trim();
  if (!canAutoRefundPayment(paymentId)) {
    return {
      processingStatus: "manual_review",
      paymentRefundId: "",
      paymentRefundStatus: "manual_review",
      paymentRefundError: paymentId ? "" : "Original payment id not available for automatic refund.",
      processedAt: null,
    };
  }

  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const response = await razorpay.payments.refund(paymentId, {
      amount: Math.round(refundAmount * 100),
      speed: "normal",
      notes: {
        trackingId: options.trackingId,
        requestedByRole: options.requestedByRole,
      },
    });

    const refundRecord = response as unknown as UnknownRecord;
    const gatewayStatus = toStringValue(refundRecord.status, "processing");
    const processingStatus = normalizeGatewayRefundStatus(gatewayStatus);

    return {
      processingStatus,
      paymentRefundId: toStringValue(refundRecord.id),
      paymentRefundStatus: gatewayStatus,
      paymentRefundError: "",
      processedAt: processingStatus === "processed" ? new Date() : null,
    };
  } catch (error: unknown) {
    return {
      processingStatus: "failed",
      paymentRefundId: "",
      paymentRefundStatus: "failed",
      paymentRefundError: error instanceof Error ? error.message : "Automatic refund failed.",
      processedAt: null,
    };
  }
}
