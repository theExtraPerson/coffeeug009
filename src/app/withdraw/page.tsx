"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock } from "@/components/icons";
import { useAppSettings, useEarnings, useProfile, useSessionUser } from "@/hooks/use-app-data";
import { detectProvider, normalizePhone } from "@/lib/phone";
import { formatMoney } from "@/lib/money";
import {
  MIN_WITHDRAW,
  WITHDRAW_FEE_RATE,
  formatWithdrawWindow,
  isWithdrawWindowOpen,
  withdrawFee,
  withdrawNet,
} from "@/lib/platform";

export default function WithdrawPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useSessionUser();
  const { data: profile } = useProfile(user?.id);
  const { data: settings } = useAppSettings();
  const { data: earnings } = useEarnings(user?.id);

  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile?.phone && !phone) setPhone(normalizePhone(profile.phone));
  }, [profile?.phone, phone]);

  const min = Number(settings?.withdraw_min ?? MIN_WITHDRAW);
  const max = Number(settings?.withdraw_max ?? 5_000_000);
  const feeRate = Number(settings?.withdraw_fee_rate ?? WITHDRAW_FEE_RATE);
  const start = settings?.withdraw_start ?? "08:00";
  const end = settings?.withdraw_end ?? "20:00";
  const windowOpen = isWithdrawWindowOpen(start, end);

  const value = Number(amount) || 0;
  const fee = withdrawFee(value, feeRate);
  const net = withdrawNet(value, feeRate);
  const available = Number(earnings?.available ?? 0);

  async function submit() {
    const requested = Math.round(value);
    if (!Number.isFinite(requested) || requested < min) {
      toast.error(`Minimum withdrawal is ${formatMoney(min)}`);
      return;
    }
    if (requested > max) {
      toast.error(`Maximum withdrawal is ${formatMoney(max)}`);
      return;
    }
    if (requested > available) {
      toast.error("Amount is more than your available balance");
      return;
    }
    if (normalizePhone(phone).length < 10) {
      toast.error("Enter the phone number to receive the money");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/payments/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: requested,
          phone: normalizePhone(phone),
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Withdrawal failed");

      toast.success(data.message ?? "Withdrawal submitted");
      setAmount("");
      await qc.invalidateQueries();
      router.push("/records");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Withdraw" back="/">
      <div className="space-y-4 px-4 py-4">
        <div className="app-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Available to withdraw
          </p>
          <p className="font-display text-2xl font-bold text-primary">{formatMoney(available)}</p>
          {earnings && earnings.reserved > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatMoney(earnings.reserved)} is held by a withdrawal already in progress.
            </p>
          ) : null}
        </div>

        <p
          className={`app-panel flex items-center gap-2 px-3 py-2.5 text-xs font-semibold ${
            windowOpen ? "text-success" : "text-warning"
          }`}
        >
          <Clock className="size-4 shrink-0" />
          {windowOpen
            ? `Withdrawals are open now · ${formatWithdrawWindow(start, end)}`
            : `Withdrawals are open ${formatWithdrawWindow(start, end)}`}
        </p>

        <div className="app-card space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder={String(min)}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Minimum {formatMoney(min)}</span>
              <button
                type="button"
                className="font-semibold text-primary"
                onClick={() => setAmount(String(Math.floor(available)))}
              >
                Use all
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Receiving number</Label>
            <Input
              id="phone"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="0771234567"
              maxLength={12}
            />
            <p className="text-xs text-muted-foreground">
              {detectProvider(phone) ?? "MTN or Airtel Uganda"}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            An admin reviews this request and sends the money to your phone.
          </p>

          {/* Spelled out before they commit, so the fee is never a surprise. */}
          <div className="app-panel space-y-1.5 p-3 text-sm">
            <Row label="You request" value={formatMoney(value)} />
            <Row label={`Fee (${Math.round(feeRate * 100)}%)`} value={`−${formatMoney(fee)}`} />
            <div className="border-t border-border pt-1.5">
              <Row label="You receive" value={formatMoney(net)} bold />
            </div>
          </div>

          <Button
            onClick={submit}
            disabled={busy || !windowOpen}
            size="lg"
            className="h-12 w-full"
          >
            {busy ? "Submitting…" : windowOpen ? "Request withdrawal" : "Outside withdrawal hours"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-bold" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "font-bold text-primary" : "font-semibold"}>{value}</span>
    </div>
  );
}
