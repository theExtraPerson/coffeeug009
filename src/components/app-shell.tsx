"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Download, House, Sprout, User, Users, Share2 } from "@/components/icons";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { BRAND_NAME } from "@/lib/platform";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/plants", label: "Plants", icon: Sprout },
  { href: "/invite", label: "Invite", icon: Share2 },
  { href: "/team", label: "Team", icon: Users },
  { href: "/me", label: "Me", icon: User },
];

function BottomNav() {
  const pathname = usePathname();
  const { installed, install, iosHelp, setIosHelp } = usePwaInstall();

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 bg-[#101220]/95 shadow-[inset_0_1px_0_0_var(--border)] backdrop-blur">
        <div className="mx-auto flex max-w-[560px] items-stretch justify-between px-0.5 py-1.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[14px] px-0.5 py-2 text-[10px] font-medium transition-colors sm:text-[11px]",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.7} />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => void install()}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[14px] px-0.5 py-2 text-[10px] font-medium transition-colors sm:text-[11px]",
              installed ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Download className="size-5" strokeWidth={installed ? 2.2 : 1.7} />
            App
          </button>
        </div>
      </nav>

      {iosHelp ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 pb-28">
          <div className="app-card w-full max-w-[560px] space-y-3 p-5">
            <h2 className="text-lg font-semibold">Add {BRAND_NAME} to your home screen</h2>
            <p className="text-sm text-muted-foreground">
              On iPhone or iPad, tap the Share button in Safari, then tap{" "}
              <span className="font-semibold text-foreground">Add to Home Screen</span>. That
              installs the {BRAND_NAME} app from the site manifest.
            </p>
            <button
              type="button"
              className="brand-gradient h-11 w-full rounded-[14px] text-[15px] font-semibold text-primary-foreground"
              onClick={() => setIosHelp(false)}
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function AppShell({
  children,
  title,
  back,
  hideNav,
  wide,
}: {
  children: React.ReactNode;
  title?: string;
  back?: string;
  hideNav?: boolean;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen">
      <div className={cn("mx-auto pb-28", wide ? "max-w-[720px]" : "max-w-[560px]")}>
        {/* The reference header is transparent and scrolls with the page — the
            glow behind it is the only decoration. */}
        {title ? (
          <header className="flex items-center gap-2 px-6 pb-2 pt-7">
            {back ? (
              <Link
                href={back}
                className="-ml-1 rounded-full p-1 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-6" />
              </Link>
            ) : null}
            <h1 className="text-2xl font-semibold tracking-[-0.015em]">{title}</h1>
          </header>
        ) : null}
        {children}
      </div>
      {hideNav ? null : <BottomNav />}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2.5 text-base font-semibold">{children}</h2>;
}
