-- Stage 5: Mnemoq Pro (plans and access codes).
--
-- Run this once in the Supabase SQL editor. It is safe to run again.
--
-- How Pro works:
--   1. A student pays you (bKash, Nagad, bank, cash).
--   2. You create a code here:      select * from create_pro_codes(1, 30, 'Rahim, bKash 0171...');
--   3. You send them the code. They type it on the Pro page of the app.
--   4. The app calls redeem_pro_code(), which gives their account Pro for
--      that many days. Redeeming again later adds days to what is left.
--
-- People cannot change their own plan: they can only read it. Codes can be
-- read and created only from this SQL editor (or with the service role key).

-- ---- plans ------------------------------------------------------------------

create table if not exists public.user_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pro_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_plans enable row level security;

drop policy if exists "read own plan" on public.user_plans;
create policy "read own plan" on public.user_plans
  for select using (auth.uid() = user_id);

-- No insert, update or delete policy: only the functions below change plans.

-- ---- access codes -----------------------------------------------------------

create table if not exists public.pro_codes (
  code text primary key,
  days integer not null check (days between 1 and 3660),
  note text,
  created_at timestamptz not null default now(),
  redeemed_by uuid references auth.users (id) on delete set null,
  redeemed_at timestamptz
);

alter table public.pro_codes enable row level security;
-- No policies at all: the app can never read this table directly.

-- Wrong guesses, so a code cannot be found by trying thousands of them.
create table if not exists public.pro_code_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.pro_code_attempts enable row level security;

create index if not exists pro_code_attempts_user_time on public.pro_code_attempts (user_id, created_at);

-- Codes look like MNQ-7F3A-91BC-D204. Spaces, dashes and letter case do not matter.
create or replace function public.clean_pro_code(raw text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(raw, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Create codes. Run from the SQL editor:
--   select * from create_pro_codes(5, 90, 'March batch');
-- Returns the codes to send out.
create or replace function public.create_pro_codes(how_many integer, valid_days integer, about text default null)
returns table (pro_code text, valid_for_days integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  raw text;
  made integer := 0;
begin
  if how_many < 1 or how_many > 500 then
    raise exception 'how_many must be between 1 and 500';
  end if;

  while made < how_many loop
    raw := 'MNQ' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

    begin
      insert into public.pro_codes (code, days, note) values (raw, valid_days, about);
      made := made + 1;
      pro_code := 'MNQ-' || substr(raw, 4, 4) || '-' || substr(raw, 8, 4) || '-' || substr(raw, 12, 4);
      valid_for_days := valid_days;
      return next;
    exception when unique_violation then
      -- Extremely unlikely; just try another.
      null;
    end;
  end loop;
end;
$$;

revoke all on function public.create_pro_codes(integer, integer, text) from public, anon, authenticated;

-- Redeem a code for the signed-in person.
-- Returns: { ok: true, pro_until } or { ok: false, reason: 'invalid' | 'used' | 'slow_down' | 'auth' }
create or replace function public.redeem_pro_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  wanted text := public.clean_pro_code(p_code);
  hit public.pro_codes%rowtype;
  until_now timestamptz;
  new_until timestamptz;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;

  if (select count(*) from public.pro_code_attempts where user_id = me and created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'slow_down');
  end if;

  select * into hit from public.pro_codes where code = wanted for update;

  if not found then
    insert into public.pro_code_attempts (user_id) values (me);
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if hit.redeemed_by is not null then
    return jsonb_build_object('ok', false, 'reason', 'used');
  end if;

  update public.pro_codes set redeemed_by = me, redeemed_at = now() where code = wanted;

  select pro_until into until_now from public.user_plans where user_id = me;

  new_until := greatest(coalesce(until_now, now()), now()) + make_interval(days => hit.days);

  insert into public.user_plans (user_id, pro_until, updated_at)
  values (me, new_until, now())
  on conflict (user_id) do update set pro_until = excluded.pro_until, updated_at = now();

  return jsonb_build_object('ok', true, 'pro_until', new_until, 'days', hit.days);
end;
$$;

revoke all on function public.redeem_pro_code(text) from public, anon;
grant execute on function public.redeem_pro_code(text) to authenticated;

-- Give Pro to someone directly (for yourself, testers or refunds going the
-- other way). Run from the SQL editor:
--   select grant_pro('student@example.com', 365);
--   select grant_pro('student@example.com', 0);    -- ends Pro now
create or replace function public.grant_pro(email_address text, valid_days integer)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  who uuid;
  new_until timestamptz;
begin
  select id into who from auth.users where lower(email) = lower(email_address);

  if who is null then
    raise exception 'No account with the email %', email_address;
  end if;

  new_until := case when valid_days <= 0 then now() else now() + make_interval(days => valid_days) end;

  insert into public.user_plans (user_id, pro_until, updated_at)
  values (who, new_until, now())
  on conflict (user_id) do update set pro_until = excluded.pro_until, updated_at = now();

  return new_until;
end;
$$;

revoke all on function public.grant_pro(text, integer) from public, anon, authenticated;

notify pgrst, 'reload schema';
