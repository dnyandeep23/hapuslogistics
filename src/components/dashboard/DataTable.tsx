"use client";

import React, { useMemo, useState } from "react";

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

  return (
    <div className="rounded-2xl border border-[#5e684a] bg-[#1f251c]/90 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {title && <h3 className="text-base font-semibold text-[#E4E67A]">{title}</h3>}
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full max-w-xs rounded-xl border border-[#65724f] bg-[#161d13] px-3 py-2 text-sm text-white outline-none focus:border-[#E4E67A]"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#5e684a] text-white/75">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`px-3 py-2 ${column.sortable ? "cursor-pointer select-none" : ""}`}
                  onClick={() => toggleSort(column.key, column.sortable)}
                >
                  <span className="inline-flex items-center gap-1">
                    {column.label}
                    {column.sortable && sortKey === column.key && (
                      <span className="text-[#e8f2b9]">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </span>
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
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
