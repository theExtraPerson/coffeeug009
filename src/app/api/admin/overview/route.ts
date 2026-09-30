import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/admin-auth";

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error || !admin) return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(startOfDay.getTime() - 86_400_000);

  const count = async (table: string, build: (q: any) => any) => {
    const { count: n } = await build(admin.from(table).select("*", { count: "exact", head: true }));
    return n ?? 0;
  };

  const sum = async (table: string, column: string, build: (q: any) => any) => {
    const { data } = await build(admin.from(table).select(column));
    return (data ?? []).reduce(
      (total: number, row: Record<string, unknown>) => total + Number(row[column] ?? 0),
      0,
    );
  };

  const [
    totalUsers,
    usersToday,
    usersYesterday,
    pendingDeposits,
    pendingWithdrawals,
    approvedDeposits,
    paidWithdrawals,
    withdrawalFees,
    activePlants,
    plantVolume,
    dailyIncomePaid,
    commissionPaid,
  ] = await Promise.all([
    count("profiles", (q) => q),
    count("profiles", (q) => q.gte("created_at", startOfDay.toISOString())),
    count("profiles", (q) =>
      q.gte("created_at", yesterday.toISOString()).lt("created_at", startOfDay.toISOString()),
    ),
    count("payments", (q) => q.eq("type", "DEPOSIT").in("status", ["PENDING", "PROCESSING"])),
    count("payments", (q) => q.eq("type", "WITHDRAWAL").in("status", ["PENDING", "PROCESSING"])),
    sum("payments", "amount", (q) => q.eq("type", "DEPOSIT").eq("status", "SUCCESS")),
    sum("payments", "net_amount", (q) => q.eq("type", "WITHDRAWAL").eq("status", "SUCCESS")),
    sum("payments", "fee", (q) => q.eq("type", "WITHDRAWAL").eq("status", "SUCCESS")),
    count("orders", (q) => q.eq("status", "active")),
    sum("ledger_entries", "amount", (q) => q.eq("type", "purchase")),
    sum("ledger_entries", "amount", (q) => q.eq("type", "daily_income")),
    sum("ledger_entries", "amount", (q) => q.eq("type", "commission")),
  ]);

  // Total member liability is simply the sum of the ledger — the same number
  // every member's wallet is derived from.
  const walletLiability = await sum("ledger_entries", "amount", (q) => q);

  return NextResponse.json({
    totalUsers,
    usersToday,
    usersYesterday,
    pendingDeposits,
    pendingWithdrawals,
    approvedDeposits,
    paidWithdrawals,
    withdrawalFees,
    activePlants,
    // purchases are stored as negative ledger entries
    plantVolume: Math.abs(plantVolume),
    dailyIncomePaid,
    commissionPaid,
    walletLiability,
  });
}
