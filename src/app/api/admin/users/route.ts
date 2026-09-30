import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/admin-auth";

/**
 * Member list for the admin panel. Includes the registration date, the first
 * and last deposit dates, the wallet balance derived from the ledger, the
 * upline, the downline count, and — because support needs it — the stored
 * password. `user_secrets` is service-role only, so this route is the single
 * place that value is ever readable.
 */
export async function GET(request: Request) {
  const { admin, error } = await requireAdmin();
  if (error || !admin) return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);

  const url = new URL(request.url);
  const search = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

  let query = admin
    .from("profiles")
    .select("id, full_name, username, phone, referral_code, referred_by, is_banned, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (search) {
    const safe = search.replace(/[%,]/g, "");
    query = query.or(
      `username.ilike.%${safe}%,full_name.ilike.%${safe}%,referral_code.ilike.%${safe}%,phone.ilike.%${safe}%`,
    );
  }

  const { data: profiles, error: queryError } = await query;
  if (queryError) return jsonError(queryError.message, 500);

  const ids = (profiles ?? []).map((p) => p.id);
  if (!ids.length) return NextResponse.json({ users: [] });

  const [{ data: ledger }, { data: deposits }, { data: secrets }, { data: uplines }, { data: roles }] =
    await Promise.all([
      admin.from("ledger_entries").select("user_id, amount, type").in("user_id", ids),
      admin
        .from("payments")
        .select("user_id, created_at, amount, status")
        .in("user_id", ids)
        .eq("type", "DEPOSIT")
        .eq("status", "SUCCESS")
        .order("created_at", { ascending: true }),
      admin.from("user_secrets").select("user_id, password").in("user_id", ids),
      admin
        .from("profiles")
        .select("id, username, full_name, referral_code")
        .in(
          "id",
          (profiles ?? []).map((p) => p.referred_by).filter((v): v is string => Boolean(v)),
        ),
      admin.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);

  const { data: downlines } = await admin.from("profiles").select("referred_by").in("referred_by", ids);

  const balanceOf = new Map<string, number>();
  const depositedOf = new Map<string, number>();
  const withdrawnOf = new Map<string, number>();
  for (const row of ledger ?? []) {
    const amount = Number(row.amount);
    balanceOf.set(row.user_id, (balanceOf.get(row.user_id) ?? 0) + amount);
    if (row.type === "deposit") {
      depositedOf.set(row.user_id, (depositedOf.get(row.user_id) ?? 0) + amount);
    }
    if (row.type === "withdrawal" || row.type === "withdrawal_fee") {
      withdrawnOf.set(row.user_id, (withdrawnOf.get(row.user_id) ?? 0) - amount);
    }
  }

  const firstDeposit = new Map<string, string>();
  const lastDeposit = new Map<string, string>();
  for (const row of deposits ?? []) {
    if (!firstDeposit.has(row.user_id)) firstDeposit.set(row.user_id, row.created_at);
    lastDeposit.set(row.user_id, row.created_at);
  }

  const passwordOf = new Map((secrets ?? []).map((s) => [s.user_id, s.password]));
  const uplineOf = new Map((uplines ?? []).map((u) => [u.id, u]));
  const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));

  const referralCount = new Map<string, number>();
  for (const row of downlines ?? []) {
    if (!row.referred_by) continue;
    referralCount.set(row.referred_by, (referralCount.get(row.referred_by) ?? 0) + 1);
  }

  const users = (profiles ?? []).map((p) => {
    const upline = p.referred_by ? uplineOf.get(p.referred_by) : null;
    return {
      id: p.id,
      fullName: p.full_name,
      username: p.username,
      phone: p.phone,
      referralCode: p.referral_code,
      isBanned: Boolean(p.is_banned),
      isAdmin: adminIds.has(p.id),
      registeredAt: p.created_at,
      firstDepositAt: firstDeposit.get(p.id) ?? null,
      lastDepositAt: lastDeposit.get(p.id) ?? null,
      balance: balanceOf.get(p.id) ?? 0,
      totalDeposited: depositedOf.get(p.id) ?? 0,
      totalWithdrawn: withdrawnOf.get(p.id) ?? 0,
      referralCount: referralCount.get(p.id) ?? 0,
      invitedBy: upline
        ? {
            username: upline.username,
            fullName: upline.full_name,
            referralCode: upline.referral_code,
          }
        : null,
      password: passwordOf.get(p.id) ?? null,
    };
  });

  return NextResponse.json({ users });
}

/** Ban or unban a member. A banned account cannot buy, claim, or withdraw. */
export async function POST(request: Request) {
  const { admin, error } = await requireAdmin();
  if (error || !admin) return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    isBanned?: boolean;
  };
  if (!body.userId) return jsonError("Missing user");

  const { error: updateError } = await admin
    .from("profiles")
    .update({ is_banned: Boolean(body.isBanned) })
    .eq("id", body.userId);
  if (updateError) return jsonError(updateError.message, 500);

  return NextResponse.json({ ok: true });
}
