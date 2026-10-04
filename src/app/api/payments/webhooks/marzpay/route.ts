import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readMarzSnapshot } from "@/server/marzpay";
import { applyGatewayVerdict, findPaymentByReference } from "@/server/payments";

/**
 * MarzPay callback endpoint.
 *
 * Handles both shapes from the integration guide: a direct `callback_url` POST
 * starts at `event_type`, while a dashboard-registered webhook wraps the same
 * body under `data`. Always answers 200 quickly so MarzPay stops retrying.
 * A payout is verified only after an admin has approved it.
 */

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const snapshot = readMarzSnapshot(raw);
  if (!snapshot.references.length || snapshot.status === "PENDING") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  try {
    const admin = createAdminClient();
    let payment = null;
    for (const reference of snapshot.references) {
      payment = await findPaymentByReference(admin, reference);
      if (payment) break;
    }
    if (!payment) return NextResponse.json({ received: true }, { status: 200 });

    await applyGatewayVerdict(admin, payment, snapshot);
  } catch {
    // Never surface an error to MarzPay: a 500 only triggers more retries, and
    // the status poll will reconcile this payment anyway.
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "marzpay-webhook" });
}
