export const INDIA_PHONE_PREFIX = "+91 ";

const INDIA_MOBILE_PATTERN = /^[6-9]\d{9}$/;

function stripLeadingIndiaPrefix(value: string): string {
  const trimmed = value.trimStart();
  if (trimmed.startsWith("+91")) {
    return trimmed.slice(3).trimStart();
  }
  return value;
}

export function getIndiaPhoneDigits(value: unknown): string {
  const raw = stripLeadingIndiaPrefix(String(value ?? ""));
  let digits = raw.replace(/\D/g, "");

  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  if (digits.length > 10 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

export function formatIndiaPhoneInput(value: unknown): string {
  return `${INDIA_PHONE_PREFIX}${getIndiaPhoneDigits(value)}`;
}

export function normalizeIndiaPhone(value: unknown): string | null {
  const digits = getIndiaPhoneDigits(value);
  if (!digits) return "";
  if (!INDIA_MOBILE_PATTERN.test(digits)) return null;
  return `${INDIA_PHONE_PREFIX}${digits}`;
}

export function isValidIndiaPhone(value: unknown): boolean {
  return Boolean(normalizeIndiaPhone(value));
}

export function toDialablePhone(value: unknown): string {
  const digits = getIndiaPhoneDigits(value);
  if (!digits) return "";
  return `+91${digits}`;
}
