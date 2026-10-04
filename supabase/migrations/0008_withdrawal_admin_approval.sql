-- Every withdrawal waits for an admin. The member chooses MarzPay or manual.
-- MarzPay is called only after that approval; manual payouts are sent by the admin.
-- withdraw_auto no longer chooses the channel.

update public.app_settings
set withdraw_auto = false
where id = 1;

drop function if exists public.request_withdrawal(numeric, text, text, text);

create or replace function public.request_withdrawal(
  _amount numeric,
  _phone text,
  _provider text default null,
  _reference text default null,
  _mode text default 'MARZPAY'
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
  mode := case when upper(btrim(coalesce(_mode, ''))) = 'MANUAL' then 'MANUAL' else 'MARZPAY' end;

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

revoke all on function public.request_withdrawal(numeric, text, text, text, text) from public;
grant execute on function public.request_withdrawal(numeric, text, text, text, text) to authenticated;
