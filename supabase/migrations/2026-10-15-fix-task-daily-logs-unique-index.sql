-- ===========================================================================
-- DayForge - FIX: the missing unique index on task_daily_logs  (2026-10-15)
-- ===========================================================================
-- Symptom this fixes:
--   "Could not save today's status. Please try again." on every Yes/No click,
--   with a daily-completion history that stays empty and 0% progress forever.
--
-- Root cause (confirmed live, SQLSTATE 42P10):
--   hooks/useTasks.ts submits a daily status with
--     .upsert({ task_id, log_date, completed }, { onConflict: "task_id,log_date" })
--   PostgREST turns `onConflict` into an ON CONFLICT (task_id, log_date) clause.
--   The live project has the task_daily_logs TABLE (created earlier) but NOT the
--   unique index on (task_id, log_date), so Postgres rejects every upsert at
--   plan time: "there is no unique or exclusion constraint matching the ON
--   CONFLICT specification". Nothing was ever saved, which is also why the
--   history chart is empty.
--
-- How to run: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Idempotent and non-destructive: no tables/columns are touched, no data is
-- modified, and re-running this file is safe.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. The missing index (the fix itself)
-- ---------------------------------------------------------------------------
-- "One status per task per day": a repeated Yes/No submission becomes an UPDATE
-- of the existing row instead of a duplicate INSERT. This is the index the
-- app's upsert conflict target (task_id, log_date) resolves against.
create unique index if not exists task_daily_logs_task_id_log_date_key
  on public.task_daily_logs (task_id, log_date);

-- Also useful for loading a user's history oldest-first (the app's read query),
-- and harmless if it already exists.
create index if not exists task_daily_logs_user_id_log_date_idx
  on public.task_daily_logs (user_id, log_date);

create index if not exists task_daily_logs_task_id_log_date_idx_desc
  on public.task_daily_logs (task_id, log_date desc);


-- ---------------------------------------------------------------------------
-- 2. Fail loudly instead of silently if duplicates already exist
-- ---------------------------------------------------------------------------
-- If the table somehow already holds two rows for the same task/day, the plain
-- CREATE UNIQUE INDEX above would abort the whole script with an opaque error
-- before the remaining statements run. This block reports the problem in plain
-- language first and aborts, so nothing is half-applied. No data is changed.
do $$
declare
  duplicate_pairs int;
begin
  select count(*) into duplicate_pairs from (
    select 1 from public.task_daily_logs
    group by task_id, log_date
    having count(*) > 1
  ) as dupes;

  if duplicate_pairs > 0 then
    raise exception
      'task_daily_logs contains % duplicate (task_id, log_date) pair(s). ' ||
      'Resolve them before creating the unique index: inspect them with ' ||
      'select id, task_id, log_date, completed, created_at from public.task_daily_logs ' ||
      'where (task_id, log_date) in (select task_id, log_date from public.task_daily_logs ' ||
      'group by task_id, log_date having count(*) > 1) order by created_at; ' ||
      'delete the rows you do not want to keep, then re-run this file. ' ||
      'Nothing was changed by this run.',
      duplicate_pairs;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 3. Composite ownership FK + user_id stamping trigger (verify, not change)
-- ---------------------------------------------------------------------------
-- The same statements as supabase/schema.sql section 6. They are written as
-- create-or-replace / drop-if-exists so running them again is safe, and they
-- guarantee:
--   - a log row can only reference a task owned by the same user
--   - user_id is stamped from the parent task on every write
--   - updated_at stays honest on every upsert
alter table public.tasks
  drop constraint if exists tasks_id_user_id_key;
alter table public.tasks
  add constraint tasks_id_user_id_key unique (id, user_id);

alter table public.task_daily_logs
  drop constraint if exists task_daily_logs_task_fk;
alter table public.task_daily_logs
  add constraint task_daily_logs_task_fk
  foreign key (task_id, user_id)
  references public.tasks (id, user_id)
  on delete cascade;

create or replace function public.set_task_daily_log_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    select t.user_id into new.user_id from public.tasks t where t.id = new.task_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_task_daily_log_user_id_before_write on public.task_daily_logs;
create trigger set_task_daily_log_user_id_before_write
  before insert or update on public.task_daily_logs
  for each row execute function public.set_task_daily_log_user_id();


-- ---------------------------------------------------------------------------
-- 4. RLS policies (verify, not change)
-- ---------------------------------------------------------------------------
-- Four owner-only policies, exactly as in schema.sql section 6b. Re-created
-- idempotently so a live project that is missing one (or has a subtly wrong
-- one) converges to the correct state. RLS is never disabled.
alter table public.task_daily_logs enable row level security;

drop policy if exists "Users can view own daily logs" on public.task_daily_logs;
create policy "Users can view own daily logs"
  on public.task_daily_logs
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own daily logs" on public.task_daily_logs;
create policy "Users can insert own daily logs"
  on public.task_daily_logs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own daily logs" on public.task_daily_logs;
create policy "Users can update own daily logs"
  on public.task_daily_logs
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own daily logs" on public.task_daily_logs;
create policy "Users can delete own daily logs"
  on public.task_daily_logs
  for delete
  to authenticated
  using (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 5. Recurrence deduplication index (verify, not change)
-- ---------------------------------------------------------------------------
-- The (recurrence_source_id, due_at) partial unique index the recurring-task
-- flow relies on. Same idempotent re-creation as schema.sql. If the table
-- already holds duplicate pairs the DO block below reports them and stops
-- before making things worse.
create unique index if not exists tasks_recurrence_occurrence_key
  on public.tasks (recurrence_source_id, due_at)
  where recurrence_source_id is not null;

do $$
declare
  duplicate_pairs int;
begin
  select count(*) into duplicate_pairs from (
    select 1 from public.tasks
    where recurrence_source_id is not null
    group by recurrence_source_id, due_at
    having count(*) > 1
  ) as dupes;

  if duplicate_pairs > 0 then
    raise notice
      'WARNING: public.tasks contains % duplicate (recurrence_source_id, due_at) pair(s); ' ||
      'the partial unique index tasks_recurrence_occurrence_key may be missing. ' ||
      'Inspect and remove duplicates, then re-run this file.',
      duplicate_pairs;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 6. Refresh the API schema cache
-- ---------------------------------------------------------------------------
-- PostgREST caches the schema; without this it can keep answering with stale
-- metadata for a short while after DDL.
notify pgrst, 'reload schema';


-- ===========================================================================
-- POST-MIGRATION CHECKLIST - verify in the Supabase dashboard / SQL Editor
-- ===========================================================================
-- [ ] Index exists (expect ONE row):
--       select indexname from pg_indexes
--        where schemaname = 'public' and tablename = 'task_daily_logs'
--          and indexname = 'task_daily_logs_task_id_log_date_key';
--
-- [ ] RLS enabled with 4 policies on task_daily_logs (select/insert/update/
--     delete), each with `auth.uid() = user_id`.
--
-- [ ] Smoke test as a signed-in user: click Yes on a task -> the row appears in
--     task_daily_logs; click No for the same day -> the SAME row flips its
--     completed value (no second row).
-- ===========================================================================
