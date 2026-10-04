"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useLedger, usePayments, useSessionUser } from "@/hooks/use-app-data";
import { formatKampala } from "@/lib/date";
import { formatMoney, formatSigned } from "@/lib/money";
import type { LedgerType } from "@/lib/types";

const LABELS: Record<LedgerType, string> = {
  signup_bonus: "Registration bonus",
  deposit: "Deposit",
  purchase: "Plant activated",
  daily_income: "Daily return",
  commission: "Team commission",
  withdrawal: "Withdrawal",
  withdrawal_fee: "Withdrawal fee",
  adjustment: "Adjustment",
};

type Tab = "wallet" | "deposits" | "withdrawals";

export default function RecordsPage() {
  const { user } = useSessionUser();
  const { data: ledger, isLoading } = useLedger(user?.id);
  const { data: payments } = usePayments(user?.id);
  const [tab, setTab] = useState<Tab>("wallet");

  const deposits = (payments ?? []).filter((p) => p.type === "DEPOSIT");
  const withdrawals = (payments ?? []).filter((p) => p.type === "WITHDRAWAL");

  return (
    <AppShell title="Records" back="/me">
      <div className="flex gap-2 overflow-x-auto px-4 py-4">
        {(
          [
            ["wallet", "Wallet"],
            ["deposits", "Deposits"],
            ["withdrawals", "Withdrawals"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              tab === id
                ? "bg-primary text-primary-foreground"
                : "app-panel text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2 px-4 pb-4">
        {tab === "wallet" ? (
          <>
            {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
            {!isLoading && !ledger?.length ? (
              <p className="app-card p-4 text-sm text-muted-foreground">
                Your wallet history is empty.
              </p>
            ) : null}
            {(ledger ?? []).map((entry) => {
              const credit = Number(entry.amount) > 0;
              return (
                <div key={entry.id} className="app-card flex items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{LABELS[entry.type]}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.note ?? formatKampala(entry.created_at)}
                    </p>
                    {entry.note ? (
                      <p className="text-[11px] text-muted-foreground">
                        {formatKampala(entry.created_at)}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold ${
                      credit ? "text-success" : "text-muted-foreground"
                    }`}
                  >
                    {formatSigned(entry.amount)}
                  </span>
                </div>
              );
            })}
          </>
        ) : null}

        {tab === "deposits" ? <PaymentList rows={deposits} empty="No deposits yet." /> : null}
        {tab === "withdrawals" ? (
          <PaymentList rows={withdrawals} empty="No withdrawals yet." showFee />
        ) : null}
      </div>
    </AppShell>
  );
}

function PaymentList({
  rows,
  empty,
  showFee,
}: {
  rows: {
    id: string;
    status: string;
    mode: string;
    amount: number;
    fee: number;
    net_amount: number;
    provider: string | null;
    phone_number: string;
    failure_reason: string | null;
    created_at: string;
  }[];
  empty: string;
  showFee?: boolean;
}) {
  if (!rows.length) {
    return <p className="app-card p-4 text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <>
      {rows.map((row) => (
        <div key={row.id} className="app-card p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold">{formatMoney(row.amount)}</p>
              <p className="text-xs text-muted-foreground">
                {row.provider ?? "Mobile money"} · {row.phone_number}
              </p>
            </div>
            <StatusPill status={row.status} mode={row.mode} />
          </div>

          {showFee ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {row.mode === "MANUAL" ? "Manual payout" : "MarzPay payout"}
              {Number(row.fee) > 0
                ? ` · fee ${formatMoney(row.fee)} · you receive ${formatMoney(row.net_amount)}`
                : ""}
            </p>
          ) : null}

          <p className="mt-1 text-[11px] text-muted-foreground">{formatKampala(row.created_at)}</p>

          {row.failure_reason && row.status === "FAILED" ? (
            <p className="alert-bad mt-2 px-3 py-2 text-xs">{row.failure_reason}</p>
          ) : null}
        </div>
      ))}
    </>
  );
}

function StatusPill({ status, mode }: { status: string; mode: string }) {
  const tone =
    status === "SUCCESS"
      ? "chip-good"
      : status === "FAILED" || status === "CANCELLED"
        ? "chip-bad"
        : "chip-wait";
  const label =
    status === "SUCCESS"
      ? "Paid"
      : status === "PENDING"
        ? "In review"
        : status === "PROCESSING"
          ? mode === "MANUAL"
            ? "In review"
            : "Sending"
        : status === "FAILED"
          ? "Failed"
          : "Cancelled";
  return (
    <span className={`chip shrink-0 px-2.5 py-1 uppercase ${tone}`}>{label}</span>
  );
}
