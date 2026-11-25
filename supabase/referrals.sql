-- Referral Pro days (Phase 2 wave 3d-1). Spec: company/growth/share-referral-perks.md §2, §5.
-- Run once in the Supabase SQL editor, AFTER payments.sql (grant_pro_days),
-- analytics.sql (site_events) and account-sync.sql (learning_days).
-- Safe to run again.
--
-- What it adds:
--   refcodes          one unique refcode per account (the code in share links)
--   referral_claims   the first-touch refcode + click time a new account came with
--   referral_rewards  one row per referred friend (unique friend_id); server only
--   mnq_refcode()     the same 6-character hash as src/shareCard.js refCode()
--   ensure_refcode()  gives an account its refcode (collision-safe)
--   referral_settle() writes the reward row and grants the days in one transaction
--
-- The rules (2 Dhaka learning days in 14, caps, burst hold) are decided in
-- api/referral.js with src/referral/rules.js; referral_settle re-checks the
-- caps under a lock so two friends qualifying at once can't pass a cap, and
-- the unique friend_id means a retry can never pay twice.

-- 1. The refcode hash: FNV-1a over the user id, base36, first 6 characters.
--    Must match refCode() in src/shareCard.js exactly (tests/referral.test.js
--    pins one value: see the readback at the end).
create or replace function public.mnq_refcode(p_user uuid)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  h bigint := 2166136261;
  s text := p_user::text;
  i integer;
  res text := '';
  digits constant text := '0123456789abcdefghijklmnopqrstuvwxyz';
begin
  for i in 1 .. length(s) loop
    h := (h # ascii(substr(s, i, 1))::bigint) % 4294967296;
    h := (h * 16777619) % 4294967296;
  end loop;

  if h = 0 then
    res := '0';
  end if;

  while h > 0 loop
    res := substr(digits, (h % 36)::integer + 1, 1) || res;
    h := h / 36;
  end loop;

  return left(lpad(res, 6, '0'), 6);
end;
$$;

-- 2. One refcode per account. `shared` is true when another account's id
--    hashes to the same 6 characters: links with that code are then
--    ambiguous, so a referral through it is held for the owner, never paid
--    to a guess. The later account gets its own fallback code (8 characters,
--    starts with 'x'); the 3d-2 invite card reads the code from here.
create table if not exists public.refcodes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refcode text not null unique check (refcode ~ '^[0-9a-z]{6,8}$'),
  shared boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.refcodes enable row level security;

drop policy if exists "own refcode" on public.refcodes;
create policy "own refcode" on public.refcodes
  for select to authenticated using ((select auth.uid()) = user_id);
-- No insert / update / delete policies: only ensure_refcode writes here.

create or replace function public.ensure_refcode(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  code text := public.mnq_refcode(p_user);
  got text;
  holder uuid;
  tries integer := 0;
begin
  select refcode into got from public.refcodes where user_id = p_user;
  if got is not null then
    return got;
  end if;

  select user_id into holder from public.refcodes where refcode = code;

  if holder is null then
    insert into public.refcodes (user_id, refcode) values (p_user, code)
    on conflict do nothing;
  end if;

  select refcode into got from public.refcodes where user_id = p_user;

  if got is null then
    -- Collision: mark the hash code ambiguous, give this account a fallback.
    update public.refcodes set shared = true where refcode = code;

    while got is null and tries < 5 loop
      tries := tries + 1;
      insert into public.refcodes (user_id, refcode)
      values (p_user, 'x' || substr(md5(p_user::text || tries::text), 1, 7))
      on conflict do nothing;
      select refcode into got from public.refcodes where user_id = p_user;
    end loop;
  end if;

  return got;
end;
$$;

-- New accounts get their code at sign-up. Never blocks a sign-up: any error
-- is swallowed and api/referral.js calls ensure_refcode again later.
create or replace function public.refcode_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.ensure_refcode(new.id);
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists refcode_on_signup on auth.users;
create trigger refcode_on_signup
  after insert on auth.users
  for each row execute function public.refcode_on_signup();

-- Existing accounts, oldest first (so the older account keeps a hash code).
do $$
declare
  u record;
begin
  for u in select id from auth.users order by created_at, id loop
    perform public.ensure_refcode(u.id);
  end loop;
end;
$$;

-- 3. The first-touch refcode a new account arrived with. The app sends it once
--    after the first sign-in (src/referral/client.js). One row per account,
--    never changed: insert-only, so nobody can swap referrer later.
create table if not exists public.referral_claims (
  friend_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  refcode text not null check (refcode ~ '^[0-9a-z]{6,8}$'),
  clicked_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint referral_claims_clicked_check check (clicked_at <= created_at + interval '1 day')
);

create index if not exists referral_claims_refcode_at on public.referral_claims (refcode, created_at desc);

alter table public.referral_claims enable row level security;

drop policy if exists "send own claim" on public.referral_claims;
create policy "send own claim" on public.referral_claims
  for insert to authenticated with check ((select auth.uid()) = friend_id);

drop policy if exists "read own claim" on public.referral_claims;
create policy "read own claim" on public.referral_claims
  for select to authenticated using ((select auth.uid()) = friend_id);
-- No update / delete policies.

-- 4. One row per referred friend: the outcome. Server only (no client policies).
create table if not exists public.referral_rewards (
  id bigint generated always as identity primary key,
  referrer_id uuid references auth.users (id) on delete set null,
  friend_id uuid not null unique references auth.users (id) on delete cascade,
  refcode text not null,
  status text not null check (status in ('pending', 'held', 'granted', 'rejected', 'revoked')),
  reason text check (char_length(reason) <= 40),
  friend_signup_at timestamptz,
  qualified_at timestamptz,
  days_referrer integer not null default 0 check (days_referrer between 0 and 30),
  days_friend integer not null default 0 check (days_friend between 0 and 30),
  created_at timestamptz not null default now()
);

create index if not exists referral_rewards_referrer on public.referral_rewards (referrer_id, qualified_at desc);

alter table public.referral_rewards enable row level security;
-- No policies at all: the app can't read or write this table.

-- 5. Writes the outcome for one friend and, when granted, gives both sides the
--    days, all in this one transaction.
--    - A friend who already has a row gets that row back (already = true):
--      a retry never pays twice (also guarded by the unique friend_id).
--    - Granted is re-checked against the caps under a per-referrer lock;
--      over a cap it becomes rejected (cap_total / cap_month).
--    - Writes the server event (ref_qualified / ref_held / ref_rejected) to
--      site_events, which the app can't read.
-- -> { status, reason, already, days_friend, pro_until_friend }
create or replace function public.referral_settle(
  p_friend uuid,
  p_referrer uuid,
  p_refcode text,
  p_status text,
  p_reason text,
  p_signup_at timestamptz,
  p_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_now public.referral_rewards%rowtype;
  st text := p_status;
  why text := left(p_reason, 40);
  total_used integer;
  month_used integer;
  friend_until timestamptz;
  days integer := least(greatest(coalesce(p_days, 0), 0), 30);
begin
  if p_friend is null or st not in ('held', 'granted', 'rejected') then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- One settle at a time per friend and per referrer.
  perform pg_advisory_xact_lock(hashtext('ref-friend:' || p_friend::text));
  if p_referrer is not null then
    perform pg_advisory_xact_lock(hashtext('ref-referrer:' || p_referrer::text));
  end if;

  select * into row_now from public.referral_rewards where friend_id = p_friend;
  if found then
    return jsonb_build_object('status', row_now.status, 'reason', row_now.reason, 'already', true,
      'days_friend', row_now.days_friend);
  end if;

  if st = 'granted' and (p_referrer is null or p_referrer = p_friend or days < 1) then
    st := 'rejected';
    why := 'invalid';
  end if;

  if st = 'granted' then
    select count(*),
           count(*) filter (where to_char(qualified_at at time zone 'Asia/Dhaka', 'YYYY-MM')
                                = to_char(now() at time zone 'Asia/Dhaka', 'YYYY-MM'))
      into total_used, month_used
      from public.referral_rewards
     where referrer_id = p_referrer and status in ('granted', 'revoked');

    if total_used >= 10 then
      st := 'rejected';
      why := 'cap_total';
    elsif month_used >= 3 then
      st := 'rejected';
      why := 'cap_month';
    end if;
  end if;

  insert into public.referral_rewards
    (referrer_id, friend_id, refcode, status, reason, friend_signup_at, qualified_at, days_referrer, days_friend)
  values
    (p_referrer, p_friend, coalesce(left(p_refcode, 8), ''), st, why, p_signup_at,
     case when st = 'granted' then now() else null end,
     case when st = 'granted' then days else 0 end,
     case when st = 'granted' then days else 0 end);

  if st = 'granted' then
    perform public.grant_pro_days(p_referrer, days);
    friend_until := public.grant_pro_days(p_friend, days);
  end if;

  insert into public.site_events (visitor_id, user_id, event, page, props)
  values (
    'server-referral',
    p_friend,
    case st when 'granted' then 'ref_qualified' when 'held' then 'ref_held' else 'ref_rejected' end,
    'server',
    case when st = 'granted'
      then jsonb_build_object('referrer_id', p_referrer, 'friend_id', p_friend)
      else jsonb_build_object('reason', why) end
  );

  return jsonb_build_object('status', st, 'reason', why, 'already', false,
    'days_friend', case when st = 'granted' then days else 0 end,
    'pro_until_friend', friend_until);
end;
$$;

revoke all on function public.mnq_refcode(uuid) from public, anon, authenticated;
revoke all on function public.ensure_refcode(uuid) from public, anon, authenticated;
revoke all on function public.refcode_on_signup() from public, anon, authenticated;
revoke all on function public.referral_settle(uuid, uuid, text, text, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.mnq_refcode(uuid) to service_role;
grant execute on function public.ensure_refcode(uuid) to service_role;
grant execute on function public.referral_settle(uuid, uuid, text, text, text, timestamptz, integer) to service_role;
grant select on public.refcodes, public.referral_claims to service_role;
grant select, insert on public.referral_rewards to service_role;
grant select, insert on public.referral_claims to authenticated;
grant select on public.refcodes to authenticated;

-- Readback (run after applying):
-- 1. The hash matches the app (expect '1lk1m0', the value tests/referral.test.js pins
--    for refCode('00000000-0000-4000-8000-000000000001')):
--    select public.mnq_refcode('00000000-0000-4000-8000-000000000001');
-- 2. Every account has a code; how many hash codes are shared (expect 0 or a handful):
--    select (select count(*) from auth.users) as users,
--           (select count(*) from public.refcodes) as codes,
--           (select count(*) from public.refcodes where shared) as shared_codes,
--           (select count(*) from public.refcodes where refcode like 'x%') as fallback_codes;
-- 3. RLS on for all three, and the policies:
--    select tablename, rowsecurity from pg_tables where schemaname = 'public'
--      and tablename in ('refcodes', 'referral_claims', 'referral_rewards');
--    select tablename, policyname, cmd, roles from pg_policies
--      where schemaname = 'public' and tablename in ('refcodes', 'referral_claims', 'referral_rewards');
--    (expect: refcodes "own refcode" SELECT; referral_claims "send own claim" INSERT and
--     "read own claim" SELECT; referral_rewards none)
-- 4. The functions are server only (expect no anon / authenticated execute):
--    select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as auth_can
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname in ('mnq_refcode', 'ensure_refcode', 'referral_settle', 'refcode_on_signup');
-- 5. The trigger:
--    select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'refcode_on_signup';
