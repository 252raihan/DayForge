# DayForge

A daily routine management web app for university students.

Built with **Next.js (App Router)**, **Tailwind CSS**, and **Supabase**
(`@supabase/supabase-js` + `@supabase/ssr`).

One user per email account. Every database table has a `user_id` column with
row-level security, so a user can only read and write their own rows.

> Status: authentication, the app shell and the Tasks feature are implemented.
> The dashboard summarises your tasks. Calendar, notes, challenges and habits
> are still placeholders.

## Folder structure

```
DayForge/
├── app/
│   ├── (app)/               # Authenticated shell (sidebar + top bar)
│   │   ├── layout.tsx       # App shell layout
│   │   ├── dashboard/       # /dashboard  (task summary + stats)
│   │   ├── tasks/           # /tasks      (full task management)
│   │   │   └── page.tsx
│   │   ├── calendar/        # /calendar   (placeholder)
│   │   ├── notes/           # /notes      (placeholder)
│   │   ├── challenges/      # /challenges (placeholder)
│   │   ├── habits/          # /habits     (placeholder)
│   │   └── settings/         # /settings  (profile form)
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
│   └── useTasks.ts          # All task data access + tab/date logic
├── lib/
│   ├── nav.ts               # Navigation items (single source of truth)
│   └── supabase/
│       ├── client.ts        # Browser Supabase client (Client Components)
│       ├── server.ts        # Server Supabase client (Server Components, Actions, Route Handlers)
│       └── middleware.ts    # Session refresh + redirect rules
├── types/                   # Shared TypeScript types
├── supabase/
│   └── schema.sql           # Complete database schema (single source of truth)
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
| `/dashboard`, `/tasks`, … | signed in | The app itself |

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
