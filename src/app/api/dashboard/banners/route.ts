import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { dbConnect } from "@/app/api/lib/db";
import User from "@/app/api/models/userModel";
import DashboardBanner from "@/app/api/models/dashboardBannerModel";

const JWT_SECRET = process.env.JWT_SECRET!;
const DASHBOARD_BANNER_KEY = "dashboard-home-carousel";

type AuthUser = {
  _id: string;
  isSuperAdmin?: boolean;
};

type BannerSlideInput = {
  imageUrl?: unknown;
  isActive?: unknown;
  sequence?: unknown;
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

const toStringValue = (value: unknown) => String(value ?? "").trim();

const normalizeSlides = (slidesRaw: unknown) => {
  if (!Array.isArray(slidesRaw)) return [];

  const normalized = slidesRaw
    .map((slide, index) => {
      const item = slide as BannerSlideInput;
      const imageUrl = toStringValue(item?.imageUrl);
      if (!imageUrl) return null;
      return {
        imageUrl,
        isActive: item?.isActive === undefined ? true : Boolean(item?.isActive),
        sequence: Number.isFinite(Number(item?.sequence)) ? Number(item?.sequence) : index,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return normalized.sort((a, b) => a.sequence - b.sequence);
};

const mapSlides = (slides: unknown) => {
  if (!Array.isArray(slides)) return [];
  return slides
    .map((slide) => {
      const item = slide as BannerSlideInput;
      const imageUrl = toStringValue(item?.imageUrl);
      if (!imageUrl) return null;
      return {
        imageUrl,
        isActive: item?.isActive === undefined ? true : Boolean(item?.isActive),
        sequence: Number.isFinite(Number(item?.sequence)) ? Number(item?.sequence) : 0,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => a.sequence - b.sequence);
};

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const user = await getAuthUser(request);

    const doc = await DashboardBanner.findOne({ key: DASHBOARD_BANNER_KEY })
      .select("slides")
      .lean<{ slides?: unknown[] } | null>();

    const slides = mapSlides(doc?.slides ?? []);
    const activeSlides = slides.filter((slide) => slide.isActive);

    // Public read is allowed for active dashboard banners.
    if (!user) {
      return NextResponse.json(
        {
          success: true,
          slides: activeSlides,
          activeSlides,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        slides,
        activeSlides,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load banners." },
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

    const body = (await request.json().catch(() => ({}))) as { slides?: unknown };
    const slides = normalizeSlides(body.slides);

    const updated = await DashboardBanner.findOneAndUpdate(
      { key: DASHBOARD_BANNER_KEY },
      {
        key: DASHBOARD_BANNER_KEY,
        slides,
        updatedBy: user._id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean<{ slides?: unknown[] } | null>();

    const mappedSlides = mapSlides(updated?.slides ?? []);
    return NextResponse.json(
      {
        success: true,
        message: "Dashboard banners updated successfully.",
        slides: mappedSlides,
        activeSlides: mappedSlides.filter((slide) => slide.isActive),
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to update banners." },
      { status: 500 },
    );
  }
}
