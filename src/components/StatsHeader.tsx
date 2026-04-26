import { Heart, Flame, Star, Volume2, VolumeX } from "lucide-react";
import { type UserStats, levelFromXp, MAX_HEARTS } from "@/hooks/useStats";
import { useEffect, useState } from "react";
import { isMuted, setMuted } from "@/lib/sfx";

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
      <div className="flex items-center gap-3">
        <div className="h-7 w-16 animate-pulse rounded-full bg-muted" />
        <div className="h-7 w-12 animate-pulse rounded-full bg-muted" />
        <div className="h-7 w-12 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  const { level, progress } = levelFromXp(stats.xp);

  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      <div className="flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1 text-orange-500">
        <Flame className="h-4 w-4 fill-orange-500" />
        <span>{stats.streak}</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-red-500">
        <Heart className={`h-4 w-4 ${stats.hearts > 0 ? "fill-red-500" : ""}`} />
        <span>{stats.hearts}/{MAX_HEARTS}</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-primary">
        <Star className="h-4 w-4 fill-primary" />
        <span>Lv {level}</span>
        <div className="ml-1 h-1.5 w-10 overflow-hidden rounded-full bg-primary/20">
          <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
      <button
        onClick={toggleMute}
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </div>
  );
};
