"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import CustomDatePicker from "@/components/CustomDatePicker";
import Skeleton from "@/components/Skeleton";

export type ManagedBannerSlide = {
  imageUrl: string;
  isActive: boolean;
  sequence: number;
};

type CouponItem = {
  id: string;
  code: string;
  discount: number;
  isActive: boolean;
  expiryDate: string;
  maxUsesPerUser: number;
};

type CouponForm = {
  code: string;
  discount: string;
  expiryDate: string;
  maxUsesPerUser: string;
  isActive: boolean;
};

type BannerForm = {
  imageUrl: string;
  isActive: boolean;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
};

type SectionMode = "all" | "coupon" | "banner";

interface SuperAdminCouponBannerSectionProps {
  onBannersUpdated?: (slides: ManagedBannerSlide[]) => void;
  mode?: SectionMode;
}

const emptyCouponForm: CouponForm = {
  code: "",
  discount: "10",
  expiryDate: "",
  maxUsesPerUser: "1",
  isActive: true,
};

const emptyBannerForm: BannerForm = {
  imageUrl: "",
  isActive: true,
};

const toDateInput = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const todayDateInput = () => new Date().toISOString().slice(0, 10);

const parseJsonResponse = async <T extends object>(response: Response): Promise<T> => {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
};

const toMessage = (payload: unknown, fallback: string) => {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = String((payload as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }
  return fallback;
};

const getSafeImageUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("https://")) return trimmed;
  return "";
};

function BannerCarouselPreview({ slides }: { slides: ManagedBannerSlide[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => window.clearInterval(interval);
  }, [slides.length]);

  if (!slides.length) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl border border-white/15 bg-black/20 text-xs text-white/55">
        No active banners to preview.
      </div>
    );
  }

  const safeIndex = ((activeIndex % slides.length) + slides.length) % slides.length;
  const goPrev = () => setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  const goNext = () => setActiveIndex((prev) => (prev + 1) % slides.length);

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/20 bg-[#11170f]">
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${safeIndex * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <div key={`${slide.imageUrl}-${index}`} className="relative h-44 min-w-full">
            <Image
              src={slide.imageUrl}
              alt={`Banner slide ${index + 1}`}
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-black/25" />
          </div>
        ))}
      </div>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous preview slide"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-black/45 p-1.5 text-white/90 hover:bg-black/65"
          >
            <Icon icon="mdi:chevron-left" className="text-base" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next preview slide"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-black/45 p-1.5 text-white/90 hover:bg-black/65"
          >
            <Icon icon="mdi:chevron-right" className="text-base" />
          </button>

          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((_, index) => (
              <button
                key={`preview-dot-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-2 w-2 rounded-full transition ${
                  index === safeIndex ? "bg-[#E4E67A]" : "bg-white/50"
                }`}
                aria-label={`Show preview slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function SuperAdminCouponBannerSection({
  onBannersUpdated,
  mode = "all",
}: SuperAdminCouponBannerSectionProps) {
  const showCoupons = mode === "all" || mode === "coupon";
  const showBanners = mode === "all" || mode === "banner";

  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [banners, setBanners] = useState<ManagedBannerSlide[]>([]);
  const [couponForm, setCouponForm] = useState<CouponForm>(emptyCouponForm);
  const [bannerForm, setBannerForm] = useState<BannerForm>(emptyBannerForm);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [loadingBanners, setLoadingBanners] = useState(false);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [savingBanners, setSavingBanners] = useState(false);
  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
  const [couponMessage, setCouponMessage] = useState("");
  const [couponError, setCouponError] = useState("");
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerError, setBannerError] = useState("");
  const [couponPreviewAmount, setCouponPreviewAmount] = useState("1000");

  const activeBannerCount = useMemo(
    () => banners.filter((item) => item.isActive).length,
    [banners],
  );
  const orderedBanners = useMemo(
    () => [...banners].sort((a, b) => a.sequence - b.sequence),
    [banners],
  );
  const activeBannerSlidesForPreview = useMemo(
    () =>
      orderedBanners.filter(
        (item) => item.isActive && Boolean(getSafeImageUrl(item.imageUrl)),
      ),
    [orderedBanners],
  );

  const previewAmount = useMemo(() => {
    const parsed = Number(couponPreviewAmount);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [couponPreviewAmount]);

  const previewDiscountAmount = useMemo(() => {
    const parsedDiscount = Number(couponForm.discount);
    if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0) return 0;
    return (previewAmount * parsedDiscount) / 100;
  }, [couponForm.discount, previewAmount]);

  const previewFinalAmount = useMemo(
    () => Math.max(previewAmount - previewDiscountAmount, 0),
    [previewAmount, previewDiscountAmount],
  );

  const emitBannerUpdate = useCallback(
    (slides: ManagedBannerSlide[]) => {
      onBannersUpdated?.(
        [...slides]
          .sort((a, b) => a.sequence - b.sequence)
          .filter((slide) => slide.isActive && slide.imageUrl.trim()),
      );
    },
    [onBannersUpdated],
  );

  const loadCoupons = useCallback(async () => {
    if (!showCoupons) return;
    try {
      setLoadingCoupons(true);
      const response = await fetch("/api/dashboard/coupons", { cache: "no-store" });
      const payload = await parseJsonResponse<ApiResponse & { coupons?: CouponItem[] }>(response);
      if (!response.ok) {
        setCouponError(toMessage(payload, "Failed to load coupons."));
        setCoupons([]);
        return;
      }
      setCoupons(
        Array.isArray(payload.coupons)
          ? payload.coupons.map((coupon) => ({
              ...coupon,
              maxUsesPerUser: Number.isFinite(Number(coupon.maxUsesPerUser))
                ? Math.max(1, Math.floor(Number(coupon.maxUsesPerUser)))
                : 1,
            }))
          : [],
      );
    } catch (error: unknown) {
      setCouponError(error instanceof Error ? error.message : "Failed to load coupons.");
      setCoupons([]);
    } finally {
      setLoadingCoupons(false);
    }
  }, [showCoupons]);

  const loadBanners = useCallback(async () => {
    if (!showBanners) return;
    try {
      setLoadingBanners(true);
      const response = await fetch("/api/dashboard/banners", { cache: "no-store" });
      const payload = await parseJsonResponse<ApiResponse & {
        slides?: Array<{ imageUrl?: string; isActive?: boolean; sequence?: number }>;
      }>(response);
      if (!response.ok) {
        setBannerError(toMessage(payload, "Failed to load banners."));
        setBanners([]);
        emitBannerUpdate([]);
        return;
      }

      const slides = Array.isArray(payload.slides)
        ? payload.slides
            .map((item, index) => ({
              imageUrl: String(item.imageUrl ?? "").trim(),
              isActive: item.isActive === undefined ? true : Boolean(item.isActive),
              sequence: Number.isFinite(Number(item.sequence)) ? Number(item.sequence) : index,
            }))
            .filter((item) => Boolean(item.imageUrl))
            .sort((a, b) => a.sequence - b.sequence)
        : [];

      setBanners(slides);
      emitBannerUpdate(slides);
    } catch (error: unknown) {
      setBannerError(error instanceof Error ? error.message : "Failed to load banners.");
      setBanners([]);
      emitBannerUpdate([]);
    } finally {
      setLoadingBanners(false);
    }
  }, [emitBannerUpdate, showBanners]);

  useEffect(() => {
    loadCoupons();
    loadBanners();
  }, [loadBanners, loadCoupons]);

  useEffect(() => {
    emitBannerUpdate(banners);
  }, [banners, emitBannerUpdate]);

  const handleCreateCoupon = async () => {
    setCouponMessage("");
    setCouponError("");

    const code = couponForm.code.trim().toUpperCase();
    const discount = Number(couponForm.discount);
    const expiryDate = couponForm.expiryDate;
    const maxUsesPerUser = Number(couponForm.maxUsesPerUser);

    if (!code) {
      setCouponError("Coupon code is required.");
      return;
    }
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      setCouponError("Discount must be between 0 and 100.");
      return;
    }
    if (!expiryDate) {
      setCouponError("Expiry date is required.");
      return;
    }
    if (expiryDate < todayDateInput()) {
      setCouponError("Expiry date cannot be in the past.");
      return;
    }
    if (!Number.isFinite(maxUsesPerUser) || maxUsesPerUser < 1) {
      setCouponError("Max uses per user must be at least 1.");
      return;
    }

    try {
      setSavingCoupon(true);
      const response = await fetch("/api/dashboard/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          discount,
          expiryDate,
          maxUsesPerUser,
          isActive: couponForm.isActive,
        }),
      });
      const payload = await parseJsonResponse<ApiResponse>(response);
      if (!response.ok) {
        setCouponError(toMessage(payload, "Failed to create coupon."));
        return;
      }

      setCouponMessage(toMessage(payload, "Coupon created successfully."));
      setCouponForm(emptyCouponForm);
      await loadCoupons();
    } catch (error: unknown) {
      setCouponError(error instanceof Error ? error.message : "Failed to create coupon.");
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleUpdateCoupon = async (coupon: CouponItem) => {
    setCouponMessage("");
    setCouponError("");
    const normalizedCode = coupon.code.trim().toUpperCase();
    const normalizedExpiry = toDateInput(coupon.expiryDate);
    if (!normalizedCode) {
      setCouponError("Coupon code cannot be empty.");
      return;
    }
    if (!Number.isFinite(coupon.discount) || coupon.discount < 0 || coupon.discount > 100) {
      setCouponError("Discount must be between 0 and 100.");
      return;
    }
    if (!normalizedExpiry) {
      setCouponError("Valid expiry date is required.");
      return;
    }
    if (normalizedExpiry < todayDateInput()) {
      setCouponError("Expiry date cannot be in the past.");
      return;
    }
    if (!Number.isFinite(coupon.maxUsesPerUser) || coupon.maxUsesPerUser < 1) {
      setCouponError("Max uses per user must be at least 1.");
      return;
    }
    try {
      const response = await fetch("/api/dashboard/coupons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: coupon.id,
          code: normalizedCode,
          discount: coupon.discount,
          isActive: coupon.isActive,
          expiryDate: normalizedExpiry,
          maxUsesPerUser: coupon.maxUsesPerUser,
        }),
      });
      const payload = await parseJsonResponse<ApiResponse>(response);
      if (!response.ok) {
        setCouponError(toMessage(payload, "Failed to update coupon."));
        return;
      }
      setCouponMessage(toMessage(payload, "Coupon updated."));
      await loadCoupons();
    } catch (error: unknown) {
      setCouponError(error instanceof Error ? error.message : "Failed to update coupon.");
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    setCouponMessage("");
    setCouponError("");
    try {
      const response = await fetch("/api/dashboard/coupons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await parseJsonResponse<ApiResponse>(response);
      if (!response.ok) {
        setCouponError(toMessage(payload, "Failed to remove coupon."));
        return;
      }
      setCouponMessage(toMessage(payload, "Coupon removed successfully."));
      await loadCoupons();
    } catch (error: unknown) {
      setCouponError(error instanceof Error ? error.message : "Failed to remove coupon.");
    }
  };

  const handleUploadBannerImage = async (file: File) => {
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      setBannerError("Only image files are allowed.");
      return;
    }
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setBannerError("Banner image size must be 5 MB or less.");
      return;
    }

    try {
      setUploadingBannerImage(true);
      setBannerError("");
      const formData = new FormData();
      formData.append("image", file);
      formData.append("folder", "dashboard/banners");
      const response = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData,
      });
      const payload = await parseJsonResponse<ApiResponse & { imageUrl?: string }>(response);
      if (!response.ok || !payload.imageUrl) {
        setBannerError(toMessage(payload, "Failed to upload banner image."));
        return;
      }
      setBannerForm((prev) => ({ ...prev, imageUrl: payload.imageUrl || "" }));
    } catch (error: unknown) {
      setBannerError(error instanceof Error ? error.message : "Failed to upload banner image.");
    } finally {
      setUploadingBannerImage(false);
    }
  };

  const addBannerLocally = () => {
    setBannerError("");
    setBannerMessage("");
    const imageUrl = bannerForm.imageUrl.trim();
    const safeImageUrl = getSafeImageUrl(imageUrl);
    if (!safeImageUrl) {
      setBannerError("Use a valid HTTPS banner image URL.");
      return;
    }
    const duplicate = banners.some((item) => item.imageUrl.trim() === safeImageUrl);
    if (duplicate) {
      setBannerError("This banner image is already in the list.");
      return;
    }

    setBanners((prev) => [
      ...prev,
      {
        imageUrl: safeImageUrl,
        isActive: bannerForm.isActive,
        sequence: prev.length,
      },
    ]);
    setBannerForm(emptyBannerForm);
  };

  const updateBannerField = (index: number, patch: Partial<ManagedBannerSlide>) => {
    setBanners((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeBanner = (index: number) => {
    setBanners((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((item, sequence) => ({ ...item, sequence })),
    );
  };

  const moveBanner = (index: number, direction: "up" | "down") => {
    setBanners((prev) => {
      const next = [...prev];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= next.length) return prev;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next.map((item, sequence) => ({ ...item, sequence }));
    });
  };

  const saveBanners = async () => {
    setBannerMessage("");
    setBannerError("");
    try {
      setSavingBanners(true);
      const payloadSlides = banners
        .map((item, index) => ({
          imageUrl: item.imageUrl.trim(),
          isActive: Boolean(item.isActive),
          sequence: index,
        }))
        .filter((item) => Boolean(item.imageUrl));

      if (payloadSlides.length === 0) {
        setBannerError("Add at least one banner before saving.");
        return;
      }

      const response = await fetch("/api/dashboard/banners", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides: payloadSlides }),
      });
      const payload = await parseJsonResponse<ApiResponse & {
        slides?: Array<{ imageUrl?: string; isActive?: boolean; sequence?: number }>;
      }>(response);
      if (!response.ok) {
        setBannerError(toMessage(payload, "Failed to save banners."));
        return;
      }

      const savedSlides = Array.isArray(payload.slides)
        ? payload.slides
            .map((item, index) => ({
              imageUrl: String(item.imageUrl ?? "").trim(),
              isActive: item.isActive === undefined ? true : Boolean(item.isActive),
              sequence: Number.isFinite(Number(item.sequence)) ? Number(item.sequence) : index,
            }))
            .filter((item) => Boolean(item.imageUrl))
            .sort((a, b) => a.sequence - b.sequence)
        : payloadSlides;

      setBanners(savedSlides);
      emitBannerUpdate(savedSlides);
      setBannerMessage(toMessage(payload, "Dashboard banners updated successfully."));
    } catch (error: unknown) {
      setBannerError(error instanceof Error ? error.message : "Failed to save banners.");
    } finally {
      setSavingBanners(false);
    }
  };

  return (
    <div className="space-y-8">
      {showCoupons && (
        <div className="rounded-2xl border border-[#4e573f] bg-[#1f251c] p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Icon icon="mdi:ticket-percent-outline" className="text-xl text-[#E4E67A]" />
            <h2 className="text-xl font-semibold text-[#E4E67A]">Coupon Management</h2>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-1">
              <p className="text-xs text-white/65">Coupon Code</p>
              <input
                value={couponForm.code}
                onChange={(event) =>
                  setCouponForm((prev) => ({ ...prev, code: event.target.value.toUpperCase().slice(0, 20) }))
                }
                placeholder="Coupon Code"
                className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/70"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/65">Discount (%)</p>
              <input
                type="number"
                min={0}
                max={100}
                value={couponForm.discount}
                onChange={(event) => setCouponForm((prev) => ({ ...prev, discount: event.target.value }))}
                placeholder="Discount %"
                className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/70"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/65">Expiry Date</p>
              <CustomDatePicker
                value={couponForm.expiryDate}
                onChange={(nextValue) =>
                  setCouponForm((prev) => ({ ...prev, expiryDate: nextValue }))
                }
                minDate={todayDateInput()}
                restrictToAvailableDates={false}
                syncWithCartDate={false}
                placeholder="Select expiry date"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/65">Max Uses / User</p>
              <input
                type="number"
                min={1}
                value={couponForm.maxUsesPerUser}
                onChange={(event) => setCouponForm((prev) => ({ ...prev, maxUsesPerUser: event.target.value }))}
                placeholder="1"
                className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#CDD645]/70"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/65">Status</p>
              <label className="inline-flex w-full items-center gap-2 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white/90">
                <input
                  type="checkbox"
                  checked={couponForm.isActive}
                  onChange={(event) => setCouponForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  className="h-4 w-4 accent-[#CDD645]"
                />
                Active
              </label>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleCreateCoupon}
                disabled={savingCoupon}
                className="w-full rounded-lg border border-[#D5E400]/70 bg-[#D5E400]/10 px-4 py-2 text-sm font-semibold text-[#E4E67A] hover:bg-[#D5E400]/20 disabled:opacity-60"
              >
                {savingCoupon ? "Adding..." : "Add Coupon"}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/15 bg-black/20 p-3">
            <p className="text-xs text-white/65">Coupon Preview</p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-white/70">
                <span>Amount (Rs)</span>
                <input
                  type="number"
                  min={0}
                  value={couponPreviewAmount}
                  onChange={(event) => setCouponPreviewAmount(event.target.value)}
                  className="w-28 rounded-md border border-white/20 bg-black/30 px-2 py-1 text-xs text-white outline-none"
                />
              </label>
              <span className="text-xs text-white/80">Save: Rs {previewDiscountAmount.toFixed(2)}</span>
              <span className="text-xs text-[#E4E67A]">Final: Rs {previewFinalAmount.toFixed(2)}</span>
            </div>
          </div>

          {couponError && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {couponError}
            </div>
          )}
          {couponMessage && (
            <div className="mt-4 rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
              {couponMessage}
            </div>
          )}

          <div className="mt-5 space-y-3">
            {loadingCoupons ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`coupon-skeleton-${index}`}
                  className="rounded-xl border border-white/15 bg-black/20 p-3"
                >
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-7">
                    {Array.from({ length: 7 }).map((__, cellIndex) => (
                      <div key={`coupon-skeleton-cell-${index}-${cellIndex}`} className="space-y-1">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : coupons.length === 0 ? (
              <div className="rounded-xl border border-white/15 bg-black/20 p-3 text-sm text-white/70">
                No coupons found.
              </div>
            ) : (
              coupons.map((coupon) => (
                <div key={coupon.id} className="rounded-xl border border-white/15 bg-black/20 p-3">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-7">
                    <div className="space-y-1">
                      <p className="text-[11px] text-white/60">Coupon Code</p>
                      <input
                        value={coupon.code}
                        onChange={(event) =>
                          setCoupons((prev) =>
                            prev.map((item) =>
                              item.id === coupon.id
                                ? { ...item, code: event.target.value.toUpperCase().slice(0, 20) }
                                : item,
                            ),
                          )
                        }
                        className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-white/60">Discount (%)</p>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={coupon.discount}
                        onChange={(event) =>
                          setCoupons((prev) =>
                            prev.map((item) =>
                              item.id === coupon.id ? { ...item, discount: Number(event.target.value) || 0 } : item,
                            ),
                          )
                        }
                        className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-white/60">Expiry Date</p>
                      <CustomDatePicker
                        value={toDateInput(coupon.expiryDate)}
                        onChange={(nextValue) =>
                          setCoupons((prev) =>
                            prev.map((item) =>
                              item.id === coupon.id
                                ? {
                                    ...item,
                                    expiryDate: nextValue ? new Date(nextValue).toISOString() : item.expiryDate,
                                  }
                                : item,
                            ),
                          )
                        }
                        minDate={todayDateInput()}
                        restrictToAvailableDates={false}
                        syncWithCartDate={false}
                        placeholder="Select expiry date"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-white/60">Max Uses / User</p>
                      <input
                        type="number"
                        min={1}
                        value={coupon.maxUsesPerUser}
                        onChange={(event) =>
                          setCoupons((prev) =>
                            prev.map((item) =>
                              item.id === coupon.id
                                ? { ...item, maxUsesPerUser: Math.max(1, Number(event.target.value) || 1) }
                                : item,
                            ),
                          )
                        }
                        className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-white/60">Status</p>
                      <label className="inline-flex w-full items-center gap-2 rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-xs text-white/90">
                        <input
                          type="checkbox"
                          checked={coupon.isActive}
                          onChange={(event) =>
                            setCoupons((prev) =>
                              prev.map((item) =>
                                item.id === coupon.id ? { ...item, isActive: event.target.checked } : item,
                              ),
                            )
                          }
                          className="h-3.5 w-3.5 accent-[#CDD645]"
                        />
                        Active
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdateCoupon(coupon)}
                      className="rounded-md border border-[#D5E400]/60 px-2 py-1.5 text-xs font-semibold text-[#E4E67A] hover:bg-[#D5E400]/10"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCoupon(coupon.id)}
                      className="rounded-md border border-red-400/60 px-2 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showBanners && (
        <div className="rounded-2xl border border-[#4e573f] bg-[#1f251c] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:image-multiple-outline" className="text-xl text-[#E4E67A]" />
              <h2 className="text-xl font-semibold text-[#E4E67A]">Banner Management (Image Only)</h2>
            </div>
            <span className="text-xs text-white/65">
              {activeBannerCount} active of {banners.length} total
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <div className="rounded-xl border border-white/15 bg-black/20 p-3">
              <p className="text-xs text-white/70">Upload Banner Image</p>
              <div className="mt-2 flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#D5E400]/60 px-2 py-1 text-xs text-[#E4E67A] hover:bg-[#D5E400]/10">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      handleUploadBannerImage(file);
                    }}
                  />
                  <Icon icon="mdi:upload" />
                  {uploadingBannerImage ? "Uploading..." : "Upload Image"}
                </label>
                {bannerForm.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setBannerForm((prev) => ({ ...prev, imageUrl: "" }))}
                    className="rounded-md border border-white/20 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] text-white/55">Only uploaded image banners are supported.</p>
            </div>

            <div className="rounded-xl border border-white/15 bg-black/20 p-3">
              <p className="text-xs text-white/65">New Banner Image Preview</p>
              <div className="mt-2 h-28 overflow-hidden rounded-lg border border-white/15 bg-black/40">
                {getSafeImageUrl(bannerForm.imageUrl) ? (
                  <Image
                    src={getSafeImageUrl(bannerForm.imageUrl)}
                    alt="banner preview"
                    width={600}
                    height={200}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-white/45">
                    Image preview appears here
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between gap-3 rounded-xl border border-white/15 bg-black/20 p-3">
              <div className="space-y-1">
                <p className="text-xs text-white/65">Status</p>
                <label className="inline-flex items-center gap-2 text-sm text-white/85">
                  <input
                    type="checkbox"
                    checked={bannerForm.isActive}
                    onChange={(event) => setBannerForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                    className="h-4 w-4 accent-[#CDD645]"
                  />
                  Active
                </label>
              </div>
              <button
                type="button"
                onClick={addBannerLocally}
                disabled={!getSafeImageUrl(bannerForm.imageUrl) || uploadingBannerImage}
                className="rounded-md border border-[#D5E400]/60 px-3 py-2 text-sm font-semibold text-[#E4E67A] hover:bg-[#D5E400]/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add Banner
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/15 bg-black/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-white/65">Live Carousel Preview</p>
              <span className="text-[11px] text-white/55">
                Active: {activeBannerSlidesForPreview.length} / Total: {orderedBanners.length}
              </span>
            </div>
            <BannerCarouselPreview slides={activeBannerSlidesForPreview} />
            <p className="mt-2 text-[11px] text-white/55">
              Preview updates instantly from current banner list (existing and newly added).
            </p>
          </div>

          {bannerError && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {bannerError}
            </div>
          )}
          {bannerMessage && (
            <div className="mt-4 rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
              {bannerMessage}
            </div>
          )}

          <div className="mt-5 space-y-3">
            {loadingBanners ? (
              Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={`banner-skeleton-${index}`}
                  className="rounded-xl border border-white/15 bg-black/20 p-3"
                >
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-[120px_auto_auto_auto] lg:items-center">
                    <Skeleton className="h-16 w-full rounded" />
                    <Skeleton className="h-8 w-36" />
                    <div className="flex gap-1">
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))
            ) : banners.length === 0 ? (
              <div className="rounded-xl border border-white/15 bg-black/20 p-3 text-sm text-white/70">
                No banners configured yet.
              </div>
            ) : (
              banners.map((banner, index) => (
                <div key={`${banner.imageUrl}-${index}`} className="rounded-xl border border-white/15 bg-black/20 p-3">
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-[120px_auto_auto_auto] lg:items-center">
                    <div className="h-16 overflow-hidden rounded border border-white/15 bg-black/40">
                      {getSafeImageUrl(banner.imageUrl) ? (
                        <Image
                          src={getSafeImageUrl(banner.imageUrl)}
                          alt={`banner ${index + 1}`}
                          width={240}
                          height={120}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-white/40">No preview</div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-white/60">Status</p>
                      <label className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-xs text-white/90">
                        <input
                          type="checkbox"
                          checked={banner.isActive}
                          onChange={(event) => updateBannerField(index, { isActive: event.target.checked })}
                          className="h-3.5 w-3.5 accent-[#CDD645]"
                        />
                        Active
                      </label>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveBanner(index, "up")}
                        className="rounded-md border border-white/20 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBanner(index, "down")}
                        className="rounded-md border border-white/20 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
                      >
                        Down
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBanner(index)}
                      className="rounded-md border border-red-400/60 px-2 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={loadBanners}
              className="rounded-lg border border-white/25 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={saveBanners}
              disabled={savingBanners}
              className="rounded-lg border border-[#D5E400]/70 bg-[#D5E400]/10 px-4 py-2 text-sm font-semibold text-[#E4E67A] hover:bg-[#D5E400]/20 disabled:opacity-60"
            >
              {savingBanners ? "Saving..." : "Save Banners"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
