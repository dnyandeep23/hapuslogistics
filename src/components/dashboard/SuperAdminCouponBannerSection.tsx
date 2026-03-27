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
  expiryDate: string | null;
  maxUsesPerUser: number;
};

type CouponForm = {
  code: string;
  discount: string;
  expiryDate: string;
  noExpiry: boolean;
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
  noExpiry: false,
  maxUsesPerUser: "1",
  isActive: true,
};

const emptyBannerForm: BannerForm = {
  imageUrl: "",
  isActive: true,
};

const toDateInput = (value: string | null | undefined) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const todayDateInput = () => new Date().toISOString().slice(0, 10);

function formatDate(value: string | null | undefined): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

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
      <div className="dashboard-surface-soft flex h-44 items-center justify-center rounded-xl text-xs text-white/55">
        No active banners to preview.
      </div>
    );
  }

  const safeIndex = ((activeIndex % slides.length) + slides.length) % slides.length;
  const goPrev = () => setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  const goNext = () => setActiveIndex((prev) => (prev + 1) % slides.length);

  return (
    <div className="dashboard-surface relative overflow-hidden rounded-xl">
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
  const [isAddingCoupon, setIsAddingCoupon] = useState(false);
  const [editingCouponItem, setEditingCouponItem] = useState<CouponItem | null>(null);
  const [isAddingBanner, setIsAddingBanner] = useState(false);
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
              expiryDate: coupon.expiryDate ? String(coupon.expiryDate) : null,
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
    const expiryDate = couponForm.noExpiry ? null : couponForm.expiryDate;
    const maxUsesPerUser = Number(couponForm.maxUsesPerUser);

    if (!code) {
      setCouponError("Coupon code is required.");
      return;
    }
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      setCouponError("Discount must be between 0 and 100.");
      return;
    }
    if (!couponForm.noExpiry && !expiryDate) {
      setCouponError("Expiry date is required unless no expiry is enabled.");
      return;
    }
    if (expiryDate && expiryDate < todayDateInput()) {
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
      setIsAddingCoupon(false);
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
    const normalizedExpiry = coupon.expiryDate ? toDateInput(coupon.expiryDate) : null;
    if (!normalizedCode) {
      setCouponError("Coupon code cannot be empty.");
      return;
    }
    if (!Number.isFinite(coupon.discount) || coupon.discount < 0 || coupon.discount > 100) {
      setCouponError("Discount must be between 0 and 100.");
      return;
    }
    if (normalizedExpiry && normalizedExpiry < todayDateInput()) {
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
      setEditingCouponItem(null);
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
    setIsAddingBanner(false);
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
        <div className="dashboard-surface rounded-3xl p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#CDD645]/10 text-[#E4E67A] shadow-[0_0_15px_rgba(205,214,69,0.2)]">
                <Icon icon="mdi:ticket-percent-outline" className="text-xl" />
              </div>
              <h2 className="text-xl font-bold text-white/90 tracking-wide">Coupon Management</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setCouponForm(emptyCouponForm);
                setCouponError("");
                setCouponMessage("");
                setIsAddingCoupon(true);
              }}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#CDD645] px-5 py-2.5 text-sm font-bold tracking-wide text-black shadow-lg shadow-[#CDD645]/20 transition-all hover:bg-[#E4E67A] active:scale-95"
            >
              <Icon icon="solar:add-circle-bold-duotone" className="text-lg" />
              Create Coupon
            </button>
          </div>

          {couponError && !isAddingCoupon && !editingCouponItem && (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {couponError}
            </div>
          )}
          {couponMessage && !isAddingCoupon && !editingCouponItem && (
            <div className="mb-4 rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
              {couponMessage}
            </div>
          )}

          <div className="mt-2 space-y-4">
            {loadingCoupons ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={`coupon-skeleton-${index}`} className="h-40 w-full rounded-2xl" />
                ))}
              </div>
            ) : coupons.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 bg-white/5 text-sm font-medium text-white/50">
                <Icon icon="mdi:ticket-outline" className="text-3xl opacity-50" />
                No active coupons found.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {coupons.map((coupon) => (
                  <div key={coupon.id} className="group relative overflow-hidden rounded-2xl bg-[#CDD645] p-[1px] shadow-lg transition-transform hover:-translate-y-1">
                    <div className="relative flex h-full flex-col justify-between rounded-[15px] bg-[#141A14] p-5">
                      <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-r-[#CDD645] bg-[#0A0E0A]"></div>
                      <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-l-[#CDD645] bg-[#0A0E0A]"></div>
                      
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-mono text-2xl font-black tracking-widest text-[#CDD645] drop-shadow-[0_0_8px_rgba(205,214,69,0.3)]">
                            {coupon.code}
                          </p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-white/50">
                            {coupon.discount}% Discount
                          </p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          coupon.isActive ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/50"
                        }`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${coupon.isActive ? "bg-emerald-400" : "bg-white/40"}`} />
                          {coupon.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div className="mt-6 flex items-end justify-between border-t border-dashed border-white/20 pt-4">
                        <div className="space-y-1 text-xs text-white/60">
                          <p>Uses: <span className="font-semibold text-white/90">{coupon.maxUsesPerUser} / User</span></p>
                          <p>Expires: <span className="font-semibold text-white/90">{coupon.expiryDate ? formatDate(coupon.expiryDate) : "Never"}</span></p>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCouponItem(coupon);
                              setCouponError("");
                              setCouponMessage("");
                            }}
                            className="rounded-lg bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
                            aria-label="Edit Coupon"
                          >
                            <Icon icon="solar:pen-bold-duotone" className="text-base" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCoupon(coupon.id)}
                            className="rounded-lg bg-red-500/10 p-2 text-red-400 transition hover:bg-red-500/20"
                            aria-label="Delete Coupon"
                          >
                            <Icon icon="solar:trash-bin-trash-broken" className="text-base" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {(isAddingCoupon || editingCouponItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => {
              if (savingCoupon) return;
              setIsAddingCoupon(false);
              setEditingCouponItem(null);
            }}
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#1A221A] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/20 p-5">
              <h2 className="text-xl font-bold text-[#E4E67A]">
                {editingCouponItem ? "Edit Coupon" : "New Coupon"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsAddingCoupon(false);
                  setEditingCouponItem(null);
                }}
                disabled={savingCoupon}
                className="rounded-full bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <Icon icon="mdi:close" className="text-xl" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-5 sm:p-6 custom-scrollbar">
              <div className="space-y-5">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/50 block">
                  Coupon Code
                  <input
                    value={editingCouponItem ? editingCouponItem.code : couponForm.code}
                    onChange={(event) => {
                      const val = event.target.value.toUpperCase().slice(0, 20);
                      if (editingCouponItem) setEditingCouponItem(prev => ({ ...prev!, code: val }));
                      else setCouponForm(prev => ({ ...prev, code: val }));
                    }}
                    placeholder="e.g. SUMMER50"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm tracking-wider text-white shadow-inner transition-all focus:border-[#CDD645]/50 focus:bg-black/60 focus:outline-none"
                  />
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/50 block">
                    Discount (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editingCouponItem ? editingCouponItem.discount : couponForm.discount}
                      onChange={(event) => {
                        const val = event.target.value;
                        if (editingCouponItem) setEditingCouponItem(prev => ({ ...prev!, discount: Number(val) }));
                        else setCouponForm(prev => ({ ...prev, discount: val }));
                      }}
                      placeholder="%"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white shadow-inner transition-all focus:border-[#CDD645]/50 focus:bg-black/60 focus:outline-none"
                    />
                  </label>
                  
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/50 block">
                    Max Uses / User
                    <input
                      type="number"
                      min={1}
                      value={editingCouponItem ? editingCouponItem.maxUsesPerUser : couponForm.maxUsesPerUser}
                      onChange={(event) => {
                        const val = event.target.value;
                        if (editingCouponItem) setEditingCouponItem(prev => ({ ...prev!, maxUsesPerUser: Number(val) }));
                        else setCouponForm(prev => ({ ...prev, maxUsesPerUser: val }));
                      }}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white shadow-inner transition-all focus:border-[#CDD645]/50 focus:bg-black/60 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Expiry Date</p>
                    <label className="inline-flex cursor-pointer items-center gap-3">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={editingCouponItem ? !editingCouponItem.expiryDate : couponForm.noExpiry}
                          onChange={(event) => {
                            const isNoExpiry = event.target.checked;
                            if (editingCouponItem) {
                                setEditingCouponItem(prev => ({ ...prev!, expiryDate: isNoExpiry ? null : new Date().toISOString() }));
                            } else {
                                setCouponForm(prev => ({
                                  ...prev,
                                  noExpiry: isNoExpiry,
                                  expiryDate: isNoExpiry ? "" : (prev.expiryDate || todayDateInput()),
                                }));
                            }
                          }}
                          className="peer sr-only"
                        />
                        <div className="h-5 w-9 rounded-full bg-white/10 shadow-inner transition peer-checked:bg-[#CDD645]"></div>
                        <div className="absolute inset-y-0 left-0 m-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4"></div>
                      </div>
                      <span className="text-[11px] font-bold text-white/80">Never Expires</span>
                    </label>
                  </div>
                  
                  {!(editingCouponItem ? !editingCouponItem.expiryDate : couponForm.noExpiry) && (
                    <CustomDatePicker
                      value={editingCouponItem ? toDateInput(editingCouponItem.expiryDate) : couponForm.expiryDate}
                      onChange={(nextValue) => {
                        if (editingCouponItem) {
                            setEditingCouponItem(prev => ({ ...prev!, expiryDate: nextValue ? new Date(nextValue).toISOString() : null }));
                        } else {
                             setCouponForm(prev => ({ ...prev, expiryDate: nextValue }));
                        }
                      }}
                      minDate={todayDateInput()}
                      restrictToAvailableDates={false}
                      syncWithCartDate={false}
                      placeholder="Select expiry date"
                    />
                  )}
                </div>

                <div className="rounded-2xl border border-white/5 bg-black/20 p-4 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Status</p>
                    <label className="inline-flex cursor-pointer items-center gap-3">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={editingCouponItem ? editingCouponItem.isActive : couponForm.isActive}
                          onChange={(event) => {
                              const active = event.target.checked;
                              if (editingCouponItem) setEditingCouponItem(prev => ({ ...prev!, isActive: active }));
                              else setCouponForm(prev => ({ ...prev, isActive: active }));
                          }}
                          className="peer sr-only"
                        />
                        <div className="h-5 w-9 rounded-full bg-white/10 shadow-inner transition peer-checked:bg-[#CDD645]"></div>
                        <div className="absolute inset-y-0 left-0 m-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4"></div>
                      </div>
                      <span className="text-[11px] font-bold text-white/80">Active</span>
                    </label>
                </div>

                {!editingCouponItem && (
                  <div className="dashboard-surface-soft rounded-xl p-4 mt-2">
                    <p className="text-xs text-white/65 font-medium mb-3">Live Math Preview</p>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs text-white/70 bg-black/40 rounded-lg pr-2 border border-white/5 focus-within:border-[#CDD645]/50">
                        <span className="pl-3 py-2 font-medium">Cart total ₹</span>
                        <input
                          type="number"
                          min={0}
                          value={couponPreviewAmount}
                          onChange={(event) => setCouponPreviewAmount(event.target.value)}
                          className="w-20 bg-transparent py-2 text-xs text-white outline-none"
                        />
                      </label>
                      <div className="text-right">
                        <p className="text-xs text-emerald-400">Save: ₹{previewDiscountAmount.toFixed(2)}</p>
                        <p className="text-sm font-bold text-[#E4E67A]">Final: ₹{previewFinalAmount.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {couponError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-medium text-red-300">{couponError}</div>}
              </div>
            </div>
            
            <div className="border-t border-white/10 bg-black/20 p-5">
              <button
                type="button"
                onClick={() => {
                  if (editingCouponItem) handleUpdateCoupon(editingCouponItem);
                  else handleCreateCoupon();
                }}
                disabled={savingCoupon}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#CDD645] px-5 py-3.5 text-[15px] font-bold tracking-wide text-black shadow-lg shadow-[#CDD645]/20 transition-all hover:bg-[#E4E67A] active:scale-95 disabled:opacity-60"
              >
                <Icon icon={savingCoupon ? "line-md:loading-loop" : (editingCouponItem ? "solar:pen-bold-duotone" : "solar:add-circle-bold-duotone")} className="text-xl" />
                {savingCoupon ? "Saving..." : (editingCouponItem ? "Update Coupon" : "Create Coupon")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBanners && (
        <div className="dashboard-surface mt-8 rounded-3xl p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#CDD645]/10 text-[#E4E67A] shadow-[0_0_15px_rgba(205,214,69,0.2)]">
                <Icon icon="mdi:image-multiple-outline" className="text-xl" />
              </div>
              <h2 className="text-xl font-bold text-white/90 tracking-wide">Banner Carousel</h2>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="hidden text-xs font-semibold text-white/50 sm:inline-block">
                {activeBannerCount} active ({banners.length} total)
              </span>
              <button
                type="button"
                onClick={() => {
                  setBannerForm(emptyBannerForm);
                  setBannerError("");
                  setBannerMessage("");
                  setIsAddingBanner(true);
                }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#CDD645] px-5 py-2.5 text-sm font-bold tracking-wide text-black shadow-lg shadow-[#CDD645]/20 transition-all hover:bg-[#E4E67A] active:scale-95"
              >
                <Icon icon="solar:camera-add-bold-duotone" className="text-lg" />
                Add Banner
              </button>
            </div>
          </div>

          <div className="dashboard-surface-soft mt-2 rounded-[20px] p-4 shadow-inner">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Live Carousel Preview</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/10">
                <BannerCarouselPreview slides={activeBannerSlidesForPreview} />
            </div>
            <p className="mt-3 text-center text-[11px] text-white/40">
              This preview accurately reflects how the homepage carousel will render currently active uploaded banners.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-white/5 pt-5">
            <button
              type="button"
              onClick={loadBanners}
              className="rounded-xl bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              Reset Drafts
            </button>
            <button
              type="button"
              onClick={saveBanners}
              disabled={savingBanners}
              className="inline-flex items-center gap-2 rounded-xl bg-[#CDD645] px-5 py-2.5 text-sm font-bold tracking-wide text-black shadow-[#CDD645]/20 transition-all hover:bg-[#E4E67A] active:scale-95 disabled:opacity-60"
            >
              <Icon icon={savingBanners ? "line-md:loading-loop" : "solar:diskette-bold-duotone"} className="text-lg" />
              {savingBanners ? "Saving..." : "Save Changes"}
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">Arrangement & Editing</h3>
            {loadingBanners ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={`banner-skeleton-${index}`} className="h-[200px] w-full rounded-[20px]" />
                ))}
              </div>
            ) : banners.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-3 rounded-[20px] border border-white/5 bg-white/5 text-sm font-medium text-white/50">
                <Icon icon="mdi:image-off-outline" className="text-3xl opacity-50" />
                No banners added. Click "Add Banner" to upload one.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {banners.map((banner, index) => (
                  <div key={`${banner.imageUrl}-${index}`} className="group relative overflow-hidden rounded-[20px] border border-white/5 bg-[#141A14]/60 p-3 transition hover:border-white/10 hover:bg-[#1A221A]/80 shadow-lg">
                    <div className="absolute left-4 top-4 z-10 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[10px] font-bold text-[#E4E67A] backdrop-blur-md">
                      #{index + 1}
                    </div>
                    
                    <div className="relative h-32 w-full overflow-hidden rounded-xl border border-white/5 bg-black/40">
                      {getSafeImageUrl(banner.imageUrl) ? (
                        <Image
                          src={getSafeImageUrl(banner.imageUrl)}
                          alt={`banner ${index + 1}`}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-white/40">Broken URL</div>
                      )}

                      <div className="absolute bottom-2 right-2 flex gap-1 rounded-lg bg-black/60 p-1 backdrop-blur-md">
                        <button
                          type="button"
                          onClick={() => moveBanner(index, "up")}
                          disabled={index === 0}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-white/70 transition hover:bg-white/20 hover:text-white disabled:opacity-30"
                        >
                          <Icon icon="solar:round-alt-arrow-left-bold" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBanner(index, "down")}
                          disabled={index === banners.length - 1}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-white/70 transition hover:bg-white/20 hover:text-white disabled:opacity-30"
                        >
                          <Icon icon="solar:round-alt-arrow-right-bold" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between px-1">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={banner.isActive}
                            onChange={(event) => updateBannerField(index, { isActive: event.target.checked })}
                            className="peer sr-only"
                          />
                          <div className="h-4 w-7 rounded-full bg-white/10 shadow-inner transition peer-checked:bg-[#CDD645]"></div>
                          <div className="absolute inset-y-0 left-0 m-0.5 h-3 w-3 rounded-full bg-white transition peer-checked:translate-x-3"></div>
                        </div>
                        <span className="text-[11px] font-bold text-white/80">Active</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => removeBanner(index)}
                        className="rounded-lg bg-red-400/10 p-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-400/20"
                        aria-label="Remove Banner"
                      >
                        <Icon icon="solar:trash-bin-trash-outline" className="text-base" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isAddingBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => !uploadingBannerImage && setIsAddingBanner(false)}
          />
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#1A221A] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/20 p-5">
              <h2 className="text-xl font-bold text-[#E4E67A]">Upload Banner</h2>
              <button
                type="button"
                onClick={() => setIsAddingBanner(false)}
                disabled={uploadingBannerImage}
                className="rounded-full bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <Icon icon="mdi:close" className="text-xl" />
              </button>
            </div>
            
            <div className="p-5 sm:p-6">
              <div className="dashboard-surface-soft rounded-[20px] p-6 text-center border-2 border-dashed border-white/10 transition-colors hover:border-[#E4E67A]/40">
                <Icon icon="solar:gallery-send-bold-duotone" className="mx-auto text-4xl text-white/30" />
                <p className="mt-3 text-sm font-semibold text-white/80">Select a high-quality image</p>
                <p className="mt-1 text-[11px] text-white/50">1920x1080 recommended, max 5MB</p>
                
                <label className="mt-6 mx-auto inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white shadow-inner transition hover:bg-white/20">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) handleUploadBannerImage(file);
                    }}
                  />
                  {uploadingBannerImage ? (
                    <><Icon icon="line-md:loading-loop" /> Uploading...</>
                  ) : (
                    <><Icon icon="mdi:folder-upload" className="text-lg" /> Browse Files</>
                  )}
                </label>
              </div>

              {bannerForm.imageUrl && (
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">Preview</p>
                  <div className="relative h-32 w-full overflow-hidden rounded-xl border border-white/10 bg-black/50">
                    <Image
                      src={getSafeImageUrl(bannerForm.imageUrl)}
                      alt="New banner preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between rounded-xl border border-white/5 bg-black/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Immediately Active?</p>
                <label className="inline-flex cursor-pointer items-center gap-3">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={bannerForm.isActive}
                      onChange={(event) => setBannerForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-white/10 shadow-inner transition peer-checked:bg-[#CDD645]"></div>
                    <div className="absolute inset-y-0 left-0 m-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4"></div>
                  </div>
                </label>
              </div>

              {bannerError && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-medium text-red-300">{bannerError}</div>}
            </div>

            <div className="border-t border-white/10 bg-black/20 p-5">
              <button
                type="button"
                onClick={addBannerLocally}
                disabled={!getSafeImageUrl(bannerForm.imageUrl) || uploadingBannerImage}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#CDD645] px-5 py-3.5 text-[15px] font-bold tracking-wide text-black shadow-lg shadow-[#CDD645]/20 transition-all hover:bg-[#E4E67A] active:scale-95 disabled:opacity-60"
              >
                <Icon icon="solar:check-circle-bold-duotone" className="text-xl" />
                Add to Carousel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
