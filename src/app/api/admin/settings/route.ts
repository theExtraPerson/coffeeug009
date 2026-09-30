import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/admin-auth";

const EDITABLE = [
  "welcome_message",
  "telegram_channel_url",
  "telegram_support_url",
  "about_text",
  "payout_hour",
  "daily_rate_percent",
  "term_days",
  "signup_bonus",
  "deposit_min",
  "deposit_max",
  "withdraw_min",
  "withdraw_max",
  "withdraw_fee_rate",
  "withdraw_start",
  "withdraw_end",
  "withdraw_auto",
  "frozen",
] as const;

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error || !admin) return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);

  const { data } = await admin.from("app_settings").select("*").eq("id", 1).maybeSingle();
  return NextResponse.json({ settings: data });
}

export async function POST(request: Request) {
  const { admin, error } = await requireAdmin();
  if (error || !admin) return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (!Object.keys(patch).length) return jsonError("Nothing to update");

  const { data, error: updateError } = await admin
    .from("app_settings")
    .update(patch)
    .eq("id", 1)
    .select("*")
    .single();
  if (updateError) return jsonError(updateError.message, 500);

  return NextResponse.json({ settings: data });
}
