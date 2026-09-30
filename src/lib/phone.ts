/** Local form used across the UI: 07XXXXXXXX. */
export function normalizePhone(input: string) {
  const digits = (input ?? "").replace(/\D/g, "");
  if (digits.startsWith("256")) return `0${digits.slice(3)}`;
  if (digits.startsWith("0")) return digits;
  if (digits) return `0${digits}`;
  return "";
}

/** Strict MSISDN for MarzPay: 2567XXXXXXXX, or null when unusable. */
export function toMsisdn(input: string): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (/^0[37]\d{8}$/.test(digits)) return `256${digits.slice(1)}`;
  if (/^256[37]\d{8}$/.test(digits)) return digits;
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

export function maskPhone(phone: string | null | undefined) {
  const value = (phone ?? "").trim();
  if (value.length < 7) return value || "—";
  return `${value.slice(0, 4)}****${value.slice(-3)}`;
}
