# DayForge

A daily routine management web app for university students.

Built with **Next.js (App Router)**, **Tailwind CSS**, and **Supabase**
(`@supabase/supabase-js` + `@supabase/ssr`).

One user per email account. Every database table has a `user_id` column with
row-level security, so a user can only read and write their own rows.

> Status: authentication, the app shell, Tasks, daily completion tracking, the
> Calendar, Notes, Challenges, Habits and Settings are all implemented and
> backed by real Supabase reads and writes. The Help page explains how every
> calculation works.

## Features

| Page | What it does |
| --- | --- |
| **Dashboard** | Today's tasks with Yes/No buttons, the daily-completion chart, this-week vs last-week comparison, and the headline counts. |
| **Tasks** | Create, edit, delete, search, filter, sort, subtasks, recurrence, and a per-task daily history. |
| **Calendar** | Month and week views over the same task rows, with filters, prev/next/Today navigation, a day panel to edit, complete or add a task on that date. |
| **Notes** | Autosaving note editor with search, sort, tags, pinning and an optional link to a task. |
| **Challenges** | Time-boxed goals whose progress is **measured** from real records, never estimated. |
| **Habits** | Daily / specific-days / times-per-week habits with date-specific check-ins and streaks computed from them. |
| **Settings** | Profile, theme (applied immediately and saved), week start, time format, and new-task defaults. |
| **Help** | How each number on the dashboard is calculated, including what is deliberately *not* counted. |

### The three separate ideas about a task

These are stored in different places on purpose, and keeping them apart is what
makes the numbers honest:

| Idea | Where it lives | What it means |
| --- | --- | --- |
| The task's overall state | `tasks.status` | Is it finished right now? |
| How it went on a given day | `task_daily_logs` | One row per task per day: `completed` true (Yes) or false (No). |
| A habit's day | `habit_logs` | One **positive** row per habit per day. A missed day is the absence of a row, so "not answered" and "missed" stay distinguishable. |

Nothing is derived from a checkbox: a streak walks backwards through stored
rows, and a percentage counts stored rows.

## Daily task completion tracking

For every task you can record, once per day, whether you completed it:

- **Yes** — you did it that day.
- **No** — you did not.

The dashboard opens with a **Today's Tasks** section. It lists every task due
today, each with its green/red history chart, its running completion percentage,
and the two buttons that submit today's answer. There are deliberately **no
per-task alerts or notifications** — the daily reminder is simply the top of the
dashboard.

Completion history lives in `task_daily_logs` (one row per task per day,
`completed` boolean), and drives:

- a **per-task chart** on each task card (green = Yes, red = No,
  grey = not answered) with a `completedDays / trackedDays` percentage;
- the **overall daily-completion chart** on the dashboard;
- the headline tiles and the Today's Tasks summary line.

Submitting is an upsert keyed on `(task_id, log_date)`, so changing your answer
during the day updates the same row instead of creating a duplicate. `log_date`
is a plain calendar date in your own timezone, so "did I do it on the 14th?"
means the same day wherever you read it.

## Folder structure

```
DayForge/
├── app/
│   ├── (app)/               # Authenticated shell (sidebar + top bar)
│   │   ├── layout.tsx       # App shell layout
│   │   ├── dashboard/       # /dashboard  (today's panel, charts, tiles)
│   │   ├── tasks/           # /tasks      (full task management)
│   │   ├── calendar/        # /calendar   (month + week views)
│   │   ├── notes/           # /notes      (list + autosaving editor)
│   │   ├── challenges/      # /challenges (measured goals)
│   │   ├── habits/          # /habits     (check-ins + streaks)
│   │   ├── help/            # /help       (how the numbers work)
│   │   └── settings/         # /settings  (profile + preferences)
│   ├── globals.css          # Tailwind entry + light/dark color tokens
│   ├── layout.tsx           # Root layout (also applies the saved theme)
│   └── page.tsx             # / redirects to /dashboard
├── components/
│   ├── dashboard/           # Dashboard task summary and rows
│   ├── tasks/               # Task list, tabs, cards, modals
│   ├── ui/                  # Shared primitives (Card, Field, EmptyState, ...)
│   ├── Sidebar.tsx          # Desktop rail + mobile bottom navigation
│   ├── Topbar.tsx           # User name and controls
│   ├── ThemeToggle.tsx      # Dark/light switch (persisted)
│   ├── LogoutButton.tsx     # Placeholder logout
│   ├── PageHeader.tsx       # Shared page heading
│   ├── theme-script.ts      # Pre-paint theme script (no flash)
│   ├── icons.tsx            # Inline SVG icon set
│   └── index.ts             # Barrel re-exports for the components above
├── hooks/
│   ├── useTasks.ts          # Task data access + tab/date/recurrence logic
│   ├── useNotes.ts          # Note data access + search/sort/tag filters
│   ├── useChallenges.ts     # Challenge data access + check-ins
│   └── useHabits.ts         # Habit data access + check-ins
├── lib/
│   ├── nav.ts               # Navigation items (single source of truth)
│   ├── home-scope.ts        # What "home" vs "course" means, in one place
│   ├── calendar-utils.ts    # Grid building + date maths (pure)
│   ├── habit-utils.ts       # Streaks and schedules (pure)
│   ├── challenge-utils.ts   # Challenge measurement (pure)
│   ├── note-utils.ts        # Note draft handling + tag parsing (pure)
│   ├── preferences.ts       # Browser preference reads
│   ├── preferences-shared.ts # Preference defaults, safe on server and client
│   └── supabase/
│       ├── client.ts        # Browser Supabase client (Client Components)
│       ├── server.ts        # Server Supabase client (Server Components, Actions, Route Handlers)
│       └── middleware.ts    # Session refresh + redirect rules
├── tests/                   # Pure-logic tests (node --test)
├── scripts/                 # Diagnostics (e.g. npm run check:db)
├── types/                   # Shared TypeScript types
├── supabase/
│   ├── schema.sql           # Complete database schema (single source of truth)
│   ├── fix-task-daily-logs.sql
│   └── migrations/          # Incremental migrations
├── .env.local.example       # Template for required environment variables
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Layout

The app shell lives in `app/(app)/layout.tsx`: a sidebar on desktop, a sticky top
bar, and a bottom navigation bar on mobile. Navigation items are defined once in
`lib/nav.ts`.

Dark mode uses Tailwind's `class` strategy. `ThemeToggle` writes the choice to
`localStorage`, and a small inline script in `app/layout.tsx` applies it before
the first paint so there is no light flash.

## Tasks

All task data access lives in `hooks/useTasks.ts`, so the pages and components
stay free of Supabase calls. It owns the list, the loading/error state, the tab
filtering and every mutation (create, update, toggle, delete). Updates are
applied optimistically and rolled back if the server rejects them.

- `/tasks` is the full management view: create, edit, delete and tick off.
- `/dashboard` reuses the same hook for a summary - four headline numbers plus
the first few rows - so both views agree on what "today", "overdue" and
"upcoming" mean.

Because the whole list is fetched anyway and RLS scopes it to one user, tab
filtering happens client-side. That keeps tab switches instant. For a very large
list you would push the filtering into the query and paginate instead.

Due dates are stored as UTC instants (`timestamptz`) and rendered in the
browser's local timezone, so the same row reads correctly anywhere. The conversion
helpers live in `useTasks.ts` (`localInputToUtc` / `utcToLocalInput`).

Shared presentation lives in `components/ui/` and is re-exported from both
`@/components` and `@/components/ui`, so a page can pull several primitives from
one import:

```tsx
import { PageHeader } from "@/components";
import { Card, EmptyState, ErrorBanner } from "@/components/ui";
```

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your environment file from the template and fill in the values:

   ```bash
   cp .env.local.example .env.local
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

## Environment variables

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → your project → **Project Settings** → **API** → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → your project → **Project Settings** → **API** → **Project API keys** → the **anon / public** key |

Both are safe to expose to the browser (the anon key is protected by row-level
security). Never expose the `service_role` key on the client.

## Supabase clients

- **Browser** (`lib/supabase/client.ts`) — use in `"use client"` components.
- **Server** (`lib/supabase/server.ts`) — use in Server Components, Server
  Actions, and Route Handlers. It reads and writes the session through cookies.
- **Middleware** (`lib/supabase/middleware.ts`) — refreshes the session and
  enforces the redirect rules on every request.

## Authentication

### Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/login` | public | Email + password, and Google |
| `/signup` | public | Create an account |
| `/forgot-password` | public | Request a reset link |
| `/reset-password` | recovery session | Set a new password |
| `/auth/callback` | public | Exchanges the OAuth / email-link code for a session |
| `/dashboard`, `/tasks`, `/calendar`, `/notes`, `/challenges`, `/habits`, `/settings` | signed in | The app itself |

Every table carries a `user_id` column, has RLS enabled, and is reachable only
through four owner-scoped policies, so a signed-in user can only ever read and
write their own rows.

`middleware.ts` bounces signed-out users to `/login?next=<path>`, and sends
signed-in users who visit `/login` or `/signup` to `/dashboard`.

### 1. Environment variables

Copy `.env.local.example` to `.env.local` and fill in both values:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Project Settings → API → Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Project Settings → API → Project API keys → `anon` `public`** |

Both are safe in the browser: the anon key is only as powerful as your RLS
policies allow. Never put the `service_role` key in a `NEXT_PUBLIC_` variable —
it bypasses RLS entirely.

### 2. Create the database schema

Open **SQL Editor → New query** in the Supabase dashboard, paste the whole of
`supabase/schema.sql`, and run it. It creates the `profiles` and `tasks` tables,
the signup trigger, and every row-level security policy.

`schema.sql` is the single source of truth for the database. To add a table,
append it at the bottom of the file. Every statement is guarded (for example
`create table if not exists` and `drop policy if exists` before `create policy`),
so running the file again is always safe — it will not error or duplicate
data, it simply converges the database on the file.

### Keeping the database in sync: `npm run check:db`

DayForge is a thin layer over Supabase, so a page whose table is missing does
not crash — it shows the PostgREST message
`Could not find the table 'public.x' in the schema cache`. Rather than guess
which tables exist, run:

```bash
npm run check:db
```

It calls the REST API once per table with the public anon key and prints the
HTTP status for each. A `200` means the table is live; `404 PGRST205` means it
has not been created yet. It never prints keys and never reads user rows (with
no session, RLS returns none).

Expected state after running every migration:

```
profiles               HTTP 200
tasks                  HTTP 200
subtasks               HTTP 200
task_daily_logs        HTTP 200
notes                  HTTP 200
habits                 HTTP 200
habit_logs             HTTP 200
challenges             HTTP 200
challenge_checkins     HTTP 200
user_preferences       HTTP 200
```

### Incremental migrations

`supabase/schema.sql` is the destination; `supabase/migrations/` holds the SQL
that gets you there. A migration only ever creates tables, columns, indexes,
constraints and policies — it does not drop tables, rewrite rows or change
existing data. Each one is idempotent, so running it twice is safe.

| File | Adds |
| --- | --- |
| `2026-10-15-notes-habits-challenges-preferences.sql` | `notes`, `habits`, `habit_logs`, `challenges`, `challenge_checkins`, `user_preferences`, the preference columns on `profiles`, plus RLS and indexes for each |

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Pure-logic tests (Node's built-in runner, no test framework installed) |
| `npm run check:db` | Print the REST status of every table |

`npm test` runs the calculation rules directly: the daily-percentage
calculation, the recurrence walk, month/week grid building, habit streaks from
dated rows, and challenge measurement. Those modules are deliberately pure (no
Supabase import), which is why they can be tested without a database.

## Preferences

Preferences are stored per **account**, not per browser, so they follow the user
to another device. Two tables carry them:

- `profiles` — `theme`, `week_start`, `default_task_category`,
  `default_task_priority`, `show_completed_tasks`.
- `user_preferences` — the same display values plus `time_format`, as the
  canonical preference row.

The theme is also mirrored into `localStorage` under the same key the pre-paint
script in `app/layout.tsx` reads. That is what keeps the chosen theme from
flashing to light on the next page load; the database copy is what restores it
on a different device.

### 3. Dashboard settings you must change

Go to **Authentication → URL Configuration**:

- **Site URL** — set to your app's base URL.
  - Local development: `http://localhost:3000`
  - Production: `https://your-domain.com`
- **Redirect URLs** — add every URL Supabase may send a user back to. Supabase
  rejects any redirect that is not on this list.
  - `http://localhost:3000/auth/callback` (local)
  - `https://your-domain.com/auth/callback` (production)
  - Also add your Vercel preview pattern if you use one, e.g.
    `https://*-your-team.vercel.app/auth/callback`

Also worth checking:

- **Authentication → Providers → Email** — enable **Confirm email** for a real
  signup flow (or disable it to let users log in immediately).
- **Authentication → Providers → Email** — the minimum password length here
  should match the 8 characters the forms enforce.
- **Authentication → Email Templates** — the reset-password template's link must
  point at `{{ .SiteURL }}/auth/callback?next=/reset-password`.

### 4. Enabling Google sign-in

**Part A — Google Cloud Console**

1. Go to <https://console.cloud.google.com> and create (or pick) a project.
2. **APIs & Services → OAuth consent screen**. Choose **External**, fill in the
   app name and support email, and save. While in testing, add your own Google
   account under **Test users** or you will be blocked from signing in.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
4. Application type: **Web application**. Name it e.g. `DayForge`.
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3000`
   - `https://your-domain.com`
6. Under **Authorized redirect URIs**, add the **Supabase** callback — not your
   own app's. Find your project ref in the dashboard URL, or under
   **Project Settings → API**:
   - `https://<project-ref>.supabase.co/auth/v1/callback`
7. Click **Create**, then copy the **Client ID** and **Client secret**.

**Part B — Supabase dashboard**

1. **Authentication → Providers → Google** → toggle it **on**.
2. Paste the **Client ID** and **Client secret** from step 7 above.
3. Click **Save**.
4. Make sure `http://localhost:3000/auth/callback` is in your **Redirect URLs**
   (step 3) — that is where Supabase sends the user afterwards.

If Google returns `redirect_uri_mismatch`, the URI in step 6 is wrong or has a
trailing slash that does not match exactly.

### 5. The profiles table and RLS

Every user gets a `profiles` row via the `on_auth_user_created` trigger, which
runs on `auth.users` insert and copies `raw_user_meta_data.name` (the name typed
on the signup form) into `profiles.name`.

RLS is enabled with two policies, both scoped to `auth.uid() = id`:

- **select** — read your own profile.
- **update** — update your own profile, with a `WITH CHECK` so you cannot
  rewrite `id` into someone else's row.

There is deliberately no **insert** policy (the trigger owns row creation) and
no **delete** policy (the row cascades away with the auth user).
"# DayForge" 
