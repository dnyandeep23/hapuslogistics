"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";

type Props = {
  startDate: string;
  endDate: string;
  onChange: (range: { startDate: string; endDate: string }) => void;
  error?: string;
  minDate?: string;
};

const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parseIsoDate = (value: string) => {
  if (!value) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const pad = (value: number) => String(value).padStart(2, "0");

const toIsoDate = (date: Date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatDisplayDate = (value: string) => {
  if (!value) return "--";
  const date = parseIsoDate(value);
  if (!date) return "--";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const getMonthGrid = (monthDate: Date) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const cells: Array<Date | null> = [];
  for (let i = 0; i < firstDay; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(new Date(year, month, day));
  }
  return cells;
};

export default function CustomDateRangePicker({
  startDate,
  endDate,
  onChange,
  error,
  minDate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [hoverDate, setHoverDate] = useState("");
  const [activeMonth, setActiveMonth] = useState<Date>(() => {
    const fromStart = parseIsoDate(startDate);
    const today = new Date();
    return fromStart
      ? new Date(fromStart.getFullYear(), fromStart.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, []);

  const label = useMemo(() => {
    if (!startDate && !endDate) return "Select date range";
    if (startDate && !endDate) return `${formatDisplayDate(startDate)} - --`;
    return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
  }, [startDate, endDate]);

  const monthCells = useMemo(() => getMonthGrid(activeMonth), [activeMonth]);
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const normalizedMinDate = minDate || "";
  const isSelectingEnd = Boolean(startDate && !endDate);
  const hasInvalidRange = Boolean(startDate && endDate && startDate > endDate);

  const handleDateSelect = (pickedDate: Date) => {
    const nextValue = toIsoDate(pickedDate);
    if (!startDate || (startDate && endDate)) {
      onChange({ startDate: nextValue, endDate: "" });
      return;
    }

    if (nextValue < startDate) {
      onChange({ startDate: nextValue, endDate: startDate });
      setOpen(false);
      return;
    }

    onChange({ startDate, endDate: nextValue });
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          const fromStart = parseIsoDate(startDate);
          const baseDate = fromStart ?? new Date();
          setActiveMonth(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
        }}
        className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-all ${error || hasInvalidRange ? "border-red-500 bg-red-500/5" : "border-white/30 bg-black/40 hover:border-white/50"}`}
      >
        <span className="block text-white/85">{label}</span>
        <Icon icon="solar:calendar-linear" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/65 text-lg" />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-[#D5E400]/35 bg-[#141b12] p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <div className="rounded-md border border-[#D5E400]/40 bg-[#D5E400]/10 px-2.5 py-2 text-[11px] text-[#f4f6bc]">
                Start Date
                <p className="mt-1 text-xs">{formatDisplayDate(startDate)}</p>
              </div>
              <div className="rounded-md border border-white/20 bg-black/25 px-2.5 py-2 text-[11px] text-white/75">
                End Date
                <p className="mt-1 text-xs">{formatDisplayDate(endDate)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChange({ startDate: "", endDate: "" })}
              className="rounded-md border border-white/20 px-2.5 py-2 text-xs text-white/75 hover:bg-white/10"
            >
              Clear
            </button>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setActiveMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
              className="rounded-md border border-white/20 p-1.5 text-white/80 hover:bg-white/10"
            >
              <Icon icon="mdi:chevron-left" />
            </button>
            <p className="text-sm font-semibold text-[#f4f6bc]">
              {MONTH_LABEL[activeMonth.getMonth()]} {activeMonth.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() =>
                setActiveMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
              className="rounded-md border border-white/20 p-1.5 text-white/80 hover:bg-white/10"
            >
              <Icon icon="mdi:chevron-right" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEK_DAYS.map((day) => (
              <div key={day} className="text-[10px] text-white/55">
                {day}
              </div>
            ))}
            {monthCells.map((dateCell, index) => {
              if (!dateCell) {
                return <div key={`empty-${index}`} />;
              }

              const isoDate = toIsoDate(dateCell);
              const isDisabled = Boolean(normalizedMinDate && isoDate < normalizedMinDate);
              const isStart = startDate === isoDate;
              const isEnd = endDate === isoDate;
              const isInRange = Boolean(startDate && endDate && isoDate > startDate && isoDate < endDate);
              const isPreviewedInRange = Boolean(
                isSelectingEnd &&
                  hoverDate &&
                  startDate &&
                  isoDate > startDate &&
                  isoDate < hoverDate,
              );
              const isToday = isoDate === todayIso;

              return (
                <button
                  key={isoDate}
                  type="button"
                  disabled={isDisabled}
                  onMouseEnter={() => {
                    if (isSelectingEnd && !isDisabled) {
                      setHoverDate(isoDate);
                    }
                  }}
                  onMouseLeave={() => {
                    if (isSelectingEnd) {
                      setHoverDate("");
                    }
                  }}
                  onClick={() => handleDateSelect(dateCell)}
                  className={`h-8 rounded-md text-xs transition-colors ${isDisabled ? "cursor-not-allowed text-white/30" : "hover:bg-[#D5E400]/20"} ${
                    isStart || isEnd
                      ? "bg-[#D5E400] font-semibold text-black"
                      : isInRange || isPreviewedInRange
                      ? "bg-[#D5E400]/25 text-[#f4f6bc]"
                      : isToday
                      ? "border border-[#D5E400]/60 text-[#f4f6bc]"
                      : "text-white/90"
                  }`}
                >
                  {dateCell.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-md border border-[#D5E400]/30 bg-[#D5E400]/10 px-3 py-2 text-[11px] text-[#f4f6bc]">
            {isSelectingEnd
              ? "Select the end date to complete the range."
              : "Select start date, then select end date."}
          </div>
        </div>
      )}
    </div>
  );
}
