import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Target, Check, Sparkles } from "lucide-react";
import { sfx } from "@/lib/sfx";
import { emitXP } from "@/components/XPBurst";

type Quest = {
  id: string;
  quest_type: string;
  label: string;
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  xp_reward: number;
};

const DEFAULTS: Omit<Quest, "id" | "progress" | "completed" | "claimed">[] = [
  { quest_type: "modules", label: "Complete 2 trials",        target: 2,   xp_reward: 50 },
  { quest_type: "xp",      label: "Acquire 100 XP",           target: 100, xp_reward: 30 },
  { quest_type: "correct", label: "Answer 10 prompts correct", target: 10,  xp_reward: 25 },
];

const today = () => new Date().toISOString().slice(0, 10);

export const DailyQuestsPanel = ({ refreshKey, onClaimed }: { refreshKey: number; onClaimed: (xp: number) => void }) => {
  const { user } = useAuth();
  const [quests, setQuests] = useState<Quest[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("daily_quests")
      .select("id, quest_type, label, target, progress, completed, claimed, xp_reward")
      .eq("user_id", user.id)
      .eq("quest_date", today());

    let list = (data || []) as Quest[];
    if (list.length === 0) {
      const rows = DEFAULTS.map((d) => ({ ...d, user_id: user.id, quest_date: today() }));
      const { data: ins } = await supabase.from("daily_quests").insert(rows).select();
      list = (ins || []) as Quest[];
    }
    setQuests(list);
  }, [user]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const claim = async (q: Quest) => {
    if (!user || !q.completed || q.claimed) return;
    sfx.questClaim();
    await supabase.from("daily_quests").update({ claimed: true }).eq("id", q.id);
    setQuests((qs) => qs.map((x) => x.id === q.id ? { ...x, claimed: true } : x));
    emitXP(q.xp_reward);
    onClaimed(q.xp_reward);
  };

  if (quests.length === 0) return null;

  return (
    <section className="panel mb-4 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-primary text-glow">Daily Directives</h3>
      </div>
      <div className="space-y-2">
        {quests.map((q) => {
          const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
          return (
            <div key={q.id} className="rounded-sm border border-border bg-background/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{q.label}</p>
                {q.claimed ? (
                  <span className="font-mono text-xs uppercase text-muted-foreground">claimed</span>
                ) : q.completed ? (
                  <button
                    onClick={() => claim(q)}
                    className="flex items-center gap-1 rounded-sm border border-primary bg-primary/10 px-2.5 py-1 font-mono text-xs uppercase text-primary text-glow animate-pulse-glow"
                  >
                    <Sparkles className="h-3 w-3" /> +{q.xp_reward} XP
                  </button>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">{q.progress}/{q.target}</span>
                )}
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all ${q.completed ? "bg-primary" : "bg-primary/70"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// Helper to bump quest progress
export async function bumpQuests(userId: string, deltas: { type: string; amount: number }[]) {
  const { data } = await supabase
    .from("daily_quests")
    .select("id, quest_type, target, progress, completed")
    .eq("user_id", userId)
    .eq("quest_date", today());
  if (!data) return;
  for (const q of data as any[]) {
    const d = deltas.find((x) => x.type === q.quest_type);
    if (!d || q.completed) continue;
    const np = Math.min(q.target, q.progress + d.amount);
    await supabase.from("daily_quests")
      .update({ progress: np, completed: np >= q.target })
      .eq("id", q.id);
  }
}
