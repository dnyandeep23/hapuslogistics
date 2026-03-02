import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import User from "@/app/api/models/userModel";
import TravelCompany from "@/app/api/models/travelCompanyModel";
import { dbConnect } from "@/app/api/lib/db";
import { sendEmail, wasEmailAccepted } from "@/app/api/lib/mailer";
import { createNotification } from "@/app/api/lib/notifications";
import { randomUUID } from "crypto";
import bcryptjs from "bcryptjs";
import {
  ADMIN_OTP_COOKIE,
  ADMIN_OTP_EXPIRY_MS,
  generateAdminOtp,
  normalizeAuthProviders,
  normalizeIntent,
  normalizePortal,
  normalizeRole,
  serializeAuthProvidersForSchema,
  signAuthToken,
  signPendingAdminToken,
  type AuthIntent,
  type AuthPortal,
  type UserRole,
} from "@/app/api/lib/authHelpers";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI!;

const portalLoginPath: Record<AuthPortal, string> = {
  user: "/login",
  operator: "/operator/login",
  admin: "/admin/login",
};

const getAuthFromState = (state: string | null): {
  portal: AuthPortal;
  role: UserRole;
  intent: AuthIntent;
  companyName?: string;
  companyId?: string;
} => {
  if (!state) {
    return { portal: "user", role: "user", intent: "login" };
  }

  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded) as {
      portal?: unknown;
      role?: unknown;
      intent?: unknown;
      companyName?: unknown;
      companyId?: unknown;
    };

    const requestedRole = normalizeRole(parsed.role) ?? "user";
    const normalizedPortal = normalizePortal(parsed.portal) ?? requestedRole;
    const normalizedRole: UserRole = normalizedPortal === "admin"
      ? "admin"
      : requestedRole === "operator"
        ? "operator"
        : "user";

    return {
      portal: normalizedPortal,
      role: normalizedRole,
      intent: normalizeIntent(parsed.intent) ?? "login",
      companyName: typeof parsed.companyName === "string" ? parsed.companyName.trim() : undefined,
      companyId: typeof parsed.companyId === "string" ? parsed.companyId.trim() : undefined,
    };
  } catch {
    return { portal: "user", role: "user", intent: "login" };
  }
};

const getGoogleCallbackErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (!message) {
    return "Google sign-in failed. Please try again.";
  }

  if (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnrefused") ||
    message.includes("timed out")
  ) {
    return "Google sign-in failed due to a network issue. Please try again.";
  }

  if (
    message.includes("invalid_grant") ||
    message.includes("invalid_request") ||
    message.includes("oauth")
  ) {
    return "Google authorization expired. Please sign in again.";
  }

  if (message.includes("e11000") || message.includes("duplicate key")) {
    return "This Google account is already linked to another account.";
  }

  if (message.includes("json")) {
    return "Google response could not be processed. Please try again.";
  }

  return "Google sign-in failed. Please try again.";
};

type GoogleAuthUser = {
  authProvider?: string | string[];
  password?: string;
  email?: string;
  name?: string;
  _id?: { toString: () => string };
  operatorApprovalStatus?: string;
  pendingTravelCompanyId?: unknown;
  travelCompanyId?: unknown;
};

const buildGoogleOnlyPassword = async (seed: string) => {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(`google:${seed}:${randomUUID()}`, salt);
};

const ensureGoogleOnlyUserHasPassword = async (user: GoogleAuthUser) => {
  const providers = normalizeAuthProviders(user.authProvider);
  if (providers.includes("local")) {
    return;
  }

  if (typeof user.password === "string" && user.password.length > 0) {
    return;
  }

  user.password = await buildGoogleOnlyPassword(user.email ?? "unknown");
};

const requestOperatorCompanyLink = async (
  user: GoogleAuthUser,
  selection: { companyId?: string; companyName?: string },
) => {
  if (!user._id || !user.email) return false;

  const trimmedCompanyId = selection.companyId?.trim() ?? "";
  const trimmedCompanyName = selection.companyName?.trim() ?? "";

  let company:
    | {
        _id: mongoose.Types.ObjectId;
        name: string;
        ownerUserId?: mongoose.Types.ObjectId;
        ownerEmail?: string;
        contact?: { email?: string };
      }
    | null = null;

  if (trimmedCompanyId && mongoose.Types.ObjectId.isValid(trimmedCompanyId)) {
    company = await TravelCompany.findById(trimmedCompanyId)
      .select("_id name ownerUserId ownerEmail contact")
      .lean();
  }

  if (!company && trimmedCompanyName) {
    company = await TravelCompany.findOne({
      name: {
        $regex: `^${trimmedCompanyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    })
      .select("_id name ownerUserId ownerEmail contact")
      .lean();
  }

  if (!company) {
    return false;
  }

  user.operatorApprovalStatus = "operator_requested";
  user.pendingTravelCompanyId = company._id;
  user.travelCompanyId = undefined;

  const adminEmail = company.ownerEmail || company.contact?.email || "";
  if (adminEmail) {
    try {
      await sendEmail({
        email: adminEmail,
        emailType: "OPERATOR_REQUEST_TO_COMPANY",
        operatorName: user.name ?? "Operator",
        companyName: company.name,
        adminName: company.name,
      });
    } catch {
      // Non-blocking
    }
  }

  try {
    await sendEmail({
      email: user.email,
      emailType: "OPERATOR_REQUEST_SUBMITTED",
      operatorName: user.name ?? "Operator",
      companyName: company.name,
    });
  } catch {
    // Non-blocking
  }

  if (company.ownerUserId) {
    await createNotification({
      recipientUserId: company.ownerUserId.toString(),
      title: "New Operator Join Request",
      message: `${user.name ?? "An operator"} (${user.email}) requested to join ${company.name}.`,
      type: "info",
      metadata: {
        operatorEmail: user.email,
        companyId: company._id.toString(),
      },
    });
  }

  return true;
};

export async function GET(request: NextRequest) {
  await dbConnect();

  const requestUrl = new URL(request.url);
  const authProviderSchemaInstance = User.schema.path("authProvider")?.instance;
  const fallbackAuth = getAuthFromState(requestUrl.searchParams.get("state"));
  const fallbackLoginUrl = new URL(portalLoginPath[fallbackAuth.portal], request.url);

  try {
    const { searchParams } = requestUrl;
    const code = searchParams.get("code");
    const auth = getAuthFromState(searchParams.get("state"));
    const loginUrl = new URL(portalLoginPath[auth.portal], request.url);

    if (!code) {
      loginUrl.searchParams.set("error", "Authorization code missing");
      return NextResponse.redirect(loginUrl);
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = (await tokenRes.json()) as { access_token?: string };

    if (!tokenRes.ok || !tokenData.access_token) {
      loginUrl.searchParams.set("error", "Failed to complete Google login.");
      return NextResponse.redirect(loginUrl);
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = (await profileRes.json()) as {
      id?: string;
      email?: string;
      name?: string;
    };

    const googleId = profile.id;
    const email = profile.email;
    const name = profile.name ?? "";

    if (!googleId || !email) {
      loginUrl.searchParams.set("error", "Unable to retrieve Google account details.");
      return NextResponse.redirect(loginUrl);
    }

    let user = await User.findOne({ email }).select("+password");

    // Admin portal
    if (auth.portal === "admin") {
      const adminOtpUrl = new URL("/admin/verify-access", request.url);
      const isAdminRegisterIntent = auth.intent === "register";
      if (isAdminRegisterIntent) {
        adminOtpUrl.searchParams.set("flow", "register");
      }

      if (!user) {
        if (!isAdminRegisterIntent) {
          loginUrl.searchParams.set(
            "error",
            "No admin account found. Please register first.",
          );
          return NextResponse.redirect(loginUrl);
        }

        const existingGoogleUser = await User.findOne({ googleId });
        if (existingGoogleUser) {
          loginUrl.searchParams.set("error", "Google account already in use.");
          return NextResponse.redirect(loginUrl);
        }

        const companyName = auth.companyName?.trim() ?? "";
        if (!companyName) {
          const registerUrl = new URL("/admin/register", request.url);
          registerUrl.searchParams.set(
            "error",
            "Admin Google registration requires company name.",
          );
          return NextResponse.redirect(registerUrl);
        }

        const existingCompany = await TravelCompany.findOne({
          name: { $regex: `^${companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        });

        let targetCompanyId: mongoose.Types.ObjectId;
        if (existingCompany) {
          const currentAdminCount = await User.countDocuments({
            travelCompanyId: existingCompany._id,
            role: "admin",
            isSuperAdmin: { $ne: true },
          });
          if (currentAdminCount >= 4) {
            const registerUrl = new URL("/admin/register", request.url);
            registerUrl.searchParams.set(
              "error",
              "This logistics company already has 4 admins.",
            );
            return NextResponse.redirect(registerUrl);
          }
          targetCompanyId = existingCompany._id;
        } else {
          const createdCompany = await TravelCompany.create({
            name: companyName,
            ownerEmail: email.toLowerCase(),
            contact: {
              email: email.toLowerCase(),
            },
          });
          targetCompanyId = createdCompany._id;
        }

        const googlePassword = await buildGoogleOnlyPassword(email);
        user = await User.create({
          name,
          email,
          googleId,
          password: googlePassword,
          authProvider: serializeAuthProvidersForSchema(
            ["google"],
            authProviderSchemaInstance,
          ),
          isVerified: true,
          role: "admin",
          travelCompanyId: targetCompanyId,
          hasRegisteredBus: false,
          buses: [],
        });
        const companyForOwner = await TravelCompany.findById(targetCompanyId).select("ownerUserId ownerEmail");
        if (companyForOwner && !companyForOwner.ownerUserId) {
          companyForOwner.ownerUserId = user._id;
        }
        if (companyForOwner && !companyForOwner.ownerEmail) {
          companyForOwner.ownerEmail = email.toLowerCase();
        }
        if (companyForOwner) {
          await companyForOwner.save();
        }
      } else {
        const hasAdminAccess = user.role === "admin" || user.isSuperAdmin;
        if (!isAdminRegisterIntent && !hasAdminAccess) {
          loginUrl.searchParams.set(
            "error",
            "This account does not have admin access.",
          );
          return NextResponse.redirect(loginUrl);
        }
      }

      const providers = normalizeAuthProviders(user.authProvider);
      const isGoogleLinked = providers.includes("google");

      if (isGoogleLinked && user.googleId && user.googleId !== googleId) {
        loginUrl.searchParams.set(
          "error",
          "Email is linked to a different Google account.",
        );
        return NextResponse.redirect(loginUrl);
      }

      if (!isGoogleLinked) {
        const existingGoogleUser = await User.findOne({ googleId });
        if (existingGoogleUser && existingGoogleUser._id.toString() !== user._id.toString()) {
          loginUrl.searchParams.set(
            "error",
            "Google account already linked to another user.",
          );
          return NextResponse.redirect(loginUrl);
        }

        user.googleId = googleId;
        user.authProvider = serializeAuthProvidersForSchema(
          [...new Set([...providers, "google"])],
          authProviderSchemaInstance,
        );
      }

      if (!user.name) {
        user.name = name;
      }

      if (isAdminRegisterIntent && !user.travelCompanyId) {
        const companyName = auth.companyName?.trim() ?? "";
        if (!companyName) {
          const registerUrl = new URL("/admin/register", request.url);
          registerUrl.searchParams.set(
            "error",
            "Company name is required to complete admin registration.",
          );
          return NextResponse.redirect(registerUrl);
        }

        const existingCompany = await TravelCompany.findOne({
          name: { $regex: `^${companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        });
        if (existingCompany) {
          const currentAdminCount = await User.countDocuments({
            travelCompanyId: existingCompany._id,
            role: "admin",
            isSuperAdmin: { $ne: true },
            _id: { $ne: user._id },
          });
          if (currentAdminCount >= 4) {
            const registerUrl = new URL("/admin/register", request.url);
            registerUrl.searchParams.set(
              "error",
              "This logistics company already has 4 admins.",
            );
            return NextResponse.redirect(registerUrl);
          }
          user.travelCompanyId = existingCompany._id;
          const companyForOwner = await TravelCompany.findById(existingCompany._id).select("ownerUserId ownerEmail");
          if (companyForOwner && !companyForOwner.ownerUserId) {
            companyForOwner.ownerUserId = user._id;
          }
          if (companyForOwner && !companyForOwner.ownerEmail) {
            companyForOwner.ownerEmail = user.email.toLowerCase();
          }
          if (companyForOwner) {
            await companyForOwner.save();
          }
        } else {
          const createdCompany = await TravelCompany.create({
            name: companyName,
            ownerUserId: user._id,
            ownerEmail: user.email.toLowerCase(),
            contact: {
              email: user.email.toLowerCase(),
            },
          });
          user.travelCompanyId = createdCompany._id;
        }
      }

      user.role = "admin";
      user.isVerified = true;
      await ensureGoogleOnlyUserHasPassword(user);

      const adminOtp = generateAdminOtp();
      user.adminAccessCode = adminOtp;
      user.adminAccessCodeExpiry = new Date(Date.now() + ADMIN_OTP_EXPIRY_MS);
      await user.save();

      let adminOtpSent = false;
      try {
        const otpEmailResult = await sendEmail({
          email: user.email,
          emailType: "ADMIN_OTP",
          securityCode: adminOtp,
        });
        adminOtpSent = wasEmailAccepted(otpEmailResult);
      } catch {
        adminOtpSent = false;
      }

      const pendingToken = signPendingAdminToken({
        id: user._id.toString(),
        role: "admin",
        email: user.email,
      });

      if (!adminOtpSent) {
        adminOtpUrl.searchParams.set("delivery", "failed");
      }
      const response = NextResponse.redirect(adminOtpUrl);

      response.cookies.set(ADMIN_OTP_COOKIE, pendingToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: ADMIN_OTP_EXPIRY_MS / 1000,
      });

      response.cookies.set("token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });

      return response;
    }

    // User / Operator portals
    if (user) {
      if (user.role !== auth.role) {
        loginUrl.searchParams.set(
          "error",
          "This email is registered under a different role. Please use the correct login option.",
        );
        return NextResponse.redirect(loginUrl);
      }

      const providers = normalizeAuthProviders(user.authProvider);
      const isGoogleLinked = providers.includes("google");

      if (isGoogleLinked && user.googleId && user.googleId !== googleId) {
        loginUrl.searchParams.set(
          "error",
          "Email is linked to a different Google account.",
        );
        return NextResponse.redirect(loginUrl);
      }

      if (!isGoogleLinked) {
        const existingGoogleUser = await User.findOne({ googleId });
        if (existingGoogleUser && existingGoogleUser._id.toString() !== user._id.toString()) {
          loginUrl.searchParams.set(
            "error",
            "Google account already linked to another user.",
          );
          return NextResponse.redirect(loginUrl);
        }

        user.googleId = googleId;
        user.authProvider = serializeAuthProvidersForSchema(
          [...new Set([...providers, "google"])],
          authProviderSchemaInstance,
        );
      }

      if (!user.name) {
        user.name = name;
      }

      user.isVerified = true;
      await ensureGoogleOnlyUserHasPassword(user);
      if (auth.role === "operator" && auth.intent === "register") {
        if (auth.companyId || auth.companyName) {
          await requestOperatorCompanyLink(user, {
            companyId: auth.companyId,
            companyName: auth.companyName,
          });
        }
      }
      await user.save();
    } else {
      if (auth.intent === "login") {
        loginUrl.searchParams.set(
          "error",
          "No account found for this role. Please register first.",
        );
        return NextResponse.redirect(loginUrl);
      }

      const existingGoogleUser = await User.findOne({ googleId });
      if (existingGoogleUser) {
        loginUrl.searchParams.set("error", "Google account already in use.");
        return NextResponse.redirect(loginUrl);
      }

      const googlePassword = await buildGoogleOnlyPassword(email);
      user = await User.create({
        name,
        email,
        googleId,
        password: googlePassword,
        authProvider: serializeAuthProvidersForSchema(
          ["google"],
          authProviderSchemaInstance,
        ),
        isVerified: true,
        role: auth.role,
        operatorApprovalStatus: "none",
      });
      if (auth.role === "operator" && auth.intent === "register") {
        if (auth.companyId || auth.companyName) {
          await requestOperatorCompanyLink(user, {
            companyId: auth.companyId,
            companyName: auth.companyName,
          });
        }
        await user.save();
      }
    }

    const token = signAuthToken({
      id: user._id.toString(),
      name: user.name,
      authProvider: normalizeAuthProviders(user.authProvider),
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.redirect(new URL("/callback-success", request.url));

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    response.cookies.set(ADMIN_OTP_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error: unknown) {
    console.error("Google callback error:", error);
    fallbackLoginUrl.searchParams.set("error", getGoogleCallbackErrorMessage(error));
    return NextResponse.redirect(fallbackLoginUrl);
  }
}
