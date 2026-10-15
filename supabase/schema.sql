-- ===========================================================================
-- DayForge - complete database schema
-- ===========================================================================
-- Everything this project needs so far, in dependency order:
--   1. profiles         (+ signup trigger, + RLS)
--   2. tasks            (+ RLS)
--   3. tasks recurrence fields
--   4. subtasks         (+ ownership guarantee, + RLS)
--   5. tasks recurrence deduplication
--   6. task_daily_logs  (+ ownership guarantee, + RLS)
--
-- How to run: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Every statement is idempotent, so running this file twice is safe.
--
-- Ordering note: both tables reference auth.users (managed by Supabase), not
-- each other, so either could come first. profiles goes first because the
-- trigger it installs fires on signup, which is when a user's first row lands.
-- ===========================================================================


-- ===========================================================================
-- 1. profiles
-- ===========================================================================
-- Public profile data, one row per user. `id` is both the primary key and a
-- foreign key to auth.users, so a profile cannot exist without a user, and
-- deleting the user removes the profile (ON DELETE CASCADE).
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text,
  university  text,
  department  text,
  semester    text,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Public profile data for each user. One row per auth.users row.';


-- ---------------------------------------------------------------------------
-- 1a. Trigger: create a profile row when a user signs up
-- ---------------------------------------------------------------------------
-- auth.users lives in a schema we should not write to directly, so the function
-- runs as its definer (SECURITY DEFINER) to insert into public.profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    -- Prefer the name supplied at signup (options.data.name); fall back to the
    -- part of the email before the @, then to null.
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;  -- idempotent if the row already exists
  return new;
end;
$$;

-- Drop first so re-running does not create a duplicate trigger.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- 1b. Row-level security for profiles
-- ---------------------------------------------------------------------------
-- RLS is deny-by-default: once enabled, no rows are visible until a policy
-- grants access. Both policies are scoped to auth.uid(), so a user can only
-- ever touch their own row.
alter table public.profiles enable row level security;

-- Read your own profile.
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Update your own profile.
-- USING chooses which rows are eligible; WITH CHECK re-verifies the row after
-- the update, stopping a user from rewriting `id` to hijack another row.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Deliberately NO insert policy: rows are created only by the trigger above.
-- Deliberately NO delete policy: profiles disappear with the auth user.


-- ---------------------------------------------------------------------------
-- 1c. Backfill
-- ---------------------------------------------------------------------------
-- The trigger only fires for users created AFTER it exists. If you already
-- signed up before running this file, create the missing rows now.
insert into public.profiles (id, name)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'name', ''),
    split_part(u.email, '@', 1)
  )
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;


-- ===========================================================================
-- 2. tasks
-- ===========================================================================
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),

  -- Owner of the row. Defaulting to auth.uid() means the client can insert a
  -- task without sending user_id: the database fills in whoever is signed in.
  user_id     uuid references auth.users (id) on delete cascade
                default auth.uid(),

  title       text not null,
  description text,

  -- Stored as an absolute instant (UTC). The UI renders it in the browser's
  -- local timezone, so the same row looks correct anywhere.
  due_at      timestamptz,

  priority    text not null default 'medium'
                check (priority in ('low', 'medium', 'high')),
  category    text not null default 'Personal',
  status      text not null default 'todo'
                check (status in ('todo', 'in_progress', 'done')),

  created_at  timestamptz not null default now()
);

comment on table public.tasks is
  'Per-user tasks. RLS restricts every operation to the owning user.';

-- The list view filters by user and sorts on due_at, so index both together.
create index if not exists tasks_user_id_due_at_idx
  on public.tasks (user_id, due_at);


-- ---------------------------------------------------------------------------
-- 2a. Row-level security for tasks
-- ---------------------------------------------------------------------------
alter table public.tasks enable row level security;

-- SELECT - read your own tasks.
drop policy if exists "Users can view own tasks" on public.tasks;
create policy "Users can view own tasks"
  on public.tasks
  for select
  to authenticated
  using (auth.uid() = user_id);

-- INSERT - create tasks for yourself only.
-- WITH CHECK is what stops a user from inserting a row owned by someone else.
drop policy if exists "Users can insert own tasks" on public.tasks;
create policy "Users can insert own tasks"
  on public.tasks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- UPDATE - edit your own tasks.
-- USING selects eligible rows; WITH CHECK re-verifies the row afterwards, so
-- user_id cannot be reassigned to another account.
drop policy if exists "Users can update own tasks" on public.tasks;
create policy "Users can update own tasks"
  on public.tasks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE - remove your own tasks.
drop policy if exists "Users can delete own tasks" on public.tasks;
create policy "Users can delete own tasks"
  on public.tasks
  for delete
  to authenticated
  using (auth.uid() = user_id);


-- ===========================================================================
-- 3. tasks - recurring fields  (appended 2026-10-09)
-- ===========================================================================
-- Added as separate ALTERs rather than editing the create table above, so the
-- file stays append-only: re-running converges an existing database instead of
-- expecting a fresh one.

alter table public.tasks
  add column if not exists recurrence_type text default 'none';

alter table public.tasks
  add column if not exists recurrence_days int[];

-- Guarded check constraints: drop first, then add. Postgres has no
-- `add constraint if not exists`, so this pair is what makes re-running safe.
alter table public.tasks
  drop constraint if exists tasks_recurrence_type_check;

alter table public.tasks
  add constraint tasks_recurrence_type_check
  check (recurrence_type in ('none', 'daily', 'weekly', 'custom'));

-- Any weekday outside 0-6 would break the "next occurrence" maths.
alter table public.tasks
  drop constraint if exists tasks_recurrence_days_check;

alter table public.tasks
  add constraint tasks_recurrence_days_check
  check (
    recurrence_days is null
    or (
      -- array_length is NULL for an empty array, and `<@` is "is contained by".
      array_length(recurrence_days, 1) between 1 and 7
      and recurrence_days <@ array[0, 1, 2, 3, 4, 5, 6]
    )
  );

comment on column public.tasks.recurrence_type is
  'none | daily | weekly | custom. Weeks are anchored on the due date.';
comment on column public.tasks.recurrence_days is
  'Weekdays (0=Sun .. 6=Sat) for recurrence_type=custom. NULL otherwise.';


-- ===========================================================================
-- 4. subtasks
-- ===========================================================================
-- A checklist attached to one task. Two foreign keys, both cascading: deleting
-- a task removes its subtasks, and deleting the auth user removes everything.
--
-- `unique (id, user_id)` looks redundant (id is already the primary key) but it
-- is required: it lets subtasks carry a composite FK to tasks (id, user_id),
-- which is what makes "a subtask belongs to the same owner as its task" a
-- database guarantee rather than a hope.
create table if not exists public.subtasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade
                default auth.uid(),
  task_id     uuid not null,
  title       text not null,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.subtasks is
  'Checklist items belonging to a task. RLS restricts every operation to the owner.';

-- The checklist is always read by task, oldest first.
create index if not exists subtasks_task_id_created_at_idx
  on public.subtasks (task_id, created_at);


-- ---------------------------------------------------------------------------
-- 4a. Ownership guarantee
-- ---------------------------------------------------------------------------
-- Runs after the table exists so it is safe to re-run. Dropped first (rather
-- than `add constraint if not exists`, which Postgres lacks) so the statement
-- stays idempotent.
--
-- Without this, an insert could name any task_id. The composite key plus the
-- trigger below mean a subtask can never belong to a different owner than the
-- task it hangs off.
alter table public.tasks
  drop constraint if exists tasks_id_user_id_key;
alter table public.tasks
  add constraint tasks_id_user_id_key unique (id, user_id);

alter table public.subtasks
  drop constraint if exists subtasks_task_fk;
alter table public.subtasks
  add constraint subtasks_task_fk
  foreign key (task_id, user_id)
  references public.tasks (id, user_id)
  on delete cascade;

-- Belt and braces: stamp user_id from the parent task, so a client cannot
-- claim someone else's task even if the composite FK were ever dropped.
create or replace function public.set_subtask_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    select t.user_id into new.user_id from public.tasks t where t.id = new.task_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_subtask_user_id_before_insert on public.subtasks;
create trigger set_subtask_user_id_before_insert
  before insert on public.subtasks
  for each row execute function public.set_subtask_user_id();


-- ---------------------------------------------------------------------------
-- 4b. Row-level security for subtasks
-- ---------------------------------------------------------------------------
-- Same shape as tasks: four owner-only policies, all scoped to auth.uid().
alter table public.subtasks enable row level security;

drop policy if exists "Users can view own subtasks" on public.subtasks;
create policy "Users can view own subtasks"
  on public.subtasks
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own subtasks" on public.subtasks;
create policy "Users can insert own subtasks"
  on public.subtasks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own subtasks" on public.subtasks;
create policy "Users can update own subtasks"
  on public.subtasks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own subtasks" on public.subtasks;
create policy "Users can delete own subtasks"
  on public.subtasks
  for delete
  to authenticated
  using (auth.uid() = user_id);


-- ===========================================================================
-- 5. tasks - recurrence deduplication  (appended 2026-10-09)
-- ===========================================================================
-- Completing a recurring task inserts its next occurrence. Two things could
-- trigger that insert - a double click, or two tabs/devices racing - so "one
-- occurrence per source and due date" has to be a database guarantee, not an
-- application-code check. A partial unique index gives exactly that, and the
-- second concurrent insert simply fails with SQLSTATE 23505 instead of creating
-- a duplicate.

-- Which task this row is the next occurrence of. NULL = not an occurrence of
-- anything, which is the case for every ordinary task. A row-level CHECK would
-- enforce the "source must be recurring" part, but it would need a subquery,
-- which CHECK forbids; the composite FK below gets the guarantee without one.
alter table public.tasks
  add column if not exists recurrence_source_id uuid;

comment on column public.tasks.recurrence_source_id is
  'The task this row is the next occurrence of. NULL for ordinary tasks.';

-- Self-reference back to tasks. Dropped first because Postgres has no
-- `add constraint if not exists`, matching the guard used for the subtask FK.
--
-- ON DELETE SET NULL, not CASCADE: deleting a task that happens to be someone's
-- source must not wipe out a list of other tasks. The only thing lost is the
-- link, and deleting a task already switches recurrence off. The composite FK
-- (id, user_id) - not the plain tasks (id) - is deliberate: it makes the source
-- row provably belong to the same user as the row referencing it, so a crafted
-- recurrence_source_id cannot point at another user's task.
alter table public.tasks
  drop constraint if exists tasks_recurrence_source_fk;
alter table public.tasks
  add constraint tasks_recurrence_source_fk
  foreign key (recurrence_source_id, user_id)
  references public.tasks (id, user_id)
  on delete set null;

-- The deduplication guarantee itself.
--
-- Partial, because recurrence_source_id IS NULL on every ordinary task and
-- those must never collide: in a plain unique index, NULLs are still distinct
-- from each other, but a partial index states the intent and keeps the
-- structure free of rows that can never collide.
--
-- `if not exists` is load-bearing here. A plain CREATE UNIQUE INDEX that hits a
-- table already holding duplicate pairs fails the whole statement (and the
-- script); guarded this way, a first run that genuinely cannot build the index
-- leaves the table without one, and a later run warns and skips instead.
create unique index if not exists tasks_recurrence_occurrence_key
  on public.tasks (recurrence_source_id, due_at)
  where recurrence_source_id is not null;


-- ===========================================================================
-- POST-SETUP CHECKLIST - verify these in the Supabase dashboard
-- ===========================================================================
-- [ ] TABLES EXIST
--     Table Editor should list `profiles`, `tasks`, `subtasks` and
--     `task_daily_logs` under the `public` schema.
--
-- [ ] RLS IS ENABLED ON EACH TABLE
--     Table Editor -> select table -> "RLS enabled" badge should be ON.
--     Or Authentication -> Policies: every table must show a green shield.
--     Check `profiles`        has 2 policies (select, update).
--     Check `tasks`           has 4 policies (select, insert, update, delete).
--     Check `subtasks`        has 4 policies (select, insert, update, delete).
--     Check `task_daily_logs` has 4 policies (select, insert, update, delete).
--
-- [ ] DAILY COMPLETION LOG
--     `task_daily_logs` should have `log_date` (default current_date) and
--     `completed` (boolean). One row per task per day is guaranteed by the
--     unique index `task_daily_logs_task_id_log_date_key`:
--       select indexname from pg_indexes
--        where schemaname = 'public' and tablename = 'task_daily_logs'
--          and indexname = 'task_daily_logs_task_id_log_date_key';
--
-- [ ] RECURRING TASK COLUMNS
--     `tasks` should have `recurrence_type` (default 'none'),
--     `recurrence_days`, and `recurrence_source_id` (NULL for ordinary tasks).
--     Both check constraints should be present:
--     tasks_recurrence_type_check and tasks_recurrence_days_check.
--
-- [ ] RECURRENCE DEDUPLICATION
--     Run this and expect ONE row with indexdef ending in
--     "WHERE (recurrence_source_id IS NOT NULL)":
--       select indexname, indexdef from pg_indexes
--        where schemaname = 'public' and tablename = 'tasks'
--          and indexname = 'tasks_recurrence_occurrence_key';
--
--     If the statement that created it reported
--     "NOTICE: ... skipping" instead, the table already contained duplicate
--     (recurrence_source_id, due_at) pairs. Remove the duplicates, then
--     re-run this file.
--
--     Then confirm the guard bites. The second insert must fail with
--     "duplicate key value violates unique constraint
--     \"tasks_recurrence_occurrence_key\"":
--       begin;
--       insert into public.tasks (user_id, title, due_at, recurrence_source_id)
--       select user_id, 'dup guard A', due_at, recurrence_source_id
--         from public.tasks
--        where recurrence_source_id is not null
--        order by created_at limit 1;
--       insert into public.tasks (user_id, title, due_at, recurrence_source_id)
--       select user_id, 'dup guard B', due_at, recurrence_source_id
--         from public.tasks
--        where recurrence_source_id is not null
--        order by created_at limit 1;
--       rollback;   -- leaves no trace
--
--     A unique index is enforced for every transaction, so the same rejection
--     is what a second concurrent insert gets - the loser of the race errors,
--     it does not create a duplicate row.
--
-- [ ] SIGNUP TRIGGER WORKS
--     Create a test account, then confirm a matching row appeared in
--     `profiles`. If it did not, the trigger is missing or was dropped.
--
-- [ ] AUTH PROVIDERS
--     Authentication -> Providers:
--       - Email: enabled. Choose whether "Confirm email" is ON. If ON, users
--         must click the emailed link before they can log in.
--       - Google: enabled, with the Client ID and Client secret pasted in from
--         Google Cloud Console. Google needs the Supabase callback URL
--         (https://<project-ref>.supabase.co/auth/v1/callback) under its
--         "Authorized redirect URIs", NOT your app's own callback.
--
-- [ ] SITE URL
--     Authentication -> URL Configuration -> Site URL
--     Development: http://localhost:3000
--     Production:  https://your-domain.com
--
-- [ ] REDIRECT URLS
--     Authentication -> URL Configuration -> Redirect URLs. Supabase rejects
--     any redirect not on this list, so add every environment:
--       - http://localhost:3000/auth/callback
--       - https://your-domain.com/auth/callback
--       - your Vercel preview pattern, e.g.
--         https://*-your-team.vercel.app/auth/callback
--
-- [ ] PASSWORD RESET EMAIL (only if you use /forgot-password)
--     Authentication -> Email Templates -> "Reset password". The link must
--     point at: {{ .SiteURL }}/auth/callback?next=/reset-password
--
-- [ ] ENVIRONMENT VARIABLES
--     .env.local must define NEXT_PUBLIC_SUPABASE_URL and
--     NEXT_PUBLIC_SUPABASE_ANON_KEY (Project Settings -> API). Never put the
--     service_role key in a NEXT_PUBLIC_ variable: it bypasses RLS entirely.


-- ===========================================================================
-- 6. task_daily_logs  (appended 2026-10-14)
-- ===========================================================================
-- One row per task per calendar day: did the user complete the task that day?
--   completed = true   -> "Yes"
--   completed = false  -> "No"
--
-- This is the daily history the dashboard charts read. It is deliberately
-- separate from `tasks.status` (which is just "is it done right now"): a task
-- can be completed on Monday, missed on Tuesday and completed again on
-- Wednesday, and every one of those days is a row here.
--
-- `log_date` is a plain DATE in the user's own calendar, not a timestamptz.
-- "Did I do it on the 14th?" is a calendar question, so storing it as a date
-- avoids the whole timezone trap of a moment that lands on a different day
-- depending on where it is read.
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

-- "One status per task per day". The dashboard upserts on this pair, so the
-- unique constraint is what makes a repeated submission an update rather than a
-- duplicate row - the same guard-in-the-database idea as the recurrence index.
create unique index if not exists task_daily_logs_task_id_log_date_key
  on public.task_daily_logs (task_id, log_date);

-- The charts read a task's history newest-first, and "today's tasks" reads one
-- day at a time; this index serves both.
create index if not exists task_daily_logs_user_id_log_date_idx
  on public.task_daily_logs (user_id, log_date);

create index if not exists task_daily_logs_task_id_log_date_idx_desc
  on public.task_daily_logs (task_id, log_date desc);


-- ---------------------------------------------------------------------------
-- 6a. Ownership guarantee
-- ---------------------------------------------------------------------------
-- Same pattern as subtasks: a composite FK to tasks (id, user_id) means a log
-- row can never belong to a different owner than the task it describes. The
-- table's own primary key already makes `id` unique; the extra unique pair is
-- what the composite FK targets.
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

-- Stamp user_id from the parent task, so a client cannot claim someone else's
-- task even if the composite FK were ever dropped. Also keeps `updated_at`
-- honest on every edit, since the dashboard submits by upsert.
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
-- 6b. Row-level security for task_daily_logs
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

-- ===========================================================================
-- 7. notes, habits, challenges and preferences  (appended 2026-10-15)
-- ===========================================================================
-- The section below is the contents of
--   supabase/migrations/2026-10-15-notes-habits-challenges-preferences.sql
-- inlined here so this file stays the single source of truth for the database.
-- Nothing in it alters existing data: it only creates tables and columns.
-- Every statement is idempotent.
-- ===========================================================================
-- DayForge - migration: notes, habits, challenges, preferences  (2026-10-15)
-- ===========================================================================
-- Adds the tables the Notes, Habits, Challenges and Settings pages need.
-- Nothing here touches the existing tables' data: there are no drops of
-- tables or columns, no data rewrites and no destructive statements of any
-- kind. Every statement is idempotent, so running this file twice is safe.
--
-- How to run: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- (The same SQL is appended to supabase/schema.sql, which remains the single
-- source of truth for the database; running either one converges the same
-- schema.)
-- ===========================================================================


-- ===========================================================================
-- 1. profiles - preference columns
-- ===========================================================================
-- Settings stores real preferences on the profile row rather than in
-- localStorage, so they follow the user to any device. TEXT + CHECK is used
-- instead of an enum: adding a value later is a one-line change with no type
-- migration.
alter table public.profiles
  add column if not exists theme text not null default 'system';
alter table public.profiles
  add column if not exists week_start int not null default 1;
alter table public.profiles
  add column if not exists default_task_category text;
alter table public.profiles
  add column if not exists default_task_priority text;
alter table public.profiles
  add column if not exists show_completed_tasks boolean not null default true;
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

-- Guarded check constraints (Postgres has no `add constraint if not exists`).
alter table public.profiles
  drop constraint if exists profiles_theme_check;
alter table public.profiles
  add constraint profiles_theme_check
  check (theme in ('light', 'dark', 'system'));

alter table public.profiles
  drop constraint if exists profiles_week_start_check;
alter table public.profiles
  add constraint profiles_week_start_check
  check (week_start in (0, 1));

alter table public.profiles
  drop constraint if exists profiles_default_task_priority_check;
alter table public.profiles
  add constraint profiles_default_task_priority_check
  check (default_task_priority is null or default_task_priority in ('low', 'medium', 'high'));

-- New accounts get the same defaults an existing row has.
alter table public.profiles
  alter column theme set default 'system';
alter table public.profiles
  alter column week_start set default 1;
alter table public.profiles
  alter column show_completed_tasks set default true;

comment on column public.profiles.theme is
  'light | dark | system. Drives the saved appearance preference.';
comment on column public.profiles.week_start is
  '0 = Sunday, 1 = Monday. Which day the Calendar week view starts on.';
comment on column public.profiles.show_completed_tasks is
  'When false, the Tasks list and the Calendar hide finished tasks.';
comment on column public.profiles.default_task_category is
  'Category pre-filled when creating a new task.';
comment on column public.profiles.default_task_priority is
  'Priority pre-filled when creating a new task. NULL = medium.';


-- ===========================================================================
-- 2. notes
-- ===========================================================================
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade
                default auth.uid(),
  title       text not null default '',
  content     text not null default '',
  -- Optional course / subject label, used by the Notes filter.
  category    text,
  -- Free-form labels, normalised to trimmed lowercase on insert by a trigger.
  tags        text[] not null default '{}',
  pinned      boolean not null default false,
  -- Optional link to one task. ON DELETE SET NULL: removing the task must not
  -- remove the note, which is the user's own writing.
  task_id     uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.notes is
  'Study / productivity notes. One row per note, owned by the user. RLS restricts every operation to the owner.';

-- The list view reads a user's notes newest-edited-first.
create index if not exists notes_user_updated_at_idx
  on public.notes (user_id, updated_at desc);

-- GIN lets `tags @> array['x']` use an index once a user has many notes.
create index if not exists notes_tags_idx
  on public.notes using gin (tags);

-- Ownership guarantee: a note can only point at a task owned by the same user
-- (same composite-key pattern as subtasks and task_daily_logs).
alter table public.notes
  drop constraint if exists notes_task_fk;
alter table public.notes
  add constraint notes_task_fk
  foreign key (task_id, user_id)
  references public.tasks (id, user_id)
  on delete set null;

-- Normalise tags and keep updated_at honest on every edit.
create or replace function public.set_note_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- user_id is already defaulted to auth.uid() and the composite FK pins it to
  -- the linked task's owner. The read below only matters when a row arrives
  -- with an explicit NULL user_id.
  if new.user_id is null then
    select t.user_id into new.user_id from public.tasks t where t.id = new.task_id;
  end if;

  if new.tags is null then
    new.tags := '{}';
  else
    -- Trim, drop blanks and de-duplicate, so "#Exam" and "exam " are one tag.
    select coalesce(array_agg(distinct lower(btrim(tag)) order by lower(btrim(tag))), '{}')
      into new.tags
      from unnest(new.tags) as tag
     where btrim(tag) <> '';
  end if;

  if new.category is not null and btrim(new.category) = '' then
    new.category := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_note_fields_before_write on public.notes;
create trigger set_note_fields_before_write
  before insert or update on public.notes
  for each row execute function public.set_note_fields();

alter table public.notes enable row level security;

drop policy if exists "Users can view own notes" on public.notes;
create policy "Users can view own notes"
  on public.notes for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notes" on public.notes;
create policy "Users can insert own notes"
  on public.notes for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own notes" on public.notes;
create policy "Users can update own notes"
  on public.notes for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notes" on public.notes;
create policy "Users can delete own notes"
  on public.notes for delete to authenticated
  using (auth.uid() = user_id);


-- ===========================================================================
-- 3. habits
-- ===========================================================================
create table if not exists public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade
                default auth.uid(),
  title       text not null,
  description text,
  -- daily  = every day
  -- weekly = specific weekdays (habit_days)
  -- custom = target_per_week completions in any week
  frequency   text not null default 'daily',
  habit_days  int[],
  target_per_week int,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.habits is
  'Recurring routines. Completion history lives in habit_logs (one row per habit per day). RLS restricts every operation to the owner.';

create index if not exists habits_user_created_at_idx
  on public.habits (user_id, created_at);

alter table public.habits
  drop constraint if exists habits_frequency_check;
alter table public.habits
  add constraint habits_frequency_check
  check (frequency in ('daily', 'weekly', 'custom'));

-- Weekdays outside 0-6 would break the schedule maths.
alter table public.habits
  drop constraint if exists habits_days_check;
alter table public.habits
  add constraint habits_days_check
  check (
    habit_days is null
    or (
      array_length(habit_days, 1) between 1 and 7
      and habit_days <@ array[0, 1, 2, 3, 4, 5, 6]
    )
  );

alter table public.habits
  drop constraint if exists habits_target_check;
alter table public.habits
  add constraint habits_target_check
  check (target_per_week is null or target_per_week between 1 and 7);

alter table public.habits enable row level security;

drop policy if exists "Users can view own habits" on public.habits;
create policy "Users can view own habits"
  on public.habits for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own habits" on public.habits;
create policy "Users can insert own habits"
  on public.habits for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own habits" on public.habits;
create policy "Users can update own habits"
  on public.habits for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own habits" on public.habits;
create policy "Users can delete own habits"
  on public.habits for delete to authenticated
  using (auth.uid() = user_id);


-- ===========================================================================
-- 4. habit_logs
-- ===========================================================================
-- One row per habit per day: did the user do it that day? Deliberately a
-- separate table from task_daily_logs - a habit is not a task, and mixing the
-- two would make "today's tasks" and streaks disagree.
--
-- Only positive check-ins are stored. A missed day is the ABSENCE of a row,
-- which is what keeps "unanswered" and "missed" distinguishable in the past.
create table if not exists public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade
                default auth.uid(),
  habit_id    uuid not null,
  log_date    date not null default current_date,
  done        boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.habit_logs is
  'One row per habit per day (a check-in). RLS restricts every operation to the owner.';

-- "One check-in per habit per day" is a database guarantee, so a double click
-- or two tabs cannot create a duplicate.
create unique index if not exists habit_logs_habit_id_log_date_key
  on public.habit_logs (habit_id, log_date);

create index if not exists habit_logs_user_id_log_date_idx
  on public.habit_logs (user_id, log_date);

-- Composite FK (id, user_id) => a log row can never reference another user's
-- habit, even if the API call is crafted.
alter table public.habits
  drop constraint if exists habits_id_user_id_key;
alter table public.habits
  add constraint habits_id_user_id_key unique (id, user_id);

alter table public.habit_logs
  drop constraint if exists habit_logs_habit_fk;
alter table public.habit_logs
  add constraint habit_logs_habit_fk
  foreign key (habit_id, user_id)
  references public.habits (id, user_id)
  on delete cascade;

-- Stamp user_id from the parent habit.
create or replace function public.set_habit_log_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    select h.user_id into new.user_id from public.habits h where h.id = new.habit_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_habit_log_user_id_before_write on public.habit_logs;
create trigger set_habit_log_user_id_before_write
  before insert or update on public.habit_logs
  for each row execute function public.set_habit_log_user_id();

alter table public.habit_logs enable row level security;

drop policy if exists "Users can view own habit logs" on public.habit_logs;
create policy "Users can view own habit logs"
  on public.habit_logs for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own habit logs" on public.habit_logs;
create policy "Users can insert own habit logs"
  on public.habit_logs for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own habit logs" on public.habit_logs;
create policy "Users can update own habit logs"
  on public.habit_logs for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own habit logs" on public.habit_logs;
create policy "Users can delete own habit logs"
  on public.habit_logs for delete to authenticated
  using (auth.uid() = user_id);


-- ===========================================================================
-- 5. challenges
-- ===========================================================================
create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade
                default auth.uid(),
  title       text not null,
  description text,
  start_date  date not null default current_date,
  target_date date,
  -- The measurable goal. Progress is never invented: it is either counted from
  -- real rows (task_completion / habit_completion) or from check-ins the user
  -- deliberately records (checkin_count / manual).
  goal_type   text not null default 'manual',
  goal_target int,
  created_at  timestamptz not null default now()
);

comment on table public.challenges is
  'Time-boxed goals. Progress is derived from real data (tasks, habits, check-ins), never fabricated. RLS restricts every operation to the owner.';

create index if not exists challenges_user_start_date_idx
  on public.challenges (user_id, start_date desc);

alter table public.challenges
  drop constraint if exists challenges_goal_type_check;
alter table public.challenges
  add constraint challenges_goal_type_check
  check (goal_type in ('manual', 'checkin_count', 'task_completion', 'habit_completion'));

alter table public.challenges
  drop constraint if exists challenges_goal_target_check;
alter table public.challenges
  add constraint challenges_goal_target_check
  check (goal_target is null or goal_target > 0);

-- A challenge cannot end before it starts.
alter table public.challenges
  drop constraint if exists challenges_dates_check;
alter table public.challenges
  add constraint challenges_dates_check
  check (target_date is null or target_date >= start_date);

alter table public.challenges enable row level security;

drop policy if exists "Users can view own challenges" on public.challenges;
create policy "Users can view own challenges"
  on public.challenges for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own challenges" on public.challenges;
create policy "Users can insert own challenges"
  on public.challenges for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own challenges" on public.challenges;
create policy "Users can update own challenges"
  on public.challenges for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own challenges" on public.challenges;
create policy "Users can delete own challenges"
  on public.challenges for delete to authenticated
  using (auth.uid() = user_id);


-- ===========================================================================
-- 6. challenge_checkins
-- ===========================================================================
-- The real records behind a checkin_count challenge: one row per day the user
-- worked on it. Progress is COUNT(*) over this table, so it cannot be faked by
-- a checkbox in the UI.
create table if not exists public.challenge_checkins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users (id) on delete cascade
                 default auth.uid(),
  challenge_id uuid not null,
  log_date     date not null default current_date,
  note         text,
  created_at   timestamptz not null default now()
);

comment on table public.challenge_checkins is
  'One row per challenge per day the user checked in. Drives real challenge progress.';

create unique index if not exists challenge_checkins_challenge_id_log_date_key
  on public.challenge_checkins (challenge_id, log_date);

create index if not exists challenge_checkins_user_id_log_date_idx
  on public.challenge_checkins (user_id, log_date);

alter table public.challenges
  drop constraint if exists challenges_id_user_id_key;
alter table public.challenges
  add constraint challenges_id_user_id_key unique (id, user_id);

alter table public.challenge_checkins
  drop constraint if exists challenge_checkins_challenge_fk;
alter table public.challenge_checkins
  add constraint challenge_checkins_challenge_fk
  foreign key (challenge_id, user_id)
  references public.challenges (id, user_id)
  on delete cascade;

create or replace function public.set_challenge_checkin_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    select c.user_id into new.user_id from public.challenges c where c.id = new.challenge_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_challenge_checkin_user_id_before_write on public.challenge_checkins;
create trigger set_challenge_checkin_user_id_before_write
  before insert or update on public.challenge_checkins
  for each row execute function public.set_challenge_checkin_user_id();

alter table public.challenge_checkins enable row level security;

drop policy if exists "Users can view own challenge checkins" on public.challenge_checkins;
create policy "Users can view own challenge checkins"
  on public.challenge_checkins for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own challenge checkins" on public.challenge_checkins;
create policy "Users can insert own challenge checkins"
  on public.challenge_checkins for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own challenge checkins" on public.challenge_checkins;
create policy "Users can update own challenge checkins"
  on public.challenge_checkins for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own challenge checkins" on public.challenge_checkins;
create policy "Users can delete own challenge checkins"
  on public.challenge_checkins for delete to authenticated
  using (auth.uid() = user_id);


-- ===========================================================================
-- 7. user_preferences
-- ===========================================================================
-- One row per user, created by a trigger on auth.users - the same pattern as
-- profiles. There is deliberately no INSERT or DELETE policy: rows are managed
-- by the database. Theme, week start and the default-category preference live
-- on `profiles` (they ride along with the profile the app already loads); this
-- table holds the remaining display preferences.
create table if not exists public.user_preferences (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  time_format      text not null default '24h',
  week_start       int not null default 1,
  default_category text,
  default_priority text,
  show_completed_tasks boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.user_preferences is
  'Per-user display preferences. Created automatically with each account.';

alter table public.user_preferences
  drop constraint if exists user_preferences_time_format_check;
alter table public.user_preferences
  add constraint user_preferences_time_format_check
  check (time_format in ('12h', '24h'));

alter table public.user_preferences
  drop constraint if exists user_preferences_week_start_check;
alter table public.user_preferences
  add constraint user_preferences_week_start_check
  check (week_start in (0, 1));

alter table public.user_preferences
  drop constraint if exists user_preferences_default_priority_check;
alter table public.user_preferences
  add constraint user_preferences_default_priority_check
  check (default_priority is null or default_priority in ('low', 'medium', 'high'));

create or replace function public.set_user_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.set_user_preferences_updated_at();

-- Create the row on signup (idempotent, so re-running is safe).
create or replace function public.handle_new_user_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_preferences on auth.users;
create trigger on_auth_user_created_preferences
  after insert on auth.users
  for each row execute function public.handle_new_user_preferences();

-- Backfill for accounts that existed before the trigger.
insert into public.user_preferences (user_id)
select u.id from auth.users u
left join public.user_preferences p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;

alter table public.user_preferences enable row level security;

drop policy if exists "Users can view own preferences" on public.user_preferences;
create policy "Users can view own preferences"
  on public.user_preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own preferences" on public.user_preferences;
create policy "Users can insert own preferences"
  on public.user_preferences for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own preferences" on public.user_preferences;
create policy "Users can update own preferences"
  on public.user_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ===========================================================================
-- 8. Ask PostgREST to pick up the new tables immediately
-- ===========================================================================
-- Without this the REST API can keep answering
-- "Could not find the table 'public.x' in the schema cache" for a short while.
notify pgrst, 'reload schema';


-- ===========================================================================
-- POST-MIGRATION CHECKLIST - verify in the Supabase dashboard
-- ===========================================================================
-- [ ] Tables: notes, habits, habit_logs, challenges, challenge_checkins,
--     user_preferences all listed under the `public` schema.
-- [ ] RLS: every one of them shows the green shield, with 4 policies each
--     (select, insert, update, delete) - except user_preferences, which has
--     3 (no delete: the row disappears with the auth user).
-- [ ] profiles now has: theme, week_start, default_task_category,
--     default_task_priority, show_completed_tasks, updated_at.
-- [ ] Indexes: habit_logs_habit_id_log_date_key and
--     challenge_checkins_challenge_id_log_date_key exist (duplicate guards).
-- [ ] Backfill: select count(*) from public.user_preferences; matches the
--     number of rows in auth.users.
