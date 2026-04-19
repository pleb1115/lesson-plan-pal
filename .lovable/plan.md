
The user wants a Duolingo-style experience: minimal on-screen elements, one clear next action at a time, less text, more focus. Currently the dashboard shows 3 dense panels simultaneously (sidebar + full lesson plan with all modules + chat) — overwhelming.

## Plan: Duolingo-ify the experience

### 1. Landing page (`/`) — strip it down
- Remove the long subheadline paragraph.
- One headline, one button: **"Start learning"**.
- Keep the AI teacher illustration, make it the focal point.
- Drop the secondary "Ask the teacher" button (redundant — chat lives inside lessons).

### 2. Dashboard (`/dashboard`) — single-focus flow
Replace the 3-pane wall with a **step-by-step flow**, one screen at a time:

```text
Step 1: Pick subject        Step 2: Lesson path          Step 3: Module view
┌──────────────────┐        ┌──────────────────┐         ┌──────────────────┐
│  Your subjects   │        │   Linear Algebra │         │  Module 2 of 5   │
│                  │        │                  │         │                  │
│  [Math]    →     │   →    │  ✓ Module 1      │    →    │  Vectors         │
│  [History] →     │        │  ● Module 2      │         │  [short summary] │
│                  │        │  ○ Module 3      │         │                  │
│  + New subject   │        │  ○ Module 4      │         │  [Chat with      │
│                  │        │                  │         │   teacher] →     │
└──────────────────┘        └──────────────────┘         └──────────────────┘
```

- **Subjects screen**: Big tappable cards, one "+ New subject" CTA. No sidebar.
- **Lesson path screen**: Vertical module list (Duolingo-style nodes: ✓ done / ● current / ○ locked-looking). One module is highlighted as "next up" with a single **"Start"** button.
- **Module screen**: Title + 1-2 sentence summary + one primary button **"Chat with teacher about this"**. Exercises shown as a short collapsed list, not dumped on screen.

### 3. Chat — full-screen modal, not a side panel
- Tap "Chat with teacher" → opens a focused full-screen chat (header shows current module, back arrow returns to module).
- No competing UI. Just messages + input.
- Suggested starter prompts as 2-3 chips ("Explain this", "Give me an example", "Quiz me") so the next action is obvious.

### 4. New subject dialog — shorter
- Just 1 field: **"What do you want to learn?"** (e.g. "Linear algebra for beginners").
- Drop separate level/goals fields — let the AI infer or ask in chat.
- One button: **"Create lesson"**.

### 5. Navigation
- Back button (top-left arrow) on every screen — never trap the user.
- No persistent sidebar. Hierarchy: Subjects → Lesson → Module → Chat.

### Technical notes
- Add a local `view` state in `Dashboard.tsx`: `"subjects" | "lesson" | "module" | "chat"` driving which screen renders.
- Track `activeModuleIndex` for the module screen.
- Reuse existing `subjects`, `lesson_plans`, `messages` tables — no schema changes.
- Module completion: add a simple `completed_modules` integer array on `lesson_plans` (small migration) so the path screen can show ✓/●/○.
- Keep streaming chat logic, just render it in a full-screen layout.
- Animate transitions between screens with a subtle slide (Tailwind `transition-transform`).

### Out of scope
- Streaks, XP, hearts, leaderboards (can add later if you want the full Duolingo gamification).
