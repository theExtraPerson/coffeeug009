-- The member does not choose how a withdrawal is paid. New requests stay
-- UNASSIGNED until an admin picks MarzPay or a manual payout.

alter table public.payments drop constraint if exists payments_mode_check;
alter table public.payments
  add constraint payments_mode_check
  check (mode in ('MARZPAY', 'MANUAL', 'UNASSIGNED'));

create or replace function public.request_withdrawal(
  _amount numeric,
  _phone text,
  _provider text default null,
  _reference text default null,
  _mode text default 'UNASSIGNED'
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

  -- _mode is ignored. Only an admin sets MARZPAY or MANUAL.
  insert into public.payments (
    user_id, type, mode, status, provider, amount, fee, net_amount,
    phone_number, external_reference
  ) values (
    uid, 'WITHDRAWAL', 'UNASSIGNED', 'PENDING', nullif(_provider, ''), _amount, fee, net,
    _phone, coalesce(nullif(btrim(coalesce(_reference, '')), ''), gen_random_uuid()::text)
  )
  returning id into pay_id;

  return jsonb_build_object(
    'ok', true, 'payment_id', pay_id, 'mode', 'UNASSIGNED',
    'amount', _amount, 'fee', fee, 'net', net,
    'available', public.available_balance(uid)
  );
end;
$$;
