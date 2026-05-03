import { useEffect, useState } from "react";

const KEY = "oracle_booted";

const LINES = [
  "> INITIALIZING ORACLE NEURAL CORE...",
  "> LINKING TO LATVERIAN MAINFRAME... OK",
  "> LOADING KNOWLEDGE DOMAINS... OK",
  "> IDENTITY VERIFIED.",
  "> WELCOME, OPERATOR.",
];

export const BootSequence = ({ onDone }: { onDone?: () => void }) => {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(KEY) !== "1";
  });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!show) return;
    if (step >= LINES.length) {
      const t = setTimeout(() => {
        sessionStorage.setItem(KEY, "1");
        setShow(false);
        onDone?.();
      }, 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 380);
    return () => clearTimeout(t);
  }, [step, show, onDone]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      <div className="grid-bg absolute inset-0 opacity-50" aria-hidden />
      <div className="relative max-w-xl px-8 font-mono text-sm leading-relaxed text-primary text-glow">
        {LINES.slice(0, step).map((l, i) => (
          <p key={i} className="animate-in fade-in slide-in-from-left-2">{l}</p>
        ))}
        {step < LINES.length && (
          <p>
            {LINES[step]}<span className="ml-1 inline-block h-4 w-2 bg-primary align-middle animate-caret" />
          </p>
        )}
      </div>
    </div>
  );
};
