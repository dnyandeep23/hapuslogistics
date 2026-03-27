"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { useToast } from "@/context/ToastContext";
import { downloadOrderInvoice } from "@/lib/orderInvoice";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { fetchUser } from "@/lib/redux/userSlice";
import Skeleton from "@/components/Skeleton";
import CustomDatePicker from "@/components/CustomDatePicker";
import ConfirmationModal from "@/components/dashboard/ConfirmationModal";
import { formatIndiaPhoneInput, getIndiaPhoneDigits, normalizeIndiaPhone } from "@/lib/phone";

interface OrderPackage extends Record<string, unknown> {
  id: string;
  packageName: string;
  packageType: string;
  packageSize: string;
  packageWeight: number;
  packageQuantities: number;
  pickUpDate: string;
  packageImage: string;
  description: string;
}

interface TransferCandidate {
  id: string;
  busName: string;
  busNumber: string;
  companyId: string;
  companyName: string;
  availableCapacityKg: number;
  totalCapacityKg: number;
}

interface LocationOption {
  _id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

interface RefundPolicyTier {
  label: string;
  minHoursBeforeStart: number;
  maxHoursBeforeStart: number | null;
  deductionPercent: number;
}

interface RefundPreview {
  mode: "deduction_policy" | "full_refund";
  baseAmount: number;
  deductionAmount: number;
  deductionPercent: number;
  refundAmount: number;
  policyLabel: string;
  hoursUntilStart: number | null;
}

interface CancellationDetails {
  reasonCode: string;
  reasonDescription: string;
  refundMode: string;
  refundBaseAmount: number;
  deductionPercent: number;
  deductionAmount: number;
  refundAmount: number;
  policyLabel: string;
  hoursUntilStart: number | null;
  processingStatus: string;
  paymentRefundId: string;
  paymentRefundStatus: string;
  paymentRefundError: string;
  processedAt: string;
  cancelledAt: string;
  cancelledByRole: string;
}

interface MissedPackageDetails {
  markedAt: string;
  markedByRole: string;
  reason: string;
  refundBaseAmount: number;
  waiverPercent: number;
  waiverAmount: number;
  refundAmount: number;
  refundProcessingStatus: string;
  paymentRefundId: string;
  paymentRefundStatus: string;
  paymentRefundError: string;
  refundTriggeredAt: string;
  refundTriggeredByRole: string;
  refundedAt: string;
}

interface OrderReport {
  reportType: string;
  category: string;
  title: string;
  description: string;
  createdByRole: string;
  createdAt: string;
  data: Record<string, unknown>;
}

interface OrderDetail {
  id: string;
  trackingId: string;
  status: string;
  orderDate: string;
  createdAt: string;
  totalAmount: number;
  totalWeightKg: number;
  packageCount: number;
  pickupLocation: {
    _id?: string;
    id?: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  dropLocation: {
    _id?: string;
    id?: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  senderInfo: Record<string, unknown>;
  receiverInfo: Record<string, unknown>;
  packages: OrderPackage[];
  busContact?: {
    busName: string;
    busNumber: string;
    busImage: string;
    contactPersonName: string;
    contactPersonNumber: string;
  } | null;
  supportContact?: {
    name: string;
    phone: string;
  } | null;
  contactLocked?: boolean;
  pickupProofImage?: string;
  dropProofImage?: string;
  operatorNote?: string;
  customerNote?: string;
  customerEmail?: string;
  canUserEditContacts?: boolean;
  canAdminEditOrder?: boolean;
  canTransferOrder?: boolean;
  canAdminUpdateAll?: boolean;
  currentBusId?: string;
  transferCandidates?: TransferCandidate[];
  adjustmentPendingAmount?: number;
  adjustmentRefundAmount?: number;
  adjustmentStatus?: string;
  canUserCancel?: boolean;
  canAdminCancel?: boolean;
  refundPolicySnapshot?: RefundPolicyTier[];
  refundPreview?: RefundPreview | null;
  cancellationDetails?: CancellationDetails | null;
  missedPackageDetails?: MissedPackageDetails | null;
  canProcessMissedPackageRefund?: boolean;
  reports?: OrderReport[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function toStringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoDate(value: unknown): string {
  const date = new Date(toStringValue(value));
  if (isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function mapLocation(value: unknown) {
  if (!isRecord(value)) {
    return { _id: "", id: "", name: "", address: "", city: "", state: "", zip: "" };
  }
  return {
    _id: toStringValue(value._id),
    id: toStringValue(value.id),
    name: toStringValue(value.name),
    address: toStringValue(value.address),
    city: toStringValue(value.city),
    state: toStringValue(value.state),
    zip: toStringValue(value.zip),
  };
}

function mapOrderPackage(value: unknown, index: number): OrderPackage {
  if (!isRecord(value)) {
    return {
      id: String(index),
      packageName: `Package ${index + 1}`,
      packageType: "",
      packageSize: "",
      packageWeight: 0,
      packageQuantities: 0,
      pickUpDate: "",
      packageImage: "",
      description: "",
    };
  }

  return {
    ...value,
    id: toStringValue(value.id || value._id, String(index)),
    packageName:
      toStringValue(value.packageName) ||
      toStringValue(value.description) ||
      toStringValue(value.packageType) ||
      `Package ${index + 1}`,
    packageType: toStringValue(value.packageType),
    packageSize: toStringValue(value.packageSize),
    packageWeight: toNumberValue(value.packageWeight ?? value.weightKg),
    packageQuantities: toNumberValue(value.packageQuantities ?? value.quantity, 1),
    pickUpDate: toStringValue(value.pickUpDate),
    packageImage: toStringValue(value.packageImage),
    description: toStringValue(value.description),
  };
}

function mapOrderDetail(value: unknown): OrderDetail | null {
  if (!isRecord(value)) return null;

  const rawPackages = Array.isArray(value.packages) ? value.packages : [];
  const rawTransferCandidates = Array.isArray(value.transferCandidates) ? value.transferCandidates : [];

  return {
    id: toStringValue(value.id || value._id),
    trackingId: toStringValue(value.trackingId, "TRACKING-PENDING"),
    status: toStringValue(value.status, "pending"),
    orderDate: toIsoDate(value.orderDate),
    createdAt: toIsoDate(value.createdAt),
    totalAmount: toNumberValue(value.totalAmount),
    totalWeightKg: toNumberValue(value.totalWeightKg),
    packageCount: toNumberValue(value.packageCount, rawPackages.length),
    pickupLocation: mapLocation(value.pickupLocation),
    dropLocation: mapLocation(value.dropLocation),
    senderInfo: isRecord(value.senderInfo) ? value.senderInfo : {},
    receiverInfo: isRecord(value.receiverInfo) ? value.receiverInfo : {},
    packages: rawPackages.map(mapOrderPackage),
    busContact: isRecord(value.busContact)
      ? {
          busName: toStringValue(value.busContact.busName),
          busNumber: toStringValue(value.busContact.busNumber),
          busImage: toStringValue(value.busContact.busImage),
          contactPersonName: toStringValue(value.busContact.contactPersonName),
          contactPersonNumber: toStringValue(value.busContact.contactPersonNumber),
        }
      : null,
    supportContact: isRecord(value.supportContact)
      ? {
          name: toStringValue(value.supportContact.name),
          phone: toStringValue(value.supportContact.phone),
        }
      : null,
    contactLocked: Boolean(value.contactLocked),
    pickupProofImage: toStringValue(value.pickupProofImage),
    dropProofImage: toStringValue(value.dropProofImage),
    operatorNote: toStringValue(value.operatorNote),
    customerNote: toStringValue(value.customerNote),
    customerEmail: toStringValue(value.customerEmail),
    canUserEditContacts: Boolean(value.canUserEditContacts),
    canAdminEditOrder: Boolean(value.canAdminEditOrder),
    canTransferOrder: Boolean(value.canTransferOrder),
    canAdminUpdateAll: Boolean(value.canAdminUpdateAll),
    currentBusId: toStringValue(value.currentBusId),
    transferCandidates: rawTransferCandidates
      .filter((candidate): candidate is UnknownRecord => isRecord(candidate))
      .map((candidate) => ({
        id: toStringValue(candidate.id || candidate._id),
        busName: toStringValue(candidate.busName, "Bus"),
        busNumber: toStringValue(candidate.busNumber),
        companyId: toStringValue(candidate.companyId),
        companyName: toStringValue(candidate.companyName),
        availableCapacityKg: toNumberValue(candidate.availableCapacityKg),
        totalCapacityKg: toNumberValue(candidate.totalCapacityKg),
      })),
    adjustmentPendingAmount: toNumberValue(value.adjustmentPendingAmount),
    adjustmentRefundAmount: toNumberValue(value.adjustmentRefundAmount),
    adjustmentStatus: toStringValue(value.adjustmentStatus, "none"),
    canUserCancel: Boolean(value.canUserCancel),
    canAdminCancel: Boolean(value.canAdminCancel),
    refundPolicySnapshot: Array.isArray(value.refundPolicySnapshot)
      ? value.refundPolicySnapshot
          .filter((entry): entry is UnknownRecord => isRecord(entry))
          .map((entry) => ({
            label: toStringValue(entry.label),
            minHoursBeforeStart: toNumberValue(entry.minHoursBeforeStart),
            maxHoursBeforeStart:
              entry.maxHoursBeforeStart === null || entry.maxHoursBeforeStart === undefined
                ? null
                : toNumberValue(entry.maxHoursBeforeStart),
            deductionPercent: toNumberValue(entry.deductionPercent),
          }))
      : [],
    refundPreview: isRecord(value.refundPreview)
      ? {
          mode: toStringValue(value.refundPreview.mode, "deduction_policy") as "deduction_policy" | "full_refund",
          baseAmount: toNumberValue(value.refundPreview.baseAmount),
          deductionAmount: toNumberValue(value.refundPreview.deductionAmount),
          deductionPercent: toNumberValue(value.refundPreview.deductionPercent),
          refundAmount: toNumberValue(value.refundPreview.refundAmount),
          policyLabel: toStringValue(value.refundPreview.policyLabel),
          hoursUntilStart:
            value.refundPreview.hoursUntilStart === null || value.refundPreview.hoursUntilStart === undefined
              ? null
              : toNumberValue(value.refundPreview.hoursUntilStart),
        }
      : null,
    cancellationDetails: isRecord(value.cancellationDetails)
      ? {
          reasonCode: toStringValue(value.cancellationDetails.reasonCode),
          reasonDescription: toStringValue(value.cancellationDetails.reasonDescription),
          refundMode: toStringValue(value.cancellationDetails.refundMode, "deduction_policy"),
          refundBaseAmount: toNumberValue(value.cancellationDetails.refundBaseAmount),
          deductionPercent: toNumberValue(value.cancellationDetails.deductionPercent),
          deductionAmount: toNumberValue(value.cancellationDetails.deductionAmount),
          refundAmount: toNumberValue(value.cancellationDetails.refundAmount),
          policyLabel: toStringValue(value.cancellationDetails.policyLabel),
          hoursUntilStart:
            value.cancellationDetails.hoursUntilStart === null ||
            value.cancellationDetails.hoursUntilStart === undefined
              ? null
              : toNumberValue(value.cancellationDetails.hoursUntilStart),
          processingStatus: toStringValue(value.cancellationDetails.processingStatus, "not_required"),
          paymentRefundId: toStringValue(value.cancellationDetails.paymentRefundId),
          paymentRefundStatus: toStringValue(value.cancellationDetails.paymentRefundStatus),
          paymentRefundError: toStringValue(value.cancellationDetails.paymentRefundError),
          processedAt: toStringValue(value.cancellationDetails.processedAt),
          cancelledAt: toStringValue(value.cancellationDetails.cancelledAt),
          cancelledByRole: toStringValue(value.cancellationDetails.cancelledByRole),
        }
      : null,
    missedPackageDetails: isRecord(value.missedPackageDetails)
      ? {
          markedAt: toStringValue(value.missedPackageDetails.markedAt),
          markedByRole: toStringValue(value.missedPackageDetails.markedByRole),
          reason: toStringValue(value.missedPackageDetails.reason),
          refundBaseAmount: toNumberValue(value.missedPackageDetails.refundBaseAmount),
          waiverPercent: toNumberValue(value.missedPackageDetails.waiverPercent),
          waiverAmount: toNumberValue(value.missedPackageDetails.waiverAmount),
          refundAmount: toNumberValue(value.missedPackageDetails.refundAmount),
          refundProcessingStatus: toStringValue(value.missedPackageDetails.refundProcessingStatus, "not_started"),
          paymentRefundId: toStringValue(value.missedPackageDetails.paymentRefundId),
          paymentRefundStatus: toStringValue(value.missedPackageDetails.paymentRefundStatus),
          paymentRefundError: toStringValue(value.missedPackageDetails.paymentRefundError),
          refundTriggeredAt: toStringValue(value.missedPackageDetails.refundTriggeredAt),
          refundTriggeredByRole: toStringValue(value.missedPackageDetails.refundTriggeredByRole),
          refundedAt: toStringValue(value.missedPackageDetails.refundedAt),
        }
      : null,
    canProcessMissedPackageRefund: Boolean(value.canProcessMissedPackageRefund),
    reports: Array.isArray(value.reports)
      ? value.reports
          .filter((entry): entry is UnknownRecord => isRecord(entry))
          .map((entry) => ({
            reportType: toStringValue(entry.reportType),
            category: toStringValue(entry.category),
            title: toStringValue(entry.title),
            description: toStringValue(entry.description),
            createdByRole: toStringValue(entry.createdByRole),
            createdAt: toStringValue(entry.createdAt),
            data: isRecord(entry.data) ? entry.data : {},
          }))
      : [],
  };
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatMoney(amount: number): string {
  return `Rs ${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatHoursUntilStart(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  if (value < 0) return `${Math.abs(value).toFixed(1)}h after departure`;
  return `${value.toFixed(1)}h before departure`;
}

const CUSTOMER_CANCELLATION_DEDUCTION_PERCENT = 15;

function prettifyReason(value: string): string {
  if (!value) return "Not specified";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRefundStatusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "processed") return "border-emerald-400/35 bg-emerald-500/10 text-emerald-100";
  if (normalized === "manual_review") return "border-amber-400/35 bg-amber-500/10 text-amber-100";
  if (normalized === "failed") return "border-red-400/35 bg-red-500/10 text-red-100";
  return "border-white/10 bg-white/5 text-white/80";
}

function getRefundStatusSummary(options: {
  processingStatus?: string;
  gatewayStatus?: string;
  refundAmount?: number;
}): string {
  const processingStatus = String(options.processingStatus ?? "").trim().toLowerCase();
  const gatewayStatus = String(options.gatewayStatus ?? "").trim().toLowerCase();
  const effectiveStatus = processingStatus || gatewayStatus;
  const refundAmountText =
    typeof options.refundAmount === "number" && Number.isFinite(options.refundAmount)
      ? formatMoney(options.refundAmount)
      : "";

  if (effectiveStatus === "processed") {
    return refundAmountText ? `Refunded ${refundAmountText}` : "Refund completed";
  }
  if (effectiveStatus === "processing") {
    return refundAmountText ? `Refund in progress for ${refundAmountText}` : "Refund in progress";
  }
  if (effectiveStatus === "manual_review") {
    return refundAmountText ? `Refund needs manual review for ${refundAmountText}` : "Refund needs manual review";
  }
  if (effectiveStatus === "failed") {
    return refundAmountText ? `Refund failed for ${refundAmountText}` : "Refund failed";
  }
  if (effectiveStatus === "not_required") {
    return "No refund payout required";
  }

  return prettifyReason(effectiveStatus || "pending");
}

function getStatusBadge(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "delivered") return "bg-green-500/20 text-green-300 border-green-500/40";
  if (normalized === "in-transit") return "bg-blue-500/20 text-blue-300 border-blue-500/40";
  if (normalized === "missed_package") return "bg-orange-500/20 text-orange-200 border-orange-400/40";
  if (normalized === "cancelled") return "bg-red-500/20 text-red-300 border-red-500/40";
  return "bg-amber-500/20 text-amber-300 border-amber-500/40";
}

function getStepIndex(status: string): number {
  const normalized = status.toLowerCase();
  if (normalized === "pending") return 0;
  if (normalized === "confirmed" || normalized === "allocated") return 1;
  if (normalized === "in-transit") return 2;
  if (normalized === "delivered") return 3;
  return -1;
}

const heroPanelClass =
  "relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(205,214,69,0.12),rgba(29,38,23,0.9)_35%,rgba(10,14,8,0.96))] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.24)]";
const sectionPanelClass =
  "rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(14,19,11,0.92))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)]";
const infoTileClass = "rounded-[1.2rem] border border-white/10 bg-white/5 p-4";

function DetailSectionHeader({
  icon,
  title,
  eyebrow,
  description,
  action,
}: {
  icon: string;
  title: string;
  eyebrow?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#CDD645]">
          <Icon icon={icon} className="text-lg" />
        </span>
        <div>
          {eyebrow ? <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">{eyebrow}</p> : null}
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {description ? <p className="text-sm text-white/55">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function prettyKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function packageExtraFields(pkg: OrderPackage): Array<{ key: string; label: string; value: string }> {
  const hiddenKeys = new Set([
    "_id",
    "id",
    "packageName",
    "packageType",
    "packageSize",
    "packageWeight",
    "packageQuantities",
    "pickUpDate",
    "packageImage",
    "description",
  ]);

  const fields: Array<{ key: string; label: string; value: string }> = [];

  for (const [key, value] of Object.entries(pkg)) {
    if (hiddenKeys.has(key)) continue;
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "object") continue;

    fields.push({
      key,
      label: prettyKey(key),
      value: String(value),
    });
  }

  return fields;
}

function personInfoName(info: Record<string, unknown>, fallback: string): string {
  return (
    toStringValue(info.name) ||
    toStringValue(info.senderName) ||
    toStringValue(info.receiverName) ||
    fallback
  );
}

function personInfoPhone(info: Record<string, unknown>, fallback: string): string {
  return (
    toStringValue(info.phone) ||
    toStringValue(info.contact) ||
    toStringValue(info.senderContact) ||
    toStringValue(info.receiverContact) ||
    fallback
  );
}

function telHref(phone: string): string {
  const normalized = String(phone ?? "").trim().replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : "";
}

type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutOptions = {
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

type RazorpayCheckoutInstance = {
  open: () => void;
  on?: (
    event: string,
    handler: (response: { error?: { description?: string; reason?: string; step?: string } }) => void,
  ) => void;
};

type RazorpayConstructor = new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;

function getRazorpayConstructor(): RazorpayConstructor | null {
  if (typeof window === "undefined") return null;
  const globalWindow = window as unknown as { Razorpay?: RazorpayConstructor };
  return globalWindow.Razorpay ?? null;
}

export default function OrderDetailPage() {
  const dispatch = useAppDispatch();
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const { user } = useAppSelector((state) => state.user);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [senderDraft, setSenderDraft] = useState<Record<string, unknown>>({});
  const [receiverDraft, setReceiverDraft] = useState<Record<string, unknown>>({});
  const [packageDrafts, setPackageDrafts] = useState<OrderPackage[]>([]);
  const [pickupDraft, setPickupDraft] = useState<OrderDetail["pickupLocation"]>({
    _id: "",
    id: "",
    name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  const [dropDraft, setDropDraft] = useState<OrderDetail["dropLocation"]>({
    _id: "",
    id: "",
    name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  const [operatorNoteDraft, setOperatorNoteDraft] = useState("");
  const [customerNoteDraft, setCustomerNoteDraft] = useState("");
  const [customerEmailDraft, setCustomerEmailDraft] = useState("");
  const [orderDateDraft, setOrderDateDraft] = useState("");
  const [savingContacts, setSavingContacts] = useState(false);
  const [savingAdminNotes, setSavingAdminNotes] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [cancelOrderConfirmOpen, setCancelOrderConfirmOpen] = useState(false);
  const [requiredPhoneDraft, setRequiredPhoneDraft] = useState("");
  const [requiredPhoneError, setRequiredPhoneError] = useState("");
  const [savingRequiredPhone, setSavingRequiredPhone] = useState(false);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [transferBusIdDraft, setTransferBusIdDraft] = useState("");
  const [transferringBus, setTransferringBus] = useState(false);
  const [adminEditMode, setAdminEditMode] = useState(false);
  const [processingAdjustmentPayment, setProcessingAdjustmentPayment] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState("customer_request");
  const [cancelReasonDescription, setCancelReasonDescription] = useState("");
  const [cancelRefundMode, setCancelRefundMode] = useState<"deduction_policy" | "full_refund">("deduction_policy");
  const [cancelDeductionPercent, setCancelDeductionPercent] = useState(0);
  const [processingMissedRefund, setProcessingMissedRefund] = useState(false);
  const [missedRefundWaiverPercent, setMissedRefundWaiverPercent] = useState(0);
  const [missedRefundConfirmOpen, setMissedRefundConfirmOpen] = useState(false);
  
  const [processingCancellationRefund, setProcessingCancellationRefund] = useState(false);
  const [cancellationRefundConfirmOpen, setCancellationRefundConfirmOpen] = useState(false);

  const orderId = useMemo(() => {
    const id = params?.orderId;
    return typeof id === "string" ? id : "";
  }, [params]);
  const isOrderOwner = user?.role === "user";
  const requiresStaffPhone = !isOrderOwner && !normalizeIndiaPhone(user?.phone);

  useEffect(() => {
    if (!requiresStaffPhone) return;
    setRequiredPhoneDraft(formatIndiaPhoneInput(""));
    setRequiredPhoneError("");
  }, [requiresStaffPhone]);

  const applyOrderToState = (mappedOrder: OrderDetail) => {
    setOrder(mappedOrder);
    const senderInfo = mappedOrder.senderInfo || {};
    const receiverInfo = mappedOrder.receiverInfo || {};
    const senderContact = formatIndiaPhoneInput(
      toStringValue(senderInfo.contact) || toStringValue(senderInfo.senderContact) || toStringValue(senderInfo.phone),
    );
    const receiverContact = formatIndiaPhoneInput(
      toStringValue(receiverInfo.contact) || toStringValue(receiverInfo.receiverContact) || toStringValue(receiverInfo.phone),
    );
    setSenderDraft({
      ...senderInfo,
      contact: senderContact,
      senderContact: senderContact,
      phone: senderContact,
    });
    setReceiverDraft({
      ...receiverInfo,
      contact: receiverContact,
      receiverContact: receiverContact,
      phone: receiverContact,
    });
    setPackageDrafts(mappedOrder.packages || []);
    setPickupDraft(mappedOrder.pickupLocation);
    setDropDraft(mappedOrder.dropLocation);
    setOperatorNoteDraft(mappedOrder.operatorNote || "");
    setCustomerNoteDraft(mappedOrder.customerNote || "");
    setCustomerEmailDraft(mappedOrder.customerEmail || "");
    setOrderDateDraft(mappedOrder.orderDate ? String(mappedOrder.orderDate).slice(0, 10) : "");
    setCancelReasonCode(mappedOrder.cancellationDetails?.reasonCode || "customer_request");
    setCancelReasonDescription(mappedOrder.cancellationDetails?.reasonDescription || "");
    setCancelRefundMode(
      mappedOrder.cancellationDetails?.refundMode === "full_refund" ? "full_refund" : "deduction_policy",
    );
    setCancelDeductionPercent(
      toNumberValue(mappedOrder.cancellationDetails?.deductionPercent, toNumberValue(mappedOrder.refundPreview?.deductionPercent)),
    );
    setMissedRefundWaiverPercent(toNumberValue(mappedOrder.missedPackageDetails?.waiverPercent));
    setTransferBusIdDraft((current) => {
      const available = mappedOrder.transferCandidates ?? [];
      if (available.some((candidate) => candidate.id === current)) {
        return current;
      }
      return available[0]?.id || "";
    });
  };

  const fetchOrderDetails = async (showLoader: boolean) => {
    if (!orderId) {
      setError("Invalid order id");
      setLoading(false);
      return null;
    }

    try {
      if (showLoader) {
        setLoading(true);
      }
      const response = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        const message = toStringValue(data?.error, "Failed to load order details");
        if (response.status === 401) {
          addToast("Please login to continue.", "warning");
          router.push("/login");
        } else {
          addToast(message, "error");
        }
        setError(message);
        return null;
      }

      const mappedOrder = mapOrderDetail(data);
      if (!mappedOrder) {
        setError("Invalid order details received");
        addToast("Invalid order details received.", "error");
        return null;
      }

      setError(null);
      applyOrderToState(mappedOrder);
      return mappedOrder;
    } catch (requestError: unknown) {
      const message =
        requestError instanceof Error ? requestError.message : "Could not load order details";
      setError(message);
      addToast(message, "error");
      return null;
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void fetchOrderDetails(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (user?.role !== "admin") {
      setLocationOptions([]);
      return;
    }

    let active = true;
    const loadLocations = async () => {
      try {
        const response = await fetch("/api/locations", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) {
          return;
        }
        if (!active) return;

        const mapped = data
          .filter((entry): entry is UnknownRecord => isRecord(entry))
          .map((entry) => ({
            _id: toStringValue(entry._id),
            name: toStringValue(entry.name),
            address: toStringValue(entry.address),
            city: toStringValue(entry.city),
            state: toStringValue(entry.state),
            zip: toStringValue(entry.zip),
          }))
          .filter((entry) => entry._id);
        setLocationOptions(mapped);
      } catch {
        // Keep existing location draft data if this fetch fails.
      }
    };

    void loadLocations();
    return () => {
      active = false;
    };
  }, [user?.role]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="dashboard-surface rounded-2xl p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-48" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
        <div className="dashboard-surface rounded-2xl p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6">
        <button
          type="button"
          onClick={() => router.push("/dashboard/orders")}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-[#5E6A4F] px-3 py-2 text-sm text-white/80 hover:text-white"
        >
          <Icon icon="mdi:arrow-left" />
          Back to Orders
        </button>
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
          {error || "Order not found"}
        </div>
      </div>
    );
  }

  const handleDownloadInvoice = async () => {
    try {
      setDownloadingInvoice(true);
      const fileName = await downloadOrderInvoice(order);
      addToast(`Invoice downloaded: ${fileName}`, "success");
    } catch (downloadError: unknown) {
      const message =
        downloadError instanceof Error ? downloadError.message : "Failed to download invoice.";
      addToast(message, "error");
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const isAdminView = user?.role === "admin";
  const isOperatorView = Boolean(user?.role === "operator");
  const canCallPartyContacts = isAdminView || isOperatorView;
  const canEditAsAdmin = isAdminView && Boolean(order.canAdminEditOrder);
  const canEditAsAdminNow = canEditAsAdmin && adminEditMode;
  const canEditAsOwner = isOrderOwner && Boolean(order.canUserEditContacts);
  const canEditContacts = canEditAsAdminNow || canEditAsOwner;
  const canCancelOrder = isAdminView ? Boolean(order.canAdminCancel) : isOrderOwner ? Boolean(order.canUserCancel) : false;
  const cancelPreview = getCancelPreview();
  const transferCandidates = order.transferCandidates ?? [];
  const selectedTransferBus = transferCandidates.find((candidate) => candidate.id === transferBusIdDraft) || null;
  const displayedPackages = isAdminView ? packageDrafts : order.packages;

  const saveRequiredPhone = async () => {
    const phone = normalizeIndiaPhone(requiredPhoneDraft);
    if (phone === "") {
      setRequiredPhoneError("Contact number is required.");
      return;
    }
    if (phone === null) {
      setRequiredPhoneError("Enter a valid Indian mobile number.");
      return;
    }

    try {
      setSavingRequiredPhone(true);
      setRequiredPhoneError("");
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRequiredPhoneError(data?.message || "Failed to save contact number.");
        return;
      }
      await dispatch(fetchUser());
      addToast("Contact number saved successfully.", "success");
    } catch (error: unknown) {
      setRequiredPhoneError(error instanceof Error ? error.message : "Failed to save contact number.");
    } finally {
      setSavingRequiredPhone(false);
    }
  };

  const saveContactChanges = async () => {
    if (!order) return;

    const senderContactValue = toStringValue(senderDraft.contact ?? senderDraft.senderContact ?? senderDraft.phone);
    const receiverContactValue = toStringValue(receiverDraft.contact ?? receiverDraft.receiverContact ?? receiverDraft.phone);
    const normalizedSenderContact = senderContactValue ? normalizeIndiaPhone(senderContactValue) : "";
    const normalizedReceiverContact = receiverContactValue ? normalizeIndiaPhone(receiverContactValue) : "";

    if (senderContactValue && normalizedSenderContact === null) {
      addToast("Enter a valid Indian mobile number for the sender.", "warning");
      return;
    }

    if (receiverContactValue && normalizedReceiverContact === null) {
      addToast("Enter a valid Indian mobile number for the receiver.", "warning");
      return;
    }

    if (canEditAsAdminNow && !normalizedSenderContact) {
      addToast("Sender contact number is required.", "warning");
      return;
    }

    if (!normalizedReceiverContact) {
      addToast("Receiver contact number is required.", "warning");
      return;
    }

    if (
      normalizedSenderContact &&
      normalizedReceiverContact &&
      getIndiaPhoneDigits(normalizedSenderContact) === getIndiaPhoneDigits(normalizedReceiverContact)
    ) {
      addToast("Sender and receiver contact numbers cannot be the same.", "warning");
      return;
    }

    const nextSenderDraft = {
      ...senderDraft,
      contact: normalizedSenderContact,
      senderContact: normalizedSenderContact,
      phone: normalizedSenderContact,
    };
    const nextReceiverDraft = {
      ...receiverDraft,
      contact: normalizedReceiverContact,
      receiverContact: normalizedReceiverContact,
      phone: normalizedReceiverContact,
    };

    try {
      setSavingContacts(true);
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderInfo: nextSenderDraft,
          receiverInfo: nextReceiverDraft,
          orderDate: isAdminView ? orderDateDraft : undefined,
          pickupLocation: isAdminView ? pickupDraft : undefined,
          dropLocation: isAdminView ? dropDraft : undefined,
          packages: isAdminView ? packageDrafts : undefined,
          operatorNote: isAdminView ? operatorNoteDraft : undefined,
          customerNote: isAdminView ? customerNoteDraft : undefined,
          customerEmail: isAdminView ? customerEmailDraft : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        addToast(toStringValue(data?.error, "Failed to update contacts."), "error");
        return;
      }
      addToast("Order contact details updated.", "success");
      await fetchOrderDetails(false);
      if (isAdminView) {
        setAdminEditMode(false);
      }
    } catch (saveError: unknown) {
      addToast(saveError instanceof Error ? saveError.message : "Failed to update contacts.", "error");
    } finally {
      setSavingContacts(false);
    }
  };

  const updatePackageDraft = (index: number, updates: Partial<OrderPackage>) => {
    setPackageDrafts((prev) =>
      prev.map((pkg, pkgIndex) => (pkgIndex === index ? { ...pkg, ...updates } : pkg)),
    );
  };

  const syncOrderAndPackageDates = (nextDate: string) => {
    setOrderDateDraft(nextDate);
    setPackageDrafts((prev) =>
      prev.map((pkg) => ({
        ...pkg,
        pickUpDate: nextDate,
      })),
    );
  };

  const addPackageDraft = () => {
    setPackageDrafts((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        packageName: "",
        packageType: "",
        packageSize: "",
        packageWeight: 0,
        packageQuantities: 1,
        pickUpDate: orderDateDraft,
        packageImage: "",
        description: "",
      },
    ]);
  };

  const removePackageDraft = (index: number) => {
    setPackageDrafts((prev) => prev.filter((_, pkgIndex) => pkgIndex !== index));
  };

  const loadRazorpayScript = async () => {
    if (typeof window === "undefined") return false;
    if (getRazorpayConstructor()) return true;

    return new Promise<boolean>((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const payAdjustmentAmount = async () => {
    if (!order || !isOrderOwner) return;
    if (toNumberValue(order.adjustmentPendingAmount) <= 0) {
      addToast("No additional payment pending for this order.", "warning");
      return;
    }

    const isRazorpayLoaded = await loadRazorpayScript();
    if (!isRazorpayLoaded) {
      addToast("Razorpay checkout failed to load.", "error");
      return;
    }

    try {
      setProcessingAdjustmentPayment(true);
      const createResponse = await fetch(`/api/orders/${order.id}/adjustment-payment`, {
        method: "POST",
      });
      const createPayload = await createResponse.json();
      if (!createResponse.ok) {
        addToast(toStringValue(createPayload?.error, "Failed to initiate payment."), "error");
        return;
      }

      const options: RazorpayCheckoutOptions = {
        key: toStringValue(createPayload.keyId),
        amount: toNumberValue(createPayload.amount),
        currency: toStringValue(createPayload.currency, "INR"),
        name: "Hapus Logistics",
        description: `Order adjustment payment (${order.trackingId})`,
        order_id: toStringValue(createPayload.razorpayOrderId),
        handler: async (response: RazorpayHandlerResponse) => {
          const verifyResponse = await fetch(`/api/orders/${order.id}/adjustment-payment`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyPayload = await verifyResponse.json();
          if (!verifyResponse.ok) {
            addToast(toStringValue(verifyPayload?.error, "Payment verification failed."), "error");
            return;
          }
          addToast(toStringValue(verifyPayload?.message, "Adjustment payment completed successfully."), "success");
          await fetchOrderDetails(false);
        },
        prefill: {
          name: toStringValue(user?.name),
          email: toStringValue(user?.email),
          contact: toStringValue(user?.phone),
        },
        theme: {
          color: "#CDD645",
        },
        modal: {
          ondismiss: () => {
            setProcessingAdjustmentPayment(false);
          },
        },
      };

      const Razorpay = getRazorpayConstructor();
      if (!Razorpay) {
        addToast("Razorpay checkout failed to initialize.", "error");
        return;
      }
      const rzp = new Razorpay(options);
      rzp.on?.("payment.failed", (response) => {
        const failureReason =
          response?.error?.description ||
          response?.error?.reason ||
          response?.error?.step ||
          "Payment failed in Razorpay checkout.";
        addToast(failureReason, "error");
        setProcessingAdjustmentPayment(false);
      });
      rzp.open();
    } catch (paymentError: unknown) {
      addToast(paymentError instanceof Error ? paymentError.message : "Failed to process payment.", "error");
    } finally {
      setProcessingAdjustmentPayment(false);
    }
  };

  const transferOrderBus = async () => {
    if (!order || !isAdminView) return;
    if (!adminEditMode) {
      addToast("Enable update mode to transfer this order.", "warning");
      return;
    }
    if (!order.canTransferOrder) {
      addToast("Bus transfer is locked. It is allowed only until 1 hour before bus start.", "error");
      return;
    }
    if (!transferBusIdDraft) {
      addToast("Select a destination bus to transfer.", "error");
      return;
    }

    try {
      setTransferringBus(true);
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferBusId: transferBusIdDraft }),
      });
      const data = await response.json();
      if (!response.ok) {
        addToast(toStringValue(data?.error, "Failed to transfer order."), "error");
        return;
      }
      addToast(toStringValue(data?.message, "Order transferred successfully."), "success");
      await fetchOrderDetails(false);
    } catch (transferError: unknown) {
      addToast(transferError instanceof Error ? transferError.message : "Failed to transfer order.", "error");
    } finally {
      setTransferringBus(false);
    }
  };

  const saveAdminNotes = async () => {
    if (!order || !isAdminView) return;
    try {
      setSavingAdminNotes(true);

      if (operatorNoteDraft.trim()) {
        const operatorResponse = await fetch("/api/dashboard/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            action: "add_operator_note",
            operatorNote: operatorNoteDraft,
          }),
        });
        const operatorData = await operatorResponse.json();
        if (!operatorResponse.ok) {
          addToast(toStringValue(operatorData?.message, "Failed to save operator note."), "error");
          return;
        }
      }

      if (customerNoteDraft.trim()) {
        const customerResponse = await fetch("/api/dashboard/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            action: "add_customer_note",
            customerNote: customerNoteDraft,
          }),
        });
        const customerData = await customerResponse.json();
        if (!customerResponse.ok) {
          addToast(toStringValue(customerData?.message, "Failed to save customer note."), "error");
          return;
        }
      }

      addToast("Notes saved.", "success");
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              operatorNote: operatorNoteDraft,
              customerNote: customerNoteDraft,
            }
          : prev,
      );
    } catch (saveError: unknown) {
      addToast(saveError instanceof Error ? saveError.message : "Failed to save notes.", "error");
    } finally {
      setSavingAdminNotes(false);
    }
  };

  function getCancelPreview(): RefundPreview | null {
    if (!order?.refundPreview) return null;
    if (!isAdminView) {
      return order.refundPreview;
    }

    if (cancelRefundMode === "deduction_policy") {
      const baseAmount = toNumberValue(order.refundPreview.baseAmount);
      const deductionPercent = Math.max(0, Math.min(100, cancelDeductionPercent));
      const deductionAmount = Math.round(((baseAmount * deductionPercent) / 100) * 100) / 100;
      return {
        ...order.refundPreview,
        mode: "deduction_policy",
        deductionPercent,
        deductionAmount,
        refundAmount: Math.max(0, Math.round((baseAmount - deductionAmount) * 100) / 100),
        policyLabel:
          deductionPercent === toNumberValue(order.refundPreview.deductionPercent)
            ? order.refundPreview.policyLabel
            : `Admin adjusted deduction: ${deductionPercent}%`,
      };
    }

    return {
      ...order.refundPreview,
      mode: "full_refund",
      deductionAmount: 0,
      deductionPercent: 0,
      refundAmount: toNumberValue(order.refundPreview.baseAmount),
      policyLabel: "Admin override: full refund",
    };
  }

  const cancelOrder = async () => {
    if (!order || (!isAdminView && !isOrderOwner)) return;
    if (!cancelReasonCode.trim() && !cancelReasonDescription.trim()) {
      addToast("Select or describe a cancellation reason first.", "warning");
      return;
    }

    try {
      setCancellingOrder(true);
      const response = await fetch(`/api/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reasonCode: cancelReasonCode,
          reasonDescription: cancelReasonDescription,
          refundMode: isAdminView ? cancelRefundMode : "deduction_policy",
          deductionPercentOverride: isAdminView && cancelRefundMode === "deduction_policy" ? cancelDeductionPercent : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        addToast(toStringValue(data?.message || data?.error, "Failed to cancel order."), "error");
        return;
      }
      addToast(toStringValue(data?.message, "Order cancelled."), "success");
      await fetchOrderDetails(false);
    } catch (cancelError: unknown) {
      addToast(cancelError instanceof Error ? cancelError.message : "Failed to cancel order.", "error");
    } finally {
      setCancellingOrder(false);
    }
  };

  const processCancellationRefund = async () => {
    if (!order || !isAdminView) return;

    try {
      setProcessingCancellationRefund(true);
      const response = await fetch(`/api/orders/${order.id}/cancellation-refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waiverPercent: 10,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        addToast(toStringValue(payload?.message || payload?.error, "Failed to process cancellation refund."), "error");
        return;
      }
      addToast(toStringValue(payload?.message, "Cancellation refund updated."), "success");
      await fetchOrderDetails(false);
      setCancellationRefundConfirmOpen(false);
    } catch (refundError: unknown) {
      addToast(
        refundError instanceof Error ? refundError.message : "Failed to process cancellation refund.",
        "error",
      );
    } finally {
      setProcessingCancellationRefund(false);
    }
  };

  const processMissedPackageRefund = async () => {
    if (!order || (!isAdminView && !isOperatorView)) return;

    try {
      setProcessingMissedRefund(true);
      const response = await fetch(`/api/orders/${order.id}/missed-package-refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waiverPercent: isAdminView ? missedRefundWaiverPercent : 0,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        addToast(toStringValue(payload?.message || payload?.error, "Failed to process missed package refund."), "error");
        return;
      }
      addToast(toStringValue(payload?.message, "Missed package refund updated."), "success");
      await fetchOrderDetails(false);
    } catch (refundError: unknown) {
      addToast(
        refundError instanceof Error ? refundError.message : "Failed to process missed package refund.",
        "error",
      );
    } finally {
      setProcessingMissedRefund(false);
    }
  };

  const statusLower = order.status.toLowerCase();
  const isDelivered = statusLower === "delivered";
  const isCancelled = statusLower === "cancelled";
  const isMissedPackage = statusLower === "missed_package";
  const contactRevealTime = addDays(new Date(order.orderDate), -1);
  const hideContactByTime = Boolean(order.contactLocked) || new Date() < contactRevealTime;
  const canShowContact =
    Boolean(order.busContact?.contactPersonNumber || order.busContact?.contactPersonName) &&
    !isDelivered &&
    !isCancelled &&
    !isMissedPackage &&
    !hideContactByTime;
  const supportPhone = toStringValue(order.supportContact?.phone);
  const supportPhoneHref = telHref(supportPhone);
  const statusStepIndex = getStepIndex(order.status);
  const statusSteps = ["Order Placed", "Confirmed", "In Transit", "Delivered"];
  const missedRefundBaseAmount = toNumberValue(order.missedPackageDetails?.refundBaseAmount);
  const missedRefundPreviewWaiverAmount = Math.round((missedRefundBaseAmount * missedRefundWaiverPercent / 100) * 100) / 100;
  const missedRefundPreviewAmount = Math.max(
    0,
    Math.round((missedRefundBaseAmount - missedRefundPreviewWaiverAmount) * 100) / 100,
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <section className={heroPanelClass}>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-56 bg-[radial-gradient(circle_at_center,rgba(205,214,69,0.16),transparent_70%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <button
              type="button"
              onClick={() => router.push("/dashboard/orders")}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="text-sm" />
              Back to Orders
            </button>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#CDD645]/25 bg-[#CDD645]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A]">
                Complete order view
              </span>
              <p className="font-mono text-sm text-[#F6FF6A]">{order.trackingId}</p>
            </div>
            <h1 className="mt-3 text-3xl font-bold text-white">
              {order.pickupLocation.name || "--"} to {order.dropLocation.name || "--"}
            </h1>
            <p className="mt-2 text-sm text-white/68">
              Full package details, shipment status, notes, proofs, contacts, and refund information in one place for every role.
            </p>
          </div>
          <span
            className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold capitalize backdrop-blur-sm ${getStatusBadge(
              order.status,
            )}`}
          >
            {order.status}
          </span>
        </div>

        <div className="relative mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Shipment progress</p>
              <span className="text-xs text-[#DDE98D]">Live order snapshot</span>
            </div>
            {statusStepIndex >= 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {statusSteps.map((step, idx) => {
                  const active = statusStepIndex >= idx;
                  return (
                    <div key={step} className="flex flex-col items-center gap-2">
                      <div className={`h-2 w-full rounded-full ${active ? "bg-[#CDD645]" : "bg-white/15"}`} />
                      <p className={`text-[11px] text-center ${active ? "text-white" : "text-white/45"}`}>
                        {step}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/12 bg-black/15 px-4 py-5 text-sm text-white/68">
                This order is in a final exception state. See the refund and report sections below for the complete timeline.
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
            <div className={infoTileClass}>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">Order Date</p>
              <p className="mt-2 text-sm font-semibold text-white">{formatDate(order.orderDate)}</p>
            </div>
            <div className={infoTileClass}>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">Created</p>
              <p className="mt-2 text-sm font-semibold text-white">{formatDate(order.createdAt)}</p>
            </div>
            <div className={infoTileClass}>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">Total Value</p>
              <p className="mt-2 text-sm font-semibold text-white">{formatMoney(order.totalAmount)}</p>
            </div>
            <div className={infoTileClass}>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">Load Summary</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {order.packageCount} package(s) • {order.totalWeightKg} kg
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center gap-2">
          {isOrderOwner ? (
            supportPhoneHref ? (
              <a
                href={supportPhoneHref}
                className="inline-flex items-center gap-2 rounded-lg border border-[#6A774F] bg-[#25311E] px-3 py-2 text-xs font-semibold text-[#F6FF6A] hover:bg-[#2D3A24]"
              >
                <Icon icon="mdi:lifebuoy" className="text-sm" />
                Contact Support: {supportPhone}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => router.push(`/dashboard/support?orderId=${order.id}`)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#6A774F] bg-[#25311E] px-3 py-2 text-xs font-semibold text-[#F6FF6A] hover:bg-[#2D3A24]"
              >
                <Icon icon="mdi:lifebuoy" className="text-sm" />
                Contact Support
              </button>
            )
          ) : null}
          <button
            type="button"
            onClick={handleDownloadInvoice}
            disabled={downloadingInvoice}
            className="inline-flex items-center gap-2 rounded-lg border border-[#6A774F] bg-[#25311E] px-3 py-2 text-sm font-medium text-[#F6FF6A] hover:bg-[#2D3A24] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon
              icon={downloadingInvoice ? "line-md:loading-loop" : "mdi:file-document-outline"}
              className="text-base"
            />
            {downloadingInvoice ? "Preparing Invoice..." : "Download Invoice"}
          </button>
          {isAdminView && canEditAsAdmin && !adminEditMode ? (
            <button
              type="button"
              onClick={() => setAdminEditMode(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#6A774F] bg-[#25311E] px-3 py-2 text-sm font-semibold text-[#F6FF6A] hover:bg-[#2D3A24]"
            >
              <Icon icon="mdi:pencil-outline" className="text-base" />
              Enable Update Mode
            </button>
          ) : null}
          {isAdminView && adminEditMode ? (
            <button
              type="button"
              onClick={saveContactChanges}
              disabled={savingContacts}
              className="inline-flex items-center gap-2 rounded-lg border border-[#6A774F] bg-[#25311E] px-3 py-2 text-sm font-semibold text-[#F6FF6A] hover:bg-[#2D3A24] disabled:opacity-60"
            >
              <Icon icon={savingContacts ? "line-md:loading-loop" : "mdi:content-save-outline"} className="text-base" />
              {savingContacts ? "Saving..." : "Save Details"}
            </button>
          ) : null}
          {isAdminView && adminEditMode ? (
            <button
              type="button"
              onClick={() => {
                setAdminEditMode(false);
                applyOrderToState(order);
              }}
              className="dashboard-surface-soft inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10"
            >
              <Icon icon="mdi:close-circle-outline" className="text-base" />
              Cancel Update
            </button>
          ) : null}
          {canCancelOrder ? (
            <button
              type="button"
              onClick={() => {
                if (!isAdminView) {
                  setCancelReasonCode("customer_request");
                  setCancelReasonDescription("");
                }
                setCancelOrderConfirmOpen(true);
              }}
              disabled={cancellingOrder}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-400/45 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-60"
            >
              <Icon icon={cancellingOrder ? "line-md:loading-loop" : "mdi:cancel"} className="text-base" />
              {cancellingOrder ? "Cancelling..." : isAdminView ? "Cancel Order" : "Cancel Booking"}
            </button>
          ) : null}
          {(isAdminView || isOperatorView) && order.canProcessMissedPackageRefund ? (
            <button
              type="button"
              onClick={() => {
                if (isAdminView) {
                  setMissedRefundConfirmOpen(true);
                  return;
                }
                void processMissedPackageRefund();
              }}
              disabled={processingMissedRefund}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/45 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-60"
            >
              <Icon icon={processingMissedRefund ? "line-md:loading-loop" : "mdi:cash-refund"} className="text-base" />
              {processingMissedRefund ? "Processing Refund..." : isOperatorView ? "Auto Refund" : "Send Refund"}
            </button>
          ) : null}
        </div>
      </section>

      {isCancelled && order.cancellationDetails ? (
        <div className={`${sectionPanelClass} mt-6`}>
          <DetailSectionHeader
            icon="mdi:cash-refund"
            eyebrow="Refunds"
            title="Cancellation & Refund"
            description="Cancellation reason, deduction policy, and gateway refund state."
            action={
              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium ${getRefundStatusTone(
                  order.cancellationDetails.processingStatus,
                )}`}
              >
                {order.cancellationDetails.processingStatus.replaceAll("_", " ")}
              </span>
            }
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="dashboard-surface-soft rounded-lg p-3">
              <p className="text-xs text-white/50">Refund Amount</p>
              <p className="text-sm text-white">{formatMoney(toNumberValue(order.cancellationDetails.refundAmount))}</p>
            </div>
            <div className="dashboard-surface-soft rounded-lg p-3">
              <p className="text-xs text-white/50">Deduction</p>
              <p className="text-sm text-white">
                {formatMoney(toNumberValue(order.cancellationDetails.deductionAmount))} ({toNumberValue(order.cancellationDetails.deductionPercent)}%)
              </p>
            </div>
            <div className="dashboard-surface-soft rounded-lg p-3">
              <p className="text-xs text-white/50">Policy</p>
              <p className="text-sm text-white">{order.cancellationDetails.policyLabel || "--"}</p>
            </div>
            <div className="dashboard-surface-soft rounded-lg p-3">
              <p className="text-xs text-white/50">Cancelled</p>
              <p className="text-sm text-white">
                {order.cancellationDetails.cancelledAt ? formatDate(order.cancellationDetails.cancelledAt) : "--"}
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="dashboard-surface-soft rounded-lg p-3 text-sm text-white/80">
              <p>
                <span className="text-white/50">Reason:</span>{" "}
                {order.cancellationDetails.reasonDescription || prettifyReason(order.cancellationDetails.reasonCode)}
              </p>
              <p className="mt-2">
                <span className="text-white/50">Cancelled By:</span>{" "}
                {prettifyReason(order.cancellationDetails.cancelledByRole)}
              </p>
              <p className="mt-2">
                <span className="text-white/50">Timing:</span>{" "}
                {formatHoursUntilStart(order.cancellationDetails.hoursUntilStart)}
              </p>
            </div>
            <div className="dashboard-surface-soft rounded-lg p-3 text-sm text-white/80">
              <p>
                <span className="text-white/50">Refund Status:</span>{" "}
                {getRefundStatusSummary({
                  processingStatus: order.cancellationDetails.processingStatus,
                  gatewayStatus: order.cancellationDetails.paymentRefundStatus,
                  refundAmount: toNumberValue(order.cancellationDetails.refundAmount),
                })}
              </p>
              <p className="mt-2">
                <span className="text-white/50">Gateway Response:</span>{" "}
                {prettifyReason(order.cancellationDetails.paymentRefundStatus || order.cancellationDetails.processingStatus)}
              </p>
              {order.cancellationDetails.paymentRefundId ? (
                <p className="mt-2">
                  <span className="text-white/50">Refund Reference:</span>{" "}
                  {order.cancellationDetails.paymentRefundId}
                </p>
              ) : null}
              {order.cancellationDetails.processedAt ? (
                <p className="mt-2">
                  <span className="text-white/50">Refunded On:</span>{" "}
                  {formatDate(order.cancellationDetails.processedAt)}
                </p>
              ) : null}
              {order.cancellationDetails.paymentRefundError ? (
                <p className="mt-2 text-red-200">
                  <span className="text-red-300/80">Refund Issue:</span>{" "}
                  {order.cancellationDetails.paymentRefundError}
                </p>
              ) : null}
            </div>
          </div>
          {isAdminView && order.cancellationDetails.reasonCode === "customer_not_at_pickup" && order.cancellationDetails.processingStatus === "pending_admin_action" ? (
             <div className="mt-4 flex justify-end border-t border-white/5 pt-4">
                <button
                  type="button"
                  onClick={() => setCancellationRefundConfirmOpen(true)}
                  disabled={processingCancellationRefund}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/45 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-60"
                >
                  <Icon icon={processingCancellationRefund ? "line-md:loading-loop" : "mdi:cash-refund"} className="text-base" />
                  {processingCancellationRefund ? "Processing Refund..." : "Send Refund (10% Waiver)"}
                </button>
             </div>
          ) : null}
        </div>
      ) : null}

      {isMissedPackage && order.missedPackageDetails ? (
        <div className={`${sectionPanelClass} mt-6`}>
          <DetailSectionHeader
            icon="mdi:package-variant-remove"
            eyebrow="Exception"
            title="Missed Package"
            description="Auto-marked unprocessed order details and refund follow-up."
            action={
              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium ${getRefundStatusTone(
                  order.missedPackageDetails.refundProcessingStatus,
                )}`}
              >
                {order.missedPackageDetails.refundProcessingStatus.replaceAll("_", " ")}
              </span>
            }
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="dashboard-surface-soft rounded-lg p-3">
              <p className="text-xs text-white/50">Marked At</p>
              <p className="text-sm text-white">
                {order.missedPackageDetails.markedAt ? formatDate(order.missedPackageDetails.markedAt) : "--"}
              </p>
            </div>
            <div className="dashboard-surface-soft rounded-lg p-3">
              <p className="text-xs text-white/50">Marked By</p>
              <p className="text-sm text-white">{prettifyReason(order.missedPackageDetails.markedByRole || "system")}</p>
            </div>
            <div className="dashboard-surface-soft rounded-lg p-3">
              <p className="text-xs text-white/50">Refund Base</p>
              <p className="text-sm text-white">{formatMoney(order.missedPackageDetails.refundBaseAmount)}</p>
            </div>
            <div className="dashboard-surface-soft rounded-lg p-3">
              <p className="text-xs text-white/50">Waiver</p>
              <p className="text-sm text-white">
                {formatMoney(order.missedPackageDetails.waiverAmount)} ({toNumberValue(order.missedPackageDetails.waiverPercent)}%)
              </p>
            </div>
            <div className="dashboard-surface-soft rounded-lg p-3">
              <p className="text-xs text-white/50">Refund Amount</p>
              <p className="text-sm text-white">{formatMoney(order.missedPackageDetails.refundAmount)}</p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="dashboard-surface-soft rounded-lg p-3 text-sm text-white/80">
              <p>{order.missedPackageDetails.reason || "The order stayed unprocessed past the pickup date."}</p>
              {order.missedPackageDetails.refundTriggeredAt ? (
                <p className="mt-2">
                  <span className="text-white/50">Refund Triggered:</span>{" "}
                  {formatDate(order.missedPackageDetails.refundTriggeredAt)} by{" "}
                  {prettifyReason(order.missedPackageDetails.refundTriggeredByRole || "--")}
                </p>
              ) : null}
            </div>
            <div className="dashboard-surface-soft rounded-lg p-3 text-sm text-white/80">
              <p>
                <span className="text-white/50">Refund Status:</span>{" "}
                {getRefundStatusSummary({
                  processingStatus: order.missedPackageDetails.refundProcessingStatus,
                  gatewayStatus: order.missedPackageDetails.paymentRefundStatus,
                  refundAmount: toNumberValue(order.missedPackageDetails.refundAmount),
                })}
              </p>
              <p className="mt-2">
                <span className="text-white/50">Gateway Response:</span>{" "}
                {prettifyReason(
                  order.missedPackageDetails.paymentRefundStatus || order.missedPackageDetails.refundProcessingStatus,
                )}
              </p>
              {order.missedPackageDetails.paymentRefundStatus?.toLowerCase() === "processing" ? (
                <p className="mt-2 text-amber-100">
                  Razorpay accepted the refund request for this order and is still processing the payout.
                </p>
              ) : null}
              {order.missedPackageDetails.paymentRefundStatus?.toLowerCase() === "processed" ? (
                <p className="mt-2 text-emerald-100">
                  Razorpay completed the refund successfully for {formatMoney(toNumberValue(order.missedPackageDetails.refundAmount))}.
                </p>
              ) : null}
              {order.missedPackageDetails.paymentRefundStatus?.toLowerCase() === "failed" ? (
                <p className="mt-2 text-red-200">Razorpay returned a failed refund response.</p>
              ) : null}
              {order.missedPackageDetails.paymentRefundId ? (
                <p className="mt-2">
                  <span className="text-white/50">Refund Reference:</span>{" "}
                  {order.missedPackageDetails.paymentRefundId}
                </p>
              ) : null}
              {order.missedPackageDetails.refundedAt ? (
                <p className="mt-2">
                  <span className="text-white/50">Refunded On:</span>{" "}
                  {formatDate(order.missedPackageDetails.refundedAt)}
                </p>
              ) : null}
              {order.missedPackageDetails.paymentRefundError ? (
                <p className="mt-2 text-red-200">{order.missedPackageDetails.paymentRefundError}</p>
              ) : null}
            </div>
          </div>
          {(isAdminView || isOperatorView) && order.canProcessMissedPackageRefund ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isAdminView) {
                    setMissedRefundConfirmOpen(true);
                    return;
                  }
                  void processMissedPackageRefund();
                }}
                disabled={processingMissedRefund}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/45 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-60"
              >
                <Icon icon={processingMissedRefund ? "line-md:loading-loop" : "mdi:cash-refund"} className="text-base" />
                {processingMissedRefund ? "Processing Refund..." : isOperatorView ? "Auto Refund" : "Send Refund"}
              </button>
              <p className="text-xs text-white/60">
                {isOperatorView
                  ? "One tap triggers the missed-package auto refund flow."
                  : "Open the refund modal, adjust the waiver percentage, and then send the missed-package refund to Razorpay."}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {(toNumberValue(order.adjustmentPendingAmount) > 0 || toNumberValue(order.adjustmentRefundAmount) > 0) && (
        <div className={`${sectionPanelClass} mt-6`}>
          <DetailSectionHeader
            icon="mdi:scale-balance"
            eyebrow="Billing"
            title="Order Amount Adjustment"
            description="Track any amount difference caused by admin updates."
          />
          {toNumberValue(order.adjustmentPendingAmount) > 0 ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/35 bg-amber-500/10 p-3">
              <div>
                <p className="text-sm text-amber-100">
                  Additional amount due: <span className="font-semibold">{formatMoney(toNumberValue(order.adjustmentPendingAmount))}</span>
                </p>
                <p className="text-xs text-amber-200/85">
                  Updated package details increased the order amount.
                </p>
              </div>
              {isOrderOwner ? (
                <button
                  type="button"
                  onClick={payAdjustmentAmount}
                  disabled={processingAdjustmentPayment}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300/45 bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/30 disabled:opacity-60"
                >
                  <Icon icon={processingAdjustmentPayment ? "line-md:loading-loop" : "mdi:credit-card-outline"} className="text-sm" />
                  {processingAdjustmentPayment ? "Opening..." : "Pay Additional Amount"}
                </button>
              ) : (
                <p className="text-xs text-amber-100/80">Waiting for customer payment</p>
              )}
            </div>
          ) : null}
          {toNumberValue(order.adjustmentRefundAmount) > 0 ? (
            <div className="mt-2 rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-3">
              <p className="text-sm text-emerald-100">
                Refund amount: <span className="font-semibold">{formatMoney(toNumberValue(order.adjustmentRefundAmount))}</span>
              </p>
              <p className="text-xs text-emerald-200/85">
                Reduced order value after admin updates. Refund is pending processing.
              </p>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className={sectionPanelClass}>
          <DetailSectionHeader
            icon="mdi:bus"
            eyebrow="Transport"
            title="Assigned Bus"
            description="Bus assignment and transfer controls."
            action={
              isAdminView ? (
                <span className="rounded-full border border-[#6A774F] bg-[#25311E] px-2.5 py-1 text-[11px] text-[#F6FF6A]">
                  {adminEditMode ? "Transfer enabled" : "View mode"}
                </span>
              ) : undefined
            }
          />
          {order.busContact ? (
            <div className="flex items-center gap-3">
              {order.busContact.busImage ? (
                <Image
                  src={order.busContact.busImage}
                  alt={order.busContact.busName || "Assigned bus"}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-lg border border-white/15 object-cover"
                />
              ) : (
                <div className="dashboard-subsurface flex h-16 w-16 items-center justify-center rounded-lg text-[#F6FF6A]">
                  <Icon icon="mdi:bus" className="text-2xl" />
                </div>
              )}
              <div>
                <p className="font-semibold text-white">{order.busContact.busName || "Assigned Bus"}</p>
                <p className="text-sm text-[#F6FF6A]">{order.busContact.busNumber || "--"}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/65">Bus details will appear after allocation.</p>
          )}

          {isAdminView && adminEditMode ? (
            <div className="mt-4 border-t border-white/10 pt-3">
              {!order.canTransferOrder ? (
                <p className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Transfer is available only until 1 hour before bus start time.
                </p>
              ) : null}
              {transferCandidates.length > 0 ? (
                <div className="mt-2 grid gap-3">
                  <label className="text-xs text-white/60">Transfer to another bus (same or different company)</label>
                  <select
                    value={transferBusIdDraft}
                    onChange={(event) => setTransferBusIdDraft(event.target.value)}
                    className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
                  >
                    {transferCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id} className="bg-[#121811] text-white">
                        {candidate.busName} ({candidate.busNumber || "--"}) - {candidate.companyName || "Company"} -{" "}
                        {candidate.availableCapacityKg}kg free
                      </option>
                    ))}
                  </select>
                  {selectedTransferBus ? (
                    <p className="text-xs text-white/60">
                      Capacity: {selectedTransferBus.availableCapacityKg} / {selectedTransferBus.totalCapacityKg} kg
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={transferOrderBus}
                    disabled={transferringBus || !order.canTransferOrder || !transferBusIdDraft}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#6A774F] bg-[#25311E] px-4 py-2 text-sm font-semibold text-[#F6FF6A] hover:bg-[#2D3A24] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon icon={transferringBus ? "line-md:loading-loop" : "mdi:swap-horizontal-bold"} className="text-base" />
                    {transferringBus ? "Transferring..." : "Transfer Bus"}
                  </button>
                </div>
              ) : (
                <p className="dashboard-surface-soft mt-2 rounded-lg px-3 py-2 text-sm text-white/65">
                  No compatible bus with enough capacity is available right now.
                </p>
              )}
            </div>
          ) : isAdminView ? (
            <p className="mt-3 text-xs text-white/55">Enable update mode to edit/transfer this order.</p>
          ) : null}
        </div>

        <div className={sectionPanelClass}>
          <DetailSectionHeader
            icon="mdi:account-voice"
            eyebrow="Contacts"
            title="Operator Contact"
            description="Operator details become visible based on order timing and status."
          />
          {canShowContact ? (
            <div className="space-y-1 text-sm text-white">
              <p>{order.busContact?.contactPersonName || "Assigned Operator"}</p>
              <p className="font-mono text-[#F6FF6A]">{order.busContact?.contactPersonNumber}</p>
            </div>
          ) : hideContactByTime && order.busContact ? (
            <div className="dashboard-subsurface relative overflow-hidden rounded-lg p-2">
              <div className="select-none blur-sm">
                <p className="text-sm text-white">Assigned Operator</p>
                <p className="font-mono text-sm text-[#F6FF6A]">XXXXXXXXXX</p>
              </div>
              <div className="pointer-events-none absolute inset-0 bg-black/40" />
              <p className="mt-2 text-xs text-white/70">Contact unlocks 1 day before pickup.</p>
            </div>
          ) : isDelivered ? (
            <p className="text-sm text-white/65">Hidden after delivery is completed.</p>
          ) : (
            <p className="text-sm text-white/65">Not available for this order.</p>
          )}
        </div>
      </div>

      {(order.pickupProofImage || order.dropProofImage) && (
        <div className={`${sectionPanelClass} mt-6`}>
          <DetailSectionHeader
            icon="mdi:image-search-outline"
            eyebrow="Proofs"
            title="Verification Proofs"
            description="Pickup and drop handoff images for this shipment."
            action={
              <button
                type="button"
                onClick={() => setIsProofModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-md border border-[#6A774F] bg-[#25311E] px-2.5 py-1 text-xs font-medium text-[#F6FF6A] hover:bg-[#2D3A24]"
              >
                <Icon icon="mdi:magnify-plus-outline" className="text-sm" />
                View Full Images
              </button>
            }
          />
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm text-white/80">Pickup Proof</p>
              {order.pickupProofImage ? (
                <button
                  type="button"
                  onClick={() => setIsProofModalOpen(true)}
                  className="block w-full text-left"
                >
                  <Image
                    src={order.pickupProofImage}
                    alt="Pickup proof"
                    width={480}
                    height={240}
                    className="h-40 w-full rounded-lg border border-white/15 object-cover transition hover:opacity-90"
                  />
                </button>
              ) : (
                <div className="dashboard-surface-soft flex h-40 items-center justify-center rounded-lg text-sm text-white/50">
                  Not uploaded
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm text-white/80">Drop Proof</p>
              {order.dropProofImage ? (
                <button
                  type="button"
                  onClick={() => setIsProofModalOpen(true)}
                  className="block w-full text-left"
                >
                  <Image
                    src={order.dropProofImage}
                    alt="Drop proof"
                    width={480}
                    height={240}
                    className="h-40 w-full rounded-lg border border-white/15 object-cover transition hover:opacity-90"
                  />
                </button>
              ) : (
                <div className="dashboard-surface-soft flex h-40 items-center justify-center rounded-lg text-sm text-white/50">
                  Not uploaded
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className={sectionPanelClass}>
          <DetailSectionHeader
            icon="mdi:map-marker-radius-outline"
            eyebrow="Route"
            title="Pickup"
            description="Origin location and admin editing controls."
          />
          {canEditAsAdminNow ? (
            <div className="space-y-2">
              {locationOptions.length > 0 ? (
                <select
                  value={pickupDraft._id || pickupDraft.id || ""}
                  onChange={(event) => {
                    const selected = locationOptions.find((location) => location._id === event.target.value);
                    if (!selected) return;
                    setPickupDraft({
                      ...pickupDraft,
                      _id: selected._id,
                      id: selected._id,
                      name: selected.name,
                      address: selected.address,
                      city: selected.city,
                      state: selected.state,
                      zip: selected.zip,
                    });
                  }}
                  className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
                >
                  <option value="" className="bg-[#121811] text-white">
                    Select pickup point
                  </option>
                  {locationOptions.map((location) => (
                    <option key={location._id} value={location._id} className="bg-[#121811] text-white">
                      {location.name} - {location.city}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                value={pickupDraft.name}
                onChange={(event) => setPickupDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Pickup name"
                className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
              />
              <input
                value={pickupDraft.address}
                onChange={(event) => setPickupDraft((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Pickup address"
                className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={pickupDraft.city}
                  onChange={(event) => setPickupDraft((prev) => ({ ...prev, city: event.target.value }))}
                  placeholder="City"
                  className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
                />
                <input
                  value={pickupDraft.state}
                  onChange={(event) => setPickupDraft((prev) => ({ ...prev, state: event.target.value }))}
                  placeholder="State"
                  className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
                />
              </div>
            </div>
          ) : (
            <>
              <p className="font-semibold text-white">{order.pickupLocation.name || "--"}</p>
              <p className="text-sm text-white/75">
                {[order.pickupLocation.address, order.pickupLocation.city, order.pickupLocation.state]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </>
          )}
        </div>
        <div className={sectionPanelClass}>
          <DetailSectionHeader
            icon="mdi:map-marker-check-outline"
            eyebrow="Route"
            title="Drop"
            description="Destination location and admin editing controls."
          />
          {canEditAsAdminNow ? (
            <div className="space-y-2">
              {locationOptions.length > 0 ? (
                <select
                  value={dropDraft._id || dropDraft.id || ""}
                  onChange={(event) => {
                    const selected = locationOptions.find((location) => location._id === event.target.value);
                    if (!selected) return;
                    setDropDraft({
                      ...dropDraft,
                      _id: selected._id,
                      id: selected._id,
                      name: selected.name,
                      address: selected.address,
                      city: selected.city,
                      state: selected.state,
                      zip: selected.zip,
                    });
                  }}
                  className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
                >
                  <option value="" className="bg-[#121811] text-white">
                    Select drop point
                  </option>
                  {locationOptions.map((location) => (
                    <option key={location._id} value={location._id} className="bg-[#121811] text-white">
                      {location.name} - {location.city}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                value={dropDraft.name}
                onChange={(event) => setDropDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Drop name"
                className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
              />
              <input
                value={dropDraft.address}
                onChange={(event) => setDropDraft((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Drop address"
                className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={dropDraft.city}
                  onChange={(event) => setDropDraft((prev) => ({ ...prev, city: event.target.value }))}
                  placeholder="City"
                  className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
                />
                <input
                  value={dropDraft.state}
                  onChange={(event) => setDropDraft((prev) => ({ ...prev, state: event.target.value }))}
                  placeholder="State"
                  className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
                />
              </div>
            </div>
          ) : (
            <>
              <p className="font-semibold text-white">{order.dropLocation.name || "--"}</p>
              <p className="text-sm text-white/75">
                {[order.dropLocation.address, order.dropLocation.city, order.dropLocation.state]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </>
          )}
        </div>
      </div>

      <div className={`${sectionPanelClass} mt-6`}>
        <DetailSectionHeader
          icon="mdi:account-group-outline"
          eyebrow="Parties"
          title="Sender / Receiver Info"
          description="Names, phone numbers, and customer contact data for this shipment."
        />

        {isAdminView && !order.canAdminEditOrder && (
          <p className="mb-3 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Admin edits are available only until 1 hour before bus start time.
          </p>
        )}
        {isAdminView && order.canAdminEditOrder && !adminEditMode ? (
          <p className="dashboard-surface-soft mb-3 rounded-lg px-3 py-2 text-xs text-white/70">
            Enable update mode from top-right to edit sender/receiver, pickup/drop, packages and transfer bus.
          </p>
        ) : null}
        {isOrderOwner && !order.canUserEditContacts && (
          <p className="mb-3 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Contact editing is available only until 3 hours before bus start time.
          </p>
        )}

        {isAdminView ? (
          <div className="dashboard-surface-soft mb-4 rounded-2xl p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Customer Email</p>
            {canEditAsAdminNow ? (
              <input
                type="email"
                value={customerEmailDraft}
                onChange={(event) => setCustomerEmailDraft(event.target.value)}
                placeholder="customer@example.com"
                className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
              />
            ) : (
              <p className="text-sm text-white">{order.customerEmail || "--"}</p>
            )}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="dashboard-surface-soft rounded-2xl p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Sender Info</p>
            {canEditContacts ? (
              <div className="space-y-2">
                <input
                  value={toStringValue(senderDraft.name ?? senderDraft.senderName)}
                  onChange={(event) =>
                    setSenderDraft((prev) => ({ ...prev, name: event.target.value, senderName: event.target.value }))
                  }
                  placeholder="Sender name"
                  className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
                />
                <input
                  value={toStringValue(senderDraft.contact ?? senderDraft.senderContact)}
                  onChange={(event) =>
                    setSenderDraft((prev) => {
                      const nextContact = formatIndiaPhoneInput(event.target.value);
                      return { ...prev, contact: nextContact, senderContact: nextContact, phone: nextContact };
                    })
                  }
                  placeholder="+91 9876543210"
                  className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
                />
              </div>
            ) : (
              <>
                <p className="text-sm text-white">{personInfoName(order.senderInfo, "--")}</p>
                <p className="text-sm text-white/75">{personInfoPhone(order.senderInfo, "--")}</p>
              </>
            )}
            {canCallPartyContacts && telHref(personInfoPhone(order.senderInfo, "")) ? (
              <a
                href={telHref(personInfoPhone(order.senderInfo, ""))}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25"
              >
                <Icon icon="mdi:phone" className="text-sm" />
                Call Sender
              </a>
            ) : null}
          </div>
          <div className="dashboard-surface-soft rounded-2xl p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Receiver Info</p>
            {canEditAsAdminNow ? (
              <div className="space-y-2">
                <input
                  value={toStringValue(receiverDraft.name ?? receiverDraft.receiverName)}
                  onChange={(event) =>
                    setReceiverDraft((prev) => ({ ...prev, name: event.target.value, receiverName: event.target.value }))
                  }
                  placeholder="Receiver name"
                  className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
                />
                <input
                  value={toStringValue(receiverDraft.contact ?? receiverDraft.receiverContact)}
                  onChange={(event) =>
                    setReceiverDraft((prev) => {
                      const nextContact = formatIndiaPhoneInput(event.target.value);
                      return { ...prev, contact: nextContact, receiverContact: nextContact, phone: nextContact };
                    })
                  }
                  placeholder="+91 9876543210"
                  className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
                />
              </div>
            ) : canEditAsOwner ? (
              <div className="space-y-2">
                <p className="dashboard-surface-soft rounded-lg px-3 py-2 text-sm text-white/80">
                  {personInfoName(order.receiverInfo, "--")}
                </p>
                <input
                  value={toStringValue(receiverDraft.contact ?? receiverDraft.receiverContact)}
                  onChange={(event) =>
                    setReceiverDraft((prev) => {
                      const nextContact = formatIndiaPhoneInput(event.target.value);
                      return { ...prev, contact: nextContact, receiverContact: nextContact, phone: nextContact };
                    })
                  }
                  placeholder="+91 9876543210"
                  className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
                />
              </div>
            ) : (
              <>
                <p className="text-sm text-white">{personInfoName(order.receiverInfo, "--")}</p>
                <p className="text-sm text-white/75">{personInfoPhone(order.receiverInfo, "--")}</p>
              </>
            )}
            {canCallPartyContacts && telHref(personInfoPhone(order.receiverInfo, "")) ? (
              <a
                href={telHref(personInfoPhone(order.receiverInfo, ""))}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25"
              >
                <Icon icon="mdi:phone" className="text-sm" />
                Call Receiver
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {(isAdminView || order.operatorNote || order.customerNote) && (
        <div className={`${sectionPanelClass} mt-6`}>
          <DetailSectionHeader
            icon="mdi:note-text-outline"
            eyebrow="Notes"
            title="Order Notes"
            description="Shared notes for admins, operators, and customers based on role."
          />
          {isAdminView && adminEditMode ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-white/60">Note For Operator</p>
                  <textarea
                    rows={4}
                    value={operatorNoteDraft}
                    onChange={(event) => setOperatorNoteDraft(event.target.value)}
                    placeholder="Visible to operator and admin"
                    className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-white/60">Note For Customer</p>
                  <textarea
                    rows={4}
                    value={customerNoteDraft}
                    onChange={(event) => setCustomerNoteDraft(event.target.value)}
                    placeholder="Visible to customer and admin only"
                    className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveAdminNotes}
                  disabled={savingAdminNotes}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#6A774F] bg-[#25311E] px-3 py-2 text-xs font-semibold text-[#F6FF6A] hover:bg-[#2D3A24] disabled:opacity-60"
                >
                  <Icon icon={savingAdminNotes ? "line-md:loading-loop" : "mdi:note-edit-outline"} className="text-sm" />
                  {savingAdminNotes ? "Saving..." : "Save Notes"}
                </button>
              </div>
            </>
          ) : isAdminView ? (
            <div className="grid gap-3 md:grid-cols-2">
              <p className="dashboard-surface-soft rounded-lg px-3 py-2 text-sm text-white/85">
                {order.operatorNote || "No note for operator."}
              </p>
              <p className="dashboard-surface-soft rounded-lg px-3 py-2 text-sm text-white/85">
                {order.customerNote || "No note for customer."}
              </p>
            </div>
          ) : user?.role === "operator" ? (
            <p className="dashboard-surface-soft rounded-lg px-3 py-2 text-sm text-white/85">
              {order.operatorNote || "No note for operator."}
            </p>
          ) : (
            <p className="dashboard-surface-soft rounded-lg px-3 py-2 text-sm text-white/85">
              {order.customerNote || "No note for customer."}
            </p>
          )}
        </div>
      )}

      {Array.isArray(order.reports) && order.reports.length > 0 ? (
        <div className={`${sectionPanelClass} mt-6`}>
          <DetailSectionHeader
            icon="mdi:clipboard-alert-outline"
            eyebrow="Operations"
            title="Order Reports"
            description="Reports shared on this order by the operator, customer, or refund actions."
          />
          <div className="space-y-3">
            {order.reports.map((report, index) => (
              <div key={`${report.reportType}-${report.createdAt}-${index}`} className="dashboard-surface-soft rounded-xl p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {report.title || prettifyReason(report.category || report.reportType)}
                    </p>
                    <p className="mt-1 text-xs text-white/55">
                      {prettifyReason(report.createdByRole)} | {report.createdAt ? formatDate(report.createdAt) : "--"}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-white/60">
                    {prettifyReason(report.reportType)}
                  </span>
                </div>
                {report.description ? (
                  <p className="mt-3 text-sm text-white/80">{report.description}</p>
                ) : null}
                {report.data?.refundAmount || report.data?.officeAction || report.data?.policyLabel ? (
                  <div className="mt-3 grid gap-2 text-xs text-white/65 sm:grid-cols-2">
                    {report.data?.refundAmount ? (
                      <p>Refund: {formatMoney(toNumberValue(report.data.refundAmount))}</p>
                    ) : null}
                    {report.data?.policyLabel ? <p>Policy: {toStringValue(report.data.policyLabel)}</p> : null}
                    {report.data?.officeAction ? <p>Office Action: {toStringValue(report.data.officeAction)}</p> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <section className={`${sectionPanelClass} mt-6`}>
        <DetailSectionHeader
          icon="mdi:package-variant-closed"
          eyebrow="Packages"
          title="Complete Package Information"
          description="Full package list with images, measurements, and editable fields for admin update mode."
          action={
            isAdminView && adminEditMode ? (
              <button
                type="button"
                onClick={addPackageDraft}
                className="inline-flex items-center gap-1 rounded-lg border border-[#6A774F] bg-[#25311E] px-3 py-1.5 text-xs font-semibold text-[#F6FF6A] hover:bg-[#2D3A24]"
              >
                <Icon icon="mdi:plus" className="text-sm" />
                Add Package
              </button>
            ) : undefined
          }
        />

        {isAdminView && adminEditMode ? (
          <div className="mb-4 rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
            <div className="max-w-sm">
              <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Order Date</p>
              <CustomDatePicker
                value={orderDateDraft}
                onChange={(value) => syncOrderAndPackageDates(value)}
                placeholder="Select order date"
                restrictToAvailableDates={false}
                syncWithCartDate={false}
                disablePastDates={false}
              />
            </div>
            <p className="mt-2 text-xs text-white/55">
              This updates the shipment date used for route validation and capacity allocation.
            </p>
          </div>
        ) : null}

        {displayedPackages.length === 0 ? (
          <div className="rounded-[1.35rem] border border-dashed border-white/12 bg-white/5 p-5 text-white/70">
            No package details available.
          </div>
        ) : (
          <div className="space-y-4">
            {displayedPackages.map((pkg, index) => {
              const extraFields = packageExtraFields(pkg);
              return (
                <article
                  key={pkg.id || String(index)}
                  className="group relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(140deg,rgba(245,248,191,0.08),rgba(26,33,21,0.84)_32%,rgba(13,17,11,0.96))] p-4 shadow-[0_20px_55px_rgba(0,0,0,0.22)]"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(205,214,69,0.16),transparent_72%)] opacity-0 transition duration-300 group-hover:opacity-100" />
                  <div className="grid gap-4 md:grid-cols-[170px_1fr]">
                    <div className="dashboard-subsurface relative h-44 overflow-hidden rounded-xl">
                      {pkg.packageImage ? (
                        <Image
                          src={pkg.packageImage}
                          alt={pkg.packageName}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[#CDD645]">
                          <Icon icon="mdi:package-variant-closed" className="text-6xl" />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        {isAdminView && adminEditMode ? (
                          <input
                            value={pkg.packageName}
                            onChange={(event) => updatePackageDraft(index, { packageName: event.target.value })}
                            placeholder="Package name"
                            className="dashboard-input w-full rounded-lg px-3 py-2 text-sm font-semibold focus:border-[#CDD645]/65"
                          />
                        ) : (
                          <h3 className="text-lg font-semibold text-white">{pkg.packageName}</h3>
                        )}
                        <span className="rounded-full bg-[#CDD645]/20 px-3 py-1 text-xs text-[#F6FF6A]">
                          Qty {pkg.packageQuantities}
                        </span>
                      </div>

                      {isAdminView && adminEditMode ? (
                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                          <input
                            value={pkg.packageType}
                            onChange={(event) => updatePackageDraft(index, { packageType: event.target.value })}
                            placeholder="Package type"
                            className="dashboard-input rounded-lg px-3 py-2 text-white focus:border-[#CDD645]/65"
                          />
                          <input
                            value={pkg.packageSize}
                            onChange={(event) => updatePackageDraft(index, { packageSize: event.target.value })}
                            placeholder="Package size"
                            className="dashboard-input rounded-lg px-3 py-2 text-white focus:border-[#CDD645]/65"
                          />
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            value={pkg.packageWeight}
                            onChange={(event) =>
                              updatePackageDraft(index, { packageWeight: toNumberValue(event.target.value) })
                            }
                            placeholder="Weight (kg)"
                            className="dashboard-input rounded-lg px-3 py-2 text-white focus:border-[#CDD645]/65"
                          />
                          <input
                            type="number"
                            min={1}
                            value={pkg.packageQuantities}
                            onChange={(event) =>
                              updatePackageDraft(index, {
                                packageQuantities: Math.max(1, toNumberValue(event.target.value, 1)),
                              })
                            }
                            placeholder="Quantity"
                            className="dashboard-input rounded-lg px-3 py-2 text-white focus:border-[#CDD645]/65"
                          />
                          <CustomDatePicker
                            value={pkg.pickUpDate ? String(pkg.pickUpDate).slice(0, 10) : ""}
                            onChange={(value) => syncOrderAndPackageDates(value)}
                            placeholder="Pickup date"
                            restrictToAvailableDates={false}
                            syncWithCartDate={false}
                            disablePastDates={false}
                          />
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={toNumberValue(pkg.price)}
                            onChange={(event) =>
                              updatePackageDraft(index, { price: Math.max(0, toNumberValue(event.target.value)) })
                            }
                            placeholder="Price (optional)"
                            className="dashboard-input rounded-lg px-3 py-2 text-white focus:border-[#CDD645]/65"
                          />
                        </div>
                      ) : (
                        <div className="grid gap-2 text-sm text-white/80 sm:grid-cols-2">
                          <p>
                            <span className="text-white/50">Type:</span> {pkg.packageType || "--"}
                          </p>
                          <p>
                            <span className="text-white/50">Size:</span> {pkg.packageSize || "--"}
                          </p>
                          <p>
                            <span className="text-white/50">Weight:</span> {pkg.packageWeight} kg
                          </p>
                          <p>
                            <span className="text-white/50">Pickup Date:</span>{" "}
                            {pkg.pickUpDate || "--"}
                          </p>
                        </div>
                      )}

                      {isAdminView && adminEditMode ? (
                        <textarea
                          rows={3}
                          value={pkg.description}
                          onChange={(event) => updatePackageDraft(index, { description: event.target.value })}
                          placeholder="Description"
                          className="dashboard-input mt-3 w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
                        />
                      ) : pkg.description ? (
                        <p className="mt-3 text-sm text-white/80">
                          <span className="text-white/50">Description:</span> {pkg.description}
                        </p>
                      ) : null}

                      {extraFields.length > 0 ? (
                        <div className="mt-3 grid gap-2 text-sm text-white/75 sm:grid-cols-2">
                          {extraFields.map((field) => (
                            <p key={field.key}>
                              <span className="text-white/50">{field.label}:</span> {field.value}
                            </p>
                          ))}
                        </div>
                      ) : null}

                      {isAdminView && adminEditMode ? (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removePackageDraft(index)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/20"
                          >
                            <Icon icon="mdi:delete-outline" className="text-sm" />
                            Remove Package
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {isProofModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setIsProofModalOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-6xl dashboard-surface rounded-2xl p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Verification proofs"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#F6FF6A]">Verification Proofs</h3>
              <button
                type="button"
                onClick={() => setIsProofModalOpen(false)}
                className="rounded-md border border-white/20 p-1.5 text-white/80 hover:border-[#CDD645] hover:text-[#CDD645]"
                aria-label="Close proof modal"
              >
                <Icon icon="mdi:close" className="text-lg" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm text-white/80">Pickup Proof</p>
                {order.pickupProofImage ? (
                  <Image
                    src={order.pickupProofImage}
                    alt="Pickup proof full"
                    width={1600}
                    height={1000}
                    className="max-h-[72vh] w-full rounded-xl border border-white/10 bg-white/5 object-contain"
                  />
                ) : (
                  <div className="dashboard-surface-soft flex h-72 items-center justify-center rounded-xl text-sm text-white/55">
                    Pickup proof not uploaded
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm text-white/80">Drop Proof</p>
                {order.dropProofImage ? (
                  <Image
                    src={order.dropProofImage}
                    alt="Drop proof full"
                    width={1600}
                    height={1000}
                    className="max-h-[72vh] w-full rounded-xl border border-white/10 bg-white/5 object-contain"
                  />
                ) : (
                  <div className="dashboard-surface-soft flex h-72 items-center justify-center rounded-xl text-sm text-white/55">
                    Drop proof not uploaded
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmationModal
        isOpen={cancelOrderConfirmOpen}
        title={isAdminView ? "Cancel Order" : "Cancel Booking"}
        description={
          isAdminView
            ? "Create a cancellation report, choose refund behavior, and cancel this order."
            : `Confirm this booking cancellation. A fixed ${CUSTOMER_CANCELLATION_DEDUCTION_PERCENT}% deduction will be applied to the refund amount.`
        }
        confirmLabel={cancellingOrder ? "Cancelling..." : isAdminView ? "Cancel Order" : "Cancel Booking"}
        confirmVariant="danger"
        isLoading={cancellingOrder}
        onClose={() => {
          if (cancellingOrder) return;
          setCancelOrderConfirmOpen(false);
        }}
        onConfirm={async () => {
          await cancelOrder();
          setCancelOrderConfirmOpen(false);
        }}
      >
        {isAdminView ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Reason</p>
              <select
                value={cancelReasonCode}
                onChange={(event) => setCancelReasonCode(event.target.value)}
                className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
              >
                <option value="customer_request" className="bg-[#121811] text-white">Customer Request</option>
                <option value="service_issue" className="bg-[#121811] text-white">Service Issue</option>
                <option value="duplicate_order" className="bg-[#121811] text-white">Duplicate Order</option>
                <option value="vehicle_issue" className="bg-[#121811] text-white">Vehicle Issue</option>
                <option value="route_issue" className="bg-[#121811] text-white">Route Issue</option>
                <option value="other" className="bg-[#121811] text-white">Other</option>
              </select>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Cancellation Report</p>
              <textarea
                rows={4}
                value={cancelReasonDescription}
                onChange={(event) => setCancelReasonDescription(event.target.value)}
                placeholder="Add the admin cancellation report details for the team and customer context."
                className="dashboard-input w-full rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]/65"
              />
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Refund Mode</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setCancelRefundMode("deduction_policy");
                    setCancelDeductionPercent(toNumberValue(order?.refundPreview?.deductionPercent));
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm text-left ${
                    cancelRefundMode === "deduction_policy"
                      ? "border-[#CDD645]/45 bg-[#CDD645]/12 text-[#F6FF6A]"
                      : "border-white/10 bg-white/5 text-white/75"
                  }`}
                >
                  Deduction Policy
                </button>
                <button
                  type="button"
                  onClick={() => setCancelRefundMode("full_refund")}
                  className={`rounded-lg border px-3 py-2 text-sm text-left ${
                    cancelRefundMode === "full_refund"
                      ? "border-[#CDD645]/45 bg-[#CDD645]/12 text-[#F6FF6A]"
                      : "border-white/10 bg-white/5 text-white/75"
                  }`}
                >
                  Full Refund
                </button>
              </div>
            </div>
            {cancelRefundMode === "deduction_policy" && cancelPreview ? (
              <div className="rounded-xl border border-[#CDD645]/20 bg-[linear-gradient(180deg,rgba(205,214,69,0.08),rgba(255,255,255,0.03))] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-white/50">Deduction Control</p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/80">
                    {cancelDeductionPercent.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#34d399,#facc15,#f97316)] transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, cancelDeductionPercent))}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={cancelDeductionPercent}
                  onChange={(event) => setCancelDeductionPercent(toNumberValue(event.target.value))}
                  className="mt-4 w-full accent-[#CDD645]"
                />
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="dashboard-surface-soft rounded-lg p-3">
                    <p className="text-xs text-white/50">Collected</p>
                    <p className="text-sm text-white">{formatMoney(toNumberValue(cancelPreview.baseAmount))}</p>
                  </div>
                  <div className="dashboard-surface-soft rounded-lg p-3">
                    <p className="text-xs text-white/50">Deduction</p>
                    <p className="text-sm text-white">{formatMoney(toNumberValue(cancelPreview.deductionAmount))}</p>
                  </div>
                  <div className="dashboard-surface-soft rounded-lg p-3">
                    <p className="text-xs text-white/50">Refund</p>
                    <p className="text-sm font-semibold text-[#F6FF6A]">{formatMoney(toNumberValue(cancelPreview.refundAmount))}</p>
                  </div>
                </div>
              </div>
            ) : null}
            {cancelPreview ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">Refund Preview</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="dashboard-surface-soft rounded-lg p-3">
                    <p className="text-xs text-white/50">Collected Amount</p>
                    <p className="text-sm text-white">{formatMoney(toNumberValue(cancelPreview.baseAmount))}</p>
                  </div>
                  <div className="dashboard-surface-soft rounded-lg p-3">
                    <p className="text-xs text-white/50">Refund</p>
                    <p className="text-sm text-white">{formatMoney(toNumberValue(cancelPreview.refundAmount))}</p>
                  </div>
                  <div className="dashboard-surface-soft rounded-lg p-3">
                    <p className="text-xs text-white/50">Deduction</p>
                    <p className="text-sm text-white">
                      {formatMoney(toNumberValue(cancelPreview.deductionAmount))} ({toNumberValue(cancelPreview.deductionPercent)}%)
                    </p>
                  </div>
                  <div className="dashboard-surface-soft rounded-lg p-3">
                    <p className="text-xs text-white/50">Timing</p>
                    <p className="text-sm text-white">{formatHoursUntilStart(cancelPreview.hoursUntilStart)}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-white/65">{cancelPreview.policyLabel}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Reason</p>
              <select
                value="customer_request"
                disabled
                className="dashboard-input w-full cursor-not-allowed rounded-lg px-3 py-2 text-sm opacity-75"
              >
                <option value="customer_request" className="bg-[#121811] text-white">Customer Request</option>
              </select>
            </div>
            {cancelPreview ? (
              <div className="rounded-xl border border-[#CDD645]/20 bg-[linear-gradient(180deg,rgba(205,214,69,0.08),rgba(255,255,255,0.03))] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#F6FF6A]">Customer Cancellation Refund</p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/80">
                    Deduction {CUSTOMER_CANCELLATION_DEDUCTION_PERCENT}%
                  </span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#ef4444,#f59e0b,#34d399)]"
                    style={{ width: `${CUSTOMER_CANCELLATION_DEDUCTION_PERCENT}%` }}
                  />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="dashboard-surface-soft rounded-lg p-3">
                    <p className="text-xs text-white/50">Refund Base</p>
                    <p className="text-sm text-white">{formatMoney(toNumberValue(cancelPreview.baseAmount))}</p>
                  </div>
                  <div className="dashboard-surface-soft rounded-lg p-3">
                    <p className="text-xs text-white/50">Deduction</p>
                    <p className="text-sm text-white">{formatMoney(toNumberValue(cancelPreview.deductionAmount))}</p>
                  </div>
                  <div className="dashboard-surface-soft rounded-lg p-3">
                    <p className="text-xs text-white/50">Refund Amount</p>
                    <p className="text-sm font-semibold text-[#F6FF6A]">{formatMoney(toNumberValue(cancelPreview.refundAmount))}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-white/65">
                  Cancelling this booking applies a fixed {CUSTOMER_CANCELLATION_DEDUCTION_PERCENT}% deduction to the refund amount.
                </p>
              </div>
            ) : (
              <p className="text-sm text-white/65">Refund details will appear once the booking can be cancelled.</p>
            )}
          </div>
        )}
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={cancellationRefundConfirmOpen}
        onClose={() => setCancellationRefundConfirmOpen(false)}
        onConfirm={processCancellationRefund}
        title="Admin: Process Missing Pickup Refund"
        confirmLabel="Confirm Refund"
        confirmVariant="success"
        isLoading={processingCancellationRefund}
      >
        <p className="text-sm text-white/65">
          The operator reported the sender was missing at the pickup location. You are releasing the <strong>locked refund</strong> back to the user.
        </p>
        <div className="mt-4 rounded-[1.25rem] border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-emerald-100">Customer not at pickup</p>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-100 uppercase tracking-widest">
              Fixed 10% Waiver
            </span>
          </div>
          <div className="mt-3 dashboard-surface-soft p-3 rounded-lg text-sm text-white flex justify-between">
            <span className="text-white/50">Total Paid</span>
            <span>{formatMoney(toNumberValue(order?.cancellationDetails?.refundBaseAmount))}</span>
          </div>
          <div className="mt-2 dashboard-surface-soft p-3 rounded-lg text-sm text-rose-200 flex justify-between">
            <span className="text-rose-300/80">Penalty (10%)</span>
            <span>- {formatMoney(Math.round(toNumberValue(order?.cancellationDetails?.refundBaseAmount) * 0.1 * 100) / 100)}</span>
          </div>
          <div className="mt-2 dashboard-surface-soft p-3 rounded-lg text-sm font-semibold text-[#F6FF6A] flex justify-between border border-[#CDD645]/20 bg-[#CDD645]/5">
            <span>Final Gateway Refund</span>
            <span>{formatMoney(Math.round(toNumberValue(order?.cancellationDetails?.refundBaseAmount) * 0.9 * 100) / 100)}</span>
          </div>
        </div>
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={missedRefundConfirmOpen}
        title="Send Missed Package Refund"
        description="Reason is locked to missed package. Adjust the waiver percentage, review the refund, and confirm."
        confirmLabel={processingMissedRefund ? "Sending..." : "Confirm Refund"}
        confirmVariant="success"
        isLoading={processingMissedRefund}
        onClose={() => {
          if (processingMissedRefund) return;
          setMissedRefundConfirmOpen(false);
        }}
        onConfirm={async () => {
          await processMissedPackageRefund();
          setMissedRefundConfirmOpen(false);
        }}
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Reason</p>
            <select
              value="missed_package"
              disabled
              className="dashboard-input w-full cursor-not-allowed rounded-lg px-3 py-2 text-sm opacity-75"
            >
              <option value="missed_package" className="bg-[#121811] text-white">Missed Package</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-white/50">Waiver Percentage</p>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/80">
              {missedRefundWaiverPercent.toFixed(0)}%
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#34d399,#facc15,#f97316)] transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, missedRefundWaiverPercent))}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={missedRefundWaiverPercent}
            onChange={(event) => setMissedRefundWaiverPercent(toNumberValue(event.target.value))}
            className="w-full accent-[#CDD645]"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="dashboard-surface-soft rounded-lg p-3">
              <p className="text-xs text-white/50">Refund Base</p>
              <p className="text-sm text-white">{formatMoney(missedRefundBaseAmount)}</p>
            </div>
            <div className="dashboard-surface-soft rounded-lg p-3">
              <p className="text-xs text-white/50">Waiver Amount</p>
              <p className="text-sm text-white">{formatMoney(missedRefundPreviewWaiverAmount)}</p>
            </div>
            <div className="dashboard-surface-soft rounded-lg p-3">
              <p className="text-xs text-white/50">Refund to Send</p>
              <p className="text-sm font-semibold text-[#F6FF6A]">{formatMoney(missedRefundPreviewAmount)}</p>
            </div>
          </div>
        </div>
      </ConfirmationModal>

      {requiresStaffPhone ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" />
          <div className="dashboard-surface relative w-full max-w-md rounded-2xl p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-[#F6FF6A]">Add Contact Number</h2>
            <p className="mt-2 text-sm text-white/75">
              Add your contact number first. This is required for admin/operator workflows.
            </p>
            <input
              type="tel"
              value={requiredPhoneDraft}
              onChange={(event) => setRequiredPhoneDraft(formatIndiaPhoneInput(event.target.value))}
              placeholder="+91 9876543210"
              className="mt-4 w-full dashboard-input rounded-lg px-3 py-2 text-sm focus:border-[#CDD645]"
            />
            {requiredPhoneError ? (
              <p className="mt-2 text-xs text-red-300">{requiredPhoneError}</p>
            ) : null}
            <button
              type="button"
              onClick={saveRequiredPhone}
              disabled={savingRequiredPhone}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#6A774F] bg-[#25311E] px-3 py-2 text-sm font-semibold text-[#F6FF6A] hover:bg-[#2D3A24] disabled:opacity-60"
            >
              <Icon icon={savingRequiredPhone ? "line-md:loading-loop" : "mdi:content-save-outline"} className="text-sm" />
              {savingRequiredPhone ? "Saving..." : "Save Contact Number"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
