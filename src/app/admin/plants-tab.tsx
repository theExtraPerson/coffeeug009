"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DAILY_RATE_PERCENT, TERM_DAYS } from "@/lib/platform";
import { formatMoney } from "@/lib/money";
import type { Product } from "@/lib/types";

export function AdminPlants() {
  const [products, setProducts] = useState<Product[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<Product>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [newPlant, setNewPlant] = useState({ name: "", price: "" });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/products", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { products: Product[] };
    setProducts(data.products);
    setDrafts({});
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(product: Product, applyToRunning: boolean) {
    const draft = drafts[product.id] ?? {};
    setBusy(product.id);
    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: product.id,
        name: draft.name ?? product.name,
        price: Number(draft.price ?? product.price),
        daily_income: Number(draft.daily_income ?? product.daily_income),
        days: Number(draft.days ?? product.days),
        active: draft.active ?? product.active,
        apply_to_running: applyToRunning,
      }),
    });
    const data = (await res.json()) as { error?: string; orders_updated?: number };
    setBusy(null);
    if (!res.ok) {
      toast.error(data.error ?? "Could not save");
      return;
    }
    toast.success(
      applyToRunning
        ? `Saved and applied to ${data.orders_updated ?? 0} running plants`
        : "Saved for new activations",
    );
    await load();
  }

  async function create() {
    setBusy("new");
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPlant.name, price: Number(newPlant.price) }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(null);
    if (!res.ok) {
      toast.error(data.error ?? "Could not create");
      return;
    }
    toast.success("Plant added");
    setNewPlant({ name: "", price: "" });
    await load();
  }

  return (
    <div className="space-y-3">
      <div className="app-card space-y-3 p-4">
        <h3 className="text-sm font-bold">Add a plant</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="new-name">Name</Label>
            <Input
              id="new-name"
              value={newPlant.name}
              onChange={(e) => setNewPlant((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-price">Price</Label>
            <Input
              id="new-price"
              type="number"
              inputMode="numeric"
              value={newPlant.price}
              onChange={(e) => setNewPlant((p) => ({ ...p, price: e.target.value }))}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Daily return defaults to {DAILY_RATE_PERCENT}% of the price over {TERM_DAYS} days.
        </p>
        <Button
          className="w-full"
          disabled={busy === "new" || !newPlant.name || !newPlant.price}
          onClick={create}
        >
          Add plant
        </Button>
      </div>

      {products.map((product) => {
        const draft = drafts[product.id] ?? {};
        const price = Number(draft.price ?? product.price);
        const daily = Number(draft.daily_income ?? product.daily_income);
        const days = Number(draft.days ?? product.days);
        const patch = (change: Partial<Product>) =>
          setDrafts((d) => ({ ...d, [product.id]: { ...d[product.id], ...change } }));

        return (
          <div key={product.id} className="app-card space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Input
                value={draft.name ?? product.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
              <button
                type="button"
                onClick={() => patch({ active: !(draft.active ?? product.active) })}
                className={`chip shrink-0 px-3 py-1.5 text-xs ${
                  (draft.active ?? product.active) ? "chip-good" : "chip-off"
                }`}
              >
                {(draft.active ?? product.active) ? "Live" : "Hidden"}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Price</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => patch({ price: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>Daily</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={daily}
                  onChange={(e) => patch({ daily_income: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>Days</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={days}
                  onChange={(e) => patch({ days: Number(e.target.value) })}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {price > 0 ? ((daily / price) * 100).toFixed(1) : "0"}% daily · total{" "}
              {formatMoney(daily * days)} over {days} days
            </p>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                disabled={busy === product.id}
                onClick={() => save(product, false)}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={busy === product.id}
                onClick={() => save(product, true)}
              >
                Save + apply to running
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
