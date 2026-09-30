"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Headphones,
  Info,
  Megaphone,
  Sprout,
  TrendingUp,
} from "@/components/icons";
import { AppShell, SectionTitle } from "@/components/app-shell";
import { BrandLockup } from "@/components/brand";
import { WelcomePopup } from "@/components/welcome-popup";
import { Button } from "@/components/ui/button";
import { useAppSettings, useEarnings, useProfile, useSessionUser } from "@/hooks/use-app-data";
import { formatMoney } from "@/lib/money";
import { timeUntil } from "@/lib/date";
import {
  DAILY_RATE_PERCENT,
  PROCESSING_PLANT_IMAGE,
  PROCESSING_PLANT_NAME,
  REFERRAL_RATES,
  TERM_DAYS,
  payoutClockLabel,
} from "@/lib/platform";

export default function HomePage() {
  const { user } = useSessionUser();
  const { data: profile } = useProfile(user?.id);
  const { data: earnings } = useEarnings(user?.id);
  const { data: settings } = useAppSettings();

  const signedIn = Boolean(user);
  const payoutLabel = payoutClockLabel(earnings?.payoutHour ?? settings?.payout_hour);

  return (
    <AppShell>
      {settings ? (
        <WelcomePopup
          message={settings.welcome_message}
          channelUrl={settings.telegram_channel_url}
          supportUrl={settings.telegram_support_url}
        />
      ) : null}

      {/* No banner: the page background's own glow is the decoration. */}
      <header className="px-6 pb-4 pt-7">
        <div className="flex items-center justify-between">
          <BrandLockup size={42} />
          <div className="flex items-center gap-2">
            <Link
              href={settings?.telegram_channel_url ?? "#"}
              target="_blank"
              aria-label="Telegram channel"
              className="app-panel p-2 text-muted-foreground hover:text-foreground"
            >
              <Megaphone className="size-4" />
            </Link>
            <Link
              href={settings?.telegram_support_url ?? "#"}
              target="_blank"
              aria-label="Telegram support"
              className="app-panel p-2 text-muted-foreground hover:text-foreground"
            >
              <Headphones className="size-4" />
            </Link>
          </div>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          {signedIn ? `Hello ${profile?.full_name ?? "Member"}` : "Uganda coffee, real income"}
        </p>
        <p className="font-display text-[28px] font-semibold leading-tight">
          Returns land at {payoutLabel} every day
        </p>
      </header>

      <div className="px-4">
        <div className="app-card p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Wallet balance
              </p>
              <p className="font-display text-3xl font-bold text-primary">
                {formatMoney(earnings?.balance ?? 0)}
              </p>
            </div>
            {earnings && earnings.reserved > 0 ? (
              <span className="chip chip-off">{formatMoney(earnings.reserved)} on hold</span>
            ) : null}
          </div>

          {signedIn && earnings ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label="Daily return" value={formatMoney(earnings.dailyRate)} />
              <MiniStat label="Active plants" value={String(earnings.activePlants)} />
              <MiniStat label="From team" value={formatMoney(earnings.referralEarned)} />
            </div>
          ) : null}

          {signedIn && earnings?.nextPayoutAt && earnings.activePlants > 0 ? (
            <p className="app-panel mt-3 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-primary">
              <Clock className="size-3.5" />
              Next return {timeUntil(earnings.nextPayoutAt)} · {payoutLabel} daily
            </p>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-2">
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
        </div>
      </div>

      {/* How it works, matching the four steps members already know. */}
      <section className="mt-6 px-4">
        <SectionTitle>How to earn with CoffeeUG</SectionTitle>
        <ol className="app-card divide-y divide-border">
          <Step n={1} title="Deposit to your wallet" body="Mobile money from MTN or Airtel, confirmed automatically." />
          <Step
            n={2}
            title="Choose an amount to process"
            body="Tap the processing plant and decide how much to invest. That amount leaves your wallet once."
          />
          <Step
            n={3}
            title={`Returns arrive at ${payoutLabel} daily`}
            body={`The plant pays ${DAILY_RATE_PERCENT}% of the amount you invested, every day after the coffee is processed and sold.`}
          />
          <Step
            n={4}
            title={`This runs for ${TERM_DAYS} days`}
            body="Withdraw any time the window is open, or process another batch."
          />
        </ol>
      </section>

      <section className="mt-6 px-4">
        <SectionTitle>Processing plant</SectionTitle>
        <Link href="/plants#invest" className="app-card block overflow-hidden">
          <img
            src={PROCESSING_PLANT_IMAGE}
            alt={PROCESSING_PLANT_NAME}
            width={1280}
            height={720}
            className="h-52 w-full object-cover"
          />
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <div>
              <h3 className="font-display text-base font-semibold">{PROCESSING_PLANT_NAME}</h3>
              <p className="text-xs text-muted-foreground">
                Invest any amount. {DAILY_RATE_PERCENT}% back at {payoutLabel}.
              </p>
            </div>
            <span className="chip chip-accent">PLANT</span>
          </div>
          <Button size="lg" className="h-12 w-full">
              Start the Coffee Processor
          </Button>
        </Link>
      </section>

      <section className="mt-6 px-4">
        <SectionTitle>Invite and earn</SectionTitle>
        <div className="app-card space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            When someone you invited activates a plant, you earn{" "}
            <span className="font-bold text-accent">{REFERRAL_RATES[0]}%</span> of it. Their own
            invites earn you <span className="font-bold text-accent">{REFERRAL_RATES[1]}%</span>.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/invite">
              <Button variant="accent" className="w-full">
                <TrendingUp className="size-4" />
                Get my link
              </Button>
            </Link>
            <Link href="/plants#invest">
              <Button variant="secondary" className="w-full">
                <Sprout className="size-4" />
                Process coffee
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 px-4 pb-4">
        <Link href="/about" className="app-card flex items-center gap-3 p-4">
          <Info className="size-5 text-accent" />
          <div className="flex-1">
            <p className="text-sm font-bold">About CoffeeUG</p>
            <p className="text-xs text-muted-foreground">
              Growing opportunities through coffee
            </p>
          </div>
        </Link>
      </section>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <div className="text-[10px] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-bold text-primary">{value}</div>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-3 p-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
        {n}
      </span>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}
