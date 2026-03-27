"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { useAppSelector } from "@/lib/redux/hooks";
import {
  DEFAULT_PACKAGE_CATEGORIES,
  DEFAULT_PACKAGE_SIZES,
  normalizePackageCategories,
  normalizePackageSizes,
  type PackageCategoryConfig,
  type PackageSizeConfig,
} from "@/lib/packageCatalog";

type CategoryDraft = PackageCategoryConfig;
type SizeDraft = PackageSizeConfig;
type IconifySearchPayload = {
  icons?: string[];
};

const ICONIFY_SEARCH_ENDPOINT = "https://api.iconify.design/search";
const ICON_SEARCH_LIMIT = 60;
const DEFAULT_ICON_SEARCH_QUERY = "package";

const makeCategoryDraft = (index: number): CategoryDraft => ({
  name: "",
  icon: "mdi:shape-outline",
  defaultFare: 0,
  isActive: true,
  sortOrder: index + 1,
});

const makeSizeDraft = (index: number): SizeDraft => ({
  name: "",
  description: "",
  maxWeightKg: 1,
  priceMultiplier: 1,
  visualScale: 1,
  isActive: true,
  sortOrder: index + 1,
});

export default function PackageCatalogDashboardPage() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.user);

  const [categories, setCategories] = useState<CategoryDraft[]>(normalizePackageCategories(DEFAULT_PACKAGE_CATEGORIES));
  const [sizes, setSizes] = useState<SizeDraft[]>(normalizePackageSizes(DEFAULT_PACKAGE_SIZES));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [iconPickerCategoryIndex, setIconPickerCategoryIndex] = useState<number | null>(null);
  const [iconSearchQuery, setIconSearchQuery] = useState("");
  const [iconSearchResults, setIconSearchResults] = useState<string[]>([]);
  const [iconSearchLoading, setIconSearchLoading] = useState(false);
  const [iconSearchError, setIconSearchError] = useState("");
  const [activeCategoryModal, setActiveCategoryModal] = useState<{ index: number | null; draft: CategoryDraft } | null>(null);
  const [activeSizeModal, setActiveSizeModal] = useState<{ index: number | null; draft: SizeDraft } | null>(null);

  const activeCategoryCount = useMemo(
    () => categories.filter((entry) => entry.isActive).length,
    [categories],
  );

  const activeSizeCount = useMemo(
    () => sizes.filter((entry) => entry.isActive).length,
    [sizes],
  );
  const iconPickerOpen = iconPickerCategoryIndex !== null;
  const iconPickerCategoryName =
    iconPickerCategoryIndex !== null ? categories[iconPickerCategoryIndex]?.name ?? "" : "";

  const loadCatalog = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/dashboard/package-catalog", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message || "Failed to load package catalog.");
        return;
      }

      setCategories(normalizePackageCategories(payload?.categories, DEFAULT_PACKAGE_CATEGORIES));
      setSizes(normalizePackageSizes(payload?.sizes, DEFAULT_PACKAGE_SIZES));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load package catalog.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (user.role !== "admin") {
      router.replace("/dashboard");
      return;
    }
    loadCatalog();
  }, [router, user]);

  const updateCategory = (index: number, updater: (current: CategoryDraft) => CategoryDraft) => {
    setCategories((prev) => prev.map((entry, entryIndex) => (entryIndex === index ? updater(entry) : entry)));
  };

  const updateSize = (index: number, updater: (current: SizeDraft) => SizeDraft) => {
    setSizes((prev) => prev.map((entry, entryIndex) => (entryIndex === index ? updater(entry) : entry)));
  };

  const addCategory = () => {
    setCategories((prev) => [...prev, makeCategoryDraft(prev.length)]);
  };

  const addSize = () => {
    setSizes((prev) => [...prev, makeSizeDraft(prev.length)]);
  };

  const removeCategory = (index: number) => {
    setCategories((prev) => (prev.length <= 1 ? prev : prev.filter((_, entryIndex) => entryIndex !== index)));
  };

  const removeSize = (index: number) => {
    setSizes((prev) => (prev.length <= 1 ? prev : prev.filter((_, entryIndex) => entryIndex !== index)));
  };

  const openIconPicker = (currentIconQuery: string) => {
    setIconPickerCategoryIndex(1); // just a flag to open the modal
    setIconSearchQuery(currentIconQuery || DEFAULT_ICON_SEARCH_QUERY);
    setIconSearchResults([]);
    setIconSearchError("");
  };

  const closeIconPicker = () => {
    setIconPickerCategoryIndex(null);
    setIconSearchQuery("");
    setIconSearchResults([]);
    setIconSearchError("");
    setIconSearchLoading(false);
  };

  const applyCategoryIcon = (iconName: string) => {
    if (activeCategoryModal) {
      setActiveCategoryModal(prev => prev ? { ...prev, draft: { ...prev.draft, icon: iconName } } : prev);
    }
    closeIconPicker();
  };

  // Previous effect relied on checking categories length, removed since index is not tied to active array anymore

  useEffect(() => {
    if (!iconPickerOpen) return;

    const normalizedQuery = iconSearchQuery.trim() || DEFAULT_ICON_SEARCH_QUERY;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIconSearchLoading(true);
        setIconSearchError("");
        const response = await fetch(
          `${ICONIFY_SEARCH_ENDPOINT}?query=${encodeURIComponent(normalizedQuery)}&limit=${ICON_SEARCH_LIMIT}`,
          { signal: controller.signal },
        );
        const payload = (await response.json().catch(() => ({}))) as IconifySearchPayload;
        if (!response.ok) {
          setIconSearchResults([]);
          setIconSearchError("Could not load icon results. Try a different search.");
          return;
        }

        const icons = Array.isArray(payload?.icons)
          ? payload.icons.filter((entry): entry is string => typeof entry === "string")
          : [];

        setIconSearchResults(icons);
        if (icons.length === 0) {
          setIconSearchError("No icons found for this search.");
        }
      } catch (searchError: unknown) {
        if (searchError instanceof Error && searchError.name === "AbortError") return;
        setIconSearchResults([]);
        setIconSearchError("Unable to reach Iconify search. Check internet and retry.");
      } finally {
        setIconSearchLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [iconPickerOpen, iconSearchQuery]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const payload = {
        categories,
        sizes,
      };

      const response = await fetch("/api/dashboard/package-catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data?.message || "Failed to save package catalog.");
        return;
      }

      setCategories(normalizePackageCategories(data?.categories, DEFAULT_PACKAGE_CATEGORIES));
      setSizes(normalizePackageSizes(data?.sizes, DEFAULT_PACKAGE_SIZES));
      setMessage(data?.message || "Package catalog updated.");
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save package catalog.");
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="rounded-2xl border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-200">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:shield-alert-outline" className="text-lg" />
          Access restricted to admin.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#E4E67A] xl:text-3xl">Package Catalog</h1>
          <p className="mt-1.5 text-sm text-white/50">
            Define package categories, sizes, and base tracking details across the platform.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider">
            <span className="rounded-md bg-[#E4E67A]/10 px-2.5 py-1 font-semibold text-[#f5f7b7]">
              {activeCategoryCount} Active Categories
            </span>
            <span className="rounded-md bg-sky-500/10 px-2.5 py-1 font-semibold text-sky-300">
              {activeSizeCount} Active Sizes
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-xl border border-[#D5E400]/70 bg-[#D5E400]/15 px-4 py-2 text-sm font-semibold text-[#EAF489] hover:bg-[#D5E400]/25 disabled:opacity-60"
        >
          <Icon icon={saving ? "line-md:loading-loop" : "mdi:content-save-outline"} />
          {saving ? "Saving" : "Save Changes"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</div>
      ) : null}

      {loading ? (
        <div className="dashboard-surface-soft rounded-2xl p-6 text-sm text-white/70">Loading package master...</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-1">
          <section className="dashboard-surface rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white/90 tracking-wide">Categories</h2>
                <p className="mt-1 text-xs text-white/40">Used for package type selection.</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCategoryModal({ index: null, draft: makeCategoryDraft(categories.length) })}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#CDD645]/10 border border-[#CDD645]/20 px-4 py-2 text-sm font-bold text-[#E4E67A] transition hover:bg-[#CDD645]/20"
              >
                <Icon icon="solar:folder-with-files-bold-duotone" className="text-lg" />
                Add Category
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category, index) => (
                <div key={`category-${index}`} className="group relative flex flex-col justify-between overflow-hidden rounded-[20px] bg-[#141A14]/60 p-5 border border-white/5 shadow-lg transition hover:border-[#CDD645]/30 hover:bg-[#1A221A]/80">
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#CDD645]/10 text-2xl text-[#E4E67A] shadow-[0_0_15px_rgba(205,214,69,0.15)] group-hover:scale-110 transition-transform">
                        <Icon icon={category.icon || "mdi:shape-outline"} />
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${category.isActive ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/50"
                        }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${category.isActive ? "bg-emerald-400" : "bg-white/40"}`} />
                        {category.isActive ? "Active" : "Hidden"}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white/90">{category.name || "Unnamed Category"}</h3>
                    <p className="mt-1 text-sm font-semibold text-[#E4E67A]">
                      Base Fare: ₹{(category.defaultFare || 0).toFixed(2)}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                    <span className="text-[11px] font-mono text-white/40 bg-white/5 px-2 py-1 rounded-md">Order: {category.sortOrder}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveCategoryModal({ index, draft: { ...category } })}
                        className="rounded-lg bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
                      >
                        <Icon icon="solar:pen-bold-duotone" className="text-base" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCategory(index)}
                        className="rounded-lg bg-red-500/10 p-2 text-red-400 transition hover:bg-red-500/20"
                      >
                        <Icon icon="solar:trash-bin-trash-broken" className="text-base" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="dashboard-surface rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white/90 tracking-wide">Package Sizes</h2>
                <p className="mt-1 text-xs text-white/40">Multipliers and limit rules for packages.</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSizeModal({ index: null, draft: makeSizeDraft(sizes.length) })}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#CDD645]/10 border border-[#CDD645]/20 px-4 py-2 text-sm font-bold text-[#E4E67A] transition hover:bg-[#CDD645]/20"
              >
                <Icon icon="solar:maximize-square-minimum-bold-duotone" className="text-lg" />
                Add Size
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sizes.map((size, index) => (
                <div key={`size-${index}`} className="group relative flex flex-col justify-between overflow-hidden rounded-[20px] bg-[#141A14]/60 p-5 border border-white/5 shadow-lg transition hover:border-[#CDD645]/30 hover:bg-[#1A221A]/80">
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 text-white/80 shrink-0">
                        <span className="text-sm font-bold">{size.maxWeightKg}</span><span className="text-[10px] ml-0.5 mt-1 font-semibold text-white/40 uppercase">KG Max</span>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${size.isActive ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/50"
                        }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${size.isActive ? "bg-emerald-400" : "bg-white/40"}`} />
                        {size.isActive ? "Active" : "Hidden"}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white/90">{size.name || "Unnamed Size"}</h3>
                    <p className="mt-1 text-xs text-white/60 line-clamp-2">{size.description || "No description provided."}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/10 px-2 py-1 text-[11px] font-bold text-indigo-300 border border-indigo-500/20">
                        <Icon icon="solar:calculator-bold-duotone" className="text-indigo-400" />
                        {size.priceMultiplier}x Fare
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500/10 px-2 py-1 text-[11px] font-bold text-orange-300 border border-orange-500/20">
                        <Icon icon="solar:pipette-bold-duotone" className="text-orange-400" />
                        {size.visualScale}x Scale
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                    <span className="text-[11px] font-mono text-white/40 bg-white/5 px-2 py-1 rounded-md">Order: {size.sortOrder}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveSizeModal({ index, draft: { ...size } })}
                        className="rounded-lg bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
                      >
                        <Icon icon="solar:pen-bold-duotone" className="text-base" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSize(index)}
                        className="rounded-lg bg-red-500/10 p-2 text-red-400 transition hover:bg-red-500/20"
                      >
                        <Icon icon="solar:trash-bin-trash-broken" className="text-base" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {iconPickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative dashboard-surface w-full max-w-2xl rounded-[24px] p-6 shadow-2xl border border-white/10">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-xl font-bold text-[#E4E67A]">Icon Library</h3>
                <p className="mt-1 text-xs text-white/50">
                  Search Iconify database to represent your category.
                </p>
              </div>
              <button
                type="button"
                onClick={closeIconPicker}
                className="rounded-full bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <Icon icon="mdi:close" className="text-xl" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Icon icon="solar:minimalistic-magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-lg" />
                <input
                  value={iconSearchQuery}
                  onChange={(event) => setIconSearchQuery(event.target.value)}
                  placeholder="e.g. truck, box, package, document..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-10 py-3 text-sm text-white focus:border-[#CDD645]/50 outline-none transition"
                />
              </div>
            </div>

            {iconSearchLoading && (
              <div className="flex justify-center p-8 text-[#CDD645]">
                <Icon icon="line-md:loading-loop" className="text-4xl" />
              </div>
            )}

            {!iconSearchLoading && iconSearchError && (
              <div className="rounded-xl border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-300 text-center">
                {iconSearchError}
              </div>
            )}

            {!iconSearchLoading && !iconSearchError && (
              <div className="mt-4 grid max-h-[50vh] grid-cols-3 gap-3 overflow-y-auto pr-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 custom-scrollbar">
                {iconSearchResults.map((iconName) => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => applyCategoryIcon(iconName)}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl bg-white/5 p-3 text-white/70 hover:bg-[#CDD645]/20 hover:text-[#E4E67A] transition-all border border-transparent hover:border-[#CDD645]/30 group"
                    title={iconName}
                  >
                    <Icon icon={iconName} className="text-3xl group-hover:scale-110 transition-transform" />
                    <span className="w-full truncate text-[10px] text-center font-medium opacity-50 group-hover:opacity-100">{iconName.split(":").pop()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setActiveCategoryModal(null)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#1A221A] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/20 p-5">
              <h2 className="text-xl font-bold text-[#E4E67A]">
                {activeCategoryModal.index === null ? "New Category" : "Edit Category"}
              </h2>
              <button
                type="button"
                onClick={() => setActiveCategoryModal(null)}
                className="rounded-full bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <Icon icon="mdi:close" className="text-xl" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/50 block">
                Category Name
                <input
                  value={activeCategoryModal.draft.name}
                  onChange={(e) => setActiveCategoryModal(prev => prev ? ({ ...prev, draft: { ...prev.draft, name: e.target.value } }) : prev)}
                  placeholder="e.g. Standard Box"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white shadow-inner transition-all focus:border-[#CDD645]/50 focus:bg-black/60 focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/50 block">
                  Default Fare (₹)
                  <input
                    type="number"
                    min={0}
                    value={activeCategoryModal.draft.defaultFare}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setActiveCategoryModal(prev => prev ? ({ ...prev, draft: { ...prev.draft, defaultFare: val } }) : prev);
                    }}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white shadow-inner transition-all focus:border-[#CDD645]/50 focus:bg-black/60 focus:outline-none"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wider text-white/50 block">
                  Sort Order
                  <input
                    type="number"
                    min={0}
                    value={activeCategoryModal.draft.sortOrder}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setActiveCategoryModal(prev => prev ? ({ ...prev, draft: { ...prev.draft, sortOrder: val } }) : prev);
                    }}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white shadow-inner transition-all focus:border-[#CDD645]/50 focus:bg-black/60 focus:outline-none"
                  />
                </label>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">Category Icon</p>
                <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/10">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#CDD645]/10 text-2xl text-[#E4E67A]">
                    <Icon icon={activeCategoryModal.draft.icon || "mdi:shape-outline"} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium text-white/90">{activeCategoryModal.draft.icon || "No Icon Picked"}</p>
                    <p className="text-[10px] text-white/40">From Iconify Library</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openIconPicker(activeCategoryModal.draft.name)}
                    className="rounded-lg bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-[#CDD645]/90 hover:text-black"
                  >
                    Change
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-black/20 p-4 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Status</p>
                <label className="inline-flex cursor-pointer items-center gap-3">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={activeCategoryModal.draft.isActive}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setActiveCategoryModal(prev => prev ? ({ ...prev, draft: { ...prev.draft, isActive: val } }) : prev);
                      }}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-white/10 shadow-inner transition peer-checked:bg-[#CDD645]"></div>
                    <div className="absolute inset-y-0 left-0 m-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4"></div>
                  </div>
                  <span className="text-[11px] font-bold text-white/80">Active</span>
                </label>
              </div>

            </div>

            <div className="border-t border-white/10 bg-black/20 p-5">
              <button
                type="button"
                onClick={() => {
                  if (activeCategoryModal.index === null) {
                    setCategories(prev => [...prev, activeCategoryModal.draft]);
                  } else {
                    updateCategory(activeCategoryModal.index, () => activeCategoryModal.draft);
                  }
                  setActiveCategoryModal(null);
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#CDD645] px-5 py-3.5 text-[15px] font-bold tracking-wide text-black shadow-lg shadow-[#CDD645]/20 transition-all hover:bg-[#E4E67A] active:scale-95"
              >
                <Icon icon="solar:diskette-bold-duotone" className="text-xl" />
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setActiveSizeModal(null)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#1A221A] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/20 p-5">
              <h2 className="text-xl font-bold text-[#E4E67A]">
                {activeSizeModal.index === null ? "New Size" : "Edit Size"}
              </h2>
              <button
                type="button"
                onClick={() => setActiveSizeModal(null)}
                className="rounded-full bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <Icon icon="mdi:close" className="text-xl" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/50 block">
                Size Title
                <input
                  value={activeSizeModal.draft.name}
                  onChange={(e) => setActiveSizeModal(prev => prev ? ({ ...prev, draft: { ...prev.draft, name: e.target.value } }) : prev)}
                  placeholder="e.g. Medium Case"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white shadow-inner transition-all focus:border-[#CDD645]/50 focus:bg-black/60 focus:outline-none"
                />
              </label>

              <label className="text-xs font-semibold uppercase tracking-wider text-white/50 block">
                Description
                <textarea
                  value={activeSizeModal.draft.description}
                  onChange={(e) => setActiveSizeModal(prev => prev ? ({ ...prev, draft: { ...prev.draft, description: e.target.value } }) : prev)}
                  placeholder="e.g. Fits two laptops or small electronics."
                  rows={2}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white shadow-inner transition-all focus:border-[#CDD645]/50 focus:bg-black/60 focus:outline-none custom-scrollbar"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/50 block">
                  Max Weight (KG)
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={activeSizeModal.draft.maxWeightKg}
                    onChange={(e) => {
                      const val = Math.max(0.1, Number(e.target.value) || 0.1);
                      setActiveSizeModal(prev => prev ? ({ ...prev, draft: { ...prev.draft, maxWeightKg: val } }) : prev);
                    }}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white shadow-inner transition-all focus:border-[#CDD645]/50 focus:bg-black/60 focus:outline-none"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wider text-white/50 block">
                  Price Multiplier
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={activeSizeModal.draft.priceMultiplier}
                    onChange={(e) => {
                      const val = Math.max(0.1, Number(e.target.value) || 0.1);
                      setActiveSizeModal(prev => prev ? ({ ...prev, draft: { ...prev.draft, priceMultiplier: val } }) : prev);
                    }}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white shadow-inner transition-all focus:border-[#CDD645]/50 focus:bg-black/60 focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/50 block">
                  Visual Scale
                  <input
                    type="number"
                    min={0.5}
                    step={0.1}
                    value={activeSizeModal.draft.visualScale}
                    onChange={(e) => {
                      const val = Math.max(0.5, Number(e.target.value) || 0.5);
                      setActiveSizeModal(prev => prev ? ({ ...prev, draft: { ...prev.draft, visualScale: val } }) : prev);
                    }}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white shadow-inner transition-all focus:border-[#CDD645]/50 focus:bg-black/60 focus:outline-none"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wider text-white/50 block">
                  Sort Order
                  <input
                    type="number"
                    min={0}
                    value={activeSizeModal.draft.sortOrder}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setActiveSizeModal(prev => prev ? ({ ...prev, draft: { ...prev.draft, sortOrder: val } }) : prev);
                    }}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white shadow-inner transition-all focus:border-[#CDD645]/50 focus:bg-black/60 focus:outline-none"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-white/5 bg-black/20 p-4 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Status</p>
                <label className="inline-flex cursor-pointer items-center gap-3">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={activeSizeModal.draft.isActive}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setActiveSizeModal(prev => prev ? ({ ...prev, draft: { ...prev.draft, isActive: val } }) : prev);
                      }}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-white/10 shadow-inner transition peer-checked:bg-[#CDD645]"></div>
                    <div className="absolute inset-y-0 left-0 m-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4"></div>
                  </div>
                  <span className="text-[11px] font-bold text-white/80">Active</span>
                </label>
              </div>

            </div>

            <div className="border-t border-white/10 bg-black/20 p-5">
              <button
                type="button"
                onClick={() => {
                  if (activeSizeModal.index === null) {
                    setSizes(prev => [...prev, activeSizeModal.draft]);
                  } else {
                    updateSize(activeSizeModal.index, () => activeSizeModal.draft);
                  }
                  setActiveSizeModal(null);
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#CDD645] px-5 py-3.5 text-[15px] font-bold tracking-wide text-black shadow-lg shadow-[#CDD645]/20 transition-all hover:bg-[#E4E67A] active:scale-95"
              >
                <Icon icon="solar:diskette-bold-duotone" className="text-xl" />
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
