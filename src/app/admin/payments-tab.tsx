"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKampala } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { PAYMENT_REVIEW_PREFIX, type Payment } from "@/lib/types";

type Row = Payment & {
  member: { id: string; username: string | null; full_name: string | null; phone: string | null } | null;
};

const FILTERS = [
  { id: "pending", label: "Waiting" },
  { id: "SUCCESS", label: "Done" },
  { id: "FAILED", label: "Failed" },
  { id: "", label: "All" },
] as const;

const STATUS_CHIP: Record<string, string> = {
  PENDING: "chip-wait",
  PROCESSING: "chip-live",
  SUCCESS: "chip-good",
  FAILED: "chip-bad",
  CANCELLED: "chip-off",
};

export function AdminPayments({
  type,
  onChanged,
}: {
  type: "DEPOSIT" | "WITHDRAWAL";
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<string>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [methodChoice, setMethodChoice] = useState<Record<string, "MARZPAY" | "MANUAL">>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/payments?type=${type}&status=${filter}`, {
      cache: "no-store",
    });
    setLoading(false);
    if (!res.ok) return;
    const data = (await res.json()) as { payments: Row[] };
    setRows(data.payments);
  }, [type, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const isWithdrawal = type === "WITHDRAWAL";

  async function review(id: string, action: "approve" | "reject" | "send" | "note") {
    setBusy(id);
    const res = await fetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: id, action, note: notes[id] }),
    });
    const data = (await res.json()) as {
      error?: string;
      status?: string;
      mode?: string;
      failureReason?: string | null;
    };
    setBusy(null);
    if (!res.ok) {
      toast.error(data.error ?? "Could not update this payment");
      return;
    }
    toast.success(
      action === "approve"
        ? isWithdrawal
          ? "Marked paid"
          : "Approved and credited"
        : action === "reject"
          ? "Rejected, funds released"
          : action === "send"
            ? data.failureReason
              ? "MarzPay did not send it. You can retry or mark it paid."
              : "Approved. MarzPay is sending the money."
            : "Note saved",
    );
    await load();
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id || "all"}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold text-white ${
              filter === f.id ? "bg-primary shadow-[inset_0_0_0_2px_#ffffff]" : "bg-[#14331f]"
            }`}
          >
            {f.label}
          </button>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={load}>
          Refresh
        </Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {!loading && !rows.length ? (
        <p className="app-card p-4 text-sm text-muted-foreground">Nothing here.</p>
      ) : null}

      {rows.map((row) => {
        const open = row.status === "PENDING" || row.status === "PROCESSING";
        const payout = methodChoice[row.id] ?? "MARZPAY";
        const phone = normalizePhone(row.phone_number) || row.phone_number;
        return (
          <div key={row.id} className="app-card space-y-3 p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {row.member?.full_name ?? "Member"}{" "}
                  <span className="font-normal text-muted-foreground">
                    @{row.member?.username ?? "—"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {normalizePhone(row.phone_number) || row.phone_number} · {row.provider ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">{formatKampala(row.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-lg font-bold text-primary">
                  {formatMoney(row.amount)}
                </p>
                {isWithdrawal ? (
                  <p className="text-[11px] text-muted-foreground">
                    fee {formatMoney(row.fee)} · net {formatMoney(row.net_amount)}
                  </p>
                ) : null}
                <div className="mt-1 flex flex-wrap justify-end gap-1">
                  {isWithdrawal && row.status !== "PENDING" && row.mode !== "UNASSIGNED" ? (
                    <span className={`chip ${row.mode === "MANUAL" ? "chip-accent" : "chip-live"}`}>
                      {row.mode === "MANUAL" ? "MANUAL" : "MARZPAY"}
                    </span>
                  ) : null}
                  <span className={`chip ${STATUS_CHIP[row.status] ?? "chip-off"}`}>
                    {row.status}
                  </span>
                </div>
              </div>
            </div>

            {row.failure_reason && row.status !== "SUCCESS" ? (
              <p className="alert-bad px-3 py-2 text-xs">{row.failure_reason}</p>
            ) : null}
            {row.admin_note?.startsWith(PAYMENT_REVIEW_PREFIX) ? (
              <p className="rounded-[13px] bg-[#e4c200]/35 px-3 py-2 text-xs font-semibold text-[#14331f]">
                {row.admin_note}
              </p>
            ) : row.admin_note && !open ? (
              <p className="app-panel px-3 py-2 text-xs text-muted-foreground">
                Note: {row.admin_note}
              </p>
            ) : null}

            <p className="font-mono text-[10px] text-muted-foreground">
              ref {row.external_reference}
              {row.provider_tx_uuid ? ` · tx ${row.provider_tx_uuid}` : ""}
            </p>

            {open ? (
              <>
                <Input
                  placeholder="Admin note (shown on rejection)"
                  value={
                    notes[row.id] ??
                    (row.admin_note?.startsWith(PAYMENT_REVIEW_PREFIX) ? "" : row.admin_note ?? "")
                  }
                  onChange={(e) => setNotes((n) => ({ ...n, [row.id]: e.target.value }))}
                />
                {isWithdrawal && row.status === "PENDING" ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider">How this is paid</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ["MARZPAY", "MarzPay"],
                          ["MANUAL", "Manual"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setMethodChoice((current) => ({ ...current, [row.id]: id }))}
                          className={`rounded-full px-3 py-2 text-xs font-semibold text-white ${
                            payout === id
                              ? "bg-primary shadow-[inset_0_0_0_2px_#ffffff]"
                              : "bg-[#14331f]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {payout === "MARZPAY"
                        ? `MarzPay sends ${formatMoney(row.net_amount)} to ${phone}.`
                        : `Send ${formatMoney(row.net_amount)} to ${phone} yourself, then mark it paid.`}
                    </p>
                  </div>
                ) : null}
                {isWithdrawal && row.status === "PROCESSING" ? (
                  <p className="text-xs text-muted-foreground">
                    MarzPay is sending {formatMoney(row.net_amount)} to {phone}.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {isWithdrawal && row.status === "PENDING" && payout === "MARZPAY" ? (
                    <Button
                      size="sm"
                      variant="accent"
                      disabled={busy === row.id}
                      onClick={() => review(row.id, "send")}
                    >
                      Send with MarzPay
                    </Button>
                  ) : null}
                  {isWithdrawal && row.status === "PENDING" && payout === "MANUAL" ? (
                    <Button size="sm" disabled={busy === row.id} onClick={() => review(row.id, "approve")}>
                      Mark paid
                    </Button>
                  ) : null}
                  {!isWithdrawal ? (
                    <Button size="sm" disabled={busy === row.id} onClick={() => review(row.id, "approve")}>
                      Credit wallet
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy === row.id}
                    onClick={() => review(row.id, "reject")}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === row.id}
                    onClick={() => review(row.id, "note")}
                  >
                    Save note
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
