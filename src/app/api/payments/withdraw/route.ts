import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { detectProvider, toMsisdn } from "@/lib/phone";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  let body: { amount?: unknown; phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const amount = Math.round(Number(body.amount));
  const msisdn = toMsisdn(String(body.phone ?? ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter an amount." }, { status: 400 });
  }
  if (!msisdn) {
    return NextResponse.json(
      { error: "Enter the phone number to receive the money, for example 0771234567." },
      { status: 400 },
    );
  }

  // The member only reserves the money. The admin chooses MarzPay or a manual
  // payout when they review the request.
  let createdResult = await supabase.rpc("request_withdrawal", {
    _amount: amount,
    _phone: msisdn,
    _provider: detectProvider(msisdn),
    _reference: null,
    _mode: "UNASSIGNED",
  });
  if (
    createdResult.error &&
    /schema cache|could not find the function|pgrst202|withdrawals_mode|payments_mode/i.test(
      createdResult.error.message,
    )
  ) {
    createdResult = await supabase.rpc("request_withdrawal", {
      _amount: amount,
      _phone: msisdn,
      _provider: detectProvider(msisdn),
      _reference: null,
    });
  }
  if (createdResult.error) {
    return NextResponse.json(
      { error: createdResult.error.message.replace(/^.*?:\s*/, "") },
      { status: 400 },
    );
  }

  const created = createdResult.data as { payment_id: string; fee: number; net: number };

  const admin = createAdminClient();
  await admin
    .from("payments")
    .update({ mode: "UNASSIGNED", updated_at: new Date().toISOString() })
    .eq("id", created.payment_id)
    .eq("status", "PENDING");

  return NextResponse.json({
    id: created.payment_id,
    status: "PENDING",
    fee: Number(created.fee),
    net: Number(created.net),
    message: "Request received. An admin will review it and send the money to your phone.",
  });
}
