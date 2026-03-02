import "@/app/api/lib/cleanupScheduler";
import { NextResponse } from "next/server";
import { dbConnect } from "./lib/db";

export async function GET() {
  try {
    await dbConnect();

    return NextResponse.json({
      message: "Backend is doing his best !!!. DB is connected.",
      success: true,
    });
  } catch (error: unknown) {
    console.error("Health check failed:", error);

    return NextResponse.json(
      {
        message: "Backend health check failed.",
        success: false,
      },
      { status: 500 }
    );
  }
}
