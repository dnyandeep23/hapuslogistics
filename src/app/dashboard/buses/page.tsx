"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAppSelector } from "@/lib/redux/hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import CustomDateRangePicker from "@/components/CustomDateRangePicker";
import Skeleton from "@/components/Skeleton";
import ConfirmationModal from "@/components/dashboard/ConfirmationModal";

type OperatorContactPeriod = {
  operatorId: unknown;
  operatorName: string;
  operatorPhone: string;
  startDate?: string;
  endDate?: string;
};

type BusOffice = {
  officeName: string;
  address?: string;
  city: string;
  state: string;
  zip?: string;
  phone: string;
};

type BusRow = {
  _id: string;
  busName: string;
  busNumber: string;
  busImages?: string[];
  offices?: BusOffice[];
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
  accountDeletionRequestedAt?: string | null;
  accountDeletionExpiresAt?: string | null;
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

type OperatorAssignmentWindow = {
  operatorId: string;
  operatorName: string;
  operatorPhone: string;
  startDate: string;
  endDate: string;
  status: "active" | "upcoming" | "past";
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

const summarizeOfficeLabel = (office: BusOffice, index: number) =>
  `${office.officeName || `Office ${index + 1}`}${office.city ? ` · ${office.city}` : ""}`;

const parseDateOnly = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const normalizeDateOnly = (value?: string) => {
  const date = parseDateOnly(value);
  return date ? date.toISOString().slice(0, 10) : "";
};

const formatAssignmentDate = (value?: string) => {
  const date = parseDateOnly(value);
  if (!date) return "--";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

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
  const [deleteBusTarget, setDeleteBusTarget] = useState<BusRow | null>(null);
  const [deleteRescheduleState, setDeleteRescheduleState] = useState<DeleteRescheduleState | null>(null);
  const [rescheduleDeleting, setRescheduleDeleting] = useState(false);

  const isAdmin = user?.role === "admin";

  const loadBuses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/buses", { method: "GET" });
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
  }, []);

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
      [
        bus.busName,
        bus.busNumber,
        ...(Array.isArray(bus.offices)
          ? bus.offices.flatMap((office) => [office.officeName, office.city, office.state, office.phone])
          : []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [buses, query]);

  const approvedOperators = useMemo(
    () =>
      operators.filter(
        (entry) =>
          entry.operatorApprovalStatus === "approved" &&
          !entry.accountDeletionRequestedAt &&
          !entry.accountDeletionExpiresAt,
      ),
    [operators],
  );
  const scheduledDeletionApprovedCount = useMemo(
    () =>
      operators.filter(
        (entry) =>
          entry.operatorApprovalStatus === "approved" &&
          (entry.accountDeletionRequestedAt || entry.accountDeletionExpiresAt),
      ).length,
    [operators],
  );

  const getOperatorAssignmentWindows = useCallback((bus: BusRow): OperatorAssignmentWindow[] => {
    const periods = Array.isArray(bus.operatorContactPeriods) ? bus.operatorContactPeriods : [];
    const today = parseDateOnly(todayISO());

    return periods
      .map((period) => {
        const operatorId = parseId(period.operatorId);
        const startDate = normalizeDateOnly(period.startDate);
        const endDate = normalizeDateOnly(period.endDate);
        if (!operatorId || !startDate || !endDate || !today) return null;

        let status: OperatorAssignmentWindow["status"] = "past";
        if (today.toISOString().slice(0, 10) < startDate) status = "upcoming";
        else if (today.toISOString().slice(0, 10) <= endDate) status = "active";

        return {
          operatorId,
          operatorName: period.operatorName || "Operator",
          operatorPhone: period.operatorPhone || "",
          startDate,
          endDate,
          status,
        };
      })
      .filter((entry): entry is OperatorAssignmentWindow => Boolean(entry))
      .sort((left, right) => {
        const statusWeight = { active: 0, upcoming: 1, past: 2 };
        const statusDelta = statusWeight[left.status] - statusWeight[right.status];
        if (statusDelta !== 0) return statusDelta;
        if (left.status === "past" && right.status === "past") {
          return right.endDate.localeCompare(left.endDate);
        }
        return left.startDate.localeCompare(right.startDate);
      });
  }, []);

  const getAssignedOperators = useCallback((bus: BusRow): AssignedOperatorOption[] => {
    const periods = getOperatorAssignmentWindows(bus);
    const map = new Map<string, AssignedOperatorOption>();

    for (const period of periods) {
      if (!map.has(period.operatorId)) {
        map.set(period.operatorId, {
          operatorId: period.operatorId,
          operatorName: period.operatorName || "Operator",
          operatorPhone: period.operatorPhone || "",
        });
      }
    }

    return Array.from(map.values());
  }, [getOperatorAssignmentWindows]);

  const getAssignedOperatorTags = useCallback((bus: BusRow): string[] => {
    const periods = getOperatorAssignmentWindows(bus);
    if (!periods.length) return [];

    const activeNames = periods
      .filter((period) => period.status === "active")
      .map((period) => String(period.operatorName || "").trim())
      .filter(Boolean);

    if (activeNames.length > 0) {
      return Array.from(new Set(activeNames));
    }

    const allNames = periods
      .map((period) => String(period.operatorName || "").trim())
      .filter(Boolean);
    return Array.from(new Set(allNames));
  }, [getOperatorAssignmentWindows]);

  const closeMenusAndModals = () => {
    setOpenMenuBusId(null);
    setAssignBus(null);
    setAssignOperatorId("");
    setAssignStartDate(todayISO());
    setAssignEndDate(todayISO());
    setAssignDateError("");
    setRemoveBus(null);
    setRemoveOperatorId("");
    setDeleteBusTarget(null);
    setDeleteRescheduleState(null);
  };

  const handleModifyBus = (bus: BusRow) => {
    setOpenMenuBusId(null);
    router.push(`/dashboard/editbus/${encodeURIComponent(bus._id)}`);
  };

  const handleDeleteBus = async (bus: BusRow) => {
    setOpenMenuBusId(null);
    setDeleteBusTarget(bus);
    setDeleteRescheduleState(null);
  };

  const confirmDeleteBus = async () => {
    if (!deleteBusTarget) return;
    const bus = deleteBusTarget;
    setDeleteBusTarget(null);
    setMessage("");
    setError("");
    setDeleteRescheduleState(null);
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
    const assignmentWindows = getOperatorAssignmentWindows(bus);
    const shouldPrefill =
      queryOperatorId &&
      approvedOperators.some((operator) => operator._id === queryOperatorId);
    const preferredOperatorId = shouldPrefill ? queryOperatorId : assignmentWindows[0]?.operatorId ?? "";
    const preferredAssignment = assignmentWindows.find((entry) => entry.operatorId === preferredOperatorId) ?? assignmentWindows[0] ?? null;
    setAssignOperatorId(preferredOperatorId);
    setAssignStartDate(preferredAssignment?.startDate || todayISO());
    setAssignEndDate(preferredAssignment?.endDate || todayISO());
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
          <div className="absolute right-0 z-20 mt-2 w-44 dashboard-surface-soft rounded-lg p-1 shadow-lg">
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
  const assignBusAssignmentWindows = assignBus ? getOperatorAssignmentWindows(assignBus) : [];
  const selectedOperatorAssignments = assignBusAssignmentWindows.filter(
    (assignment) => assignment.operatorId === assignOperatorId,
  );
  const hasConflictingSelectedRange = assignOperatorId
    ? assignBusAssignmentWindows.some(
        (assignment) =>
          assignment.operatorId !== assignOperatorId &&
          assignment.startDate <= assignEndDate &&
          assignment.endDate >= assignStartDate,
      )
    : false;
  const selectedOperatorCoveredAssignment =
    assignOperatorId && assignStartDate && assignEndDate
      ? selectedOperatorAssignments.find(
          (assignment) => assignment.startDate <= assignStartDate && assignment.endDate >= assignEndDate,
        ) ?? null
      : null;
  const selectedOperatorAlreadyAssigned = Boolean(selectedOperatorCoveredAssignment) && !hasConflictingSelectedRange;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#E4E67A] xl:text-3xl">Active Fleet</h1>
          <p className="mt-1.5 text-sm text-white/50">
            Manage your buses, assign operators, and monitor active routes in real-time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard/addbus")}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D5E400] to-[#E4E67A] px-5 py-3 text-sm font-bold text-black shadow-lg shadow-[#D5E400]/20 transition hover:scale-[1.02] active:scale-[0.98]"
        >
          <Icon icon="solar:bus-bold-duotone" className="text-lg" />
          Add New Bus
        </button>
      </div>

      <div className="dashboard-surface flex flex-wrap items-center justify-between gap-4 rounded-3xl p-4 shadow-xl backdrop-blur-xl border border-white/5">
        <div className="relative w-full sm:w-96">
          <Icon icon="solar:magnifer-linear" className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-white/40" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by bus name or number..."
            className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-sm text-white/90 outline-none transition focus:border-[#D5E400]/50 focus:bg-black/60 focus:shadow-[0_0_20px_rgba(213,228,0,0.1)]"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`inline-flex items-center justify-center rounded-xl p-2.5 transition ${viewMode === "grid" ? "bg-[#D5E400]/20 text-[#D5E400]" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`}
            aria-label="Grid View"
          >
            <Icon icon="solar:widget-3-bold-duotone" className="text-xl" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`inline-flex items-center justify-center rounded-xl p-2.5 transition ${viewMode === "list" ? "bg-[#D5E400]/20 text-[#D5E400]" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`}
            aria-label="List View"
          >
            <Icon icon="glyphs:grid-list-bold" className="text-xl" />
          </button>
        </div>
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
              className="dashboard-surface-soft rounded-xl p-4"
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
        <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-white/5 bg-[#141A14]/60 p-8 text-center backdrop-blur-sm">
          <Icon icon="solar:bus-line-duotone" className="mb-4 text-5xl text-white/20" />
          <h3 className="text-lg font-bold text-white/80">No buses found</h3>
          <p className="mt-2 max-w-sm text-sm text-white/50">
            We could not find any fleet entries matching your criteria. Try adjusting your search filters or adding a new bus.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredBuses.map((bus) => {
            const assignedOperatorCount = getAssignedOperators(bus).length;
            const routeStopCount = bus.pricing?.length ?? 0;
            const operatorAssignmentWindows = getOperatorAssignmentWindows(bus);
            return (
              <div key={bus._id} className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#141A14]/80 transition hover:border-white/15 hover:shadow-2xl">
                {/* Visual Header Banner */}
                <div className="h-24 w-full bg-[linear-gradient(to_right,rgba(213,228,0,0.05),transparent)] relative">
                  <div className="absolute top-4 right-4 z-10">
                    {renderActions(bus)}
                  </div>
                  <div className="absolute -bottom-6 left-5 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#141A14] bg-[#1A221A] shadow-xl">
                    <Icon icon="solar:bus-bold-duotone" className="text-2xl text-[#E4E67A]" />
                  </div>
                </div>

                <div className="p-5 pt-8">
                  <h3 className="text-xl font-bold tracking-tight text-white/95 line-clamp-1" title={bus.busName}>{bus.busName}</h3>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="inline-flex rounded-md bg-white/5 px-2 py-1 text-xs font-mono font-medium tracking-wider text-white/50">
                      {bus.busNumber}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-white/40">
                      <Icon icon="solar:users-group-two-rounded-bold-duotone" />
                      {bus.capacity} KG
                    </span>
                  </div>

                  {/* Badges Flow */}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {getAssignedOperatorTags(bus).length > 0 ? (
                      getAssignedOperatorTags(bus).map((operatorName) => (
                        <span
                          key={`${bus._id}-${operatorName}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300"
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          {operatorName}
                        </span>
                      ))
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                        <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                        No Operator
                      </span>
                    )}

                    {bus.autoRenewCapacity && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D5E400]/20 bg-[#D5E400]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#D5E400]">
                        <Icon icon="solar:refresh-circle-bold-duotone" />
                        Auto Renew
                      </span>
                    )}
                  </div>

                  {operatorAssignmentWindows.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {operatorAssignmentWindows.slice(0, 2).map((assignment) => (
                        <div
                          key={`${bus._id}-${assignment.operatorId}-${assignment.startDate}-${assignment.endDate}`}
                          className="rounded-2xl border border-white/6 bg-black/20 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-white/85">{assignment.operatorName}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                                assignment.status === "active"
                                  ? "bg-emerald-400/12 text-emerald-300"
                                  : assignment.status === "upcoming"
                                    ? "bg-amber-400/12 text-amber-300"
                                    : "bg-white/8 text-white/45"
                              }`}
                            >
                              {assignment.status}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-white/55">
                            From {formatAssignmentDate(assignment.startDate)} till {formatAssignmentDate(assignment.endDate)}
                          </p>
                        </div>
                      ))}
                      {operatorAssignmentWindows.length > 2 ? (
                        <p className="px-1 text-[11px] text-white/35">
                          +{operatorAssignmentWindows.length - 2} more assignment period{operatorAssignmentWindows.length - 2 === 1 ? "" : "s"}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Summary Footer */}
                  <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                    <div className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Route Stops</p>
                      <p className="mt-1 font-mono text-base font-bold text-white/90">{routeStopCount}</p>
                    </div>
                    <div className="h-8 w-px bg-white/5" />
                    <div className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Offices</p>
                      <p className="mt-1 font-mono text-base font-bold text-white/90">{bus.offices?.length ?? 0}</p>
                    </div>
                    <div className="h-8 w-px bg-white/5" />
                    <div className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Operators</p>
                      <p className="mt-1 font-mono text-base font-bold text-white/90">{assignedOperatorCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="dashboard-surface overflow-hidden rounded-3xl border border-white/5 shadow-2xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#1A221A] text-xs font-semibold uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-6 py-4">Fleet Entry</th>
                  <th className="px-6 py-4">Capacity</th>
                  <th className="px-6 py-4">Offices</th>
                  <th className="px-6 py-4">Active Operators</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredBuses.map((bus) => (
                  <tr key={bus._id} className="transition hover:bg-white/[0.02]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
                          <Icon icon="solar:bus-bold-duotone" className="text-xl text-[#E4E67A]" />
                        </div>
                        <div>
                          <p className="font-bold text-white/95">{bus.busName}</p>
                          <p className="font-mono text-xs text-white/40">{bus.busNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 font-mono text-xs font-medium text-white/70">
                        {bus.capacity} KG
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {Array.isArray(bus.offices) && bus.offices.length > 0 ? (
                          bus.offices.slice(0, 2).map((office, index) => (
                            <span key={`list-office-${index}`} className="text-xs text-white/60">
                              {summarizeOfficeLabel(office, index)}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-white/40">Unassigned</span>
                        )}
                        {Array.isArray(bus.offices) && bus.offices.length > 2 && (
                          <span className="text-[10px] text-white/30">+{bus.offices.length - 2} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex max-w-[240px] flex-col gap-2">
                        {getOperatorAssignmentWindows(bus).length > 0 ? (
                          getOperatorAssignmentWindows(bus).slice(0, 2).map((assignment) => (
                            <div key={`${bus._id}-list-${assignment.operatorId}-${assignment.startDate}-${assignment.endDate}`}>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  assignment.status === "active"
                                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                    : assignment.status === "upcoming"
                                      ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
                                      : "border-white/10 bg-white/5 text-white/45"
                                }`}
                              >
                                {assignment.operatorName}
                              </span>
                              <p className="mt-1 text-[11px] text-white/45">
                                {formatAssignmentDate(assignment.startDate)} to {formatAssignmentDate(assignment.endDate)}
                              </p>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs italic text-white/40">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">{renderActions(bus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {assignBus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeMenusAndModals} />
          <div className="relative w-full max-w-xl overflow-visible rounded-3xl border border-white/10 bg-[#1A221A] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/20 p-5 rounded-t-[23px]">
              <h2 className="text-xl font-bold text-[#E4E67A]">Assign Operator</h2>
              <button
                type="button"
                onClick={closeMenusAndModals}
                className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <Icon icon="solar:close-circle-bold-duotone" className="text-2xl" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 flex items-center gap-3 rounded-xl bg-white/5 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#D5E400]/20">
                  <Icon icon="solar:bus-bold-duotone" className="text-xl text-[#E4E67A]" />
                </div>
                <div>
                  <p className="font-bold text-white/95">{assignBus.busName}</p>
                  <p className="font-mono text-xs text-white/50">{assignBus.busNumber}</p>
                </div>
              </div>

              <div className="space-y-5">
                <label className="block text-sm font-semibold text-white/80">
                  Select Approved Operator
                  <select
                    value={assignOperatorId}
                    onChange={(event) => setAssignOperatorId(event.target.value)}
                    className="mt-2 block w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-[#D5E400]/50"
                    disabled={loadingOperators}
                  >
                    <option value="">Choose an operator...</option>
                    {approvedOperators.map((operator) => (
                      <option key={operator._id} value={operator._id}>
                        {operator.name || operator.email}
                      </option>
                    ))}
                  </select>
                </label>

                {scheduledDeletionApprovedCount > 0 ? (
                  <p className="text-xs text-amber-300">
                    {scheduledDeletionApprovedCount} approved operator{scheduledDeletionApprovedCount === 1 ? " is" : "s are"} hidden from assignment because account deletion is scheduled.
                  </p>
                ) : null}
                {!loadingOperators && approvedOperators.length === 0 ? (
                  <p className="text-xs text-white/60">
                    No assignable operators are available right now.
                  </p>
                ) : null}

                {selectedOperatorAssignments[0] ? (
                  <div className="rounded-2xl border border-[#D5E400]/15 bg-[#D5E400]/6 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D5E400]">
                      Existing Assignment
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white/90">
                      {selectedOperatorAssignments[0].operatorName} is already assigned on this bus
                    </p>
                    <p className="mt-1 text-xs text-white/65">
                      From {formatAssignmentDate(selectedOperatorAssignments[0].startDate)} till {formatAssignmentDate(selectedOperatorAssignments[0].endDate)}
                    </p>
                    <p className="mt-2 text-xs text-white/55">
                      Reassign only if you want to extend or change the coverage period.
                    </p>
                    {selectedOperatorAlreadyAssigned ? (
                      <p className="mt-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                        This selected date range is already covered. No need to assign this operator again.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <label className="block text-sm font-semibold text-white/80">
                  Assignment Timeline
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
                {assignDateError && <p className="text-xs font-semibold text-red-400">{assignDateError}</p>}
              </div>

              <div className="mt-8 flex justify-end gap-3 pt-5 border-t border-white/10">
                <button
                  type="button"
                  onClick={closeMenusAndModals}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignOperator}
                  disabled={assigning || selectedOperatorAlreadyAssigned}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D5E400] to-[#E4E67A] px-6 py-2.5 text-sm font-bold text-black shadow-lg transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {assigning ? "Assigning..." : selectedOperatorAlreadyAssigned ? "Already Assigned" : "Assign to Fleet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {removeBus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeMenusAndModals} />
          <div className="relative w-full max-w-xl overflow-visible rounded-3xl border border-white/10 bg-[#1A221A] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/20 p-5 rounded-t-[23px]">
              <h2 className="text-xl font-bold text-red-400">Revoke Assignment</h2>
              <button
                type="button"
                onClick={closeMenusAndModals}
                className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <Icon icon="solar:close-circle-bold-duotone" className="text-2xl" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 flex items-center gap-3 rounded-xl bg-white/5 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                  <Icon icon="solar:bus-bold-duotone" className="text-xl text-red-400" />
                </div>
                <div>
                  <p className="font-bold text-white/95">{removeBus.busName}</p>
                  <p className="font-mono text-xs text-white/50">{removeBus.busNumber}</p>
                </div>
              </div>

              <label className="block text-sm font-semibold text-white/80">
                Target Operator
                <select
                  value={removeOperatorId}
                  onChange={(event) => setRemoveOperatorId(event.target.value)}
                  className="mt-2 block w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-red-500/50"
                >
                  <option value="">Select operator to remove</option>
                  {removeBusAssignedOperators.map((operator) => (
                    <option key={operator.operatorId} value={operator.operatorId}>
                      {operator.operatorName}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-8 flex justify-end gap-3 pt-5 border-t border-white/10">
                <button
                  type="button"
                  onClick={closeMenusAndModals}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRemoveOperator}
                  disabled={removing || removeBusAssignedOperators.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-6 py-2.5 text-sm font-bold text-red-400 shadow-lg transition hover:bg-red-500/20 active:scale-[0.98] disabled:opacity-50"
                >
                  <Icon icon="solar:trash-bin-trash-bold" />
                  {removing ? "Revoking..." : "Revoke Access"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(deleteBusTarget)}
        title="Delete Bus"
        description={
          deleteBusTarget
            ? `Delete bus "${deleteBusTarget.busName}" (${deleteBusTarget.busNumber})?`
            : undefined
        }
        confirmLabel={deletingBusId === deleteBusTarget?._id ? "Deleting..." : "Delete Bus"}
        confirmVariant="danger"
        isLoading={Boolean(deleteBusTarget && deletingBusId === deleteBusTarget._id)}
        onClose={() => {
          if (deleteBusTarget && deletingBusId === deleteBusTarget._id) return;
          setDeleteBusTarget(null);
        }}
        onConfirm={confirmDeleteBus}
      >
        <p className="text-sm text-white/70">
          This will remove the bus. If active orders are linked, you will be prompted to reschedule them first.
        </p>
      </ConfirmationModal>

      {deleteRescheduleState && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="dashboard-surface w-full max-w-3xl rounded-2xl p-5">
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

            <div className="mt-4 max-h-72 overflow-auto dashboard-surface-soft rounded-xl p-3">
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
                        className="dashboard-subsurface rounded-lg p-3 text-xs text-white/85"
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
