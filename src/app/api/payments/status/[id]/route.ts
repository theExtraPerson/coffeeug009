import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPayment, pollPayment } from "@/server/payments";

/** Status poll used by the deposit screen while the member approves the prompt. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const admin = createAdminClient();
  const existing = await getPayment(admin, id);
  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const payment = await pollPayment(admin, existing);
  return NextResponse.json({
    id: payment.id,
    type: payment.type,
    status: payment.status,
    mode: payment.mode,
    amount: Number(payment.amount),
    fee: Number(payment.fee),
    net: Number(payment.net_amount),
    provider: payment.provider,
    failureReason: payment.failure_reason,
  });
}
