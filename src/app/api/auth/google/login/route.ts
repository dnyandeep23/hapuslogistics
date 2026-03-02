import { NextRequest, NextResponse } from 'next/server';
import { normalizeIntent, normalizePortal, normalizeRole } from '@/app/api/lib/authHelpers';


const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI;

export async function GET(request: NextRequest) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_OAUTH_REDIRECT_URI) {
    return NextResponse.json({ error: 'Google client ID or redirect URI is not configured.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const requestedRole = normalizeRole(searchParams.get("role"));
  const requestedPortal = normalizePortal(searchParams.get("portal"));
  const portal = requestedPortal ?? (requestedRole ?? "user");
  const role = portal === "admin"
    ? "admin"
    : requestedRole === "operator"
      ? "operator"
      : "user";
  const intent = normalizeIntent(searchParams.get("intent")) ?? "login";
  const initialCompanyName = searchParams.get("companyName")?.trim() ?? "";
  const initialCompanyId = searchParams.get("companyId")?.trim() ?? "";
  const registerState =
    intent === "register"
      ? {
          ...(initialCompanyName ? { companyName: initialCompanyName } : {}),
          ...(initialCompanyId ? { companyId: initialCompanyId } : {}),
        }
      : {};

  const state = Buffer.from(
    JSON.stringify({ portal, role, intent, ...registerState }),
    "utf-8",
  ).toString("base64url");

  const scope = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  const googleLoginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  return NextResponse.redirect(googleLoginUrl);
}
