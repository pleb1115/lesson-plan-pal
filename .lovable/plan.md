## Goal

Turn each module into an interactive Duolingo-style lesson. Module completion is gated by passing an AI-generated quiz. Layer on XP, levels, daily streaks, hearts, sound effects, and snappy animations.

## What you'll experience

1. **Open a module** → read the short summary → tap **Start lesson**.
2. **Quiz screen** (one question at a time, full-screen, focused):
   - 5 questions per module, mix of multiple choice and short answer.
   - Big tap targets, instant feedback (green ✓ ding, red ✗ buzz).
   - Wrong answer = lose a heart. Run out of hearts = "come back later" screen.
   - Bottom progress bar fills as you advance.
3. **Module complete** → confetti + ding, XP awarded, streak updated, level bar animates.
4. **Subjects screen** shows persistent header chip: ❤️ hearts · 🔥 streak · ⭐ XP / level.

## New backend pieces

**1. New table `user_stats`** (one row per user):
- `xp` int, `hearts` int (default 5, max 5), `hearts_refilled_at` timestamp, `streak` int, `last_active_date` date.
- RLS: own rows only.

**2. New table `module_quizzes`** (cache generated quizzes so we don't re-generate every time):
- `lesson_plan_id` uuid, `module_index` int, `questions` jsonb. Unique on (plan, index).
- RLS: user owns the parent lesson_plan.

**3. New edge function `generate-quiz`**:
- Input: `lesson_plan_id`, `module_index`.
- Uses Lovable AI (gemini-3-flash-preview) with **tool calling** to return structured JSON: 5 questions, mix of `multiple_choice` (4 options, 1 correct) and `short_answer` (accepted answers + key concepts).
- Caches result in `module_quizzes`.

**4. New edge function `grade-answer`** (for short-answer only):
- Input: question, user answer, expected concepts.
- AI returns `{ correct: bool, feedback: string }`. Multiple-choice is graded client-side (instant).

**5. Heart refill logic**: 1 heart every 30 min, computed on read in `user_stats`. Done in a small RPC or client-side calc.

## New frontend pieces

- **`StatsHeader`** component (hearts / streak / XP-level chip) shown on subjects + lesson screens.
- **`QuizScreen`** view: full-screen, single question card, options as big buttons, footer "Check" → "Continue" pattern (Duolingo-style two-state button).
- **Animations**: shake on wrong, scale-pop on correct, slide between questions, confetti on module complete (use lightweight inline canvas, no library).
- **Sound**: short base64-encoded WAV for ding/buzz/complete (no asset hosting needed).
- **Level math**: `level = floor(sqrt(xp / 50))`, progress bar to next level.

## Flow changes

- "Mark complete" button removed from module view.
- Module is auto-completed only when quiz is passed (≥4/5 correct).
- Failing the quiz lets you retry (no heart refund, but no XP penalty beyond hearts).
- Streak increments first time you pass any module on a given day.

## Technical notes

- Quizzes are generated on-demand the first time you open a module, then cached.
- All AI calls go through edge functions (never direct from client).
- `user_stats` row is auto-created on first read via upsert.
- Sounds use `new Audio(dataUrl).play()` with a mute toggle stored in localStorage.
- Confetti = small self-contained canvas component, no npm dep.

## Out of scope

- Leaderboards, friends, gem shop, league system.
- Spaced-repetition review of past modules (could be a follow-up).
- Voice input for short answers.
