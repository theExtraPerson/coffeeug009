-- Processing plants run for 20 days. New investments read app_settings.term_days.
-- Plants already running are shortened to 20 days, but never below a day
-- that has already been paid.
-- Safe to run more than once.

update public.app_settings
set
  term_days = 20,
  welcome_message = replace(welcome_message, 'for 30 days', 'for 20 days')
where id = 1;

alter table public.app_settings
  alter column term_days set default 20;

update public.products
set days = 20
where name = 'Coffee Processing Plant';

update public.orders
set
  days = greatest(20, days_claimed),
  status = case when days_claimed >= 20 then 'completed' else status end,
  next_payout_at = case when days_claimed >= 20 then null else next_payout_at end
where status = 'active'
  and days > 20;

create or replace function public.invest_in_plant(_amount numeric, _note text default null)
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
  invested numeric;
  daily numeric;
  term integer;
  created timestamptz := now();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into s from public.app_settings where id = 1;
  if s.frozen then raise exception 'Processing is paused. Please try again later'; end if;

  select * into buyer from public.profiles where id = uid for update;
  if not found then raise exception 'Profile not found'; end if;
  if buyer.is_banned then raise exception 'Account is suspended'; end if;

  select * into prod
  from public.products
  where active = true
    and category = 'plant'
    and name = 'Coffee Processing Plant'
  limit 1;
  if not found then
    raise exception 'The processing plant is not available right now';
  end if;

  invested := round(coalesce(_amount, 0), 0);
  if invested < s.deposit_min then
    raise exception 'Minimum amount is %', trim(to_char(s.deposit_min, '999,999,999'));
  end if;
  if invested > s.deposit_max then
    raise exception 'Maximum amount is %', trim(to_char(s.deposit_max, '999,999,999'));
  end if;

  term := greatest(1, coalesce(s.term_days, 20));
  daily := round(invested * coalesce(s.daily_rate_percent, 10) / 100.0, 0);
  if daily <= 0 then
    raise exception 'That amount is too small to earn a return';
  end if;

  avail := public.available_balance(uid);
  if avail < invested then
    raise exception 'Not enough wallet balance. Deposit first';
  end if;

  insert into public.orders (
    user_id, product_id, product_name, product_category, price, daily_income,
    days, days_claimed, status, note, created_at, first_payout_at, next_payout_at
  ) values (
    uid, prod.id, prod.name, prod.category, invested, daily,
    term, 0, 'active', nullif(btrim(coalesce(_note, '')), ''), created,
    public.first_payout_at(created), public.first_payout_at(created)
  )
  returning id into order_id;

  perform public.ledger_append(
    uid, 'purchase', -invested, format('buy:%s', order_id), prod.name, order_id
  );

  perform public.pay_referral_commissions(
    uid, order_id, invested, coalesce(buyer.full_name, 'Member')
  );

  return jsonb_build_object(
    'ok', true,
    'order_id', order_id,
    'amount', invested,
    'daily_income', daily,
    'days', term,
    'first_payout_at', public.first_payout_at(created),
    'balance', public.wallet_balance(uid)
  );
end;
$$;

revoke all on function public.invest_in_plant(numeric, text) from public, anon;
grant execute on function public.invest_in_plant(numeric, text) to authenticated;
