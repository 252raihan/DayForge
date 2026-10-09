-- ===========================================================================
-- DayForge - complete database schema
-- ===========================================================================
-- Everything this project needs so far, in dependency order:
--   1. profiles  (+ signup trigger, + RLS)
--   2. tasks     (+ RLS)
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
-- POST-SETUP CHECKLIST - verify these in the Supabase dashboard
-- ===========================================================================
-- [ ] TABLES EXIST
--     Table Editor should list `profiles`, `tasks` and `subtasks` under the
--     `public` schema.
--
-- [ ] RLS IS ENABLED ON EACH TABLE
--     Table Editor -> select table -> "RLS enabled" badge should be ON.
--     Or Authentication -> Policies: every table must show a green shield.
--     Check `profiles`  has 2 policies (select, update).
--     Check `tasks`     has 4 policies (select, insert, update, delete).
--     Check `subtasks`  has 4 policies (select, insert, update, delete).
--
-- [ ] RECURRING TASK COLUMNS
--     `tasks` should have `recurrence_type` (default 'none') and
--     `recurrence_days`. Both check constraints should be present:
--     tasks_recurrence_type_check and tasks_recurrence_days_check.
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
