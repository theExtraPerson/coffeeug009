"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppSettings, useEarnings, useProfile, useSessionUser } from "@/hooks/use-app-data";
import { detectProvider, normalizePhone } from "@/lib/phone";
import { formatMoney } from "@/lib/money";
import { MIN_DEPOSIT } from "@/lib/platform";

const QUICK = [5000, 10000, 20000, 50000];

type Phase = "form" | "waiting" | "done" | "failed";

export default function DepositPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useSessionUser();
  const { data: profile } = useProfile(user?.id);
  const { data: settings } = useAppSettings();
  const { data: earnings } = useEarnings(user?.id);

  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const pollRef = useRef<number | null>(null);

  const min = Math.max(Number(settings?.deposit_min ?? MIN_DEPOSIT), MIN_DEPOSIT);
  const provider = detectProvider(phone);

  useEffect(() => {
    if (profile?.phone && !phone) setPhone(normalizePhone(profile.phone));
  }, [profile?.phone, phone]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  /**
   * MarzPay confirms a collection by webhook, but the member is staring at this
   * screen, so we also poll their own payment until it reaches a final state.
   */
  useEffect(() => {
    if (phase !== "waiting" || !paymentId) return;

    async function check() {
      try {
        const res = await fetch(`/api/payments/status/${paymentId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { status: string; failureReason?: string | null };
        if (data.status === "SUCCESS") {
          stopPolling();
          setPhase("done");
          setMessage("Deposit received. Your wallet has been credited.");
          toast.success("Deposit received");
          await qc.invalidateQueries();
        } else if (data.status === "FAILED" || data.status === "CANCELLED") {
          stopPolling();
          setPhase("failed");
          setMessage(data.failureReason || "The deposit was not completed.");
        }
      } catch {
        // Keep waiting; a transient error is not a verdict.
      }
    }

    void check();
    pollRef.current = window.setInterval(check, 4000);
    // Stop nagging the gateway after five minutes; the webhook still settles it.
    const giveUp = window.setTimeout(stopPolling, 300_000);
    return () => {
      stopPolling();
      window.clearTimeout(giveUp);
    };
  }, [phase, paymentId, qc, stopPolling]);

  async function submit() {
    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value < min) {
      toast.error(`Minimum deposit is ${formatMoney(min)}`);
      return;
    }
    if (normalizePhone(phone).length < 10) {
      toast.error("Enter the mobile money number to charge");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/payments/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, phone: normalizePhone(phone) }),
      });
      const data = (await res.json()) as { id?: string; message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Deposit failed");

      setPaymentId(data.id ?? null);
      setPhase("waiting");
      setMessage(data.message ?? "Approve the prompt on your phone.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Deposit" back="/">
      <div className="space-y-4 px-4 py-4">
        <div className="app-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Wallet balance
          </p>
          <p className="font-display text-2xl font-bold text-primary">
            {formatMoney(earnings?.balance ?? 0)}
          </p>
        </div>

        {phase === "form" ? (
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
              <p className="text-xs text-muted-foreground">
                Minimum {formatMoney(min)}. Maximum{" "}
                {formatMoney(settings?.deposit_max ?? 5_000_000)}.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(String(value))}
                  className="app-panel px-3 py-1.5 text-xs font-semibold text-foreground"
                >
                  {value.toLocaleString("en-UG")}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Mobile money number</Label>
              <Input
                id="phone"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="0771234567"
                maxLength={12}
              />
              <p className="text-xs text-muted-foreground">
                {provider
                  ? `${provider} detected. You will get a prompt on this number.`
                  : "MTN or Airtel Uganda."}
              </p>
            </div>

            <Button onClick={submit} disabled={busy} size="lg" className="h-12 w-full">
              {busy ? "Sending prompt…" : "Deposit now"}
            </Button>

            <p className="text-xs text-muted-foreground">
              Deposits are automatic. Your wallet is credited only after the mobile money payment
              is confirmed.
            </p>
          </div>
        ) : null}

        {phase === "waiting" ? (
          <div className="app-card space-y-3 p-4 text-center">
            <div className="mx-auto size-10 animate-spin rounded-full border-4 border-cream border-t-accent" />
            <p className="font-bold">Waiting for your approval</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <p className="text-xs text-muted-foreground">
              Keep this screen open. If you closed the prompt, check Records — the deposit lands as
              soon as mobile money confirms it.
            </p>
            <Button variant="secondary" className="w-full" onClick={() => router.push("/records")}>
              View records
            </Button>
          </div>
        ) : null}

        {phase === "done" ? (
          <div className="app-card space-y-3 p-4 text-center">
            <p className="font-display text-xl font-bold text-accent">Deposit received</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button className="w-full" onClick={() => router.push("/plants#invest")}>
              Process your coffee
            </Button>
          </div>
        ) : null}

        {phase === "failed" ? (
          <div className="app-card space-y-3 p-4 text-center">
            <p className="font-display text-xl font-bold text-destructive">Deposit not completed</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button
              className="w-full"
              onClick={() => {
                setPhase("form");
                setPaymentId(null);
              }}
            >
              Try again
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
