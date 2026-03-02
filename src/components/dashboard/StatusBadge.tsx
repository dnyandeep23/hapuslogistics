"use client";

import React from "react";

type StatusBadgeProps = {
  status: string;
};

const colorMap: Record<string, string> = {
  scheduled: "border-[#ffcf62]/50 bg-[#ffcf62]/15 text-[#ffdc90]",
  live: "border-[#44d8a4]/50 bg-[#44d8a4]/15 text-[#81f1cb]",
  completed: "border-[#7ec8ff]/50 bg-[#7ec8ff]/15 text-[#aedbff]",
  active: "border-[#5ad17d]/50 bg-[#5ad17d]/15 text-[#aaf1be]",
  inactive: "border-[#d1b35a]/40 bg-[#d1b35a]/15 text-[#f0dc9a]",
  suspended: "border-[#d16b6b]/50 bg-[#d16b6b]/15 text-[#f4a5a5]",
  pending: "border-[#c7a36d]/40 bg-[#c7a36d]/15 text-[#efd0a4]",
  approved: "border-[#5ad17d]/50 bg-[#5ad17d]/15 text-[#aaf1be]",
  rejected: "border-[#d16b6b]/50 bg-[#d16b6b]/15 text-[#f4a5a5]",
  maintenance: "border-[#c18bf7]/45 bg-[#c18bf7]/15 text-[#dfc0ff]",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const key = status.toLowerCase();
  const cls = colorMap[key] ?? "border-white/25 bg-white/10 text-white";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}
