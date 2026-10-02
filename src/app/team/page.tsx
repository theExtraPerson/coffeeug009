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
  const { user, loading: sessionLoading } = useSessionUser();
  const { data: team, isLoading, isError, error } = useTeamStats(user?.id);
  const [level, setLevel] = useState(1);

  const waiting = sessionLoading || (!!user && isLoading);
  const levels = team?.levels ?? [];
  const current = levels.find((entry) => Number(entry.level) === level);
  const members = current?.members_list ?? [];

  return (
    <AppShell title="My team" back="/">
      <div className="space-y-4 px-4 py-4">
        <div className="app-card p-4">
          <p className="font-display text-4xl font-bold text-primary">{team?.total_members ?? 0}</p>
          <p className="text-sm font-semibold">
            {(team?.total_members ?? 0) === 1
              ? "member registered under you"
              : "members registered under you"}
          </p>
          <p className="text-xs text-muted-foreground">
            Level 1 and level 2, including people who have not invested yet.
          </p>
        </div>
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

        {waiting ? <p className="text-sm text-muted-foreground">Loading team…</p> : null}

        <div className="space-y-2">
          {members.map((member, index) => {
            const invested = Number(member.volume) > 0;
            const rate = member.rate ?? current?.rate ?? 0;
            return (
              <div key={`${member.username ?? "member"}-${member.joined_at ?? index}`} className="app-card flex items-center gap-3 p-3.5">
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
                  <p className="text-[10px] font-semibold text-muted-foreground">Invested</p>
                  <p className="text-sm font-bold">{invested ? formatMoney(member.volume) : "—"}</p>
                  <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                    Commission {rate}%
                  </p>
                  <p className={`text-sm font-bold ${invested ? "text-primary" : "text-muted-foreground"}`}>
                    {invested ? formatMoney(member.earned) : "Awaiting"}
                  </p>
                </div>
              </div>
            );
          })}

          {!waiting && isError ? (
            <div className="app-card space-y-2 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "Could not load your team."}
              </p>
            </div>
          ) : null}

          {!waiting && !isError && members.length === 0 ? (
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
