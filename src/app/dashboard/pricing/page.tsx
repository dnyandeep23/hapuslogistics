"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { useAppSelector } from "@/lib/redux/hooks";
import Skeleton from "@/components/Skeleton";
import CustomDatePicker from "@/components/CustomDatePicker";

type Summary = {
  totalRevenue: number;
  totalOrders: number;
  totalBuses: number;
  totalCompanies: number;
};

type AvailableCompany = {
  companyId: string;
  companyName: string;
};

type CompanyRevenue = {
  companyId: string;
  companyName: string;
  totalRevenue: number;
  totalOrders: number;
  totalBuses: number;
};

type CollectedBySummary = {
  name: string;
  email: string;
  type: string;
  revenue: number;
  orders: number;
};

type BusRevenue = {
  busId: string;
  busName: string;
  busNumber: string;
  companyId: string;
  companyName: string;
  totalRevenue: number;
  totalOrders: number;
  collectedBy: CollectedBySummary[];
};

type OrderRevenueRow = {
  orderId: string;
  trackingId: string;
  status: string;
  createdAt: string;
  orderDate: string;
  amount: number;
  busId: string;
  busName: string;
  busNumber: string;
  companyId: string;
  companyName: string;
  customerName: string;
  customerEmail: string;
  collectedByName: string;
  collectedByEmail: string;
  collectedByType: string;
};

type PricingResponse = {
  success: boolean;
  message?: string;
  role: "admin" | "superadmin";
  summary: Summary;
  availableCompanies: AvailableCompany[];
  companies: CompanyRevenue[];
  buses: BusRevenue[];
  orders: OrderRevenueRow[];
};

const defaultSummary: Summary = {
  totalRevenue: 0,
  totalOrders: 0,
  totalBuses: 0,
  totalCompanies: 0,
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0,
  );

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const firstDayOfCurrentMonth = () => {
  const date = new Date();
  date.setDate(1);
  return toDateInput(date);
};

const todayDate = () => toDateInput(new Date());

export default function PricingDashboardPage() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.user);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<"admin" | "superadmin">("admin");
  const [summary, setSummary] = useState<Summary>(defaultSummary);
  const [availableCompanies, setAvailableCompanies] = useState<AvailableCompany[]>([]);
  const [companyRows, setCompanyRows] = useState<CompanyRevenue[]>([]);
  const [busRows, setBusRows] = useState<BusRevenue[]>([]);
  const [orderRows, setOrderRows] = useState<OrderRevenueRow[]>([]);

  const [fromDate, setFromDate] = useState(firstDayOfCurrentMonth());
  const [toDate, setToDate] = useState(todayDate());
  const [companyFilter, setCompanyFilter] = useState("");

  const isAllowed = Boolean(user?.role === "admin" || user?.isSuperAdmin);

  useEffect(() => {
    if (!user) return;
    if (!isAllowed) {
      router.replace("/dashboard");
    }
  }, [isAllowed, router, user]);

  const fetchPricing = useCallback(async () => {
    if (!isAllowed) return;

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (user?.isSuperAdmin && companyFilter) params.set("companyId", companyFilter);

      const query = params.toString();
      const response = await fetch(`/api/dashboard/pricing${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as PricingResponse;

      if (!response.ok || !payload?.success) {
        setError(payload?.message || "Failed to load pricing data.");
        setSummary(defaultSummary);
        setAvailableCompanies([]);
        setCompanyRows([]);
        setBusRows([]);
        setOrderRows([]);
        return;
      }

      setRole(payload.role);
      setSummary(payload.summary || defaultSummary);
      setAvailableCompanies(Array.isArray(payload.availableCompanies) ? payload.availableCompanies : []);
      setCompanyRows(Array.isArray(payload.companies) ? payload.companies : []);
      setBusRows(Array.isArray(payload.buses) ? payload.buses : []);
      setOrderRows(Array.isArray(payload.orders) ? payload.orders : []);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load pricing data.");
      setSummary(defaultSummary);
      setAvailableCompanies([]);
      setCompanyRows([]);
      setBusRows([]);
      setOrderRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyFilter, fromDate, isAllowed, toDate, user?.isSuperAdmin]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const exportExcelCsv = () => {
    if (!orderRows.length) return;

    const headers = [
      "Tracking ID",
      "Order ID",
      "Status",
      "Booked Date",
      "Bus Name",
      "Bus Number",
      "Company",
      "Amount",
      "Collected By",
      "Collector Email",
      "Collected Type",
      "Customer Name",
      "Customer Email",
    ];

    const lines = [
      headers.join(","),
      ...orderRows.map((row) =>
        [
          row.trackingId,
          row.orderId,
          row.status,
          formatDate(row.createdAt),
          row.busName,
          row.busNumber,
          row.companyName,
          row.amount.toFixed(2),
          row.collectedByName,
          row.collectedByEmail,
          row.collectedByType,
          row.customerName,
          row.customerEmail,
        ]
          .map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`)
          .join(","),
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const fileUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = fileUrl;
    anchor.download = `pricing-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(fileUrl);
  };

  const exportPdf = async () => {
    if (!orderRows.length) return;

    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const autoTable = autoTableModule.default;

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Hapus Logistics - Pricing Report", 40, 36);
    doc.setFontSize(10);
    doc.text(`Date Range: ${fromDate || "--"} to ${toDate || "--"}`, 40, 54);
    doc.text(`Total Revenue: ${formatCurrency(summary.totalRevenue)}`, 40, 70);

    autoTable(doc, {
      startY: 84,
      head: [["Tracking", "Status", "Date", "Company", "Bus", "Collected By", "Collector Email", "Amount"]],
      body: orderRows.map((row) => [
        row.trackingId,
        row.status,
        formatDate(row.createdAt),
        row.companyName,
        `${row.busName} (${row.busNumber})`,
        row.collectedByName,
        row.collectedByEmail || "--",
        formatCurrency(row.amount),
      ]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [45, 60, 35], textColor: 255 },
    });

    doc.save(`pricing-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const topCollectors = useMemo(() => {
    const collectorMap = new Map<
      string,
      { name: string; email: string; type: string; revenue: number; orders: number }
    >();

    for (const bus of busRows) {
      for (const collector of bus.collectedBy) {
        const key = `${collector.type}:${collector.name}:${collector.email || ""}`;
        const existing = collectorMap.get(key) || {
          name: collector.name,
          email: collector.email || "",
          type: collector.type,
          revenue: 0,
          orders: 0,
        };
        existing.revenue += collector.revenue;
        existing.orders += collector.orders;
        collectorMap.set(key, existing);
      }
    }

    return Array.from(collectorMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  }, [busRows]);

  if (!user || !isAllowed) {
    return (
      <div className="rounded-2xl border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-200">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:shield-alert-outline" className="text-lg" />
          Access restricted to admin and super admin.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#E4E67A]">Pricing</h1>
          <p className="mt-1 text-sm text-white/70">
            {role === "superadmin"
              ? "Company-wise and bus-wise revenue across the platform."
              : "Bus-wise revenue for your company buses only."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportPdf}
            disabled={!orderRows.length || loading}
            className="inline-flex items-center gap-1 rounded-lg border border-white/25 px-3 py-2 text-xs text-white/85 hover:bg-white/10 disabled:opacity-50"
          >
            <Icon icon="mdi:file-pdf-box" className="text-base" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={exportExcelCsv}
            disabled={!orderRows.length || loading}
            className="inline-flex items-center gap-1 rounded-lg border border-white/25 px-3 py-2 text-xs text-white/85 hover:bg-white/10 disabled:opacity-50"
          >
            <Icon icon="mdi:file-excel-box" className="text-base" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={fetchPricing}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-[#D5E400]/70 bg-[#D5E400]/10 px-3 py-2 text-xs font-semibold text-[#E4E67A] hover:bg-[#D5E400]/20 disabled:opacity-50"
          >
            <Icon icon={loading ? "mdi:loading" : "mdi:refresh"} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#4e573f] bg-[#1f251c] p-4 md:grid-cols-4">
        <label className="text-xs text-white/70">
          From
          <div className="mt-1">
            <CustomDatePicker
              value={fromDate}
              onChange={setFromDate}
              maxDate={toDate || ""}
              placeholder="Select from date"
              restrictToAvailableDates={false}
              syncWithCartDate={false}
              disablePastDates={false}
            />
          </div>
        </label>
        <label className="text-xs text-white/70">
          To
          <div className="mt-1">
            <CustomDatePicker
              value={toDate}
              onChange={setToDate}
              minDate={fromDate || ""}
              placeholder="Select to date"
              restrictToAvailableDates={false}
              syncWithCartDate={false}
              disablePastDates={false}
            />
          </div>
        </label>

        {user.isSuperAdmin ? (
          <label className="text-xs text-white/70 md:col-span-2">
            Company
            <select
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">All Companies</option>
              {availableCompanies.map((company) => (
                <option key={company.companyId} value={company.companyId}>
                  {company.companyName}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="md:col-span-2" />
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`pricing-skeleton-${index}`} className="rounded-xl border border-white/15 bg-black/20 p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-56" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Total Revenue" value={formatCurrency(summary.totalRevenue)} icon="mdi:cash-multiple" />
            <MetricCard label="Total Orders" value={String(summary.totalOrders)} icon="lets-icons:order" />
            <MetricCard label="Total Buses" value={String(summary.totalBuses)} icon="mdi:bus-multiple" />
            <MetricCard label="Total Companies" value={String(summary.totalCompanies)} icon="mdi:office-building-outline" />
          </div>

          {role === "superadmin" ? (
            <div className="rounded-2xl border border-[#4e573f] bg-[#1f251c] p-4">
              <h2 className="text-lg font-semibold text-[#E4E67A]">Company-wise Revenue</h2>
              {companyRows.length === 0 ? (
                <p className="mt-3 text-sm text-white/65">No company revenue data for selected filters.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-white/55">
                      <tr>
                        <th className="px-3 py-2">Company</th>
                        <th className="px-3 py-2">Buses</th>
                        <th className="px-3 py-2">Orders</th>
                        <th className="px-3 py-2">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyRows.map((company) => (
                        <tr key={company.companyId} className="border-t border-white/10">
                          <td className="px-3 py-2">{company.companyName}</td>
                          <td className="px-3 py-2">{company.totalBuses}</td>
                          <td className="px-3 py-2">{company.totalOrders}</td>
                          <td className="px-3 py-2 font-semibold text-[#E4E67A]">{formatCurrency(company.totalRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          <div className="rounded-2xl border border-[#4e573f] bg-[#1f251c] p-4">
            <h2 className="text-lg font-semibold text-[#E4E67A]">Bus-wise Revenue</h2>
            {busRows.length === 0 ? (
              <p className="mt-3 text-sm text-white/65">No bus revenue data for selected filters.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-white/55">
                    <tr>
                      {role === "superadmin" ? <th className="px-3 py-2">Company</th> : null}
                      <th className="px-3 py-2">Bus</th>
                      <th className="px-3 py-2">Orders</th>
                      <th className="px-3 py-2">Revenue</th>
                      <th className="px-3 py-2">Collected By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {busRows.map((bus) => (
                      <tr key={bus.busId} className="border-t border-white/10">
                        {role === "superadmin" ? <td className="px-3 py-2">{bus.companyName}</td> : null}
                        <td className="px-3 py-2">{bus.busName} ({bus.busNumber})</td>
                        <td className="px-3 py-2">{bus.totalOrders}</td>
                        <td className="px-3 py-2 font-semibold text-[#E4E67A]">{formatCurrency(bus.totalRevenue)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {bus.collectedBy.slice(0, 4).map((collector) => (
                              <span
                                key={`${bus.busId}-${collector.type}-${collector.name}-${collector.email || ""}`}
                                className={`rounded-full border px-2 py-0.5 text-[11px] ${
                                  collector.type === "admin"
                                    ? "border-blue-400/45 bg-blue-500/10 text-blue-200"
                                    : "border-emerald-400/45 bg-emerald-500/10 text-emerald-200"
                                }`}
                                title={
                                  collector.type === "admin"
                                    ? `${collector.name}${collector.email ? ` (${collector.email})` : ""}`
                                    : "Online payment"
                                }
                              >
                                {collector.name} ({collector.orders})
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#4e573f] bg-[#1f251c] p-4">
            <h2 className="text-lg font-semibold text-[#E4E67A]">Collected By (Top)</h2>
            {topCollectors.length === 0 ? (
              <p className="mt-3 text-sm text-white/65">No collector data available.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {topCollectors.map((collector) => (
                  <span
                    key={`${collector.type}-${collector.name}-${collector.email || ""}`}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      collector.type === "admin"
                        ? "border-blue-400/45 bg-blue-500/10 text-blue-200"
                        : "border-emerald-400/45 bg-emerald-500/10 text-emerald-200"
                    }`}
                    title={
                      collector.type === "admin"
                        ? `${collector.name}${collector.email ? ` (${collector.email})` : ""}`
                        : "Online payment"
                    }
                  >
                    {collector.name} • {collector.orders} orders • {formatCurrency(collector.revenue)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#4e573f] bg-[#1f251c] p-4">
            <h2 className="text-lg font-semibold text-[#E4E67A]">Order Revenue Details</h2>
            {orderRows.length === 0 ? (
              <p className="mt-3 text-sm text-white/65">No orders found for selected filters.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-white/55">
                    <tr>
                      <th className="px-3 py-2">Tracking</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Bus</th>
                      <th className="px-3 py-2">Company</th>
                      <th className="px-3 py-2">Collected By</th>
                      <th className="px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderRows.slice(0, 300).map((row) => (
                      <tr key={row.orderId} className="border-t border-white/10">
                        <td className="px-3 py-2 font-mono text-xs text-[#E4E67A]">{row.trackingId}</td>
                        <td className="px-3 py-2">{formatDate(row.createdAt)}</td>
                        <td className="px-3 py-2">{row.busName} ({row.busNumber})</td>
                        <td className="px-3 py-2">{row.companyName}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${
                              row.collectedByType === "admin"
                                ? "border-blue-400/45 bg-blue-500/10 text-blue-200"
                                : "border-emerald-400/45 bg-emerald-500/10 text-emerald-200"
                            }`}
                            title={
                              row.collectedByType === "admin"
                                ? `${row.collectedByName}${row.collectedByEmail ? ` (${row.collectedByEmail})` : ""}`
                                : "Online payment"
                            }
                          >
                            {row.collectedByName}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-semibold text-[#E4E67A]">{formatCurrency(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-white/55">{label}</p>
        <Icon icon={icon} className="text-lg text-[#E4E67A]" />
      </div>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
