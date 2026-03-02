const safeDecodeURIComponent = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
  fallback = "Something went wrong. Please try again.",
) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallback;
};

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

  return decodedError;
};
