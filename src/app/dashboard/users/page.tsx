"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAppSelector } from "@/lib/redux/hooks";
import { AppDispatch } from "@/lib/redux/store";
import { fetchUser } from "@/lib/redux/userSlice";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { useToast } from "@/context/ToastContext";
import Skeleton from "@/components/Skeleton";

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
  operatorApprovalStatus: OperatorStatus;
  createdAt: string;
  travelCompanyId?: string;
  pendingTravelCompanyId?: string;
};

type CompanyRow = {
  _id: string;
  name: string;
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

type SuperAdminUserCategory = "admin" | "operator" | "customer";

type SuperAdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  authProvider?: string[];
  isGoogleOnly?: boolean;
  isSuperAdmin?: boolean;
  companyName: string;
  operatorApprovalStatus?: string;
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

const sectionClassName =
  "rounded-2xl border border-white/12 bg-[#1D251A]/90 p-4 sm:p-5 backdrop-blur";
const OPERATOR_PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

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
    return "Your previous request was rejected. You can apply to another company.";
  }
  return "Search for a company and send a request to join.";
};

export default function UsersPage() {
  const { user } = useAppSelector((state) => state.user);
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { addToast } = useToast();

  const [inviteEmail, setInviteEmail] = useState("");
  const [savingInvite, setSavingInvite] = useState(false);

  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const [loadingOperators, setLoadingOperators] = useState(false);
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [operatorActionKey, setOperatorActionKey] = useState("");

  const [companyQuery, setCompanyQuery] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [savingCompanyRequest, setSavingCompanyRequest] = useState(false);
  const [respondingOffer, setRespondingOffer] = useState(false);
  const companyRequestSeqRef = useRef(0);
  const [companyOffer, setCompanyOffer] = useState<CompanyOfferRow | null>(null);
  const [loadingCompanyOffer, setLoadingCompanyOffer] = useState(false);
  const [currentCompany, setCurrentCompany] = useState<CurrentCompanyRow | null>(null);
  const [loadingCurrentCompany, setLoadingCurrentCompany] = useState(false);
  const [leavingCurrentCompany, setLeavingCurrentCompany] = useState(false);

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [superAdminCategory, setSuperAdminCategory] = useState<SuperAdminUserCategory>("customer");
  const [superAdminUsers, setSuperAdminUsers] = useState<SuperAdminUserRow[]>([]);
  const [loadingSuperAdminUsers, setLoadingSuperAdminUsers] = useState(false);
  const [superAdminEmailSearch, setSuperAdminEmailSearch] = useState("");
  const [editingSuperAdminUser, setEditingSuperAdminUser] = useState<SuperAdminUserRow | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [editingPhone, setEditingPhone] = useState("");
  const [editingRole, setEditingRole] = useState("user");
  const [savingSuperAdminEdit, setSavingSuperAdminEdit] = useState(false);

  const isAdmin = user?.role === "admin" && !user?.isSuperAdmin;
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const isOperator = user?.role === "operator";

  const operatorStatus = (user?.operatorApprovalStatus || "none") as OperatorStatus;

  const pendingOperators = useMemo(
    () =>
      operators.filter(
        (operator) =>
          operator.operatorApprovalStatus === "operator_requested" ||
          operator.operatorApprovalStatus === "pending",
      ),
    [operators],
  );

  const offeredOperators = useMemo(
    () => operators.filter((operator) => operator.operatorApprovalStatus === "company_requested"),
    [operators],
  );

  const approvedOperators = useMemo(
    () => operators.filter((operator) => operator.operatorApprovalStatus === "approved"),
    [operators],
  );

  const currentCompanyId = useMemo(
    () => currentCompany?.companyId || String(user?.travelCompanyId ?? ""),
    [currentCompany?.companyId, user?.travelCompanyId],
  );

  const filteredCompanies = useMemo(() => {
    const query = companyQuery.trim().toLowerCase();
    const byQuery = query
      ? companies.filter((company) => company.name.toLowerCase().includes(query))
      : companies;
    if (!currentCompanyId) return byQuery;
    return byQuery.filter((company) => company._id !== currentCompanyId);
  }, [companies, companyQuery, currentCompanyId]);

  const selectedCompanyName = useMemo(
    () => companies.find((company) => company._id === selectedCompanyId)?.name ?? "",
    [companies, selectedCompanyId],
  );

  const visibleNotifications = useMemo(
    () => (showAllNotifications ? notifications : notifications.slice(0, 5)),
    [notifications, showAllNotifications],
  );
  const hasNotificationOverflow = notifications.length > 5;

  const loadOperators = async () => {
    if (!isAdmin) return;

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

  const loadCompanies = async (query = "") => {
    if (!isOperator) return;

    const requestId = companyRequestSeqRef.current + 1;
    companyRequestSeqRef.current = requestId;

    try {
      setLoadingCompanies(true);
      const searchParams = new URLSearchParams({
        q: query,
        _t: String(Date.now()),
      });
      if (currentCompanyId) {
        searchParams.set("excludeCompanyId", currentCompanyId);
      }
      const response = await fetch(
        `/api/travel-companies?${searchParams.toString()}`,
        {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      },
      );
      const payload = await response.json();
      if (requestId !== companyRequestSeqRef.current) return;

      if (!response.ok) {
        setError(payload?.message || "Failed to load travel companies.");
        return;
      }

      setCompanies(Array.isArray(payload?.companies) ? payload.companies : []);
    } catch (requestError: unknown) {
      if (requestId !== companyRequestSeqRef.current) return;
      setError(requestError instanceof Error ? requestError.message : "Failed to load travel companies.");
    } finally {
      if (requestId !== companyRequestSeqRef.current) return;
      setLoadingCompanies(false);
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

  const loadSuperAdminUsers = async (
    category: SuperAdminUserCategory,
    emailSearch = superAdminEmailSearch,
  ) => {
    if (!isSuperAdmin) return;
    try {
      setLoadingSuperAdminUsers(true);
      const params = new URLSearchParams({ category });
      if (emailSearch.trim()) {
        params.set("email", emailSearch.trim());
      }
      const response = await fetch(`/api/superadmin/users?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message || "Failed to load users.");
        setSuperAdminUsers([]);
        return;
      }
      setSuperAdminUsers(Array.isArray(payload?.users) ? payload.users : []);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load users.");
      setSuperAdminUsers([]);
    } finally {
      setLoadingSuperAdminUsers(false);
    }
  };

  const startSuperAdminEdit = (entry: SuperAdminUserRow) => {
    setEditingSuperAdminUser(entry);
    setEditingName(entry.name || "");
    setEditingEmail(entry.email || "");
    setEditingPhone(entry.phone || "");
    setEditingRole(entry.role || "user");
    setFeedback("");
    setError("");
  };

  const closeSuperAdminEdit = () => {
    setEditingSuperAdminUser(null);
    setEditingName("");
    setEditingEmail("");
    setEditingPhone("");
    setEditingRole("user");
  };

  const saveSuperAdminUser = async () => {
    if (!editingSuperAdminUser) return;

    const name = editingName.trim();
    const email = editingEmail.trim().toLowerCase();
    const phone = editingPhone.trim();
    const role = editingRole.trim().toLowerCase();

    if (!name) {
      setError("Name is required.");
      return;
    }
    if (!editingSuperAdminUser.isGoogleOnly && !email) {
      setError("Email is required.");
      return;
    }

    try {
      setSavingSuperAdminEdit(true);
      setFeedback("");
      setError("");

      const response = await fetch("/api/superadmin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingSuperAdminUser.id,
          name,
          email,
          phone,
          role,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message || "Failed to update user.");
        return;
      }

      setFeedback(payload?.message || "User updated successfully.");
      addToast(payload?.message || "User updated successfully.", "success");
      await loadSuperAdminUsers(superAdminCategory);
      closeSuperAdminEdit();
    } catch (requestError: unknown) {
      const message = requestError instanceof Error ? requestError.message : "Failed to update user.";
      setError(message);
    } finally {
      setSavingSuperAdminEdit(false);
    }
  };

  useEffect(() => {
    if (!isAdmin && !isSuperAdmin && !isOperator) {
      router.replace("/dashboard");
      return;
    }

    if (isAdmin) {
      loadOperators();
      loadNotifications();
      return;
    }

    if (isSuperAdmin) {
      loadSuperAdminUsers(superAdminCategory);
      return;
    }

    if (isOperator) {
      loadCurrentCompany();
      loadCompanyOffer();
      loadNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isSuperAdmin, isOperator, superAdminCategory]);

  useEffect(() => {
    if (!isOperator) return;
    loadCompanies(companyQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompanyId, isOperator]);

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
    const normalizedPhone = String(user?.phone ?? "").trim().replace(/[\s()-]/g, "");
    if (normalizedPhone && OPERATOR_PHONE_PATTERN.test(normalizedPhone)) {
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
      setFeedback(payload?.message || "Company offer sent.");
      await loadOperators();
      await loadNotifications();
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to invite operator.");
    } finally {
      setSavingInvite(false);
    }
  };

  const updateOperatorStatus = async (
    operatorId: string,
    action: "approve" | "reject" | "remove",
  ) => {
    setFeedback("");
    setError("");

    if (action === "remove") {
      const shouldContinue = window.confirm(
        "Remove this operator from your company? This will also remove the operator from all company bus assignments.",
      );
      if (!shouldContinue) return;
    }

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
      await loadNotifications();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to update operator status.",
      );
    } finally {
      setOperatorActionKey("");
    }
  };

  const submitCompanyRequest = async () => {
    setFeedback("");
    setError("");

    if (!ensureOperatorPhoneBeforeCompanyAction()) return;

    if (!selectedCompanyId) {
      setError("Please select a company.");
      return;
    }

    try {
      setSavingCompanyRequest(true);
      const response = await fetch("/api/operator/company-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });

      const payload = await response.json();
      if (!response.ok) {
        if (payload?.code === "OPERATOR_PHONE_REQUIRED") {
          addToast(
            payload?.message || "Add contact number in Profile before requesting a company.",
            "error",
          );
          router.push("/dashboard/profile");
          return;
        }
        setError(payload?.message || "Failed to send company request.");
        return;
      }

      setFeedback(payload?.message || "Company request submitted.");
      await dispatch(fetchUser()).unwrap();
      await loadCurrentCompany();
      await loadCompanies(companyQuery);
      await loadNotifications();
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to send company request.");
    } finally {
      setSavingCompanyRequest(false);
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
      await loadCompanies(companyQuery);
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

    const shouldContinue = window.confirm(
      "Leave your current company? You will be removed from company-linked bus assignments.",
    );
    if (!shouldContinue) return;

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

      setSelectedCompanyId("");
      setFeedback(payload?.message || "You left your current company.");
      await dispatch(fetchUser()).unwrap();
      await loadCurrentCompany();
      await loadCompanyOffer();
      await loadCompanies(companyQuery);
      await loadNotifications();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to leave current company.",
      );
    } finally {
      setLeavingCurrentCompany(false);
    }
  };

  if (isSuperAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[#F6FF6A] sm:text-3xl">Users Management</h1>
            <p className="text-sm text-white/70">Filter by category and review users platform-wide.</p>
          </div>
          <button
            type="button"
            onClick={() => loadSuperAdminUsers(superAdminCategory, superAdminEmailSearch)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10"
          >
            <Icon icon="solar:refresh-outline" className="text-sm" />
            Refresh
          </button>
        </div>

        <section className={sectionClassName}>
          <div className="flex flex-wrap gap-2">
            {(["customer", "admin", "operator"] as SuperAdminUserCategory[]).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSuperAdminCategory(category)}
                className={`rounded-xl border px-3 py-2 text-xs font-medium uppercase tracking-wide transition ${
                  superAdminCategory === category
                    ? "border-[#D5E400]/50 bg-[#D5E400]/10 text-[#E4E67A]"
                    : "border-white/20 bg-black/20 text-white/70 hover:border-white/35"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              loadSuperAdminUsers(superAdminCategory, superAdminEmailSearch);
            }}
          >
            <input
              value={superAdminEmailSearch}
              onChange={(event) => setSuperAdminEmailSearch(event.target.value)}
              placeholder="Search by email"
              className="min-w-0 flex-1 rounded-xl border border-white/20 bg-black/25 px-4 py-2.5 text-sm text-white outline-none transition focus:border-[#D5E400]/60"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E400]/60 bg-[#D5E400]/10 px-4 py-2 text-sm font-medium text-[#E4E67A] transition hover:bg-[#D5E400]/20"
            >
              <Icon icon="solar:magnifer-outline" className="text-base" />
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setSuperAdminEmailSearch("");
                loadSuperAdminUsers(superAdminCategory, "");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              Clear
            </button>
          </form>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-white/80">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/50">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Phone</th>
                  <th className="px-2 py-2">Company</th>
                  <th className="px-2 py-2">Auth</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingSuperAdminUsers ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={`superadmin-user-skeleton-${index}`} className="border-b border-white/5">
                      <td className="px-2 py-3" colSpan={7}>
                        <div className="grid grid-cols-7 gap-2">
                          {Array.from({ length: 7 }).map((__, colIndex) => (
                            <Skeleton
                              key={`superadmin-user-skeleton-cell-${index}-${colIndex}`}
                              className="h-4 w-full"
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : superAdminUsers.length === 0 ? (
                  <tr>
                    <td className="px-2 py-3 text-white/65" colSpan={7}>
                      No users found in this category.
                    </td>
                  </tr>
                ) : (
                  superAdminUsers.map((entry) => (
                    <tr key={entry.id} className="border-b border-white/5">
                      <td className="px-2 py-2">{entry.name || "--"}</td>
                      <td className="px-2 py-2">{entry.email || "--"}</td>
                      <td className="px-2 py-2">{entry.phone || "--"}</td>
                      <td className="px-2 py-2">{entry.companyName || "--"}</td>
                      <td className="px-2 py-2">
                        {entry.isGoogleOnly ? (
                          <span className="rounded-full border border-sky-400/35 bg-sky-400/10 px-2 py-0.5 text-[11px] text-sky-200">
                            Google
                          </span>
                        ) : (
                          <span className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 capitalize">{entry.operatorApprovalStatus || entry.role}</td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => startSuperAdminEdit(entry)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#D5E400]/45 bg-[#D5E400]/10 px-2.5 py-1 text-xs font-medium text-[#E4E67A] transition hover:bg-[#D5E400]/20"
                        >
                          <Icon icon="solar:pen-2-outline" className="text-sm" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {editingSuperAdminUser ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/70"
              onClick={closeSuperAdminEdit}
              role="presentation"
            />
            <div className="relative w-full max-w-lg rounded-2xl border border-white/20 bg-[#1D251A] p-5 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#F6FF6A]">Edit User</h2>
                  <p className="text-xs text-white/60">{editingSuperAdminUser.email}</p>
                </div>
                <button
                  type="button"
                  onClick={closeSuperAdminEdit}
                  className="rounded-lg border border-white/20 p-1.5 text-white/80 hover:bg-white/10"
                >
                  <Icon icon="solar:close-circle-outline" className="text-lg" />
                </button>
              </div>

              {editingSuperAdminUser.isGoogleOnly ? (
                <div className="mb-4 rounded-xl border border-sky-400/35 bg-sky-400/10 p-3 text-xs text-sky-100">
                  This is a Google-based user. Email and role are locked. You can modify only name and contact number.
                </div>
              ) : (
                <div className="mb-4 rounded-xl border border-emerald-400/35 bg-emerald-400/10 p-3 text-xs text-emerald-100">
                  Normal-method user: you can modify name, email, contact number, and role.
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-white/60">Name</label>
                  <input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#D5E400]/60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/60">Email</label>
                  <input
                    type="email"
                    value={editingEmail}
                    onChange={(event) => setEditingEmail(event.target.value)}
                    disabled={Boolean(editingSuperAdminUser.isGoogleOnly)}
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#D5E400]/60 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/60">Contact Number</label>
                  <input
                    value={editingPhone}
                    onChange={(event) => setEditingPhone(event.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#D5E400]/60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/60">Role</label>
                  <select
                    value={editingRole}
                    onChange={(event) => setEditingRole(event.target.value)}
                    disabled={Boolean(editingSuperAdminUser.isGoogleOnly)}
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[#D5E400]/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="user">user</option>
                    <option value="operator">operator</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeSuperAdminEdit}
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveSuperAdminUser}
                  disabled={savingSuperAdminEdit}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D5E400]/60 bg-[#D5E400]/10 px-4 py-2 text-sm font-medium text-[#E4E67A] transition hover:bg-[#D5E400]/20 disabled:opacity-50"
                >
                  <Icon icon={savingSuperAdminEdit ? "line-md:loading-loop" : "solar:check-circle-outline"} className="text-sm" />
                  {savingSuperAdminEdit ? "Saving..." : "Save User"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (isOperator) {
    const canSendRequest =
      Boolean(selectedCompanyId) &&
      !savingCompanyRequest &&
      !loadingCompanies &&
      !leavingCurrentCompany &&
      operatorStatus !== "approved" &&
      operatorStatus !== "operator_requested" &&
      operatorStatus !== "company_requested";

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[#F6FF6A] sm:text-3xl">Company Management</h1>
            <p className="mt-1 text-sm text-white/70">Simple flow to connect with a travel company.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              loadCurrentCompany();
              loadCompanies(companyQuery);
              loadCompanyOffer();
              loadNotifications();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10"
          >
            <Icon icon="solar:refresh-outline" className="text-sm" />
            Refresh
          </button>
        </div>

        <section className={sectionClassName}>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${statusClasses[operatorStatus]}`}
            >
              {formatStatus(operatorStatus)}
            </span>
            <p className="text-sm text-white/70">{operatorStatusMessage(operatorStatus)}</p>
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
                  onClick={leaveCurrentCompany}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-50"
                >
                  <Icon icon="solar:logout-2-outline" className="text-base" />
                  {leavingCurrentCompany ? "Leaving..." : "Leave Current Company"}
                </button>
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

        {operatorStatus !== "approved" ? (
          <section className={sectionClassName}>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[#E4E67A]">Find a Travel Company</h2>
              <p className="text-sm text-white/65">Search, select, and send one request.</p>
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={companyQuery}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  setCompanyQuery(nextQuery);
                  setSelectedCompanyId("");
                  loadCompanies(nextQuery);
                }}
                placeholder="Search company name"
                className="w-full rounded-xl border border-white/20 bg-black/25 px-4 py-2.5 text-sm text-white outline-none transition focus:border-[#D5E400]/60"
              />

              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {loadingCompanies ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={`company-skeleton-${index}`} className="h-11 w-full rounded-xl" />
                    ))}
                  </div>
                ) : filteredCompanies.length === 0 ? (
                  <p className="text-sm text-white/65">No company found.</p>
                ) : (
                  filteredCompanies.map((company) => {
                    const isSelected = selectedCompanyId === company._id;
                    return (
                      <button
                        key={company._id}
                        type="button"
                        onClick={() => {
                          setSelectedCompanyId(company._id);
                          setCompanyQuery(company.name);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                          isSelected
                            ? "border-[#D5E400]/50 bg-[#D5E400]/10 text-[#E9F290]"
                            : "border-white/15 bg-black/20 text-white/80 hover:border-white/30"
                        }`}
                      >
                        <span>{company.name}</span>
                        {isSelected && <Icon icon="solar:check-circle-bold" className="text-base" />}
                      </button>
                    );
                  })
                )}
              </div>

              {selectedCompanyName && (
                <p className="text-xs text-white/55">Selected company: {selectedCompanyName}</p>
              )}

              <button
                type="button"
                disabled={!canSendRequest}
                onClick={submitCompanyRequest}
                className="inline-flex items-center gap-2 rounded-xl border border-[#D5E400]/60 bg-[#D5E400]/10 px-4 py-2 text-sm font-medium text-[#E4E67A] transition hover:bg-[#D5E400]/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon icon="solar:paper-plane-outline" className="text-base" />
                {savingCompanyRequest ? "Sending..." : "Send Request"}
              </button>
            </div>
          </section>
        ) : null}

        <section className={sectionClassName}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#E4E67A]">Notifications</h2>
            <span className="rounded-full border border-white/15 bg-black/20 px-2 py-1 text-[11px] text-white/65">
              {notifications.length}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {loadingNotifications ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`notification-skeleton-operator-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
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
                      ? "border-white/10 bg-black/20"
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
                className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-black/20 px-3 py-1.5 text-xs text-white/75 transition hover:bg-black/35"
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#F6FF6A] sm:text-3xl">Operator Management</h1>
          <p className="mt-1 text-sm text-white/70">
            Approve requests, invite operators, and manage approved operators.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadOperators();
            loadNotifications();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10"
        >
          <Icon icon="solar:refresh-outline" className="text-sm" />
          Refresh
        </button>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={`${sectionClassName} py-4`}>
          <p className="text-xs uppercase tracking-wide text-white/55">Pending Requests</p>
          <p className="mt-1 text-2xl font-semibold text-[#E9F290]">{pendingOperators.length}</p>
        </div>
        <div className={`${sectionClassName} py-4`}>
          <p className="text-xs uppercase tracking-wide text-white/55">Offers Sent</p>
          <p className="mt-1 text-2xl font-semibold text-[#E9F290]">{offeredOperators.length}</p>
        </div>
        <div className={`${sectionClassName} py-4`}>
          <p className="text-xs uppercase tracking-wide text-white/55">Approved Operators</p>
          <p className="mt-1 text-2xl font-semibold text-[#E9F290]">{approvedOperators.length}</p>
        </div>
      </section>

      <section className={sectionClassName}>
        <h2 className="text-lg font-semibold text-[#E4E67A]">Send Company Offer</h2>
        <form onSubmit={handleInvite} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            type="email"
            placeholder="operator@email.com"
            className="min-w-0 flex-1 rounded-xl border border-white/20 bg-black/25 px-4 py-2.5 text-sm text-white outline-none transition focus:border-[#D5E400]/60"
          />
          <button
            type="submit"
            disabled={savingInvite}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E400]/60 bg-[#D5E400]/10 px-4 py-2 text-sm font-medium text-[#E4E67A] transition hover:bg-[#D5E400]/20 disabled:opacity-50"
          >
            <Icon icon="solar:mailbox-outline" className="text-base" />
            {savingInvite ? "Sending..." : "Send Offer"}
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

      <section className={sectionClassName}>
        <h2 className="text-lg font-semibold text-[#E4E67A]">Pending Operator Requests</h2>
        <div className="mt-4 space-y-3">
          {loadingOperators ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`pending-operator-skeleton-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-52" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-7 w-16 rounded-full" />
                      <Skeleton className="h-7 w-16 rounded-lg" />
                      <Skeleton className="h-7 w-16 rounded-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : pendingOperators.length === 0 ? (
            <p className="text-sm text-white/65">No pending requests.</p>
          ) : (
            pendingOperators.map((operator) => {
              const approveKey = `${operator._id}:approve`;
              const rejectKey = `${operator._id}:reject`;
              const isUpdating = operatorActionKey === approveKey || operatorActionKey === rejectKey;

              return (
                <div
                  key={operator._id}
                  className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{operator.name}</p>
                      <p className="text-sm text-white/70">{operator.email}</p>
                      <p className="mt-1 text-xs text-white/50">
                        Requested on {new Date(operator.createdAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${statusClasses[operator.operatorApprovalStatus]}`}
                      >
                        {formatStatus(operator.operatorApprovalStatus)}
                      </span>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => updateOperatorStatus(operator._id, "approve")}
                        className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => updateOperatorStatus(operator._id, "reject")}
                        className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 text-xs text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className={sectionClassName}>
        <h2 className="text-lg font-semibold text-[#E4E67A]">Offers Awaiting Response</h2>
        <div className="mt-4 space-y-3">
          {loadingOperators ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={`offered-operator-skeleton-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-52" />
                    </div>
                    <Skeleton className="h-6 w-28 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : offeredOperators.length === 0 ? (
            <p className="text-sm text-white/65">No outgoing offers pending response.</p>
          ) : (
            offeredOperators.map((operator) => (
              <div
                key={operator._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4"
              >
                <div>
                  <p className="font-medium text-white">{operator.name}</p>
                  <p className="text-sm text-white/70">{operator.email}</p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${statusClasses[operator.operatorApprovalStatus]}`}
                >
                  {formatStatus(operator.operatorApprovalStatus)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className={sectionClassName}>
        <h2 className="text-lg font-semibold text-[#E4E67A]">Approved Operators</h2>
        <p className="mt-1 text-xs text-white/60">
          Admin can remove approved operators from company directly from this list.
        </p>

        <div className="mt-4 space-y-3">
          {loadingOperators ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`approved-operator-skeleton-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-52" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-7 w-20 rounded-full" />
                      <Skeleton className="h-7 w-24 rounded-lg" />
                      <Skeleton className="h-7 w-28 rounded-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : approvedOperators.length === 0 ? (
            <p className="text-sm text-white/65">No approved operators.</p>
          ) : (
            approvedOperators.map((operator) => {
              const removeKey = `${operator._id}:remove`;
              const isRemoving = operatorActionKey === removeKey;

              return (
                <div
                  key={operator._id}
                  className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{operator.name}</p>
                      <p className="text-sm text-white/70">{operator.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${statusClasses[operator.operatorApprovalStatus]}`}
                      >
                        {formatStatus(operator.operatorApprovalStatus)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/dashboard/buses?operatorId=${encodeURIComponent(operator._id)}`)
                        }
                        className="rounded-lg border border-[#D5E400]/45 bg-[#D5E400]/10 px-3 py-1.5 text-xs text-[#E4E67A] transition hover:bg-[#D5E400]/20"
                      >
                        Manage Bus
                      </button>
                      <button
                        type="button"
                        disabled={isRemoving}
                        onClick={() => updateOperatorStatus(operator._id, "remove")}
                        className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 text-xs text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-50"
                      >
                        {isRemoving ? "Removing..." : "Remove from Company"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className={sectionClassName}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#E4E67A]">Notifications</h2>
          <span className="rounded-full border border-white/15 bg-black/20 px-2 py-1 text-[11px] text-white/65">
            {notifications.length}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {loadingNotifications ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`notification-skeleton-admin-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
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
                    ? "border-white/10 bg-black/20"
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
              className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-black/20 px-3 py-1.5 text-xs text-white/75 transition hover:bg-black/35"
            >
              <Icon icon={showAllNotifications ? "solar:alt-arrow-up-outline" : "solar:alt-arrow-down-outline"} />
              {showAllNotifications ? "Show Latest 5" : `Show All (${notifications.length})`}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
