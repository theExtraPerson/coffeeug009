"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { syncPlantReturns } from "@/app/actions";
import { useSessionUser } from "@/hooks/use-app-data";

/**
 * Credits any daily returns that have passed their payout hour. Runs on mount,
 * on window focus, and once a minute, so a member who opens the app after 10PM
 * simply finds the money already in their wallet.
 */
export function SyncPlantReturns() {
  const { user } = useSessionUser();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function run() {
      const result = await syncPlantReturns();
      if (cancelled || !result.amount) return;
      await qc.invalidateQueries();
    }

    void run();
    const onFocus = () => void run();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => void run(), 60_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [user?.id, qc]);

  return null;
}
