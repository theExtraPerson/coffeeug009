"use client";

import { useState } from "react";
import { Eye, EyeOff } from "@/components/icons";

export function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="stat-tile">
      <div className="text-[10px] font-semibold text-muted-foreground">{label}</div>
      <div className={`mt-0.5 truncate text-sm font-bold ${accent ? "text-accent" : "text-primary"}`}>
        {value}
      </div>
    </div>
  );
}

/**
 * Reveals a stored login password on tap. Hidden by default so an admin can
 * scroll a member list in public without exposing credentials.
 */
export function SecretValue({ value }: { value: string | null }) {
  const [shown, setShown] = useState(false);
  if (!value) return <span className="text-xs text-muted-foreground">not stored</span>;
  return (
    <button
      type="button"
      onClick={() => setShown((v) => !v)}
      className="app-panel inline-flex items-center gap-1.5 px-2 py-1 font-mono text-xs"
    >
      {shown ? value : "••••••••"}
      {shown ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
    </button>
  );
}
