"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Icon } from "@iconify/react";
import { getAvailableDates } from "@/services/logistics";
import { useSelector } from "react-redux";
import { selectPackage } from "@/lib/redux/packageSlice";

interface CustomDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  pickupLocationId?: string;
  dropLocationId?: string;
  error?: string;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
  restrictToAvailableDates?: boolean;
  syncWithCartDate?: boolean;
  disablePastDates?: boolean;
}

const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (value: number) => String(value).padStart(2, "0");

const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

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

const formatDateForDisplay = (value: string) => {
  const parsed = parseIsoDate(value);
  if (!parsed) return "";
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export default function CustomDatePicker({
  value,
  onChange,
  pickupLocationId,
  dropLocationId,
  error,
  minDate,
  maxDate,
  placeholder = "Select a date",
  restrictToAvailableDates,
  syncWithCartDate,
  disablePastDates = true,
}: CustomDatePickerProps) {
  const { formData } = useSelector(selectPackage);
  const shouldRestrictToAvailableDates =
    restrictToAvailableDates ?? Boolean(pickupLocationId && dropLocationId);
  const shouldSyncWithCartDate = syncWithCartDate ?? shouldRestrictToAvailableDates;

  const [isOpen, setIsOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [currentDate, setCurrentDate] = useState<Date>(() => parseIsoDate(value) ?? new Date());
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState("");

  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const effectiveMinDate = minDate || (disablePastDates ? todayIso : "");
  const effectiveMaxDate = maxDate || "";

  useEffect(() => {
    const selected = parseIsoDate(value);
    if (selected) {
      setCurrentDate(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
  }, [value]);

  useEffect(() => {
    if (!shouldSyncWithCartDate || value) return;
    const cartEntries = Array.isArray(formData?.cart) ? formData.cart : [];
    if (!cartEntries.length) return;
    const firstCartDate = String(cartEntries[0]?.pickUpDate ?? "").trim();
    if (!parseIsoDate(firstCartDate)) return;
    onChange(firstCartDate);
  }, [formData, onChange, shouldSyncWithCartDate, value]);

  const fetchDates = useCallback(async () => {
    if (!shouldRestrictToAvailableDates) {
      setAvailableDates([]);
      setAvailabilityMessage("");
      return;
    }
    if (!pickupLocationId || !dropLocationId) {
      setAvailableDates([]);
      setAvailabilityMessage("Select pickup and drop location first.");
      return;
    }

    setIsLoading(true);
    setAvailabilityMessage("");
    try {
      const fetchedDates = await getAvailableDates(pickupLocationId, dropLocationId);
      const normalized = Array.isArray(fetchedDates)
        ? fetchedDates
            .map((item) => String(item ?? "").slice(0, 10))
            .filter((item) => Boolean(parseIsoDate(item)))
            .sort()
        : [];

      setAvailableDates(normalized);

      if (!value && normalized.length > 0) {
        const firstValid = normalized.find((item) => item >= effectiveMinDate) ?? normalized[0];
        onChange(firstValid);
      }

      if (normalized.length === 0) {
        setAvailabilityMessage("No available dates found for this route.");
      }
    } catch {
      setAvailableDates([]);
      setAvailabilityMessage("Failed to load available dates. Try again.");
    } finally {
      setIsLoading(false);
    }
  }, [
    dropLocationId,
    effectiveMinDate,
    onChange,
    pickupLocationId,
    shouldRestrictToAvailableDates,
    value,
  ]);

  useEffect(() => {
    fetchDates();
  }, [fetchDates]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleOpenToggle = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen && shouldRestrictToAvailableDates) {
      fetchDates();
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const monthCells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: totalDays }, (_, day) => new Date(year, month, day + 1)),
  ];

  const isDateDisabled = (isoDate: string) => {
    if (effectiveMinDate && isoDate < effectiveMinDate) return true;
    if (effectiveMaxDate && isoDate > effectiveMaxDate) return true;
    if (shouldRestrictToAvailableDates) {
      if (availableDates.length === 0) return true;
      if (!availableDates.includes(isoDate)) return true;
    }
    return false;
  };

  return (
    <div className="relative" ref={datePickerRef}>
      <button
        type="button"
        onClick={handleOpenToggle}
        className={`relative w-full rounded-xl border-b-2 bg-[#1e241b] px-4 py-3 pr-12 text-left text-sm text-white transition ${
          error ? "border-red-500" : "border-[#CDD645]/60"
        }`}
      >
        {formatDateForDisplay(value) || <span className="text-white/45">{placeholder}</span>}
        <Icon
          icon="solar:calendar-linear"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white"
        />
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-[#CDD645]/60 bg-[#1e241b] p-4 shadow-2xl sm:w-80">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
              }
              className="rounded-md border border-white/20 p-1 text-white/80 hover:bg-white/10"
            >
              <Icon icon="mdi:chevron-left" />
            </button>
            <div className="text-center">
              <span className="font-semibold">{MONTH_LABEL[month]}</span>
              <span className="ml-2 text-white/85">{year}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
              }
              className="rounded-md border border-white/20 p-1 text-white/80 hover:bg-white/10"
            >
              <Icon icon="mdi:chevron-right" />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 text-center text-xs text-white/55">
            {WEEK_DAYS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 text-center">
            {monthCells.map((cell, index) => {
              if (!cell) return <div key={`empty-${index}`} />;

              const isoDate = toIsoDate(cell);
              const selected = value === isoDate;
              const disabled = isDateDisabled(isoDate);
              const title = disabled
                ? shouldRestrictToAvailableDates && !availableDates.includes(isoDate)
                  ? "This date is not available."
                  : "This date is outside allowed range."
                : "";

              return (
                <button
                  key={isoDate}
                  type="button"
                  disabled={disabled}
                  title={title}
                  onClick={() => {
                    onChange(isoDate);
                    setIsOpen(false);
                  }}
                  className={`m-0.5 rounded-full p-1 text-sm transition ${
                    disabled
                      ? "cursor-not-allowed text-white/30"
                      : "cursor-pointer text-white hover:bg-[#3E4936]"
                  } ${selected ? "bg-[#CDD645] text-black hover:bg-[#CDD645]" : ""}`}
                >
                  {cell.getDate()}
                </button>
              );
            })}
          </div>

          {isLoading && (
            <p className="mt-3 text-xs text-white/60">Loading available dates...</p>
          )}
          {!isLoading && availabilityMessage && (
            <p className="mt-3 text-xs text-amber-200">{availabilityMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
