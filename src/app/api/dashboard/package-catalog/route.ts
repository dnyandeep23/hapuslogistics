import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import PackageCatalog from "@/app/api/models/packageCatalogModel";
import { PACKAGE_CATALOG_KEY, resolvePackageCatalog } from "@/app/api/lib/packageCatalog";
import {
  DEFAULT_PACKAGE_CATEGORIES,
  DEFAULT_PACKAGE_SIZES,
  normalizePackageCategories,
  normalizePackageSizes,
  type PackageCategoryConfig,
  type PackageSizeConfig,
} from "@/lib/packageCatalog";

const JWT_SECRET = process.env.JWT_SECRET!;

type AuthUser = {
  _id: string;
  isSuperAdmin?: boolean;
};

const getAuthUser = async (request: NextRequest): Promise<AuthUser | null> => {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id?: string };
    if (!payload.id) return null;
    const user = await User.findById(payload.id).select("_id isSuperAdmin").lean<AuthUser | null>();
    return user;
  } catch {
    return null;
  }
};

const normalizeCategoriesFromBody = (raw: unknown): { value: PackageCategoryConfig[]; error?: string } => {
  const normalized = normalizePackageCategories(raw, DEFAULT_PACKAGE_CATEGORIES)
    .map((entry, index) => ({
      ...entry,
      name: entry.name.trim(),
      icon: entry.icon.trim() || "mdi:shape-outline",
      defaultFare: Math.max(0, Number(entry.defaultFare) || 0),
      sortOrder: Math.max(0, Number.isFinite(Number(entry.sortOrder)) ? Number(entry.sortOrder) : index + 1),
      isActive: Boolean(entry.isActive),
    }))
    .filter((entry) => entry.name.length > 0);

  if (normalized.length === 0) {
    return { value: [], error: "At least one category is required." };
  }

  const unique = new Set<string>();
  for (const category of normalized) {
    const lowered = category.name.toLowerCase();
    if (unique.has(lowered)) {
      return { value: [], error: `Duplicate category name: ${category.name}` };
    }
    unique.add(lowered);
  }

  if (!normalized.some((entry) => entry.isActive)) {
    return { value: [], error: "At least one category must be active." };
  }

  return {
    value: [...normalized].sort((left, right) => left.sortOrder - right.sortOrder),
  };
};

const normalizeSizesFromBody = (raw: unknown): { value: PackageSizeConfig[]; error?: string } => {
  const normalized = normalizePackageSizes(raw, DEFAULT_PACKAGE_SIZES)
    .map((entry, index) => ({
      ...entry,
      name: entry.name.trim(),
      description: String(entry.description ?? "").trim(),
      maxWeightKg: Math.max(0.1, Number(entry.maxWeightKg) || 1),
      priceMultiplier: Math.max(0.1, Number(entry.priceMultiplier) || 1),
      visualScale: Math.max(0.5, Number(entry.visualScale) || 1),
      sortOrder: Math.max(0, Number.isFinite(Number(entry.sortOrder)) ? Number(entry.sortOrder) : index + 1),
      isActive: Boolean(entry.isActive),
    }))
    .filter((entry) => entry.name.length > 0);

  if (normalized.length === 0) {
    return { value: [], error: "At least one package size is required." };
  }

  const unique = new Set<string>();
  for (const size of normalized) {
    const lowered = size.name.toLowerCase();
    if (unique.has(lowered)) {
      return { value: [], error: `Duplicate package size name: ${size.name}` };
    }
    unique.add(lowered);
  }

  if (!normalized.some((entry) => entry.isActive)) {
    return { value: [], error: "At least one package size must be active." };
  }

  return {
    value: [...normalized].sort((left, right) => left.sortOrder - right.sortOrder),
  };
};

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const user = await getAuthUser(request);
    if (!user || !user.isSuperAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const catalog = await resolvePackageCatalog();
    return NextResponse.json(
      {
        success: true,
        categories: catalog.categories,
        sizes: catalog.sizes,
        updatedAt: catalog.updatedAt,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load package catalog.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    const user = await getAuthUser(request);
    if (!user || !user.isSuperAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      categories?: unknown;
      sizes?: unknown;
    };

    const parsedCategories = normalizeCategoriesFromBody(body.categories);
    if (parsedCategories.error) {
      return NextResponse.json({ success: false, message: parsedCategories.error }, { status: 400 });
    }

    const parsedSizes = normalizeSizesFromBody(body.sizes);
    if (parsedSizes.error) {
      return NextResponse.json({ success: false, message: parsedSizes.error }, { status: 400 });
    }

    const updated = await PackageCatalog.findOneAndUpdate(
      { key: PACKAGE_CATALOG_KEY },
      {
        key: PACKAGE_CATALOG_KEY,
        categories: parsedCategories.value,
        sizes: parsedSizes.value,
        updatedBy: user._id,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean<{
      categories?: unknown;
      sizes?: unknown;
      updatedAt?: Date | string;
    } | null>();

    const normalizedCategories = normalizePackageCategories(updated?.categories, DEFAULT_PACKAGE_CATEGORIES);
    const normalizedSizes = normalizePackageSizes(updated?.sizes, DEFAULT_PACKAGE_SIZES);

    return NextResponse.json(
      {
        success: true,
        message: "Package catalog updated successfully.",
        categories: normalizedCategories,
        sizes: normalizedSizes,
        updatedAt: updated?.updatedAt ? new Date(updated.updatedAt).toISOString() : new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to update package catalog.",
      },
      { status: 500 },
    );
  }
}
