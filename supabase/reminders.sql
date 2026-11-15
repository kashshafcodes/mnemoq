-- Review reminders: tables, and a reliable 10-minute scheduler.
--
-- Run this in Supabase > SQL Editor. It is safe to run again.
--
-- Part 1 creates the tables the app and api/remind.js use.
-- Part 2 makes Supabase itself call /api/remind every 10 minutes (pg_cron).
--   GitHub's scheduler was running only every 4 to 8 hours, which is far too
--   slow for "remind me at 6 pm". Before running part 2, replace the two
--   values marked EDIT ME.

-- ===== Part 1: tables =========================================================

create table if not exists public.reminder_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  remind_time text not null default '18:00',
  timezone text not null default 'UTC',
  streak_nudge boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.reminder_settings add column if not exists due_alerts boolean not null default true;
alter table public.reminder_settings add column if not exists due_min integer not null default 5;
alter table public.reminder_settings add column if not exists quiet_start text not null default '22:00';
alter table public.reminder_settings add column if not exists quiet_end text not null default '07:00';
alter table public.reminder_settings add column if not exists last_sent_on date;
alter table public.reminder_settings add column if not exists last_streak_on date;
alter table public.reminder_settings add column if not exists last_alert_at timestamptz;
alter table public.reminder_settings add column if not exists alerts_on date;
alter table public.reminder_settings add column if not exists alerts_today integer not null default 0;

alter table public.reminder_settings enable row level security;

drop policy if exists "own reminder settings" on public.reminder_settings;
create policy "own reminder settings" on public.reminder_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text,
  auth text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own devices" on public.push_subscriptions;
create policy "own devices" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One row per run of the reminder job, so the Stats page can show whether the
-- scheduler is working. Only the server (service role) writes it.
create table if not exists public.reminder_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  people integer not null default 0,
  sent integer not null default 0,
  detail jsonb
);

alter table public.reminder_runs enable row level security;
-- No policies: the app reads it only through admin_reminder_health() in analytics.sql.

-- ===== Part 2: run the job every 10 minutes from Supabase =====================
--
-- Needs the pg_cron and pg_net extensions (Database > Extensions, or the two
-- lines below). EDIT ME twice:
--   1. your site address (no slash at the end)
--   2. the same CRON_SECRET you set in Vercel > Settings > Environment Variables

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  secret text := 'PASTE-YOUR-CRON_SECRET-HERE';   -- EDIT ME (2): the same value as CRON_SECRET in Vercel
begin
  if secret = 'PASTE-YOUR-CRON_SECRET-HERE' or length(secret) < 16 then
    raise exception 'Paste your CRON_SECRET (16+ characters) into the line marked EDIT ME (2) first.';
  end if;

  -- Keep the secret out of the job text: store it in Supabase Vault.
  if exists (select 1 from vault.secrets where name = 'mnemoq_cron_secret') then
    perform vault.update_secret((select id from vault.secrets where name = 'mnemoq_cron_secret'), secret);
  else
    perform vault.create_secret(secret, 'mnemoq_cron_secret');
  end if;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'mnemoq-reminders';

select cron.schedule(
  'mnemoq-reminders',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := 'https://mnemoq-two.vercel.app/api/remind',     -- EDIT ME (1): your site + /api/remind
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mnemoq_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $job$
);

-- Check it is working (after 10 to 20 minutes):
--   select status_code, content, created from net._http_response order by created desc limit 5;
-- 200 with {"ok":true,...} is good. 401 means the secret does not match Vercel's
-- CRON_SECRET. 503 means a Vercel variable is missing (see docs/reminders.md).
