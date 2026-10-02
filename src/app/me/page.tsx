"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  Headphones,
  History,
  Info,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Share2,
} from "@/components/icons";
import { Logo } from "@/components/brand";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import {
  useAppSettings,
  useEarnings,
  useIsAdmin,
  useProfile,
  useSessionUser,
  useTeamStats,
} from "@/hooks/use-app-data";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { formatKampalaDate } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { COMPANY_NAME, FOUNDED, SUPPORT_HANDLE } from "@/lib/platform";

export default function MePage() {
  const router = useRouter();
  const { user } = useSessionUser();
  const { data: profile } = useProfile(user?.id);
  const { data: earnings } = useEarnings(user?.id);
  const { data: team } = useTeamStats(user?.id);
  const fromTeam = team?.total_earned ?? earnings?.referralEarned ?? 0;
  const level1 = team?.levels.find((level) => level.level === 1);
  const level2 = team?.levels.find((level) => level.level === 2);
  const { data: settings } = useAppSettings();
  const { data: isAdmin } = useIsAdmin(user?.id);
  const { install } = usePwaInstall();

  async function signOut() {
    if (!supabaseConfigured()) return;
    await createClient().auth.signOut();
    toast.success("Signed out");
    router.replace("/login");
    router.refresh();
  }

  return (
    <AppShell title="My account">
      <div className="space-y-4 px-4 py-4">
        <div className="app-card flex items-center gap-3 p-4">
          <Logo size={52} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold">
              {profile?.full_name ?? "Member"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              @{profile?.username ?? "—"} · code {profile?.referral_code ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              Joined {formatKampalaDate(profile?.created_at)}
            </p>
          </div>
        </div>

        <div className="app-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Wallet balance
          </p>
          <p className="font-display text-3xl font-bold text-primary">
            {formatMoney(earnings?.balance ?? 0)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Tile label="From plants" value={formatMoney(earnings?.plantEarned ?? 0)} />
            <Link href="/team" className="stat-tile block">
              <div className="text-[10px] font-semibold text-muted-foreground">From team</div>
              <div className="mt-0.5 truncate text-sm font-bold text-primary">
                {formatMoney(fromTeam)}
              </div>
            </Link>
            <Tile label="Deposited" value={formatMoney(earnings?.totalDeposited ?? 0)} />
            <Tile label="Withdrawn" value={formatMoney(earnings?.totalWithdrawn ?? 0)} />
          </div>
          <Link href="/team" className="mt-3 block text-xs text-muted-foreground">
            {team?.total_members ?? 0} members registered
            {" · "}
            Level 1 · {level1?.members ?? 0} · {formatMoney(level1?.earned ?? 0)}
            {" · "}
            Level 2 · {level2?.members ?? 0} · {formatMoney(level2?.earned ?? 0)}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link href="/deposit">
            <Button className="w-full" size="lg">
              <ArrowDownToLine className="size-4" />
              Deposit
            </Button>
          </Link>
          <Link href="/withdraw">
            <Button variant="outline" className="w-full" size="lg">
              <ArrowUpFromLine className="size-4" />
              Withdraw
            </Button>
          </Link>
        </div>

        <nav className="app-card divide-y divide-border">
          <Item href="/orders" icon={Package} label="My plants" hint="Progress and returns" />
          <Item href="/records" icon={History} label="Records" hint="Wallet, deposits, withdrawals" />
          <Item href="/invite" icon={Share2} label="Invite friends" hint="Your code and link" />
          <Item href="/about" icon={Info} label="About CoffeeUG" hint={`${COMPANY_NAME} · since ${FOUNDED}`} />
          {isAdmin ? (
            <Item href="/admin" icon={LayoutDashboard} label="Admin panel" hint="Manage the platform" />
          ) : null}
        </nav>

        <nav className="app-card divide-y divide-border">
          <External
            href={settings?.telegram_channel_url ?? "#"}
            icon={Megaphone}
            label="Telegram channel"
            hint="Announcements and updates"
          />
          <External
            href={settings?.telegram_support_url ?? "#"}
            icon={Headphones}
            label="Customer support"
            hint={SUPPORT_HANDLE}
          />
          <button
            type="button"
            onClick={() => void install()}
            className="flex w-full items-center gap-3 p-4 text-left"
          >
            <Download className="size-5 text-accent" />
            <span className="flex-1">
              <span className="block text-sm font-bold">Download the app</span>
              <span className="block text-xs text-muted-foreground">
                Install CoffeeUG on your home screen
              </span>
            </span>
          </button>
        </nav>

        <Button variant="secondary" size="lg" className="w-full" onClick={signOut}>
          <LogOut className="size-4" />
          Sign out
        </Button>

        <p className="pb-2 text-center text-xs text-muted-foreground">
          {COMPANY_NAME} · Founded {FOUNDED}
        </p>
      </div>
    </AppShell>
  );
}

function Item({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 p-4">
      <Icon className="size-5 text-accent" />
      <span className="flex-1">
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </Link>
  );
}

function External({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4">
      <Icon className="size-5 text-accent" />
      <span className="flex-1">
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </a>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <div className="text-[10px] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-bold text-primary">{value}</div>
    </div>
  );
}
