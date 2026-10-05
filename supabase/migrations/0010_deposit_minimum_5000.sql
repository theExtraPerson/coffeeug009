-- Wallet deposits start at UGX 5,000. A lower saved setting is raised to match.

alter table public.app_settings
  alter column deposit_min set default 5000;

update public.app_settings
set deposit_min = 5000
where id = 1
  and deposit_min < 5000;
