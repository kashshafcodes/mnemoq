-- Snap attempt counter: one row per call to /api/snap, card or not.
--
-- NOT APPLIED YET: waiting for the owner's yes (proposed in Phase 2 wave 2b).
-- Safe to run again. Until it runs, api/_aiLimit.js skips the attempt cap.
--
-- Why: an unreadable, failed or busy read costs the student no snap, so one
-- account could make unlimited Gemini calls. api/snap.js refuses a call once
-- a person has made 3 x their snap allowance of calls in 24 hours.
-- Like ai_usage: the owner of the rows can read and add them, never edit or
-- delete them, so the counter cannot be reset from the app.

create table if not exists public.snap_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.snap_attempts enable row level security;

drop policy if exists "read own usage" on public.snap_attempts;
create policy "read own usage" on public.snap_attempts
  for select using (auth.uid() = user_id);

drop policy if exists "add own usage" on public.snap_attempts;
create policy "add own usage" on public.snap_attempts
  for insert with check (auth.uid() = user_id);

create index if not exists snap_attempts_user_time on public.snap_attempts (user_id, created_at);

-- Old rows are not needed after a day; a cleanup job can delete rows older
-- than 2 days with the service role (not needed for correctness).
