"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKampala } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import type { PlantOrder } from "@/lib/types";

type Row = PlantOrder & {
  member: { id: string; username: string | null; full_name: string | null } | null;
};

const FILTERS = [
  { id: "active", label: "Running" },
  { id: "completed", label: "Finished" },
  { id: "", label: "All" },
] as const;

/**
 * Every plant activation with both notes. The member's own note is read-only;
 * the admin note is editable here and never shown to the member.
 */
export function AdminOrders() {
  const [filter, setFilter] = useState<string>("active");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/orders?status=${filter}`, { cache: "no-store" });
    setLoading(false);
    if (!res.ok) return;
    const data = (await res.json()) as { orders: Row[] };
    setRows(data.orders);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveNote(id: string) {
    setBusy(id);
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id, adminNote: drafts[id] ?? "" }),
    });
    setBusy(null);
    if (!res.ok) {
      toast.error("Could not save the note");
      return;
    }
    toast.success("Note saved");
    await load();
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
        <p className="app-card p-4 text-sm text-muted-foreground">No activations.</p>
      ) : null}

      {rows.map((row) => (
        <div key={row.id} className="app-card space-y-3 p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{row.product_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.member?.full_name ?? "Member"} @{row.member?.username ?? "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatKampala(row.created_at)} · {row.days_claimed}/{row.days} days ·{" "}
                {formatMoney(row.daily_income)}/day
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-lg font-bold text-primary">
                {formatMoney(row.price)}
              </p>
              <span className={`chip ${row.status === "active" ? "chip-good" : "chip-off"}`}>
                {row.status === "active" ? "RUNNING" : "FINISHED"}
              </span>
            </div>
          </div>

          {row.note ? (
            <p className="app-panel px-3 py-2 text-xs">
              <span className="font-semibold">Member note:</span> {row.note}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Input
              placeholder="Admin note (private)"
              value={drafts[row.id] ?? row.admin_note ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
            />
            <Button
              size="default"
              variant="secondary"
              className="shrink-0"
              disabled={busy === row.id}
              onClick={() => saveNote(row.id)}
            >
              Save
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
