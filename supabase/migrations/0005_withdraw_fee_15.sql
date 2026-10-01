-- Withdrawals carry a 15% fee. request_withdrawal already reads
-- app_settings.withdraw_fee_rate, so the setting is the only authority.
-- Pending withdrawals keep the fee they were quoted.
-- Safe to run more than once.

update public.app_settings
set
  withdraw_fee_rate = 0.15,
  welcome_message = replace(welcome_message, '10% fee', '15% fee')
where id = 1;

alter table public.app_settings
  alter column withdraw_fee_rate set default 0.15;
