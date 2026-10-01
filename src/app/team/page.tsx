"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Share2 } from "@/components/icons";
import { useSessionUser, useTeamStats } from "@/hooks/use-app-data";
import { formatKampalaDate } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { INVEST_IN_COFFEE_IMAGE, REFERRAL_RATES } from "@/lib/platform";

export default function TeamPage() {
  const { user } = useSessionUser();
  const { data: team, isLoading } = useTeamStats(user?.id);
  const [level, setLevel] = useState(1);

  const levels = team?.levels ?? [];
  const current = levels.find((l) => l.level === level);

  return (
    <AppShell title="My team" back="/">
      <div className="space-y-4 px-4 py-4">
        <div className="app-card grid grid-cols-3 gap-2 p-4">
          <Tile label="Members" value={String(team?.total_members ?? 0)} />
          <Tile label="Invested" value={formatMoney(team?.total_volume ?? 0)} />
          <Tile label="From team" value={formatMoney(team?.total_earned ?? 0)} accent />
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          Level 1 pays {REFERRAL_RATES[0]}% and level 2 pays {REFERRAL_RATES[1]}% of a successful
          plant investment. A signup or a deposit alone does not pay commission.
        </p>

        <div className="flex gap-2">
          {[1, 2].map((n) => {
            const info = levels.find((l) => l.level === n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => setLevel(n)}
                className={`flex-1 rounded-[14px] px-3 py-2.5 text-xs font-semibold transition-colors ${
                  level === n
                    ? "bg-primary text-primary-foreground"
                    : "app-panel text-muted-foreground"
                }`}
              >
                Level {n} · {info?.rate ?? (n === 1 ? 6 : 1)}%
                <span className="mt-0.5 block text-[10px] font-semibold opacity-80">
                  {info?.members ?? 0} members
                </span>
              </button>
            );
          })}
        </div>

        {current ? (
          <div className="app-card grid grid-cols-3 gap-2 p-4">
            <Tile label="Members" value={String(current.members)} />
            <Tile label="They invested" value={formatMoney(current.volume)} />
            <Tile label={`${current.rate}% earned`} value={formatMoney(current.earned)} accent />
          </div>
        ) : null}

        {isLoading ? <p className="text-sm text-muted-foreground">Loading team…</p> : null}

        <div className="space-y-2">
          {(current?.members_list ?? []).map((member, index) => (
            <div key={`${member.username ?? index}`} className="app-card flex items-center gap-3 p-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">
                {(member.name ?? member.username ?? "M").slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {member.name ?? member.username ?? "Member"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {member.via_username ? `Via @${member.via_username} · ` : ""}
                  code {member.referral_code ?? "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Joined {formatKampalaDate(member.joined_at)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {member.volume > 0 ? (
                  <>
                    <p className="text-sm font-bold text-primary">{formatMoney(member.earned)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {member.rate ?? current?.rate ?? 0}% of {formatMoney(member.volume)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground">Awaiting</p>
                    <p className="text-[10px] text-muted-foreground">investment</p>
                  </>
                )}
              </div>
            </div>
          ))}

          {!isLoading && !current?.members_list.length ? (
            <div className="app-card space-y-3 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No members on level {level} yet. Share your link to start building your team.
              </p>
              <Link href="/invite">
                <Button className="w-full">
                  <Share2 className="size-4" />
                  Invite friends
                </Button>
              </Link>
            </div>
          ) : null}
        </div>

        <div className="app-card overflow-hidden">
          <img
            src={INVEST_IN_COFFEE_IMAGE}
            alt="Invest in coffee and live a fruitful life"
            width={683}
            height={1024}
            className="w-full"
          />
        </div>
      </div>
    </AppShell>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="stat-tile">
      <div className="text-[10px] font-semibold text-muted-foreground">{label}</div>
      <div className={`mt-0.5 truncate text-sm font-bold ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
    </div>
  );
}
