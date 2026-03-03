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
    if (!user.isSuperAdmin) {
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

  const openIconPicker = (index: number) => {
    const seedQuery = String(categories[index]?.name ?? "").trim() || DEFAULT_ICON_SEARCH_QUERY;
    setIconPickerCategoryIndex(index);
    setIconSearchQuery(seedQuery);
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
    if (iconPickerCategoryIndex === null) return;
    updateCategory(iconPickerCategoryIndex, (current) => ({ ...current, icon: iconName }));
    closeIconPicker();
  };

  useEffect(() => {
    if (iconPickerCategoryIndex === null) return;
    if (!categories[iconPickerCategoryIndex]) {
      closeIconPicker();
    }
  }, [categories, iconPickerCategoryIndex]);

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

  if (!user || !user.isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-200">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:shield-alert-outline" className="text-lg" />
          Access restricted to super admin.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E4E67A]">Package Master</h1>
          <p className="mt-1 text-sm text-white/70">
            Manage package categories, pricing defaults and size rules used across booking, pricing and bus setup.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-[#E4E67A]/40 bg-[#E4E67A]/10 px-2 py-0.5 text-[#f5f7b7]">
              Active Categories: {activeCategoryCount}
            </span>
            <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-sky-200">
              Active Sizes: {activeSizeCount}
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
        <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/70">Loading package master...</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-[#1b2418] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#E4E67A]">Categories</h2>
                <p className="text-xs text-white/65">Used for package type selection and route fare inputs.</p>
              </div>
              <button
                type="button"
                onClick={addCategory}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/85 hover:bg-white/10"
              >
                + Add Category
              </button>
            </div>

            <div className="space-y-3">
              {categories.map((category, index) => (
                <div key={`category-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-[11px] text-white/75">
                      Name
                      <input
                        value={category.name}
                        onChange={(event) =>
                          updateCategory(index, (current) => ({ ...current, name: event.target.value }))
                        }
                        className="mt-1 w-full rounded-md border border-white/20 bg-black px-2 py-1.5 text-xs text-white outline-none"
                      />
                    </label>

                    <label className="text-[11px] text-white/75">
                      Icon (Iconify)
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/20 bg-black/70 text-base text-white">
                          <Icon icon={category.icon || "mdi:shape-outline"} />
                        </div>
                        <input
                          value={category.icon}
                          onChange={(event) =>
                            updateCategory(index, (current) => ({ ...current, icon: event.target.value }))
                          }
                          className="w-full rounded-md border border-white/20 bg-black px-2 py-1.5 text-xs text-white outline-none"
                          placeholder="mdi:package-variant"
                        />
                        <button
                          type="button"
                          onClick={() => openIconPicker(index)}
                          className="shrink-0 rounded-md border border-[#D5E400]/45 bg-[#D5E400]/10 px-2 py-1.5 text-[11px] font-semibold text-[#EAF489] hover:bg-[#D5E400]/20"
                        >
                          Pick
                        </button>
                      </div>
                    </label>

                    <label className="text-[11px] text-white/75">
                      Default Fare
                      <input
                        type="number"
                        min={0}
                        value={category.defaultFare}
                        onChange={(event) =>
                          updateCategory(index, (current) => ({
                            ...current,
                            defaultFare: Math.max(0, Number(event.target.value) || 0),
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-white/20 bg-black px-2 py-1.5 text-xs text-white outline-none"
                      />
                    </label>

                    <label className="text-[11px] text-white/75">
                      Sort Order
                      <input
                        type="number"
                        min={0}
                        value={category.sortOrder}
                        onChange={(event) =>
                          updateCategory(index, (current) => ({
                            ...current,
                            sortOrder: Math.max(0, Number(event.target.value) || 0),
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-white/20 bg-black px-2 py-1.5 text-xs text-white outline-none"
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-xs text-white/80">
                      <input
                        type="checkbox"
                        checked={category.isActive}
                        onChange={(event) =>
                          updateCategory(index, (current) => ({ ...current, isActive: event.target.checked }))
                        }
                        className="h-4 w-4 accent-[#CDD645]"
                      />
                      Active
                    </label>

                    <button
                      type="button"
                      onClick={() => removeCategory(index)}
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#1b2418] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#E4E67A]">Sizes</h2>
                <p className="text-xs text-white/65">Controls package size picker, max weight rules and price multiplier.</p>
              </div>
              <button
                type="button"
                onClick={addSize}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/85 hover:bg-white/10"
              >
                + Add Size
              </button>
            </div>

            <div className="space-y-3">
              {sizes.map((size, index) => (
                <div key={`size-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-[11px] text-white/75">
                      Name
                      <input
                        value={size.name}
                        onChange={(event) =>
                          updateSize(index, (current) => ({ ...current, name: event.target.value }))
                        }
                        className="mt-1 w-full rounded-md border border-white/20 bg-black px-2 py-1.5 text-xs text-white outline-none"
                      />
                    </label>

                    <label className="text-[11px] text-white/75">
                      Description
                      <input
                        value={size.description}
                        onChange={(event) =>
                          updateSize(index, (current) => ({ ...current, description: event.target.value }))
                        }
                        className="mt-1 w-full rounded-md border border-white/20 bg-black px-2 py-1.5 text-xs text-white outline-none"
                      />
                    </label>

                    <label className="text-[11px] text-white/75">
                      Max Weight (kg)
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={size.maxWeightKg}
                        onChange={(event) =>
                          updateSize(index, (current) => ({
                            ...current,
                            maxWeightKg: Math.max(0.1, Number(event.target.value) || 0.1),
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-white/20 bg-black px-2 py-1.5 text-xs text-white outline-none"
                      />
                    </label>

                    <label className="text-[11px] text-white/75">
                      Price Multiplier
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={size.priceMultiplier}
                        onChange={(event) =>
                          updateSize(index, (current) => ({
                            ...current,
                            priceMultiplier: Math.max(0.1, Number(event.target.value) || 0.1),
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-white/20 bg-black px-2 py-1.5 text-xs text-white outline-none"
                      />
                    </label>

                    <label className="text-[11px] text-white/75">
                      Visual Scale
                      <input
                        type="number"
                        min={0.5}
                        step={0.1}
                        value={size.visualScale}
                        onChange={(event) =>
                          updateSize(index, (current) => ({
                            ...current,
                            visualScale: Math.max(0.5, Number(event.target.value) || 0.5),
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-white/20 bg-black px-2 py-1.5 text-xs text-white outline-none"
                      />
                    </label>

                    <label className="text-[11px] text-white/75">
                      Sort Order
                      <input
                        type="number"
                        min={0}
                        value={size.sortOrder}
                        onChange={(event) =>
                          updateSize(index, (current) => ({
                            ...current,
                            sortOrder: Math.max(0, Number(event.target.value) || 0),
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-white/20 bg-black px-2 py-1.5 text-xs text-white outline-none"
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-xs text-white/80">
                      <input
                        type="checkbox"
                        checked={size.isActive}
                        onChange={(event) =>
                          updateSize(index, (current) => ({ ...current, isActive: event.target.checked }))
                        }
                        className="h-4 w-4 accent-[#CDD645]"
                      />
                      Active
                    </label>

                    <button
                      type="button"
                      onClick={() => removeSize(index)}
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {iconPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-[#11170f] p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[#E4E67A]">Pick Icon</h3>
                <p className="mt-0.5 text-xs text-white/65">
                  Search Iconify icons and apply to <span className="font-semibold text-white">{iconPickerCategoryName || "category"}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={closeIconPicker}
                className="rounded-md border border-white/20 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                value={iconSearchQuery}
                onChange={(event) => setIconSearchQuery(event.target.value)}
                placeholder="Search icon... e.g. truck, box, package, flash"
                className="min-w-[240px] flex-1 rounded-lg border border-white/20 bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#D5E400]/60"
              />
              <button
                type="button"
                onClick={() => {
                  if (iconPickerCategoryIndex === null) return;
                  updateCategory(iconPickerCategoryIndex, (current) => ({
                    ...current,
                    icon: "mdi:shape-outline",
                  }));
                }}
                className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white/85 hover:bg-white/10"
              >
                Reset Icon
              </button>
            </div>

            {iconSearchLoading ? (
              <div className="mt-4 rounded-lg border border-white/10 bg-black/25 p-3 text-xs text-white/70">
                Searching icons...
              </div>
            ) : null}
            {iconSearchError ? (
              <div className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-200">
                {iconSearchError}
              </div>
            ) : null}

            <div className="mt-4 grid max-h-[58vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {iconSearchResults.map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => applyCategoryIcon(iconName)}
                  className="rounded-lg border border-white/10 bg-black/30 p-2 text-left text-white/90 hover:border-[#D5E400]/35 hover:bg-[#D5E400]/10"
                  title={iconName}
                >
                  <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-black/60 text-lg">
                    <Icon icon={iconName} />
                  </div>
                  <p className="truncate text-[11px] leading-tight">{iconName}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
