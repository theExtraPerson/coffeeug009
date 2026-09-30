import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses row level security, so it must only ever be
 * constructed inside route handlers and server actions — never shipped to the
 * browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase admin environment variables");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
