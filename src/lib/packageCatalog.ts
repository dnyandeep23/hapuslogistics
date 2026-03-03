export type PackageCategoryConfig = {
  name: string;
  icon: string;
  defaultFare: number;
  isActive: boolean;
  sortOrder: number;
};

export type PackageSizeConfig = {
  name: string;
  description: string;
  maxWeightKg: number;
  priceMultiplier: number;
  visualScale: number;
  isActive: boolean;
  sortOrder: number;
};

export type PackageCatalogPayload = {
  categories: PackageCategoryConfig[];
  sizes: PackageSizeConfig[];
  updatedAt?: string;
};

const toFiniteNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value: unknown, fallback: string) => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

export const DEFAULT_PACKAGE_CATEGORIES: PackageCategoryConfig[] = [
  {
    name: "Wooden",
    icon: "mdi:tree",
    defaultFare: 70,
    isActive: true,
    sortOrder: 1,
  },
  {
    name: "Plastic / Fibre",
    icon: "mdi:bottle-soda",
    defaultFare: 60,
    isActive: true,
    sortOrder: 2,
  },
  {
    name: "Iron",
    icon: "mdi:anvil",
    defaultFare: 80,
    isActive: true,
    sortOrder: 3,
  },
  {
    name: "Electronics",
    icon: "mdi:flash",
    defaultFare: 95,
    isActive: true,
    sortOrder: 4,
  },
  {
    name: "Mango Box",
    icon: "mdi:package-variant",
    defaultFare: 55,
    isActive: true,
    sortOrder: 5,
  },
  {
    name: "Other",
    icon: "mdi:shape-outline",
    defaultFare: 110,
    isActive: true,
    sortOrder: 6,
  },
];

export const DEFAULT_PACKAGE_SIZES: PackageSizeConfig[] = [
  {
    name: "Small",
    description: "Up to 40 x 40 cm | Max 5 kg",
    maxWeightKg: 5,
    priceMultiplier: 1,
    visualScale: 1,
    isActive: true,
    sortOrder: 1,
  },
  {
    name: "Medium",
    description: "Up to 60 x 60 cm | Max 10 kg",
    maxWeightKg: 10,
    priceMultiplier: 1.2,
    visualScale: 1.2,
    isActive: true,
    sortOrder: 2,
  },
  {
    name: "Large",
    description: "Up to 100 x 100 cm | Max 20 kg",
    maxWeightKg: 20,
    priceMultiplier: 1.5,
    visualScale: 1.4,
    isActive: true,
    sortOrder: 3,
  },
];

export const normalizePackageCategories = (
  rawCategories: unknown,
  fallback: PackageCategoryConfig[] = DEFAULT_PACKAGE_CATEGORIES,
): PackageCategoryConfig[] => {
  if (!Array.isArray(rawCategories)) {
    return [...fallback]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((entry) => ({ ...entry }));
  }

  const normalized = rawCategories
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const category = entry as Record<string, unknown>;
      const name = normalizeText(category.name, "");
      if (!name) return null;

      return {
        name,
        icon: normalizeText(category.icon, "mdi:shape-outline"),
        defaultFare: Math.max(0, toFiniteNumber(category.defaultFare, 0)),
        isActive: category.isActive === undefined ? true : Boolean(category.isActive),
        sortOrder: Math.max(0, Math.floor(toFiniteNumber(category.sortOrder, index + 1))),
      } as PackageCategoryConfig;
    })
    .filter((entry): entry is PackageCategoryConfig => Boolean(entry));

  if (normalized.length === 0) {
    return [...fallback]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((entry) => ({ ...entry }));
  }

  const seen = new Set<string>();
  const unique = normalized.filter((entry) => {
    const key = entry.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort((left, right) => left.sortOrder - right.sortOrder);
};

export const normalizePackageSizes = (
  rawSizes: unknown,
  fallback: PackageSizeConfig[] = DEFAULT_PACKAGE_SIZES,
): PackageSizeConfig[] => {
  if (!Array.isArray(rawSizes)) {
    return [...fallback]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((entry) => ({ ...entry }));
  }

  const normalized = rawSizes
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const size = entry as Record<string, unknown>;
      const name = normalizeText(size.name, "");
      if (!name) return null;

      return {
        name,
        description: normalizeText(size.description, ""),
        maxWeightKg: Math.max(0.1, toFiniteNumber(size.maxWeightKg, 1)),
        priceMultiplier: Math.max(0.1, toFiniteNumber(size.priceMultiplier, 1)),
        visualScale: Math.max(0.5, toFiniteNumber(size.visualScale, 1)),
        isActive: size.isActive === undefined ? true : Boolean(size.isActive),
        sortOrder: Math.max(0, Math.floor(toFiniteNumber(size.sortOrder, index + 1))),
      } as PackageSizeConfig;
    })
    .filter((entry): entry is PackageSizeConfig => Boolean(entry));

  if (normalized.length === 0) {
    return [...fallback]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((entry) => ({ ...entry }));
  }

  const seen = new Set<string>();
  const unique = normalized.filter((entry) => {
    const key = entry.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort((left, right) => left.sortOrder - right.sortOrder);
};

export const getActivePackageCategories = (categories: PackageCategoryConfig[]) => {
  const active = categories.filter((entry) => entry.isActive);
  return active.length > 0 ? active : [...DEFAULT_PACKAGE_CATEGORIES];
};

export const getActivePackageSizes = (sizes: PackageSizeConfig[]) => {
  const active = sizes.filter((entry) => entry.isActive);
  return active.length > 0 ? active : [...DEFAULT_PACKAGE_SIZES];
};

export const buildCategoryFareMap = (
  categories: PackageCategoryConfig[],
  source?: Record<string, number>,
): Record<string, number> => {
  const next: Record<string, number> = {};
  for (const category of categories) {
    const sourceValue = source?.[category.name];
    const parsed = Number(sourceValue);
    next[category.name] = Number.isFinite(parsed)
      ? Math.max(0, parsed)
      : Math.max(0, Number(category.defaultFare ?? 0));
  }
  return next;
};

export const buildSizeMultiplierMap = (sizes: PackageSizeConfig[]): Record<string, number> => {
  const map: Record<string, number> = {};
  for (const size of sizes) {
    map[size.name] = Math.max(0.1, Number(size.priceMultiplier) || 1);
  }
  return map;
};

export const buildSizeWeightLimitMap = (sizes: PackageSizeConfig[]): Record<string, number> => {
  const map: Record<string, number> = {};
  for (const size of sizes) {
    map[size.name] = Math.max(0.1, Number(size.maxWeightKg) || 1);
  }
  return map;
};
