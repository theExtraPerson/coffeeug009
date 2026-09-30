"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "@/components/icons";
import { AuthHero } from "@/components/auth-hero";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import {
  captureInviteFromSearch,
  normalizeInviteCode,
  readRememberedInvite,
  rememberInvite,
} from "@/lib/invite";
import { USERNAME_RULES, isValidUsername, usernameToEmail } from "@/lib/username";
import { SIGNUP_BONUS } from "@/lib/platform";
import { formatMoney } from "@/lib/money";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const captured = captureInviteFromSearch(search) || readRememberedInvite();
    if (captured) {
      rememberInvite(captured);
      setInvite(captured);
    }
  }, [search]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (name.trim().length < 2) {
      toast.error("Enter your names");
      return;
    }
    if (!isValidUsername(username)) {
      toast.error(`Username must be ${USERNAME_RULES}`);
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (!supabaseConfigured()) {
      toast.error("Registration is not configured on this deployment.");
      return;
    }

    setBusy(true);
    try {
      // The account is created server-side so the invite, the signup bonus, and
      // the support credential mirror are all attached in one step.
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          username,
          password,
          invite: normalizeInviteCode(invite),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not create the account");

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      });
      if (error) {
        toast.success("Account created. Please log in.");
        router.replace("/login");
        return;
      }

      toast.success(`Welcome to CoffeeUG! ${formatMoney(SIGNUP_BONUS)} bonus added.`);
      router.replace("/");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[560px]">
        <AuthHero />

        <div className="app-card mx-4 mb-16 px-6 pb-8 pt-7">
          <h1 className="text-2xl font-semibold">Open an account</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            A referral code links you to whoever invited you.
          </p>

          <p className="app-panel mt-4 px-3 py-2 text-center text-xs font-semibold text-primary">
            Get {formatMoney(SIGNUP_BONUS)} the moment you register
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Names</Label>
              <Input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full names"
                maxLength={80}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoCapitalize="none"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                placeholder="Choose a username"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">{USERNAME_RULES}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={reveal ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  maxLength={64}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground"
                >
                  {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite">Referral code</Label>
              <Input
                id="invite"
                value={invite}
                onChange={(e) => setInvite(e.target.value.toUpperCase())}
                placeholder="Enter referral code"
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground">
                Optional, but your inviter only earns commission if you enter it now.
              </p>
            </div>

            <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>
              {busy ? "Creating account…" : "Create Account"}
            </Button>
          </form>

          <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-accent">
            I already have an account
          </Link>
        </div>
      </div>
    </div>
  );
}
