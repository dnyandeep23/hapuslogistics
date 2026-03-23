"use client";

import React from "react";
import { Icon } from "@iconify/react";

type MetricCardProps = {
  label: string;
  value: string | number;
  icon: string;
  hint?: string;
};

export default function MetricCard({ label, value, icon, hint }: MetricCardProps) {
  return (
    <div className="dashboard-surface-soft rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-white/75">{label}</p>
        <Icon icon={icon} className="text-xl text-[#E4E67A]" />
      </div>
      <p className="text-2xl font-semibold text-[#E4E67A]">{value}</p>
      {hint && <p className="mt-2 text-xs text-white/65">{hint}</p>}
    </div>
  );
}
