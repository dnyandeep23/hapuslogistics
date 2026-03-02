import {
  type Bus,
  type Company,
  type DashboardDataState,
  type DashboardNotification,
  type Operator,
  type Trip,
  type WalletTransaction,
} from "@/types/dashboard";

const today = new Date();
const oneDay = 24 * 60 * 60 * 1000;
const toDate = (offset: number) =>
  new Date(today.getTime() + offset * oneDay).toISOString().slice(0, 10);

const companies: Company[] = [
  {
    id: "company_alpha",
    name: "Alpha Transit",
    ownerEmail: "admin@alpha.com",
    ownerName: "Rohit S",
    status: "active",
  },
  {
    id: "company_beta",
    name: "Beta Movers",
    ownerEmail: "admin@beta.com",
    ownerName: "Isha P",
    status: "pending",
  },
  {
    id: "company_gamma",
    name: "Gamma Wheels",
    ownerEmail: "admin@gamma.com",
    ownerName: "Neeraj K",
    status: "suspended",
  },
];

const buses: Bus[] = [
  {
    id: "bus_alpha_1",
    companyId: "company_alpha",
    busNumber: "MH12-AB-1101",
    busType: "AC Sleeper",
    busImage: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=1200&q=80",
    seatingCapacity: 42,
    status: "active",
    documents: ["permit-alpha-1.pdf"],
  },
  {
    id: "bus_alpha_2",
    companyId: "company_alpha",
    busNumber: "MH12-AB-1102",
    busType: "Semi Sleeper",
    busImage: "https://images.unsplash.com/photo-1593341646782-e0b495cff86d?w=1200&q=80",
    seatingCapacity: 45,
    status: "active",
    documents: ["insurance-alpha-2.pdf"],
  },
  {
    id: "bus_beta_1",
    companyId: "company_beta",
    busNumber: "MH14-XY-3301",
    busType: "Luxury Coach",
    busImage: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&q=80",
    seatingCapacity: 39,
    status: "maintenance",
    documents: ["fitness-beta-1.pdf"],
  },
];

const operators: Operator[] = [
  {
    id: "operator_1",
    companyId: "company_alpha",
    name: "Amit Driver",
    email: "operator@alpha.com",
    phone: "+91-9990012233",
    status: "active",
    assignedBusId: "bus_alpha_1",
    requestStatus: "approved",
  },
  {
    id: "operator_2",
    companyId: "company_alpha",
    name: "Rahul T",
    email: "rahul@alpha.com",
    phone: "+91-9990013344",
    status: "inactive",
    assignedBusId: "bus_alpha_2",
    requestStatus: "approved",
  },
  {
    id: "operator_3",
    companyId: "company_beta",
    name: "Sana P",
    email: "sana@beta.com",
    phone: "+91-9988001122",
    status: "active",
    assignedBusId: "bus_beta_1",
    requestStatus: "pending",
  },
];

const trips: Trip[] = [
  {
    id: "trip_1",
    companyId: "company_alpha",
    busId: "bus_alpha_1",
    operatorId: "operator_1",
    routeFrom: "Mumbai",
    routeTo: "Pune",
    scheduledDate: toDate(0),
    status: "scheduled",
    isContactVisible: false,
  },
  {
    id: "trip_2",
    companyId: "company_alpha",
    busId: "bus_alpha_2",
    operatorId: "operator_2",
    routeFrom: "Pune",
    routeTo: "Nashik",
    scheduledDate: toDate(1),
    status: "scheduled",
    isContactVisible: false,
  },
  {
    id: "trip_3",
    companyId: "company_alpha",
    busId: "bus_alpha_1",
    operatorId: "operator_1",
    routeFrom: "Mumbai",
    routeTo: "Goa",
    scheduledDate: toDate(-1),
    status: "completed",
    pickupImage: "pickup-trip-3.jpg",
    dropImage: "drop-trip-3.jpg",
    isContactVisible: false,
  },
  {
    id: "trip_4",
    companyId: "company_beta",
    busId: "bus_beta_1",
    operatorId: "operator_3",
    routeFrom: "Surat",
    routeTo: "Ahmedabad",
    scheduledDate: toDate(0),
    status: "live",
    pickupImage: "pickup-trip-4.jpg",
    isContactVisible: true,
  },
];

const walletTransactions: WalletTransaction[] = [
  {
    id: "wallet_1",
    companyId: "company_alpha",
    type: "credit",
    amount: 12800,
    description: "Trip payouts",
    createdAt: new Date(today.getTime() - oneDay).toISOString(),
  },
  {
    id: "wallet_2",
    companyId: "company_alpha",
    type: "debit",
    amount: 2500,
    description: "Fuel expense",
    createdAt: new Date(today.getTime() - 2 * oneDay).toISOString(),
  },
  {
    id: "wallet_3",
    companyId: "company_beta",
    type: "credit",
    amount: 7400,
    description: "Trip payouts",
    createdAt: new Date(today.getTime() - 3 * oneDay).toISOString(),
  },
];

const notifications: DashboardNotification[] = [
  {
    id: "notif_1",
    role: "operator",
    title: "Trip Assigned",
    message: "Mumbai to Pune trip assigned for today.",
    createdAt: new Date().toISOString(),
    isRead: false,
  },
  {
    id: "notif_2",
    role: "admin",
    title: "Operator Request",
    message: "New operator signup pending approval.",
    createdAt: new Date().toISOString(),
    isRead: false,
  },
  {
    id: "notif_3",
    role: "superadmin",
    title: "Company Approval",
    message: "Beta Movers is awaiting onboarding approval.",
    createdAt: new Date().toISOString(),
    isRead: false,
  },
];

export const getInitialDashboardData = (): DashboardDataState => ({
  companies,
  buses,
  operators,
  trips,
  walletTransactions,
  notifications,
});
