"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { payoutClockLabel } from "@/lib/platform";
import type { AppSettings } from "@/lib/types";

type Draft = AppSettings & { id?: number };

export function AdminSettings() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { settings: Draft };
    setDraft(data.settings);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!draft) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const patch = (change: Partial<Draft>) => setDraft({ ...draft, ...change });

  async function save() {
    setBusy(true);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not save settings");
      return;
    }
    toast.success("Settings saved");
    await load();
  }

  return (
    <div className="space-y-3">
      <Card title="Earning">
        <Row>
          <NumberField
            label="Daily return %"
            value={draft.daily_rate_percent}
            onChange={(v) => patch({ daily_rate_percent: v })}
          />
          <NumberField
            label="Term (days)"
            value={draft.term_days}
            onChange={(v) => patch({ term_days: v })}
          />
        </Row>
        <NumberField
          label={`Payout hour — currently ${payoutClockLabel(draft.payout_hour)} Kampala`}
          value={draft.payout_hour}
          onChange={(v) => patch({ payout_hour: v })}
        />
        <NumberField
          label="Signup bonus"
          value={draft.signup_bonus}
          onChange={(v) => patch({ signup_bonus: v })}
        />
      </Card>

      <Card title="Deposits">
        <Row>
          <NumberField
            label="Minimum"
            value={draft.deposit_min}
            onChange={(v) => patch({ deposit_min: v })}
          />
          <NumberField
            label="Maximum"
            value={draft.deposit_max}
            onChange={(v) => patch({ deposit_max: v })}
          />
        </Row>
      </Card>

      <Card title="Withdrawals">
        <Row>
          <NumberField
            label="Minimum"
            value={draft.withdraw_min}
            onChange={(v) => patch({ withdraw_min: v })}
          />
          <NumberField
            label="Maximum"
            value={draft.withdraw_max}
            onChange={(v) => patch({ withdraw_max: v })}
          />
        </Row>
        <NumberField
          label={`Fee rate — ${(draft.withdraw_fee_rate * 100).toFixed(0)}% charged to the member`}
          value={draft.withdraw_fee_rate}
          step="0.01"
          onChange={(v) => patch({ withdraw_fee_rate: v })}
        />
        <Row>
          <TextField
            label="Window opens"
            value={draft.withdraw_start}
            onChange={(v) => patch({ withdraw_start: v })}
          />
          <TextField
            label="Window closes"
            value={draft.withdraw_end}
            onChange={(v) => patch({ withdraw_end: v })}
          />
        </Row>
        <p className="text-xs text-muted-foreground">
          Every withdrawal waits for an admin. A MarzPay request is sent only after
          approval. A manual request is paid by the admin directly.
        </p>
      </Card>

      <Card title="Links & copy">
        <TextField
          label="Telegram channel"
          value={draft.telegram_channel_url}
          onChange={(v) => patch({ telegram_channel_url: v })}
        />
        <TextField
          label="Telegram support"
          value={draft.telegram_support_url}
          onChange={(v) => patch({ telegram_support_url: v })}
        />
        <div className="space-y-1">
          <Label htmlFor="welcome">Welcome popup</Label>
          <textarea
            id="welcome"
            rows={5}
            className="app-panel w-full px-[15px] py-2.5 text-[15px] outline-none"
            value={draft.welcome_message}
            onChange={(e) => patch({ welcome_message: e.target.value })}
          />
        </div>
      </Card>

      <Card title="Platform">
        <Toggle
          label="Freeze the platform"
          hint="Blocks deposits, activations, claims, and withdrawals for everyone."
          value={draft.frozen}
          onChange={(v) => patch({ frozen: v })}
          danger
        />
      </Card>

      <Button className="w-full" size="lg" disabled={busy} onClick={save}>
        Save settings
      </Button>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="app-card space-y-3 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function NumberField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
  danger,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="app-panel flex w-full items-center gap-3 px-3 py-3 text-left"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <span
        className={`chip shrink-0 px-3 py-1 text-xs ${
          value ? (danger ? "chip-bad" : "chip-good") : "chip-off"
        }`}
      >
        {value ? "ON" : "OFF"}
      </span>
    </button>
  );
}
