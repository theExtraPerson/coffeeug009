import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/admin-auth";

/**
 * Signed wallet correction. Appends an `adjustment` entry rather than editing
 * any history, so the member's balance stays the sum of an auditable log.
 */
export async function POST(request: Request) {
  const { admin, error } = await requireAdmin();
  if (error || !admin) return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    amount?: unknown;
    note?: string;
  };
  const amount = Number(body.amount);
  if (!body.userId) return jsonError("Missing member");
  if (!Number.isFinite(amount) || amount === 0) return jsonError("Enter an amount");

  const { data, error: rpcError } = await admin.rpc("admin_adjust_wallet", {
    _user: body.userId,
    _amount: amount,
    _note: body.note?.trim() || null,
  });
  if (rpcError) return jsonError(rpcError.message.replace(/^.*?:\s*/, ""), 400);

  return NextResponse.json(data);
}
