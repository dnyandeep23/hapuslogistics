import {
  GENERIC_AUTH_ERROR_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  PASSWORD_MIN_LENGTH_MESSAGE,
} from "@/lib/authFlow";

const safeDecodeURIComponent = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

type AuthErrorRule = {
  patterns: string[];
  message: string;
};

const AUTH_ERROR_RULES: AuthErrorRule[] = [
  {
    patterns: [
      "invalid email or password",
      "invalid credentials",
      "incorrect credentials",
      "incorrect email or password",
      "wrong email or password",
      "wrong credentials",
      "invalid password",
      "incorrect password",
      "login failed",
      "sign in failed",
      "sign-in failed",
      "unauthorized",
      "authentication failed",
      "please check your email, password, and role",
      "no user exists for the selected role",
      "password not set for this account",
      "this account does not have admin access",
      "this email is already associated with another login method",
    ],
    message: INVALID_CREDENTIALS_MESSAGE,
  },
  {
    patterns: ["user already exists", "already registered", "email already in use", "email already exists"],
    message: "User already exists. Please log in instead.",
  },
  {
    patterns: [
      "account not verified",
      "not verified",
      "verification required",
      "verify your account",
    ],
    message: "Account not verified. Please check your email or request a new verification link.",
  },
  {
    patterns: ["verification code", "security code", "otp", "one-time code", "code expired", "invalid code", "wrong code"],
    message: "The verification code is invalid or expired. Please request a new code.",
  },
  {
    patterns: ["password must be at least", "password too short", "weak password"],
    message: PASSWORD_MIN_LENGTH_MESSAGE,
  },
  {
    patterns: ["too many requests", "rate limit", "try again later"],
    message: "Too many attempts. Please wait a moment and try again.",
  },
  {
    patterns: ["failed to fetch", "networkerror", "network error", "network request failed", "fetch failed", "load failed"],
    message: GENERIC_AUTH_ERROR_MESSAGE,
  },
  {
    patterns: ["internal server error", "server error", "service unavailable", "bad gateway", "gateway timeout"],
    message: GENERIC_AUTH_ERROR_MESSAGE,
  },
];

const normalizeAuthMessage = (
  rawMessage: string,
  fallback = GENERIC_AUTH_ERROR_MESSAGE,
) => {
  const decodedMessage = safeDecodeURIComponent(rawMessage).replace(/\+/g, " ").replace(/\s+/g, " ").trim();
  const lowerCaseMessage = decodedMessage.toLowerCase();

  if (!decodedMessage) {
    return fallback;
  }

  if (
    lowerCaseMessage === "an unexpected error occurred." ||
    lowerCaseMessage === "an unexpected error occurred"
  ) {
    return GENERIC_AUTH_ERROR_MESSAGE;
  }

  const matchedRule = AUTH_ERROR_RULES.find((rule) =>
    rule.patterns.some((pattern) => lowerCaseMessage.includes(pattern)),
  );

  return matchedRule?.message || decodedMessage || fallback;
};

const getMessageFromRecord = (payload: Record<string, unknown>) => {
  const candidates = [payload.message, payload.error, payload.detail];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
};

export const extractErrorMessageFromPayload = (payload: unknown): string | null => {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  if (payload && typeof payload === "object") {
    return getMessageFromRecord(payload as Record<string, unknown>);
  }

  return null;
};

export const getErrorMessage = (
  error: unknown,
  fallback = GENERIC_AUTH_ERROR_MESSAGE,
) => {
  const extractedMessage =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : typeof error === "string" && error.trim()
        ? error.trim()
        : extractErrorMessageFromPayload(error);

  if (extractedMessage) {
    return normalizeAuthMessage(extractedMessage, fallback);
  }

  return fallback;
};

export const getInvalidCredentialsMessage = () => INVALID_CREDENTIALS_MESSAGE;

export const normalizeAuthQueryError = (rawError: string) => {
  const decodedError = safeDecodeURIComponent(rawError).replace(/\+/g, " ").trim();
  const lowerCaseError = decodedError.toLowerCase();

  if (!decodedError) {
    return "Authentication failed. Please try again.";
  }

  if (
    lowerCaseError === "an unexpected error occurred." ||
    lowerCaseError === "an unexpected error occurred"
  ) {
    return "Google sign-in failed. Please try again.";
  }

  if (lowerCaseError.includes("authorization code missing")) {
    return "Google sign-in was cancelled. Please try again.";
  }

  if (lowerCaseError.includes("failed to complete google login")) {
    return "Google could not verify your sign-in. Please try again.";
  }

  if (
    lowerCaseError.includes("oauth") ||
    lowerCaseError.includes("invalid_grant") ||
    lowerCaseError.includes("invalid_request")
  ) {
    return "Google authorization expired. Please sign in again.";
  }

  return normalizeAuthMessage(decodedError, "Authentication failed. Please try again.");
};
