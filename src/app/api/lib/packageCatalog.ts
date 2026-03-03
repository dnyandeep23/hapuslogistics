import PackageCatalog from "@/app/api/models/packageCatalogModel";
import {
  DEFAULT_PACKAGE_CATEGORIES,
  DEFAULT_PACKAGE_SIZES,
  getActivePackageCategories,
  getActivePackageSizes,
  normalizePackageCategories,
  normalizePackageSizes,
  type PackageCategoryConfig,
  type PackageSizeConfig,
} from "@/lib/packageCatalog";

export const PACKAGE_CATALOG_KEY = "default";

export type ResolvedPackageCatalog = {
  categories: PackageCategoryConfig[];
  sizes: PackageSizeConfig[];
  updatedAt: string;
};

export const resolvePackageCatalog = async (): Promise<ResolvedPackageCatalog> => {
  const doc = await PackageCatalog.findOne({ key: PACKAGE_CATALOG_KEY })
    .select("categories sizes updatedAt")
    .lean<{
      categories?: unknown;
      sizes?: unknown;
      updatedAt?: Date | string;
    } | null>();

  const normalizedCategories = normalizePackageCategories(doc?.categories, DEFAULT_PACKAGE_CATEGORIES);
  const normalizedSizes = normalizePackageSizes(doc?.sizes, DEFAULT_PACKAGE_SIZES);

  return {
    categories: normalizedCategories,
    sizes: normalizedSizes,
    updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date(0).toISOString(),
  };
};

export const resolveActivePackageCatalog = async (): Promise<ResolvedPackageCatalog> => {
  const catalog = await resolvePackageCatalog();
  return {
    ...catalog,
    categories: getActivePackageCategories(catalog.categories),
    sizes: getActivePackageSizes(catalog.sizes),
  };
};

export const normalizeCategoryFaresForAllowedNames = (
  faresCandidate: unknown,
  allowedCategoryNames: string[],
): {
  ok: boolean;
  fares: Record<string, number>;
  unknownKeys: string[];
} => {
  if (!faresCandidate || typeof faresCandidate !== "object" || Array.isArray(faresCandidate)) {
    return {
      ok: false,
      fares: {},
      unknownKeys: [],
    };
  }

  const allowedNameSet = new Set(allowedCategoryNames);
  const providedEntries = Object.entries(faresCandidate as Record<string, unknown>);
  const unknownKeys = providedEntries
    .map(([key]) => key)
    .filter((key) => !allowedNameSet.has(key));

  const fares: Record<string, number> = {};
  for (const categoryName of allowedCategoryNames) {
    const rawValue = (faresCandidate as Record<string, unknown>)[categoryName];
    const parsed = Number(rawValue);
    fares[categoryName] = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  return {
    ok: true,
    fares,
    unknownKeys,
  };
};
