-- Automatic bKash / Nagad payments (no merchant account needed).
--
-- How it works:
--   1. A student sends money to your personal bKash/Nagad number and types the
--      transaction ID (TrxID) on the Pro page.
--   2. Your Android phone forwards the "You have received Tk ..." SMS to
--      /api/sms-hook (an SMS-forwarder app; see docs/payments.md).
--   3. When a TrxID from a student matches a TrxID from an SMS, Pro starts
--      at once. Whichever arrives first waits for the other.
--
-- Run this once in Supabase > SQL Editor (after stage5.sql). Safe to run again.
-- Only the server (service role key) can use these tables and functions.

-- Money received, from the forwarded SMS.
create table if not exists public.payment_sms (
  trx_id text primary key check (trx_id ~ '^[A-Z0-9]{6,20}$'),
  method text not null check (method in ('bkash', 'nagad')),
  amount numeric(10, 2) not null check (amount > 0),
  sender text,
  received_at timestamptz not null default now(),
  raw text check (char_length(raw) <= 600),
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  days_granted integer
);

-- TrxIDs typed by students, waiting for (or matched to) an SMS.
create table if not exists public.payment_claims (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  trx_id text not null check (trx_id ~ '^[A-Z0-9]{6,20}$'),
  sender_last4 text not null check (sender_last4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  status text not null default 'waiting' check (status in ('waiting', 'done', 'rejected')),
  note text,
  unique (user_id, trx_id)
);

create index if not exists payment_claims_trx on public.payment_claims (trx_id) where status = 'waiting';
create index if not exists payment_claims_user_time on public.payment_claims (user_id, created_at);

alter table public.payment_sms enable row level security;
alter table public.payment_claims enable row level security;
-- No policies: the app cannot read or write these tables directly.

-- Adds days of Pro (on top of any time left). Server only.
create or replace function public.grant_pro_days(p_user uuid, p_days integer)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  new_until timestamptz;
begin
  insert into public.user_plans (user_id, pro_until, updated_at)
  values (p_user, now() + make_interval(days => p_days), now())
  on conflict (user_id) do update
    set pro_until = greatest(coalesce(public.user_plans.pro_until, now()), now()) + make_interval(days => p_days),
        updated_at = now()
  returning pro_until into new_until;

  return new_until;
end;
$$;

-- Matches one TrxID to one SMS, once, and grants the days. Server only.
-- p_last4: last 4 digits of the number the student paid from (must match the SMS,
--   so a TrxID seen elsewhere is useless on its own).
-- p_days: the server works out the plan from the amount and passes the days in
--   on a second call; null on the first call, 0 when no plan matches.
-- -> { ok, status: 'granted' | 'waiting' | 'price' | 'used' | 'amount' | 'mismatch' | 'slow_down' | 'invalid', ... }
drop function if exists public.match_payment(uuid, text, integer);
create or replace function public.match_payment(p_user uuid, p_trx text, p_last4 text, p_days integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  trx text := upper(regexp_replace(coalesce(p_trx, ''), '[^A-Za-z0-9]', '', 'g'));
  last4 text := right(regexp_replace(coalesce(p_last4, ''), '[^0-9]', '', 'g'), 4);
  sms public.payment_sms%rowtype;
  until_ts timestamptz;
begin
  if trx !~ '^[A-Z0-9]{6,20}$' or last4 !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'status', 'invalid');
  end if;

  if p_days is null and (
    select count(*) from public.payment_claims where user_id = p_user and created_at > now() - interval '1 hour'
  ) >= 10 then
    return jsonb_build_object('ok', false, 'status', 'slow_down');
  end if;

  -- Lock the SMS row so two requests cannot both use it.
  select * into sms from public.payment_sms where trx_id = trx for update;

  if not found then
    insert into public.payment_claims (user_id, trx_id, sender_last4) values (p_user, trx, last4)
      on conflict (user_id, trx_id) do update set sender_last4 = excluded.sender_last4, status = 'waiting';
    return jsonb_build_object('ok', true, 'status', 'waiting');
  end if;

  if sms.claimed_by is not null then
    return jsonb_build_object('ok', sms.claimed_by = p_user,
      'status', case when sms.claimed_by = p_user then 'granted' else 'used' end, 'days', sms.days_granted);
  end if;

  if sms.sender is not null and right(regexp_replace(sms.sender, '[^0-9]', '', 'g'), 4) <> last4 then
    insert into public.payment_claims (user_id, trx_id, sender_last4, status, note) values (p_user, trx, last4, 'rejected', 'number mismatch')
      on conflict (user_id, trx_id) do update set status = 'rejected', note = 'number mismatch', sender_last4 = excluded.sender_last4;
    return jsonb_build_object('ok', false, 'status', 'mismatch');
  end if;

  if p_days is null then
    -- The server prices it from the amount, then calls again with the days.
    return jsonb_build_object('ok', true, 'status', 'price', 'amount', sms.amount, 'received_at', sms.received_at);
  end if;

  if p_days <= 0 then
    insert into public.payment_claims (user_id, trx_id, sender_last4, status, note) values (p_user, trx, last4, 'rejected', 'amount ' || sms.amount)
      on conflict (user_id, trx_id) do update set status = 'rejected', note = 'amount ' || sms.amount;
    return jsonb_build_object('ok', false, 'status', 'amount', 'amount', sms.amount);
  end if;

  update public.payment_sms set claimed_by = p_user, claimed_at = now(), days_granted = p_days where trx_id = trx;
  insert into public.payment_claims (user_id, trx_id, sender_last4, status) values (p_user, trx, last4, 'done')
    on conflict (user_id, trx_id) do update set status = 'done';
  until_ts := public.grant_pro_days(p_user, p_days);

  return jsonb_build_object('ok', true, 'status', 'granted', 'days', p_days, 'pro_until', until_ts);
end;
$$;

revoke all on function public.grant_pro_days(uuid, integer) from public, anon, authenticated;
revoke all on function public.match_payment(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.grant_pro_days(uuid, integer) to service_role;
grant execute on function public.match_payment(uuid, text, text, integer) to service_role;
grant select, insert, update on public.payment_sms, public.payment_claims to service_role;

-- Admin view for the Stats page (needs analytics.sql for is_site_admin).
create or replace function public.admin_payments(p_limit integer default 50)
returns table (trx_id text, method text, amount numeric, received_at timestamptz, email text, days integer, waiting_claims bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_site_admin() then
    raise exception 'not allowed';
  end if;

  return query
    select s.trx_id, s.method, s.amount, s.received_at, u.email::text, s.days_granted,
      (select count(*) from public.payment_claims c where c.trx_id = s.trx_id and c.status = 'waiting')
    from public.payment_sms s
    left join auth.users u on u.id = s.claimed_by
    order by s.received_at desc
    limit greatest(1, least(p_limit, 300));
end;
$$;

revoke all on function public.admin_payments(integer) from public, anon;
grant execute on function public.admin_payments(integer) to authenticated;
