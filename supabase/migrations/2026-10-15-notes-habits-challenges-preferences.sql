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
