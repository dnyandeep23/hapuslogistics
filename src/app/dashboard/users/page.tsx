"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "@/lib/redux/hooks";
import { AppDispatch } from "@/lib/redux/store";
import { clearUser, fetchUser } from "@/lib/redux/userSlice";
import { useDispatch } from "react-redux";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { useToast } from "@/context/ToastContext";
import Skeleton from "@/components/Skeleton";
import ConfirmationModal from "@/components/dashboard/ConfirmationModal";
import { normalizeIndiaPhone } from "@/lib/phone";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

type OperatorStatus =
  | "none"
  | "pending"
  | "operator_requested"
  | "company_requested"
  | "approved"
  | "rejected";

type OperatorRow = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  mustChangePassword?: boolean;
  operatorApprovalStatus: OperatorStatus;
  createdAt: string;
  travelCompanyId?: string;
  pendingTravelCompanyId?: string;
  accountDeletionRequestedAt?: string | null;
  accountDeletionExpiresAt?: string | null;
  assignedBusCount?: number;
  assignedBuses?: Array<{
    busId: string;
    label: string;
  }>;
};

type CompanyOfferRow = {
  companyId: string;
  companyName: string;
  adminEmail?: string;
};

type CurrentCompanyRow = {
  companyId: string;
  companyName: string;
};

type NotificationRow = {
  _id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  isRead: boolean;
  createdAt: string;
};

const statusClasses: Record<OperatorStatus, string> = {
  pending: "border-amber-400/35 bg-amber-400/12 text-amber-200",
  operator_requested: "border-sky-400/35 bg-sky-400/12 text-sky-200",
  company_requested: "border-violet-400/35 bg-violet-400/12 text-violet-200",
  approved: "border-emerald-400/35 bg-emerald-400/12 text-emerald-200",
  rejected: "border-rose-400/35 bg-rose-400/12 text-rose-200",
  none: "border-white/20 bg-white/8 text-white/75",
};

const formatStatus = (status: OperatorStatus) =>
  status.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());

const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN");
};

const operatorStatusMessage = (status: OperatorStatus) => {
  if (status === "approved") {
    return "You are currently connected to a company.";
  }
  if (status === "operator_requested") {
    return "Your join request is pending admin review.";
  }
  if (status === "company_requested") {
    return "A company invited you. Accept or reject the offer below.";
  }
  if (status === "rejected") {
    return "Your previous request was rejected. Contact the admin if you need another review.";
  }
  return "Company requests are handled by the admin. New operator signups are sent automatically.";
};

export default function UsersPage() {
  const { user } = useAppSelector((state) => state.user);
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile } = useResponsiveMode();
  const { addToast } = useToast();

  const [inviteEmail, setInviteEmail] = useState("");
  const [savingInvite, setSavingInvite] = useState(false);

  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const [loadingOperators, setLoadingOperators] = useState(false);
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [operatorActionKey, setOperatorActionKey] = useState("");
  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [deleteOperatorTarget, setDeleteOperatorTarget] = useState<OperatorRow | null>(null);
  const [leaveCompanyConfirmOpen, setLeaveCompanyConfirmOpen] = useState(false);

  const [respondingOffer, setRespondingOffer] = useState(false);
  const [companyOffer, setCompanyOffer] = useState<CompanyOfferRow | null>(null);
  const [loadingCompanyOffer, setLoadingCompanyOffer] = useState(false);
  const [currentCompany, setCurrentCompany] = useState<CurrentCompanyRow | null>(null);
  const [loadingCurrentCompany, setLoadingCurrentCompany] = useState(false);
  const [leavingCurrentCompany, setLeavingCurrentCompany] = useState(false);

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const isAdmin = user?.role === "admin";
  const isOperator = user?.role === "operator";
  const canManageOperators = isAdmin;

  const operatorStatus = (user?.operatorApprovalStatus || "none") as OperatorStatus;
  const sectionClassName = isMobile ? "dashboard-surface rounded-2xl p-4" : "dashboard-surface rounded-2xl p-4 sm:p-5";

  const selectedOperator = useMemo(
    () => operators.find((operator) => operator._id === selectedOperatorId) ?? null,
    [operators, selectedOperatorId],
  );

  const selectedOperatorHasScheduledDeletion = Boolean(
    selectedOperator?.accountDeletionRequestedAt || selectedOperator?.accountDeletionExpiresAt,
  );

  const visibleNotifications = useMemo(
    () => (showAllNotifications ? notifications : notifications.slice(0, 5)),
    [notifications, showAllNotifications],
  );
  const hasNotificationOverflow = notifications.length > 5;

  const loadOperators = async () => {
    if (!canManageOperators) return;

    try {
      setLoadingOperators(true);
      const response = await fetch("/api/admin/operators", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.message || "Failed to load operators.");
        return;
      }

      setOperators(Array.isArray(payload?.operators) ? payload.operators : []);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load operators.");
    } finally {
      setLoadingOperators(false);
    }
  };

  const loadCurrentCompany = async () => {
    if (!isOperator) return;

    try {
      setLoadingCurrentCompany(true);
      const response = await fetch("/api/operator/company-membership", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.message || "Failed to load current company.");
        return;
      }

      setCurrentCompany(payload?.hasCompany ? (payload.company as CurrentCompanyRow) : null);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load current company.");
    } finally {
      setLoadingCurrentCompany(false);
    }
  };

  const loadCompanyOffer = async () => {
    if (!isOperator) return;

    try {
      setLoadingCompanyOffer(true);
      const response = await fetch("/api/operator/company-offer", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.message || "Failed to load company offer.");
        return;
      }

      setCompanyOffer(payload?.hasOffer ? (payload.offer as CompanyOfferRow) : null);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load company offer.");
    } finally {
      setLoadingCompanyOffer(false);
    }
  };

  const loadNotifications = async () => {
    if (!user) return;

    try {
      setLoadingNotifications(true);
      const response = await fetch("/api/notifications", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.message || "Failed to load notifications.");
        return;
      }

      setNotifications(Array.isArray(payload?.notifications) ? payload.notifications : []);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load notifications.");
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    if (isAdmin && pathname === "/dashboard/users") {
      router.replace("/dashboard/operator");
      return;
    }

    if (!isAdmin && !isOperator) {
      router.replace("/dashboard");
      return;
    }

    if (canManageOperators) {
      loadOperators();
      return;
    }

    if (isOperator) {
      loadCurrentCompany();
      loadCompanyOffer();
      loadNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canManageOperators,
    isAdmin,
    isOperator,
    pathname,
    router,
  ]);

  useEffect(() => {
    if (!selectedOperatorId) return;
    if (!operators.some((operator) => operator._id === selectedOperatorId)) {
      setSelectedOperatorId("");
    }
  }, [operators, selectedOperatorId]);

  const markNotificationRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, { method: "PATCH" });
      setNotifications((previous) =>
        previous.map((notification) =>
          notification._id === notificationId
            ? { ...notification, isRead: true }
            : notification,
        ),
      );
    } catch {
      // Ignore read failures.
    }
  };

  const ensureOperatorPhoneBeforeCompanyAction = () => {
    const normalizedPhone = normalizeIndiaPhone(user?.phone);
    if (normalizedPhone) {
      return true;
    }

    addToast("Add a valid contact number in Profile before continuing.", "error");
    router.push("/dashboard/profile");
    return false;
  };

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback("");
    setError("");

    const email = inviteEmail.trim();
    if (!email) {
      setError("Operator email is required.");
      return;
    }

    try {
      setSavingInvite(true);
      const response = await fetch("/api/admin/operators/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message || "Failed to invite operator.");
        return;
      }

      setInviteEmail("");
      setFeedback(payload?.message || "Operator account created.");
      await loadOperators();
      if (typeof payload?.operatorId === "string") {
        setSelectedOperatorId(payload.operatorId);
      }
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to invite operator.");
    } finally {
      setSavingInvite(false);
    }
  };

  const updateOperatorStatus = async (
    operatorId: string,
    action: "approve" | "reject" | "delete",
  ) => {
    setFeedback("");
    setError("");

    const actionKey = `${operatorId}:${action}`;
    try {
      setOperatorActionKey(actionKey);
      const response = await fetch(`/api/admin/operators/${operatorId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message || "Failed to update operator status.");
        return;
      }

      setFeedback(payload?.message || "Operator status updated.");
      await loadOperators();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to update operator status.",
      );
    } finally {
      setOperatorActionKey("");
    }
  };

  const respondToCompanyOffer = async (action: "accept" | "reject") => {
    setFeedback("");
    setError("");
    if (action === "accept" && !ensureOperatorPhoneBeforeCompanyAction()) return;

    try {
      setRespondingOffer(true);
      const response = await fetch("/api/operator/company-offer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const payload = await response.json();
      if (!response.ok) {
        if (payload?.code === "OPERATOR_PHONE_REQUIRED") {
          addToast(
            payload?.message || "Add a valid contact number in Profile before accepting company request.",
            "error",
          );
          router.push("/dashboard/profile");
          return;
        }
        setError(payload?.message || "Failed to update offer.");
        return;
      }

      setFeedback(payload?.message || "Offer updated.");
      await dispatch(fetchUser()).unwrap();
      await loadCurrentCompany();
      await loadCompanyOffer();
      await loadNotifications();
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update offer.");
    } finally {
      setRespondingOffer(false);
    }
  };

  const leaveCurrentCompany = async () => {
    setFeedback("");
    setError("");

    try {
      setLeavingCurrentCompany(true);
      const response = await fetch("/api/operator/company-membership", {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message || "Failed to leave current company.");
        return;
      }

      dispatch(clearUser());
      router.replace(
        typeof payload?.redirectPath === "string"
          ? payload.redirectPath
          : "/operator/login?accountDeleted=true",
      );
      return;
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to leave current company.",
      );
    } finally {
      setLeavingCurrentCompany(false);
    }
  };

  if (isOperator) {
    return (
      <div className="space-y-6">
        <div className={`flex gap-3 ${isMobile ? "flex-col" : "flex-wrap items-end justify-between"}`}>
          <div>
            <h1 className={`font-semibold text-[#F6FF6A] ${isMobile ? "text-2xl" : "text-2xl sm:text-3xl"}`}>Company Management</h1>
            <p className={`mt-1 text-white/70 ${isMobile ? "text-sm leading-6" : "text-sm"}`}>Track your company approval status and operator notifications.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              loadCurrentCompany();
              loadCompanyOffer();
              loadNotifications();
            }}
            className={`inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10 ${isMobile ? "w-full justify-center" : ""}`}
          >
            <Icon icon="solar:refresh-outline" className="text-sm" />
            Refresh
          </button>
        </div>

        <section className={sectionClassName}>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${statusClasses[operatorStatus]}`}>
              {formatStatus(operatorStatus)}
            </span>
            <p className={`text-white/70 ${isMobile ? "text-sm leading-6" : "text-sm"}`}>{operatorStatusMessage(operatorStatus)}</p>
          </div>

          {loadingCompanyOffer && (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-3 w-56" />
              <Skeleton className="h-3 w-44" />
            </div>
          )}

          {operatorStatus === "approved" && (
            <div className="mt-4 rounded-xl border border-emerald-400/35 bg-emerald-400/10 p-3">
              <p className="text-sm text-emerald-100">
                Current company:{" "}
                <span className="font-semibold">
                  {loadingCurrentCompany
                    ? <Skeleton className="inline-block h-4 w-28 align-middle" />
                    : currentCompany?.companyName || "Assigned company"}
                </span>
              </p>
              <div className="mt-3">
                <button
                  type="button"
                  disabled={leavingCurrentCompany || loadingCurrentCompany}
                  onClick={() => setLeaveCompanyConfirmOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-50"
                >
                  <Icon icon="solar:logout-2-outline" className="text-base" />
                  {leavingCurrentCompany ? "Leaving..." : "Leave Current Company"}
                </button>
                <p className="mt-2 text-xs text-white/55">
                  Leaving the company will also delete this operator account.
                </p>
              </div>
            </div>
          )}

          {operatorStatus === "company_requested" && companyOffer && (
            <div className="mt-4 rounded-xl border border-[#D5E400]/35 bg-[#D5E400]/8 p-3">
              <p className="text-sm font-medium text-[#E9F290]">
                You have received a company request from <span className="font-semibold">{companyOffer.companyName}</span>.
              </p>
              <p className="mt-1 text-xs text-white/70">
                Accept this request to join the company, or reject if you do not want to continue.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={respondingOffer}
                  onClick={() => respondToCompanyOffer("accept")}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50"
                >
                  <Icon icon="solar:check-circle-outline" className="text-base" />
                  {respondingOffer ? "Updating..." : "Accept Request"}
                </button>
                <button
                  type="button"
                  disabled={respondingOffer}
                  onClick={() => respondToCompanyOffer("reject")}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-50"
                >
                  <Icon icon="solar:close-circle-outline" className="text-base" />
                  Reject Request
                </button>
              </div>
            </div>
          )}
        </section>

        <section className={sectionClassName}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#E4E67A]">Notifications</h2>
            <span className="dashboard-surface-soft rounded-full px-2 py-1 text-[11px] text-white/65">
              {notifications.length}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {loadingNotifications ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`notification-skeleton-operator-${index}`} className="dashboard-surface-soft rounded-xl p-3">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="mt-2 h-3 w-full" />
                    <Skeleton className="mt-2 h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-white/65">No notifications yet.</p>
            ) : (
              visibleNotifications.map((notification) => (
                <button
                  key={notification._id}
                  type="button"
                  onClick={() => markNotificationRead(notification._id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    notification.isRead
                      ? "dashboard-surface-soft"
                      : "border-[#D5E400]/35 bg-[#D5E400]/10"
                  }`}
                >
                  <p className="text-sm font-medium text-[#E4E67A]">{notification.title}</p>
                  <p className="mt-1 text-xs text-white/70">{notification.message}</p>
                  <p className="mt-2 text-[11px] text-white/45">
                    {new Date(notification.createdAt).toLocaleString("en-IN")}
                  </p>
                </button>
              ))
            )}
          </div>
          {hasNotificationOverflow && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowAllNotifications((prev) => !prev)}
                className="dashboard-surface-soft inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-white/75 transition hover:bg-white/10"
              >
                <Icon icon={showAllNotifications ? "solar:alt-arrow-up-outline" : "solar:alt-arrow-down-outline"} />
                {showAllNotifications ? "Show Latest 5" : `Show All (${notifications.length})`}
              </button>
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-200">
            {error}
          </div>
        )}
        {feedback && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm text-emerald-200">
            {feedback}
          </div>
        )}

        <ConfirmationModal
          isOpen={leaveCompanyConfirmOpen}
          title="Leave Company"
          description="Leaving the company will delete your operator account and sign you out immediately."
          confirmLabel={leavingCurrentCompany ? "Leaving..." : "Leave & Delete"}
          confirmVariant="warning"
          isLoading={leavingCurrentCompany}
          onClose={() => {
            if (leavingCurrentCompany) return;
            setLeaveCompanyConfirmOpen(false);
          }}
          onConfirm={async () => {
            setLeaveCompanyConfirmOpen(false);
            await leaveCurrentCompany();
          }}
        >
          <p className="text-sm text-white/70">
            You will need a new operator account if you want access again later.
          </p>
        </ConfirmationModal>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#F6FF6A] sm:text-3xl">Operator Management</h1>
          <p className="mt-1 text-sm text-white/70">
            Add operator users, review their status, and manage each operator from one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadOperators();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10"
        >
          <Icon icon="solar:refresh-outline" className="text-sm" />
          Refresh
        </button>
      </div>

      <section className={sectionClassName}>
        <h2 className="text-lg font-semibold text-[#E4E67A]">Add Operator User</h2>
        <p className="mt-1 text-sm text-white/65">
          Create an operator account with email only. We&apos;ll send temporary login credentials and prompt the operator to update the password on first login.
        </p>
        <form onSubmit={handleInvite} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            type="email"
            placeholder="operator@email.com"
            className="min-w-0 flex-1 dashboard-input rounded-xl px-4 py-2.5 text-sm transition focus:border-[#D5E400]/60"
          />
          <button
            type="submit"
            disabled={savingInvite}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E400]/60 bg-[#D5E400]/10 px-4 py-2 text-sm font-medium text-[#E4E67A] transition hover:bg-[#D5E400]/20 disabled:opacity-50"
          >
            <Icon icon="solar:user-plus-outline" className="text-base" />
            {savingInvite ? "Adding..." : "Add User"}
          </button>
        </form>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}
      {feedback && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          {feedback}
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(deleteOperatorTarget)}
        title="Delete Operator Account"
        description={
          deleteOperatorTarget
            ? `Delete ${deleteOperatorTarget.name} (${deleteOperatorTarget.email}) permanently?`
            : undefined
        }
        confirmLabel="Delete Account"
        confirmVariant="danger"
        onClose={() => {
          setDeleteOperatorTarget(null);
        }}
        onConfirm={async () => {
          if (!deleteOperatorTarget) return;
          const target = deleteOperatorTarget;
          setDeleteOperatorTarget(null);
          await updateOperatorStatus(target._id, "delete");
        }}
      >
        <div className="space-y-3">
          <p className="text-sm text-white/70">
            This will permanently delete the operator account and remove company-linked assignments.
          </p>
          {(deleteOperatorTarget?.assignedBusCount ?? 0) > 0 ? (
            <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-3">
              <p className="text-sm font-medium text-amber-100">
                Warning: this operator is assigned to {deleteOperatorTarget?.assignedBusCount} bus
                {(deleteOperatorTarget?.assignedBusCount ?? 0) > 1 ? "es" : ""}.
              </p>
              <p className="mt-1 text-xs text-amber-100/80">
                Continuing will delete the operator account and those bus assignments will be removed as well.
              </p>
              {Array.isArray(deleteOperatorTarget?.assignedBuses) && deleteOperatorTarget.assignedBuses.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {deleteOperatorTarget.assignedBuses.slice(0, 6).map((bus) => (
                    <span
                      key={`${deleteOperatorTarget?._id}-${bus.busId}`}
                      className="rounded-full border border-amber-300/30 bg-black/15 px-2.5 py-1 text-[11px] text-amber-50"
                    >
                      {bus.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </ConfirmationModal>

      {selectedOperator ? (
        <section className={sectionClassName}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={() => setSelectedOperatorId("")}
                className="dashboard-surface-soft inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-white/75 transition hover:bg-white/10"
              >
                <Icon icon="solar:alt-arrow-left-outline" className="text-sm" />
                Back to Operators
              </button>
              <h2 className="mt-4 text-xl font-semibold text-[#E4E67A]">{selectedOperator.name}</h2>
              <p className="mt-1 text-sm text-white/70">{selectedOperator.email}</p>
              <p className="mt-1 text-xs text-white/50">
                Added on {new Date(selectedOperator.createdAt).toLocaleDateString("en-IN")}
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${statusClasses[selectedOperator.operatorApprovalStatus]}`}
            >
              {formatStatus(selectedOperator.operatorApprovalStatus)}
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {selectedOperatorHasScheduledDeletion && (
              <div className="rounded-xl border border-rose-400/35 bg-rose-400/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-rose-100">Account Deletion Scheduled</p>
                    <p className="mt-1 text-xs text-rose-100/80">
                      This operator asked to delete the account. If they do not log in again, the account will be deleted automatically after the grace period.
                    </p>
                  </div>
                  <span className="rounded-full border border-rose-300/40 bg-rose-300/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-rose-100">
                    Pending Deletion
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-rose-100/85">
                  {selectedOperator.accountDeletionRequestedAt && (
                    <p>Requested on {formatDateTime(selectedOperator.accountDeletionRequestedAt)}</p>
                  )}
                  {selectedOperator.accountDeletionExpiresAt && (
                    <p>Deletes on {formatDateTime(selectedOperator.accountDeletionExpiresAt)}</p>
                  )}
                </div>
              </div>
            )}

            {(selectedOperator.operatorApprovalStatus === "operator_requested" ||
              selectedOperator.operatorApprovalStatus === "pending" ||
              selectedOperator.operatorApprovalStatus === "company_requested") && (
              <>
                <div className="rounded-xl border border-emerald-400/35 bg-emerald-400/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-emerald-100">Approve Operator</p>
                      <p className="mt-1 text-xs text-emerald-100/80">
                        Approve this operator and attach the account to your company immediately.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={operatorActionKey === `${selectedOperator._id}:approve`}
                      onClick={() => updateOperatorStatus(selectedOperator._id, "approve")}
                      className="rounded-lg border border-emerald-300/45 bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-100 transition hover:bg-emerald-300/20 disabled:opacity-50"
                    >
                      {operatorActionKey === `${selectedOperator._id}:approve` ? "Approving..." : "Approve"}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-rose-400/35 bg-rose-400/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-rose-100">Reject Request</p>
                      <p className="mt-1 text-xs text-rose-100/80">
                        Reject the current operator request and leave the account unlinked.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={operatorActionKey === `${selectedOperator._id}:reject`}
                      onClick={() => updateOperatorStatus(selectedOperator._id, "reject")}
                      className="rounded-lg border border-rose-300/45 bg-rose-300/10 px-3 py-1.5 text-xs text-rose-100 transition hover:bg-rose-300/20 disabled:opacity-50"
                    >
                      {operatorActionKey === `${selectedOperator._id}:reject` ? "Rejecting..." : "Reject"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {selectedOperator.operatorApprovalStatus === "approved" &&
              !selectedOperatorHasScheduledDeletion && (
              <div className="rounded-xl border border-[#D5E400]/35 bg-[#D5E400]/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#F2F7B2]">Manage Bus Assignment</p>
                    <p className="mt-1 text-xs text-white/75">
                      Open bus management for this operator and update assignment periods.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/dashboard/buses?operatorId=${encodeURIComponent(selectedOperator._id)}`)
                    }
                    className="rounded-lg border border-[#D5E400]/45 bg-[#D5E400]/10 px-3 py-1.5 text-xs text-[#F2F7B2] transition hover:bg-[#D5E400]/20"
                  >
                    Manage Bus
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-rose-100">Delete Operator Account</p>
                  <p className="mt-1 text-xs text-rose-100/80">
                    Permanently delete this operator account and remove any related company assignments.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteOperatorTarget(selectedOperator)}
                  className="rounded-lg border border-rose-300/45 bg-rose-300/10 px-3 py-1.5 text-xs text-rose-100 transition hover:bg-rose-300/20 disabled:opacity-50"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className={sectionClassName}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#E4E67A]">Operators</h2>
              <p className="mt-1 text-sm text-white/65">Click an operator to review actions and status.</p>
            </div>
            <span className="dashboard-surface-soft rounded-full px-2 py-1 text-[11px] text-white/65">
              {operators.length}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loadingOperators ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={`operator-grid-skeleton-${index}`} className="dashboard-surface-soft rounded-xl p-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-2 h-3 w-48" />
                  <Skeleton className="mt-4 h-6 w-24 rounded-full" />
                </div>
              ))
            ) : operators.length === 0 ? (
              <div className="dashboard-surface-soft rounded-xl p-4 text-sm text-white/65">
                No operators found for this company yet.
              </div>
            ) : (
              operators.map((operator) => {
                const hasScheduledDeletion = Boolean(
                  operator.accountDeletionRequestedAt || operator.accountDeletionExpiresAt,
                );

                return (
                  <button
                    key={operator._id}
                    type="button"
                    onClick={() => setSelectedOperatorId(operator._id)}
                    className="dashboard-surface-soft rounded-xl p-4 text-left transition hover:border-[#D5E400]/35 hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{operator.name}</p>
                        <p className="mt-1 text-xs text-white/70">{operator.email}</p>
                      </div>
                      <Icon icon="solar:alt-arrow-right-outline" className="text-base text-white/50" />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${statusClasses[operator.operatorApprovalStatus]}`}
                      >
                        {formatStatus(operator.operatorApprovalStatus)}
                      </span>
                      {operator.mustChangePassword && (
                        <span className="rounded-full border border-amber-400/35 bg-amber-400/12 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-200">
                          Temp Password
                        </span>
                      )}
                      {hasScheduledDeletion && (
                        <span className="rounded-full border border-rose-400/35 bg-rose-400/12 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-rose-200">
                          Deletion Scheduled
                        </span>
                      )}
                    </div>
                    {hasScheduledDeletion && operator.accountDeletionExpiresAt && (
                      <p className="mt-3 text-xs text-rose-200/85">
                        Deletes on {formatDateTime(operator.accountDeletionExpiresAt)}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
