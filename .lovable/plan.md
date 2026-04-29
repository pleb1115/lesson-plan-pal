# Fix Short-Answer Quiz Grading

## What's broken

Short-answer questions in the quiz almost always come back as wrong (or fail with a "Grading failed" toast), even when the answer is reasonable.

Two root causes in `supabase/functions/grade-answer/index.ts`:

1. **Fragile AI parsing.** The function tells the AI to reply via a forced "grade" tool call and then reads `choices[0].message.tool_calls[0].function.arguments`. When the model (currently `google/gemini-2.5-flash-lite`) returns a plain text reply instead of a tool call — which happens often with the lite model — `tc` is undefined and the function returns `{ correct: false, feedback: "Could not grade." }`. The student is marked wrong no matter what they typed.
2. **No JSON cleanup.** Even when the model does emit JSON (in tool args or content), it sometimes wraps it in ```` ```json ```` fences or trails commas. `JSON.parse` throws and the catch-all returns `correct: false`.

The local "accepted_answers" shortcut also only matches via `===` / `includes` on the full normalized string, so a multi-word answer like "the study of fundamental questions" never matches a key concept like "fundamental".

## The fix

Rewrite `supabase/functions/grade-answer/index.ts` so grading is robust and lenient:

1. **Better local pre-check** before calling the AI:
   - Normalize (lowercase, strip punctuation, collapse whitespace).
   - Token-overlap match against `accepted_answers` and `key_concepts`: if the student's answer contains 2+ key tokens (or any full accepted phrase), mark correct immediately. This handles the easy cases without an AI round-trip.

2. **Stronger AI call**:
   - Switch to `google/gemini-2.5-flash` (more reliable structured output than `-lite` for this task; same gateway, no key needed).
   - Keep the forced tool call, but ALSO accept a JSON object in `message.content` as a fallback.
   - Add `extractJsonFromResponse()` — strips ```` ``` ```` fences, finds the first `{`/last `}`, retries parse after removing trailing commas and control characters.
   - Add `detectTruncation()` — if braces don't balance, treat as truncation.

3. **Lenient failure mode**: if the AI call returns 429/402, times out, or produces unparseable output AND the local check found at least one key-concept token, return `correct: true` with an encouraging message. If no signal at all, return `correct: false` with a clear "Couldn't grade — try rephrasing" message instead of silently marking wrong.

4. **Better logging**: `console.log` the raw AI response on parse failure so future issues are debuggable from edge function logs.

5. **Frontend tweak** (`src/components/QuizScreen.tsx`): on grading toast errors, don't bail — keep the user in `answering` phase so they can retry. Also show the `feedback` string from the server when present.

## Files changed

- `supabase/functions/grade-answer/index.ts` — rewritten with the parsing, model swap, token-overlap pre-check, and lenient fallback.
- `src/components/QuizScreen.tsx` — small UX tweak so grading errors don't dead-end the quiz.

## How to verify

1. Open any module's quiz, reach a short-answer question, type a reasonable answer → should be marked correct with encouraging feedback.
2. Type gibberish → should be marked wrong with the explanation.
3. Type a partial-but-valid answer (one key concept) → should still be accepted (lenient).
4. Check `grade-answer` edge function logs — should now show successful invocations with the parsed verdict.
