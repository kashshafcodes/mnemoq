-- Mnemoq referrals, part 2 (Phase 2 wave 3d-2). NOT APPLIED: Ops reviews and
-- runs it once in the Supabase SQL editor, AFTER supabase/referrals.sql.
--
-- 1. referral_settle (replaced, same signature): when the referrer is over a
--    cap, the friend still gets their days and the referrer gets 0. The row is
--    'granted' with reason 'cap_month' / 'cap_total' and days_referrer = 0
--    (Ops decision on 3d-1 question 1: the friend did nothing wrong).
--    Caps count only rows that paid the referrer (days_referrer > 0), granted
--    or revoked (a revoked one was fraud and must not free a slot).
-- 2. referral_release(friend): the owner's Release of a HELD referral. Re-checks
--    the caps under the same locks, grants the friend 7 days and the referrer
--    7 (or 0 over a cap). -> { status, reason, already }
-- 3. referral_revoke(friend): the owner's Revoke of a HELD or GRANTED referral.
--    Marks it 'revoked' and takes back the days it gave, never ending Pro
--    earlier than now (days already used are not clawed back). -> { status, already }
--
-- All three are security definer and callable only by service_role. The admin
-- check (site_admins) is done in api/referral.js before it calls them.

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
  days_ref integer := 0;
begin
  if p_friend is null or st not in ('held', 'granted', 'rejected') then
    return jsonb_build_object('status', 'invalid');
  end if;

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
    days_ref := days;

    select count(*),
           count(*) filter (where to_char(qualified_at at time zone 'Asia/Dhaka', 'YYYY-MM')
                                = to_char(now() at time zone 'Asia/Dhaka', 'YYYY-MM'))
      into total_used, month_used
      from public.referral_rewards
     where referrer_id = p_referrer and status in ('granted', 'revoked') and days_referrer > 0;

    if total_used >= 10 then
      days_ref := 0;
      why := 'cap_total';
    elsif month_used >= 3 then
      days_ref := 0;
      why := 'cap_month';
    end if;
  end if;

  insert into public.referral_rewards
    (referrer_id, friend_id, refcode, status, reason, friend_signup_at, qualified_at, days_referrer, days_friend)
  values
    (p_referrer, p_friend, coalesce(left(p_refcode, 8), ''), st, why, p_signup_at,
     case when st = 'granted' then now() else null end,
     days_ref,
     case when st = 'granted' then days else 0 end);

  if st = 'granted' then
    if days_ref > 0 then
      perform public.grant_pro_days(p_referrer, days_ref);
    end if;
    friend_until := public.grant_pro_days(p_friend, days);
  end if;

  insert into public.site_events (visitor_id, user_id, event, page, props)
  values (
    'server-referral',
    p_friend,
    case st when 'granted' then 'ref_qualified' when 'held' then 'ref_held' else 'ref_rejected' end,
    'server',
    case when st = 'granted'
      then jsonb_build_object('referrer_id', p_referrer, 'friend_id', p_friend, 'days_referrer', days_ref, 'reason', why)
      else jsonb_build_object('reason', why) end
  );

  return jsonb_build_object('status', st, 'reason', why, 'already', false,
    'days_friend', case when st = 'granted' then days else 0 end,
    'pro_until_friend', friend_until);
end;
$$;

-- The owner releases a held referral: it is paid as if it had been granted now.
create or replace function public.referral_release(p_friend uuid, p_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_now public.referral_rewards%rowtype;
  total_used integer;
  month_used integer;
  days integer := least(greatest(coalesce(p_days, 0), 1), 30);
  days_ref integer;
  why text := 'released';
begin
  if p_friend is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  perform pg_advisory_xact_lock(hashtext('ref-friend:' || p_friend::text));
  select * into row_now from public.referral_rewards where friend_id = p_friend;
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;
  if row_now.status <> 'held' then
    return jsonb_build_object('status', row_now.status, 'already', true);
  end if;
  if row_now.referrer_id is not null then
    perform pg_advisory_xact_lock(hashtext('ref-referrer:' || row_now.referrer_id::text));
  end if;

  days_ref := case when row_now.referrer_id is null or row_now.referrer_id = p_friend then 0 else days end;

  if days_ref > 0 then
    select count(*),
           count(*) filter (where to_char(qualified_at at time zone 'Asia/Dhaka', 'YYYY-MM')
                                = to_char(now() at time zone 'Asia/Dhaka', 'YYYY-MM'))
      into total_used, month_used
      from public.referral_rewards
     where referrer_id = row_now.referrer_id and status in ('granted', 'revoked') and days_referrer > 0;

    if total_used >= 10 then
      days_ref := 0;
      why := 'cap_total';
    elsif month_used >= 3 then
      days_ref := 0;
      why := 'cap_month';
    end if;
  end if;

  update public.referral_rewards
     set status = 'granted', reason = why, qualified_at = now(), days_referrer = days_ref, days_friend = days
   where friend_id = p_friend;

  if days_ref > 0 then
    perform public.grant_pro_days(row_now.referrer_id, days_ref);
  end if;
  perform public.grant_pro_days(p_friend, days);

  insert into public.site_events (visitor_id, user_id, event, page, props)
  values ('server-referral', p_friend, 'ref_released', 'server',
    jsonb_build_object('referrer_id', row_now.referrer_id, 'friend_id', p_friend, 'days_referrer', days_ref, 'reason', why));

  return jsonb_build_object('status', 'granted', 'reason', why, 'already', false);
end;
$$;

-- The owner revokes a held or granted referral and takes back its days.
create or replace function public.referral_revoke(p_friend uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_now public.referral_rewards%rowtype;
begin
  if p_friend is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  perform pg_advisory_xact_lock(hashtext('ref-friend:' || p_friend::text));
  select * into row_now from public.referral_rewards where friend_id = p_friend;
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;
  if row_now.status not in ('held', 'granted') then
    return jsonb_build_object('status', row_now.status, 'already', true);
  end if;

  update public.referral_rewards set status = 'revoked', reason = 'owner_revoked' where friend_id = p_friend;

  -- Take the days back, but never end Pro before now.
  if row_now.status = 'granted' then
    update public.user_plans
       set pro_until = greatest(pro_until - make_interval(days => row_now.days_friend), now()), updated_at = now()
     where user_id = p_friend and row_now.days_friend > 0 and pro_until > now();
    if row_now.referrer_id is not null then
      update public.user_plans
         set pro_until = greatest(pro_until - make_interval(days => row_now.days_referrer), now()), updated_at = now()
       where user_id = row_now.referrer_id and row_now.days_referrer > 0 and pro_until > now();
    end if;
  end if;

  insert into public.site_events (visitor_id, user_id, event, page, props)
  values ('server-referral', p_friend, 'ref_revoked', 'server',
    jsonb_build_object('referrer_id', row_now.referrer_id, 'friend_id', p_friend, 'was', row_now.status));

  return jsonb_build_object('status', 'revoked', 'already', false);
end;
$$;

revoke all on function public.referral_settle(uuid, uuid, text, text, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.referral_release(uuid, integer) from public, anon, authenticated;
revoke all on function public.referral_revoke(uuid) from public, anon, authenticated;
grant execute on function public.referral_settle(uuid, uuid, text, text, text, timestamptz, integer) to service_role;
grant execute on function public.referral_release(uuid, integer) to service_role;
grant execute on function public.referral_revoke(uuid) to service_role;
grant update on public.referral_rewards to service_role;

-- Readback (expect 3 rows, each security definer, no execute for anon/authenticated):
-- select p.proname, p.prosecdef,
--        has_function_privilege('anon', p.oid, 'execute') as anon_exec,
--        has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname in ('referral_settle', 'referral_release', 'referral_revoke');
