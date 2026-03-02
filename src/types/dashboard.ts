export type DashboardRole = "operator" | "admin" | "superadmin";

export type BusStatus = "active" | "maintenance" | "inactive";
export type OperatorStatus = "active" | "inactive" | "suspended";
export type OperatorRequestStatus = "pending" | "approved" | "rejected";
export type TripStatus = "scheduled" | "live" | "completed";
export type CompanyStatus = "pending" | "active" | "suspended";
export type WalletTransactionType = "credit" | "debit";

export type Bus = {
  id: string;
  companyId: string;
  busNumber: string;
  busType: string;
  busImage?: string;
  seatingCapacity: number;
  status: BusStatus;
  documents: string[];
};

export type Operator = {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  status: OperatorStatus;
  assignedBusId?: string;
  requestStatus: OperatorRequestStatus;
};

export type Trip = {
  id: string;
  companyId: string;
  busId: string;
  operatorId?: string;
  routeFrom: string;
  routeTo: string;
  scheduledDate: string;
  status: TripStatus;
  pickupImage?: string;
  dropImage?: string;
  isContactVisible?: boolean;
};

export type WalletTransaction = {
  id: string;
  companyId: string;
  type: WalletTransactionType;
  amount: number;
  description: string;
  createdAt: string;
};

export type Company = {
  id: string;
  name: string;
  ownerEmail: string;
  ownerName: string;
  status: CompanyStatus;
};

export type DashboardNotification = {
  id: string;
  role: DashboardRole;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
};

export type DashboardDataState = {
  companies: Company[];
  buses: Bus[];
  operators: Operator[];
  trips: Trip[];
  walletTransactions: WalletTransaction[];
  notifications: DashboardNotification[];
};

export type CreateBusInput = {
  busNumber: string;
  busType: string;
  busImage?: string;
  seatingCapacity: number;
  status?: BusStatus;
  documents?: string[];
};

export type UpdateBusInput = Partial<CreateBusInput>;

export type CreateTripInput = {
  busId: string;
  operatorId?: string;
  routeFrom: string;
  routeTo: string;
  scheduledDate: string;
};

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: string;
  roles: DashboardRole[];
  lockForAdminWithoutBus?: boolean;
};
