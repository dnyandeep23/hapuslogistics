const DEFAULT_AUTH_REDIRECT = "/dashboard";

const AUTH_ROUTE_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verifyemail",
  "/callback-success",
  "/api/auth",
] as const;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_STRENGTH_RECOMMENDED_LENGTH = 8;
export const INVALID_EMAIL_MESSAGE = "Please enter a valid email address";
export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";
export const PASSWORD_MIN_LENGTH_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
export const PASSWORD_MISMATCH_MESSAGE = "Passwords do not match";
export const GENERIC_AUTH_ERROR_MESSAGE = "Something went wrong, please try again";

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const sanitizeRedirectPath = (
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT,
) => {
  const rawValue = safeDecode(String(value ?? "").trim());

  if (!rawValue || !rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(rawValue, "http://localhost");
    const normalizedPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;

    const isBlockedRoute = AUTH_ROUTE_PREFIXES.some((prefix) =>
      normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
    );

    return isBlockedRoute ? fallback : normalizedPath;
  } catch {
    return fallback;
  }
};

export const appendRedirectParam = (
  pathname: string,
  redirectPath: string | null | undefined,
) => {
  const normalizedRedirect = sanitizeRedirectPath(redirectPath, "");

  if (!normalizedRedirect) {
    return pathname;
  }

  const url = new URL(pathname, "http://localhost");
  url.searchParams.set("redirect", normalizedRedirect);

  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
};

export const getEmailValidationMessage = (email: string) => {
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    return "Email is required";
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return INVALID_EMAIL_MESSAGE;
  }

  return null;
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ");

export const getPasswordValidationMessage = (
  password: string,
  options?: {
    requiredMessage?: string;
  },
) => {
  const normalizedPassword = password.trim();

  if (!normalizedPassword) {
    return options?.requiredMessage ?? "Password is required";
  }

  if (normalizedPassword.length < PASSWORD_MIN_LENGTH) {
    return PASSWORD_MIN_LENGTH_MESSAGE;
  }

  return null;
};

export const getNameValidationMessage = (name: string) => {
  const normalizedName = normalizeName(name);

  if (!normalizedName) {
    return "Name is required";
  }

  if (normalizedName.length < 2) {
    return "Enter at least 2 characters";
  }

  return null;
};

export const getConfirmPasswordValidationMessage = (
  password: string,
  confirmPassword: string,
  options?: {
    requiredMessage?: string;
  },
) => {
  if (!confirmPassword.trim()) {
    return options?.requiredMessage ?? "Confirm your password";
  }

  if (password !== confirmPassword) {
    return PASSWORD_MISMATCH_MESSAGE;
  }

  return null;
};

export const getOtpValidationMessage = (
  code: string,
  length: number,
  label = "Access code",
) => {
  if (!code.trim()) {
    return `${label} is required`;
  }

  if (!new RegExp(`^\\d{${length}}$`).test(code)) {
    return `${label} must be ${length} digits`;
  }

  return null;
};

export type PasswordStrength = {
  label: "Weak" | "Fair" | "Strong";
  helper: string;
  tone: string;
  barClassName: string;
  value: number;
};

export const getPasswordStrength = (password: string): PasswordStrength | null => {
  if (!password) {
    return null;
  }

  const checks = [
    password.length >= PASSWORD_STRENGTH_RECOMMENDED_LENGTH,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;

  if (score <= 1) {
    return {
      label: "Weak",
      helper: "Add more characters, letters, and a number.",
      tone: "text-rose-200",
      barClassName: "bg-rose-400",
      value: 33,
    };
  }

  if (score <= 3) {
    return {
      label: "Fair",
      helper: "Good start. Add an uppercase letter or symbol for a stronger password.",
      tone: "text-amber-100",
      barClassName: "bg-amber-300",
      value: 68,
    };
  }

  return {
    label: "Strong",
    helper: "This password is strong and ready to use.",
    tone: "text-emerald-200",
    barClassName: "bg-emerald-400",
    value: 100,
  };
};
