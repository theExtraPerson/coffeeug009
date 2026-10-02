-- A plant bought before the invite code is attached still pays commission once
-- the upline is recorded. ledger_append ignores a key that already exists, so
-- running this again cannot pay the same order twice.
-- Level 1 is 6% of that investment. Level 2 is 1%.

create or replace function public.settle_referral_commissions(_referee uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  rec record;
begin
  if _referee is null then
    return;
  end if;

  for rec in
    select
      o.id,
      o.price,
      coalesce(nullif(btrim(p.full_name), ''), 'Member') as buyer_name
    from public.orders o
    join public.profiles p on p.id = o.user_id
    where o.user_id = _referee
      and o.product_category = 'plant'
      and o.status in ('active', 'completed')
      and o.price > 0
  loop
    perform public.pay_referral_commissions(_referee, rec.id, rec.price, rec.buyer_name);
  end loop;
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

  perform public.settle_referral_commissions(_referee);
end;
$$;

revoke all on function public.settle_referral_commissions(uuid) from public, anon, authenticated;

-- Catch investments that were linked after the plant was bought.
do $$
declare
  rec record;
begin
  for rec in
    select
      o.user_id,
      o.id,
      o.price,
      coalesce(nullif(btrim(p.full_name), ''), 'Member') as buyer_name
    from public.orders o
    join public.profiles p on p.id = o.user_id
    where o.product_category = 'plant'
      and o.status in ('active', 'completed')
      and o.price > 0
      and (
        p.referred_by is not null
        or exists (select 1 from public.referrals r where r.referee_id = o.user_id)
      )
  loop
    perform public.pay_referral_commissions(rec.user_id, rec.id, rec.price, rec.buyer_name);
  end loop;
end $$;
