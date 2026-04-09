"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useToast } from "@/context/ToastContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { fetchUser } from "@/lib/redux/userSlice";
import Skeleton from "@/components/Skeleton";
import { formatIndiaPhoneInput, normalizeIndiaPhone } from "@/lib/phone";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import { useTranslation } from "@/lib/i18n/LanguageContext";

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

interface OrderReport {
  reportType?: "customer_not_at_pickup" | "customer_not_at_drop";
  category?: string;
  title?: string;
  description?: string;
  createdBy?: string;
  createdByRole?: string;
  createdAt?: string;
  data?: {
    note?: string;
    guidance?: string;
    processingStatus?: "attention_needed" | "office_collection_required";
    orderId?: string;
    busId?: string;
    officeAction?: string;
    customerMessage?: string;
    assignedOffice?: {
      officeName?: string;
      city?: string;
      state?: string;
    };
  };
  type?: "customer_not_at_pickup" | "customer_not_at_drop";
  status?: "attention_needed" | "office_collection_required";
  note?: string;
  guidance?: string;
  reportedAt?: string;
  reportedBy?: string;
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
  feedbackSubmitted?: boolean;
  feedbackRating?: number | null;
  feedbackComment?: string;
  feedbackUpdatedAt?: string | null;
  report?: OrderReport | null;
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
  report?: OrderReport | null;
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

interface FeedbackModalOrder {
  orderId: string;
  trackingId: string;
  rating: number;
  comment: string;
  feedbackSubmitted?: boolean;
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

function toStringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return fallback;
}

function isOngoingOrder(order: UserDashboardOrder, now: Date): boolean {
  const orderStatus = order.status.toLowerCase();
  if (orderStatus === "delivered" || orderStatus === "cancelled" || orderStatus === "missed_package") {
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

function getOfficeCollectionTag(report?: OrderReport | null): string {
  if (!report) return "";

  const reportType = (report.reportType || report.type || "").toLowerCase();
  const processingStatus = (report.data?.processingStatus || report.status || "").toLowerCase();
  if (reportType !== "customer_not_at_drop" && processingStatus !== "office_collection_required") {
    return "";
  }

  const officeName = toStringValue(report.data?.assignedOffice?.officeName);
  const city = toStringValue(report.data?.assignedOffice?.city);
  const location = [officeName, city].filter(Boolean).join(", ");
  return location ? `Pick up package from ${location}` : "Pick up package from assigned office";
}

function nearestDateDiff(isoDate: string, referenceMs: number): number {
  const dateMs = new Date(isoDate).getTime();
  if (!Number.isFinite(dateMs)) return Number.MAX_SAFE_INTEGER;
  return Math.abs(dateMs - referenceMs);
}

function getStatusBadge(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "delivered") return "bg-green-500/20 text-green-300 border-green-500/50";
  if (normalized === "in-transit") return "bg-blue-500/20 text-blue-300 border-blue-500/50";
  if (normalized === "missed_package") return "bg-orange-500/20 text-orange-200 border-orange-400/50";
  if (normalized === "cancelled") return "bg-red-500/20 text-red-300 border-red-500/50";
  return "bg-amber-500/20 text-amber-300 border-amber-500/50";
}

type RoleKey = "user" | "operator" | "admin";
type OperatorOrderTab = "active" | "upcoming" | "past";
const OPERATOR_TAB_ORDER: OperatorOrderTab[] = ["active", "upcoming", "past"];

const OPERATOR_ORDER_TAB_LABEL: Record<OperatorOrderTab, string> = {
  active: "Active Orders",
  upcoming: "Upcoming Orders",
  past: "Past Orders",
};

const modernOrderCardClass =
  "group relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#141A14] p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#D5E400]/30 hover:bg-[#1A221A] active:scale-[0.98]";
const sectionCardClass =
  "mt-4 p-2";
const heroPanelClass =
  "relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#141A14] p-8 shadow-sm mb-8";

function stopCardNavigation(event: React.MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

function handleCardKeyDown(
  event: React.KeyboardEvent<HTMLElement>,
  onOpen: () => void,
) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onOpen();
}

function SectionHeading({
  icon,
  title,
  count,
  tone = "accent",
}: {
  icon: string;
  title: string;
  count: number;
  tone?: "accent" | "muted";
}) {
  const countClass =
    tone === "accent"
      ? "border-[#CDD645]/35 bg-[#CDD645]/15 text-[#F6FF6A]"
      : "border-white/12 bg-white/[0.07] text-white/80";

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#CDD645]">
          <Icon icon={icon} className="text-lg" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="text-xs text-white/50">Tap any order card to open the full package details.</p>
        </div>
      </div>
      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${countClass}`}>
        {count} orders
      </span>
    </div>
  );
}

function normalizeOperatorOrderTab(value: string | null): OperatorOrderTab {
  if (value === "upcoming" || value === "past" || value === "active") {
    return value;
  }
  return "active";
}

function classifyOperatorOrderTab(order: RoleDashboardOrder, now: Date): OperatorOrderTab {
  const normalizedStatus = toSearchText(order.status);
  if (normalizedStatus === "delivered" || normalizedStatus === "cancelled" || normalizedStatus === "missed_package") {
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
  const { isMobile, isTablet } = useResponsiveMode();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
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
  const [feedbackModalOrder, setFeedbackModalOrder] = useState<FeedbackModalOrder | null>(null);
  const [feedbackRatingDraft, setFeedbackRatingDraft] = useState(5);
  const [feedbackCommentDraft, setFeedbackCommentDraft] = useState("");
  const [savingFeedbackOrderId, setSavingFeedbackOrderId] = useState<string | null>(null);
  const { addToast } = useToast();
  const router = useRouter();

  const role: RoleKey = useMemo(() => {
    if (user?.role === "admin") return "admin";
    if (user?.role === "operator") return "operator";
    return "user";
  }, [user?.role]);
  const normalizedSearch = toSearchText(searchTerm);
  const operatorTab = useMemo<OperatorOrderTab>(
    () => normalizeOperatorOrderTab(searchParams.get("tab")),
    [searchParams],
  );
  const requiresStaffPhone = role !== "user" && !normalizeIndiaPhone(user?.phone);
  const pagePaddingClass = isMobile ? "p-3 pb-24" : isTablet ? "p-4 pb-28" : "p-4 sm:p-6 lg:p-8";
  const sectionStackClass = isMobile ? "space-y-3" : "space-y-4";

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
    setRequiredPhoneDraft(formatIndiaPhoneInput(""));
    setRequiredPhoneError("");
  }, [requiresStaffPhone]);

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
    } catch (saveError: unknown) {
      setRequiredPhoneError(
        saveError instanceof Error ? saveError.message : "Failed to save contact number.",
      );
    } finally {
      setSavingRequiredPhone(false);
    }
  };

  const openOrderDetail = (orderId: string) => {
    if (!orderId) return;
    router.push(`/dashboard/orders/${orderId}`);
  };

  const openFeedbackModal = (order: UserDashboardOrder) => {
    setFeedbackModalOrder({
      orderId: order.id,
      trackingId: order.trackingId,
      rating: order.feedbackRating ?? 5,
      comment: order.feedbackComment ?? "",
      feedbackSubmitted: order.feedbackSubmitted,
    });
    setFeedbackRatingDraft(order.feedbackRating ?? 5);
    setFeedbackCommentDraft(order.feedbackComment ?? "");
  };

  const submitFeedback = async () => {
    if (!feedbackModalOrder) return;

    try {
      setSavingFeedbackOrderId(feedbackModalOrder.orderId);
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: feedbackModalOrder.orderId,
          rating: feedbackRatingDraft,
          comment: feedbackCommentDraft,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        addToast(data?.message || "Failed to save feedback.", "error");
        return;
      }
      addToast("Feedback saved successfully.", "success");
      setFeedbackModalOrder(null);
      setFeedbackCommentDraft("");
      setFeedbackRatingDraft(5);
      await fetchOrders();
    } catch (feedbackError: unknown) {
      addToast(
        feedbackError instanceof Error ? feedbackError.message : "Failed to save feedback.",
        "error",
      );
    } finally {
      setSavingFeedbackOrderId(null);
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
        order.report?.title,
        order.report?.description,
        order.report?.note,
        order.report?.guidance,
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
            order.report?.title,
            order.report?.description,
            order.report?.note,
            order.report?.guidance,
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
      <article
        key={order.id}
        role="button"
        tabIndex={0}
        onClick={() => openOrderDetail(order.id)}
        onKeyDown={(event) => handleCardKeyDown(event, () => openOrderDetail(order.id))}
        className={`${modernOrderCardClass} ${isMobile ? "p-4 rounded-[1.6rem]" : isTablet ? "p-5 rounded-[1.75rem]" : ""}`}
      >
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#CDD645]/25 bg-[#CDD645]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A]">
                Full detail
              </span>
              <p className="font-mono text-sm text-[#F6FF6A]">{order.trackingId}</p>
            </div>
            <p className="text-base font-semibold text-white">
              {order.pickupLocation?.name || "--"} to {order.dropLocation?.name || "--"}
            </p>
            <p className="text-xs text-white/60">
              {formatDate(order.orderDate)} | {order.user?.name || "--"}{isMobile ? "" : ` (${order.user?.email || "--"})`}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs capitalize ${getStatusBadge(order.status)}`}>
            {order.status}
          </span>
        </div>

        <div className={`relative mt-4 grid gap-3 text-xs text-white/70 ${isMobile ? "grid-cols-2" : "sm:grid-cols-3"}`}>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/42">Bus</p>
            <p className="mt-1 text-sm text-white">
              {order.bus?.busName || "--"} {order.bus?.busNumber ? `(${order.bus.busNumber})` : ""}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/42">Amount</p>
            <p className="mt-1 text-sm text-white">{formatMoney(order.totalAmount)}</p>
          </div>
          {!isMobile ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/42">Proof</p>
              <p className="mt-1 text-sm text-white">
                Pickup {order.pickupProofImage ? "Uploaded" : "Pending"}, Drop {order.dropProofImage ? "Uploaded" : "Pending"}
              </p>
            </div>
          ) : null}
        </div>

        {order.operatorNote && !order.report ? (
          <p className="mt-3 border-l-2 border-amber-300/50 pl-3 text-xs text-amber-100/90">
            {order.operatorNote}
          </p>
        ) : null}

        {order.report ? (
          <div className="mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-amber-100">
                {order.report.title ||
                  (order.report.reportType === "customer_not_at_drop"
                    ? "Customer not at drop"
                    : "Customer not at pickup")}
              </p>
              <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-100">
                {order.report.data?.processingStatus === "office_collection_required" ||
                order.report.status === "office_collection_required"
                  ? "Office collection"
                  : "Needs attention"}
              </span>
            </div>
            <p className="mt-1 text-xs text-amber-50/90">
              {order.report.description || order.report.data?.guidance || order.report.guidance}
            </p>
            <p className="mt-1 text-[11px] text-amber-100/70">
              {order.report.data?.note || order.report.note}
            </p>
          </div>
        ) : null}

        <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
          {!isMobile ? (
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60">
              Open card to view full package details
            </span>
          ) : (
            <span className="text-[11px] text-white/48">Compact view. Tap for full order details.</span>
          )}
          <span className="inline-flex items-center gap-2 text-sm font-medium text-[#DDE98D]">
            {isMobile ? "View" : "View Order"}
            <Icon icon="mdi:arrow-top-right" className="text-base transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
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
      <div className="dashboard-surface relative w-full max-w-md rounded-2xl p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-[#F6FF6A]">{t.orders.addContactNumber}</h2>
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
              className="dashboard-surface rounded-2xl p-5"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="dashboard-surface-soft rounded-xl p-3 space-y-2">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <div className="dashboard-surface-soft rounded-xl p-3 space-y-2">
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
        <div className={pagePaddingClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-[#F6FF6A]">{t.orders.myOrders}</h1>
            <div className="relative w-full max-w-sm">
              <Icon icon="mdi:magnify" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search tracking ID, route or support contact"
                className="dashboard-input w-full rounded-lg py-2 pl-9 pr-3 text-sm placeholder:text-white/45 focus:border-[#CDD645]"
              />
            </div>
          </div>
          <div className="dashboard-surface rounded-2xl p-8 text-center text-white/75">
            No orders found yet.
          </div>
        </div>
      );
    }

    const renderUserOrderCard = (order: UserDashboardOrder) => {
      const isCompact = isMobile;
      const officeCollectionTag = getOfficeCollectionTag(order.report);
      const routeSummary = `${order.pickupLocation?.name || "--"} to ${order.dropLocation?.name || "--"}`;

      return (
        <article
          key={order.id}
          role="button"
          tabIndex={0}
          onClick={() => openOrderDetail(order.id)}
          onKeyDown={(event) => handleCardKeyDown(event, () => openOrderDetail(order.id))}
          className={`${modernOrderCardClass} ${isMobile ? "p-3.5 rounded-[1.4rem]" : isTablet ? "p-4 rounded-[1.65rem]" : "p-5"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`font-mono text-[#F6FF6A] ${isMobile ? "text-[11px]" : "text-sm"}`}>{order.trackingId}</p>
              <p className={`mt-1 truncate text-white ${isMobile ? "text-sm" : "text-base"}`}>{routeSummary}</p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${getStatusBadge(order.status)}`}
            >
              {order.status}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-white/55">
            <Icon icon="mdi:calendar-blank-outline" className="text-sm" />
            <span>{formatDate(order.orderDate)}</span>
          </div>

          {officeCollectionTag && !isCompact ? (
            <div className="mt-3">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-100">
                <Icon icon="mdi:store-marker-outline" className="text-xs" />
                <span className="truncate">{officeCollectionTag}</span>
              </span>
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/8 pt-3">
            <span className="text-[11px] text-white/48">
              {isCompact ? "Tap for details." : "Open card for full package details."}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#DDE98D]">
              {isCompact ? "Open" : "View Details"}
              <Icon icon="mdi:chevron-right" className="text-sm transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>

          {order.feedbackSubmitted && !isCompact ? (
            <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-100/85">
              Feedback submitted
            </div>
          ) : null}

          {toSearchText(order.status) === "delivered" && !order.feedbackSubmitted && !isCompact ? (
            <button
              type="button"
              onClick={(event) => {
                stopCardNavigation(event);
                openFeedbackModal(order);
              }}
              className="mt-3 flex w-full items-center justify-between rounded-xl border border-[#CDD645]/15 bg-[#CDD645]/5 px-3 py-2 text-xs text-[#F6FF6A]/80 transition hover:bg-[#CDD645]/10"
            >
              <span className="flex items-center gap-1.5">
                <Icon icon="mdi:star-outline" className="text-sm" />
                Rate your delivery experience
              </span>
              <Icon icon="mdi:chevron-right" className="text-sm" />
            </button>
          ) : null}
        </article>
      );
    };

    return (
      <div className={pagePaddingClass}>
        <section className={heroPanelClass}>
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <span className="rounded-full border border-[#CDD645]/30 bg-[#CDD645]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A]">
                Orders workspace
              </span>
              <h1 className="mt-3 text-3xl font-bold text-white">{t.orders.myOrders}</h1>
              <p className="mt-2 text-sm text-white/68">
                {isMobile
                  ? "Essential tracking first. Open any card for full order details."
                  : isTablet
                    ? "Track active shipments and review more details without overload."
                    : "Track active shipments, revisit past deliveries, and open any card to see the full package detail flow."}
              </p>
            </div>
            <div className={`grid gap-3 ${isMobile ? "w-full grid-cols-2" : "sm:grid-cols-2"}`}>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.06] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Ongoing</p>
                <p className="mt-1 text-2xl font-semibold text-white">{sortedUserOrders.ongoing.length}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.06] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">History</p>
                <p className="mt-1 text-2xl font-semibold text-white">{sortedUserOrders.past.length}</p>
              </div>
            </div>
          </div>
          <div className="relative mt-5">
            <Icon icon="mdi:magnify" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/45" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search tracking ID, route or support contact"
              className="dashboard-input w-full rounded-2xl border-white/10 bg-black/15 py-3 pl-11 pr-4 text-sm placeholder:text-white/40 focus:border-[#CDD645]"
            />
          </div>
        </section>

        <section className={`${sectionCardClass} mt-6 mb-8`}>
          <SectionHeading
            icon="mdi:progress-clock"
            title="Ongoing Orders"
            count={sortedUserOrders.ongoing.length}
          />
          <div className={sectionStackClass}>
            {sortedUserOrders.ongoing.length > 0 ? (
              sortedUserOrders.ongoing.map((order) => renderUserOrderCard(order))
            ) : (
              <div className="rounded-[1.35rem] border border-dashed border-white/12 bg-white/5 p-5 text-white/65">
                {normalizedSearch ? "No ongoing orders match your search." : "No ongoing orders."}
              </div>
            )}
          </div>
        </section>

        <section className={sectionCardClass}>
          <SectionHeading
            icon="mdi:archive-outline"
            title="Order History"
            count={sortedUserOrders.past.length}
            tone="muted"
          />
          <div className={sectionStackClass}>
            {sortedUserOrders.past.length > 0 ? (
              sortedUserOrders.past.map((order) => renderUserOrderCard(order))
            ) : (
              <div className="rounded-[1.35rem] border border-dashed border-white/12 bg-white/5 p-5 text-white/65">
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
              className="w-full max-w-6xl dashboard-surface rounded-2xl p-4 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Verification proofs"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-[#F6FF6A]">{t.orders.verificationProofs}</h3>
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
                  {proofModalOrder.dropProofImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={proofModalOrder.dropProofImage}
                      alt="Drop proof full"
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

        {feedbackModalOrder ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            onClick={() => setFeedbackModalOrder(null)}
            role="presentation"
          >
            <div
              className="w-full max-w-2xl dashboard-surface rounded-2xl p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Delivery feedback"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[#F6FF6A]">
                    {feedbackModalOrder.feedbackSubmitted ? "Edit feedback" : "Share feedback"}
                  </h3>
                  <p className="text-xs text-white/60">{feedbackModalOrder.trackingId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedbackModalOrder(null)}
                  className="rounded-md border border-white/20 p-1.5 text-white/80 hover:border-[#CDD645] hover:text-[#CDD645]"
                  aria-label="Close feedback modal"
                >
                  <Icon icon="mdi:close" className="text-lg" />
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-white/75">
                  Rate the delivery experience after completion. You can update it later if needed.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const active = value <= feedbackRatingDraft;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFeedbackRatingDraft(value)}
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-full border text-sm font-semibold transition ${
                          active
                            ? "border-[#CDD645]/60 bg-[#CDD645]/20 text-[#F6FF6A]"
                            : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
                        }`}
                        aria-label={`${value} star rating`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  rows={5}
                  value={feedbackCommentDraft}
                  onChange={(event) => setFeedbackCommentDraft(event.target.value)}
                  placeholder="Tell us what went well or what we can improve..."
                  className="dashboard-input mt-4 w-full rounded-2xl px-4 py-3 text-sm leading-6 focus:border-[#CDD645]/65"
                />
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setFeedbackModalOrder(null)}
                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/75 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitFeedback}
                    disabled={savingFeedbackOrderId === feedbackModalOrder.orderId}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#6A774F] bg-[#25311E] px-4 py-2 text-sm font-medium text-[#F6FF6A] hover:bg-[#2D3A24] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon
                      icon={
                        savingFeedbackOrderId === feedbackModalOrder.orderId
                          ? "line-md:loading-loop"
                          : "mdi:send"
                      }
                      className="text-base"
                    />
                    {savingFeedbackOrderId === feedbackModalOrder.orderId
                      ? "Saving..."
                      : "Save Feedback"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (role === "admin") {
    return (
      <>
        <div className={pagePaddingClass}>
          <section className={heroPanelClass}>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-56 bg-[radial-gradient(circle_at_center,rgba(205,214,69,0.16),transparent_70%)]" />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-2xl">
                <span className="rounded-full border border-[#CDD645]/30 bg-[#CDD645]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A]">
                  Bus wise view
                </span>
                <h1 className="mt-3 text-3xl font-bold text-white">{t.orders.allOrders}</h1>
                <p className="mt-2 text-sm text-white/68">
                  {isMobile
                    ? "Compact bus-wise oversight. Tap into any order for the full package view."
                    : isTablet
                      ? "Balanced bus manifests with room for customer and route context."
                      : "Review each bus manifest in a cleaner layout. Every order row now opens the complete package detail page."}
                </p>
              </div>
              <div className="rounded-[1.45rem] border border-white/10 bg-white/[0.06] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Visible buses</p>
                <p className="mt-1 text-2xl font-semibold text-white">{sortedGroupedByBus.length}</p>
              </div>
            </div>
            <div className="relative mt-5">
              <Icon icon="mdi:magnify" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/45" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search bus, tracking ID or customer"
                className="dashboard-input w-full rounded-2xl border-white/10 bg-black/15 py-3 pl-11 pr-4 text-sm placeholder:text-white/40 focus:border-[#CDD645]"
              />
            </div>
          </section>
          {sortedGroupedByBus.length === 0 ? (
            <div className={`${sectionCardClass} mt-6 text-white/65`}>
              {normalizedSearch
                ? "No orders match your search."
                : "No orders found for your buses."}
            </div>
          ) : (
            <div className={`mt-6 ${isMobile ? "space-y-4" : "space-y-5"}`}>
              {sortedGroupedByBus.map((busGroup) => (
                <section key={busGroup.busId} className={sectionCardClass}>
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
                        <div className="dashboard-subsurface flex h-12 w-12 items-center justify-center rounded-lg">
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
                    {busGroup.orders.map((order) => {
                      const officeCollectionTag = getOfficeCollectionTag(order.report);
                      return (
                      <article
                        key={order.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openOrderDetail(order.id)}
                        onKeyDown={(event) => handleCardKeyDown(event, () => openOrderDetail(order.id))}
                        className={`${modernOrderCardClass} ${isMobile ? "p-4 rounded-[1.6rem]" : isTablet ? "p-5 rounded-[1.8rem]" : ""}`}
                      >
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(205,214,69,0.16),transparent_72%)] opacity-0 transition duration-300 group-hover:opacity-100" />
                        <div className="relative flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-[#CDD645]/25 bg-[#CDD645]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A]">
                                Full detail
                              </span>
                              <p className="font-mono text-sm text-[#F6FF6A]">{order.trackingId}</p>
                            </div>
                            <p className="mt-2 text-xs text-white/65">{formatDate(order.orderDate)}</p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${getStatusBadge(order.status)}`}>
                            {order.status}
                          </span>
                        </div>

                        {officeCollectionTag ? (
                          <div className="mt-3 flex">
                            <span className="inline-flex flex-wrap items-center gap-2 rounded-full border border-amber-300/35 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-100 shadow-[0_10px_30px_-20px_rgba(251,191,36,0.8)]">
                              <Icon icon="mdi:store-marker-outline" className="text-sm" />
                              {officeCollectionTag}
                            </span>
                          </div>
                        ) : null}

                        <div className={`relative mt-4 grid gap-3 ${isMobile ? "grid-cols-2" : isTablet ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-4"}`}>
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-white/42">Customer</p>
                            <p className="mt-1 text-sm text-white">{order.user?.name || "--"}</p>
                            <p className="text-xs text-white/55">{order.user?.email || "--"}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-white/42">Amount</p>
                            <p className="mt-1 text-sm text-white">{formatMoney(order.totalAmount)}</p>
                          </div>
                          <div className="rounded-2xl border border-emerald-300/12 bg-emerald-500/6 p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-100/55">From</p>
                            <p className="mt-1 text-sm text-white">{order.pickupLocation?.name || "--"}</p>
                          </div>
                          <div className="rounded-2xl border border-sky-300/12 bg-sky-500/6 p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-sky-100/55">To</p>
                            <p className="mt-1 text-sm text-white">{order.dropLocation?.name || "--"}</p>
                          </div>
                        </div>
                        {order.report ? (
                          <div className="mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-amber-100">
                                {order.report.title ||
                                  (order.report.reportType === "customer_not_at_drop"
                                    ? "Customer not at drop"
                                    : "Customer not at pickup")}
                              </p>
                              <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-100">
                                {order.report.data?.processingStatus === "office_collection_required" ||
                                order.report.status === "office_collection_required"
                                  ? "Office collection"
                                  : "Needs attention"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-amber-50/90">
                              {order.report.description || order.report.data?.guidance || order.report.guidance}
                            </p>
                            <p className="mt-1 text-[11px] text-amber-100/70">
                              {order.report.data?.note || order.report.note}
                            </p>
                          </div>
                        ) : null}
                        {order.operatorNote && !order.report ? (
                          <p className="mt-3 border-l-2 border-amber-300/50 pl-3 text-xs text-amber-100/90">
                            {order.operatorNote}
                          </p>
                        ) : null}
                        <div className="relative mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-4">
                          {!isMobile ? (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60">
                              Open card to view package details
                            </span>
                          ) : (
                            <span className="text-[11px] text-white/48">Tap to inspect full order details.</span>
                          )}
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-[#DDE98D]">
                            {isMobile ? "View" : "View Order"}
                            <Icon icon="mdi:arrow-top-right" className="text-base transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </span>
                        </div>
                      </article>
                      );
                    })}
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
      <div className={pagePaddingClass}>
        <section className={heroPanelClass}>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-56 bg-[radial-gradient(circle_at_center,rgba(205,214,69,0.16),transparent_70%)]" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <span className="rounded-full border border-[#CDD645]/30 bg-[#CDD645]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A]">
                Operator queue
              </span>
              <h1 className="mt-3 text-3xl font-bold text-white">{OPERATOR_ORDER_TAB_LABEL[operatorTab]}</h1>
              <p className="mt-2 text-sm text-white/68">
                {isMobile
                  ? "Short assignment summaries first, full order details on tap."
                  : isTablet
                    ? "Balanced active, upcoming, and past assignment views for touch devices."
                    : "Active, upcoming, and past assignments are grouped into a cleaner workspace. Open any card for the full package detail view."}
              </p>
            </div>
            <div className={`grid gap-3 ${isMobile ? "w-full grid-cols-3" : "sm:grid-cols-3"}`}>
              {OPERATOR_TAB_ORDER.map((tab) => (
                <div key={`summary-${tab}`} className="rounded-[1.35rem] border border-white/10 bg-white/[0.06] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{tab}</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{operatorOrdersByTab[tab].length}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative mt-5">
            <Icon icon="mdi:magnify" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/45" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search tracking ID, customer or bus"
              className="dashboard-input w-full rounded-2xl border-white/10 bg-black/15 py-3 pl-11 pr-4 text-sm placeholder:text-white/40 focus:border-[#CDD645]"
            />
          </div>
        </section>

        <div className={`mt-6 mb-5 flex flex-wrap items-center gap-2 ${isMobile ? "overflow-x-auto pb-1" : ""}`}>
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
          <div className={sectionCardClass}>
            {normalizedSearch ? "No orders match your search." : "No orders found for your assigned buses."}
          </div>
        ) : (
          <div className={`${sectionCardClass} overflow-hidden`}>
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
                    <div className="dashboard-surface rounded-xl p-5 text-sm text-white/65">
                      {normalizedSearch
                        ? `No ${tab} orders match your search.`
                        : `No ${tab} orders found.`}
                    </div>
                  ) : (
                    <div className={sectionStackClass}>
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
