import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[14px] text-[15px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // The amber gradient with its glow — the only loud button on a screen.
        default: "bg-success text-primary-foreground",
        accent: "bg-leaf text-accent-foreground",
        // Quiet buttons are a hairline of border over the page, never a fill.
        secondary:
          "text-secondary-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:text-foreground",
        outline: "text-primary shadow-[inset_0_0_0_1px_var(--primary)]",
        danger: "bg-success text-destructive-foreground",
        ghost: "text-accent",
      },
      size: {
        default: "h-11 px-[18px]",
        lg: "h-12 px-6",
        sm: "h-8 px-3 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
