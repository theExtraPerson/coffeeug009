import * as React from "react";
import { cn } from "@/lib/utils";

/** Small, muted, and above the field — the reference never uses bold labels. */
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-[11px] font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}
