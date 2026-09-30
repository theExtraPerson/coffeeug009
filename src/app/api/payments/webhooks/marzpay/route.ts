import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapMarzStatus } from "@/server/marzpay";
import { findPaymentByReference, settlePayment } from "@/server/payments";

/**
 * MarzPay callback endpoint.
 *
 * Handles both shapes from the integration guide: a direct `callback_url` POST
 * starts at `event_type`, while a dashboard-registered webhook wraps the same
 * body under `data`. Always answers 200 quickly so MarzPay stops retrying, and
 * leans on `settle_payment` for idempotency — the same reference may arrive
 * more than once.
 */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const outer = asRecord(raw);
  // Dashboard webhooks nest the real payload; direct callbacks do not.
  const body = outer.event_type ? outer : asRecord(outer.data);
  const eventType = firstString(body.event_type, outer.event_type) ?? "";
  const transaction = asRecord(body.transaction);
  const collection = asRecord(body.collection);
  const disbursement = asRecord(body.disbursement);

  // Our reference is `reference` on a collection and `provider_reference` on a
  // disbursement, where `reference` is MarzPay's own system UUID.
  const reference = firstString(
    transaction.provider_reference,
    transaction.reference,
    transaction.uuid,
  );
  if (!reference) return NextResponse.json({ received: true }, { status: 200 });

  const verdict = mapMarzStatus(
    firstString(transaction.status) ?? eventType.split(".").pop() ?? "",
  );
  if (verdict === "PENDING") return NextResponse.json({ received: true }, { status: 200 });

  try {
    const admin = createAdminClient();
    const payment =
      (await findPaymentByReference(admin, reference)) ??
      (transaction.uuid ? await findPaymentByReference(admin, String(transaction.uuid)) : null);
    if (!payment) return NextResponse.json({ received: true }, { status: 200 });

    const providerTx = firstString(
      collection.provider_transaction_id,
      disbursement.provider_transaction_id,
      transaction.uuid,
    );

    await settlePayment(admin, payment.id, verdict === "SUCCESSFUL", {
      reason:
        verdict === "FAILED"
          ? firstString(transaction.description) ?? `MarzPay reported ${eventType || "a failure"}.`
          : undefined,
      providerTx,
    });
  } catch {
    // Never surface an error to MarzPay: a 500 only triggers more retries, and
    // the status poll will reconcile this payment anyway.
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "marzpay-webhook" });
}
