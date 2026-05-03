import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { sfx } from "@/lib/sfx";

const TIERS = [
  { min: 0,  name: "INITIATE" },
  { min: 5,  name: "ADEPT" },
  { min: 10, name: "ARCHON" },
  { min: 20, name: "OVERLORD" },
];

export function tierForLevel(level: number) {
  let t = TIERS[0];
  for (const tier of TIERS) if (level >= tier.min) t = tier;
  return t.name;
}

export const LevelUpModal = ({
  level, onClose,
}: { level: number | null; onClose: () => void }) => {
  useEffect(() => {
    if (level !== null) sfx.levelUp();
  }, [level]);

  if (level === null) return null;

  const tier = tierForLevel(level);

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-background/90 px-6 animate-in fade-in">
      <div className="grid-bg absolute inset-0 opacity-40" aria-hidden />
      <div className="relative panel glow-primary animate-level-burst max-w-md p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary text-glow">
          // TIER ASCENSION //
        </p>
        <h2 className="mt-4 font-mono text-5xl font-bold text-primary text-glow">
          LVL {level}
        </h2>
        <p className="mt-2 font-mono text-lg uppercase tracking-widest text-foreground">
          {tier}
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Your processing capacity has expanded. New protocols unlocked.
        </p>
        <Button
          size="lg"
          className="mt-8 h-12 w-full font-mono uppercase tracking-wider"
          onClick={onClose}
        >
          Acknowledge
        </Button>
      </div>
    </div>
  );
};
