import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import TravelCompany from "@/app/api/models/travelCompanyModel";
import Notification from "@/app/api/models/notificationModel";
import Order from "@/app/api/models/orderModel";
import { resolveBusContactForDate } from "@/app/api/lib/busContact";

const JWT_SECRET = process.env.JWT_SECRET!;

type UnknownRecord = Record<string, unknown>;

type SupportContact = {
  id: string;
  label: string;
  name: string;
  email: string;
  phone: string;
  source: "owner" | "company" | "order";
};

type SupportRosterMember = {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleLabel: string;
  statusLabel: string;
  statusTone: "emerald" | "amber" | "rose" | "slate";
  accountDeletionRequestedAt?: string | null;
  accountDeletionExpiresAt?: string | null;
  mustChangePassword?: boolean;
};

type SupportNotification = {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  createdAt: string;
  isRead: boolean;
};

type SupportSummary = {
  adminContactPhone: string;
  employeeCount: number;
  directContactCount: number;
  unreadNotifications: number;
  primaryContactLabel: string;
};

const getTokenUserId = (request: NextRequest): string | null => {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id?: string };
    return payload.id ?? null;
  } catch {
    return null;
  }
};

const toStringValue = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object") {
    const maybeHex = (value as { toHexString?: () => string }).toHexString;
    if (typeof maybeHex === "function") {
      const hex = maybeHex.call(value);
      if (hex) return hex;
    }
    const maybeToString = (value as { toString?: () => string }).toString;
    if (typeof maybeToString === "function") {
      const stringified = maybeToString.call(value);
      if (stringified && stringified !== "[object Object]") return stringified;
    }
  }
  return fallback;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const toIsoDate = (value: unknown): string => {
  const date = new Date(toStringValue(value));
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
};

const cleanText = (value: unknown): string => String(value ?? "").trim();

const buildStatus = (operator: UnknownRecord) => {
  const requestedAt = cleanText(operator.accountDeletionRequestedAt);
  const expiresAt = cleanText(operator.accountDeletionExpiresAt);

  if (requestedAt && expiresAt) {
    return {
      label: "Deletion scheduled",
      tone: "amber" as const,
    };
  }

  const approvalStatus = cleanText(operator.operatorApprovalStatus);
  if (
    approvalStatus === "pending" ||
    approvalStatus === "operator_requested" ||
    approvalStatus === "company_requested"
  ) {
    return {
      label: "Awaiting approval",
      tone: "amber" as const,
    };
  }

  if (cleanText(operator.mustChangePassword) === "true") {
    return {
      label: "Password update required",
      tone: "rose" as const,
    };
  }

  return {
    label: "Active",
    tone: "emerald" as const,
  };
};

const pickContactValue = (...values: unknown[]): string => {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) return cleaned;
  }
  return "";
};

const dedupeKey = (contact: SupportContact) =>
  [contact.name, contact.email, contact.phone, contact.source].map((item) => item.trim().toLowerCase()).join("|");

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = getTokenUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(userId)
      .select(
        "name email phone role travelCompanyId pendingTravelCompanyId operatorApprovalStatus accountDeletionRequestedAt accountDeletionExpiresAt mustChangePassword",
      )
      .lean<UnknownRecord | null>();

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
    }

    let companyId = toStringValue(user.travelCompanyId || user.pendingTravelCompanyId);
    let latestOrderSupport: SupportContact | null = null;

    const latestOrder = await Order.findOne({ user: user._id })
      .sort({ orderDate: -1, createdAt: -1 })
      .select("assignedBus bus orderDate trackingId createdAt")
      .populate(
        "assignedBus",
        "travelCompanyId busName busNumber busImages contactPersonName contactPersonNumber operatorContactPeriods",
      )
      .populate(
        "bus",
        "travelCompanyId busName busNumber busImages contactPersonName contactPersonNumber operatorContactPeriods",
      )
      .lean<UnknownRecord | null>();

    if (latestOrder) {
      const orderBusContact =
        resolveBusContactForDate(latestOrder.assignedBus, latestOrder.orderDate) ||
        resolveBusContactForDate(latestOrder.bus, latestOrder.orderDate);

      const orderCompanyId =
        toStringValue((latestOrder.assignedBus as UnknownRecord | null)?.travelCompanyId) ||
        toStringValue((latestOrder.bus as UnknownRecord | null)?.travelCompanyId);

      if (!companyId && orderCompanyId) {
        companyId = orderCompanyId;
      }

      if (orderBusContact) {
        latestOrderSupport = {
          id: orderBusContact._id || toStringValue(latestOrder._id) || "order-support",
          label: "Latest order contact",
          name: pickContactValue(orderBusContact.contactPersonName, orderBusContact.busName, "Order Support"),
          email: "",
          phone: pickContactValue(orderBusContact.contactPersonNumber),
          source: "order",
        };
      }
    }

    const company = companyId
      ? await TravelCompany.findById(companyId)
          .select("_id name ownerUserId ownerEmail contact")
          .lean<UnknownRecord | null>()
      : null;

    const owner = company?.ownerUserId
      ? await User.findById(company.ownerUserId)
          .select("name email phone role")
          .lean<UnknownRecord | null>()
      : null;
    const companyContact = company && isRecord(company.contact) ? company.contact : null;

    const supportContacts: SupportContact[] = [];
    const pushContact = (contact: SupportContact | null) => {
      if (!contact) return;
      const key = dedupeKey(contact);
      if (supportContacts.some((existing) => dedupeKey(existing) === key)) return;
      supportContacts.push(contact);
    };

    if (owner || company) {
      pushContact({
        id: `owner-${toStringValue(owner?._id) || toStringValue(company?._id) || "primary"}`,
        label: "Admin contact",
        name: pickContactValue(owner?.name, company?.name, "Company Admin"),
        email: pickContactValue(owner?.email, company?.ownerEmail, companyContact?.email),
        phone: pickContactValue(owner?.phone, companyContact?.phone),
        source: "owner",
      });
    }

    if (companyContact) {
      pushContact({
        id: `company-${toStringValue(company._id)}`,
        label: "Company desk",
        name: pickContactValue(company.name, "Company Desk"),
        email: pickContactValue(companyContact.email, company?.ownerEmail, owner?.email),
        phone: pickContactValue(companyContact.phone, owner?.phone),
        source: "company",
      });
    }

    pushContact(latestOrderSupport);

    const rosterQuery = company
      ? User.find({
          role: "operator",
          $or: [
            { travelCompanyId: company._id },
            { pendingTravelCompanyId: company._id },
          ],
        })
          .select(
            "name email phone operatorApprovalStatus accountDeletionRequestedAt accountDeletionExpiresAt mustChangePassword createdAt",
          )
          .sort({ createdAt: -1 })
          .lean<UnknownRecord[]>()
      : Promise.resolve([]);

    const [roster, notificationsRaw] = await Promise.all([
      rosterQuery,
      Notification.find({ recipientUserId: user._id })
        .sort({ createdAt: -1 })
        .limit(6)
        .lean<UnknownRecord[]>(),
    ]);

    const supportRoster: SupportRosterMember[] = roster.map((operator) => {
      const status = buildStatus(operator);
      return {
        id: toStringValue(operator._id),
        name: pickContactValue(operator.name, "Operator"),
        email: pickContactValue(operator.email),
        phone: pickContactValue(operator.phone),
        roleLabel: "Operator",
        statusLabel: status.label,
        statusTone: status.tone,
        accountDeletionRequestedAt: cleanText(operator.accountDeletionRequestedAt) || null,
        accountDeletionExpiresAt: cleanText(operator.accountDeletionExpiresAt) || null,
        mustChangePassword: Boolean(operator.mustChangePassword),
      };
    });

    const notifications: SupportNotification[] = notificationsRaw.map((notification) => ({
      id: toStringValue(notification._id),
      title: pickContactValue(notification.title, "Notification"),
      message: pickContactValue(notification.message),
      type: ["info", "success", "warning", "error"].includes(cleanText(notification.type))
        ? (cleanText(notification.type) as SupportNotification["type"])
        : "info",
      createdAt: toIsoDate(notification.createdAt),
      isRead: Boolean(notification.isRead),
    }));

    const summary: SupportSummary = {
      adminContactPhone:
        supportContacts.find((contact) => contact.source === "owner" || contact.source === "company")?.phone ||
        supportContacts[0]?.phone ||
        "",
      employeeCount: supportRoster.length,
      directContactCount: supportContacts.length,
      unreadNotifications: notifications.filter((notification) => !notification.isRead).length,
      primaryContactLabel: supportContacts[0]?.label || "Primary contact",
    };

    return NextResponse.json(
      {
        success: true,
        user: {
          id: toStringValue(user._id),
          name: pickContactValue(user.name),
          email: pickContactValue(user.email),
          phone: pickContactValue(user.phone),
          role: pickContactValue(user.role),
          operatorApprovalStatus: pickContactValue(user.operatorApprovalStatus),
          accountDeletionRequestedAt: cleanText(user.accountDeletionRequestedAt) || null,
          accountDeletionExpiresAt: cleanText(user.accountDeletionExpiresAt) || null,
          mustChangePassword: Boolean(user.mustChangePassword),
        },
        company: company
          ? {
              id: toStringValue(company._id),
              name: pickContactValue(company.name),
              ownerName: pickContactValue(owner?.name),
              ownerEmail: pickContactValue(owner?.email, company.ownerEmail),
              contactEmail: pickContactValue(companyContact?.email),
              contactPhone: pickContactValue(companyContact?.phone),
            }
          : null,
        supportContacts,
        supportRoster,
        notifications,
        summary,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load support hub.",
      },
      { status: 500 },
    );
  }
}
