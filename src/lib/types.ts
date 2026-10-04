export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  referral_code: string | null;
  referred_by: string | null;
  is_banned?: boolean;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  daily_income: number;
  days: number;
  category: "plant" | "bonus";
  image_url: string | null;
  sort_order: number;
  active: boolean;
};

export type PlantOrder = {
  id: string;
  user_id: string;
  product_id: string | null;
  product_name: string;
  product_category: "plant" | "bonus";
  price: number;
  daily_income: number;
  days: number;
  days_claimed: number;
  first_payout_at: string | null;
  next_payout_at: string | null;
  status: "active" | "completed";
  note: string | null;
  admin_note?: string | null;
  created_at: string;
};

export type LedgerType =
  | "signup_bonus"
  | "deposit"
  | "purchase"
  | "daily_income"
  | "commission"
  | "withdrawal"
  | "withdrawal_fee"
  | "adjustment";

export type LedgerEntry = {
  id: number;
  key: string;
  user_id: string;
  type: LedgerType;
  /** Signed whole shillings: credits positive, debits negative. */
  amount: number;
  note: string | null;
  source_order_id: string | null;
  source_user_id: string | null;
  referral_level: number | null;
  created_at: string;
};

export type PaymentType = "DEPOSIT" | "WITHDRAWAL";
export type PaymentMode = "MARZPAY" | "MANUAL" | "UNASSIGNED";
export type PaymentStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED";

/** Admin-only note written when a payment cannot be verified automatically. */
export const PAYMENT_REVIEW_PREFIX = "Needs check: ";

export type Payment = {
  id: string;
  user_id: string;
  type: PaymentType;
  mode: PaymentMode;
  status: PaymentStatus;
  provider: "MTN" | "AIRTEL" | null;
  amount: number;
  fee: number;
  net_amount: number;
  phone_number: string;
  external_reference: string;
  provider_tx_uuid: string | null;
  provider_reference: string | null;
  failure_reason: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AppSettings = {
  welcome_message: string;
  telegram_channel_url: string;
  telegram_support_url: string;
  about_text: string;
  payout_hour: number;
  daily_rate_percent: number;
  term_days: number;
  signup_bonus: number;
  deposit_min: number;
  deposit_max: number;
  withdraw_min: number;
  withdraw_max: number;
  withdraw_fee_rate: number;
  withdraw_start: string;
  withdraw_end: string;
  withdraw_auto: boolean;
  frozen: boolean;
};

export type TeamMember = {
  name: string | null;
  username: string | null;
  joined_at: string;
  earned: number;
  deposited: number;
  volume: number;
  /** Code this member entered. Level 2 used their inviter's code, not yours. */
  referral_code?: string | null;
  rate?: number;
  /** Level 2 only: the level-1 member who invited them. */
  via_username?: string | null;
};

export type TeamLevel = {
  level: number;
  rate: number;
  earned: number;
  members: number;
  deposits: number;
  volume: number;
  members_list: TeamMember[];
};

export type TeamStats = {
  total_members: number;
  total_volume: number;
  total_deposits: number;
  total_earned: number;
  levels: TeamLevel[];
};

export type EarningsSummary = {
  /** Sum of the append-only ledger. */
  balance: number;
  /** Balance minus anything held by a pending withdrawal. */
  available: number;
  reserved: number;
  /** Returns already earned but not yet written into the wallet. */
  ready: number;
  readyDays: number;
  /** Combined daily return of every running plant. */
  dailyRate: number;
  activePlants: number;
  nextPayoutAt: string | null;
  payoutHour: number;
  totalDeposited: number;
  plantEarned: number;
  referralEarned: number;
  totalWithdrawn: number;
};
