"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useAppSelector } from "@/lib/redux/hooks";
import Skeleton from "@/components/Skeleton";

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

type SupportCompany = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  contactEmail: string;
  contactPhone: string;
};

type SupportSummary = {
  adminContactPhone: string;
  employeeCount: number;
  directContactCount: number;
  unreadNotifications: number;
  primaryContactLabel: string;
};

type SupportHubResponse = {
  success: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: "user" | "operator" | "admin";
    operatorApprovalStatus?: string;
    accountDeletionRequestedAt?: string | null;
    accountDeletionExpiresAt?: string | null;
    mustChangePassword?: boolean;
  };
  company: SupportCompany | null;
  supportContacts: SupportContact[];
  supportRoster: SupportRosterMember[];
  notifications: SupportNotification[];
  summary: SupportSummary;
  message?: string;
};

const roleLabels: Record<SupportHubResponse["user"]["role"], string> = {
  user: "Customer",
  operator: "Operator",
  admin: "Admin",
};

const roleIcons: Record<SupportHubResponse["user"]["role"], string> = {
  user: "solar:user-id-bold-duotone",
  operator: "solar:shield-user-bold-duotone",
  admin: "solar:crown-bold-duotone",
};

const roleAccents: Record<SupportHubResponse["user"]["role"], string> = {
  user: "from-[#d5e400]/20 via-[#87d37c]/10 to-transparent",
  operator: "from-[#73f0c5]/20 via-[#1f9d79]/10 to-transparent",
  admin: "from-[#f7d36b]/22 via-[#ff9d4d]/12 to-transparent",
};

const notificationIcons: Record<SupportNotification["type"], string> = {
  info: "solar:info-circle-bold-duotone",
  success: "solar:check-circle-bold-duotone",
  warning: "solar:danger-triangle-bold-duotone",
  error: "solar:shield-cross-bold-duotone",
};

const contactSourceIcons: Record<SupportContact["source"], string> = {
  owner: "solar:user-bold-duotone",
  company: "solar:buildings-bold-duotone",
  order: "solar:box-bold-duotone",
};

const rosterToneClasses: Record<SupportRosterMember["statusTone"], string> = {
  emerald: "border-emerald-400/35 bg-emerald-500/10 text-emerald-100",
  amber: "border-amber-400/35 bg-amber-500/10 text-amber-100",
  rose: "border-rose-400/35 bg-rose-500/10 text-rose-100",
  slate: "border-white/15 bg-white/5 text-white/70",
};

const typeToneClasses: Record<SupportNotification["type"], string> = {
  info: "border-sky-400/30 bg-sky-500/10 text-sky-100",
  success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  warning: "border-amber-400/30 bg-amber-500/10 text-amber-100",
  error: "border-rose-400/30 bg-rose-500/10 text-rose-100",
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildContactValue(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function toTelHref(phone: string): string {
  const normalized = phone.trim().replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : "";
}

function toMailHref(email: string): string {
  const normalized = email.trim();
  return normalized ? `mailto:${normalized}` : "";
}

function ContactActionButton({
  href,
  icon,
  label,
  onClick,
  highlight = false,
}: {
  href?: string;
  icon: string;
  label: string;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const commonClassName = `inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
    highlight
      ? "border-lime-300/25 bg-lime-300/12 text-lime-100 hover:bg-lime-300/16"
      : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10"
  }`;

  if (href) {
    return (
      <a href={href} className={commonClassName}>
        <Icon icon={icon} className="text-base" />
        {label}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={commonClassName}>
      <Icon icon={icon} className="text-base" />
      {label}
    </button>
  );
}

export default function SupportPage() {
  const { user } = useAppSelector((state) => state.user);
  const [data, setData] = useState<SupportHubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => {
    let active = true;

    const loadSupportHub = async () => {
      if (!user) return;

      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/dashboard/support", {
          cache: "no-store",
        });
        const payload = (await response.json()) as SupportHubResponse & { message?: string };

        if (!response.ok) {
          if (!active) return;
          setData(null);
          setError(payload?.message || "Failed to load support hub.");
          return;
        }

        if (!active) return;
        setData(payload);
      } catch (fetchError: unknown) {
        if (!active) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load support hub.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSupportHub();

    return () => {
      active = false;
    };
  }, [user]);

  const role = (user?.role ?? "user") as SupportHubResponse["user"]["role"];
  const companyName = data?.company?.name || "Independent support workspace";
  const supportContacts = data?.supportContacts ?? [];
  const supportRoster = data?.supportRoster ?? [];
  const notifications = data?.notifications ?? [];
  const primaryContact = supportContacts[0] ?? null;
  const summary = data?.summary ?? {
    adminContactPhone: "",
    employeeCount: supportRoster.length,
    directContactCount: supportContacts.length,
    unreadNotifications: notifications.filter((notification) => !notification.isRead).length,
    primaryContactLabel: primaryContact?.label || "Primary contact",
  };

  const adminHotline = buildContactValue(
    summary.adminContactPhone,
    primaryContact?.phone,
    data?.company?.contactPhone,
  );

  const primarySubtitle =
    role === "user"
      ? "Track delivery help, payment support, and company contacts without digging through long text blocks."
      : role === "operator"
        ? "Keep the admin hotline, employee directory, and approval updates within quick reach."
        : "Run operations from one support cockpit with direct contacts, employee visibility, and live alerts.";

  const supportHighlights = useMemo(
    () => [
      {
        label: "Admin hotline",
        value: adminHotline || "Not configured",
        icon: "solar:phone-calling-bold-duotone",
      },
      {
        label: "Direct contacts",
        value: `${summary.directContactCount}`,
        icon: "solar:users-group-rounded-bold-duotone",
      },
      {
        label: "Employees",
        value: `${summary.employeeCount}`,
        icon: "solar:user-hand-up-bold-duotone",
      },
      {
        label: "Unread alerts",
        value: `${summary.unreadNotifications}`,
        icon: "solar:bell-bold-duotone",
      },
    ],
    [adminHotline, summary.directContactCount, summary.employeeCount, summary.unreadNotifications],
  );

  const playbook = [
    "Call the admin hotline first for urgent access or shipment blockers.",
    "Use the employee directory when you need the right operator instead of a generic desk number.",
    "Watch the alert stream for approvals, password resets, and account status changes.",
  ];

  const handleCopy = async (contact: SupportContact) => {
    const text = buildContactValue(contact.phone, contact.email);
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(contact.id);
      window.setTimeout(() => setCopiedId(""), 1800);
    } catch {
      setCopiedId("");
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-7xl pb-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-0 h-64 w-64 rounded-full bg-lime-400/10 blur-3xl" />
        <div className="absolute right-[-2rem] top-12 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
      </div>

      <div className="relative space-y-6">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(140deg,rgba(16,22,17,0.96),rgba(27,39,24,0.88),rgba(13,19,15,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)] backdrop-blur sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="relative">
              <div className={`pointer-events-none absolute inset-x-0 top-0 h-56 rounded-[32px] bg-gradient-to-r ${roleAccents[role]} blur-3xl`} />

              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-lime-100">
                  <Icon icon="solar:headphones-round-sound-bold-duotone" className="text-base" />
                  Support Hub
                </div>

                <div className="mt-5 flex flex-wrap items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/8 text-[#f3fbad] shadow-lg shadow-black/20">
                    <Icon icon={roleIcons[role]} className="text-[1.8rem]" />
                  </div>
                  <div className="max-w-3xl">
                    <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                      Fast help, real contacts, and your employee network in one place.
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72 sm:text-base">
                      {primarySubtitle}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {adminHotline ? (
                    <ContactActionButton
                      href={toTelHref(adminHotline)}
                      icon="solar:phone-calling-rounded-bold-duotone"
                      label="Call Admin"
                      highlight
                    />
                  ) : null}
                  {primaryContact?.email ? (
                    <ContactActionButton
                      href={toMailHref(primaryContact.email)}
                      icon="solar:letter-bold-duotone"
                      label="Email Support"
                    />
                  ) : null}
                  <a
                    href="#support-directory"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10"
                  >
                    <Icon icon="solar:users-group-rounded-bold-duotone" className="text-base" />
                    View Employees
                  </a>
                </div>

                {!bannerDismissed && (
                  <div className="mt-6 flex flex-wrap items-start justify-between gap-3 rounded-[1.75rem] border border-lime-300/15 bg-lime-300/8 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-lime-300/15 p-2 text-lime-100">
                        <Icon icon="solar:info-circle-bold-duotone" className="text-xl" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Quick routing tip</p>
                        <p className="mt-1 text-sm text-white/68">
                          Start with the admin hotline for urgent issues, then use the employee cards below when you need a specific person.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBannerDismissed(true)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                      aria-label="Dismiss support note"
                    >
                      <Icon icon="solar:close-circle-linear" className="text-lg" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-inner shadow-black/15">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Signed in as</p>
                    <p className="mt-2 text-xl font-semibold text-white">{roleLabels[role]}</p>
                    <p className="mt-2 text-sm text-white/65">{companyName}</p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-white/7 text-[#f3fbad]">
                    <Icon icon="solar:widget-2-bold-duotone" className="text-[1.9rem]" />
                  </div>
                </div>

                <div className="mt-5 rounded-[1.5rem] border border-lime-300/15 bg-[#d5e400]/8 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d5e400]/15 text-[#f3fbad]">
                      <Icon icon="solar:phone-calling-rounded-bold-duotone" className="text-[1.4rem]" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Admin contact no.</p>
                      <p className="mt-1 text-lg font-semibold text-white">{adminHotline || "Not configured"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {supportHighlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[1.6rem] border border-white/10 bg-white/5 px-4 py-4 text-left shadow-lg shadow-black/10"
                  >
                    <Icon icon={item.icon} className="text-2xl text-[#E4E67A]" />
                    <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-white/50">{item.label}</p>
                    <p className="mt-1 text-base font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="space-y-6">
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                <Skeleton className="h-6 w-48" />
                <div className="mt-4 space-y-3">
                  <Skeleton className="h-40 w-full rounded-[1.75rem]" />
                  <Skeleton className="h-28 w-full rounded-[1.5rem]" />
                </div>
              </div>
              <div className="space-y-4">
                <Skeleton className="h-40 w-full rounded-[1.75rem]" />
                <Skeleton className="h-56 w-full rounded-[1.75rem]" />
              </div>
            </div>
            <Skeleton className="h-72 w-full rounded-[28px]" />
          </div>
        ) : error ? (
          <div className="rounded-[28px] border border-rose-400/30 bg-rose-500/10 p-5 text-rose-100">
            <div className="flex items-start gap-3">
              <Icon icon="solar:danger-circle-bold-duotone" className="mt-0.5 text-2xl" />
              <div>
                <p className="font-semibold">Support hub unavailable</p>
                <p className="mt-1 text-sm text-rose-100/85">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[28px] border border-white/10 bg-[#172014]/92 p-5 shadow-xl shadow-black/15 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-white/50">Contact deck</p>
                    <h2 className="mt-1 text-xl font-semibold text-white">Support contacts with quick actions</h2>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white/60">
                    <Icon icon="solar:clipboard-list-bold-duotone" className="text-base text-[#E4E67A]" />
                    {summary.primaryContactLabel}
                  </div>
                </div>

                {primaryContact ? (
                  <article className="mt-5 overflow-hidden rounded-[1.9rem] border border-lime-300/18 bg-[linear-gradient(135deg,rgba(213,228,0,0.08),rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-lime-300/12 text-lime-100">
                          <Icon icon={contactSourceIcons[primaryContact.source]} className="text-[1.8rem]" />
                        </div>
                        <div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                            {primaryContact.label}
                          </div>
                          <h3 className="mt-3 text-2xl font-semibold text-white">{primaryContact.name}</h3>
                          <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/72">
                            {primaryContact.phone ? (
                              <a href={toTelHref(primaryContact.phone)} className="inline-flex items-center gap-2 hover:text-white">
                                <Icon icon="solar:phone-calling-rounded-bold-duotone" className="text-base text-lime-200" />
                                {primaryContact.phone}
                              </a>
                            ) : null}
                            {primaryContact.email ? (
                              <a href={toMailHref(primaryContact.email)} className="inline-flex items-center gap-2 hover:text-white">
                                <Icon icon="solar:letter-bold-duotone" className="text-base text-lime-200" />
                                {primaryContact.email}
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {primaryContact.phone ? (
                          <ContactActionButton
                            href={toTelHref(primaryContact.phone)}
                            icon="solar:phone-calling-rounded-bold-duotone"
                            label="Call"
                            highlight
                          />
                        ) : null}
                        {primaryContact.email ? (
                          <ContactActionButton
                            href={toMailHref(primaryContact.email)}
                            icon="solar:letter-bold-duotone"
                            label="Email"
                          />
                        ) : null}
                        <ContactActionButton
                          icon="solar:copy-bold-duotone"
                          label={copiedId === primaryContact.id ? "Copied" : "Copy"}
                          onClick={() => handleCopy(primaryContact)}
                        />
                      </div>
                    </div>
                  </article>
                ) : null}

                {supportContacts.length > 1 ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {supportContacts.slice(1).map((contact) => (
                      <article
                        key={contact.id}
                        className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4 transition hover:border-lime-300/20 hover:bg-white/7"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/7 text-[#f3fbad]">
                              <Icon icon={contactSourceIcons[contact.source]} className="text-[1.45rem]" />
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">{contact.label}</p>
                              <h3 className="mt-1 text-base font-semibold text-white">{contact.name}</h3>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(contact)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                            aria-label={`Copy ${contact.name}`}
                          >
                            <Icon icon={copiedId === contact.id ? "solar:check-circle-bold-duotone" : "solar:copy-bold-duotone"} className="text-base" />
                          </button>
                        </div>

                        <div className="mt-4 space-y-2 text-sm text-white/72">
                          {contact.phone ? (
                            <a href={toTelHref(contact.phone)} className="flex items-center gap-2 hover:text-white">
                              <Icon icon="solar:phone-calling-rounded-bold-duotone" className="text-base text-lime-200" />
                              {contact.phone}
                            </a>
                          ) : null}
                          {contact.email ? (
                            <a href={toMailHref(contact.email)} className="flex items-center gap-2 hover:text-white">
                              <Icon icon="solar:letter-bold-duotone" className="text-base text-lime-200" />
                              {contact.email}
                            </a>
                          ) : null}
                          {!contact.phone && !contact.email ? (
                            <p className="text-white/50">No direct contact is configured yet.</p>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}

                {supportContacts.length === 0 ? (
                  <div className="mt-5 rounded-3xl border border-dashed border-white/15 bg-white/4 p-6 text-sm text-white/62">
                    No support contact is configured yet. Check the alert rail for the latest account updates.
                  </div>
                ) : null}
              </div>

              <div className="space-y-6">
                <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,35,20,0.96),rgba(18,24,16,0.96))] p-5 shadow-xl shadow-black/15">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-white/50">Company context</p>
                      <h2 className="mt-1 text-xl font-semibold text-white">{companyName}</h2>
                    </div>
                    <Icon icon="solar:buildings-bold-duotone" className="text-[1.8rem] text-[#E4E67A]" />
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">Admin owner</p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {data?.company?.ownerName || primaryContact?.name || "Not configured"}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">Company email</p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {data?.company?.contactEmail || data?.company?.ownerEmail || "Not configured"}
                        </p>
                      </div>
                      <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">Company phone</p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {data?.company?.contactPhone || adminHotline || "Not configured"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.6rem] border border-white/10 bg-black/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">Support playbook</p>
                    <div className="mt-3 space-y-3">
                      {playbook.map((item, index) => (
                        <div key={item} className="flex items-start gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime-300/12 text-[11px] font-semibold text-lime-100">
                            {index + 1}
                          </div>
                          <p className="text-sm leading-6 text-white/72">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-white/50">Alert rail</p>
                      <h2 className="mt-1 text-xl font-semibold text-white">Recent notifications</h2>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white/55">
                      <Icon icon="solar:bell-bold-duotone" className="text-base text-[#E4E67A]" />
                      {summary.unreadNotifications} unread
                    </div>
                  </div>

                  {notifications.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {notifications.map((notification) => (
                        <article
                          key={notification.id}
                          className={`rounded-[1.45rem] border p-4 ${typeToneClasses[notification.type]}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="rounded-xl border border-white/10 bg-black/10 p-2">
                              <Icon icon={notificationIcons[notification.type]} className="text-lg" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold">{notification.title}</h3>
                                {!notification.isRead ? (
                                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]">
                                    New
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm leading-6 text-white/85">{notification.message}</p>
                              <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-white/55">
                                {formatDateTime(notification.createdAt)}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[1.5rem] border border-dashed border-white/15 bg-white/4 p-5 text-sm text-white/60">
                      No notifications yet. This space will show approvals, account changes, and operational updates.
                    </div>
                  )}
                </section>
              </div>
            </section>

            <section
              id="support-directory"
              className="rounded-[28px] border border-white/10 bg-[#1b2618]/94 p-5 shadow-xl shadow-black/15"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-white/50">Employee directory</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">
                    {role === "admin" ? "Your operators and support-side employees" : "People behind your company support line"}
                  </h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white/55">
                  <Icon icon="solar:users-group-two-rounded-bold-duotone" className="text-base text-[#E4E67A]" />
                  {summary.employeeCount} employees
                </div>
              </div>

              {supportRoster.length > 0 ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {supportRoster.map((member) => (
                    <article
                      key={member.id}
                      className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4 transition hover:border-lime-300/20 hover:bg-white/7"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] bg-[#D5E400]/15 text-sm font-semibold text-[#F1F6A2]">
                            {member.name
                              .split(" ")
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase() ?? "")
                              .join("") || "OP"}
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-white">{member.name}</h3>
                            <p className="mt-0.5 text-sm text-white/62">{member.roleLabel}</p>
                          </div>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${rosterToneClasses[member.statusTone]}`}>
                          {member.statusLabel}
                        </span>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-white/72">
                        {member.phone ? (
                          <a href={toTelHref(member.phone)} className="flex items-center gap-2 hover:text-white">
                            <Icon icon="solar:phone-calling-rounded-bold-duotone" className="text-base text-lime-200" />
                            {member.phone}
                          </a>
                        ) : null}
                        {member.email ? (
                          <a href={toMailHref(member.email)} className="flex items-center gap-2 hover:text-white">
                            <Icon icon="solar:letter-bold-duotone" className="text-base text-lime-200" />
                            {member.email}
                          </a>
                        ) : null}
                        {!member.phone && !member.email ? (
                          <p className="text-white/50">No direct contact details provided.</p>
                        ) : null}
                      </div>

                      {(member.accountDeletionRequestedAt || member.mustChangePassword) ? (
                        <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-black/10 p-3 text-xs text-white/70">
                          {member.mustChangePassword ? (
                            <p className="flex items-center gap-2">
                              <Icon icon="solar:key-bold-duotone" className="text-sm text-amber-200" />
                              Password update required
                            </p>
                          ) : null}
                          {member.accountDeletionRequestedAt && member.accountDeletionExpiresAt ? (
                            <p className="mt-2 flex items-center gap-2">
                              <Icon icon="solar:alarm-bold-duotone" className="text-sm text-amber-200" />
                              Deletion scheduled until {formatDateTime(member.accountDeletionExpiresAt)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-3xl border border-dashed border-white/15 bg-white/4 p-6 text-sm text-white/60">
                  No employee roster is available yet. Once operators are linked to this company, they will appear here as contact cards.
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
