import Image from "next/image";
import Link from "next/link";
import { BRAND_LOGO_PATH, BRAND_NAME, BRAND_TAGLINE } from "@/lib/platform";
import { cn } from "@/lib/utils";

/** The CoffeeUG mark. Used in headers, auth screens, and share cards. */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src={BRAND_LOGO_PATH}
      alt={`${BRAND_NAME} logo`}
      width={size}
      height={size}
      priority={size <= 48}
      className={cn("rounded-full object-cover", className)}
    />
  );
}

export function BrandLockup({
  size = 40,
  tagline = true,
  href = "/",
}: {
  size?: number;
  tagline?: boolean;
  href?: string | null;
}) {
  const content = (
    <span className="flex items-center gap-2.5">
      <Logo size={size} />
      <span className="flex flex-col leading-tight">
        <span className="font-display text-lg font-semibold tracking-tight">{BRAND_NAME}</span>
        {tagline ? (
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {BRAND_TAGLINE}
          </span>
        ) : null}
      </span>
    </span>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}
