import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Inputs follow the reference theme: a dark vertical gradient with a 1px inset
 * border rather than an outline, so they read as recessed panels.
 */
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "app-panel h-11 w-full px-[15px] text-[15px] text-foreground outline-none placeholder:text-muted-foreground",
        "focus-visible:shadow-[inset_0_0_0_1px_var(--ring)]",
        className,
      )}
      {...props}
    />
  );
}
