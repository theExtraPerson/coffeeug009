import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/admin-auth";

/** Every plant activation, with its member and both notes. */
export async function GET(request: Request) {
  const { admin, error } = await requireAdmin();
  if (error || !admin) return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const status = url.searchParams.get("status");
  const limit = Math.min(300, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));

  let query = admin
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (userId) query = query.eq("user_id", userId);
  if (status) query = query.eq("status", status);

  const { data: orders, error: queryError } = await query;
  if (queryError) return jsonError(queryError.message, 500);

  const ids = [...new Set((orders ?? []).map((o) => o.user_id))];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, username, full_name").in("id", ids)
    : { data: [] };
  const memberOf = new Map((profiles ?? []).map((p) => [p.id, p]));

  return NextResponse.json({
    orders: (orders ?? []).map((o) => ({ ...o, member: memberOf.get(o.user_id) ?? null })),
  });
}

/** Attach or edit the private admin note on an activation. */
export async function PATCH(request: Request) {
  const { admin, error } = await requireAdmin();
  if (error || !admin) return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);

  const body = (await request.json().catch(() => ({}))) as {
    orderId?: string;
    adminNote?: string;
  };
  if (!body.orderId) return jsonError("Missing order");

  const { error: updateError } = await admin
    .from("orders")
    .update({ admin_note: (body.adminNote ?? "").trim() || null })
    .eq("id", body.orderId);
  if (updateError) return jsonError(updateError.message, 500);

  return NextResponse.json({ ok: true });
}
