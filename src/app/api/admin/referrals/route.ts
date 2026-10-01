import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/admin-auth";
import { loadReferralSnapshot } from "@/server/referrals";

/** Platform-wide view of who used which code, and what each level was paid. */
export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error || !admin) return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);

  try {
    const snapshot = await loadReferralSnapshot(admin);
    return NextResponse.json(snapshot);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Could not load referrals", 500);
  }
}
