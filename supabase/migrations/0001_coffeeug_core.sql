-- CoffeeUG core schema — CoffeeUG Ltd (coffeeugltd)
--
-- Money model, decided once and enforced here rather than in the UI:
--
--   * The wallet balance is ALWAYS the sum of public.ledger_entries. No table
--     stores a mutable balance, so a balance can never drift from its history.
--   * Every credit carries a unique idempotency `key`, so a retried webhook,
--     a double-tapped button, or a re-run repair can never pay twice.
--   * Amounts are integer whole shillings. UGX is zero-decimal: no cents,
--     no floats, no rounding drift.
--   * Members never write money tables directly. Every movement goes through a
--     security-definer function in this file, and RLS blocks the rest.
--
-- Business rules (CoffeeUG):
--   * Processing plants return 10% of the price per day for 30 days.
--   * Returns land at 22:00 Africa/Kampala each day ("10PM daily").
--   * Referral commission is 6% on level 1 and 1% on level 2, paid when a
--     downline member activates a plant.
--   * Registration bonus is UGX 500.
--   * Withdrawals start at UGX 3,000 and carry a 10% fee.
--
-- Safe to run more than once. Paste the whole file into the Supabase SQL editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text,
  username       text unique,
  phone          text,
  referral_code  text unique not null,
  referred_by    uuid references public.profiles(id),
  is_banned      boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role    public.app_role not null,
  primary key (user_id, role)
);

-- Admin-readable credential mirror. Requested so support can recover a
-- member's login. Deliberately has NO row-level policies: the anon and
-- authenticated roles cannot reach it at all, only the service role can.
create table if not exists public.user_secrets (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  password   text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  price        numeric(14,2) not null,
  daily_income numeric(14,2) not null,
  days         integer not null,
  category     text not null default 'plant' check (category in ('plant', 'bonus')),
  image_url    text,
  sort_order   integer not null default 0,
  active       boolean not null default true
);

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  product_id       uuid references public.products(id),
  product_name     text not null,
  product_category text not null default 'plant',
  price            numeric(14,2) not null,
  daily_income     numeric(14,2) not null,
  days             integer not null,
  days_claimed     integer not null default 0,
  first_payout_at  timestamptz,
  next_payout_at   timestamptz,
  status           text not null default 'active' check (status in ('active', 'completed')),
  -- Free-text note the member sees, plus a private note only admins read.
  note             text,
  admin_note       text,
  created_at       timestamptz not null default now()
);

-- Append-only wallet. The balance is the sum of this table, never a column.
create table if not exists public.ledger_entries (
  id              bigserial primary key,
  key             text not null unique,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  type            text not null check (type in (
                    'signup_bonus', 'deposit', 'purchase', 'daily_income',
                    'commission', 'withdrawal', 'withdrawal_fee', 'adjustment'
                  )),
  -- Signed whole shillings: credits positive, debits negative.
  amount          numeric(14,2) not null,
  note            text,
  source_order_id uuid references public.orders(id) on delete set null,
  source_user_id  uuid references public.profiles(id) on delete set null,
  referral_level  integer,
  created_at      timestamptz not null default now()
);

create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  type               text not null check (type in ('DEPOSIT', 'WITHDRAWAL')),
  -- MARZPAY: the gateway moves the money. MANUAL: an admin settles it by hand.
  mode               text not null default 'MARZPAY' check (mode in ('MARZPAY', 'MANUAL')),
  status             text not null default 'PENDING'
                     check (status in ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED')),
  provider           text check (provider in ('MTN', 'AIRTEL')),
  amount             numeric(14,2) not null,
  -- Withdrawals only: the 10% charge and what actually reaches the phone.
  fee                numeric(14,2) not null default 0,
  net_amount         numeric(14,2) not null default 0,
  phone_number       text not null,
  external_reference text not null unique,
  provider_tx_uuid   text,
  provider_reference text,
  failure_reason     text,
  admin_note         text,
  reviewed_by        uuid references public.profiles(id),
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.referrals (
  referrer_id   uuid not null references public.profiles(id) on delete cascade,
  referee_id    uuid primary key references public.profiles(id) on delete cascade,
  referral_code text not null default '',
  created_at    timestamptz not null default now()
);

create table if not exists public.app_settings (
  id                  int primary key default 1 check (id = 1),
  welcome_message     text not null default '',
  telegram_channel_url text not null default 'https://t.me/coffeeug',
  telegram_support_url text not null default 'https://t.me/coffeeug',
  about_text          text not null default '',
  -- Returns are credited at this Kampala hour each day. 22 == 10PM.
  payout_hour         integer not null default 22 check (payout_hour between 0 and 23),
  daily_rate_percent  numeric(6,2) not null default 10,
  term_days           integer not null default 30,
  signup_bonus        numeric(14,2) not null default 500,
  deposit_min         numeric(14,2) not null default 1000,
  deposit_max         numeric(14,2) not null default 10000000,
  withdraw_min        numeric(14,2) not null default 3000,
  withdraw_max        numeric(14,2) not null default 5000000,
  withdraw_fee_rate   numeric(6,4) not null default 0.10,
  withdraw_start      text not null default '08:00',
  withdraw_end        text not null default '20:00',
  withdraw_auto       boolean not null default true,
  frozen              boolean not null default false
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

create index if not exists ledger_user_idx        on public.ledger_entries (user_id, created_at desc);
create index if not exists ledger_type_idx        on public.ledger_entries (type);
create index if not exists orders_user_status_idx on public.orders (user_id, status);
create index if not exists payments_user_idx      on public.payments (user_id, created_at desc);
create index if not exists payments_type_status   on public.payments (type, status);
create index if not exists profiles_referred_idx  on public.profiles (referred_by);
create index if not exists profiles_code_upper_idx on public.profiles (upper(btrim(referral_code)));
create index if not exists profiles_username_idx  on public.profiles (lower(btrim(username)));

-- One commission per order per level, forever.
create unique index if not exists ledger_commission_order_level_uidx
  on public.ledger_entries (source_order_id, referral_level)
  where type = 'commission' and source_order_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Settings, roles, and the payout clock
-- ---------------------------------------------------------------------------

create or replace function public.settings()
returns public.app_settings
language sql
stable
as $$
  select * from public.app_settings where id = 1;
$$;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = uid and role = 'admin'
  );
$$;

create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  code text;
begin
  loop
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.profiles where referral_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.referral_rate(_level integer)
returns numeric
language sql
stable
as $$
  select case _level when 1 then 6.0 when 2 then 1.0 else 0 end;
$$;

-- The first daily return lands at the next payout hour (22:00 Kampala by
-- default) strictly after the purchase. "Your returns come at 10PM daily."
create or replace function public.first_payout_at(_created_at timestamptz)
returns timestamptz
language sql
stable
as $$
  with s as (select payout_hour from public.app_settings where id = 1),
  local as (
    select
      (_created_at at time zone 'Africa/Kampala')::date as d,
      (_created_at at time zone 'Africa/Kampala')::time as t,
      (select payout_hour from s) as h
  )
  select case
    when local.t < make_time(local.h, 0, 0)
      then ((local.d + make_time(local.h, 0, 0)) at time zone 'Africa/Kampala')
    else ((local.d + 1 + make_time(local.h, 0, 0)) at time zone 'Africa/Kampala')
  end
  from local;
$$;

-- How many daily returns a plant has earned so far, capped at its term.
create or replace function public.program_elapsed_days(_created_at timestamptz, _days integer)
returns integer
language sql
stable
as $$
  select greatest(0, least(
    _days,
    case
      when now() < public.first_payout_at(_created_at) then 0
      else 1 + floor(
        extract(epoch from (now() - public.first_payout_at(_created_at))) / 86400
      )::integer
    end
  ));
$$;

create or replace function public.payout_at(_created_at timestamptz, _index integer)
returns timestamptz
language sql
stable
as $$
  select public.first_payout_at(_created_at) + make_interval(days => greatest(0, _index - 1));
$$;

create or replace function public.withdraw_window_open(_start text default null, _end text default null)
returns boolean
language plpgsql
stable
as $$
declare
  s public.app_settings;
  now_m integer;
  start_m integer;
  end_m integer;
  start_raw text;
  end_raw text;
begin
  select * into s from public.app_settings where id = 1;
  start_raw := coalesce(nullif(btrim(coalesce(_start, s.withdraw_start)), ''), '08:00');
  end_raw   := coalesce(nullif(btrim(coalesce(_end, s.withdraw_end)), ''), '20:00');

  now_m := extract(hour from timezone('Africa/Kampala', now()))::integer * 60
         + extract(minute from timezone('Africa/Kampala', now()))::integer;
  start_m := split_part(start_raw, ':', 1)::integer * 60 + split_part(start_raw, ':', 2)::integer;
  end_m   := split_part(end_raw, ':', 1)::integer * 60 + split_part(end_raw, ':', 2)::integer;

  if start_m = end_m then return true; end if;
  if start_m < end_m then return now_m >= start_m and now_m < end_m; end if;
  return now_m >= start_m or now_m < end_m;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Wallet: balance is derived, entries are append-only
-- ---------------------------------------------------------------------------

/**
 * The only way anything is ever written to the wallet. Returns true when the
 * entry was appended, false when `_key` had already been used — callers can
 * retry freely without paying twice.
 */
create or replace function public.ledger_append(
  _user uuid,
  _type text,
  _amount numeric,
  _key text,
  _note text default null,
  _order uuid default null,
  _source_user uuid default null,
  _level integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if _user is null or _amount is null or _amount = 0 then
    return false;
  end if;

  insert into public.ledger_entries (
    key, user_id, type, amount, note, source_order_id, source_user_id, referral_level
  ) values (
    _key, _user, _type, round(_amount, 2), _note, _order, _source_user, _level
  );
  return true;
exception when unique_violation then
  return false;
end;
$$;

create or replace function public.wallet_balance(_user uuid default auth.uid())
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)
  from public.ledger_entries
  where user_id = _user;
$$;

-- A pending withdrawal holds its full gross amount. The ledger is not touched
-- until the payout actually succeeds, so a failure costs the member nothing.
create or replace function public.reserved_balance(_user uuid default auth.uid())
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)
  from public.payments
  where user_id = _user
    and type = 'WITHDRAWAL'
    and status in ('PENDING', 'PROCESSING');
$$;

create or replace function public.available_balance(_user uuid default auth.uid())
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select public.wallet_balance(_user) - public.reserved_balance(_user);
$$;

-- ---------------------------------------------------------------------------
-- 4. Signup, invite codes, and the referral graph
-- ---------------------------------------------------------------------------

create or replace function public.invite_code_from_meta(_meta jsonb)
returns text
language sql
immutable
as $$
  select upper(btrim(coalesce(
    nullif(_meta->>'invite_code', ''),
    nullif(_meta->>'invite', ''),
    nullif(_meta->>'ref', ''),
    ''
  )));
$$;

create or replace function public.find_referrer(_code text, _self uuid default null)
returns uuid
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  invite text := upper(btrim(coalesce(_code, '')));
  referrer uuid;
begin
  if invite = '' then return null; end if;
  select id into referrer
  from public.profiles
  where upper(btrim(referral_code)) = invite
    and (_self is null or id <> _self)
  limit 1;
  return referrer;
end;
$$;

create or replace function public.log_referral(_referrer uuid, _referee uuid, _code text)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  code text;
begin
  if _referrer is null or _referee is null or _referrer = _referee then
    return;
  end if;

  select upper(btrim(coalesce(nullif(_code, ''), referral_code, '')))
  into code from public.profiles where id = _referrer;

  insert into public.referrals (referrer_id, referee_id, referral_code)
  values (_referrer, _referee, coalesce(code, ''))
  on conflict (referee_id) do nothing;

  update public.profiles
  set referred_by = _referrer
  where id = _referee and referred_by is null;
end;
$$;

/** Registration bonus. Idempotent: one bonus per account, ever. */
create or replace function public.grant_signup_bonus(_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  bonus numeric;
begin
  select signup_bonus into bonus from public.app_settings where id = 1;
  if coalesce(bonus, 0) <= 0 then return false; end if;

  return public.ledger_append(
    _user, 'signup_bonus', bonus, 'signup:' || _user::text, 'Registration bonus'
  );
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  invite text;
  referrer uuid;
  uname text;
begin
  invite := public.invite_code_from_meta(new.raw_user_meta_data);
  referrer := public.find_referrer(invite, new.id);
  uname := nullif(btrim(lower(coalesce(new.raw_user_meta_data->>'username', ''))), '');

  insert into public.profiles (id, full_name, username, phone, referral_code, referred_by)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), 'Member'),
    uname,
    nullif(coalesce(new.raw_user_meta_data->>'phone', ''), ''),
    public.generate_referral_code(),
    referrer
  )
  on conflict (id) do update
    set referred_by = coalesce(public.profiles.referred_by, excluded.referred_by),
        username    = coalesce(public.profiles.username, excluded.username),
        full_name   = coalesce(nullif(btrim(public.profiles.full_name), ''), excluded.full_name);

  if referrer is not null then
    perform public.log_referral(referrer, new.id, invite);
  end if;

  perform public.grant_signup_bonus(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

/** Self-heal for accounts created before the trigger, or with a missing code. */
create or replace function public.ensure_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  uid uuid := auth.uid();
  meta jsonb;
  invite text;
  referrer uuid;
  prof public.profiles%rowtype;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into prof from public.profiles where id = uid;
  if not found then
    select raw_user_meta_data into meta from auth.users where id = uid;
    invite := public.invite_code_from_meta(meta);
    referrer := public.find_referrer(invite, uid);

    insert into public.profiles (id, full_name, username, phone, referral_code, referred_by)
    values (
      uid,
      coalesce(nullif(btrim(coalesce(meta->>'full_name', '')), ''), 'Member'),
      nullif(btrim(lower(coalesce(meta->>'username', ''))), ''),
      nullif(coalesce(meta->>'phone', ''), ''),
      public.generate_referral_code(),
      referrer
    )
    on conflict (id) do nothing;

    if referrer is not null then
      perform public.log_referral(referrer, uid, invite);
    end if;
    select * into prof from public.profiles where id = uid;
  end if;

  if prof.referral_code is null or btrim(prof.referral_code) = '' then
    update public.profiles set referral_code = public.generate_referral_code() where id = uid;
    select * into prof from public.profiles where id = uid;
  end if;

  if prof.referred_by is null then
    select raw_user_meta_data into meta from auth.users where id = uid;
    invite := public.invite_code_from_meta(meta);
    referrer := public.find_referrer(invite, uid);
    if referrer is not null then
      perform public.log_referral(referrer, uid, invite);
      select * into prof from public.profiles where id = uid;
    end if;
  elsif not exists (select 1 from public.referrals where referee_id = uid) then
    perform public.log_referral(
      prof.referred_by, uid,
      (select referral_code from public.profiles where id = prof.referred_by)
    );
  end if;

  perform public.grant_signup_bonus(uid);
  return to_jsonb(prof);
end;
$$;

/** Attach an upline after the fact. An upline is permanent once set. */
create or replace function public.apply_invite(_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  uid uuid := auth.uid();
  referrer uuid;
  prof public.profiles%rowtype;
  in_downline boolean;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into prof from public.profiles where id = uid;
  if not found then
    perform public.ensure_profile();
    select * into prof from public.profiles where id = uid;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'linked', false, 'reason', 'no_profile');
  end if;

  if prof.referred_by is not null then
    if not exists (select 1 from public.referrals where referee_id = uid) then
      perform public.log_referral(
        prof.referred_by, uid,
        (select referral_code from public.profiles where id = prof.referred_by)
      );
    end if;
    return jsonb_build_object('ok', true, 'linked', false, 'reason', 'already_linked');
  end if;

  referrer := public.find_referrer(_code, uid);
  if referrer is null then
    return jsonb_build_object('ok', false, 'linked', false, 'reason', 'invalid_code');
  end if;
  if referrer = uid
     or upper(btrim(coalesce(prof.referral_code, ''))) = upper(btrim(coalesce(_code, ''))) then
    return jsonb_build_object('ok', false, 'linked', false, 'reason', 'own_code');
  end if;

  select exists (
    with recursive down as (
      select id from public.profiles where referred_by = uid
      union
      select p.id from public.profiles p join down d on p.referred_by = d.id
    )
    select 1 from down where id = referrer
  ) into in_downline;
  if in_downline then
    return jsonb_build_object('ok', false, 'linked', false, 'reason', 'cycle');
  end if;

  perform public.log_referral(referrer, uid, _code);
  return jsonb_build_object('ok', true, 'linked', true, 'reason', 'linked');
end;
$$;

create or replace function public.invite_preview(_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  rec public.profiles%rowtype;
  invite text := upper(btrim(coalesce(_code, '')));
begin
  if invite = '' then return jsonb_build_object('ok', false); end if;
  select * into rec from public.profiles
  where upper(btrim(referral_code)) = invite limit 1;
  if not found then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object(
    'ok', true,
    'name', coalesce(nullif(btrim(rec.full_name), ''), 'CoffeeUG member'),
    'code', rec.referral_code
  );
end;
$$;

/** Username -> login email, so the sign-in form can take a username. */
create or replace function public.username_available(_username text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select not exists (
    select 1 from public.profiles
    where lower(btrim(username)) = lower(btrim(coalesce(_username, '')))
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Commissions: 6% on level 1, 1% on level 2
-- ---------------------------------------------------------------------------

create or replace function public.pay_referral_commissions(
  _buyer uuid,
  _order_id uuid,
  _amount numeric,
  _buyer_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  chain record;
  rate numeric;
  commission_amt numeric;
begin
  if _buyer is null or _order_id is null or coalesce(_amount, 0) <= 0 then
    return;
  end if;

  for chain in
    with recursive walk as (
      select coalesce(p.referred_by, r.referrer_id) as id, 1 as lvl, array[_buyer] as seen
      from public.profiles p
      left join public.referrals r on r.referee_id = p.id
      where p.id = _buyer
        and coalesce(p.referred_by, r.referrer_id) is not null
      union all
      select coalesce(p.referred_by, r.referrer_id), w.lvl + 1, w.seen || w.id
      from walk w
      join public.profiles p on p.id = w.id
      left join public.referrals r on r.referee_id = p.id
      where w.lvl < 2
        and coalesce(p.referred_by, r.referrer_id) is not null
        and not (coalesce(p.referred_by, r.referrer_id) = any (w.seen))
    )
    select w.id, w.lvl from walk w
    where w.id is not null and w.id <> _buyer
    order by w.lvl
  loop
    rate := public.referral_rate(chain.lvl);
    commission_amt := round(_amount * rate / 100.0, 2);
    if commission_amt <= 0 then continue; end if;

    -- The unique index on (source_order_id, referral_level) is the real guard;
    -- the key keeps the message readable in the member's history.
    perform public.ledger_append(
      chain.id,
      'commission',
      commission_amt,
      format('com:%s:L%s', _order_id, chain.lvl),
      format(
        'Level %s (%s%%) — %s',
        chain.lvl,
        trim(trailing '.' from trim(trailing '0' from rate::text)),
        coalesce(_buyer_name, 'Member')
      ),
      _order_id,
      _buyer,
      chain.lvl
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Activating a plant
-- ---------------------------------------------------------------------------

create or replace function public.purchase_product(_product_id uuid, _note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prod public.products%rowtype;
  buyer public.profiles%rowtype;
  s public.app_settings;
  order_id uuid;
  avail numeric;
  has_plant boolean;
  created timestamptz := now();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into s from public.app_settings where id = 1;
  if s.frozen then raise exception 'Activations are paused. Please try again later'; end if;

  select * into buyer from public.profiles where id = uid for update;
  if not found then raise exception 'Profile not found'; end if;
  if buyer.is_banned then raise exception 'Account is suspended'; end if;

  select * into prod from public.products where id = _product_id and active = true;
  if not found then raise exception 'That plant is not available'; end if;

  -- Bonus plants are a reward for real members, not a way in.
  if prod.category = 'bonus' then
    select exists (
      select 1 from public.orders o where o.user_id = uid and o.product_category = 'plant'
    ) into has_plant;
    if not has_plant then
      raise exception 'Activate any processing plant first to unlock this bonus';
    end if;
  end if;

  -- Money already promised to a pending withdrawal cannot also buy a plant.
  avail := public.available_balance(uid);
  if avail < prod.price then
    raise exception 'Not enough wallet balance. Deposit first';
  end if;

  insert into public.orders (
    user_id, product_id, product_name, product_category, price, daily_income,
    days, days_claimed, status, note, created_at, first_payout_at, next_payout_at
  ) values (
    uid, prod.id, prod.name, prod.category, prod.price, prod.daily_income,
    prod.days, 0, 'active', nullif(btrim(coalesce(_note, '')), ''), created,
    public.first_payout_at(created), public.first_payout_at(created)
  )
  returning id into order_id;

  perform public.ledger_append(
    uid, 'purchase', -prod.price, format('buy:%s', order_id), prod.name, order_id
  );

  perform public.pay_referral_commissions(
    uid, order_id, prod.price, coalesce(buyer.full_name, 'Member')
  );

  return jsonb_build_object(
    'ok', true,
    'order_id', order_id,
    'first_payout_at', public.first_payout_at(created),
    'balance', public.wallet_balance(uid)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Daily returns, credited at the payout hour
-- ---------------------------------------------------------------------------

create or replace function public.claim_daily_income()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rec public.orders%rowtype;
  elapsed integer;
  payable integer;
  credited numeric := 0;
  paid_days integer := 0;
  plants integer := 0;
  d integer;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.profiles where id = uid and is_banned) then
    raise exception 'Account is suspended';
  end if;

  for rec in
    select * from public.orders
    where user_id = uid and status = 'active'
    order by created_at
    for update
  loop
    elapsed := public.program_elapsed_days(rec.created_at, rec.days);
    payable := greatest(0, elapsed - rec.days_claimed);
    if payable <= 0 then continue; end if;

    -- One ledger entry per plant-day, so a member can audit every return and a
    -- re-run can never double-credit the same day.
    for d in (rec.days_claimed + 1)..elapsed loop
      if public.ledger_append(
        uid,
        'daily_income',
        rec.daily_income,
        format('inc:%s:%s', rec.id, d),
        format('%s — day %s of %s', rec.product_name, d, rec.days),
        rec.id
      ) then
        credited := credited + rec.daily_income;
        paid_days := paid_days + 1;
      end if;
    end loop;

    update public.orders
    set days_claimed = elapsed,
        next_payout_at = case
          when elapsed >= rec.days then null
          else public.payout_at(rec.created_at, elapsed + 1)
        end,
        status = case when elapsed >= rec.days then 'completed' else 'active' end
    where id = rec.id;

    plants := plants + 1;
  end loop;

  if credited <= 0 then
    return jsonb_build_object('ok', false, 'amount', 0, 'days', 0, 'plants', 0, 'reason', 'nothing_due');
  end if;

  return jsonb_build_object(
    'ok', true, 'amount', credited, 'days', paid_days, 'plants', plants,
    'reason', 'credited', 'balance', public.wallet_balance(uid)
  );
end;
$$;

/** Everything the wallet card needs, computed server side. */
create or replace function public.earnings_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s public.app_settings;
  ready numeric := 0;
  ready_days integer := 0;
  daily numeric := 0;
  active_count integer := 0;
  next_at timestamptz;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into s from public.app_settings where id = 1;

  select
    coalesce(sum(o.daily_income * greatest(0, public.program_elapsed_days(o.created_at, o.days) - o.days_claimed)), 0),
    coalesce(sum(greatest(0, public.program_elapsed_days(o.created_at, o.days) - o.days_claimed)), 0),
    coalesce(sum(o.daily_income), 0),
    count(*),
    min(public.payout_at(o.created_at, o.days_claimed + 1))
  into ready, ready_days, daily, active_count, next_at
  from public.orders o
  where o.user_id = uid and o.status = 'active';

  return jsonb_build_object(
    'ok', true,
    'balance', public.wallet_balance(uid),
    'available', public.available_balance(uid),
    'reserved', public.reserved_balance(uid),
    'ready', ready,
    'ready_days', ready_days,
    'daily_rate', daily,
    'active_plants', active_count,
    'next_payout_at', next_at,
    'payout_hour', s.payout_hour,
    'total_deposited', (
      select coalesce(sum(amount), 0) from public.ledger_entries
      where user_id = uid and type = 'deposit'
    ),
    'plant_earned', (
      select coalesce(sum(amount), 0) from public.ledger_entries
      where user_id = uid and type = 'daily_income'
    ),
    'referral_earned', (
      select coalesce(sum(amount), 0) from public.ledger_entries
      where user_id = uid and type = 'commission'
    ),
    'total_withdrawn', (
      select coalesce(-sum(amount), 0) from public.ledger_entries
      where user_id = uid and type in ('withdrawal', 'withdrawal_fee')
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Team stats for levels 1-2
-- ---------------------------------------------------------------------------

create or replace function public.team_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  with recursive walk as (
    select p.id, p.referred_by, p.username, p.full_name, p.phone, p.created_at, 1 as lvl
    from public.profiles p
    where p.id <> uid
      and (
        p.referred_by = uid
        or exists (select 1 from public.referrals r where r.referrer_id = uid and r.referee_id = p.id)
      )
    union all
    select p.id, p.referred_by, p.username, p.full_name, p.phone, p.created_at, w.lvl + 1
    from public.profiles p
    join walk w on w.lvl < 2 and p.id <> uid and p.id <> w.id
    where p.referred_by = w.id
       or exists (select 1 from public.referrals r where r.referrer_id = w.id and r.referee_id = p.id)
  ),
  tree as (
    select distinct on (id) id, referred_by, username, full_name, phone, created_at, lvl
    from walk order by id, lvl
  ),
  volume as (
    select user_id, coalesce(-sum(amount), 0) as vol
    from public.ledger_entries where type = 'purchase' group by user_id
  ),
  deposited as (
    select user_id, coalesce(sum(amount), 0) as dep
    from public.ledger_entries where type = 'deposit' group by user_id
  ),
  earned_from as (
    select source_user_id, referral_level, coalesce(sum(amount), 0) as earned
    from public.ledger_entries
    where user_id = uid and type = 'commission' and referral_level is not null
    group by source_user_id, referral_level
  ),
  level_earned as (
    select referral_level as lvl, coalesce(sum(amount), 0) as earned
    from public.ledger_entries
    where user_id = uid and type = 'commission' and referral_level is not null
    group by referral_level
  ),
  leveled as (
    select t.lvl as level, t.id, t.username, t.full_name, t.created_at,
           coalesce(v.vol, 0) as volume,
           coalesce(d.dep, 0) as deposited,
           coalesce(e.earned, 0) as earned
    from tree t
    left join volume v on v.user_id = t.id
    left join deposited d on d.user_id = t.id
    left join earned_from e on e.source_user_id = t.id and e.referral_level = t.lvl
  )
  select jsonb_build_object(
    'total_members', (select count(*) from tree),
    'total_volume', (select coalesce(sum(volume), 0) from leveled),
    'total_deposits', (select coalesce(sum(deposited), 0) from leveled),
    'total_earned', (
      select coalesce(sum(amount), 0) from public.ledger_entries
      where user_id = uid and type = 'commission'
    ),
    'levels', (
      select coalesce(jsonb_agg(level_obj order by level), '[]'::jsonb)
      from (
        select g.level,
          jsonb_build_object(
            'level', g.level,
            'rate', public.referral_rate(g.level),
            'earned', coalesce((select le.earned from level_earned le where le.lvl = g.level), 0),
            'members', count(l.id),
            'deposits', coalesce(sum(l.deposited), 0),
            'volume', coalesce(sum(l.volume), 0),
            'members_list', coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'name', l.full_name,
                  'username', l.username,
                  'joined_at', l.created_at,
                  'earned', l.earned,
                  'deposited', l.deposited,
                  'volume', l.volume
                ) order by l.earned desc, l.volume desc, l.created_at
              ) filter (where l.id is not null),
              '[]'::jsonb
            )
          ) as level_obj
        from (select 1 as level union all select 2) g
        left join leveled l on l.level = g.level
        group by g.level
      ) s
    )
  ) into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Withdrawals: reserve on request, settle on confirmation
-- ---------------------------------------------------------------------------

/**
 * Create a withdrawal request. This reserves the gross amount by existing as a
 * PENDING row — `available_balance` drops immediately — but writes nothing to
 * the ledger. The debit happens only in settle_payment on a confirmed payout.
 */
create or replace function public.request_withdrawal(
  _amount numeric,
  _phone text,
  _provider text default null,
  _reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s public.app_settings;
  avail numeric;
  fee numeric;
  net numeric;
  pay_id uuid;
  mode text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into s from public.app_settings where id = 1;

  if s.frozen then raise exception 'Withdrawals are temporarily paused'; end if;
  if exists (select 1 from public.profiles where id = uid and is_banned) then
    raise exception 'Account is suspended';
  end if;
  if not public.withdraw_window_open(s.withdraw_start, s.withdraw_end) then
    raise exception 'Withdrawals are open % - % (Africa/Kampala)', s.withdraw_start, s.withdraw_end;
  end if;
  if _amount is null or _amount < s.withdraw_min then
    raise exception 'Minimum withdrawal is UGX %', trunc(s.withdraw_min);
  end if;
  if _amount > s.withdraw_max then
    raise exception 'Maximum withdrawal is UGX %', trunc(s.withdraw_max);
  end if;

  avail := public.available_balance(uid);
  if _amount > avail then
    raise exception 'Amount is more than your available balance (UGX %)', trunc(avail);
  end if;

  fee := round(_amount * s.withdraw_fee_rate, 2);
  net := _amount - fee;
  mode := case when s.withdraw_auto then 'MARZPAY' else 'MANUAL' end;

  insert into public.payments (
    user_id, type, mode, status, provider, amount, fee, net_amount,
    phone_number, external_reference
  ) values (
    uid, 'WITHDRAWAL', mode, 'PENDING', nullif(_provider, ''), _amount, fee, net,
    _phone, coalesce(nullif(btrim(coalesce(_reference, '')), ''), gen_random_uuid()::text)
  )
  returning id into pay_id;

  return jsonb_build_object(
    'ok', true, 'payment_id', pay_id, 'mode', mode,
    'amount', _amount, 'fee', fee, 'net', net,
    'available', public.available_balance(uid)
  );
end;
$$;

/**
 * The single settlement point. Webhooks, status polls, and admin review all
 * converge here, and it is safe to call repeatedly:
 *   deposit  SUCCESS -> credit the wallet, then pay the upline nothing (the
 *                       commission belongs to plant activation, not deposits)
 *   withdraw SUCCESS -> debit net + fee as two entries summing to the gross
 *   any      FAILED  -> release the reservation, touch no money
 */
create or replace function public.settle_payment(
  _payment_id uuid,
  _ok boolean,
  _reason text default null,
  _provider_tx text default null,
  _reviewer uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.payments%rowtype;
begin
  select * into p from public.payments where id = _payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Terminal states never change, so a replayed webhook is a no-op.
  if p.status in ('SUCCESS', 'FAILED', 'CANCELLED') then
    return jsonb_build_object('ok', true, 'reason', 'already_final', 'status', p.status);
  end if;

  if _ok then
    update public.payments
    set status = 'SUCCESS',
        provider_tx_uuid = coalesce(_provider_tx, provider_tx_uuid),
        reviewed_by = coalesce(_reviewer, reviewed_by),
        reviewed_at = case when _reviewer is not null then now() else reviewed_at end,
        updated_at = now()
    where id = p.id;

    if p.type = 'DEPOSIT' then
      perform public.ledger_append(
        p.user_id, 'deposit', p.amount,
        format('dep:%s', p.id),
        format('Deposit %s', coalesce(p.provider, 'mobile money'))
      );
    else
      perform public.ledger_append(
        p.user_id, 'withdrawal', -p.net_amount,
        format('wd:%s', p.id),
        format('Withdrawal to %s', p.phone_number)
      );
      if p.fee > 0 then
        perform public.ledger_append(
          p.user_id, 'withdrawal_fee', -p.fee,
          format('wdfee:%s', p.id), 'Withdrawal fee'
        );
      end if;
    end if;
  else
    update public.payments
    set status = 'FAILED',
        failure_reason = coalesce(_reason, 'Payment was not completed'),
        reviewed_by = coalesce(_reviewer, reviewed_by),
        reviewed_at = case when _reviewer is not null then now() else reviewed_at end,
        updated_at = now()
    where id = p.id;
  end if;

  return jsonb_build_object(
    'ok', true, 'status', case when _ok then 'SUCCESS' else 'FAILED' end,
    'balance', public.wallet_balance(p.user_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Admin
-- ---------------------------------------------------------------------------

create or replace function public.admin_update_product(
  _product_id uuid,
  _name text default null,
  _price numeric default null,
  _daily_income numeric default null,
  _days integer default null,
  _category text default null,
  _active boolean default null,
  _apply_to_running boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prod public.products%rowtype;
  touched integer := 0;
begin
  if uid is not null and not public.is_admin(uid) then
    raise exception 'Admin access required';
  end if;

  select * into prod from public.products where id = _product_id;
  if not found then raise exception 'Plant not found'; end if;
  if _days is not null and _days < 1 then raise exception 'Days must be at least 1'; end if;
  if _price is not null and _price < 0 then raise exception 'Price cannot be negative'; end if;
  if _daily_income is not null and _daily_income < 0 then
    raise exception 'Daily return cannot be negative';
  end if;
  if _category is not null and _category not in ('plant', 'bonus') then
    raise exception 'Category must be plant or bonus';
  end if;

  update public.products
  set name = coalesce(nullif(btrim(_name), ''), name),
      price = coalesce(_price, price),
      daily_income = coalesce(_daily_income, daily_income),
      days = coalesce(_days, days),
      category = coalesce(_category, category),
      active = coalesce(_active, active)
  where id = _product_id
  returning * into prod;

  if _apply_to_running then
    -- Never shorten a plant below the days a member has already been paid.
    update public.orders o
    set product_name = prod.name,
        daily_income = prod.daily_income,
        days = greatest(prod.days, o.days_claimed),
        product_category = prod.category,
        status = case when o.days_claimed >= greatest(prod.days, o.days_claimed)
                 then 'completed' else 'active' end
    where o.product_id = _product_id and o.status = 'active';
    get diagnostics touched = row_count;
  end if;

  return jsonb_build_object('ok', true, 'product', to_jsonb(prod), 'orders_updated', touched);
end;
$$;

/** Signed manual correction. Never edits history, only appends to it. */
create or replace function public.admin_adjust_wallet(
  _user uuid,
  _amount numeric,
  _note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is not null and not public.is_admin(uid) then
    raise exception 'Admin access required';
  end if;
  if _amount is null or _amount = 0 then raise exception 'Enter an amount'; end if;

  perform public.ledger_append(
    _user, 'adjustment', _amount,
    format('adj:%s:%s', _user, gen_random_uuid()),
    coalesce(nullif(btrim(_note), ''), 'Admin adjustment')
  );

  return jsonb_build_object('ok', true, 'balance', public.wallet_balance(_user));
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.user_roles     enable row level security;
alter table public.user_secrets   enable row level security;
alter table public.products       enable row level security;
alter table public.orders         enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payments       enable row level security;
alter table public.referrals      enable row level security;
alter table public.app_settings   enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists roles_self_select on public.user_roles;
create policy roles_self_select on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- user_secrets intentionally has no policy: service role only.

drop policy if exists products_read on public.products;
create policy products_read on public.products
  for select to anon, authenticated using (active or public.is_admin());

drop policy if exists orders_self_select on public.orders;
create policy orders_self_select on public.orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists ledger_self_select on public.ledger_entries;
create policy ledger_self_select on public.ledger_entries
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists payments_self_select on public.payments;
create policy payments_self_select on public.payments
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists referrals_self_select on public.referrals;
create policy referrals_self_select on public.referrals
  for select to authenticated
  using (referrer_id = auth.uid() or referee_id = auth.uid() or public.is_admin());

drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings
  for select to anon, authenticated using (true);

drop policy if exists settings_admin_write on public.app_settings;
create policy settings_admin_write on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- No INSERT/UPDATE/DELETE policies on the money tables: members can read their
-- own rows, and every write goes through the functions above.

-- ---------------------------------------------------------------------------
-- 12. Grants
-- ---------------------------------------------------------------------------

grant execute on function public.settings() to anon, authenticated;
grant execute on function public.referral_rate(integer) to anon, authenticated;
grant execute on function public.first_payout_at(timestamptz) to anon, authenticated;
grant execute on function public.payout_at(timestamptz, integer) to anon, authenticated;
grant execute on function public.program_elapsed_days(timestamptz, integer) to anon, authenticated;
grant execute on function public.withdraw_window_open(text, text) to anon, authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.wallet_balance(uuid) to authenticated;
grant execute on function public.available_balance(uuid) to authenticated;
grant execute on function public.reserved_balance(uuid) to authenticated;
grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.apply_invite(text) to authenticated;
grant execute on function public.purchase_product(uuid, text) to authenticated;
grant execute on function public.claim_daily_income() to authenticated;
grant execute on function public.earnings_summary() to authenticated;
grant execute on function public.team_stats() to authenticated;
grant execute on function public.request_withdrawal(numeric, text, text, text) to authenticated;

-- Deliberately NOT granted to authenticated — service role only:
revoke execute on function public.ledger_append(uuid, text, numeric, text, text, uuid, uuid, integer)
  from anon, authenticated;
revoke execute on function public.settle_payment(uuid, boolean, text, text, uuid)
  from anon, authenticated;
revoke execute on function public.grant_signup_bonus(uuid) from anon;
revoke execute on function public.admin_adjust_wallet(uuid, numeric, text) from anon;
revoke execute on function public.admin_update_product(uuid, text, numeric, numeric, integer, text, boolean, boolean) from anon;

-- ---------------------------------------------------------------------------
-- 13. Seed: processing plants at 10% daily for 30 days
-- ---------------------------------------------------------------------------

with catalog(name, price, days, daily_income, category, image_url, sort_order) as (
  values
    ('Coffee Nursery',      10000::numeric,   30,   1000::numeric, 'plant', '/plants/nursery.svg',   1),
    ('Robusta Garden',      20000::numeric,   30,   2000::numeric, 'plant', '/plants/robusta.svg',   2),
    ('Arabica Plot',        50000::numeric,   30,   5000::numeric, 'plant', '/plants/arabica.svg',   3),
    ('Washing Station',    100000::numeric,   30,  10000::numeric, 'plant', '/plants/washing.svg',   4),
    ('Roasting Plant',     300000::numeric,   30,  30000::numeric, 'plant', '/plants/roasting.svg',  5),
    ('Export Warehouse',  1000000::numeric,   30, 100000::numeric, 'plant', '/plants/export.svg',    6)
)
insert into public.products (name, price, days, daily_income, category, image_url, sort_order, active)
select c.name, c.price, c.days, c.daily_income, c.category, c.image_url, c.sort_order, true
from catalog c
where not exists (select 1 from public.products p where p.name = c.name);

update public.app_settings
set welcome_message = coalesce(nullif(btrim(welcome_message), ''),
      'Welcome to CoffeeUG!' || chr(10) || chr(10) ||
      'Deposit to your wallet, activate a processing plant, and your returns arrive at 10PM every day for 30 days.' || chr(10) || chr(10) ||
      'Tap Channel for updates and Support if you need help.'),
    about_text = coalesce(nullif(btrim(about_text), ''),
      'CoffeeUG is a Uganda-focused coffee business built around the opportunities within the coffee industry.')
where id = 1;
