import { useEffect, useState } from "react";

type Burst = { id: number; amount: number };

let listener: ((amount: number) => void) | null = null;
export function emitXP(amount: number) {
  listener?.(amount);
}

export const XPBurst = () => {
  const [bursts, setBursts] = useState<Burst[]>([]);
  useEffect(() => {
    listener = (amount: number) => {
      const id = Date.now() + Math.random();
      setBursts((b) => [...b, { id, amount }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1500);
    };
    return () => { listener = null; };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[9995] -translate-x-1/2">
      {bursts.map((b) => (
        <div
          key={b.id}
          className="animate-xp-rise font-mono text-2xl font-bold text-primary text-glow"
        >
          +{b.amount} XP
        </div>
      ))}
    </div>
  );
};
