"use client";

import { useEffect, useState } from "react";
import { Headphones, Megaphone, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand";
import { BRAND_NAME } from "@/lib/platform";

const STORAGE_KEY = "coffeeug_welcome_seen";

export function WelcomePopup({
  message,
  channelUrl,
  supportUrl,
}: {
  message: string;
  channelUrl: string;
  supportUrl: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Once per device, so returning members are not nagged.
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    setOpen(true);
  }, []);

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="app-card w-full max-w-sm space-y-4 p-5">
        <div className="flex items-start gap-3">
          <Logo size={44} />
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold">Welcome to {BRAND_NAME}</h2>
            <p className="text-xs text-muted-foreground">Grow · Export · Prosper</p>
          </div>
          <button type="button" onClick={dismiss} aria-label="Close" className="p-1">
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        <p className="whitespace-pre-line text-sm text-muted-foreground">{message}</p>

        <div className="grid grid-cols-2 gap-2">
          <a href={channelUrl} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="w-full">
              <Megaphone className="size-4" />
              Channel
            </Button>
          </a>
          <a href={supportUrl} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="w-full">
              <Headphones className="size-4" />
              Support
            </Button>
          </a>
        </div>

        <Button onClick={dismiss} size="lg" className="w-full">
          Start earning
        </Button>
      </div>
    </div>
  );
}
