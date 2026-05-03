
-- Daily quests table
CREATE TABLE public.daily_quests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  quest_date date NOT NULL DEFAULT (now()::date),
  quest_type text NOT NULL,
  label text NOT NULL,
  target integer NOT NULL DEFAULT 1,
  progress integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  xp_reward integer NOT NULL DEFAULT 25,
  claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dq_select_own" ON public.daily_quests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dq_insert_own" ON public.daily_quests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dq_update_own" ON public.daily_quests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dq_delete_own" ON public.daily_quests FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_daily_quests_user_date ON public.daily_quests(user_id, quest_date);

-- award_xp RPC: bumps xp, updates streak, returns new totals
CREATE OR REPLACE FUNCTION public.award_xp(_amount integer)
RETURNS TABLE(xp integer, streak integer, last_active_date date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  today date := now()::date;
  yest date := today - 1;
  cur record;
  new_streak integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT us.xp, us.streak, us.last_active_date INTO cur
  FROM public.user_stats us WHERE us.user_id = uid;

  IF NOT FOUND THEN
    INSERT INTO public.user_stats (user_id, xp, streak, last_active_date)
    VALUES (uid, 0, 0, NULL)
    RETURNING user_stats.xp, user_stats.streak, user_stats.last_active_date INTO cur;
  END IF;

  IF cur.last_active_date = today THEN
    new_streak := cur.streak;
  ELSIF cur.last_active_date = yest THEN
    new_streak := cur.streak + 1;
  ELSE
    new_streak := 1;
  END IF;

  UPDATE public.user_stats
     SET xp = cur.xp + GREATEST(_amount, 0),
         streak = new_streak,
         last_active_date = today
   WHERE user_id = uid
   RETURNING user_stats.xp, user_stats.streak, user_stats.last_active_date
   INTO xp, streak, last_active_date;

  RETURN NEXT;
END;
$$;
