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
import { captureInviteFromSearch, readRememberedInvite, rememberInvite } from "@/lib/invite";
import { normalizeUsername, usernameToEmail } from "@/lib/username";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState("");

  // Keep an invite code that arrived on a login link, so it still applies if
  // the visitor turns out to be new and taps through to register.
  useEffect(() => {
    const captured = captureInviteFromSearch(search) || readRememberedInvite();
    if (!captured) return;
    rememberInvite(captured);
    setInvite(captured);
  }, [search]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const handle = normalizeUsername(username);
    if (!handle) {
      toast.error("Enter your username");
      return;
    }
    if (!password) {
      toast.error("Enter your password");
      return;
    }
    if (!supabaseConfigured()) {
      toast.error("Sign-in is not configured on this deployment.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(handle),
        password,
      });
      if (error) {
        throw new Error(
          /invalid/i.test(error.message) ? "Wrong username or password." : error.message,
        );
      }
      toast.success("Welcome back");
      router.replace("/");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[560px]">
        <AuthHero />

        <div className="app-card mx-4 mb-16 px-6 pb-8 pt-7">
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Sign in with the username you registered.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoCapitalize="none"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                maxLength={20}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={reveal ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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

            <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>
              {busy ? "Please wait…" : "Log In"}
            </Button>
          </form>

          <Link
            href={invite ? `/register?ref=${invite}` : "/register"}
            className="mt-6 block text-center text-sm font-semibold text-accent"
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
