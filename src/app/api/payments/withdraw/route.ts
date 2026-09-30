import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { detectProvider, toMsisdn } from "@/lib/phone";
import { dispatchWithdrawal } from "@/server/payments";

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

  // The RPC runs as the signed-in member: it validates the window, the limits,
  // and the available balance, then reserves the funds by creating the row.
  const { data, error } = await supabase.rpc("request_withdrawal", {
    _amount: amount,
    _phone: msisdn,
    _provider: detectProvider(msisdn),
    _reference: null,
  });
  if (error) {
    return NextResponse.json(
      { error: error.message.replace(/^.*?:\s*/, "") },
      { status: 400 },
    );
  }

  const created = data as { payment_id: string; mode: string; fee: number; net: number };

  if (created.mode === "MARZPAY") {
    try {
      const admin = createAdminClient();
      const payment = await dispatchWithdrawal(admin, created.payment_id);
      return NextResponse.json({
        id: created.payment_id,
        status: payment.status,
        mode: payment.mode,
        fee: Number(created.fee),
        net: Number(created.net),
        message:
          payment.mode === "MANUAL"
            ? "Your withdrawal is queued for review and will be sent shortly."
            : "Withdrawal sent. The money will reach your phone shortly.",
      });
    } catch (err) {
      // The reservation stands; an admin can still complete it.
      return NextResponse.json({
        id: created.payment_id,
        status: "PENDING",
        mode: "MANUAL",
        fee: Number(created.fee),
        net: Number(created.net),
        message: "Your withdrawal is queued for review.",
        warning: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return NextResponse.json({
    id: created.payment_id,
    status: "PENDING",
    mode: "MANUAL",
    fee: Number(created.fee),
    net: Number(created.net),
    message: "Your withdrawal is queued for review and will be sent shortly.",
  });
}
