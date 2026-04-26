// Tiny WebAudio sound effects — no assets needed.
// Respects a "muted" flag in localStorage.

const KEY = "sfx_muted";

let ctx: AudioContext | null = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function isMuted() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

export function setMuted(m: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, m ? "1" : "0");
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.15, when = 0) {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export const sfx = {
  correct() {
    tone(660, 0.12, "triangle", 0.18);
    tone(880, 0.18, "triangle", 0.18, 0.08);
  },
  wrong() {
    tone(200, 0.18, "sawtooth", 0.12);
    tone(140, 0.25, "sawtooth", 0.1, 0.08);
  },
  complete() {
    tone(523, 0.12, "triangle", 0.2);
    tone(659, 0.12, "triangle", 0.2, 0.1);
    tone(784, 0.18, "triangle", 0.2, 0.2);
    tone(1047, 0.3, "triangle", 0.22, 0.32);
  },
  tap() {
    tone(440, 0.05, "sine", 0.08);
  },
};
