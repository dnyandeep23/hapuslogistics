"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { useToast } from "@/context/ToastContext";
import { downloadOrderInvoice } from "@/lib/orderInvoice";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { fetchUser } from "@/lib/redux/userSlice";
import Skeleton from "@/components/Skeleton";

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

function getStatusBadge(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "delivered") return "bg-green-500/20 text-green-300 border-green-500/40";
  if (normalized === "in-transit") return "bg-blue-500/20 text-blue-300 border-blue-500/40";
  if (normalized === "cancelled") return "bg-red-500/20 text-red-300 border-red-500/40";
  return "bg-amber-500/20 text-amber-300 border-amber-500/40";
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
};

type RazorpayCheckoutInstance = {
  open: () => void;
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
  const [savingContacts, setSavingContacts] = useState(false);
  const [savingAdminNotes, setSavingAdminNotes] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [requiredPhoneDraft, setRequiredPhoneDraft] = useState("");
  const [requiredPhoneError, setRequiredPhoneError] = useState("");
  const [savingRequiredPhone, setSavingRequiredPhone] = useState(false);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [transferBusIdDraft, setTransferBusIdDraft] = useState("");
  const [transferringBus, setTransferringBus] = useState(false);
  const [adminEditMode, setAdminEditMode] = useState(false);
  const [processingAdjustmentPayment, setProcessingAdjustmentPayment] = useState(false);

  const orderId = useMemo(() => {
    const id = params?.orderId;
    return typeof id === "string" ? id : "";
  }, [params]);

  const applyOrderToState = (mappedOrder: OrderDetail) => {
    setOrder(mappedOrder);
    setSenderDraft(mappedOrder.senderInfo || {});
    setReceiverDraft(mappedOrder.receiverInfo || {});
    setPackageDrafts(mappedOrder.packages || []);
    setPickupDraft(mappedOrder.pickupLocation);
    setDropDraft(mappedOrder.dropLocation);
    setOperatorNoteDraft(mappedOrder.operatorNote || "");
    setCustomerNoteDraft(mappedOrder.customerNote || "");
    setCustomerEmailDraft(mappedOrder.customerEmail || "");
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
    if (!(user?.role === "admin" || user?.isSuperAdmin)) {
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
  }, [user?.role, user?.isSuperAdmin]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-5 space-y-4">
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
        <div className="rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-5 space-y-3">
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

  const isAdminView = Boolean(user?.role === "admin" || user?.isSuperAdmin);
  const isOperatorView = Boolean(user?.role === "operator");
  const canCallPartyContacts = isAdminView || isOperatorView;
  const isOrderOwner = Boolean(user?.role === "user" && !user?.isSuperAdmin);
  const requiresStaffPhone = !isOrderOwner && !String(user?.phone ?? "").trim();
  const canEditAsAdmin = isAdminView && Boolean(order.canAdminEditOrder);
  const canEditAsAdminNow = canEditAsAdmin && adminEditMode;
  const canEditAsOwner = isOrderOwner && Boolean(order.canUserEditContacts);
  const canEditContacts = canEditAsAdminNow || canEditAsOwner;
  const transferCandidates = order.transferCandidates ?? [];
  const selectedTransferBus = transferCandidates.find((candidate) => candidate.id === transferBusIdDraft) || null;
  const displayedPackages = isAdminView ? packageDrafts : order.packages;

  const saveRequiredPhone = async () => {
    const phone = requiredPhoneDraft.trim();
    if (!phone) {
      setRequiredPhoneError("Contact number is required.");
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
    try {
      setSavingContacts(true);
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderInfo: senderDraft,
          receiverInfo: receiverDraft,
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
        pickUpDate: "",
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
          addToast("Adjustment payment completed successfully.", "success");
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
      };

      const Razorpay = getRazorpayConstructor();
      if (!Razorpay) {
        addToast("Razorpay checkout failed to initialize.", "error");
        return;
      }
      const rzp = new Razorpay(options);
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

  const cancelOrderAsAdmin = async () => {
    if (!order || !isAdminView) return;
    const shouldCancel = window.confirm("Cancel this order? This action is for admin authority only.");
    if (!shouldCancel) return;

    try {
      setCancellingOrder(true);
      const response = await fetch("/api/dashboard/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          action: "cancel_order",
          operatorNote: operatorNoteDraft,
          customerNote: customerNoteDraft,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        addToast(toStringValue(data?.message, "Failed to cancel order."), "error");
        return;
      }
      addToast("Order cancelled.", "success");
      setOrder((prev) =>
        prev
          ? { ...prev, status: "cancelled", operatorNote: operatorNoteDraft, customerNote: customerNoteDraft }
          : prev,
      );
    } catch (cancelError: unknown) {
      addToast(cancelError instanceof Error ? cancelError.message : "Failed to cancel order.", "error");
    } finally {
      setCancellingOrder(false);
    }
  };

  const statusLower = order.status.toLowerCase();
  const isDelivered = statusLower === "delivered";
  const isCancelled = statusLower === "cancelled";
  const contactRevealTime = addDays(new Date(order.orderDate), -1);
  const hideContactByTime = Boolean(order.contactLocked) || new Date() < contactRevealTime;
  const canShowContact =
    Boolean(order.busContact?.contactPersonNumber || order.busContact?.contactPersonName) &&
    !isDelivered &&
    !isCancelled &&
    !hideContactByTime;
  const supportPhone = toStringValue(order.supportContact?.phone);
  const supportPhoneHref = telHref(supportPhone);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/dashboard/orders")}
          className="inline-flex items-center gap-2 rounded-lg border border-[#5E6A4F] px-3 py-2 text-sm text-white/80 hover:text-white"
        >
          <Icon icon="mdi:arrow-left" />
          Back to Orders
        </button>
        <div className="flex flex-wrap items-center gap-2">
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
              onClick={() => {
                setAdminEditMode(false);
                applyOrderToState(order);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-black/25 px-3 py-2 text-sm font-medium text-white/85 hover:bg-black/40"
            >
              <Icon icon="mdi:close-circle-outline" className="text-base" />
              Cancel Update
            </button>
          ) : null}
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-white/50">Tracking ID</p>
            <p className="font-mono text-sm text-[#F6FF6A]">{order.trackingId}</p>
          </div>
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusBadge(
              order.status
            )}`}
          >
            {order.status}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-[#1F271A] p-3">
            <p className="text-xs text-white/50">Order Date</p>
            <p className="text-sm text-white">{formatDate(order.orderDate)}</p>
          </div>
          <div className="rounded-lg bg-[#1F271A] p-3">
            <p className="text-xs text-white/50">Total Value</p>
            <p className="text-sm text-white">{formatMoney(order.totalAmount)}</p>
          </div>
          <div className="rounded-lg bg-[#1F271A] p-3">
            <p className="text-xs text-white/50">Total Weight</p>
            <p className="text-sm text-white">{order.totalWeightKg} kg</p>
          </div>
          <div className="rounded-lg bg-[#1F271A] p-3">
            <p className="text-xs text-white/50">Packages</p>
            <p className="text-sm text-white">{order.packageCount}</p>
          </div>
        </div>
      </div>

      {(toNumberValue(order.adjustmentPendingAmount) > 0 || toNumberValue(order.adjustmentRefundAmount) > 0) && (
        <div className="mb-5 rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-4">
          <p className="text-xs uppercase tracking-wide text-white/50">Order Amount Adjustment</p>
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

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-white/50">Assigned Bus</p>
            {isAdminView ? (
              <span className="rounded-full border border-[#6A774F] bg-[#25311E] px-2.5 py-1 text-[11px] text-[#F6FF6A]">
                {adminEditMode ? "Transfer enabled" : "View mode"}
              </span>
            ) : null}
          </div>
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
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-white/15 bg-[#1F271A] text-[#F6FF6A]">
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
                    className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
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
                <p className="mt-2 rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white/65">
                  No compatible bus with enough capacity is available right now.
                </p>
              )}
            </div>
          ) : isAdminView ? (
            <p className="mt-3 text-xs text-white/55">Enable update mode to edit/transfer this order.</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Operator Contact</p>
          {canShowContact ? (
            <div className="space-y-1 text-sm text-white">
              <p>{order.busContact?.contactPersonName || "Assigned Operator"}</p>
              <p className="font-mono text-[#F6FF6A]">{order.busContact?.contactPersonNumber}</p>
            </div>
          ) : hideContactByTime && order.busContact ? (
            <div className="relative overflow-hidden rounded-lg border border-white/15 bg-black/25 p-2">
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
        <div className="mb-5 rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-white/50">Verification Proofs</p>
            <button
              type="button"
              onClick={() => setIsProofModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-[#6A774F] bg-[#25311E] px-2.5 py-1 text-xs font-medium text-[#F6FF6A] hover:bg-[#2D3A24]"
            >
              <Icon icon="mdi:magnify-plus-outline" className="text-sm" />
              View Full Images
            </button>
          </div>
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
                <div className="flex h-40 items-center justify-center rounded-lg border border-white/15 bg-black/20 text-sm text-white/50">
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
                <div className="flex h-40 items-center justify-center rounded-lg border border-white/15 bg-black/20 text-sm text-white/50">
                  Not uploaded
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-white/50">Pickup</p>
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
                  className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
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
                className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
              />
              <input
                value={pickupDraft.address}
                onChange={(event) => setPickupDraft((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Pickup address"
                className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={pickupDraft.city}
                  onChange={(event) => setPickupDraft((prev) => ({ ...prev, city: event.target.value }))}
                  placeholder="City"
                  className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
                />
                <input
                  value={pickupDraft.state}
                  onChange={(event) => setPickupDraft((prev) => ({ ...prev, state: event.target.value }))}
                  placeholder="State"
                  className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
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
        <div className="rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-white/50">Drop</p>
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
                  className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
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
                className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
              />
              <input
                value={dropDraft.address}
                onChange={(event) => setDropDraft((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Drop address"
                className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={dropDraft.city}
                  onChange={(event) => setDropDraft((prev) => ({ ...prev, city: event.target.value }))}
                  placeholder="City"
                  className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
                />
                <input
                  value={dropDraft.state}
                  onChange={(event) => setDropDraft((prev) => ({ ...prev, state: event.target.value }))}
                  placeholder="State"
                  className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
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

      <div className="mb-5 rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-white/50">Sender / Receiver Info</p>
          {canEditContacts && (
            <button
              type="button"
              onClick={saveContactChanges}
              disabled={savingContacts}
              className="inline-flex items-center gap-2 rounded-lg border border-[#6A774F] bg-[#25311E] px-3 py-2 text-xs font-semibold text-[#F6FF6A] hover:bg-[#2D3A24] disabled:opacity-60"
            >
              <Icon icon={savingContacts ? "line-md:loading-loop" : "mdi:content-save-outline"} className="text-sm" />
              {savingContacts ? "Saving..." : "Save Order Updates"}
            </button>
          )}
        </div>

        {isAdminView && !order.canAdminEditOrder && (
          <p className="mb-3 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Admin edits are available only until 1 hour before bus start time.
          </p>
        )}
        {isAdminView && order.canAdminEditOrder && !adminEditMode ? (
          <p className="mb-3 rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-xs text-white/70">
            Enable update mode from top-right to edit sender/receiver, pickup/drop, packages and transfer bus.
          </p>
        ) : null}
        {isOrderOwner && !order.canUserEditContacts && (
          <p className="mb-3 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Contact editing is available only until 3 hours before bus start time.
          </p>
        )}

        {isAdminView ? (
          <div className="mb-4 rounded-2xl border border-[#4E5A45] bg-[#23301e] p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Customer Email</p>
            {canEditAsAdminNow ? (
              <input
                type="email"
                value={customerEmailDraft}
                onChange={(event) => setCustomerEmailDraft(event.target.value)}
                placeholder="customer@example.com"
                className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
              />
            ) : (
              <p className="text-sm text-white">{order.customerEmail || "--"}</p>
            )}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#4E5A45] bg-[#23301e] p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Sender Info</p>
            {canEditContacts ? (
              <div className="space-y-2">
                <input
                  value={toStringValue(senderDraft.name ?? senderDraft.senderName)}
                  onChange={(event) =>
                    setSenderDraft((prev) => ({ ...prev, name: event.target.value, senderName: event.target.value }))
                  }
                  placeholder="Sender name"
                  className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
                />
                <input
                  value={toStringValue(senderDraft.contact ?? senderDraft.senderContact)}
                  onChange={(event) =>
                    setSenderDraft((prev) => ({ ...prev, contact: event.target.value, senderContact: event.target.value }))
                  }
                  placeholder="Sender contact"
                  className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
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
          <div className="rounded-2xl border border-[#4E5A45] bg-[#23301e] p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Receiver Info</p>
            {canEditAsAdminNow ? (
              <div className="space-y-2">
                <input
                  value={toStringValue(receiverDraft.name ?? receiverDraft.receiverName)}
                  onChange={(event) =>
                    setReceiverDraft((prev) => ({ ...prev, name: event.target.value, receiverName: event.target.value }))
                  }
                  placeholder="Receiver name"
                  className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
                />
                <input
                  value={toStringValue(receiverDraft.contact ?? receiverDraft.receiverContact)}
                  onChange={(event) =>
                    setReceiverDraft((prev) => ({ ...prev, contact: event.target.value, receiverContact: event.target.value }))
                  }
                  placeholder="Receiver contact"
                  className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
                />
              </div>
            ) : canEditAsOwner ? (
              <div className="space-y-2">
                <p className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/80">
                  {personInfoName(order.receiverInfo, "--")}
                </p>
                <input
                  value={toStringValue(receiverDraft.contact ?? receiverDraft.receiverContact)}
                  onChange={(event) =>
                    setReceiverDraft((prev) => ({ ...prev, contact: event.target.value, receiverContact: event.target.value }))
                  }
                  placeholder="Receiver contact"
                  className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
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
        <div className="mb-5 rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Order Notes</p>
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
                    className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-white/60">Note For Customer</p>
                  <textarea
                    rows={4}
                    value={customerNoteDraft}
                    onChange={(event) => setCustomerNoteDraft(event.target.value)}
                    placeholder="Visible to customer and admin only"
                    className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
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
                {statusLower !== "cancelled" && statusLower !== "delivered" && (
                  <button
                    type="button"
                    onClick={cancelOrderAsAdmin}
                    disabled={cancellingOrder}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-400/45 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-60"
                  >
                    <Icon icon={cancellingOrder ? "line-md:loading-loop" : "mdi:cancel"} className="text-sm" />
                    {cancellingOrder ? "Cancelling..." : "Cancel Order"}
                  </button>
                )}
              </div>
            </>
          ) : isAdminView ? (
            <div className="grid gap-3 md:grid-cols-2">
              <p className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/85">
                {order.operatorNote || "No note for operator."}
              </p>
              <p className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/85">
                {order.customerNote || "No note for customer."}
              </p>
            </div>
          ) : user?.role === "operator" ? (
            <p className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/85">
              {order.operatorNote || "No note for operator."}
            </p>
          ) : (
            <p className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/85">
              {order.customerNote || "No note for customer."}
            </p>
          )}
        </div>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-[#F6FF6A]">Complete Package Information</h2>
          {isAdminView && adminEditMode ? (
            <button
              type="button"
              onClick={addPackageDraft}
              className="inline-flex items-center gap-1 rounded-lg border border-[#6A774F] bg-[#25311E] px-3 py-1.5 text-xs font-semibold text-[#F6FF6A] hover:bg-[#2D3A24]"
            >
              <Icon icon="mdi:plus" className="text-sm" />
              Add Package
            </button>
          ) : null}
        </div>

        {displayedPackages.length === 0 ? (
          <div className="rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-5 text-white/70">
            No package details available.
          </div>
        ) : (
          <div className="space-y-4">
            {displayedPackages.map((pkg, index) => {
              const extraFields = packageExtraFields(pkg);
              return (
                <article
                  key={pkg.id || String(index)}
                  className="rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-4"
                >
                  <div className="grid gap-4 md:grid-cols-[170px_1fr]">
                    <div className="relative h-44 overflow-hidden rounded-xl bg-[#1F271A]">
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
                            className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-[#CDD645]/65"
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
                            className="rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-white outline-none focus:border-[#CDD645]/65"
                          />
                          <input
                            value={pkg.packageSize}
                            onChange={(event) => updatePackageDraft(index, { packageSize: event.target.value })}
                            placeholder="Package size"
                            className="rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-white outline-none focus:border-[#CDD645]/65"
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
                            className="rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-white outline-none focus:border-[#CDD645]/65"
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
                            className="rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-white outline-none focus:border-[#CDD645]/65"
                          />
                          <input
                            type="date"
                            value={pkg.pickUpDate ? String(pkg.pickUpDate).slice(0, 10) : ""}
                            onChange={(event) => updatePackageDraft(index, { pickUpDate: event.target.value })}
                            className="rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-white outline-none focus:border-[#CDD645]/65"
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
                            className="rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-white outline-none focus:border-[#CDD645]/65"
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
                          className="mt-3 w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/65"
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
            className="w-full max-w-6xl rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-4 shadow-2xl"
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
                    className="max-h-[72vh] w-full rounded-xl border border-white/15 bg-black/20 object-contain"
                  />
                ) : (
                  <div className="flex h-72 items-center justify-center rounded-xl border border-white/15 bg-black/20 text-sm text-white/55">
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
                    className="max-h-[72vh] w-full rounded-xl border border-white/15 bg-black/20 object-contain"
                  />
                ) : (
                  <div className="flex h-72 items-center justify-center rounded-xl border border-white/15 bg-black/20 text-sm text-white/55">
                    Drop proof not uploaded
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {requiresStaffPhone ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative w-full max-w-md rounded-2xl border border-[#5E6A4F] bg-[#1F271A] p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-[#F6FF6A]">Add Contact Number</h2>
            <p className="mt-2 text-sm text-white/75">
              Add your contact number first. This is required for admin/operator workflows.
            </p>
            <input
              type="tel"
              value={requiredPhoneDraft}
              onChange={(event) => setRequiredPhoneDraft(event.target.value)}
              placeholder="Enter contact number"
              className="mt-4 w-full rounded-lg border border-[#5E6A4F] bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]"
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
