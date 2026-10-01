-- Referral commissions stay tied to the code that was used, and they are paid
-- only when the invitee successfully invests in a plant (not on signup or deposit).
-- Level 1 is 6% of that investment. Level 2 is 1%.
-- Safe to run more than once.

-- See the whole referral chain even when row-level security would hide it.
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
set row_security = off
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

-- One edge per invitee, storing the code they actually entered.
insert into public.referrals (referrer_id, referee_id, referral_code)
select p.referred_by, p.id, upper(btrim(coalesce(up.referral_code, '')))
from public.profiles p
join public.profiles up on up.id = p.referred_by
where p.referred_by is not null
  and p.referred_by <> p.id
on conflict (referee_id) do nothing;

update public.profiles p
set referred_by = r.referrer_id
from public.referrals r
where r.referee_id = p.id
  and p.referred_by is null
  and r.referrer_id <> p.id;

update public.referrals r
set referral_code = upper(btrim(p.referral_code))
from public.profiles p
where p.id = r.referrer_id
  and btrim(coalesce(r.referral_code, '')) = ''
  and btrim(coalesce(p.referral_code, '')) <> '';

-- Pay any commission that a successful plant investment never credited.
-- ledger_append ignores a key that was already used, so this cannot double-pay.
do $$
declare
  rec record;
begin
  for rec in
    select
      o.id,
      o.user_id,
      o.price,
      coalesce(nullif(btrim(pr.full_name), ''), 'Member') as buyer_name
    from public.orders o
    join public.profiles pr on pr.id = o.user_id
    where o.product_category = 'plant'
      and o.status in ('active', 'completed')
      and o.price > 0
  loop
    perform public.pay_referral_commissions(rec.user_id, rec.id, rec.price, rec.buyer_name);
  end loop;
end $$;

create or replace function public.team_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  with recursive walk as (
    select
      p.id,
      p.username,
      p.full_name,
      p.created_at,
      1 as lvl,
      coalesce(nullif(btrim(ref.referral_code), ''), nullif(btrim(up.referral_code), ''), '') as code,
      null::text as via_username
    from public.profiles p
    join public.profiles up on up.id = uid
    left join public.referrals ref
      on ref.referee_id = p.id
     and ref.referrer_id = uid
    where p.id <> uid
      and (p.referred_by = uid or ref.referrer_id = uid)

    union all

    select
      p.id,
      p.username,
      p.full_name,
      p.created_at,
      w.lvl + 1,
      coalesce(nullif(btrim(ref.referral_code), ''), nullif(btrim(parent.referral_code), ''), ''),
      w.username
    from walk w
    join public.profiles parent on parent.id = w.id
    join public.profiles p
      on p.id <> uid
     and p.id <> w.id
     and (
       p.referred_by = w.id
       or exists (
         select 1 from public.referrals r
         where r.referrer_id = w.id and r.referee_id = p.id
       )
     )
    left join public.referrals ref
      on ref.referee_id = p.id
     and ref.referrer_id = w.id
    where w.lvl < 2
  ),
  tree as (
    select distinct on (id)
      id, username, full_name, created_at, lvl, code, via_username
    from walk
    order by id, lvl
  ),
  invested as (
    select o.user_id, coalesce(sum(o.price), 0) as vol
    from public.orders o
    where o.product_category = 'plant'
      and o.status in ('active', 'completed')
    group by o.user_id
  ),
  deposited as (
    select user_id, coalesce(sum(amount), 0) as dep
    from public.ledger_entries
    where type = 'deposit'
    group by user_id
  ),
  earned_from as (
    select source_user_id, referral_level, coalesce(sum(amount), 0) as earned
    from public.ledger_entries
    where user_id = uid
      and type = 'commission'
      and referral_level is not null
      and source_user_id is not null
    group by source_user_id, referral_level
  ),
  leveled as (
    select
      t.lvl as level,
      t.id,
      t.username,
      t.full_name,
      t.created_at,
      t.code,
      t.via_username,
      coalesce(v.vol, 0) as volume,
      coalesce(d.dep, 0) as deposited,
      coalesce(e.earned, 0) as earned
    from tree t
    left join invested v on v.user_id = t.id
    left join deposited d on d.user_id = t.id
    left join earned_from e
      on e.source_user_id = t.id
     and e.referral_level = t.lvl
  )
  select jsonb_build_object(
    'total_members', (select count(*) from tree),
    'total_volume', (select coalesce(sum(volume), 0) from leveled),
    'total_deposits', (select coalesce(sum(deposited), 0) from leveled),
    'total_earned', (select coalesce(sum(earned), 0) from leveled),
    'levels', (
      select coalesce(jsonb_agg(level_obj order by level), '[]'::jsonb)
      from (
        select g.level,
          jsonb_build_object(
            'level', g.level,
            'rate', public.referral_rate(g.level),
            'earned', coalesce(sum(l.earned), 0),
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
                  'volume', l.volume,
                  'referral_code', nullif(l.code, ''),
                  'rate', public.referral_rate(g.level),
                  'via_username', l.via_username
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

grant execute on function public.team_stats() to authenticated;
