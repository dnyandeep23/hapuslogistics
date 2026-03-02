"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import {
  type Bus,
  type Company,
  type CreateBusInput,
  type CreateTripInput,
  type DashboardDataState,
  type DashboardNotification,
  type DashboardRole,
  type Operator,
  type Trip,
  type UpdateBusInput,
  type WalletTransaction,
} from "@/types/dashboard";
import { getInitialDashboardData } from "@/services/dashboard/mockData";

const today = new Date().toISOString().slice(0, 10);

const makeId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

type TripImageType = "pickup" | "drop";

type DashboardDataContextValue = {
  role: DashboardRole;
  userEmail: string;
  userName: string;
  currentCompanyId: string;
  hasAdminBus: boolean;
  selectedBusId: string;
  setSelectedBusId: (busId: string) => void;
  notifications: DashboardNotification[];
  companies: Company[];
  buses: Bus[];
  operators: Operator[];
  trips: Trip[];
  walletTransactions: WalletTransaction[];
  operatorSelf: Operator | null;
  addBus: (input: CreateBusInput) => void;
  updateBus: (busId: string, updates: UpdateBusInput) => void;
  deleteBus: (busId: string) => void;
  inviteOperator: (name: string, email: string, phone: string) => void;
  approveOperator: (operatorId: string) => void;
  rejectOperator: (operatorId: string) => void;
  toggleOperatorStatus: (operatorId: string) => void;
  assignOperatorBus: (operatorId: string, busId: string) => void;
  createTrip: (input: CreateTripInput) => void;
  operatorGoLive: (tripId: string) => { ok: boolean; message: string };
  uploadTripImage: (tripId: string, type: TripImageType, fileName: string) => { ok: boolean; message: string };
  completeTrip: (tripId: string) => { ok: boolean; message: string };
  suspendOperator: (operatorId: string) => void;
  updateCompanyStatus: (companyId: string, status: Company["status"]) => void;
  markNotificationRead: (id: string) => void;
};

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

const roleFallbackCompanyId = (email: string) => `company_${email.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;

type ProviderProps = {
  role: DashboardRole;
  userEmail: string;
  userName: string;
  children: React.ReactNode;
};

export function DashboardDataProvider({ role, userEmail, userName, children }: ProviderProps) {
  const [state, setState] = useState<DashboardDataState>(() => getInitialDashboardData());

  const adminCompany = useMemo(
    () => state.companies.find((company) => company.ownerEmail.toLowerCase() === userEmail.toLowerCase()),
    [state.companies, userEmail],
  );

  const operatorSelf = useMemo(
    () => state.operators.find((operator) => operator.email.toLowerCase() === userEmail.toLowerCase()) ?? null,
    [state.operators, userEmail],
  );

  const currentCompanyId = useMemo(() => {
    if (role === "superadmin") return "platform";
    if (role === "admin") return adminCompany?.id ?? roleFallbackCompanyId(userEmail);
    return operatorSelf?.companyId ?? (adminCompany?.id ?? "company_alpha");
  }, [role, adminCompany?.id, operatorSelf?.companyId, userEmail]);

  const scopedCompanies = useMemo(() => {
    if (role === "superadmin") return state.companies;
    if (role === "admin") {
      return adminCompany
        ? [adminCompany]
        : [
            {
              id: currentCompanyId,
              name: "My Logistics Company",
              ownerEmail: userEmail,
              ownerName: userName,
              status: "active" as const,
            },
          ];
    }

    const opCompany = state.companies.find((company) => company.id === currentCompanyId);
    return opCompany ? [opCompany] : [];
  }, [role, state.companies, adminCompany, currentCompanyId, userEmail, userName]);

  const scopedBuses = useMemo(() => {
    if (role === "superadmin") return state.buses;
    return state.buses.filter((bus) => bus.companyId === currentCompanyId);
  }, [role, state.buses, currentCompanyId]);

  const scopedOperators = useMemo(() => {
    if (role === "superadmin") return state.operators;
    if (role === "operator") return operatorSelf ? [operatorSelf] : [];
    return state.operators.filter((operator) => operator.companyId === currentCompanyId);
  }, [role, state.operators, currentCompanyId, operatorSelf]);

  const scopedTrips = useMemo(() => {
    if (role === "superadmin") return state.trips;
    if (role === "operator") {
      return state.trips.filter((trip) => trip.operatorId === operatorSelf?.id);
    }
    return state.trips.filter((trip) => trip.companyId === currentCompanyId);
  }, [role, state.trips, currentCompanyId, operatorSelf?.id]);

  const scopedWalletTransactions = useMemo(() => {
    if (role === "superadmin") return state.walletTransactions;
    return state.walletTransactions.filter((entry) => entry.companyId === currentCompanyId);
  }, [role, state.walletTransactions, currentCompanyId]);

  const scopedNotifications = useMemo(
    () => state.notifications.filter((notification) => notification.role === role),
    [state.notifications, role],
  );

  const [selectedBusId, setSelectedBusId] = useState(() => {
    if (operatorSelf?.assignedBusId && scopedBuses.some((bus) => bus.id === operatorSelf.assignedBusId)) {
      return operatorSelf.assignedBusId;
    }
    return scopedBuses[0]?.id ?? "";
  });

  const hasAdminBus = role !== "admin" || scopedBuses.length > 0;

  const markNotificationRead = (id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification,
      ),
    }));
  };

  const addBus = (input: CreateBusInput) => {
    if (role !== "admin") return;
    setState((prev) => ({
      ...prev,
      buses: [
        ...prev.buses,
        {
          id: makeId("bus"),
          companyId: currentCompanyId,
          busNumber: input.busNumber,
          busType: input.busType,
          busImage: input.busImage,
          seatingCapacity: input.seatingCapacity,
          status: input.status ?? "active",
          documents: input.documents ?? [],
        },
      ],
    }));
  };

  const updateBus = (busId: string, updates: UpdateBusInput) => {
    if (role !== "admin") return;
    setState((prev) => ({
      ...prev,
      buses: prev.buses.map((bus) =>
        bus.id === busId && bus.companyId === currentCompanyId
          ? {
              ...bus,
              busNumber: updates.busNumber ?? bus.busNumber,
              busType: updates.busType ?? bus.busType,
              busImage: updates.busImage ?? bus.busImage,
              seatingCapacity: updates.seatingCapacity ?? bus.seatingCapacity,
              status: updates.status ?? bus.status,
              documents: updates.documents ?? bus.documents,
            }
          : bus,
      ),
    }));
  };

  const deleteBus = (busId: string) => {
    if (role !== "admin") return;
    setState((prev) => ({
      ...prev,
      buses: prev.buses.filter((bus) => !(bus.id === busId && bus.companyId === currentCompanyId)),
      trips: prev.trips.filter((trip) => trip.busId !== busId),
      operators: prev.operators.map((operator) =>
        operator.assignedBusId === busId ? { ...operator, assignedBusId: undefined } : operator,
      ),
    }));
  };

  const inviteOperator = (name: string, email: string, phone: string) => {
    if (role !== "admin") return;
    setState((prev) => ({
      ...prev,
      operators: [
        ...prev.operators,
        {
          id: makeId("operator"),
          companyId: currentCompanyId,
          name,
          email,
          phone,
          status: "inactive",
          requestStatus: "pending",
        },
      ],
    }));
  };

  const approveOperator = (operatorId: string) => {
    if (role !== "admin") return;
    setState((prev) => ({
      ...prev,
      operators: prev.operators.map((operator) =>
        operator.id === operatorId && operator.companyId === currentCompanyId
          ? { ...operator, requestStatus: "approved", status: "active" }
          : operator,
      ),
    }));
  };

  const rejectOperator = (operatorId: string) => {
    if (role !== "admin") return;
    setState((prev) => ({
      ...prev,
      operators: prev.operators.map((operator) =>
        operator.id === operatorId && operator.companyId === currentCompanyId
          ? { ...operator, requestStatus: "rejected", status: "inactive" }
          : operator,
      ),
    }));
  };

  const toggleOperatorStatus = (operatorId: string) => {
    if (role === "operator") return;
    setState((prev) => ({
      ...prev,
      operators: prev.operators.map((operator) => {
        const canUpdate =
          operator.id === operatorId && (role === "superadmin" || operator.companyId === currentCompanyId);
        if (!canUpdate) return operator;

        if (operator.status === "active") return { ...operator, status: "inactive" };
        if (operator.status === "inactive") return { ...operator, status: "active" };
        return operator;
      }),
    }));
  };

  const suspendOperator = (operatorId: string) => {
    if (role !== "superadmin") return;
    setState((prev) => ({
      ...prev,
      operators: prev.operators.map((operator) =>
        operator.id === operatorId ? { ...operator, status: "suspended" } : operator,
      ),
    }));
  };

  const assignOperatorBus = (operatorId: string, busId: string) => {
    if (role !== "admin") return;
    setState((prev) => ({
      ...prev,
      operators: prev.operators.map((operator) =>
        operator.id === operatorId && operator.companyId === currentCompanyId
          ? { ...operator, assignedBusId: busId }
          : operator,
      ),
    }));
  };

  const createTrip = (input: CreateTripInput) => {
    if (role !== "admin") return;
    setState((prev) => ({
      ...prev,
      trips: [
        ...prev.trips,
        {
          id: makeId("trip"),
          companyId: currentCompanyId,
          busId: input.busId,
          operatorId: input.operatorId,
          routeFrom: input.routeFrom,
          routeTo: input.routeTo,
          scheduledDate: input.scheduledDate,
          status: "scheduled",
          isContactVisible: false,
        },
      ],
    }));
  };

  const operatorGoLive = (tripId: string) => {
    if (role !== "operator") {
      return { ok: false, message: "Only operator can start a trip." };
    }

    if (!selectedBusId) {
      return { ok: false, message: "Select a bus before going live." };
    }

    const trip = scopedTrips.find((entry) => entry.id === tripId);
    if (!trip) {
      return { ok: false, message: "Trip not found." };
    }

    if (trip.scheduledDate !== today || trip.status !== "scheduled") {
      return { ok: false, message: "Only today's scheduled trip can go live." };
    }

    if (trip.busId !== selectedBusId) {
      return { ok: false, message: "Selected bus does not match this trip." };
    }

    setState((prev) => ({
      ...prev,
      trips: prev.trips.map((entry) =>
        entry.id === tripId ? { ...entry, status: "live", isContactVisible: true } : entry,
      ),
    }));

    return { ok: true, message: "Trip is live now." };
  };

  const uploadTripImage = (tripId: string, type: TripImageType, fileName: string) => {
    if (role !== "operator") {
      return { ok: false, message: "Only operator can upload trip images." };
    }

    const trip = scopedTrips.find((entry) => entry.id === tripId);
    if (!trip) {
      return { ok: false, message: "Trip not found." };
    }

    setState((prev) => ({
      ...prev,
      trips: prev.trips.map((entry) =>
        entry.id === tripId
          ? {
              ...entry,
              pickupImage: type === "pickup" ? fileName : entry.pickupImage,
              dropImage: type === "drop" ? fileName : entry.dropImage,
            }
          : entry,
      ),
    }));

    return { ok: true, message: `${type === "pickup" ? "Pickup" : "Drop"} image uploaded.` };
  };

  const completeTrip = (tripId: string) => {
    if (role !== "operator") {
      return { ok: false, message: "Only operator can complete trips." };
    }

    const trip = scopedTrips.find((entry) => entry.id === tripId);
    if (!trip) {
      return { ok: false, message: "Trip not found." };
    }

    if (trip.status !== "live") {
      return { ok: false, message: "Trip must be live before completion." };
    }

    if (!trip.pickupImage || !trip.dropImage) {
      return { ok: false, message: "Upload both pickup and drop images before completion." };
    }

    setState((prev) => ({
      ...prev,
      trips: prev.trips.map((entry) =>
        entry.id === tripId ? { ...entry, status: "completed", isContactVisible: false } : entry,
      ),
    }));

    return { ok: true, message: "Trip completed successfully." };
  };

  const updateCompanyStatus = (companyId: string, status: Company["status"]) => {
    if (role !== "superadmin") return;
    setState((prev) => ({
      ...prev,
      companies: prev.companies.map((company) =>
        company.id === companyId ? { ...company, status } : company,
      ),
    }));
  };

  const value: DashboardDataContextValue = {
    role,
    userEmail,
    userName,
    currentCompanyId,
    hasAdminBus,
    selectedBusId,
    setSelectedBusId,
    notifications: scopedNotifications,
    companies: scopedCompanies,
    buses: scopedBuses,
    operators: scopedOperators,
    trips: scopedTrips,
    walletTransactions: scopedWalletTransactions,
    operatorSelf,
    addBus,
    updateBus,
    deleteBus,
    inviteOperator,
    approveOperator,
    rejectOperator,
    toggleOperatorStatus,
    assignOperatorBus,
    createTrip,
    operatorGoLive,
    uploadTripImage,
    completeTrip,
    suspendOperator,
    updateCompanyStatus,
    markNotificationRead,
  };

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData() {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error("useDashboardData must be used inside DashboardDataProvider");
  }
  return context;
}
