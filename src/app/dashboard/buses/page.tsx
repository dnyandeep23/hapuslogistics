"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAppSelector } from "@/lib/redux/hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import CustomDateRangePicker from "@/components/CustomDateRangePicker";
import Skeleton from "@/components/Skeleton";

type OperatorContactPeriod = {
  operatorId: unknown;
  operatorName: string;
  operatorPhone: string;
  startDate?: string;
  endDate?: string;
};

type BusRow = {
  _id: string;
  busName: string;
  busNumber: string;
  companyName?: string;
  companyId?: string;
  busImages?: string[];
  capacity: number;
  autoRenewCapacity?: boolean;
  availability?: { date?: string }[];
  pricing?: unknown[];
  operatorContactPeriods?: OperatorContactPeriod[];
};

type OperatorRow = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  operatorApprovalStatus?:
    | "none"
    | "pending"
    | "operator_requested"
    | "company_requested"
    | "approved"
    | "rejected";
};

type AssignedOperatorOption = {
  operatorId: string;
  operatorName: string;
  operatorPhone: string;
};

type DeleteBlockingOrder = {
  id: string;
  trackingId: string;
  status: string;
  orderDate: string;
  senderName: string;
  senderContact: string;
};

type ReplacementBusOption = {
  id: string;
  busName: string;
  busNumber: string;
};

type DeleteRescheduleState = {
  bus: BusRow;
  blockingOrders: DeleteBlockingOrder[];
  replacementBusCandidates: ReplacementBusOption[];
  selectedReplacementBusId: string;
};

const parseId = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "_id" in (value as Record<string, unknown>)) {
    return String((value as { _id?: unknown })._id ?? "");
  }
  if (typeof value === "object" && value !== null && "toString" in (value as Record<string, unknown>)) {
    return String((value as { toString: () => string }).toString());
  }
  return "";
};

const todayISO = () => new Date().toISOString().slice(0, 10);

function AdminBusesPageContent() {
  const { user } = useAppSelector((state) => state.user);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryOperatorId = String(searchParams.get("operatorId") ?? "").trim();
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(false);
  const [loadingOperators, setLoadingOperators] = useState(false);
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [superAdminScope, setSuperAdminScope] = useState<"all" | "my_company">("all");
  const [openMenuBusId, setOpenMenuBusId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [assignBus, setAssignBus] = useState<BusRow | null>(null);
  const [assignOperatorId, setAssignOperatorId] = useState("");
  const [assignStartDate, setAssignStartDate] = useState(todayISO());
  const [assignEndDate, setAssignEndDate] = useState(todayISO());
  const [assignDateError, setAssignDateError] = useState("");
  const [assigning, setAssigning] = useState(false);

  const [removeBus, setRemoveBus] = useState<BusRow | null>(null);
  const [removeOperatorId, setRemoveOperatorId] = useState("");
  const [removing, setRemoving] = useState(false);
  const [deletingBusId, setDeletingBusId] = useState<string | null>(null);
  const [deleteRescheduleState, setDeleteRescheduleState] = useState<DeleteRescheduleState | null>(null);
  const [rescheduleDeleting, setRescheduleDeleting] = useState(false);

  const isAdmin = user?.role === "admin" || user?.isSuperAdmin;
  const isSuperAdmin = Boolean(user?.isSuperAdmin);

  const loadBuses = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (isSuperAdmin) {
        params.set("scope", superAdminScope);
      }
      const endpoint = params.toString()
        ? `/api/admin/buses?${params.toString()}`
        : "/api/admin/buses";
      const response = await fetch(endpoint, { method: "GET" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message || "Failed to load buses.");
        return;
      }
      setBuses(Array.isArray(payload?.buses) ? payload.buses : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load buses.");
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, superAdminScope]);

  const loadOperators = useCallback(async () => {
    try {
      setLoadingOperators(true);
      const response = await fetch("/api/admin/operators", { method: "GET" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message || "Failed to load operators.");
        return;
      }
      setOperators(Array.isArray(payload?.operators) ? payload.operators : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load operators.");
    } finally {
      setLoadingOperators(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      router.replace("/dashboard");
      return;
    }

    loadBuses();
    loadOperators();
  }, [isAdmin, loadBuses, loadOperators, router]);

  const filteredBuses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return buses;

    return buses.filter((bus) =>
      [bus.busName, bus.busNumber]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [buses, query]);

  const approvedOperators = useMemo(
    () => operators.filter((entry) => entry.operatorApprovalStatus === "approved"),
    [operators],
  );

  const getAssignedOperators = useCallback((bus: BusRow): AssignedOperatorOption[] => {
    const periods = Array.isArray(bus.operatorContactPeriods) ? bus.operatorContactPeriods : [];
    const map = new Map<string, AssignedOperatorOption>();

    for (const period of periods) {
      const operatorId = parseId(period.operatorId);
      if (!operatorId) continue;
      if (!map.has(operatorId)) {
        map.set(operatorId, {
          operatorId,
          operatorName: period.operatorName || "Operator",
          operatorPhone: period.operatorPhone || "",
        });
      }
    }

    return Array.from(map.values());
  }, []);

  const getAssignedOperatorTags = useCallback((bus: BusRow): string[] => {
    const periods = Array.isArray(bus.operatorContactPeriods) ? bus.operatorContactPeriods : [];
    if (!periods.length) return [];

    const now = new Date();
    const activeNames = periods
      .filter((period) => {
        const startDate = period.startDate ? new Date(period.startDate) : null;
        const endDate = period.endDate ? new Date(period.endDate) : null;
        if (!startDate || !endDate) return false;
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;
        return now >= startDate && now <= endDate;
      })
      .map((period) => String(period.operatorName || "").trim())
      .filter(Boolean);

    if (activeNames.length > 0) {
      return Array.from(new Set(activeNames));
    }

    const allNames = periods
      .map((period) => String(period.operatorName || "").trim())
      .filter(Boolean);
    return Array.from(new Set(allNames));
  }, []);

  const closeMenusAndModals = () => {
    setOpenMenuBusId(null);
    setAssignBus(null);
    setAssignOperatorId("");
    setAssignStartDate(todayISO());
    setAssignEndDate(todayISO());
    setAssignDateError("");
    setRemoveBus(null);
    setRemoveOperatorId("");
    setDeleteRescheduleState(null);
  };

  const handleModifyBus = (bus: BusRow) => {
    setOpenMenuBusId(null);
    router.push(`/dashboard/editbus/${encodeURIComponent(bus._id)}`);
  };

  const handleDeleteBus = async (bus: BusRow) => {
    setOpenMenuBusId(null);
    setMessage("");
    setError("");
    setDeleteRescheduleState(null);
    const isConfirmed = window.confirm(`Delete bus "${bus.busName}" (${bus.busNumber})?`);
    if (!isConfirmed) return;

    try {
      setDeletingBusId(bus._id);
      const response = await fetch(`/api/admin/buses/${bus._id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409 && payload?.requiresReschedule) {
          const candidates: ReplacementBusOption[] = Array.isArray(payload?.replacementBusCandidates)
            ? payload.replacementBusCandidates
                .map((entry: unknown) => ({
                  id: String((entry as { id?: unknown })?.id ?? ""),
                  busName: String((entry as { busName?: unknown })?.busName ?? ""),
                  busNumber: String((entry as { busNumber?: unknown })?.busNumber ?? ""),
                }))
                .filter((entry: ReplacementBusOption) => Boolean(entry.id))
            : [];
          const blockingOrders = Array.isArray(payload?.blockingOrders)
            ? payload.blockingOrders.map((entry: unknown) => ({
                id: String((entry as { id?: unknown })?.id ?? ""),
                trackingId: String((entry as { trackingId?: unknown })?.trackingId ?? ""),
                status: String((entry as { status?: unknown })?.status ?? ""),
                orderDate: String((entry as { orderDate?: unknown })?.orderDate ?? ""),
                senderName: String((entry as { senderName?: unknown })?.senderName ?? ""),
                senderContact: String((entry as { senderContact?: unknown })?.senderContact ?? ""),
              }))
            : [];

          setDeleteRescheduleState({
            bus,
            blockingOrders,
            replacementBusCandidates: candidates,
            selectedReplacementBusId: candidates[0]?.id ?? "",
          });
          setError(payload?.message || "Reschedule assigned orders before deleting this bus.");
          return;
        }
        setError(payload?.message || "Failed to delete bus.");
        return;
      }
      setMessage(payload?.message || "Bus deleted successfully.");
      await loadBuses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete bus.");
    } finally {
      setDeletingBusId(null);
    }
  };

  const handleRescheduleAndDelete = async () => {
    if (!deleteRescheduleState?.bus?._id) return;
    setError("");
    setMessage("");

    if (!deleteRescheduleState.selectedReplacementBusId) {
      setError("Select a replacement bus before deleting.");
      return;
    }

    try {
      setRescheduleDeleting(true);
      const response = await fetch(`/api/admin/buses/${deleteRescheduleState.bus._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replacementBusId: deleteRescheduleState.selectedReplacementBusId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message || "Failed to reschedule orders and delete bus.");
        return;
      }
      setMessage(payload?.message || "Orders rescheduled and bus deleted successfully.");
      setDeleteRescheduleState(null);
      await loadBuses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reschedule orders and delete bus.");
    } finally {
      setRescheduleDeleting(false);
    }
  };

  const openAssignOperator = (bus: BusRow) => {
    setMessage("");
    setError("");
    setOpenMenuBusId(null);
    setAssignBus(bus);
    const shouldPrefill =
      queryOperatorId &&
      approvedOperators.some((operator) => operator._id === queryOperatorId);
    setAssignOperatorId(shouldPrefill ? queryOperatorId : "");
    const today = todayISO();
    setAssignStartDate(today);
    setAssignEndDate(today);
    setAssignDateError("");
  };

  const handleAssignOperator = async () => {
    if (!assignBus?._id) return;
    setMessage("");
    setError("");
    setAssignDateError("");

    if (!assignOperatorId) {
      setError("Select an operator to assign.");
      return;
    }

    if (!assignStartDate || !assignEndDate) {
      setAssignDateError("Start date and end date are required.");
      return;
    }

    if (assignEndDate < assignStartDate) {
      setAssignDateError("End date cannot be before start date.");
      return;
    }

    try {
      setAssigning(true);
      const response = await fetch(`/api/admin/buses/${assignBus._id}/assign-operator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorId: assignOperatorId,
          startDate: assignStartDate,
          endDate: assignEndDate,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message || "Failed to assign operator.");
        return;
      }
      setMessage(payload?.message || "Operator assigned successfully.");
      closeMenusAndModals();
      await loadBuses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to assign operator.");
    } finally {
      setAssigning(false);
    }
  };

  const openRemoveOperator = (bus: BusRow) => {
    setMessage("");
    setError("");
    setOpenMenuBusId(null);
    setRemoveBus(bus);
    const assigned = getAssignedOperators(bus);
    const shouldPrefill = queryOperatorId && assigned.some((entry) => entry.operatorId === queryOperatorId);
    setRemoveOperatorId(shouldPrefill ? queryOperatorId : assigned[0]?.operatorId ?? "");
  };

  const handleRemoveOperator = async () => {
    if (!removeBus?._id) return;
    setMessage("");
    setError("");

    if (!removeOperatorId) {
      setError("Select an assigned operator to remove.");
      return;
    }

    try {
      setRemoving(true);
      const response = await fetch(`/api/admin/buses/${removeBus._id}/assign-operator`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operatorId: removeOperatorId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message || "Failed to remove operator.");
        return;
      }
      setMessage(payload?.message || "Operator removed from this bus.");
      closeMenusAndModals();
      await loadBuses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove operator.");
    } finally {
      setRemoving(false);
    }
  };

  const renderActions = (bus: BusRow) => {
    const assignedOperators = getAssignedOperators(bus);
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenuBusId((prev) => (prev === bus._id ? null : bus._id))}
          className="rounded-md border border-white/30 p-2 text-white/80 hover:bg-white/10"
          aria-label={`Actions for ${bus.busName}`}
        >
          <Icon icon="mdi:dots-vertical" className="text-lg" />
        </button>

        {openMenuBusId === bus._id && (
          <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-white/20 bg-[#1b2418] p-1 shadow-lg">
            <button
              type="button"
              onClick={() => handleModifyBus(bus)}
              className="w-full rounded-md px-3 py-2 text-left text-xs text-white/90 hover:bg-white/10"
            >
              Modify Bus
            </button>
            <button
              type="button"
              onClick={() => openAssignOperator(bus)}
              className="w-full rounded-md px-3 py-2 text-left text-xs text-white/90 hover:bg-white/10"
            >
              Assign Operator
            </button>
            <button
              type="button"
              onClick={() => openRemoveOperator(bus)}
              disabled={assignedOperators.length === 0}
              className="w-full rounded-md px-3 py-2 text-left text-xs text-white/90 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove Operator
            </button>
            <button
              type="button"
              onClick={() => handleDeleteBus(bus)}
              disabled={deletingBusId === bus._id}
              className="w-full rounded-md px-3 py-2 text-left text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-60"
            >
              {deletingBusId === bus._id ? "Deleting..." : "Delete Bus"}
            </button>
          </div>
        )}
      </div>
    );
  };

  if (!isAdmin) return null;

  const removeBusAssignedOperators = removeBus ? getAssignedOperators(removeBus) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F6FF6A]">My Buses</h1>
          <p className="text-sm text-white/70 mt-1">
            Manage buses here. Operator approval requests remain in Operators module.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard/addbus")}
            className="rounded-md border border-[#D5E400] px-3 py-1.5 text-xs text-[#D5E400] hover:bg-[#D5E400]/10"
          >
            Add Bus
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`rounded-md border px-3 py-1.5 text-xs ${viewMode === "grid" ? "border-[#D5E400] text-[#D5E400]" : "border-white/30 text-white/70"}`}
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded-md border px-3 py-1.5 text-xs ${viewMode === "list" ? "border-[#D5E400] text-[#D5E400]" : "border-white/30 text-white/70"}`}
          >
            List
          </button>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="rounded-2xl border border-[#4E5A45] bg-[#243227] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/70">Scope</span>
            <button
              type="button"
              onClick={() => setSuperAdminScope("all")}
              className={`rounded-full border px-3 py-1 text-xs ${
                superAdminScope === "all"
                  ? "border-[#D5E400]/60 bg-[#D5E400]/10 text-[#D5E400]"
                  : "border-white/25 text-white/70 hover:bg-white/10"
              }`}
            >
              All Companies
            </button>
            <button
              type="button"
              onClick={() => setSuperAdminScope("my_company")}
              className={`rounded-full border px-3 py-1 text-xs ${
                superAdminScope === "my_company"
                  ? "border-[#D5E400]/60 bg-[#D5E400]/10 text-[#D5E400]"
                  : "border-white/25 text-white/70 hover:bg-white/10"
              }`}
            >
              My Company
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#4E5A45] bg-[#243227] p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by bus name or number"
          className="w-full bg-black px-4 pt-4 pb-2 rounded-lg text-base border-b-2 border-white/60 focus:border-white focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      )}
      {message && (
        <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">{message}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`bus-skeleton-${index}`}
              className="rounded-xl border border-white/15 bg-black/25 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
              <div className="mt-3 flex gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredBuses.length === 0 ? (
        <div className="rounded-xl border border-white/20 bg-black/20 p-4 text-white/80">No buses found.</div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredBuses.map((bus) => (
            <div key={bus._id} className="rounded-xl border border-white/15 bg-black/25 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-[#E4E67A]">{bus.busName}</p>
                  <p className="text-xs text-white/60 mt-1">{bus.busNumber}</p>
                  {isSuperAdmin && (
                    <span className="mt-2 inline-flex rounded-full border border-sky-300/40 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200">
                      {bus.companyName || "No company"}
                    </span>
                  )}
                </div>
                {renderActions(bus)}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {getAssignedOperatorTags(bus).length > 0 ? (
                  getAssignedOperatorTags(bus).map((operatorName) => (
                    <span
                      key={`${bus._id}-${operatorName}`}
                      className="rounded-full border border-emerald-300/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200"
                    >
                      {operatorName}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
                    No assigned operator
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/75">
                <p>Capacity: <span className="text-white">{bus.capacity} KG</span></p>
                <p>Route Points: <span className="text-white">{bus.pricing?.length ?? 0}</span></p>
                <p>Auto Renew: <span className="text-white">{bus.autoRenewCapacity ? "Yes" : "No"}</span></p>
                <p>
                  Operators: <span className="text-white">{getAssignedOperators(bus).length}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#4E5A45] bg-[#243227] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black/30 text-left text-white/70">
              <tr>
                <th className="px-4 py-3">Bus</th>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">Route Points</th>
                <th className="px-4 py-3">Operators</th>
                {isSuperAdmin && <th className="px-4 py-3">Company</th>}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBuses.map((bus) => (
                <tr key={bus._id} className="border-t border-white/10 text-white/85">
                  <td className="px-4 py-3">{bus.busName}</td>
                  <td className="px-4 py-3">{bus.busNumber}</td>
                  <td className="px-4 py-3">{bus.capacity} KG</td>
                  <td className="px-4 py-3">{bus.pricing?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {getAssignedOperatorTags(bus).length > 0 ? (
                        getAssignedOperatorTags(bus).map((operatorName) => (
                          <span
                            key={`${bus._id}-list-${operatorName}`}
                            className="rounded-full border border-emerald-300/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200"
                          >
                            {operatorName}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-white/60">No assigned operator</span>
                      )}
                    </div>
                  </td>
                  {isSuperAdmin && <td className="px-4 py-3">{bus.companyName || "--"}</td>}
                  <td className="px-4 py-3 text-right">{renderActions(bus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignBus && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#4E5A45] bg-[#243227] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#E4E67A]">Assign Operator</h2>
              <button
                type="button"
                onClick={closeMenusAndModals}
                className="rounded-md border border-white/30 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-xs text-white/70">
              Bus: {assignBus.busName} ({assignBus.busNumber})
            </p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-white/80 md:col-span-2">
                Operator
                <select
                  value={assignOperatorId}
                  onChange={(event) => setAssignOperatorId(event.target.value)}
                  className="mt-2 block w-full rounded-lg bg-black px-3 py-2 text-white/90 outline-none border border-white/20"
                  disabled={loadingOperators}
                >
                  <option value="" className="text-black">Select approved operator</option>
                  {approvedOperators.map((operator) => (
                    <option key={operator._id} value={operator._id} className="text-black">
                      {operator.name || operator.email} ({operator.email})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-white/80 md:col-span-2">
                Assignment Date Range
                <div className="mt-2">
                  <CustomDateRangePicker
                    startDate={assignStartDate}
                    endDate={assignEndDate}
                    onChange={({ startDate, endDate }) => {
                      setAssignStartDate(startDate);
                      setAssignEndDate(endDate);
                      setAssignDateError("");
                    }}
                    minDate={todayISO()}
                    error={assignDateError}
                  />
                </div>
              </label>
              {assignDateError ? (
                <p className="md:col-span-2 text-xs text-red-400">{assignDateError}</p>
              ) : null}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleAssignOperator}
                disabled={assigning}
                className="rounded-full border border-[#D5E400] px-5 py-2 text-sm font-semibold text-[#D5E400] hover:bg-[#D5E400] hover:text-black disabled:opacity-60"
              >
                {assigning ? "Assigning..." : "Assign Operator"}
              </button>
            </div>
          </div>
        </div>
      )}

      {removeBus && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#4E5A45] bg-[#243227] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#E4E67A]">Remove Operator</h2>
              <button
                type="button"
                onClick={closeMenusAndModals}
                className="rounded-md border border-white/30 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-xs text-white/70">
              Bus: {removeBus.busName} ({removeBus.busNumber})
            </p>

            <label className="mt-4 block text-xs text-white/80">
              Assigned Operator
              <select
                value={removeOperatorId}
                onChange={(event) => setRemoveOperatorId(event.target.value)}
                className="mt-2 block w-full rounded-lg bg-black px-3 py-2 text-white/90 outline-none border border-white/20"
              >
                <option value="" className="text-black">Select operator</option>
                {removeBusAssignedOperators.map((operator) => (
                  <option key={operator.operatorId} value={operator.operatorId} className="text-black">
                    {operator.operatorName} {operator.operatorPhone ? `(${operator.operatorPhone})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleRemoveOperator}
                disabled={removing || removeBusAssignedOperators.length === 0}
                className="rounded-full border border-red-400 px-5 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-60"
              >
                {removing ? "Removing..." : "Remove Operator"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteRescheduleState && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-[#4E5A45] bg-[#243227] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#E4E67A]">Reschedule Orders Before Delete</h2>
              <button
                type="button"
                onClick={() => setDeleteRescheduleState(null)}
                className="rounded-md border border-white/30 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <p className="mt-1 text-xs text-white/70">
              Bus: {deleteRescheduleState.bus.busName} ({deleteRescheduleState.bus.busNumber})
            </p>
            <p className="mt-1 text-xs text-[#f6de9c]">
              {deleteRescheduleState.blockingOrders.length} active order(s) are assigned to this bus.
            </p>

            <label className="mt-4 block text-xs text-white/80">
              Replacement Bus
              <select
                value={deleteRescheduleState.selectedReplacementBusId}
                onChange={(event) =>
                  setDeleteRescheduleState((prev) =>
                    prev
                      ? {
                          ...prev,
                          selectedReplacementBusId: event.target.value,
                        }
                      : prev,
                  )
                }
                className="mt-2 block w-full rounded-lg bg-black px-3 py-2 text-white/90 outline-none border border-white/20"
              >
                <option value="" className="text-black">Select replacement bus</option>
                {deleteRescheduleState.replacementBusCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id} className="text-black">
                    {candidate.busName} ({candidate.busNumber || "N/A"})
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-white/15 bg-black/25 p-3">
              {deleteRescheduleState.blockingOrders.length === 0 ? (
                <p className="text-xs text-white/70">No active orders found.</p>
              ) : (
                <div className="space-y-2">
                  {deleteRescheduleState.blockingOrders.map((order) => {
                    const orderDateLabel = order.orderDate
                      ? new Date(order.orderDate).toLocaleDateString()
                      : "--";
                    return (
                      <div
                        key={order.id}
                        className="rounded-lg border border-white/15 bg-black/35 p-3 text-xs text-white/85"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-[#E4E67A]">
                            {order.trackingId || order.id}
                          </p>
                          <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide">
                            {order.status || "pending"}
                          </span>
                        </div>
                        <p className="mt-1 text-white/70">Order Date: {orderDateLabel}</p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <p>
                            Sender:{" "}
                            <span className="text-white">
                              {order.senderName || "Unknown"}
                              {order.senderContact ? ` (${order.senderContact})` : ""}
                            </span>
                          </p>
                          {order.senderContact ? (
                            <a
                              href={`tel:${order.senderContact}`}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-300/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/20"
                            >
                              <Icon icon="mdi:phone-outline" />
                              Call Sender
                            </a>
                          ) : (
                            <span className="text-[11px] text-white/60">No sender contact</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleRescheduleAndDelete}
                disabled={
                  rescheduleDeleting ||
                  !deleteRescheduleState.selectedReplacementBusId ||
                  deleteRescheduleState.blockingOrders.length === 0
                }
                className="rounded-full border border-[#D5E400] px-5 py-2 text-sm font-semibold text-[#D5E400] hover:bg-[#D5E400] hover:text-black disabled:opacity-60"
              >
                {rescheduleDeleting ? "Rescheduling..." : "Reschedule & Delete Bus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminBusesPage() {
  return (
    <Suspense fallback={<section className="min-h-screen bg-[#11181f]" />}>
      <AdminBusesPageContent />
    </Suspense>
  );
}
