import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/admin-auth";

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error || !admin) return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);

  const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  const ids = (roles ?? []).map((r) => r.user_id);
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, username, full_name, created_at").in("id", ids)
    : { data: [] };

  return NextResponse.json({ admins: profiles ?? [] });
}

/** Grant or revoke the admin role by username. */
export async function POST(request: Request) {
  const { admin, user, error } = await requireAdmin();
  if (error || !admin || !user) {
    return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);
  }

  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    userId?: string;
    grant?: boolean;
  };
  const grant = body.grant !== false;

  let targetId = body.userId ?? null;
  if (!targetId && body.username) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", body.username.trim())
      .maybeSingle();
    targetId = data?.id ?? null;
  }
  if (!targetId) return jsonError("Member not found", 404);

  // Guard against locking everyone out of the panel.
  if (!grant && targetId === user.id) {
    return jsonError("You cannot remove your own admin access");
  }

  if (grant) {
    const { error: insertError } = await admin
      .from("user_roles")
      .upsert({ user_id: targetId, role: "admin" }, { onConflict: "user_id,role" });
    if (insertError) return jsonError(insertError.message, 500);
  } else {
    const { error: deleteError } = await admin
      .from("user_roles")
      .delete()
      .eq("user_id", targetId)
      .eq("role", "admin");
    if (deleteError) return jsonError(deleteError.message, 500);
  }

  return NextResponse.json({ ok: true });
}
