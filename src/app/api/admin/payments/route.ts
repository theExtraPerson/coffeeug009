import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/admin-auth";
import { dispatchWithdrawal, settlePayment } from "@/server/payments";

/** Deposit and withdrawal queues, newest first. */
export async function GET(request: Request) {
  const { admin, error } = await requireAdmin();
  if (error || !admin) return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);

  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "WITHDRAWAL" ? "WITHDRAWAL" : "DEPOSIT";
  const status = url.searchParams.get("status");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));

  let query = admin
    .from("payments")
    .select("*")
    .eq("type", type)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status === "pending") query = query.in("status", ["PENDING", "PROCESSING"]);
  else if (status) query = query.eq("status", status);

  const { data: payments, error: queryError } = await query;
  if (queryError) return jsonError(queryError.message, 500);

  const ids = [...new Set((payments ?? []).map((p) => p.user_id))];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, username, full_name, phone").in("id", ids)
    : { data: [] };
  const memberOf = new Map((profiles ?? []).map((p) => [p.id, p]));

  return NextResponse.json({
    payments: (payments ?? []).map((p) => ({
      ...p,
      member: memberOf.get(p.user_id) ?? null,
    })),
  });
}

/**
 * Admin review of a payment.
 *
 *   action "approve" on a MANUAL withdrawal settles the ledger debit.
 *   action "send"    hands a held withdrawal to MarzPay instead of paying by hand.
 *   action "reject"  releases the reservation and returns the money.
 *   action "approve" on a deposit credits a payment confirmed out of band.
 *   action "note"    records an admin note without changing the status.
 */
export async function POST(request: Request) {
  const { admin, user, error } = await requireAdmin();
  if (error || !admin || !user) {
    return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);
  }

  const body = (await request.json().catch(() => ({}))) as {
    paymentId?: string;
    action?: "approve" | "reject" | "send" | "note";
    note?: string;
  };
  if (!body.paymentId || !body.action) return jsonError("Missing payment or action");

  if (body.note !== undefined) {
    await admin
      .from("payments")
      .update({ admin_note: body.note.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", body.paymentId);
  }
  if (body.action === "note") return NextResponse.json({ ok: true });

  try {
    if (body.action === "send") {
      const payment = await dispatchWithdrawal(admin, body.paymentId);
      return NextResponse.json({ ok: true, status: payment.status, mode: payment.mode });
    }

    const result = await settlePayment(admin, body.paymentId, body.action === "approve", {
      reason: body.action === "reject" ? body.note?.trim() || "Rejected by admin" : undefined,
      reviewer: user.id,
    });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Could not update this payment", 500);
  }
}
