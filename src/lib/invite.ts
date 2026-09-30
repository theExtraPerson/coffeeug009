import { BRAND_NAME } from "@/lib/platform";

const STORAGE_KEY = "coffeeug_invite";

export function normalizeInviteCode(raw: string | null | undefined) {
  const code = (raw ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,10}$/.test(code)) return "";
  return code;
}

export function captureInviteFromSearch(search: URLSearchParams) {
  return (
    normalizeInviteCode(search.get("ref")) ||
    normalizeInviteCode(search.get("invite")) ||
    normalizeInviteCode(search.get("code"))
  );
}

export function rememberInvite(code: string) {
  const normalized = normalizeInviteCode(code);
  if (!normalized || typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, normalized);
}

export function readRememberedInvite() {
  if (typeof window === "undefined") return "";
  return normalizeInviteCode(window.localStorage.getItem(STORAGE_KEY));
}

export function clearRememberedInvite() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function invitePath(code: string) {
  const normalized = normalizeInviteCode(code);
  return normalized ? `/invite/${normalized}` : "";
}

export function inviteUrl(origin: string, code: string) {
  const path = invitePath(code);
  if (!path) return "";
  return `${origin.replace(/\/$/, "")}${path}`;
}

export function inviteShareText(code: string, url: string) {
  return `Join ${BRAND_NAME} with my invite code ${code}. Activate a coffee processing plant and earn every day.\n${url}`;
}
