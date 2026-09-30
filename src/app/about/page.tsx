import type { Metadata } from "next";
import Link from "next/link";
import { AppShell, SectionTitle } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand";
import {
  ABOUT_MISSION,
  ABOUT_PARAGRAPHS,
  ABOUT_STRAPLINE,
  ABOUT_VISION,
  BRAND_NAME,
  BRAND_TAGLINE,
  COMPANY_NAME,
  DAILY_RATE_PERCENT,
  FOUNDED,
  REFERRAL_RATES,
  SUPPORT_HANDLE,
  TELEGRAM_CHANNEL_URL,
  TELEGRAM_SUPPORT_URL,
  TERM_DAYS,
  payoutClockLabel,
} from "@/lib/platform";

export const metadata: Metadata = {
  title: `About ${BRAND_NAME}`,
  description: ABOUT_PARAGRAPHS[0],
};

export default function AboutPage() {
  return (
    <AppShell title={`About ${BRAND_NAME}`} back="/">
      <div className="space-y-5 px-4 py-4">
        <div className="app-card flex flex-col items-center gap-2 p-6 text-center">
          <Logo size={88} />
          <p className="font-display text-2xl font-bold">{BRAND_NAME}</p>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {BRAND_TAGLINE}
          </p>
        </div>

        <section className="app-card space-y-3 p-4">
          {ABOUT_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </section>

        <section>
          <SectionTitle>Our vision</SectionTitle>
          <p className="app-card p-4 text-sm leading-relaxed text-muted-foreground">
            {ABOUT_VISION}
          </p>
        </section>

        <section>
          <SectionTitle>Our mission</SectionTitle>
          <p className="app-card p-4 text-sm leading-relaxed text-muted-foreground">
            {ABOUT_MISSION}
          </p>
        </section>

        <section>
          <SectionTitle>How earning works</SectionTitle>
          <dl className="app-card divide-y divide-border">
            <Fact term="Daily return" detail={`${DAILY_RATE_PERCENT}% of the amount you invest, every day`} />
            <Fact term="Term" detail={`${TERM_DAYS} days per plant`} />
            <Fact term="Payout time" detail={`${payoutClockLabel()} daily, Africa/Kampala`} />
            <Fact
              term="Referral commission"
              detail={`${REFERRAL_RATES[0]}% level 1 · ${REFERRAL_RATES[1]}% level 2`}
            />
            <Fact term="Registration bonus" detail="UGX 500 on your first sign-in" />
            <Fact term="Withdrawals" detail="From UGX 3,000, with a 10% fee" />
          </dl>
        </section>

        <section>
          <SectionTitle>Company</SectionTitle>
          <dl className="app-card divide-y divide-border">
            <Fact term="Registered name" detail={COMPANY_NAME} />
            <Fact term="Founded" detail={FOUNDED} />
            <Fact term="Market" detail="Uganda · UGX · MTN and Airtel mobile money" />
            <Fact term="Support" detail={SUPPORT_HANDLE} />
          </dl>
        </section>

        <p className="text-center font-display text-base font-bold text-accent">
          {ABOUT_STRAPLINE}
        </p>

        <div className="grid grid-cols-2 gap-2 pb-2">
          <a href={TELEGRAM_CHANNEL_URL} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="w-full">
              Channel
            </Button>
          </a>
          <a href={TELEGRAM_SUPPORT_URL} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="w-full">
              Support
            </Button>
          </a>
        </div>

        <Link href="/register">
          <Button size="lg" className="w-full">
            Create an account
          </Button>
        </Link>
      </div>
    </AppShell>
  );
}

function Fact({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {term}
      </dt>
      <dd className="text-right text-sm font-bold">{detail}</dd>
    </div>
  );
}
