"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { activatePlant } from "@/app/actions";
import { formatMoney } from "@/lib/money";
import type { Product } from "@/lib/types";

/** One processing plant: price in, a fixed daily return out, for a fixed term. */
export function PlantCard({
  product,
  signedIn,
  bonusLocked,
}: {
  product: Product;
  signedIn: boolean;
  bonusLocked: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();

  const total = Number(product.daily_income) * Number(product.days);
  const isBonus = product.category === "bonus";
  const locked = isBonus && bonusLocked;

  async function activate() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    if (locked) {
      toast.error("Activate any processing plant first to unlock this bonus");
      return;
    }
    setBusy(true);
    const { error } = await activatePlant(product.id);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`${product.name} is now running. First return at 10PM.`);
    await qc.invalidateQueries();
  }

  return (
    <article className="app-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h3 className="font-display text-base font-semibold">{product.name}</h3>
        <span className={`chip ${isBonus ? "chip-good" : "chip-accent"}`}>
          {isBonus ? "BONUS" : "PLANT"}
        </span>
      </div>

      <Image
        src={product.image_url || "/plants/robusta.svg"}
        alt={product.name}
        width={768}
        height={432}
        sizes="(max-width: 640px) 100vw, 560px"
        className="h-40 w-full bg-muted object-cover"
      />

      <div className="grid grid-cols-2 gap-2.5 p-4">
        <Stat label="ACTIVATE" value={formatMoney(product.price)} />
        <Stat label="DAYS" value={String(product.days)} />
        <Stat label="DAILY AT 10PM" value={formatMoney(product.daily_income)} accent />
        <Stat label="TOTAL RETURN" value={formatMoney(total)} accent />
      </div>

      <div className="px-4 pb-4">
        <Button
          onClick={activate}
          disabled={busy || locked}
          size="lg"
          className="h-12 w-full tracking-[0.1em]"
        >
          {busy ? "Processing…" : locked ? (
            <>
              <Lock className="size-4" />
              Activate a plant first
            </>
          ) : (
            "Activate now"
          )}
        </Button>
      </div>
    </article>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="stat-tile">
      <div className="text-[10px] font-medium tracking-wider text-muted-foreground">{label}</div>
      {/* Amber is reserved for the earning numbers, as on the reference. */}
      <div className={`mt-1 truncate text-base font-bold ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
    </div>
  );
}
