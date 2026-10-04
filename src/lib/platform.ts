import type { AppSettings } from "@/lib/types";

/**
 * CoffeeUG platform rules. These mirror `public.app_settings` in the database,
 * which is the authority — these constants are the fallback the UI renders with
 * before settings load, and the defaults a fresh install starts from.
 */

export const BRAND_NAME = "CoffeeUG";
export const COMPANY_NAME = "CoffeeUG Ltd";
export const COMPANY_SLUG = "coffeeugltd";
export const BRAND_TAGLINE = "Grow · Export · Prosper";
export const FOUNDED = "October 2026";

/** A plant returns 10% of its price every day for 20 days. */
export const DAILY_RATE_PERCENT = 10;
export const TERM_DAYS = 20;
/** Returns are credited at 22:00 Africa/Kampala — "10PM daily". */
export const PAYOUT_HOUR = 22;

/** Commission paid to the upline when a downline member activates a plant. */
export const REFERRAL_RATES = [6, 1] as const;

export const SIGNUP_BONUS = 500;
export const MIN_DEPOSIT = 5000;
export const MAX_DEPOSIT = 10_000_000;
export const MIN_WITHDRAW = 3000;
export const MAX_WITHDRAW = 5_000_000;
export const WITHDRAW_FEE_RATE = 0.15;

export const TELEGRAM_CHANNEL_URL = "https://t.me/+x70pBloGZDNmYjg0";
export const TELEGRAM_SUPPORT_URL = "https://t.me/coffeeug";
export const SUPPORT_HANDLE = "@coffeeug";

export const BRAND_LOGO_PATH = "/brand/logo.jpg";
export const HOW_TO_EARN_PATH = "/brand/how-to-earn.jpg";
export const WAYS_OF_EARNING_IMAGE = "/brand/ways-of-earning.jpg";
export const INVITE_IMAGE = "/brand/invite-image.jpg";
export const INVEST_IN_COFFEE_IMAGE = "/brand/invest-in-coffee.jpg";
export const PROCESSING_PLANT_IMAGE = "/plants/processing-plant.jpg";
export const PROCESSING_PLANT_NAME = "Coffee Processing Plant";

export const ABOUT_PARAGRAPHS = [
  "CoffeeUG is a Uganda-focused coffee business built around the opportunities within the coffee industry. We aim to connect people with coffee-related business opportunities while promoting Uganda's coffee sector and its potential.",
  "Our focus is on creating a trusted community, sharing information about new opportunities, and supporting people who want to participate in the coffee business.",
];

export const ABOUT_VISION =
  "To contribute to a stronger and more inclusive coffee business community in Uganda.";
export const ABOUT_MISSION =
  "To create opportunities, build connections, and grow together through coffee.";
export const ABOUT_STRAPLINE = "CoffeeUG — Growing opportunities through coffee.";

function resolveSiteUrl() {
  const explicit = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  return "https://coffeeug.vercel.app/";
}

export const SITE_URL = resolveSiteUrl();

export const DEFAULT_WELCOME_MESSAGE = `Welcome to CoffeeUG!

Deposit to your wallet, activate a processing plant, and your returns arrive at 10PM every day for 20 days.

Tap Channel for updates and Support if you need help.`;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  welcome_message: DEFAULT_WELCOME_MESSAGE,
  telegram_channel_url: TELEGRAM_CHANNEL_URL,
  telegram_support_url: TELEGRAM_SUPPORT_URL,
  about_text: ABOUT_PARAGRAPHS[0],
  payout_hour: PAYOUT_HOUR,
  daily_rate_percent: DAILY_RATE_PERCENT,
  term_days: TERM_DAYS,
  signup_bonus: SIGNUP_BONUS,
  deposit_min: MIN_DEPOSIT,
  deposit_max: MAX_DEPOSIT,
  withdraw_min: MIN_WITHDRAW,
  withdraw_max: MAX_WITHDRAW,
  withdraw_fee_rate: WITHDRAW_FEE_RATE,
  withdraw_start: "08:00",
  withdraw_end: "20:00",
  withdraw_auto: true,
  frozen: false,
};

/** What actually reaches the member's phone after the withdrawal fee. */
export function withdrawNet(amount: number, feeRate = WITHDRAW_FEE_RATE) {
  return Math.round(amount * (1 - feeRate) * 100) / 100;
}

export function withdrawFee(amount: number, feeRate = WITHDRAW_FEE_RATE) {
  return Math.round(amount * feeRate * 100) / 100;
}

export function normalizeTime(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "08:00";
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function mergeAppSettings(row?: Partial<AppSettings> | null): AppSettings {
  const d = DEFAULT_APP_SETTINGS;
  return {
    welcome_message: (row?.welcome_message ?? d.welcome_message).trim() || d.welcome_message,
    telegram_channel_url:
      (row?.telegram_channel_url ?? d.telegram_channel_url).trim() || d.telegram_channel_url,
    telegram_support_url:
      (row?.telegram_support_url ?? d.telegram_support_url).trim() || d.telegram_support_url,
    about_text: (row?.about_text ?? d.about_text).trim() || d.about_text,
    payout_hour: Number(row?.payout_hour ?? d.payout_hour),
    daily_rate_percent: Number(row?.daily_rate_percent ?? d.daily_rate_percent),
    term_days: Number(row?.term_days ?? d.term_days),
    signup_bonus: Number(row?.signup_bonus ?? d.signup_bonus),
    deposit_min: Number(row?.deposit_min ?? d.deposit_min) || d.deposit_min,
    deposit_max: Number(row?.deposit_max ?? d.deposit_max) || d.deposit_max,
    withdraw_min: Number(row?.withdraw_min ?? d.withdraw_min) || d.withdraw_min,
    withdraw_max: Number(row?.withdraw_max ?? d.withdraw_max) || d.withdraw_max,
    withdraw_fee_rate: Number(row?.withdraw_fee_rate ?? d.withdraw_fee_rate),
    withdraw_start: normalizeTime(row?.withdraw_start),
    withdraw_end: normalizeTime(row?.withdraw_end),
    withdraw_auto: row?.withdraw_auto ?? d.withdraw_auto,
    frozen: row?.frozen ?? d.frozen,
  };
}

function kampalaMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kampala",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function timeToMinutes(value: string) {
  const [hour, minute] = normalizeTime(value).split(":").map(Number);
  return hour * 60 + minute;
}

export function isWithdrawWindowOpen(start: string, end: string) {
  const now = kampalaMinutes();
  const from = timeToMinutes(start);
  const to = timeToMinutes(end);
  if (from === to) return true;
  if (from < to) return now >= from && now < to;
  return now >= from || now < to;
}

export function formatWithdrawWindow(start: string, end: string) {
  return `${normalizeTime(start)} – ${normalizeTime(end)} (Africa/Kampala)`;
}

/** "10PM" from payout hour 22, for copy that must match the marketing. */
export function payoutClockLabel(hour = PAYOUT_HOUR) {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${suffix}`;
}
