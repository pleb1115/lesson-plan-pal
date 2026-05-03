## Goal
Transform the app into a dark, ominous "Doom's supercomputer" experience and add core addiction mechanics (XP, levels, daily quests, streak emphasis).

## Phase 1 — Visual Overhaul (Doom Supercomputer Theme)

**Design tokens (`src/index.css`)**
- Replace light warm-green palette with dark theme as the default (no toggle):
  - `--background: 220 15% 4%` (near-black)
  - `--card: 220 15% 7%` with hairline borders `220 10% 18%`
  - `--primary: 145 100% 50%` (toxic green `#00FF9C`)
  - `--accent: 0 90% 55%` (crimson, used sparingly for warnings/streak risk)
  - `--foreground: 145 30% 92%`, `--muted-foreground: 145 10% 55%`
- Add CSS layer for: scanline overlay, CRT vignette, animated grid background, glow utility (`.glow-primary` → `box-shadow: 0 0 20px hsl(var(--primary)/0.5)`)
- Sharper radius: `--radius: 0.25rem`

**Typography**
- Add JetBrains Mono via Google Fonts in `index.html`
- Tailwind `fontFamily.mono` for headings, badges, numbers; keep Inter for body prose
- Uppercase tracking-wider for section titles

**Tailwind (`tailwind.config.ts`)**
- New keyframes: `flicker`, `scan`, `pulse-glow`, `type` (caret blink), `boot-text`
- Utility class `.terminal-text` (mono + green glow)

**Shared components**
- New `src/components/CRTOverlay.tsx` — fixed scanlines + vignette layered over app
- New `src/components/BootSequence.tsx` — one-time per session typing intro: "INITIALIZING NEURAL LINK… IDENTITY VERIFIED… WELCOME, [USER]"
- New `src/components/GridBackground.tsx` — animated grid for landing/dashboard
- Update `Button` variants: add `command` (mono uppercase + glow border)

**Copy rewrites**
- Index: "Start learning" → "INITIATE PROTOCOL"; tagline → "ACQUIRE ALL KNOWLEDGE. ONE PROTOCOL AT A TIME."
- Dashboard heading → "COMMAND CENTER"; "Subjects" → "KNOWLEDGE DOMAINS"; "New subject" → "ACQUIRE DOMAIN"
- Quiz: "Check" → "EXECUTE"; "Continue" → "PROCEED"; module complete → "DOMAIN ASSIMILATED"
- Tutor name → "ORACLE"; chat empty state → "ORACLE STANDS READY."

**Sound (`src/lib/sfx.ts`)**
- Add: `click` (mechanical), `boot` (low rising drone), `levelUp` (synth zap), `streakTick`
- Wire to buttons + lesson completions

## Phase 2 — Addiction Mechanics

**Database (new migration)**
- Add columns to `profiles`: `xp int default 0`, `level int default 1`, `tier text default 'INITIATE'`, `streak_days int default 0`, `last_active_date date`, `streak_freezes int default 0`
- New table `daily_quests`: `id, user_id, date, quest_type, target, progress, completed, xp_reward` (RLS: user owns rows)
- New table `xp_events`: `id, user_id, amount, source, created_at` (audit + animation feed)
- DB function `award_xp(_user_id, _amount, _source)` → inserts event, updates profile xp/level (level = floor(sqrt(xp/50))+1), returns new totals
- DB function `tick_streak(_user_id)` → updates streak based on last_active_date, returns new streak
- Trigger or RPC called from quiz finish to update quest progress

**Hooks**
- Extend `useStats` to expose `xp, level, tier, streak, freezes, dailyQuests`
- New `useXP` hook with `awardXP(amount, source)` calling RPC and triggering level-up animation event

**UI components**
- `StatsHeader` redesign: terminal-style HUD strip showing `LVL 7 • 1,240 XP ███▓▓▓ • 🔥 14 DAY STREAK • ❤ 5`
- `LevelUpModal` — full-screen flash + glow burst + "TIER ASCENDED: ADEPT → ARCHON" with sound
- `DailyQuestsPanel` on dashboard — 3 quests with animated progress bars; complete to claim XP burst
- `StreakWidget` — flame icon, days count, "AT RISK" pulsing crimson if today not logged
- `XPBurst` toast — floating "+25 XP" particles after quiz answers

**Quest generation**
- On dashboard mount, ensure today's 3 quests exist; insert defaults if missing (e.g., "Complete 2 trials", "Maintain 80% accuracy", "Acquire 100 XP")

**Quiz integration**
- Award XP per correct answer (+10), bonus for module complete (+50), combo multiplier (consecutive correct → x1.25, x1.5, x2)
- Combo HUD in `QuizScreen` with intensifying glow + screen shake at high combos

## Phase 3 — Polish
- Boot sequence on first load per session (localStorage flag)
- Replace lesson complete confetti with green particle burst + "DOMAIN ASSIMILATED" banner
- AI tutor responses type character-by-character

## Technical Notes
- All theme changes via design tokens — no hardcoded colors in components
- Existing `dark` class block in index.css becomes the default `:root`
- Migration uses `has_role` pattern only if admin features added (none here)
- Level formula `floor(sqrt(xp/50))+1` gives smooth early progression, slower late game
- Tier thresholds: INITIATE (1-4), ADEPT (5-9), ARCHON (10-19), OVERLORD (20+)

## Out of Scope (can do later)
- Leaderboards / leagues
- Skill tree visualization per subject
- Knowledge decay meter
- Push notifications
