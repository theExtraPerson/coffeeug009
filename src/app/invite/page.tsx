"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { AppShell, SectionTitle } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Copy, Send, Share2, Users } from "@/components/icons";
import { Logo } from "@/components/brand";
import { useProfile, useSessionUser, useTeamStats } from "@/hooks/use-app-data";
import { inviteShareText, inviteUrl } from "@/lib/invite";
import { formatMoney } from "@/lib/money";
import { BRAND_NAME, INVITE_IMAGE, REFERRAL_RATES, SITE_URL } from "@/lib/platform";

export default function InvitePage() {
  const { user } = useSessionUser();
  const { data: profile } = useProfile(user?.id);
  const { data: team } = useTeamStats(user?.id);
  const [origin, setOrigin] = useState(SITE_URL);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const code = profile?.referral_code ?? "";
  const link = code ? inviteUrl(origin, code) : "";

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy. Long-press to select instead.");
    }
  }

  async function share() {
    if (!link) return;
    const text = inviteShareText(code, link);
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: BRAND_NAME, text, url: link });
        return;
      } catch {
        // The member dismissed the sheet; fall back to the clipboard.
      }
    }
    await copy(text, "Invitation");
  }

  return (
    <AppShell title="Invite friends" back="/">
      <div className="space-y-4 px-4 py-4">
        <div className="app-card overflow-hidden">
          <div className="flex flex-col items-center gap-2 px-4 py-6">
            <Logo size={64} />
            <p className="font-display text-xl font-semibold">{BRAND_NAME}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Grow · Export · Prosper
            </p>
          </div>

          <Image
            src={INVITE_IMAGE}
            alt={`${BRAND_NAME} invitation poster`}
            width={1086}
            height={1629}
            sizes="(max-width: 640px) 100vw, 560px"
            className="h-auto w-full"
          />

          <div className="space-y-3 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                My invite code
              </p>
              <div className="mt-1 flex items-center gap-2">
                <p className="flex-1 font-display text-3xl font-bold tracking-[0.2em] text-accent">
                  {code || "······"}
                </p>
                <Button variant="secondary" size="sm" onClick={() => copy(code, "Code")}>
                  <Copy className="size-3.5" />
                  Copy
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                My invite link
              </p>
              <p className="app-panel mt-1 break-all px-3 py-2 text-xs">
                {link || "Loading…"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={share} size="lg" className="w-full">
                <Share2 className="size-4" />
                Share
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => copy(link, "Link")}
              >
                <Send className="size-4" />
                Copy link
              </Button>
            </div>
          </div>
        </div>

        <section>
          <SectionTitle>How commission works</SectionTitle>
          <div className="app-card divide-y divide-border">
            <CommissionRow
              level={1}
              rate={REFERRAL_RATES[0]}
              body="Paid when someone who used your code successfully invests in a plant."
            />
            <CommissionRow
              level={2}
              rate={REFERRAL_RATES[1]}
              body="Paid when their invite invests, using that member's own code."
            />
          </div>
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            Commission lands in your wallet only after that investment succeeds. A signup or a deposit does not pay it.
          </p>
        </section>

        {team ? (
          <div className="grid grid-cols-3 gap-2">
            <Tile label="Team size" value={String(team.total_members)} />
            <Tile label="Team volume" value={formatMoney(team.total_volume)} />
            <Tile label="From team" value={formatMoney(team.total_earned)} accent />
          </div>
        ) : null}

        <a href="/team" className="app-card flex items-center gap-3 p-4">
          <Users className="size-5 text-accent" />
          <div className="flex-1">
            <p className="text-sm font-bold">See my team</p>
            <p className="text-xs text-muted-foreground">Both levels, member by member</p>
          </div>
        </a>
      </div>
    </AppShell>
  );
}

function CommissionRow({ level, rate, body }: { level: number; rate: number; body: string }) {
  return (
    <div className="flex items-start gap-3 p-4">
      <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-accent">
        <span className="text-[9px] font-bold uppercase">L{level}</span>
        <span className="text-xs font-bold">{rate}%</span>
      </span>
      <div>
        <p className="text-sm font-bold">Level {level} — {rate}%</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="stat-tile">
      <div className="text-[10px] font-semibold text-muted-foreground">{label}</div>
      <div className={`mt-0.5 truncate text-sm font-bold ${accent ? "text-accent" : "text-primary"}`}>
        {value}
      </div>
    </div>
  );
}
