"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "@/components/icons";
import { formatKampalaDate } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import type { ReferralSnapshot, ReferralSnapshotRow } from "@/server/referrals";
import { Stat } from "./shared";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "invested", label: "Invested" },
  { id: "waiting", label: "Waiting" },
] as const;

export function AdminReferrals() {
  const [snapshot, setSnapshot] = useState<ReferralSnapshot | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/referrals", { cache: "no-store" });
    setLoading(false);
    if (!res.ok) return;
    setSnapshot((await res.json()) as ReferralSnapshot);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (snapshot?.rows ?? []).filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!needle) return true;
      const haystack = [
        row.refereeName,
        row.refereeUsername,
        row.referrerName,
        row.referrerUsername,
        row.uplineUsername,
        row.code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [snapshot, filter, search]);

  if (loading && !snapshot) {
    return <p className="text-sm text-muted-foreground">Loading referrals…</p>;
  }
  if (!snapshot) {
    return <p className="text-sm text-muted-foreground">Could not load referrals.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Invite links" value={String(snapshot.links)} />
        <Stat label="Invested" value={String(snapshot.investedMembers)} accent />
        <Stat label="Waiting" value={String(snapshot.waitingMembers)} />
        <Stat label="Invested volume" value={formatMoney(snapshot.investedVolume)} />
        <Stat label="Commission paid" value={formatMoney(snapshot.commissionPaid)} accent />
        <Stat
          label="Rates"
          value={`${snapshot.level1Rate}% / ${snapshot.level2Rate}%`}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Level 1 ({snapshot.level1Rate}%) is paid to the owner of the code. Level 2 (
        {snapshot.level2Rate}%) is paid to that person&apos;s inviter. Both are credited only after
        the invitee successfully invests in a plant.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold text-white ${
              filter === item.id ? "bg-primary shadow-[inset_0_0_0_2px_#ffffff]" : "bg-[#14331f]"
            }`}
          >
            {item.label}
          </button>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, username, or code"
          className="pl-9"
        />
      </div>

      {rows.length ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <ReferralCard key={row.refereeId} row={row} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No referrals match this view.</p>
      )}
    </div>
  );
}

function ReferralCard({ row }: { row: ReferralSnapshotRow }) {
  const waiting = row.status === "waiting";
  return (
    <div className="app-card space-y-2 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">
            {row.refereeName ?? "Member"}{" "}
            <span className="font-normal text-muted-foreground">@{row.refereeUsername ?? "—"}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Code {row.code ?? "—"} · joined {formatKampalaDate(row.joinedAt)}
          </p>
        </div>
        <span className={`chip ${waiting ? "chip-off" : "chip-accent"}`}>
          {waiting ? "Waiting" : "Invested"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Line
          label={`Level 1 · ${row.rate}%`}
          who={`@${row.referrerUsername ?? "—"}`}
          amount={waiting ? "—" : formatMoney(row.commission)}
        />
        <Line
          label={`Level 2 · ${row.uplineRate}%`}
          who={row.uplineUsername ? `@${row.uplineUsername}` : "no upline"}
          amount={waiting || !row.uplineId ? "—" : formatMoney(row.uplineCommission)}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {waiting
          ? "Signed up with this code. Commission starts when they invest."
          : `Invested ${formatMoney(row.invested)}`}
      </p>
    </div>
  );
}

function Line({ label, who, amount }: { label: string; who: string; amount: string }) {
  return (
    <div className="rounded-xl bg-card px-3 py-2">
      <p className="font-semibold text-muted-foreground">{label}</p>
      <p className="truncate">{who}</p>
      <p className="font-bold text-primary">{amount}</p>
    </div>
  );
}
