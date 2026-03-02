import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/verifyemail",
  "/forgot-password",
  "/reset-password",
  "/contact",
  "/callback-success",
];

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/checkout"];

const isTokenValid = (token: string) => {
  try {
    jwt.verify(token, process.env.JWT_SECRET!);
    return true;
  } catch {
    return false;
  }
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isProtectedRoute = PROTECTED_PREFIXES.some(prefix =>
    pathname.startsWith(prefix)
  );

  if (token && !isTokenValid(token)) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete("token");
    return res;
  }

  if (token && isPublicRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!token && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/verifyemail",
    "/forgot-password",
    "/reset-password",
    "/contact",
    "/auth/callback-success",
    "/dashboard/:path*",
    "/profile/:path*",
    "/checkout/:path*",
  ],
};
