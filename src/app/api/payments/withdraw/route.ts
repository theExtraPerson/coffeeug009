import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { detectProvider, toMsisdn } from "@/lib/phone";
import type { PaymentMode } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  let body: { amount?: unknown; phone?: unknown; mode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const amount = Math.round(Number(body.amount));
  const msisdn = toMsisdn(String(body.phone ?? ""));
  const mode: PaymentMode = body.mode === "MANUAL" ? "MANUAL" : "MARZPAY";
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter an amount." }, { status: 400 });
  }
  if (!msisdn) {
    return NextResponse.json(
      { error: "Enter the phone number to receive the money, for example 0771234567." },
      { status: 400 },
    );
  }

  // The RPC reserves the funds. It does not send money. MarzPay is called only
  // after an admin approves a MarzPay withdrawal.
  let createdResult = await supabase.rpc("request_withdrawal", {
    _amount: amount,
    _phone: msisdn,
    _provider: detectProvider(msisdn),
    _reference: null,
    _mode: mode,
  });
  if (
    createdResult.error &&
    /schema cache|could not find the function|pgrst202/i.test(createdResult.error.message)
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

  const created = createdResult.data as {
    payment_id: string;
    mode: string;
    fee: number;
    net: number;
  };

  const admin = createAdminClient();
  await admin
    .from("payments")
    .update({ mode, updated_at: new Date().toISOString() })
    .eq("id", created.payment_id)
    .eq("status", "PENDING");

  return NextResponse.json({
    id: created.payment_id,
    status: "PENDING",
    mode,
    fee: Number(created.fee),
    net: Number(created.net),
    message:
      mode === "MANUAL"
        ? "Request received. An admin will send the money to your phone."
        : "Request received. An admin will approve it before MarzPay sends the money.",
  });
}
