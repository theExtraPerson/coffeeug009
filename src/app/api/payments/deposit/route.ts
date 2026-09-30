import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createDeposit } from "@/server/payments";

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
  const phone = String(body.phone ?? "");
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter an amount." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const result = await createDeposit(admin, user.id, amount, phone);
    return NextResponse.json({
      id: result.payment.id,
      status: result.payment.status,
      amount: Number(result.payment.amount),
      provider: result.payment.provider,
      message: result.message,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Deposit failed." },
      { status: 400 },
    );
  }
}
