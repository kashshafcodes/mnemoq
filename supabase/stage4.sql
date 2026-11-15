-- Stage 4: more than one exam path per account (for example NSU and SAT).
--
-- Run this once in the Supabase SQL editor. It is safe to run again.
--
-- Before: user_paths holds one row per person.
-- After:  one row per person per path, with is_active marking the one in use.
--
-- It also removes limits that only made sense for a 0-100 readiness score or
-- a fixed list of paths, because a SAT target is a score such as 1400.

alter table public.user_paths add column if not exists is_active boolean not null default true;

do $$
declare
  item record;
  has_pk boolean;
begin
  -- 1. Drop "one row per user" rules (a primary key or unique rule on user_id alone).
  for item in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.user_paths'::regclass
      and con.contype in ('p', 'u')
      and array_length(con.conkey, 1) = 1
      and (
        select att.attname
        from pg_attribute att
        where att.attrelid = con.conrelid and att.attnum = con.conkey[1]
      ) = 'user_id'
  loop
    execute format('alter table public.user_paths drop constraint %I', item.conname);
  end loop;

  -- The same rule written as a stand-alone unique index.
  for item in
    select idx.indexrelid::regclass::text as index_name
    from pg_index idx
    where idx.indrelid = 'public.user_paths'::regclass
      and idx.indisunique
      and idx.indnatts = 1
      and not exists (select 1 from pg_constraint con where con.conindid = idx.indexrelid)
      and (
        select att.attname
        from pg_attribute att
        where att.attrelid = idx.indrelid and att.attnum = idx.indkey[0]
      ) = 'user_id'
  loop
    execute format('drop index %s', item.index_name);
  end loop;

  -- 2. Drop checks that limit the target score or the list of paths.
  for item in
    select con.conrelid::regclass::text as table_name, con.conname
    from pg_constraint con
    where con.contype = 'c'
      and con.conrelid in (
        select cls.oid
        from pg_class cls
        join pg_namespace ns on ns.oid = cls.relnamespace
        where ns.nspname = 'public'
          and cls.relname in ('user_paths', 'diagnostics', 'mock_results', 'my_questions')
      )
      and (
        pg_get_constraintdef(con.oid) ilike '%target_score%'
        or pg_get_constraintdef(con.oid) ilike '%path_id%'
      )
  loop
    execute format('alter table %s drop constraint %I', item.table_name, item.conname);
  end loop;

  -- 3. One row per person per path.
  select exists (
    select 1 from pg_constraint where conrelid = 'public.user_paths'::regclass and contype = 'p'
  ) into has_pk;

  if has_pk then
    create unique index if not exists user_paths_user_path_key on public.user_paths (user_id, path_id);
  else
    alter table public.user_paths add constraint user_paths_pkey primary key (user_id, path_id);
  end if;
end $$;

-- A SAT target does not fit a small number type.
alter table public.user_paths alter column target_score type integer;

-- Tell the API about the new column straight away.
notify pgrst, 'reload schema';
