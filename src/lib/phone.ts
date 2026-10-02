/** Digits after the country code, with a single leading 0: 0709867453. */
function localDigits(input: string) {
  let digits = (input ?? "").replace(/\D/g, "");
  if (digits.startsWith("256")) digits = digits.slice(3);
  digits = digits.replace(/^0+/, "");
  return digits;
}

/** Local form used across the UI: 0709867453, never 2560709867453. */
export function normalizePhone(input: string) {
  const digits = localDigits(input);
  return digits ? `0${digits}` : "";
}

/** Strict MSISDN for MarzPay: 256709867453, or null when unusable. */
export function toMsisdn(input: string): string | null {
  const digits = localDigits(input);
  if (/^[37]\d{8}$/.test(digits)) return `256${digits}`;
  return null;
}

/** MarzPay wants E.164 on money-movement requests. */
export function toE164(msisdn: string) {
  return `+${msisdn}`;
}

/**
 * Best-effort network label from the Ugandan prefix. MarzPay auto-detects the
 * real network from the phone number; this only pre-labels the UI.
 */
export function detectProvider(input: string): "MTN" | "AIRTEL" | null {
  const msisdn = toMsisdn(input);
  if (!msisdn) return null;
  const prefix = msisdn.slice(3, 5);
  if (prefix === "77" || prefix === "78" || prefix === "76") return "MTN";
  if (prefix === "70" || prefix === "75" || prefix === "74") return "AIRTEL";
  return null;
}
