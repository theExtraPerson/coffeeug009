"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useOrders, useSessionUser } from "@/hooks/use-app-data";
import { formatKampala, timeUntil } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { payoutClockLabel } from "@/lib/platform";

export default function OrdersPage() {
  const { user } = useSessionUser();
  const { data: orders, isLoading } = useOrders(user?.id);

  return (
    <AppShell title="My plants" back="/me">
      <div className="space-y-3 px-4 py-4">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        {!isLoading && !orders?.length ? (
          <div className="app-card space-y-3 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              You have not activated a processing plant yet.
            </p>
            <Link href="/plants">
              <Button className="w-full">Start processing</Button>
            </Link>
          </div>
        ) : null}

        {(orders ?? []).map((order) => {
          const earned = Number(order.daily_income) * order.days_claimed;
          const total = Number(order.daily_income) * order.days;
          const pct = order.days ? Math.round((order.days_claimed / order.days) * 100) : 0;
          const running = order.status === "active";

          return (
            <article key={order.id} className="app-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold">{order.product_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    Activated {formatKampala(order.created_at)}
                  </p>
                </div>
                <span className={`chip uppercase ${running ? "chip-good" : "chip-off"}`}>
                  {running ? "Running" : "Completed"}
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="brand-gradient h-full rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Day {order.days_claimed} of {order.days}
                {running && order.next_payout_at
                  ? ` · next return ${timeUntil(order.next_payout_at)} (${payoutClockLabel()})`
                  : ""}
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <Tile label="Activated" value={formatMoney(order.price)} />
                <Tile label="Paid so far" value={formatMoney(earned)} accent />
                <Tile label="Total return" value={formatMoney(total)} />
              </div>

              {order.note ? (
                <p className="app-panel mt-3 px-3 py-2 text-xs text-muted-foreground">
                  Note: {order.note}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="stat-tile">
      <div className="text-[10px] font-semibold text-muted-foreground">{label}</div>
      <div className={`mt-0.5 truncate text-sm font-bold ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
    </div>
  );
}
