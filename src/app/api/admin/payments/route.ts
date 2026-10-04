import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/admin-auth";
import { dispatchWithdrawal, getPayment, settlePayment } from "@/server/payments";

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
 *   action "send"    the admin chose MarzPay: record that, then call MarzPay.
 *   action "approve" the admin chose manual and has sent the money. On a
 *                    deposit it credits the wallet.
 *   action "reject"  releases the reservation and returns the money.
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
      const existing = await getPayment(admin, body.paymentId);
      if (!existing) return jsonError("Payment not found", 404);
      if (existing.type !== "WITHDRAWAL") return jsonError("Not a withdrawal");
      if (existing.status === "PROCESSING") {
        return jsonError("MarzPay is already sending this withdrawal.");
      }
      if (existing.status !== "PENDING") return jsonError("This withdrawal is already finished.");

      const { error: modeError } = await admin
        .from("payments")
        .update({ mode: "MARZPAY", updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("status", "PENDING");
      if (modeError) return jsonError(modeError.message, 500);

      const payment = await dispatchWithdrawal(admin, body.paymentId, { approvedBy: user.id });
      return NextResponse.json({
        ok: true,
        status: payment.status,
        mode: payment.mode,
        failureReason: payment.failure_reason,
      });
    }

    if (body.action === "approve") {
      const existing = await getPayment(admin, body.paymentId);
      if (!existing) return jsonError("Payment not found", 404);
      if (existing.type === "WITHDRAWAL") {
        if (existing.status === "PROCESSING") {
          return jsonError("MarzPay is already sending this withdrawal.");
        }
        const { error: modeError } = await admin
          .from("payments")
          .update({ mode: "MANUAL", updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (modeError) return jsonError(modeError.message, 500);
      }
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
