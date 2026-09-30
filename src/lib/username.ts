/**
 * CoffeeUG members sign in with a username, but Supabase Auth is keyed by
 * email. Every account gets a synthetic, deterministic login address derived
 * from its username, so the member never sees or needs an email.
 */

const LOGIN_DOMAIN = "coffeeugltd.app";

export const USERNAME_RULES = "3–20 characters: letters, numbers, dots or underscores";

export function normalizeUsername(input: string) {
  return (input ?? "").trim().toLowerCase();
}

export function isValidUsername(input: string) {
  return /^[a-z0-9][a-z0-9._]{2,19}$/.test(normalizeUsername(input));
}

/** The login address stored in auth.users for a username. */
export function usernameToEmail(input: string) {
  return `${normalizeUsername(input)}@${LOGIN_DOMAIN}`;
}

/** Recover the username from a synthetic login address. */
export function emailToUsername(email: string | null | undefined) {
  const value = (email ?? "").trim().toLowerCase();
  if (!value.endsWith(`@${LOGIN_DOMAIN}`)) return "";
  return value.slice(0, -1 * (LOGIN_DOMAIN.length + 1));
}
