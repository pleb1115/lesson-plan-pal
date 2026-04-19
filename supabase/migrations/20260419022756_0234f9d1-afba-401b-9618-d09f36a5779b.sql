ALTER TABLE public.lesson_plans
ADD COLUMN IF NOT EXISTS completed_modules integer[] NOT NULL DEFAULT '{}';