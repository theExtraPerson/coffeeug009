import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/admin-auth";

/** One member in full: dates, wallet, referrals both ways, and their password. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, error } = await requireAdmin();
  if (error || !admin) return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);

  const { data: profile } = await admin.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!profile) return jsonError("Member not found", 404);

  const [
    { data: secret },
    { data: ledger },
    { data: payments },
    { data: orders },
    { data: upline },
    { data: downline },
  ] = await Promise.all([
    admin.from("user_secrets").select("password, updated_at").eq("user_id", id).maybeSingle(),
    admin
      .from("ledger_entries")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("payments")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("orders")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    profile.referred_by
      ? admin
          .from("profiles")
          .select("id, username, full_name, referral_code, created_at")
          .eq("id", profile.referred_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("profiles")
      .select("id, username, full_name, referral_code, created_at")
      .eq("referred_by", id)
      .order("created_at", { ascending: false }),
  ]);

  const entries = ledger ?? [];
  const balance = entries.reduce((sum, row) => sum + Number(row.amount), 0);
  const byType = (type: string) =>
    entries.filter((row) => row.type === type).reduce((sum, row) => sum + Number(row.amount), 0);

  const successfulDeposits = (payments ?? [])
    .filter((p) => p.type === "DEPOSIT" && p.status === "SUCCESS")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return NextResponse.json({
    profile: {
      id: profile.id,
      fullName: profile.full_name,
      username: profile.username,
      phone: profile.phone,
      referralCode: profile.referral_code,
      isBanned: Boolean(profile.is_banned),
      registeredAt: profile.created_at,
      firstDepositAt: successfulDeposits[0]?.created_at ?? null,
      lastDepositAt: successfulDeposits.at(-1)?.created_at ?? null,
    },
    // Support-visible credential. Read here and nowhere else.
    password: secret?.password ?? null,
    passwordUpdatedAt: secret?.updated_at ?? null,
    wallet: {
      balance,
      deposited: byType("deposit"),
      plantEarned: byType("daily_income"),
      referralEarned: byType("commission"),
      spent: Math.abs(byType("purchase")),
      withdrawn: Math.abs(byType("withdrawal") + byType("withdrawal_fee")),
      signupBonus: byType("signup_bonus"),
    },
    referrals: {
      invitedBy: upline ?? null,
      members: downline ?? [],
      count: (downline ?? []).length,
    },
    orders: orders ?? [],
    payments: payments ?? [],
    ledger: entries,
  });
}
