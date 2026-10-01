"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "@/components/icons";
import { formatKampala, formatKampalaDate } from "@/lib/date";
import { formatMoney, formatSigned } from "@/lib/money";
import type { LedgerEntry, Payment, PlantOrder } from "@/lib/types";
import { SecretValue, Stat } from "./shared";

type UserRow = {
  id: string;
  fullName: string | null;
  username: string | null;
  phone: string | null;
  referralCode: string | null;
  isBanned: boolean;
  isAdmin: boolean;
  registeredAt: string;
  firstDepositAt: string | null;
  lastDepositAt: string | null;
  balance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  referralCount: number;
  invitedBy: { username: string | null; fullName: string | null; referralCode: string | null } | null;
  password: string | null;
};

type Detail = {
  profile: {
    id: string;
    fullName: string | null;
    username: string | null;
    phone: string | null;
    referralCode: string | null;
    isBanned: boolean;
    registeredAt: string;
    firstDepositAt: string | null;
    lastDepositAt: string | null;
  };
  password: string | null;
  passwordUpdatedAt: string | null;
  wallet: {
    balance: number;
    deposited: number;
    plantEarned: number;
    referralEarned: number;
    spent: number;
    withdrawn: number;
    signupBonus: number;
  };
  referrals: {
    invitedBy: {
      username: string | null;
      full_name: string | null;
      referral_code: string | null;
      created_at: string;
    } | null;
    codeUsed: string | null;
    members: {
      id: string;
      username: string | null;
      full_name: string | null;
      referral_code: string | null;
      created_at: string;
      level: 1 | 2;
      rate: number;
      invested: number;
      commission: number;
      via_username: string | null;
      status: "invested" | "waiting";
    }[];
    count: number;
  };
  orders: PlantOrder[];
  payments: Payment[];
  ledger: LedgerEntry[];
};

export function AdminUsers() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`, {
      cache: "no-store",
    });
    setLoading(false);
    if (!res.ok) return;
    const data = (await res.json()) as { users: UserRow[] };
    setUsers(data.users);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, username, code or phone"
        />
        <Button type="submit" size="default" className="shrink-0">
          <Search className="size-4" />
        </Button>
      </form>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {!loading && !users.length ? (
        <p className="app-card p-4 text-sm text-muted-foreground">No members matched.</p>
      ) : null}

      {users.map((row) => (
        <div key={row.id} className="app-card overflow-hidden">
          <button
            type="button"
            className="flex w-full items-start gap-3 p-4 text-left"
            onClick={() => setOpenId((id) => (id === row.id ? null : row.id))}
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                {row.fullName ?? "Member"}
                {row.isAdmin ? <span className="chip chip-accent">ADMIN</span> : null}
                {row.isBanned ? (
                  <span className="chip chip-bad">BANNED</span>
                ) : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                @{row.username ?? "—"} · {row.phone ?? "no phone"} · code {row.referralCode}
              </p>
              {/* Both dates the admin asked to see, side by side. */}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Registered {formatKampalaDate(row.registeredAt)} · First deposit{" "}
                {row.firstDepositAt ? formatKampalaDate(row.firstDepositAt) : "none"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-primary">{formatMoney(row.balance)}</p>
              <p className="text-[11px] text-muted-foreground">{row.referralCount} referrals</p>
            </div>
          </button>

          {openId === row.id ? <UserDetail row={row} onChanged={load} /> : null}
        </div>
      ))}
    </div>
  );
}

function UserDetail({ row, onChanged }: { row: UserRow; onChanged: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${row.id}`, { cache: "no-store" });
    if (!res.ok) return;
    setDetail((await res.json()) as Detail);
  }, [row.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function adjust(sign: 1 | -1) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter an amount");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: row.id, amount: sign * value, note }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not adjust");
      return;
    }
    toast.success("Wallet adjusted");
    setAmount("");
    setNote("");
    await load();
    onChanged();
  }

  async function toggleBan() {
    setBusy(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: row.id, isBanned: !row.isBanned }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not update");
      return;
    }
    toast.success(row.isBanned ? "Account unbanned" : "Account banned");
    onChanged();
  }

  if (!detail) {
    return <p className="border-t border-border p-4 text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-4 bg-black/20 p-4 shadow-[inset_0_1px_0_0_var(--border)]">
      <section className="space-y-2">
        <Heading>Account</Heading>
        <Field label="Registered" value={formatKampala(detail.profile.registeredAt)} />
        <Field
          label="First deposit"
          value={
            detail.profile.firstDepositAt ? formatKampala(detail.profile.firstDepositAt) : "none yet"
          }
        />
        <Field
          label="Latest deposit"
          value={
            detail.profile.lastDepositAt ? formatKampala(detail.profile.lastDepositAt) : "none yet"
          }
        />
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Login password</span>
          <SecretValue value={detail.password} />
        </div>
      </section>

      <section className="space-y-2">
        <Heading>Wallet</Heading>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Balance" value={formatMoney(detail.wallet.balance)} accent />
          <Stat label="Deposited" value={formatMoney(detail.wallet.deposited)} />
          <Stat label="Withdrawn" value={formatMoney(detail.wallet.withdrawn)} />
          <Stat label="Plant income" value={formatMoney(detail.wallet.plantEarned)} />
          <Stat label="Commission" value={formatMoney(detail.wallet.referralEarned)} />
          <Stat label="Spent on plants" value={formatMoney(detail.wallet.spent)} />
        </div>
      </section>

      <section className="space-y-2">
        <Heading>Referrals ({detail.referrals.count})</Heading>
        <Field
          label="Invited by"
          value={
            detail.referrals.invitedBy
              ? `@${detail.referrals.invitedBy.username ?? "—"} · code ${detail.referrals.codeUsed ?? detail.referrals.invitedBy.referral_code ?? "—"}`
              : "direct signup"
          }
        />
        {detail.referrals.members.length ? (
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {detail.referrals.members.map((m) => (
              <div key={`${m.level}-${m.id}`} className="rounded-xl bg-card px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold">
                    L{m.level} · {m.full_name ?? "Member"}{" "}
                    <span className="font-normal text-muted-foreground">@{m.username ?? "—"}</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-primary">
                    {m.status === "invested" ? formatMoney(m.commission) : "waiting"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {m.rate}% · code {m.referral_code ?? "—"}
                  {m.via_username ? ` · via @${m.via_username}` : ""}
                  {m.status === "invested" ? ` · invested ${formatMoney(m.invested)}` : " · no investment yet"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No referrals yet.</p>
        )}
      </section>

      <section className="space-y-2">
        <Heading>Activations ({detail.orders.length})</Heading>
        {detail.orders.length ? (
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {detail.orders.map((o) => (
              <div key={o.id} className="rounded-xl bg-card px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs font-semibold">{o.product_name}</span>
                  <span className="shrink-0 text-xs font-bold text-primary">
                    {formatMoney(o.price)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {o.days_claimed}/{o.days} days · {o.status} · {formatKampalaDate(o.created_at)}
                </p>
                {o.note ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">Member note: {o.note}</p>
                ) : null}
                {o.admin_note ? (
                  <p className="text-[11px] text-accent">Admin note: {o.admin_note}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No plants activated.</p>
        )}
      </section>

      <section className="space-y-2">
        <Heading>Recent wallet entries</Heading>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {detail.ledger.slice(0, 30).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-xl bg-card px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">
                  {entry.note ?? entry.type.replace(/_/g, " ")}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {entry.type} · {formatKampala(entry.created_at)}
                </p>
              </div>
              <span
                className={`shrink-0 text-xs font-bold ${
                  Number(entry.amount) < 0 ? "text-destructive" : "text-primary"
                }`}
              >
                {formatSigned(entry.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <Heading>Adjust wallet</Heading>
        <Input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount in UGX"
        />
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason" />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={busy} onClick={() => adjust(1)}>
            Credit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => adjust(-1)}
          >
            Debit
          </Button>
          <Button
            size="sm"
            variant={row.isBanned ? "secondary" : "danger"}
            disabled={busy}
            onClick={toggleBan}
          >
            {row.isBanned ? "Unban" : "Ban"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-semibold">{value}</span>
    </div>
  );
}
