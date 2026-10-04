"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand";
import { applyInviteCode } from "@/app/actions";
import { rememberInvite } from "@/lib/invite";
import { useSessionUser } from "@/hooks/use-app-data";
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  DAILY_RATE_PERCENT,
  REFERRAL_RATES,
  SIGNUP_BONUS,
  TERM_DAYS,
  payoutClockLabel,
} from "@/lib/platform";
import { formatMoney } from "@/lib/money";

export function InviteLanding({
  code,
  inviterName,
}: {
  code: string;
  inviterName: string | null;
}) {
  const router = useRouter();
  const { user, loading } = useSessionUser();

  // Remember the code immediately: the visitor may register minutes later, or
  // sign in on a different screen, and the upline must still be attached.
  useEffect(() => {
    if (code) rememberInvite(code);
  }, [code]);

  // A member who is already signed in gets linked right here.
  useEffect(() => {
    if (loading || !user || !code) return;
    void applyInviteCode(code).then((result) => {
      if (result.linked) toast.success(`You joined ${inviterName ?? "your inviter"}'s team`);
      router.replace("/");
    });
  }, [loading, user, code, inviterName, router]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[560px]">
        <div className="flex flex-col items-center gap-2 px-6 pb-4 pt-10">
          <Logo size={88} className="shadow-lift" />
          <span className="font-display text-2xl font-semibold">{BRAND_NAME}</span>
          <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            {BRAND_TAGLINE}
          </span>
        </div>

        <div className="app-card mx-4 mb-16 space-y-4 p-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {inviterName ? `${inviterName} invited you to` : "You have been invited to"}
            </p>
            <p className="font-display text-xl font-semibold">{BRAND_NAME}</p>
          </div>

          {code ? (
            <div className="app-panel p-4 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Your referral code
              </p>
              <p className="font-display text-3xl font-bold tracking-[0.2em] text-primary">
                {code}
              </p>
            </div>
          ) : (
            <p className="app-panel p-4 text-center text-sm text-muted-foreground">
              That invite code is not valid, but you can still create an account.
            </p>
          )}

          <ul className="space-y-2 text-sm text-muted-foreground">
            <Bullet>
              Get <span className="font-bold text-accent">{formatMoney(SIGNUP_BONUS)}</span> the
              moment you register.
            </Bullet>
            <Bullet>
              Activate a processing plant and earn{" "}
              <span className="font-bold text-accent">{DAILY_RATE_PERCENT}% daily</span> for{" "}
              {TERM_DAYS} days.
            </Bullet>
            <Bullet>
              Returns arrive at{" "}
              <span className="font-bold text-accent">{payoutClockLabel()} every day</span>.
            </Bullet>
            <Bullet>
              Invite your own friends and earn {REFERRAL_RATES[0]}% and {REFERRAL_RATES[1]}%
              commission.
            </Bullet>
          </ul>

          <Link href={code ? `/register?ref=${code}` : "/register"}>
            <Button size="lg" className="h-12 w-full text-base">
              Create my account
            </Button>
          </Link>
          <Link
            href={code ? `/login?ref=${code}` : "/login"}
            className="block text-center text-sm font-semibold text-accent"
          >
            I already have an account
          </Link>
          <Link href="/about" className="block text-center text-xs text-muted-foreground">
            About {BRAND_NAME}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
      <span>{children}</span>
    </li>
  );
}
