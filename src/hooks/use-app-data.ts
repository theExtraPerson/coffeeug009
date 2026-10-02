"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { DEFAULT_APP_SETTINGS, mergeAppSettings } from "@/lib/platform";
import type {
  AppSettings,
  EarningsSummary,
  LedgerEntry,
  Payment,
  PlantOrder,
  Product,
  Profile,
  TeamStats,
} from "@/lib/types";

export function useSessionUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: supabaseConfigured() && !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data: row } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      const profile = (row as Profile | null) ?? null;
      if (profile?.referral_code) return profile;

      // Self-heal an account whose profile row or code never landed.
      const { data, error } = await supabase.rpc("ensure_profile");
      if (!error && data) {
        return (Array.isArray(data) ? data[0] : data) as Profile;
      }
      return profile;
    },
  });
}

export function useIsAdmin(userId?: string) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: supabaseConfigured() && !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin")
        .maybeSingle();
      return Boolean(data);
    },
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    enabled: supabaseConfigured(),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
}

export function useOrders(userId?: string) {
  return useQuery({
    queryKey: ["orders", userId],
    enabled: supabaseConfigured() && !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlantOrder[];
    },
  });
}

/** The member's wallet history: every credit and debit, newest first. */
export function useLedger(userId?: string) {
  return useQuery({
    queryKey: ["ledger", userId],
    enabled: supabaseConfigured() && !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as LedgerEntry[];
    },
  });
}

export function usePayments(userId?: string) {
  return useQuery({
    queryKey: ["payments", userId],
    enabled: supabaseConfigured() && !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });
}

/** Balance, returns due, and totals — all computed by the database. */
export function useEarnings(userId?: string) {
  return useQuery({
    queryKey: ["earnings", userId],
    enabled: supabaseConfigured() && !!userId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<EarningsSummary | null> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("earnings_summary");
      if (error) throw error;
      const payload = (typeof data === "string" ? JSON.parse(data) : data) as Record<
        string,
        unknown
      > | null;
      if (!payload || payload.ok === false) return null;
      return {
        balance: Number(payload.balance ?? 0),
        available: Number(payload.available ?? 0),
        reserved: Number(payload.reserved ?? 0),
        ready: Number(payload.ready ?? 0),
        readyDays: Number(payload.ready_days ?? 0),
        dailyRate: Number(payload.daily_rate ?? 0),
        activePlants: Number(payload.active_plants ?? 0),
        nextPayoutAt: (payload.next_payout_at as string | null) ?? null,
        payoutHour: Number(payload.payout_hour ?? 22),
        totalDeposited: Number(payload.total_deposited ?? 0),
        plantEarned: Number(payload.plant_earned ?? 0),
        referralEarned: Number(payload.referral_earned ?? 0),
        totalWithdrawn: Number(payload.total_withdrawn ?? 0),
      };
    },
  });
}

function asAmount(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

/** Coerce the jsonb payload so string amounts still count as invested and earned. */
function normalizeTeamStats(data: unknown): TeamStats {
  const payload = (typeof data === "string" ? JSON.parse(data) : data) as TeamStats | null;
  const levels = (payload?.levels ?? []).map((level) => ({
    level: asAmount(level.level),
    rate: asAmount(level.rate),
    earned: asAmount(level.earned),
    members: asAmount(level.members),
    deposits: asAmount(level.deposits),
    volume: asAmount(level.volume),
    members_list: (level.members_list ?? []).map((member) => ({
      ...member,
      earned: asAmount(member.earned),
      deposited: asAmount(member.deposited),
      volume: asAmount(member.volume),
      rate: member.rate == null ? undefined : asAmount(member.rate),
    })),
  }));
  return {
    total_members: asAmount(payload?.total_members),
    total_volume: asAmount(payload?.total_volume),
    total_deposits: asAmount(payload?.total_deposits),
    total_earned: asAmount(payload?.total_earned),
    levels,
  };
}

export function useTeamStats(userId?: string) {
  return useQuery({
    queryKey: ["team-stats", userId],
    enabled: supabaseConfigured() && !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("team_stats");
      if (error) throw error;
      return normalizeTeamStats(data);
    },
  });
}

export function useAppSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    enabled: supabaseConfigured(),
    queryFn: async (): Promise<AppSettings> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) return DEFAULT_APP_SETTINGS;
      return mergeAppSettings(data as Partial<AppSettings> | null);
    },
  });
}
