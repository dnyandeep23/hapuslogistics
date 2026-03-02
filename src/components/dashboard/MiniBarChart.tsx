"use client";

import React from "react";

type MiniBarChartProps = {
  title: string;
  points: Array<{ label: string; value: number }>;
  colorClass?: string;
};

export default function MiniBarChart({
  title,
  points,
  colorClass = "from-[#D5E400] to-[#8fa339]",
}: MiniBarChartProps) {
  const maxValue = Math.max(...points.map((point) => point.value), 1);

  return (
    <div className="rounded-2xl border border-[#5e684a] bg-[#1f251c]/90 p-4">
      <h3 className="mb-4 text-sm font-semibold text-[#E4E67A]">{title}</h3>
      <div className="space-y-3">
        {points.map((point) => (
          <div key={point.label}>
            <div className="mb-1 flex items-center justify-between text-xs text-white/75">
              <span>{point.label}</span>
              <span>{point.value}</span>
            </div>
            <div className="h-2 rounded-full bg-white/15">
              <div
                className={`h-2 rounded-full bg-linerar-to-r ${colorClass}`}
                style={{ width: `${(point.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
