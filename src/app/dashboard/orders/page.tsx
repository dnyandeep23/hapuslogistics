"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useToast } from "@/context/ToastContext";
import { useRouter, useSearchParams } from "next/navigation";
import { downloadOrderInvoice } from "@/lib/orderInvoice";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { fetchUser } from "@/lib/redux/userSlice";
import Skeleton from "@/components/Skeleton";

interface BusContact {
  _id: string;
  busName: string;
  busNumber: string;
  busImage: string;
  contactPersonName: string;
  contactPersonNumber: string;
}

interface SupportContact {
  name: string;
  phone: string;
}

interface UserDashboardOrder {
  id: string;
  trackingId: string;
  status: string;
  orderDate: string;
  createdAt: string;
  updatedAt: string;
  totalAmount: number;
  totalWeightKg: number;
  pickupLocation: {
    name: string;
    city: string;
    state: string;
  };
  dropLocation: {
    name: string;
    city: string;
    state: string;
  };
  packageCount: number;
  packageNames: string[];
  busContact: BusContact | null;
  supportContact: SupportContact | null;
  contactLocked: boolean;
  pickupProofImage?: string;
  dropProofImage?: string;
}

interface RoleDashboardOrder {
  id: string;
  trackingId: string;
  status: string;
  orderDate: string;
  createdAt: string;
  updatedAt: string;
  totalAmount: number;
  totalWeightKg: number;
  pickupLocation: {
    name: string;
    city: string;
    state: string;
    address?: string;
    zip?: string;
  };
  dropLocation: {
    name: string;
    city: string;
    state: string;
    address?: string;
    zip?: string;
  };
  pickupProofImage?: string;
  dropProofImage?: string;
  operatorNote?: string;
  customerNote?: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  bus: {
    id: string;
    busName: string;
    busNumber: string;
    busImage: string;
  };
  allowedActions: Array<"mark_in_transit" | "mark_delivered">;
}

interface BusWiseOrders {
  busId: string;
  busName: string;
  busNumber: string;
  busImage: string;
  ordersCount: number;
  orders: RoleDashboardOrder[];
}

interface ProofModalOrder {
  orderId: string;
  trackingId: string;
  pickupProofImage?: string;
  dropProofImage?: string;
}

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "allocated", "in-transit"]);

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toSearchText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function telHref(phone: string): string {
  const normalized = String(phone ?? "").trim().replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : "";
}

function isOngoingOrder(order: UserDashboardOrder, now: Date): boolean {
  const orderStatus = order.status.toLowerCase();
  if (orderStatus === "delivered" || orderStatus === "cancelled") {
    return false;
  }

  if (ACTIVE_STATUSES.has(orderStatus)) {
    return true;
  }

  const orderDate = new Date(order.orderDate);
  if (isNaN(orderDate.getTime())) return false;

  const todayStart = startOfDay(now);
  const yesterdayStart = addDays(todayStart, -1);
  const dayAfterTomorrowStart = addDays(todayStart, 2);

  return orderDate >= yesterdayStart && orderDate < dayAfterTomorrowStart;
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

function formatMoney(amount: number): string {
  return `Rs ${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function nearestDateDiff(isoDate: string, referenceMs: number): number {
  const dateMs = new Date(isoDate).getTime();
  if (!Number.isFinite(dateMs)) return Number.MAX_SAFE_INTEGER;
  return Math.abs(dateMs - referenceMs);
}

function getStepIndex(status: string): number {
  const normalized = status.toLowerCase();
  if (normalized === "pending") return 0;
  if (normalized === "confirmed" || normalized === "allocated") return 1;
  if (normalized === "in-transit") return 2;
  if (normalized === "delivered") return 3;
  if (normalized === "cancelled") return -1;
  return 0;
}

function getStatusBadge(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "delivered") return "bg-green-500/20 text-green-300 border-green-500/50";
  if (normalized === "in-transit") return "bg-blue-500/20 text-blue-300 border-blue-500/50";
  if (normalized === "cancelled") return "bg-red-500/20 text-red-300 border-red-500/50";
  return "bg-amber-500/20 text-amber-300 border-amber-500/50";
}

type RoleKey = "user" | "operator" | "admin" | "superadmin";
type OperatorOrderTab = "active" | "upcoming" | "past";
const OPERATOR_TAB_ORDER: OperatorOrderTab[] = ["active", "upcoming", "past"];

const OPERATOR_ORDER_TAB_LABEL: Record<OperatorOrderTab, string> = {
  active: "Active Orders",
  upcoming: "Upcoming Orders",
  past: "Past Orders",
};

function normalizeOperatorOrderTab(value: string | null): OperatorOrderTab {
  if (value === "upcoming" || value === "past" || value === "active") {
    return value;
  }
  return "active";
}

function classifyOperatorOrderTab(order: RoleDashboardOrder, now: Date): OperatorOrderTab {
  const normalizedStatus = toSearchText(order.status);
  if (normalizedStatus === "delivered" || normalizedStatus === "cancelled") {
    return "past";
  }

  const orderDate = new Date(order.orderDate);
  if (!Number.isFinite(orderDate.getTime())) {
    return "upcoming";
  }

  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);

  if (orderDate >= todayStart && orderDate < tomorrowStart) return "active";
  if (orderDate >= tomorrowStart) return "upcoming";
  return "past";
}

export default function OrderPage() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.user);
  const searchParams = useSearchParams();
  const [userOrders, setUserOrders] = useState<UserDashboardOrder[]>([]);
  const [roleOrders, setRoleOrders] = useState<RoleDashboardOrder[]>([]);
  const [groupedByBus, setGroupedByBus] = useState<BusWiseOrders[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [proofModalOrder, setProofModalOrder] = useState<ProofModalOrder | null>(null);
  const [requiredPhoneDraft, setRequiredPhoneDraft] = useState("");
  const [requiredPhoneError, setRequiredPhoneError] = useState("");
  const [savingRequiredPhone, setSavingRequiredPhone] = useState(false);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);
  const { addToast } = useToast();
  const router = useRouter();

  const role: RoleKey = useMemo(() => {
    if (user?.isSuperAdmin) return "superadmin";
    if (user?.role === "admin") return "admin";
    if (user?.role === "operator") return "operator";
    return "user";
  }, [user?.isSuperAdmin, user?.role]);
  const normalizedSearch = toSearchText(searchTerm);
  const operatorTab = useMemo<OperatorOrderTab>(
    () => normalizeOperatorOrderTab(searchParams.get("tab")),
    [searchParams],
  );
  const requiresStaffPhone = role !== "user" && !toSearchText(user?.phone).length;

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      if (role === "user") {
        const response = await fetch("/api/recent-orders", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          const message = data.error || "Failed to load orders";
          setError(message);
          setUserOrders([]);
          addToast(message, "error");
          return;
        }
        const safeOrders = Array.isArray(data)
          ? (data as UserDashboardOrder[]).filter((order) => Boolean(order?.id))
          : [];
        setUserOrders(safeOrders);
        setRoleOrders([]);
        setGroupedByBus([]);
        return;
      }

      const response = await fetch("/api/dashboard/orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        const message = data?.message || "Failed to load orders";
        setError(message);
        setRoleOrders([]);
        setGroupedByBus([]);
        addToast(message, "error");
        return;
      }

      setRoleOrders(Array.isArray(data?.orders) ? data.orders : []);
      setGroupedByBus(Array.isArray(data?.groupedByBus) ? data.groupedByBus : []);
      setUserOrders([]);
    } catch (fetchError: unknown) {
      const message = fetchError instanceof Error ? fetchError.message : "Failed to load orders";
      setError(message);
      addToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (!requiresStaffPhone) return;
    setRequiredPhoneDraft("");
    setRequiredPhoneError("");
  }, [requiresStaffPhone]);

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
    } catch (saveError: unknown) {
      setRequiredPhoneError(
        saveError instanceof Error ? saveError.message : "Failed to save contact number.",
      );
    } finally {
      setSavingRequiredPhone(false);
    }
  };

  const handleDownloadInvoice = async (orderId: string) => {
    if (!orderId) {
      addToast("Order ID is missing. Cannot download invoice.", "warning");
      return;
    }

    try {
      setDownloadingOrderId(orderId);
      const response = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        addToast(data?.error || "Failed to load invoice data.", "error");
        return;
      }

      const fileName = await downloadOrderInvoice(data);
      addToast(`Invoice downloaded: ${fileName}`, "success");
    } catch (downloadError: unknown) {
      const message =
        downloadError instanceof Error ? downloadError.message : "Failed to download invoice.";
      addToast(message, "error");
    } finally {
      setDownloadingOrderId(null);
    }
  };

  const filteredUserOrders = useMemo(() => {
    if (!normalizedSearch) return userOrders;
    return userOrders.filter((order) =>
      [
        order.trackingId,
        order.status,
        order.pickupLocation?.name,
        order.pickupLocation?.city,
        order.dropLocation?.name,
        order.dropLocation?.city,
        order.busContact?.busName,
        order.busContact?.busNumber,
        order.supportContact?.name,
        order.supportContact?.phone,
        order.packageNames.join(" "),
      ]
        .map(toSearchText)
        .some((value) => value.includes(normalizedSearch)),
    );
  }, [normalizedSearch, userOrders]);

  const filteredRoleOrders = useMemo(() => {
    if (!normalizedSearch) return roleOrders;
    return roleOrders.filter((order) =>
      [
        order.trackingId,
        order.status,
        order.bus?.busName,
        order.bus?.busNumber,
        order.user?.name,
        order.user?.email,
        order.user?.phone,
        order.pickupLocation?.name,
        order.dropLocation?.name,
      ]
        .map(toSearchText)
        .some((value) => value.includes(normalizedSearch)),
    );
  }, [normalizedSearch, roleOrders]);

  const filteredGroupedByBus = useMemo(() => {
    if (!normalizedSearch) return groupedByBus;

    return groupedByBus
      .map((busGroup) => {
        const busMatch = [busGroup.busName, busGroup.busNumber]
          .map(toSearchText)
          .some((value) => value.includes(normalizedSearch));

        if (busMatch) {
          return busGroup;
        }

        const filteredOrders = busGroup.orders.filter((order) =>
          [
            order.trackingId,
            order.status,
            order.user?.name,
            order.user?.email,
            order.pickupLocation?.name,
            order.dropLocation?.name,
          ]
            .map(toSearchText)
            .some((value) => value.includes(normalizedSearch)),
        );

        return {
          ...busGroup,
          orders: filteredOrders,
          ordersCount: filteredOrders.length,
        };
      })
      .filter((group) => group.orders.length > 0);
  }, [groupedByBus, normalizedSearch]);

  const sortedGroupedByBus = useMemo(() => {
    const nowMs = Date.now();
    return filteredGroupedByBus
      .map((group) => ({
        ...group,
        orders: [...group.orders].sort(
          (a, b) => nearestDateDiff(a.orderDate, nowMs) - nearestDateDiff(b.orderDate, nowMs),
        ),
      }))
      .sort((left, right) => {
        const leftNearest = left.orders[0] ? nearestDateDiff(left.orders[0].orderDate, nowMs) : Number.MAX_SAFE_INTEGER;
        const rightNearest = right.orders[0] ? nearestDateDiff(right.orders[0].orderDate, nowMs) : Number.MAX_SAFE_INTEGER;
        return leftNearest - rightNearest;
      });
  }, [filteredGroupedByBus]);

  const sortedRoleOrders = useMemo(() => {
    const nowMs = Date.now();
    return [...filteredRoleOrders].sort(
      (a, b) => nearestDateDiff(a.orderDate, nowMs) - nearestDateDiff(b.orderDate, nowMs),
    );
  }, [filteredRoleOrders]);

  const operatorOrdersByTab = useMemo<Record<OperatorOrderTab, RoleDashboardOrder[]>>(() => {
    const now = new Date();
    const bucketed: Record<OperatorOrderTab, RoleDashboardOrder[]> = {
      active: [],
      upcoming: [],
      past: [],
    };

    for (const order of sortedRoleOrders) {
      bucketed[classifyOperatorOrderTab(order, now)].push(order);
    }

    bucketed.upcoming.sort(
      (a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime(),
    );
    bucketed.past.sort(
      (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime(),
    );

    return bucketed;
  }, [sortedRoleOrders]);

  const operatorTabIndex = OPERATOR_TAB_ORDER.indexOf(operatorTab);
  const hasAnyOperatorOrders = OPERATOR_TAB_ORDER.some(
    (tab) => operatorOrdersByTab[tab].length > 0,
  );

  const renderOperatorOrderCard = (order: RoleDashboardOrder) => {
    return (
      <article key={order.id} className="rounded-xl border border-[#4E5A45]/80 bg-[#222d1e] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-mono text-sm text-[#F6FF6A]">{order.trackingId}</p>
            <p className="text-sm text-white/90">
              {order.pickupLocation?.name || "--"} to {order.dropLocation?.name || "--"}
            </p>
            <p className="text-xs text-white/60">
              {formatDate(order.orderDate)} | {order.user?.name || "--"} ({order.user?.email || "--"})
            </p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${getStatusBadge(order.status)}`}>
            {order.status}
          </span>
        </div>

        <div className="mt-3 grid gap-2 text-xs text-white/70 sm:grid-cols-3">
          <p>
            <span className="text-white/45">Bus:</span> {order.bus?.busName || "--"} {order.bus?.busNumber ? `(${order.bus.busNumber})` : ""}
          </p>
          <p>
            <span className="text-white/45">Amount:</span> {formatMoney(order.totalAmount)}
          </p>
          <p>
            <span className="text-white/45">Proof:</span> Pickup {order.pickupProofImage ? "Uploaded" : "Pending"}, Drop {order.dropProofImage ? "Uploaded" : "Pending"}
          </p>
        </div>

        {order.operatorNote ? (
          <p className="mt-3 border-l-2 border-amber-300/50 pl-3 text-xs text-amber-100/90">
            {order.operatorNote}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/orders/${order.id}`)}
            className="rounded-md border border-[#6A774F] bg-[#25311E] px-3 py-1.5 text-xs font-semibold text-[#F6FF6A] hover:bg-[#2D3A24]"
          >
            View Details
          </button>
          <span className="inline-flex items-center rounded-md border border-white/15 px-3 py-1.5 text-xs text-white/55">
            Status auto-updates from proof capture
          </span>
        </div>
      </article>
    );
  };

  const sortedUserOrders = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const ongoing: UserDashboardOrder[] = [];
    const past: UserDashboardOrder[] = [];

    for (const order of filteredUserOrders) {
      if (isOngoingOrder(order, now)) {
        ongoing.push(order);
      } else {
        past.push(order);
      }
    }

    const sortByNearestDate = (a: UserDashboardOrder, b: UserDashboardOrder) =>
      nearestDateDiff(a.orderDate, nowMs) - nearestDateDiff(b.orderDate, nowMs);

    ongoing.sort(sortByNearestDate);
    past.sort(sortByNearestDate);
    return { ongoing, past };
  }, [filteredUserOrders]);

  const requiredPhoneModal = requiresStaffPhone ? (
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
  ) : null;

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-full max-w-sm" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`orders-page-skeleton-${index}`}
              className="rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-5"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-[#1F271A] p-3 space-y-2">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <div className="rounded-xl bg-[#1F271A] p-3 space-y-2">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
          {error}
        </div>
      </div>
    );
  }

  if (role === "user") {
    if (userOrders.length === 0) {
      return (
        <div className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-[#F6FF6A]">My Orders</h1>
            <div className="relative w-full max-w-sm">
              <Icon icon="mdi:magnify" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search tracking ID, route or support contact"
                className="w-full rounded-lg border border-[#5E6A4F] bg-[#1F271A] py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-[#CDD645]"
              />
            </div>
          </div>
          <div className="rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-8 text-center text-white/75">
            No orders found yet.
          </div>
        </div>
      );
    }

    const renderUserOrderCard = (order: UserDashboardOrder) => {
      const normalizedStatus = order.status.toLowerCase();
      const isDelivered = normalizedStatus === "delivered";
      const isCancelled = normalizedStatus === "cancelled";
      const hasBusContact = Boolean(
        order.busContact?.contactPersonNumber || order.busContact?.contactPersonName,
      );
      const shouldHideUpcomingContact = Boolean(order.contactLocked);
      const canShowBusContact = hasBusContact && !isDelivered && !isCancelled && !shouldHideUpcomingContact;
      const supportPhone = order.supportContact?.phone || "";
      const supportPhoneHref = telHref(supportPhone);

      const stepIndex = getStepIndex(order.status);
      const steps = ["Order Placed", "Confirmed", "In Transit", "Delivered"];

      return (
        <article
          key={order.id}
          className="rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-5 shadow-lg"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/50">Tracking ID</p>
              <p className="font-mono text-sm text-[#F6FF6A]">{order.trackingId}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/50">Pickup Date</p>
              <p className="text-sm text-white">{formatDate(order.orderDate)}</p>
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusBadge(
                order.status,
              )}`}
            >
              {order.status}
            </span>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-[#1F271A] p-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-white/50">From</p>
              <p className="font-semibold text-white">{order.pickupLocation.name}</p>
              <p className="text-sm text-white/70">
                {order.pickupLocation.city}, {order.pickupLocation.state}
              </p>
            </div>
            <div className="rounded-xl bg-[#1F271A] p-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-white/50">To</p>
              <p className="font-semibold text-white">{order.dropLocation.name}</p>
              <p className="text-sm text-white/70">
                {order.dropLocation.city}, {order.dropLocation.state}
              </p>
            </div>
          </div>

          <div className="mb-5 rounded-xl bg-[#1F271A] p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-white/50">Tracking Progress</p>
            <div className="grid grid-cols-4 gap-2">
              {steps.map((step, idx) => {
                const active = stepIndex >= idx;
                return (
                  <div key={step} className="flex flex-col items-center gap-2">
                    <div
                      className={`h-2 w-full rounded-full ${active ? "bg-[#CDD645]" : "bg-white/15"}`}
                    />
                    <p className={`text-[11px] ${active ? "text-white" : "text-white/45"}`}>
                      {step}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {(order.pickupProofImage || order.dropProofImage) && (
            <div className="mb-5 rounded-xl bg-[#1F271A] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-wide text-white/50">Verification Proofs</p>
                <button
                  type="button"
                  onClick={() =>
                    setProofModalOrder({
                      orderId: order.id,
                      trackingId: order.trackingId,
                      pickupProofImage: order.pickupProofImage,
                      dropProofImage: order.dropProofImage,
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-[#6A774F] bg-[#25311E] px-2 py-1 text-[11px] font-medium text-[#F6FF6A] hover:bg-[#2D3A24]"
                >
                  <Icon icon="mdi:magnify-plus-outline" className="text-sm" />
                  Full View
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-white/55">Pickup Proof</p>
                  {order.pickupProofImage ? (
                    <button
                      type="button"
                      onClick={() =>
                        setProofModalOrder({
                          orderId: order.id,
                          trackingId: order.trackingId,
                          pickupProofImage: order.pickupProofImage,
                          dropProofImage: order.dropProofImage,
                        })
                      }
                      className="block w-full text-left"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={order.pickupProofImage}
                        alt="Pickup proof"
                        className="h-28 w-full rounded-lg border border-white/15 object-cover transition hover:opacity-90"
                      />
                    </button>
                  ) : (
                    <div className="flex h-28 items-center justify-center rounded-lg border border-white/15 bg-black/20 text-xs text-white/50">
                      Not uploaded
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs text-white/55">Drop Proof</p>
                  {order.dropProofImage ? (
                    <button
                      type="button"
                      onClick={() =>
                        setProofModalOrder({
                          orderId: order.id,
                          trackingId: order.trackingId,
                          pickupProofImage: order.pickupProofImage,
                          dropProofImage: order.dropProofImage,
                        })
                      }
                      className="block w-full text-left"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={order.dropProofImage}
                        alt="Drop proof"
                        className="h-28 w-full rounded-lg border border-white/15 object-cover transition hover:opacity-90"
                      />
                    </button>
                  ) : (
                    <div className="flex h-28 items-center justify-center rounded-lg border border-white/15 bg-black/20 text-xs text-white/50">
                      Not uploaded
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/orders/${order.id}`)}
              className="rounded-xl bg-[#1F271A] p-3 text-left transition hover:bg-[#252f1f]"
            >
              <p className="text-xs uppercase tracking-wide text-white/50">Packages</p>
              <p className="mt-1 text-sm text-white">{order.packageCount} item(s)</p>
              <p className="mt-1 text-xs text-white/65">
                {order.packageNames.slice(0, 2).join(", ") || "Package details available"}
              </p>
              <p className="mt-2 text-xs font-medium text-[#CDD645]">View full package details</p>
            </button>

            <div className="rounded-xl bg-[#1F271A] p-3">
              <p className="text-xs uppercase tracking-wide text-white/50">Order Value</p>
              <p className="mt-1 text-sm text-white">{formatMoney(order.totalAmount)}</p>
              <p className="mt-1 text-xs text-white/65">{order.totalWeightKg} kg total</p>
            </div>

            <div className="rounded-xl bg-[#1F271A] p-3">
              <p className="text-xs uppercase tracking-wide text-white/50">Assigned Bus</p>
              {order.busContact ? (
                <div className="mt-2 flex items-center gap-3">
                  {order.busContact.busImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={order.busContact.busImage}
                      alt={order.busContact.busName || "Assigned bus"}
                      className="h-12 w-12 rounded-lg border border-white/15 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/15 bg-[#252f1f] text-[#F6FF6A]">
                      <Icon icon="mdi:bus" className="text-xl" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {order.busContact.busName || "Assigned Bus"}
                    </p>
                    <p className="text-xs text-[#F6FF6A]">
                      {order.busContact.busNumber || "Bus number pending"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-sm text-white/55">Bus not assigned yet.</p>
              )}
            </div>

            <div className="rounded-xl bg-[#1F271A] p-3">
              <p className="text-xs uppercase tracking-wide text-white/50">Operator Contact</p>

              {canShowBusContact && order.busContact ? (
                <div className="mt-1 space-y-1 text-sm text-white">
                  <p>{order.busContact.contactPersonName || "Support Desk"}</p>
                  <p className="font-mono text-[#F6FF6A]">{order.busContact.contactPersonNumber}</p>
                </div>
              ) : shouldHideUpcomingContact ? (
                <div className="mt-2 space-y-2">
                  <div className="relative overflow-hidden rounded-lg border border-white/15 bg-black/25 p-2">
                    <div className="select-none blur-sm">
                      <p className="text-sm text-white">Assigned Operator</p>
                      <p className="font-mono text-sm text-[#F6FF6A]">XXXXXXXXXX</p>
                    </div>
                    <div className="pointer-events-none absolute inset-0 bg-black/40" />
                  </div>
                  <p className="text-xs text-white/70">Visible 1 day before pickup.</p>
                </div>
              ) : isDelivered ? (
                <p className="mt-1 text-sm text-white/55">Hidden after delivery is completed.</p>
              ) : (
                <p className="mt-1 text-sm text-white/55">Not available for this order</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {supportPhoneHref ? (
              <a
                href={supportPhoneHref}
                className="inline-flex items-center gap-2 rounded-lg border border-[#6A774F] bg-[#25311E] px-3 py-2 text-sm font-medium text-[#F6FF6A] hover:bg-[#2D3A24]"
              >
                <Icon icon="mdi:lifebuoy" className="text-base" />
                Support: {supportPhone}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => router.push(`/dashboard/support?orderId=${order.id}`)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#6A774F] bg-[#25311E] px-3 py-2 text-sm font-medium text-[#F6FF6A] hover:bg-[#2D3A24]"
              >
                <Icon icon="mdi:lifebuoy" className="text-base" />
                Contact Support
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDownloadInvoice(order.id)}
              disabled={downloadingOrderId === order.id}
              className="inline-flex items-center gap-2 rounded-lg border border-[#6A774F] bg-[#25311E] px-3 py-2 text-sm font-medium text-[#F6FF6A] hover:bg-[#2D3A24] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon
                icon={
                  downloadingOrderId === order.id
                    ? "line-md:loading-loop"
                    : "mdi:file-document-outline"
                }
                className="text-base"
              />
              {downloadingOrderId === order.id ? "Preparing Invoice..." : "Download Invoice"}
            </button>
          </div>
        </article>
      );
    };

    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-[#F6FF6A]">My Orders</h1>
          <div className="relative w-full max-w-sm">
            <Icon icon="mdi:magnify" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search tracking ID, route or support contact"
              className="w-full rounded-lg border border-[#5E6A4F] bg-[#1F271A] py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-[#CDD645]"
            />
          </div>
        </div>

        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Icon icon="mdi:progress-clock" className="text-[#CDD645]" />
            <h2 className="text-lg font-semibold text-white">Ongoing Orders</h2>
            <span className="rounded-full bg-[#CDD645]/20 px-2 py-0.5 text-xs text-[#F6FF6A]">
              {sortedUserOrders.ongoing.length}
            </span>
          </div>
          <div className="space-y-4">
            {sortedUserOrders.ongoing.length > 0 ? (
              sortedUserOrders.ongoing.map((order) => renderUserOrderCard(order))
            ) : (
              <div className="rounded-xl border border-[#4E5A45] bg-[#2A3324] p-4 text-white/65">
                {normalizedSearch ? "No ongoing orders match your search." : "No ongoing orders."}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Icon icon="mdi:archive-outline" className="text-white/70" />
            <h2 className="text-lg font-semibold text-white">Order History</h2>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">
              {sortedUserOrders.past.length}
            </span>
          </div>
          <div className="space-y-4">
            {sortedUserOrders.past.length > 0 ? (
              sortedUserOrders.past.map((order) => renderUserOrderCard(order))
            ) : (
              <div className="rounded-xl border border-[#4E5A45] bg-[#2A3324] p-4 text-white/65">
                {normalizedSearch ? "No past orders match your search." : "No past orders."}
              </div>
            )}
          </div>
        </section>

        {proofModalOrder ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            onClick={() => setProofModalOrder(null)}
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
                <div>
                  <h3 className="text-lg font-semibold text-[#F6FF6A]">Verification Proofs</h3>
                  <p className="text-xs text-white/60">{proofModalOrder.trackingId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProofModalOrder(null)}
                  className="rounded-md border border-white/20 p-1.5 text-white/80 hover:border-[#CDD645] hover:text-[#CDD645]"
                  aria-label="Close proof modal"
                >
                  <Icon icon="mdi:close" className="text-lg" />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm text-white/80">Pickup Proof</p>
                  {proofModalOrder.pickupProofImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={proofModalOrder.pickupProofImage}
                      alt="Pickup proof full"
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
                  {proofModalOrder.dropProofImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={proofModalOrder.dropProofImage}
                      alt="Drop proof full"
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
      </div>
    );
  }

  if (role === "admin" || role === "superadmin") {
    return (
      <>
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-[#F6FF6A]">All Orders (Bus Wise)</h1>
            <div className="relative w-full max-w-sm">
              <Icon icon="mdi:magnify" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search bus, tracking ID or customer"
                className="w-full rounded-lg border border-[#5E6A4F] bg-[#1F271A] py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-[#CDD645]"
              />
            </div>
          </div>
          {sortedGroupedByBus.length === 0 ? (
            <div className="rounded-xl border border-[#4E5A45] bg-[#2A3324] p-6 text-white/65">
              {normalizedSearch
                ? "No orders match your search."
                : "No orders found for your buses."}
            </div>
          ) : (
            <div className="space-y-5">
              {sortedGroupedByBus.map((busGroup) => (
                <section key={busGroup.busId} className="rounded-2xl border border-[#4E5A45] bg-[#2A3324] p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {busGroup.busImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={busGroup.busImage}
                          alt={busGroup.busName || "Bus"}
                          className="h-12 w-12 rounded-lg border border-white/15 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/15 bg-[#1F271A]">
                          <Icon icon="mdi:bus" className="text-xl text-[#E4E67A]" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-white">{busGroup.busName || "Bus"}</p>
                        <p className="text-xs text-[#E4E67A]">{busGroup.busNumber || "Bus number pending"}</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-[#CDD645]/40 bg-[#CDD645]/15 px-3 py-1 text-xs text-[#F6FF6A]">
                      {busGroup.ordersCount} orders
                    </span>
                  </div>

                  <div className="space-y-3">
                    {busGroup.orders.map((order) => (
                      <article key={order.id} className="rounded-xl bg-[#1F271A] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-mono text-sm text-[#F6FF6A]">{order.trackingId}</p>
                            <p className="text-xs text-white/65">{formatDate(order.orderDate)}</p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${getStatusBadge(order.status)}`}>
                            {order.status}
                          </span>
                        </div>

                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <p className="text-sm text-white/85">
                            <span className="text-white/50">User:</span> {order.user?.name || "--"} ({order.user?.email || "--"})
                          </p>
                          <p className="text-sm text-white/85">
                            <span className="text-white/50">Amount:</span> {formatMoney(order.totalAmount)}
                          </p>
                          <p className="text-sm text-white/85">
                            <span className="text-white/50">From:</span> {order.pickupLocation?.name || "--"}
                          </p>
                          <p className="text-sm text-white/85">
                            <span className="text-white/50">To:</span> {order.dropLocation?.name || "--"}
                          </p>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#6A774F] bg-[#25311E] px-3 py-1.5 text-xs font-medium text-[#F6FF6A] hover:bg-[#2D3A24]"
                          >
                            <Icon icon="mdi:eye-outline" className="text-sm" />
                            View Details
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
        {requiredPhoneModal}
      </>
    );
  }

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-[#F6FF6A]">{OPERATOR_ORDER_TAB_LABEL[operatorTab]}</h1>
          <div className="relative w-full max-w-sm">
            <Icon icon="mdi:magnify" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search tracking ID, customer or bus"
              className="w-full rounded-lg border border-[#5E6A4F] bg-[#1F271A] py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-[#CDD645]"
            />
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {(["active", "upcoming", "past"] as const).map((tab) => {
            const isActiveTab = operatorTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => router.push(`/dashboard/orders?tab=${tab}`)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  isActiveTab
                    ? "border-[#CDD645]/65 bg-[#CDD645]/20 text-[#F6FF6A]"
                    : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {OPERATOR_ORDER_TAB_LABEL[tab]} ({operatorOrdersByTab[tab].length})
              </button>
            );
          })}
        </div>

        {!hasAnyOperatorOrders ? (
          <div className="rounded-xl border border-[#4E5A45] bg-[#2A3324] p-6 text-white/65">
            {normalizedSearch ? "No orders match your search." : "No orders found for your assigned buses."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#4E5A45]/80 bg-[#1d2619]">
            <div
              className="flex transition-transform duration-300 ease-in-out"
              style={{
                width: `${OPERATOR_TAB_ORDER.length * 100}%`,
                transform: `translateX(-${(100 / OPERATOR_TAB_ORDER.length) * operatorTabIndex}%)`,
              }}
            >
              {OPERATOR_TAB_ORDER.map((tab) => (
                <section
                  key={tab}
                  className="p-4"
                  style={{ width: `${100 / OPERATOR_TAB_ORDER.length}%` }}
                >
                  <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
                    <h2 className="text-lg font-semibold text-white">{OPERATOR_ORDER_TAB_LABEL[tab]}</h2>
                    <span className="rounded-full bg-[#CDD645]/20 px-2.5 py-0.5 text-xs text-[#F6FF6A]">
                      {operatorOrdersByTab[tab].length}
                    </span>
                  </div>
                  {operatorOrdersByTab[tab].length === 0 ? (
                    <div className="rounded-xl border border-[#4E5A45] bg-[#2A3324] p-5 text-sm text-white/65">
                      {normalizedSearch
                        ? `No ${tab} orders match your search.`
                        : `No ${tab} orders found.`}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {operatorOrdersByTab[tab].map((order) => renderOperatorOrderCard(order))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        )}
      </div>
      {requiredPhoneModal}
    </>
  );
}
