import { Logo } from "@/components/brand";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/platform";

/** Shared banner at the top of the login and register screens. */
export function AuthHero() {
  return (
    <div className="relative flex flex-col items-center justify-center gap-2 px-6 pb-4 pt-10">
      <Logo size={84} className="shadow-lift" />
      <span className="font-display text-2xl font-semibold tracking-tight">{BRAND_NAME}</span>
      <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        {BRAND_TAGLINE}
      </span>
    </div>
  );
}
