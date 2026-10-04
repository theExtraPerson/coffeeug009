"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  LayoutDashboard,
  Package,
  Settings,
  Share2,
  Shield,
  Sprout,
  Users,
} from "@/components/icons";
import { useIsAdmin, useSessionUser } from "@/hooks/use-app-data";
import { formatKampalaDate } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { AdminOrders } from "./orders-tab";
import { AdminPayments } from "./payments-tab";
import { AdminPlants } from "./plants-tab";
import { AdminReferrals } from "./referrals-tab";
import { AdminSettings } from "./settings-tab";
import { AdminUsers } from "./users-tab";
import { Stat } from "./shared";

type Tab =
  | "overview"
  | "deposits"
  | "withdrawals"
  | "users"
  | "referrals"
  | "activations"
  | "plants"
  | "admins"
  | "settings";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "deposits", label: "Deposits", icon: ArrowDownToLine },
  { id: "withdrawals", label: "Withdrawals", icon: ArrowUpFromLine },
  { id: "users", label: "Members", icon: Users },
  { id: "referrals", label: "Referrals", icon: Share2 },
  { id: "activations", label: "Activations", icon: Package },
  { id: "plants", label: "Plants", icon: Sprout },
  { id: "admins", label: "Admins", icon: Shield },
  { id: "settings", label: "Settings", icon: Settings },
];

type Overview = {
  totalUsers: number;
  usersToday: number;
  usersYesterday: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  approvedDeposits: number;
  paidWithdrawals: number;
  withdrawalFees: number;
  activePlants: number;
  plantVolume: number;
  dailyIncomePaid: number;
  commissionPaid: number;
  walletLiability: number;
};

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useSessionUser();
  const { data: isAdmin, isLoading: checking } = useIsAdmin(user?.id);
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    if (loading || checking) return;
    if (!user) router.replace("/login");
    else if (isAdmin === false) router.replace("/");
  }, [loading, checking, user, isAdmin, router]);

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    if (!res.ok) return;
    setOverview((await res.json()) as Overview);
  }, []);

  useEffect(() => {
    if (isAdmin) void loadOverview();
  }, [isAdmin, loadOverview]);

  if (loading || checking || !isAdmin) {
    return (
      <AppShell title="Admin" hideNav wide>
        <p className="px-4 py-6 text-sm text-muted-foreground">Checking access…</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin panel" back="/me" hideNav wide>
      <div className="sticky top-0 z-20 flex gap-2 overflow-x-auto bg-background/95 px-4 py-3 backdrop-blur">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-white transition-colors ${
              tab === id ? "bg-primary shadow-[inset_0_0_0_2px_#ffffff]" : "bg-[#14331f]"
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 pb-10">
        {tab === "overview" ? <OverviewTab overview={overview} onRefresh={loadOverview} /> : null}
        {tab === "deposits" ? <AdminPayments type="DEPOSIT" onChanged={loadOverview} /> : null}
        {tab === "withdrawals" ? <AdminPayments type="WITHDRAWAL" onChanged={loadOverview} /> : null}
        {tab === "users" ? <AdminUsers /> : null}
        {tab === "referrals" ? <AdminReferrals /> : null}
        {tab === "activations" ? <AdminOrders /> : null}
        {tab === "plants" ? <AdminPlants /> : null}
        {tab === "admins" ? <AdminsTab /> : null}
        {tab === "settings" ? <AdminSettings /> : null}
      </div>
    </AppShell>
  );
}

function OverviewTab({
  overview,
  onRefresh,
}: {
  overview: Overview | null;
  onRefresh: () => void;
}) {
  if (!overview) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Members
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Total" value={String(overview.totalUsers)} />
          <Stat label="Joined today" value={String(overview.usersToday)} accent />
          <Stat label="Yesterday" value={String(overview.usersYesterday)} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Needs attention
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Deposits in flight" value={String(overview.pendingDeposits)} />
          <Stat
            label="Withdrawals waiting"
            value={String(overview.pendingWithdrawals)}
            accent={overview.pendingWithdrawals > 0}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Money
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Deposits received" value={formatMoney(overview.approvedDeposits)} />
          <Stat label="Withdrawals paid" value={formatMoney(overview.paidWithdrawals)} />
          <Stat label="Fees collected" value={formatMoney(overview.withdrawalFees)} accent />
          <Stat label="Plant volume" value={formatMoney(overview.plantVolume)} />
          <Stat label="Returns paid out" value={formatMoney(overview.dailyIncomePaid)} />
          <Stat label="Commission paid" value={formatMoney(overview.commissionPaid)} />
        </div>
      </section>

      {/* The single number that matters: what every wallet adds up to. */}
      <section className="app-card p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Total member wallet balance
        </p>
        <p className="font-display text-3xl font-bold text-primary">
          {formatMoney(overview.walletLiability)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sum of every ledger entry across all members — what CoffeeUG currently owes.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Active plants" value={String(overview.activePlants)} />
          <Stat
            label="Net cash in"
            value={formatMoney(overview.approvedDeposits - overview.paidWithdrawals)}
          />
        </div>
      </section>

      <Button variant="secondary" className="w-full" onClick={onRefresh}>
        Refresh
      </Button>
    </div>
  );
}

function AdminsTab() {
  const [admins, setAdmins] = useState<
    { id: string; username: string | null; full_name: string | null; created_at: string }[]
  >([]);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/roles", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { admins: typeof admins };
    setAdmins(data.admins);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(grant: boolean, target?: string) {
    setBusy(true);
    const res = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(grant ? { username, grant: true } : { userId: target, grant: false }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not update");
      return;
    }
    toast.success(grant ? "Admin added" : "Admin removed");
    setUsername("");
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="app-card space-y-3 p-4">
        <Label htmlFor="admin-username">Grant admin by username</Label>
        <Input
          id="admin-username"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder="username"
        />
        <Button className="w-full" disabled={busy || !username} onClick={() => change(true)}>
          Make admin
        </Button>
      </div>

      <div className="app-card divide-y divide-border">
        {admins.map((row) => (
          <div key={row.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{row.full_name ?? "Member"}</p>
              <p className="truncate text-xs text-muted-foreground">
                @{row.username ?? "—"} · since {formatKampalaDate(row.created_at)}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => change(false, row.id)}
            >
              Remove
            </Button>
          </div>
        ))}
        {!admins.length ? (
          <p className="p-4 text-sm text-muted-foreground">No admins recorded.</p>
        ) : null}
      </div>
    </div>
  );
}