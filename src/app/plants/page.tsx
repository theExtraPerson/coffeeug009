"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startProcessing } from "@/app/actions";
import { useAppSettings, useEarnings, useSessionUser } from "@/hooks/use-app-data";
import { formatMoney } from "@/lib/money";
import {
  DAILY_RATE_PERCENT,
  MIN_DEPOSIT,
  MAX_DEPOSIT,
  PROCESSING_PLANT_IMAGE,
  PROCESSING_PLANT_NAME,
  TERM_DAYS,
  payoutClockLabel,
} from "@/lib/platform";

const QUICK = [10_000, 20_000, 50_000, 100_000, 300_000, 1_000_000];

type Step = "plant" | "amount" | "started";

export default function PlantsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useSessionUser();
  const { data: settings } = useAppSettings();
  const { data: earnings } = useEarnings(user?.id);

  const [step, setStep] = useState<Step>("plant");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [startedAmount, setStartedAmount] = useState(0);

  const rate = Number(settings?.daily_rate_percent ?? DAILY_RATE_PERCENT);
  const days = Number(settings?.term_days ?? TERM_DAYS);
  const min = Number(settings?.deposit_min ?? MIN_DEPOSIT);
  const max = Number(settings?.deposit_max ?? MAX_DEPOSIT);
  const payoutLabel = payoutClockLabel(earnings?.payoutHour ?? settings?.payout_hour);
  const value = Math.round(Number(amount) || 0);
  const daily = value > 0 ? Math.round((value * rate) / 100) : 0;
  const total = daily * days;

  useEffect(() => {
    if (window.location.hash === "#invest") setStep("amount");
  }, []);

  async function start() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!Number.isFinite(value) || value < min) {
      toast.error(`Minimum amount is ${formatMoney(min)}`);
      return;
    }
    if (value > max) {
      toast.error(`Maximum amount is ${formatMoney(max)}`);
      return;
    }
    if (earnings && value > earnings.available) {
      toast.error("Not enough wallet balance. Deposit first");
      return;
    }

    setBusy(true);
    const { error } = await startProcessing(value);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    setStartedAmount(value);
    setStep("started");
    toast.success(`Your coffee is processing. First return at ${payoutLabel}.`);
    await qc.invalidateQueries();
  }

  return (
    <AppShell title="Processing plant" back="/">
      <div className="space-y-4 px-4 py-4">
        <button
          type="button"
          onClick={() => setStep("amount")}
          className="app-card block w-full overflow-hidden text-left"
        >
          <img
            src={PROCESSING_PLANT_IMAGE}
            alt={PROCESSING_PLANT_NAME}
            width={1280}
            height={720}
            className="h-52 w-full object-cover"
          />
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <div>
              <h2 className="font-display text-base font-semibold">{PROCESSING_PLANT_NAME}</h2>
              <p className="text-xs text-muted-foreground">From farm to global markets</p>
            </div>
            <span className="chip chip-accent">{rate}% DAILY</span>
          </div>
        </button>

        {step === "plant" ? (
          <div className="app-card space-y-3 p-4">
            <p className="text-sm text-muted-foreground">
              Invest any amount. The plant returns{" "}
              <span className="font-bold text-accent">{rate}%</span> of it every day at{" "}
              {payoutLabel}, for {days} days.
            </p>
            <Button size="lg" className="h-12 w-full" onClick={() => setStep("amount")}>
              Choose amount
            </Button>
          </div>
        ) : null}

        {step === "amount" ? (
          <div className="app-card space-y-4 p-4">
            <div>
              <p className="text-sm font-bold">Choose amount</p>
              <p className="text-xs text-muted-foreground">
                {rate}% comes back at {payoutLabel} every day for {days} days.
              </p>
            </div>

            {user && earnings ? (
              <p className="text-xs text-muted-foreground">
                Available {formatMoney(earnings.available)}
              </p>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="invest-amount">Amount</Label>
              <Input
                id="invest-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                placeholder={String(min)}
              />
              <p className="text-xs text-muted-foreground">
                Minimum {formatMoney(min)}. Maximum {formatMoney(max)}.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAmount(String(option))}
                  className={`app-panel px-3 py-1.5 text-xs font-semibold ${
                    amount === String(option) ? "text-primary" : "text-foreground"
                  }`}
                >
                  {option.toLocaleString("en-UG")}
                </button>
              ))}
            </div>

            {value > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                <Tile label="YOU INVEST" value={formatMoney(value)} />
                <Tile label={`DAILY AT ${payoutLabel}`} value={formatMoney(daily)} accent />
                <Tile label="DAYS" value={String(days)} />
                <Tile label="TOTAL RETURN" value={formatMoney(total)} accent />
              </div>
            ) : null}

            <Button
              onClick={start}
              disabled={busy || value <= 0}
              size="lg"
              className="h-12 w-full"
            >
              {busy ? "Starting…" : "Start processing your coffee"}
            </Button>
          </div>
        ) : null}

        {step === "started" ? (
          <div className="app-card space-y-3 p-4 text-center">
            <p className="font-display text-xl font-bold text-accent">Coffee is processing</p>
            <p className="text-sm text-muted-foreground">
              {formatMoney(startedAmount)} is in the plant.{" "}
              {formatMoney(Math.round((startedAmount * rate) / 100))} arrives at {payoutLabel}{" "}
              every day for {days} days.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                setAmount("");
                setStep("amount");
              }}
            >
              Process more
            </Button>
            <Link href="/orders" className="block">
              <Button variant="secondary" className="w-full">
                View my plants
              </Button>
            </Link>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="stat-tile">
      <div className="text-[10px] font-medium tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 truncate text-base font-bold ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
    </div>
  );
}
