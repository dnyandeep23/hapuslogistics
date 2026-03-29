"use client";

import React, { useMemo, useState } from "react";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

type ColumnDef<T> = {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
};

type DataTableProps<T extends { id: string }> = {
  title?: string;
  data: T[];
  columns: Array<ColumnDef<T>>;
  searchPlaceholder?: string;
};

export default function DataTable<T extends { id: string }>({
  title,
  data,
  columns,
  searchPlaceholder = "Search...",
}: DataTableProps<T>) {
  const { isMobile } = useResponsiveMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const lowered = searchQuery.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(lowered),
      ),
    );
  }, [data, searchQuery]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;

    return [...filtered].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (aValue === bValue) return 0;
      const compare = String(aValue ?? "").localeCompare(String(bValue ?? ""), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDirection === "asc" ? compare : -compare;
    });
  }, [filtered, sortDirection, sortKey]);

  const toggleSort = (key: keyof T, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  const emptyMessage = searchQuery.trim() ? "No records match your search." : "No records found.";

  return (
    <div className="dashboard-surface rounded-2xl p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {title && <h3 className="text-base font-semibold text-[#E4E67A]">{title}</h3>}
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={searchPlaceholder}
          className="dashboard-input w-full max-w-xs rounded-xl px-3 py-2 text-sm"
        />
      </div>

      {isMobile ? (
        <div className="space-y-3">
          {sorted.map((row) => (
            <article key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid gap-3">
                {columns.map((column) => {
                  const value = row[column.key];
                  return (
                    <div key={`${row.id}-${String(column.key)}`} className="flex flex-col gap-1">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{column.label}</p>
                      <div className="text-sm text-white/90">
                        {column.render ? column.render(value, row) : String(value ?? "-")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
          {sorted.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/60">
              {emptyMessage}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="dashboard-table-head">
              <tr className="border-b border-white/10 text-white/75">
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    aria-sort={
                      column.sortable && sortKey === column.key
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="px-3 py-2"
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer select-none items-center gap-1 text-left transition hover:text-white"
                        onClick={() => toggleSort(column.key, column.sortable)}
                      >
                        {column.label}
                        {sortKey === column.key && (
                          <span className="text-[#e8f2b9]">{sortDirection === "asc" ? "↑" : "↓"}</span>
                        )}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1">{column.label}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.id} className="border-b border-[#4f5a3f]/40 text-white/90">
                  {columns.map((column) => {
                    const value = row[column.key];
                    return (
                      <td key={`${row.id}-${String(column.key)}`} className="px-3 py-2 align-top">
                        {column.render ? column.render(value, row) : String(value ?? "-")}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-6 text-center text-white/60">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
