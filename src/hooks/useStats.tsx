import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserStats = {
  xp: number;
  hearts: number;
  hearts_refilled_at: string;
  streak: number;
  last_active_date: string | null;
};

export const MAX_HEARTS = 5;
const HEART_REFILL_MIN = 30;

function refillHearts(stats: UserStats): UserStats {
  if (stats.hearts >= MAX_HEARTS) return stats;
  const last = new Date(stats.hearts_refilled_at).getTime();
  const now = Date.now();
  const minutes = Math.floor((now - last) / 60000);
  const refill = Math.floor(minutes / HEART_REFILL_MIN);
  if (refill <= 0) return stats;
  const newHearts = Math.min(MAX_HEARTS, stats.hearts + refill);
  const usedMinutes = refill * HEART_REFILL_MIN;
  return {
    ...stats,
    hearts: newHearts,
    hearts_refilled_at: new Date(last + usedMinutes * 60000).toISOString(),
  };
}

export function levelFromXp(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 50));
  const xpForCurrent = level * level * 50;
  const xpForNext = (level + 1) * (level + 1) * 50;
  const progress = (xp - xpForCurrent) / (xpForNext - xpForCurrent);
  return { level, xpForCurrent, xpForNext, progress };
}

export function useStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let { data } = await supabase
      .from("user_stats")
      .select("xp, hearts, hearts_refilled_at, streak, last_active_date")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) {
      const init = {
        user_id: user.id,
        xp: 0,
        hearts: MAX_HEARTS,
        hearts_refilled_at: new Date().toISOString(),
        streak: 0,
        last_active_date: null,
      };
      const { data: created } = await supabase
        .from("user_stats")
        .insert(init)
        .select("xp, hearts, hearts_refilled_at, streak, last_active_date")
        .single();
      data = created;
    }
    if (data) {
      const refilled = refillHearts(data as UserStats);
      if (refilled.hearts !== data.hearts) {
        await supabase
          .from("user_stats")
          .update({ hearts: refilled.hearts, hearts_refilled_at: refilled.hearts_refilled_at })
          .eq("user_id", user.id);
      }
      setStats(refilled);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const loseHeart = useCallback(async () => {
    if (!user || !stats) return stats;
    const newHearts = Math.max(0, stats.hearts - 1);
    const newRefilledAt = stats.hearts === MAX_HEARTS ? new Date().toISOString() : stats.hearts_refilled_at;
    const next = { ...stats, hearts: newHearts, hearts_refilled_at: newRefilledAt };
    setStats(next);
    await supabase.from("user_stats").update({
      hearts: newHearts,
      hearts_refilled_at: newRefilledAt,
    }).eq("user_id", user.id);
    return next;
  }, [user, stats]);

  const awardXp = useCallback(async (amount: number) => {
    if (!user || !stats) return stats;
    const today = new Date().toISOString().slice(0, 10);
    let newStreak = stats.streak;
    if (stats.last_active_date !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      newStreak = stats.last_active_date === yesterday ? stats.streak + 1 : 1;
    }
    const next = { ...stats, xp: stats.xp + amount, streak: newStreak, last_active_date: today };
    setStats(next);
    await supabase.from("user_stats").update({
      xp: next.xp,
      streak: next.streak,
      last_active_date: next.last_active_date,
    }).eq("user_id", user.id);
    return next;
  }, [user, stats]);

  return { stats, loading, reload: load, loseHeart, awardXp };
}
