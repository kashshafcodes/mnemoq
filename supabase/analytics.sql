-- Visitor and activity tracking for the Stats page (#/admin).
--
-- Run this once in Supabase > SQL Editor. It is safe to run again.
-- Then make yourself an admin (use the email you log in to Mnemoq with):
--
--   insert into public.site_admins (email) values ('you@example.com') on conflict do nothing;
--
-- Anyone (even signed out) can ADD events; nobody can read, change or delete
-- them through the app. Only the admin functions below read them, and they
-- check that the caller is in site_admins first.

-- ---- events -----------------------------------------------------------------

create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  visitor_id text not null check (char_length(visitor_id) between 6 and 40),
  session_id text check (char_length(session_id) <= 40),
  user_id uuid references auth.users (id) on delete set null,
  event text not null check (char_length(event) between 1 and 40),
  page text check (char_length(page) <= 40),
  source text check (char_length(source) <= 80),
  medium text check (char_length(medium) <= 80),
  campaign text check (char_length(campaign) <= 80),
  referrer text check (char_length(referrer) <= 80),
  device text check (char_length(device) <= 12),
  lang text check (char_length(lang) <= 12),
  props jsonb check (props is null or pg_column_size(props) <= 1500)
);

create index if not exists site_events_at on public.site_events (at desc);
create index if not exists site_events_visitor_at on public.site_events (visitor_id, at desc);
create index if not exists site_events_user on public.site_events (user_id, at desc) where user_id is not null;
create index if not exists site_events_event_at on public.site_events (event, at desc);

alter table public.site_events enable row level security;

drop policy if exists "anyone can add events" on public.site_events;
create policy "anyone can add events" on public.site_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
-- No select / update / delete policies: the table cannot be read from the app.

-- Flood guard: at most 120 events a minute per visitor; extra ones are dropped
-- quietly, so a script hammering the endpoint cannot fill the database fast.
create or replace function public.site_events_flood_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.site_events
    where visitor_id = new.visitor_id and at > now() - interval '1 minute'
  ) >= 120 then
    return null;
  end if;

  new.at := now(); -- the client cannot back-date events
  return new;
end;
$$;

drop trigger if exists site_events_flood_guard on public.site_events;
create trigger site_events_flood_guard before insert on public.site_events
  for each row execute function public.site_events_flood_guard();

-- ---- admins -----------------------------------------------------------------

create table if not exists public.site_admins (
  email text primary key check (email = lower(email))
);

alter table public.site_admins enable row level security;
-- No policies: only the SQL editor can change who is an admin.

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_admins a
    join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid()
  );
$$;

revoke all on function public.is_site_admin() from public, anon;
grant execute on function public.is_site_admin() to authenticated;

-- ---- the Stats page ---------------------------------------------------------

-- Everything for the overview in one call. p_days: 1, 7, 30 or 90.
create or replace function public.admin_overview(p_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
  result jsonb;
begin
  if not public.is_site_admin() then
    raise exception 'not allowed';
  end if;

  with ev as (
    select * from public.site_events where at >= since
  ),
  signups as (
    select id, created_at from auth.users where created_at >= since
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from ev),
      'sessions', (select count(distinct session_id) from ev),
      'signups', (select count(*) from signups),
      'active_users', (select count(distinct user_id) from ev where user_id is not null),
      'cards_added', (select count(*) from public.mistakes where created_at >= since),
      'reviews', (select count(*) from public.reviews where created_at >= since),
      'pro_now', (select count(*) from public.user_plans where pro_until > now()),
      'total_users', (select count(*) from auth.users)
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'visitors', d.visitors, 'signups', d.signups, 'active', d.active) order by d.day)
      from (
        select g.day::date as day,
          (select count(distinct visitor_id) from ev where at::date = g.day::date) as visitors,
          (select count(*) from signups where created_at::date = g.day::date) as signups,
          (select count(distinct user_id) from ev where user_id is not null and at::date = g.day::date) as active
        from generate_series(since::date, now()::date, interval '1 day') as g(day)
      ) d
    ), '[]'::jsonb),
    'funnel', jsonb_build_array(
      jsonb_build_object('step', 'Visited the site', 'count', (select count(distinct visitor_id) from ev)),
      jsonb_build_object('step', 'Clicked sign up', 'count', (select count(distinct visitor_id) from ev where event in ('cta_click', 'signup_open', 'sign_up'))),
      jsonb_build_object('step', 'Created an account', 'count', (select count(distinct visitor_id) from ev where event = 'sign_up')),
      jsonb_build_object('step', 'Saved a first card or took a diagnostic', 'count', (select count(distinct visitor_id) from ev where event in ('first_mistake_saved', 'diagnostic_done', 'pilot_done'))),
      jsonb_build_object('step', 'Reviewed cards', 'count', (select count(distinct visitor_id) from ev where event = 'review_completed')),
      jsonb_build_object('step', 'Opened the Pro page', 'count', (select count(distinct visitor_id) from ev where event = 'page_view' and page = 'pro')),
      jsonb_build_object('step', 'Became Pro', 'count', (select count(distinct visitor_id) from ev where event = 'pro_redeemed'))
    ),
    'sources', coalesce((
      select jsonb_agg(s order by s.visitors desc)
      from (
        select coalesce(source, 'direct') as source,
          count(distinct visitor_id) as visitors,
          count(distinct visitor_id) filter (where event = 'sign_up') as signups,
          count(distinct user_id) filter (where user_id is not null) as active_users,
          count(distinct visitor_id) filter (where event = 'pro_redeemed') as pro
        from ev
        group by 1
        order by 2 desc
        limit 20
      ) s
    ), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(c order by c.visitors desc)
      from (
        select campaign, coalesce(source, 'direct') as source,
          count(distinct visitor_id) as visitors,
          count(distinct visitor_id) filter (where event = 'sign_up') as signups
        from ev
        where campaign is not null
        group by 1, 2
        order by 3 desc
        limit 20
      ) c
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(p order by p.views desc)
      from (
        select page, count(*) as views, count(distinct visitor_id) as visitors
        from ev where event in ('page_view', 'landing_view')
        group by 1 order by 2 desc limit 15
      ) p
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_object_agg(coalesce(device, 'unknown'), n)
      from (select device, count(distinct visitor_id) as n from ev group by 1) d
    ), '{}'::jsonb),
    'events', coalesce((
      select jsonb_agg(e order by e.n desc)
      from (select event, count(*) as n from ev group by 1 order by 2 desc limit 25) e
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- The latest events, newest first, with the account email when signed in.
create or replace function public.admin_recent(p_limit integer default 60)
returns table (at timestamptz, event text, page text, source text, device text, email text, visitor text, props jsonb)
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
    select e.at, e.event, e.page, e.source, e.device, u.email::text, left(e.visitor_id, 6), e.props
    from public.site_events e
    left join auth.users u on u.id = e.user_id
    order by e.at desc
    limit greatest(1, least(p_limit, 300));
end;
$$;

-- Every account with what they have done: newest sign-ups first.
create or replace function public.admin_users(p_limit integer default 200)
returns table (
  email text, joined timestamptz, source text, cards bigint, reviews bigint,
  last_seen timestamptz, active_days bigint, pro_until timestamptz
)
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
    select u.email::text,
      u.created_at,
      (select e.source from public.site_events e where e.user_id = u.id order by e.at asc limit 1),
      (select count(*) from public.mistakes m where m.user_id = u.id),
      (select count(*) from public.reviews r where r.user_id = u.id),
      greatest(u.last_sign_in_at, (select max(e.at) from public.site_events e where e.user_id = u.id)),
      (select count(distinct e.at::date) from public.site_events e where e.user_id = u.id),
      (select p.pro_until from public.user_plans p where p.user_id = u.id)
    from auth.users u
    order by u.created_at desc
    limit greatest(1, least(p_limit, 1000));
end;
$$;

-- Is the reminder scheduler running? (supabase/reminders.sql)
create or replace function public.admin_reminder_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_site_admin() then
    raise exception 'not allowed';
  end if;

  select jsonb_build_object(
    'people_on', (select count(*) from public.reminder_settings where enabled),
    'devices', (select count(*) from public.push_subscriptions),
    'last_runs', coalesce((
      select jsonb_agg(r order by r.ran_at desc)
      from (select ran_at, people, sent, detail from public.reminder_runs order by ran_at desc limit 8) r
    ), '[]'::jsonb)
  ) into result;

  return result;
exception when undefined_table then
  return jsonb_build_object('missing', true);
end;
$$;

revoke all on function public.admin_overview(integer) from public, anon;
revoke all on function public.admin_recent(integer) from public, anon;
revoke all on function public.admin_users(integer) from public, anon;
revoke all on function public.admin_reminder_health() from public, anon;
grant execute on function public.admin_overview(integer) to authenticated;
grant execute on function public.admin_recent(integer) to authenticated;
grant execute on function public.admin_users(integer) to authenticated;
grant execute on function public.admin_reminder_health() to authenticated;

-- Optional: keep a year of events. Uncomment to delete older ones nightly
-- (needs pg_cron, which supabase/reminders.sql turns on).
-- select cron.schedule('mnemoq-trim-events', '15 3 * * *',
--   $$ delete from public.site_events where at < now() - interval '400 days' $$);
