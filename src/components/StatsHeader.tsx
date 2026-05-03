import { Heart, Flame, Volume2, VolumeX, Zap } from "lucide-react";
import { type UserStats, levelFromXp, MAX_HEARTS } from "@/hooks/useStats";
import { useEffect, useState } from "react";
import { isMuted, setMuted } from "@/lib/sfx";
import { tierForLevel } from "@/components/LevelUpModal";

export const StatsHeader = ({ stats }: { stats: UserStats | null }) => {
  const [muted, setMutedState] = useState(false);

  useEffect(() => { setMutedState(isMuted()); }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  if (!stats) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-7 w-20 animate-pulse rounded-sm bg-muted" />
        <div className="h-7 w-12 animate-pulse rounded-sm bg-muted" />
      </div>
    );
  }

  const { level, progress } = levelFromXp(stats.xp);
  const tier = tierForLevel(level);
  const today = new Date().toISOString().slice(0, 10);
  const streakAtRisk = stats.streak > 0 && stats.last_active_date !== today;

  return (
    <div className="flex items-center gap-1.5">
      <div className={`hud-chip ${streakAtRisk ? "border-accent text-accent text-glow-accent animate-pulse-accent" : "text-foreground"}`}>
        <Flame className={`h-3.5 w-3.5 ${streakAtRisk ? "" : "text-orange-400"}`} />
        <span>{stats.streak}d</span>
      </div>
      <div className="hud-chip text-foreground">
        <Heart className={`h-3.5 w-3.5 text-red-500 ${stats.hearts > 0 ? "fill-red-500" : ""}`} />
        <span>{stats.hearts}/{MAX_HEARTS}</span>
      </div>
      <div className="hud-chip border-primary/40 text-primary text-glow">
        <Zap className="h-3.5 w-3.5 fill-primary" />
        <span className="font-bold">L{level}</span>
        <span className="hidden sm:inline opacity-70">· {tier}</span>
        <div className="ml-1 h-1.5 w-10 overflow-hidden rounded-full bg-primary/15">
          <div className="h-full bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
      <button
        onClick={toggleMute}
        className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
};
