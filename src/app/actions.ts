"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function rpcMessage(error: { message: string } | null) {
  if (!error) return null;
  return error.message.replace(/^.*?:\s*/, "");
}

/** Put a chosen amount into the processing plant. Returns are 10% of that amount. */
export async function startProcessing(amount: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in first." };

  const invested = Math.round(Number(amount));
  if (!Number.isFinite(invested) || invested <= 0) {
    return { error: "Enter an amount to process." };
  }

  const { error } = await supabase.rpc("invest_in_plant", {
    _amount: invested,
    _note: null,
  });
  if (error) return { error: rpcMessage(error) };

  revalidatePath("/");
  revalidatePath("/plants");
  revalidatePath("/orders");
  revalidatePath("/records");
  revalidatePath("/team");
  revalidatePath("/me");
  return { error: null };
}

/** Activate a processing plant. All the money rules live in the SQL function. */
export async function activatePlant(productId: string, note?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in first." };

  const { error } = await supabase.rpc("purchase_product", {
    _product_id: productId,
    _note: note?.trim() || null,
  });
  if (error) return { error: rpcMessage(error) };

  revalidatePath("/");
  revalidatePath("/plants");
  revalidatePath("/orders");
  revalidatePath("/records");
  revalidatePath("/team");
  revalidatePath("/me");
  return { error: null };
}

export async function applyInviteCode(code: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in first.", linked: false, reason: "auth" };

  const { data, error } = await supabase.rpc("apply_invite", {
    _code: code.trim().toUpperCase(),
  });
  if (error) return { error: rpcMessage(error), linked: false, reason: "rpc" };

  const payload = (typeof data === "string" ? JSON.parse(data) : data) as {
    ok?: boolean;
    linked?: boolean;
    reason?: string;
  } | null;

  revalidatePath("/team");
  revalidatePath("/invite");
  revalidatePath("/me");
  return {
    error:
      payload?.ok === false && payload.reason === "invalid_code"
        ? "That invite code was not found"
        : null,
    linked: Boolean(payload?.linked),
    reason: payload?.reason ?? null,
  };
}

/**
 * Sweeps any daily returns that are due into the wallet. Called on load and on
 * focus so a member never has to press a button to be paid, and safe to call
 * repeatedly because each plant-day has its own ledger key.
 */
export async function syncPlantReturns() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: null, amount: 0, days: 0 };

  const { data, error } = await supabase.rpc("claim_daily_income");
  if (error) {
    const message = rpcMessage(error) || "";
    if (/already|nothing|due/i.test(message)) return { error: null, amount: 0, days: 0 };
    return { error: message, amount: 0, days: 0 };
  }

  const payload = (typeof data === "string" ? JSON.parse(data) : data) as {
    ok?: boolean;
    amount?: number;
    days?: number;
  } | null;
  if (payload?.ok === false) return { error: null, amount: 0, days: 0 };

  const amount = Number(payload?.amount ?? 0);
  const days = Number(payload?.days ?? 0);
  if (amount > 0) {
    revalidatePath("/");
    revalidatePath("/orders");
    revalidatePath("/records");
    revalidatePath("/me");
  }
  return { error: null, amount, days };
}
