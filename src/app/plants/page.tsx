"use client";

import { AppShell } from "@/components/app-shell";
import { PlantCard } from "@/components/plant-card";
import { useOrders, useProducts, useSessionUser } from "@/hooks/use-app-data";
import { DAILY_RATE_PERCENT, TERM_DAYS, payoutClockLabel } from "@/lib/platform";

export default function PlantsPage() {
  const { user } = useSessionUser();
  const { data: products, isLoading } = useProducts();
  const { data: orders } = useOrders(user?.id);

  const bonusLocked = !(orders ?? []).some((o) => o.product_category === "plant");

  return (
    <AppShell title="Processing plants" back="/">
      <div className="px-4 py-4">
        <p className="app-card p-4 text-sm text-muted-foreground">
          Every plant returns{" "}
          <span className="font-bold text-accent">{DAILY_RATE_PERCENT}% of its price per day</span>{" "}
          for {TERM_DAYS} days, credited at {payoutClockLabel()} once the coffee is processed and
          sold to market vendors.
        </p>
      </div>

      <div className="space-y-4 px-4 pb-4">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading plants…</p> : null}
        {(products ?? []).map((product) => (
          <PlantCard
            key={product.id}
            product={product}
            signedIn={Boolean(user)}
            bonusLocked={bonusLocked}
          />
        ))}
        {!isLoading && !products?.length ? (
          <p className="app-card p-4 text-sm text-muted-foreground">
            No plants are available right now.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
