-- Security hardening for many users. Run in Supabase > SQL Editor.
-- Safe to run again. Read the results of part 1 before and after.

-- ===== Part 1: audit (read only) ============================================
-- Every table in "public" must have row level security ON. A table with RLS off
-- can be read and changed by anyone holding the public (anon) key, which is in
-- every visitor's browser.
select c.relname as table_name,
       c.relrowsecurity as rls_on,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;
-- Expect rls_on = true on every row. If one is false, do not just switch it on
-- (the app would stop reading it); ask for policies for that table first.

-- Every policy, to check none says "true" for everyone on private data:
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, cmd;

-- ===== Part 2: AI usage counters cannot be reset by their owner ===============
-- The daily AI limits count rows in ai_usage and coach_usage. If a person could
-- delete or edit their own rows, they could reset their limit and run up the AI
-- bill. Allow only reading and adding one's own rows.
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array['ai_usage', 'coach_usage'] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t and cmd in ('DELETE', 'UPDATE', 'ALL') loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;

    execute format('drop policy if exists "read own usage" on public.%I', t);
    execute format('create policy "read own usage" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('drop policy if exists "add own usage" on public.%I', t);
    execute format('create policy "add own usage" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create index if not exists %I on public.%I (user_id, created_at)', t || '_user_time', t);
    execute format('create index if not exists %I on public.%I (created_at)', t || '_time', t);
  end loop;
end;
$$;

-- ===== Part 3: limits on what one account can store =========================
-- Stops one script-driven account from filling the database (and the reminder
-- job) with junk. Generous for real students.

create or replace function public.limit_rows_per_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap integer := tg_argv[0]::integer;
  have integer;
begin
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into have using new.user_id;

  if have >= cap then
    raise exception 'Limit reached: at most % rows per account in %', cap, tg_table_name using errcode = 'P0001';
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.mistakes') is not null then
    execute 'drop trigger if exists limit_mistakes on public.mistakes';
    execute 'create trigger limit_mistakes before insert on public.mistakes for each row execute function public.limit_rows_per_user(20000)';
    execute 'create index if not exists mistakes_user on public.mistakes (user_id)';
  end if;

  if to_regclass('public.push_subscriptions') is not null then
    execute 'drop trigger if exists limit_devices on public.push_subscriptions';
    execute 'create trigger limit_devices before insert on public.push_subscriptions for each row execute function public.limit_rows_per_user(10)';
    -- Only real browser push services (the server checks this too).
    execute 'alter table public.push_subscriptions drop constraint if exists push_endpoint_is_push_service';
    execute $c$alter table public.push_subscriptions add constraint push_endpoint_is_push_service check (
      endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com|([a-z0-9-]+\.)*push\.apple\.com)/'
      and char_length(endpoint) < 1000) not valid$c$;
  end if;

  if to_regclass('public.reviews') is not null then
    execute 'create index if not exists reviews_user_time on public.reviews (user_id, created_at)';
  end if;
end;
$$;

-- Big tables need these indexes once there are many users; the reminder job,
-- the dashboard and the Stats page all filter by user and time.
