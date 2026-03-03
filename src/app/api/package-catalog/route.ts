import { NextResponse } from "next/server";
import { dbConnect } from "@/app/api/lib/db";
import { resolveActivePackageCatalog } from "@/app/api/lib/packageCatalog";

export async function GET() {
  try {
    await dbConnect();
    const catalog = await resolveActivePackageCatalog();

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
