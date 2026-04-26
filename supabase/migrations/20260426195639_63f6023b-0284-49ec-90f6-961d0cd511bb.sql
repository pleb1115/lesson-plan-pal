-- user_stats: one row per user
CREATE TABLE public.user_stats (
  user_id UUID NOT NULL PRIMARY KEY,
  xp INTEGER NOT NULL DEFAULT 0,
  hearts INTEGER NOT NULL DEFAULT 5,
  hearts_refilled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stats_select_own" ON public.user_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "stats_insert_own" ON public.user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stats_update_own" ON public.user_stats FOR UPDATE USING (auth.uid() = user_id);

-- module_quizzes: cached AI-generated quizzes per module
CREATE TABLE public.module_quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_plan_id UUID NOT NULL,
  module_index INTEGER NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_plan_id, module_index)
);

ALTER TABLE public.module_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quizzes_select_own" ON public.module_quizzes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.lesson_plans lp WHERE lp.id = lesson_plan_id AND lp.user_id = auth.uid()));
CREATE POLICY "quizzes_insert_own" ON public.module_quizzes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.lesson_plans lp WHERE lp.id = lesson_plan_id AND lp.user_id = auth.uid()));
CREATE POLICY "quizzes_update_own" ON public.module_quizzes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.lesson_plans lp WHERE lp.id = lesson_plan_id AND lp.user_id = auth.uid()));
CREATE POLICY "quizzes_delete_own" ON public.module_quizzes FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.lesson_plans lp WHERE lp.id = lesson_plan_id AND lp.user_id = auth.uid()));

-- updated_at trigger for user_stats
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER user_stats_touch BEFORE UPDATE ON public.user_stats
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();