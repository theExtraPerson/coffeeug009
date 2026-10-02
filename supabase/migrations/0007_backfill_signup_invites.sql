-- Link accounts that saved a real invite code at signup but never got a team row.
-- Does not invent a link when the code matches nobody, and does not replace an upline.
-- Commission is still paid only by pay_referral_commissions after a plant purchase.

insert into public.referrals (referrer_id, referee_id, referral_code)
select
  referrer.id,
  u.id,
  upper(btrim(referrer.referral_code))
from auth.users u
join public.profiles referee on referee.id = u.id
join public.profiles referrer
  on upper(btrim(referrer.referral_code)) = upper(btrim(coalesce(
       nullif(u.raw_user_meta_data->>'invite_code', ''),
       nullif(u.raw_user_meta_data->>'ref', ''),
       nullif(u.raw_user_meta_data->>'invite', '')
     )))
where referee.referred_by is null
  and referrer.id <> u.id
on conflict (referee_id) do nothing;

update public.profiles referee
set referred_by = r.referrer_id
from public.referrals r
where r.referee_id = referee.id
  and referee.referred_by is null
  and r.referrer_id <> referee.id;
