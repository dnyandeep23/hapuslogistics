type UnknownRecord = Record<string, unknown>;

const toStringValue = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object") {
    const maybeHex = (value as { toHexString?: () => string }).toHexString;
    if (typeof maybeHex === "function") {
      const hex = maybeHex.call(value);
      if (hex) return hex;
    }
    const maybeToString = (value as { toString?: () => string }).toString;
    if (typeof maybeToString === "function") {
      const text = maybeToString.call(value);
      if (text && text !== "[object Object]") return text;
    }
  }
  return fallback;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const normalizeDateOnly = (value: unknown) => {
  const date = new Date(toStringValue(value));
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

export type ResolvedBusContact = {
  _id: string;
  busName: string;
  busNumber: string;
  busImage: string;
  contactPersonName: string;
  contactPersonNumber: string;
};

export const resolveBusContactForDate = (
  busValue: unknown,
  orderDateValue: unknown,
): ResolvedBusContact | null => {
  if (!isRecord(busValue)) return null;

  const busId = toStringValue(busValue._id);
  const busName = toStringValue(busValue.busName);
  const busNumber = toStringValue(busValue.busNumber);
  const busImage = Array.isArray(busValue.busImages)
    ? toStringValue(busValue.busImages[0])
    : "";

  const legacyName = toStringValue(busValue.contactPersonName);
  const legacyNumber = toStringValue(busValue.contactPersonNumber);
  const orderDate = normalizeDateOnly(orderDateValue) ?? normalizeDateOnly(new Date());

  let periodName = "";
  let periodNumber = "";

  const periods = Array.isArray(busValue.operatorContactPeriods)
    ? busValue.operatorContactPeriods
    : [];

  for (const rawPeriod of periods) {
    if (!isRecord(rawPeriod)) continue;
    const startDate = normalizeDateOnly(rawPeriod.startDate);
    const endDate = normalizeDateOnly(rawPeriod.endDate);
    if (!startDate || !endDate || !orderDate) continue;

    if (orderDate >= startDate && orderDate <= endDate) {
      periodName = toStringValue(rawPeriod.operatorName);
      periodNumber = toStringValue(rawPeriod.operatorPhone);
      break;
    }
  }

  const contactPersonName = periodName || legacyName;
  const contactPersonNumber = periodNumber || legacyNumber;

  if (!busName && !busNumber && !contactPersonName && !contactPersonNumber) {
    return null;
  }

  return {
    _id: busId,
    busName,
    busNumber,
    busImage,
    contactPersonName,
    contactPersonNumber,
  };
};
