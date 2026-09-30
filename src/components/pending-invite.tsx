"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { applyInviteCode } from "@/app/actions";
import { useSessionUser } from "@/hooks/use-app-data";
import { clearRememberedInvite, readRememberedInvite } from "@/lib/invite";
import { supabaseConfigured } from "@/lib/supabase/client";

/**
 * Attaches an invite code that was captured before the member had an account.
 * The upline is permanent once set, so this is a no-op for anyone already linked.
 */
export function PendingInviteApplier() {
  const { user } = useSessionUser();
  const qc = useQueryClient();
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !supabaseConfigured()) return;
    if (ranFor.current === user.id) return;
    const code = readRememberedInvite();
    if (!code) return;

    ranFor.current = user.id;
    void applyInviteCode(code).then((result) => {
      if (result.reason === "rpc") {
        ranFor.current = null;
        return;
      }
      clearRememberedInvite();
      void qc.invalidateQueries({ queryKey: ["profile", user.id] });
      void qc.invalidateQueries({ queryKey: ["team-stats", user.id] });
    });
  }, [user, qc]);

  return null;
}
