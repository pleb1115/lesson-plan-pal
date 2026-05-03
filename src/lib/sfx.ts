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

function sweep(from: number, to: number, duration: number, type: OscillatorType = "sawtooth", gain = 0.12, when = 0) {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export const sfx = {
  correct() {
    tone(660, 0.12, "square", 0.12);
    tone(990, 0.18, "square", 0.12, 0.07);
  },
  wrong() {
    tone(160, 0.18, "sawtooth", 0.14);
    tone(110, 0.28, "sawtooth", 0.12, 0.08);
  },
  complete() {
    tone(440, 0.1, "square", 0.15);
    tone(660, 0.1, "square", 0.15, 0.08);
    tone(880, 0.1, "square", 0.15, 0.16);
    sweep(880, 1760, 0.4, "square", 0.12, 0.24);
  },
  tap() {
    tone(880, 0.04, "square", 0.06);
  },
  click() {
    tone(120, 0.04, "square", 0.08);
  },
  levelUp() {
    sweep(220, 880, 0.35, "sawtooth", 0.18);
    tone(880, 0.18, "square", 0.16, 0.32);
    tone(1320, 0.25, "square", 0.16, 0.5);
  },
  questClaim() {
    tone(880, 0.08, "square", 0.14);
    tone(1320, 0.12, "square", 0.14, 0.07);
  },
  boot() {
    sweep(60, 220, 1.0, "sawtooth", 0.06);
  },
};
