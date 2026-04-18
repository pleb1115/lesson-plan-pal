
The user clicked "Start a lesson" and "Ask the teacher" — both are non-functional placeholders. Time to wire them up to the real classroom dashboard with Cloud auth, lesson generation, and chat (the roadmap we set earlier).

## Plan: Wire up the buttons → full classroom dashboard

### 1. Enable Lovable Cloud
- Turn on Cloud for auth + database + AI gateway (no external keys needed).

### 2. Auth
- Add `/auth` page (email + password, with signup/login tabs, autoconfirm enabled).
- Add a lightweight `useAuth` hook wrapping Supabase session.
- Protect `/dashboard` — redirect to `/auth` if signed out.

### 3. Database (cloud-synced lessons + chat)
- `subjects` (id, user_id, name, icon, created_at)
- `lesson_plans` (id, user_id, subject_id, title, level, goals, modules jsonb, created_at)
- `messages` (id, user_id, lesson_plan_id, role, content, created_at)
- RLS: users only see their own rows.

### 4. Routes & wire up the hero buttons
- `/` (current landing) — "Start a lesson" → `/dashboard`, "Ask the teacher" → `/dashboard?focus=chat`. If signed out, both bounce through `/auth` first.
- `/auth` — login / signup.
- `/dashboard` — the Studio Loft classroom dashboard.

### 5. Classroom dashboard (`/dashboard`)
```text
┌────────────┬──────────────────────────┬─────────────┐
│ Subjects   │   Active lesson plan      │  Chat       │
│ + New      │   • Objectives            │  with       │
│ Math       │   • Modules (expandable)  │  AI teacher │
│ History    │   • Progress              │  [input]    │
└────────────┴──────────────────────────┴─────────────┘
```
- Left sidebar: list of user's subjects + "New subject" dialog (name + level + goals → generates a lesson plan).
- Center: selected lesson plan with objectives, modules, and "mark complete" toggles.
- Right: streaming chat scoped to the active lesson, persisted to `messages`.

### 6. AI lesson generation + tutoring (edge functions)
- `generate-lesson-plan`: takes `{ subject, level, goals }`, calls Lovable AI (`google/gemini-2.5-flash`) with structured output, returns `{ title, objectives[], modules[{title, summary, exercises[]}] }`, inserts into `lesson_plans`.
- `tutor-chat`: takes `{ lesson_plan_id, message }`, loads plan + recent messages, streams tutor reply, persists both sides. Handles 429 (rate limit) and 402 (credits) with friendly toasts.

### 7. Polish
- Loading skeletons on dashboard panels.
- Empty states ("Create your first subject to begin").
- Toast on auth errors / AI errors.
- Keep current landing page intact — just make the buttons go somewhere real.

### Technical notes
- Stack: existing React + Vite + Tailwind + shadcn, plus Lovable Cloud client auto-wired.
- Streaming chat via `fetch` + `ReadableStream` reading SSE from the edge function.
- Modules stored as `jsonb` so we can evolve shape without migrations.
- No role/admin system needed yet — single-user-owned rows with `auth.uid() = user_id` RLS.

### Out of scope (can follow up)
- Quizzes/grading, voice mode, multi-student classrooms, sharing lesson plans.
