import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const vars = {};
for (const line of env.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;
  vars[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const admin = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: before, error: readError } = await admin
  .from("app_settings")
  .select("withdraw_fee_rate, welcome_message, term_days")
  .eq("id", 1)
  .single();
if (readError) throw readError;

const { data: after, error: updateError } = await admin
  .from("app_settings")
  .update({
    withdraw_fee_rate: 0.15,
    welcome_message: String(before.welcome_message ?? "").replaceAll("10% fee", "15% fee"),
  })
  .eq("id", 1)
  .select("withdraw_fee_rate, term_days")
  .single();
if (updateError) throw updateError;

console.log(
  JSON.stringify({
    previousFeeRate: before.withdraw_fee_rate,
    feeRate: after.withdraw_fee_rate,
    termDays: after.term_days,
  }),
);
