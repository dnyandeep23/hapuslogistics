"use client";

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";

type CustomTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

type PickerView = "hour" | "minute";
type Meridiem = "AM" | "PM";

const pad = (value: number) => String(value).padStart(2, "0");

const parseTime = (value: string) => {
  const [hourRaw, minuteRaw] = String(value || "").split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return { hour24: 8, minute: 0 };
  }
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) {
    return { hour24: hour, minute: 0 };
  }

  return { hour24: hour, minute };
};

const to12Hour = (hour24: number): { hour12: number; meridiem: Meridiem } => {
  const meridiem: Meridiem = hour24 >= 12 ? "PM" : "AM";
  const mod = hour24 % 12;
  return { hour12: mod === 0 ? 12 : mod, meridiem };
};

const to24Hour = (hour12: number, meridiem: Meridiem) => {
  if (meridiem === "AM") {
    return hour12 === 12 ? 0 : hour12;
  }
  return hour12 === 12 ? 12 : hour12 + 12;
};

const CLOCK_VALUES_HOUR = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const CLOCK_VALUES_MINUTE = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export default function CustomTimePicker({ value, onChange, error }: CustomTimePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PickerView>("hour");

  const committedTime = parseTime(value);
  const committed12 = to12Hour(committedTime.hour24);

  const [draftHour12, setDraftHour12] = useState(committed12.hour12);
  const [draftMinute, setDraftMinute] = useState(committedTime.minute);
  const [draftMeridiem, setDraftMeridiem] = useState<Meridiem>(committed12.meridiem);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selectedHour24 = open ? to24Hour(draftHour12, draftMeridiem) : committedTime.hour24;
  const selectedMinute = open ? draftMinute : committedTime.minute;
  const formattedDisplay = `${pad(selectedHour24)}:${pad(selectedMinute)}`;

  const handleSelectHour = (hour12: number) => {
    setDraftHour12(hour12);
    setView("minute");
  };

  const handleSelectMinute = (minute: number) => {
    setDraftMinute(minute);
  };

  const applySelection = () => {
    onChange(`${pad(selectedHour24)}:${pad(draftMinute)}`);
    setOpen(false);
  };

  const clockValues = view === "hour" ? CLOCK_VALUES_HOUR : CLOCK_VALUES_MINUTE;

  return (
    <div className="relative" ref={containerRef}>
        <button
        type="button"
        onClick={() => {
          setOpen((current) => {
            const nextOpen = !current;
            if (nextOpen) {
              const nextCommitted = parseTime(value);
              const nextCommitted12 = to12Hour(nextCommitted.hour24);
              setDraftHour12(nextCommitted12.hour12);
              setDraftMinute(nextCommitted.minute);
              setDraftMeridiem(nextCommitted12.meridiem);
            }
            return nextOpen;
          });
          setView("hour");
        }}
        className={`w-full rounded-xl border px-3 py-2.5 text-left text-white transition ${
          error ? "border-red-500 bg-red-500/5" : "border-white/15 bg-black/25 hover:border-[#DDEB83]/50"
        }`}
      >
        <span className="font-mono tracking-wide">{formattedDisplay}</span>
        <Icon icon="solar:clock-circle-linear" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/65" />
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 w-[280px] max-w-[95vw] rounded-2xl border border-[#D5E400]/35 bg-[#141b12] p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/25 px-2 py-1.5">
              <button
                type="button"
                onClick={() => setView("hour")}
                className={`rounded-md px-2 py-1 text-sm ${
                  view === "hour" ? "bg-[#D5E400] text-black" : "text-white/80 hover:bg-white/10"
                }`}
              >
                {pad(selectedHour24)}
              </button>
              <span className="text-white/60">:</span>
              <button
                type="button"
                onClick={() => setView("minute")}
                className={`rounded-md px-2 py-1 text-sm ${
                  view === "minute" ? "bg-[#D5E400] text-black" : "text-white/80 hover:bg-white/10"
                }`}
              >
                {pad(draftMinute)}
              </button>
            </div>

            <div className="inline-flex overflow-hidden rounded-lg border border-white/15">
              <button
                type="button"
                onClick={() => setDraftMeridiem("AM")}
                className={`px-2 py-1 text-xs ${draftMeridiem === "AM" ? "bg-[#D5E400] text-black" : "bg-black/25 text-white/80"}`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => setDraftMeridiem("PM")}
                className={`px-2 py-1 text-xs ${draftMeridiem === "PM" ? "bg-[#D5E400] text-black" : "bg-black/25 text-white/80"}`}
              >
                PM
              </button>
            </div>
          </div>

          <div className="relative mx-auto h-52 w-52 rounded-full border border-white/15 bg-black/25">
            {clockValues.map((entry, index) => {
              const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
              const radius = 78;
              const x = 104 + Math.cos(angle) * radius;
              const y = 104 + Math.sin(angle) * radius;

              const isSelected =
                view === "hour"
                  ? draftHour12 === entry
                  : draftMinute === entry;

              return (
                <button
                  key={`${view}-${entry}`}
                  type="button"
                  onClick={() => (view === "hour" ? handleSelectHour(entry) : handleSelectMinute(entry))}
                  className={`absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold transition ${
                    isSelected
                      ? "bg-[#D5E400] text-black"
                      : "text-white/85 hover:bg-[#D5E400]/20"
                  }`}
                  style={{ left: `${x}px`, top: `${y}px` }}
                >
                  {view === "hour" ? entry : pad(entry)}
                </button>
              );
            })}

            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D5E400]" />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applySelection}
              className="rounded-md border border-[#D5E400]/55 bg-[#D5E400]/20 px-3 py-1.5 text-xs font-semibold text-[#f4f6bc] hover:bg-[#D5E400]/30"
            >
              Apply Time
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
