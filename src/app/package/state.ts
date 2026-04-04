import {
  DEFAULT_PACKAGE_CATEGORIES,
  DEFAULT_PACKAGE_SIZES,
  getActivePackageCategories,
  getActivePackageSizes,
  type PackageCategoryConfig,
  type PackageSizeConfig,
} from "@/lib/packageCatalog";
import type { CartItem, PackageDraft, PackageFormData, PackageState } from "./types";

export const PACKAGE_STORAGE_KEY = "packageState";

const MAX_PACKAGE_WEIGHT_KG = 100;
const MAX_PACKAGE_QUANTITY = 6;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type PackageSanitizeOptions = {
  packageCategories?: PackageCategoryConfig[];
  packageSizes?: PackageSizeConfig[];
  allowTransientDraftImageFile?: boolean;
};

type PackageSanitizeResult = {
  state: PackageState;
  notice: string | null;
};

const getDefaultCategoryEntries = () => getActivePackageCategories(DEFAULT_PACKAGE_CATEGORIES);
const getDefaultSizeEntries = () => getActivePackageSizes(DEFAULT_PACKAGE_SIZES);

const normalizeText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isFileValue = (value: unknown): value is File =>
  typeof File !== "undefined" && value instanceof File;

const toFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isValidIsoDate = (value: string) => {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
};

const isPersistablePackageImage = (value: unknown) => {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.startsWith("blob:") || normalized.startsWith("data:")) return false;
  if (normalized.startsWith("/")) return true;

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const resolvePackageCatalog = (options?: PackageSanitizeOptions) => {
  const categories =
    Array.isArray(options?.packageCategories) && options.packageCategories.length > 0
      ? options.packageCategories
      : getDefaultCategoryEntries();
  const sizes =
    Array.isArray(options?.packageSizes) && options.packageSizes.length > 0
      ? options.packageSizes
      : getDefaultSizeEntries();

  const categoryMap = new Map(
    categories.map((entry) => [String(entry.name ?? "").trim().toLowerCase(), String(entry.name ?? "").trim()]),
  );
  const sizeMap = new Map(
    sizes.map((entry) => [
      String(entry.name ?? "").trim().toLowerCase(),
      {
        name: String(entry.name ?? "").trim(),
        maxWeightKg: Number(entry.maxWeightKg) || 0,
      },
    ]),
  );
  const defaultSizeName = sizes[0]?.name || getDefaultSizeEntries()[0]?.name || "Small";

  return { categoryMap, sizeMap, defaultSizeName };
};

export const createEmptyPackageFormData = (): PackageFormData => ({
  pickupLocationId: "",
  dropLocationId: "",
  cart: [],
  senderName: "",
  senderContact: "",
  receiverName: "",
  receiverContact: "",
  coupon: "",
  discount: 0,
});

export const createEmptyCurrentPackage = (defaultSizeName?: string): PackageDraft => ({
  packageName: "",
  packageType: "",
  otherPackageType: "",
  packageSize: defaultSizeName || resolvePackageCatalog().defaultSizeName,
  packageWeight: 0,
  packageQuantities: 1,
  pickUpDate: "",
  packageImage: "",
});

export const createDefaultPackageState = (defaultSizeName?: string): PackageState => ({
  formData: createEmptyPackageFormData(),
  currentPackage: createEmptyCurrentPackage(defaultSizeName),
  editIndex: null,
  currentStep: 1,
  recoveryNotice: null,
});

export const hasMeaningfulPackageDraft = (draft: PackageDraft) =>
  Boolean(
    normalizeText(draft.packageName) ||
      normalizeText(draft.packageType) ||
      normalizeText(draft.otherPackageType) ||
      Number(draft.packageWeight || 0) > 0 ||
      Number(draft.packageQuantities || 0) > 1 ||
      normalizeText(draft.pickUpDate) ||
      (typeof draft.packageImage === "string" && normalizeText(draft.packageImage)),
  );

const sanitizeCurrentPackage = (
  rawValue: unknown,
  options?: PackageSanitizeOptions,
): { draft: PackageDraft; reset: boolean } => {
  const { categoryMap, sizeMap, defaultSizeName } = resolvePackageCatalog(options);
  const fallback = createEmptyCurrentPackage(defaultSizeName);

  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return { draft: fallback, reset: false };
  }

  const raw = rawValue as Record<string, unknown>;
  const packageTypeKey = normalizeText(raw.packageType).toLowerCase();
  const packageType = packageTypeKey ? categoryMap.get(packageTypeKey) : "";
  const packageSizeKey = normalizeText(raw.packageSize).toLowerCase();
  const packageSize = packageSizeKey ? sizeMap.get(packageSizeKey) : null;
  const packageWeightRaw = raw.packageWeight;
  const packageWeight =
    packageWeightRaw === ""
      ? ""
      : toFiniteNumber(packageWeightRaw);
  const packageQuantitiesRaw = toFiniteNumber(raw.packageQuantities);
  const packageImage = raw.packageImage;
  const pickUpDate = normalizeText(raw.pickUpDate);
  const otherPackageType = normalizeText(raw.otherPackageType);

  const invalidType = Boolean(packageTypeKey && !packageType);
  const invalidSize = Boolean(packageSizeKey && !packageSize);
  const invalidWeight =
    packageWeight === null ||
    (packageWeight !== "" &&
      (packageWeight < 0 ||
        packageWeight > MAX_PACKAGE_WEIGHT_KG ||
        (packageSize && packageSize.maxWeightKg > 0 && packageWeight > packageSize.maxWeightKg)));
  const invalidQuantity =
    packageQuantitiesRaw === null ||
    !Number.isInteger(packageQuantitiesRaw) ||
    packageQuantitiesRaw < 1 ||
    packageQuantitiesRaw > MAX_PACKAGE_QUANTITY;
  const invalidImage =
    !(
      packageImage === "" ||
      isPersistablePackageImage(packageImage) ||
      (options?.allowTransientDraftImageFile && isFileValue(packageImage))
    );
  const invalidDate = Boolean(pickUpDate && !isValidIsoDate(pickUpDate));

  if (invalidType || invalidSize || invalidWeight || invalidQuantity || invalidImage || invalidDate) {
    return { draft: fallback, reset: true };
  }

  return {
    draft: {
      packageName: normalizeText(raw.packageName),
      packageType: packageType || "",
      otherPackageType: packageTypeKey === "other" ? otherPackageType : "",
      packageSize: packageSize?.name || defaultSizeName,
      packageWeight: packageWeight === "" ? "" : packageWeight ?? 0,
      packageQuantities: packageQuantitiesRaw,
      pickUpDate,
      packageImage:
        typeof packageImage === "string" && isPersistablePackageImage(packageImage)
          ? packageImage.trim()
          : options?.allowTransientDraftImageFile && isFileValue(packageImage)
            ? packageImage
            : "",
    },
    reset: false,
  };
};

const sanitizeCartItem = (
  rawValue: unknown,
  index: number,
  options?: PackageSanitizeOptions,
): CartItem | null => {
  const { categoryMap, sizeMap } = resolvePackageCatalog(options);

  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null;
  }

  const raw = rawValue as Record<string, unknown>;
  const packageTypeKey = normalizeText(raw.packageType).toLowerCase();
  const packageType = categoryMap.get(packageTypeKey);
  const packageSize = sizeMap.get(normalizeText(raw.packageSize).toLowerCase());
  const packageWeight = toFiniteNumber(raw.packageWeight);
  const packageQuantities = toFiniteNumber(raw.packageQuantities);
  const pickUpDate = normalizeText(raw.pickUpDate);
  const packageImage = normalizeText(raw.packageImage);
  const otherPackageType = normalizeText(raw.otherPackageType);

  if (!packageType || !packageSize || packageWeight === null || packageQuantities === null) {
    return null;
  }
  if (
    packageWeight <= 0 ||
    packageWeight > MAX_PACKAGE_WEIGHT_KG ||
    (packageSize.maxWeightKg > 0 && packageWeight > packageSize.maxWeightKg)
  ) {
    return null;
  }
  if (
    !Number.isInteger(packageQuantities) ||
    packageQuantities < 1 ||
    packageQuantities > MAX_PACKAGE_QUANTITY
  ) {
    return null;
  }
  if (!pickUpDate || !isValidIsoDate(pickUpDate)) {
    return null;
  }
  if (!isPersistablePackageImage(packageImage)) {
    return null;
  }
  if (packageTypeKey === "other" && !otherPackageType) {
    return null;
  }

  const price = toFiniteNumber(raw.price);

  return {
    packageName: normalizeText(raw.packageName) || `Package ${index + 1}`,
    packageType,
    otherPackageType: packageTypeKey === "other" ? otherPackageType : "",
    packageSize: packageSize.name,
    packageWeight,
    packageQuantities,
    packageImage,
    pickUpDate,
    ...(price !== null && price >= 0 ? { price } : {}),
  };
};

const resolveStepAfterPackageReset = (formData: PackageFormData) =>
  formData.pickupLocationId && formData.dropLocationId ? 2 : 1;

export function sanitizePackageState(
  rawValue: unknown,
  options?: PackageSanitizeOptions,
): PackageSanitizeResult {
  const { defaultSizeName } = resolvePackageCatalog(options);
  const fallbackState = createDefaultPackageState(defaultSizeName);

  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {
      state: fallbackState,
      notice: rawValue ? "Saved package details could not be restored. Please enter them again." : null,
    };
  }

  const raw = rawValue as Record<string, unknown>;
  const rawFormData =
    raw.formData && typeof raw.formData === "object" && !Array.isArray(raw.formData)
      ? (raw.formData as Record<string, unknown>)
      : {};

  const sanitizedFormData: PackageFormData = {
    pickupLocationId: normalizeText(rawFormData.pickupLocationId),
    dropLocationId: normalizeText(rawFormData.dropLocationId),
    cart: [],
    senderName: normalizeText(rawFormData.senderName),
    senderContact: normalizeText(rawFormData.senderContact),
    receiverName: normalizeText(rawFormData.receiverName),
    receiverContact: normalizeText(rawFormData.receiverContact),
    coupon: normalizeText(rawFormData.coupon).toUpperCase(),
    discount: Math.max(0, toFiniteNumber(rawFormData.discount) ?? 0),
  };

  const rawCart = Array.isArray(rawFormData.cart) ? rawFormData.cart : [];
  const sanitizedCart = rawCart
    .map((item, index) => sanitizeCartItem(item, index, options))
    .filter((item): item is CartItem => Boolean(item));

  const cartDates = new Set(sanitizedCart.map((item) => item.pickUpDate));
  const totalCartQuantity = sanitizedCart.reduce((total, item) => total + item.packageQuantities, 0);
  const hasInvalidCart =
    rawCart.length !== sanitizedCart.length ||
    (sanitizedCart.length > 0 && cartDates.size > 1) ||
    totalCartQuantity > MAX_PACKAGE_QUANTITY;

  const sanitizedDraftResult = sanitizeCurrentPackage(raw.currentPackage, options);
  const rawEditIndex = raw.editIndex;
  const editIndex =
    typeof rawEditIndex === "number" &&
    Number.isInteger(rawEditIndex) &&
    rawEditIndex >= 0 &&
    rawEditIndex < sanitizedCart.length
      ? rawEditIndex
      : null;

  let currentPackage = sanitizedDraftResult.draft;
  let nextStep = typeof raw.currentStep === "number" ? Math.trunc(raw.currentStep) : 1;
  let notice: string | null = null;

  if (hasInvalidCart) {
    sanitizedFormData.cart = [];
    sanitizedFormData.discount = 0;
    currentPackage = createEmptyCurrentPackage(defaultSizeName);
    nextStep = resolveStepAfterPackageReset(sanitizedFormData);
    notice =
      "Saved package details were incomplete or outdated, so the package step was cleared. Please re-enter package information.";
  } else {
    sanitizedFormData.cart = sanitizedCart;

    if (sanitizedDraftResult.reset || (raw.editIndex !== null && editIndex === null)) {
      currentPackage = createEmptyCurrentPackage(defaultSizeName);
      notice =
        "An invalid saved package draft was removed. Please review the package step before continuing.";
    }

    if (!sanitizedFormData.cart.length) {
      sanitizedFormData.discount = 0;
    }

    if (!sanitizedFormData.pickupLocationId || !sanitizedFormData.dropLocationId) {
      nextStep = 1;
    } else if (!sanitizedFormData.cart.length && nextStep > 2) {
      nextStep = 2;
    } else {
      nextStep = Math.min(3, Math.max(1, nextStep || 1));
    }
  }

  return {
    state: {
      formData: sanitizedFormData,
      currentPackage,
      editIndex: hasInvalidCart ? null : editIndex,
      currentStep: nextStep,
      recoveryNotice: notice,
    },
    notice,
  };
}

export function createPersistablePackageState(
  state: PackageState,
  options?: PackageSanitizeOptions,
): PackageState {
  const sanitized = sanitizePackageState(state, options).state;

  return {
    ...sanitized,
    recoveryNotice: null,
    currentPackage: {
      ...sanitized.currentPackage,
      packageImage:
        typeof sanitized.currentPackage.packageImage === "string" &&
        isPersistablePackageImage(sanitized.currentPackage.packageImage)
          ? sanitized.currentPackage.packageImage.trim()
          : "",
    },
  };
}

export function getPackageStateSignature(state: PackageState): string {
  return JSON.stringify({
    ...state,
    recoveryNotice: null,
    currentPackage: {
      ...state.currentPackage,
      packageImage:
        typeof state.currentPackage.packageImage === "string"
          ? state.currentPackage.packageImage
          : "[transient-file]",
    },
  });
}

export function loadPackageStateFromStorage(): PackageState {
  if (typeof window === "undefined") {
    return createDefaultPackageState();
  }

  try {
    const savedState = localStorage.getItem(PACKAGE_STORAGE_KEY);
    if (!savedState) {
      return createDefaultPackageState();
    }

    const parsed = JSON.parse(savedState);
    const sanitized = sanitizePackageState(parsed);
    localStorage.setItem(
      PACKAGE_STORAGE_KEY,
      JSON.stringify(createPersistablePackageState(sanitized.state)),
    );
    return sanitized.state;
  } catch (error) {
    console.error("Could not load state from local storage", error);
    localStorage.removeItem(PACKAGE_STORAGE_KEY);
    return {
      ...createDefaultPackageState(),
      recoveryNotice:
        "Saved package details could not be restored. Please enter package information again.",
    };
  }
}
