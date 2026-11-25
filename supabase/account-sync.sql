-- Account sync: learning days, Daily results and the learner profile.
--
-- Approved by the owner on 25 Nov 2026 (executive/DECISIONS.md, "later").
-- Applied in Phase 2 wave 2b. Safe to run again.
-- Spec: company/product/phase2-glow-memory-map.md section 8.
-- The app writes these from src/sync/ with idempotent upserts (absolute
-- values, never "+1"), so a replayed offline batch changes nothing.
-- Row level security: each person reads and writes only their own rows.

-- One row per Dhaka calendar day with any learning action.
-- sources: counts per source, e.g. {"review": 12, "daily": 1, "drill": 1, "snap": 2}.
-- glow stays 0 until the Glow wave (wave 3).
create table if not exists public.learning_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  glow integer not null default 0,
  actions integer not null default 0,
  sources jsonb not null default '{}'::jsonb,
  primary key (user_id, day),
  constraint learning_days_glow_check check (glow between 0 and 100000),
  constraint learning_days_actions_check check (actions between 0 and 100000),
  constraint learning_days_sources_check check (jsonb_typeof(sources) = 'object' and pg_column_size(sources) < 2000)
);

-- One row per Daily puzzle played (replaces the device-only "mnemoq-daily").
create table if not exists public.daily_results (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  number integer not null,
  score integer not null default 0,
  marks jsonb not null default '[]'::jsonb,
  played_at timestamptz not null default now(),
  primary key (user_id, number),
  constraint daily_results_number_check check (number between 1 and 100000),
  constraint daily_results_score_check check (score between 0 and 100),
  constraint daily_results_marks_check check (jsonb_typeof(marks) = 'array' and pg_column_size(marks) < 2000)
);

-- The app language (for reminders) and what has been celebrated already.
create table if not exists public.learner_profile (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  lang text not null default 'en',
  milestones_seen jsonb not null default '[]'::jsonb,
  glow_level_seen integer not null default 0,
  constraint learner_profile_lang_check check (lang in ('en', 'bn')),
  constraint learner_profile_milestones_check check (jsonb_typeof(milestones_seen) = 'array' and pg_column_size(milestones_seen) < 4000)
);

alter table public.learning_days enable row level security;
alter table public.daily_results enable row level security;
alter table public.learner_profile enable row level security;

drop policy if exists "own learning days" on public.learning_days;
create policy "own learning days" on public.learning_days
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own daily results" on public.daily_results;
create policy "own daily results" on public.daily_results
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own learner profile" on public.learner_profile;
create policy "own learner profile" on public.learner_profile
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Check (expect rls on for all three, and one "own ..." policy each):
-- select tablename, rowsecurity from pg_tables where schemaname = 'public'
--   and tablename in ('learning_days', 'daily_results', 'learner_profile');
-- select tablename, policyname, cmd, roles, qual, with_check from pg_policies
--   where schemaname = 'public' and tablename in ('learning_days', 'daily_results', 'learner_profile');
