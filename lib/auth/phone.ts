// Indian mobile numbers by default (+91). Shared by browser and server code.
export const DEFAULT_COUNTRY_CODE = "+91";

/** Returns an E.164 number (e.g. +919876543210) or null if invalid. */
export function normalizeMobile(input: string, countryCode = DEFAULT_COUNTRY_CODE): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    digits = "+" + digits.slice(1).replace(/\D/g, "");
  } else {
    digits = digits.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    if (countryCode === "+91" && digits.length === 12 && digits.startsWith("91")) digits = "+" + digits;
    else digits = countryCode + digits;
  }
  if (digits.startsWith("+91")) {
    return /^\+91[6-9]\d{9}$/.test(digits) ? digits : null;
  }
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function mobileError(input: string): string | null {
  if (!input.trim()) return "Enter your mobile number.";
  return normalizeMobile(input) ? null : "Enter a valid 10-digit mobile number (starting with 6, 7, 8 or 9).";
}

export function maskMobile(e164: string) {
  return e164.length > 6 ? `${e164.slice(0, 3)} ${"•".repeat(Math.max(0, e164.length - 7))}${e164.slice(-4)}` : e164;
}
