/**
 * Payment state machine. The `payments` table is the source of truth, never the
 * gateway response.
 *
 *   PENDING     row exists; for a withdrawal this alone reserves the funds
 *   PROCESSING  gateway accepted, still not final
 *   SUCCESS     exactly one settlement runs, writing the ledger entries
 *   FAILED      no ledger entry; a withdrawal reservation is released
 *   CANCELLED   terminal, same effect as failed
 *
 * Settlement is centralised in the `settle_payment` SQL function, which ignores
 * any payment already in a terminal state. That makes repeated webhooks, a
 * status poll racing a webhook, and an admin clicking twice all harmless.
 */

import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectProvider, toMsisdn } from "@/lib/phone";
import type { Payment } from "@/lib/types";
import {
  collectMoney,
  marzpayCallbackUrl,
  marzpayConfigured,
  sendMoney,
  transactionStatus,
} from "@/server/marzpay";

type Admin = ReturnType<typeof createAdminClient>;

export async function getPayment(admin: Admin, id: string): Promise<Payment | null> {
  const { data } = await admin.from("payments").select("*").eq("id", id).maybeSingle();
  return (data as Payment | null) ?? null;
}

/** Find a payment from a webhook that may quote either reference. */
export async function findPaymentByReference(
  admin: Admin,
  reference: string,
): Promise<Payment | null> {
  const { data } = await admin
    .from("payments")
    .select("*")
    .or(`external_reference.eq.${reference},provider_tx_uuid.eq.${reference}`)
    .limit(1)
    .maybeSingle();
  return (data as Payment | null) ?? null;
}

/**
 * The one place a payment becomes final. Writes the ledger for a success and
 * releases the reservation for a failure, both idempotently.
 */
export async function settlePayment(
  admin: Admin,
  paymentId: string,
  ok: boolean,
  options: { reason?: string; providerTx?: string; reviewer?: string } = {},
) {
  const { data, error } = await admin.rpc("settle_payment", {
    _payment_id: paymentId,
    _ok: ok,
    _reason: options.reason ?? null,
    _provider_tx: options.providerTx ?? null,
    _reviewer: options.reviewer ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; status?: string; reason?: string; balance?: number };
}

/* ---------- deposits (always automatic through MarzPay) ---------- */

export interface DepositResult {
  payment: Payment;
  /** True when MarzPay has pushed the prompt to the member's phone. */
  prompted: boolean;
  message: string;
}

export async function createDeposit(
  admin: Admin,
  userId: string,
  amount: number,
  phone: string,
): Promise<DepositResult> {
  const msisdn = toMsisdn(phone);
  if (!msisdn) throw new Error("Enter a valid Ugandan mobile number, for example 0771234567.");

  const { data: settingsRow } = await admin
    .from("app_settings")
    .select("deposit_min, deposit_max, frozen")
    .eq("id", 1)
    .maybeSingle();
  const min = Number(settingsRow?.deposit_min ?? 1000);
  const max = Number(settingsRow?.deposit_max ?? 10_000_000);
  if (settingsRow?.frozen) throw new Error("Deposits are temporarily paused.");
  if (!Number.isFinite(amount) || amount < min) {
    throw new Error(`Minimum deposit is UGX ${min.toLocaleString("en-UG")}.`);
  }
  if (amount > max) {
    throw new Error(`Maximum deposit is UGX ${max.toLocaleString("en-UG")}.`);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("is_banned")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.is_banned) throw new Error("This account cannot transact. Contact support.");

  // The row exists before the gateway is called, so a prompt that is approved
  // while our request times out still has a record to settle against.
  const reference = randomUUID();
  const { data: inserted, error: insertError } = await admin
    .from("payments")
    .insert({
      user_id: userId,
      type: "DEPOSIT",
      mode: "MARZPAY",
      status: "PENDING",
      provider: detectProvider(msisdn),
      amount: Math.round(amount),
      fee: 0,
      net_amount: Math.round(amount),
      phone_number: msisdn,
      external_reference: reference,
    })
    .select("*")
    .single();
  if (insertError) throw new Error(insertError.message);
  let payment = inserted as Payment;

  if (!marzpayConfigured()) {
    await admin
      .from("payments")
      .update({
        status: "FAILED",
        failure_reason: "MarzPay is not configured on this deployment.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);
    throw new Error("Mobile money is not available right now. Please contact support.");
  }

  try {
    const result = await collectMoney({
      amount: Math.round(amount),
      phone: msisdn,
      reference,
      description: "CoffeeUG wallet deposit",
      callbackUrl: marzpayCallbackUrl(),
    });
    const { data: updated } = await admin
      .from("payments")
      .update({
        provider_tx_uuid: result.providerTxUuid ?? null,
        provider_reference: result.providerReference ?? null,
        provider: result.network ?? payment.provider,
        status: result.status === "PENDING" ? "PROCESSING" : payment.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .select("*")
      .single();
    if (updated) payment = updated as Payment;

    // A create response is never a settlement, but MarzPay can occasionally
    // return a final verdict immediately.
    if (result.status === "SUCCESSFUL") {
      await settlePayment(admin, payment.id, true, { providerTx: result.providerTxUuid });
    } else if (result.status === "FAILED") {
      await settlePayment(admin, payment.id, false, { reason: "MarzPay rejected the collection." });
    }

    return {
      payment,
      prompted: true,
      message: "Check your phone and approve the mobile money prompt to complete the deposit.",
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "MarzPay error";
    await admin
      .from("payments")
      .update({ status: "FAILED", failure_reason: reason, updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    throw new Error(reason);
  }
}

/* ---------- withdrawals (automatic or admin-approved) ---------- */

/**
 * Hand a PENDING withdrawal to MarzPay. The reservation already exists, so a
 * gateway rejection releases it and the member's balance is untouched.
 */
export async function dispatchWithdrawal(admin: Admin, paymentId: string) {
  const payment = await getPayment(admin, paymentId);
  if (!payment) throw new Error("Withdrawal not found.");
  if (payment.type !== "WITHDRAWAL") throw new Error("Not a withdrawal.");
  if (payment.status !== "PENDING") return payment;

  if (!marzpayConfigured()) {
    // Fall back to the manual queue rather than failing the member's request.
    const { data } = await admin
      .from("payments")
      .update({ mode: "MANUAL", updated_at: new Date().toISOString() })
      .eq("id", payment.id)
      .select("*")
      .single();
    return (data as Payment) ?? payment;
  }

  try {
    const result = await sendMoney({
      // The member pays the 10% fee, so only the net amount is sent out.
      amount: Math.round(payment.net_amount),
      phone: payment.phone_number,
      reference: payment.external_reference,
      description: "CoffeeUG withdrawal",
      callbackUrl: marzpayCallbackUrl(),
    });
    const { data } = await admin
      .from("payments")
      .update({
        provider_tx_uuid: result.providerTxUuid ?? null,
        provider_reference: result.providerReference ?? null,
        provider: result.network ?? payment.provider,
        status: result.status === "PENDING" ? "PROCESSING" : payment.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .select("*")
      .single();

    if (result.status === "SUCCESSFUL") {
      await settlePayment(admin, payment.id, true, { providerTx: result.providerTxUuid });
    } else if (result.status === "FAILED") {
      await settlePayment(admin, payment.id, false, { reason: "MarzPay rejected the payout." });
    }
    return (data as Payment) ?? payment;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "MarzPay error";
    // Leave the money reserved and let an admin finish it by hand instead of
    // silently dropping the request.
    const { data } = await admin
      .from("payments")
      .update({
        mode: "MANUAL",
        failure_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .select("*")
      .single();
    return (data as Payment) ?? payment;
  }
}

/* ---------- status poll fallback ---------- */

export async function pollPayment(admin: Admin, payment: Payment): Promise<Payment> {
  if (payment.status !== "PENDING" && payment.status !== "PROCESSING") return payment;
  // Manual payouts are settled by a person, never by asking the gateway.
  if (payment.type === "WITHDRAWAL" && payment.mode === "MANUAL") return payment;
  if (!marzpayConfigured()) return payment;

  const reference = payment.provider_tx_uuid ?? payment.external_reference;
  const status = await transactionStatus(
    reference,
    payment.type === "DEPOSIT" ? "collect" : "disburse",
  );
  if (status === "SUCCESSFUL") {
    await settlePayment(admin, payment.id, true);
  } else if (status === "FAILED") {
    await settlePayment(admin, payment.id, false, { reason: "MarzPay reported a failure." });
  } else {
    return payment;
  }
  return (await getPayment(admin, payment.id)) ?? payment;
}
