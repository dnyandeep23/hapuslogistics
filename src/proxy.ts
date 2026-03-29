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
  "/auth/callback-success",
];

const AUTH_ROUTES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verifyemail",
  "/callback-success",
  "/auth/callback-success",
]);

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/checkout"];
const LOGIN_PATH = "/login";
const REDIRECT_PARAM = "redirect";

const isTokenValid = (token: string) => {
  try {
    jwt.verify(token, process.env.JWT_SECRET!);
    return true;
  } catch {
    return false;
  }
};

const getSafeRedirectPath = (value: string | null) => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("//")) return null;

  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("/api")) return null;

  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost") return null;
    if (AUTH_ROUTES.has(parsed.pathname)) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

const buildLoginRedirectUrl = (request: NextRequest, redirectPath: string) => {
  const url = new URL(LOGIN_PATH, request.url);
  url.searchParams.set(REDIRECT_PARAM, redirectPath);
  return url;
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
  const redirectTarget = getSafeRedirectPath(request.nextUrl.searchParams.get(REDIRECT_PARAM));

  if (token && !isTokenValid(token)) {
    const res = isProtectedRoute
      ? NextResponse.redirect(buildLoginRedirectUrl(request, pathname + request.nextUrl.search))
      : NextResponse.next();
    res.cookies.delete("token");
    return res;
  }

  if (token && isPublicRoute) {
    if (redirectTarget && AUTH_ROUTES.has(pathname)) {
      return NextResponse.redirect(new URL(redirectTarget, request.url));
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!token && isProtectedRoute) {
    return NextResponse.redirect(buildLoginRedirectUrl(request, pathname + request.nextUrl.search));
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
    "/callback-success",
    "/auth/callback-success",
    "/dashboard/:path*",
    "/profile/:path*",
    "/checkout/:path*",
  ],
};
