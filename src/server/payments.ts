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
import { MAX_DEPOSIT, MIN_DEPOSIT } from "@/lib/platform";
import { PAYMENT_REVIEW_PREFIX, type Payment } from "@/lib/types";
import {
  collectMoney,
  marzpayCallbackUrl,
  marzpayConfigured,
  sendMoney,
  transactionStatus,
  type MarzSnapshot,
} from "@/server/marzpay";

type Admin = ReturnType<typeof createAdminClient>;

export async function getPayment(admin: Admin, id: string): Promise<Payment | null> {
  const { data } = await admin.from("payments").select("*").eq("id", id).maybeSingle();
  return (data as Payment | null) ?? null;
}

/** Find a payment from a webhook that may quote any of the three references. */
export async function findPaymentByReference(
  admin: Admin,
  reference: string,
): Promise<Payment | null> {
  const trimmed = reference.trim();
  if (!trimmed) return null;
  for (const column of ["external_reference", "provider_tx_uuid", "provider_reference"] as const) {
    const { data } = await admin.from("payments").select("*").eq(column, trimmed).maybeSingle();
    if (data) return data as Payment;
  }
  return null;
}

/**
 * Checks that must all pass before a payment is verified. A missing amount or
 * phone is not a failure; a value that disagrees with the row is.
 */
export function paymentReviewIssues(payment: Payment, verdict: MarzSnapshot): string[] {
  const issues: string[] = [];
  const refs = verdict.references.map((ref) => ref.trim()).filter(Boolean);
  const known = [payment.external_reference, payment.provider_tx_uuid, payment.provider_reference]
    .filter((value): value is string => Boolean(value));
  if (refs.length && !refs.some((ref) => known.includes(ref))) {
    issues.push("the gateway reference does not match this payment");
  }

  if (verdict.kind) {
    const expected = payment.type === "DEPOSIT" ? "collect" : "disburse";
    if (verdict.kind !== expected) issues.push("the event type does not match this payment");
  }

  // Deposits credit the amount the member asked for. MarzPay often reports a
  // different figure (a 5,000 deposit can come back as 5,150), and that must
  // not block an automatic credit.
  if (payment.type !== "DEPOSIT" && verdict.amount != null && Number.isFinite(verdict.amount)) {
    const expectedAmount = Number(payment.net_amount);
    if (Math.round(verdict.amount) !== Math.round(expectedAmount)) {
      issues.push(
        `the amount ${Math.round(verdict.amount)} does not match ${Math.round(expectedAmount)}`,
      );
    }
  }

  if (verdict.phone) {
    const incoming = toMsisdn(verdict.phone);
    const stored = toMsisdn(payment.phone_number);
    if (!incoming) issues.push("the phone number could not be read");
    else if (stored && incoming !== stored) issues.push("the phone number does not match");
  }

  return issues;
}

/**
 * Verify a gateway result. A confirmed deposit is credited automatically.
 * A withdrawal is credited only after an admin has approved a MarzPay payout.
 */
export async function applyGatewayVerdict(
  admin: Admin,
  payment: Payment,
  verdict: MarzSnapshot,
): Promise<Payment> {
  if (payment.status !== "PENDING" && payment.status !== "PROCESSING") return payment;

  // A withdrawal is never verified from the gateway until an admin has approved
  // a MarzPay payout. Manual withdrawals are settled only when an admin marks
  // them paid. A gateway problem after approval goes back to the queue.
  if (payment.type === "WITHDRAWAL") {
    if (payment.mode !== "MARZPAY" || !payment.reviewed_by) return payment;
    if (verdict.missing || verdict.status === "PENDING") return payment;

    const issues = paymentReviewIssues(payment, verdict);
    if (verdict.status === "SUCCESSFUL" && issues.length === 0) {
      if (payment.admin_note?.startsWith(PAYMENT_REVIEW_PREFIX)) {
        await admin
          .from("payments")
          .update({ admin_note: null, updated_at: new Date().toISOString() })
          .eq("id", payment.id);
      }
      await settlePayment(admin, payment.id, true, { providerTx: verdict.providerTx });
      return (await getPayment(admin, payment.id)) ?? payment;
    }

    const reason = (
      issues.join("; ") ||
      (verdict.description
        ? `MarzPay reported a failure: ${verdict.description}`
        : "MarzPay reported a failure")
    ).slice(0, 500);
    const { data } = await admin
      .from("payments")
      .update({
        status: "PENDING",
        failure_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .select("*")
      .single();
    return (data as Payment) ?? payment;
  }

  // Deposits are automatic. A MarzPay success credits the wallet. A MarzPay
  // failure closes the attempt. Neither writes a review note.
  if (verdict.missing || verdict.status === "PENDING") return payment;

  if (payment.admin_note?.startsWith(PAYMENT_REVIEW_PREFIX)) {
    await admin
      .from("payments")
      .update({ admin_note: null, failure_reason: null, updated_at: new Date().toISOString() })
      .eq("id", payment.id);
  }

  if (verdict.status === "SUCCESSFUL") {
    await settlePayment(admin, payment.id, true, { providerTx: verdict.providerTx });
    return (await getPayment(admin, payment.id)) ?? payment;
  }

  if (verdict.status === "FAILED") {
    await settlePayment(admin, payment.id, false, {
      reason: "The deposit was not completed.",
      providerTx: verdict.providerTx,
    });
    return (await getPayment(admin, payment.id)) ?? payment;
  }

  return payment;
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
  const min = Math.max(Number(settingsRow?.deposit_min ?? MIN_DEPOSIT), MIN_DEPOSIT);
  const max = Number(settingsRow?.deposit_max ?? MAX_DEPOSIT);
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

/* ---------- withdrawals (always admin-approved) ---------- */

/**
 * Send an approved MarzPay withdrawal. Refuses unless an admin has approved it,
 * and never runs for a manual payout. The member's choice of channel is left
 * unchanged: a gateway error keeps the MarzPay flag and returns the row to the queue.
 */
export async function dispatchWithdrawal(
  admin: Admin,
  paymentId: string,
  options: { approvedBy?: string } = {},
) {
  const payment = await getPayment(admin, paymentId);
  if (!payment) throw new Error("Withdrawal not found.");
  if (payment.type !== "WITHDRAWAL") throw new Error("Not a withdrawal.");
  if (payment.mode !== "MARZPAY") {
    throw new Error("This withdrawal is manual. Send the money yourself, then mark it paid.");
  }
  if (payment.status !== "PENDING") return payment;

  const approver = payment.reviewed_by ?? options.approvedBy;
  if (!approver) {
    throw new Error("An admin must approve this withdrawal before MarzPay can send it.");
  }
  if (!marzpayConfigured()) {
    throw new Error("MarzPay is not configured. Pay this withdrawal manually, or reject it.");
  }

  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("payments")
    .update({
      reviewed_by: approver,
      reviewed_at: payment.reviewed_at ?? now,
      status: "PROCESSING",
      failure_reason: null,
      updated_at: now,
    })
    .eq("id", payment.id)
    .eq("status", "PENDING")
    .select("*")
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!claimed) return (await getPayment(admin, payment.id)) ?? payment;

  let current = claimed as Payment;

  try {
    const result = await sendMoney({
      // The member pays the withdrawal fee, so only the net amount is sent out.
      amount: Math.round(current.net_amount),
      phone: current.phone_number,
      reference: current.external_reference,
      description: "CoffeeUG withdrawal",
      callbackUrl: marzpayCallbackUrl(),
    });
    const { data } = await admin
      .from("payments")
      .update({
        provider_tx_uuid: result.providerTxUuid ?? null,
        provider_reference: result.providerReference ?? null,
        provider: result.network ?? current.provider,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id)
      .select("*")
      .single();
    if (data) current = data as Payment;

    if (result.status === "SUCCESSFUL") {
      return applyGatewayVerdict(admin, current, {
        status: "SUCCESSFUL",
        references: [current.external_reference, result.providerTxUuid, result.providerReference].filter(
          (value): value is string => Boolean(value),
        ),
        kind: "disburse",
        providerTx: result.providerTxUuid,
      });
    }
    if (result.status === "FAILED") {
      const { data: held } = await admin
        .from("payments")
        .update({
          status: "PENDING",
          failure_reason: "MarzPay rejected the payout.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id)
        .select("*")
        .single();
      return (held as Payment) ?? current;
    }
    return current;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "MarzPay error";
    const { data } = await admin
      .from("payments")
      .update({
        status: "PENDING",
        failure_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id)
      .eq("status", "PROCESSING")
      .select("*")
      .single();
    return (data as Payment) ?? current;
  }
}

/* ---------- status poll fallback ---------- */

export async function pollPayment(admin: Admin, payment: Payment): Promise<Payment> {
  if (payment.status !== "PENDING" && payment.status !== "PROCESSING") return payment;
  // Manual payouts, and MarzPay payouts still waiting for an admin, are never
  // asked of the gateway.
  if (payment.type === "WITHDRAWAL") {
    if (payment.mode !== "MARZPAY" || !payment.reviewed_by || !payment.provider_tx_uuid) {
      return payment;
    }
  }
  if (!marzpayConfigured()) return payment;

  const reference = payment.provider_tx_uuid ?? payment.external_reference;
  const snapshot = await transactionStatus(
    reference,
    payment.type === "DEPOSIT" ? "collect" : "disburse",
  );
  return applyGatewayVerdict(admin, payment, snapshot);
}
