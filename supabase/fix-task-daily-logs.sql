-- ===========================================================================
-- DayForge - FIX: create the missing `task_daily_logs` table
-- ===========================================================================
-- Symptom this fixes:
--   "Could not find the table 'public.task_daily_logs' in the schema cache"
--   ...which leaves the Tasks page and the Dashboard showing NO tasks at all,
--   because hooks/useTasks.ts loads tasks, subtasks AND daily logs together and
--   bails out (showing the error banner) if any one of the three fails.
--
-- Cause: the table was never created in the Supabase project. The full
-- schema.sql already contains these statements (section 6); this file is the
-- same statements on their own, so you can run just the missing part.
--
-- How to run: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Every statement is idempotent, so running it twice is safe.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------
-- One row per task per calendar day: did the user complete the task that day?
--   completed = true   -> "Yes"
--   completed = false  -> "No"
--
-- `log_date` is a plain DATE (a calendar day), not a timestamptz, so a status
-- cannot land on a different day depending on the reader's timezone.
create table if not exists public.task_daily_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade
                default auth.uid(),
  task_id     uuid not null,
  log_date    date not null default current_date,
  completed   boolean not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.task_daily_logs is
  'Daily completion history for tasks: one row per task per day (Yes/No). RLS restricts every operation to the owner.';


-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------
-- "One status per task per day". The dashboard upserts on this pair, so this
-- unique index is what makes a repeated submission an update, not a duplicate.
create unique index if not exists task_daily_logs_task_id_log_date_key
  on public.task_daily_logs (task_id, log_date);

create index if not exists task_daily_logs_user_id_log_date_idx
  on public.task_daily_logs (user_id, log_date);

create index if not exists task_daily_logs_task_id_log_date_idx_desc
  on public.task_daily_logs (task_id, log_date desc);


-- ---------------------------------------------------------------------------
-- 3. Ownership guarantee
-- ---------------------------------------------------------------------------
-- A composite FK to tasks (id, user_id) means a log row can never belong to a
-- different owner than the task it describes.
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

-- Stamp user_id from the parent task, and keep `updated_at` honest on upsert.
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
-- 4. Row-level security
-- ---------------------------------------------------------------------------
-- Four owner-only policies, the same shape as tasks and subtasks.
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
-- 5. Force PostgREST to pick up the new table immediately
-- ---------------------------------------------------------------------------
-- Supabase caches the schema; without this the API can keep reporting
-- "Could not find the table ... in the schema cache" for a short while after the
-- table is created. Cheap to run, and harmless if it is not needed.
notify pgrst, 'reload schema';
