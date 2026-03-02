import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET!;
export const ADMIN_OTP_COOKIE = "admin_pending_token";
export const ADMIN_OTP_EXPIRY_MS = 10 * 60 * 1000;

export type UserRole = "user" | "operator" | "admin";
export type AuthIntent = "login" | "register";
export type AuthPortal = "user" | "operator" | "admin";

type PendingAdminPayload = {
  id: string;
  role: "admin";
  email: string;
};

export const normalizeRole = (role: unknown): UserRole | null => {
  if (role === "user" || role === "operator" || role === "admin") {
    return role;
  }
  return null;
};

export const normalizePortal = (portal: unknown): AuthPortal | null => {
  if (portal === "user" || portal === "operator" || portal === "admin") {
    return portal;
  }
  return null;
};

export const normalizeIntent = (intent: unknown): AuthIntent | null => {
  if (intent === "login" || intent === "register") {
    return intent;
  }
  return null;
};

export const normalizeAuthProviders = (providers: unknown): string[] => {
  if (Array.isArray(providers)) {
    return providers.filter((provider): provider is string => typeof provider === "string");
  }
  if (typeof providers === "string" && providers.length > 0) {
    return providers
      .split(",")
      .map((provider) => provider.trim())
      .filter((provider) => provider.length > 0);
  }
  return [];
};

export const serializeAuthProvidersForSchema = (
  providers: unknown,
  schemaPathInstance?: string,
): string[] | string => {
  const normalizedProviders = [...new Set(normalizeAuthProviders(providers))];

  if (schemaPathInstance === "Array") {
    return normalizedProviders;
  }

  return normalizedProviders.join(",");
};

export const generateAdminOtp = (length = 6): string => {
  const digits = "0123456789";
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return value;
};

export const signAuthToken = (payload: {
  id: string;
  name: string;
  email: string;
  authProvider: string[];
  role: string;
}) => jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });

export const signPendingAdminToken = (payload: PendingAdminPayload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: "10m" });

export const verifyPendingAdminToken = (token: string): PendingAdminPayload | null => {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as PendingAdminPayload;
    if (payload.role !== "admin" || !payload.id) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};
