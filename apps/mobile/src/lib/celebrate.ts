import { useSyncExternalStore } from 'react';
import { haptic } from './haptics';
import { celebrationsAllowed } from './prefs';

/**
 * Celebrations for real events only (achievement earned, streak milestone,
 * first meal logged). Never for calorie limits or restriction. Confetti is
 * skipped when the person turned it off or the system asks to reduce motion.
 */
export interface ConfettiPiece {
  x: number;
  vx: number;
  vy: number;
  spin: number;
  size: number;
  color: number;
  round: boolean;
}
export interface ConfettiBurst {
  id: number;
  pieces: ConfettiPiece[];
}

let burst: ConfettiBurst | null = null;
let seq = 0;
const listeners = new Set<() => void>();

/** Small deterministic PRNG so bursts never depend on render. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;

export function celebrate(): void {
  haptic('celebration');
  if (!celebrationsAllowed()) return;
  seq += 1;
  const r = rng(seq * 9973 + 17);
  const pieces: ConfettiPiece[] = Array.from({ length: 34 }, () => ({
    x: (r() - 0.5) * 80,
    vx: (r() - 0.5) * 700,
    vy: -520 - r() * 460,
    spin: (r() - 0.5) * 1080,
    size: 6 + r() * 6,
    color: Math.floor(r() * 5),
    round: r() > 0.6,
  }));
  burst = { id: seq, pieces };
  listeners.forEach((l) => l());
}

export function clearConfetti(id: number): void {
  if (burst?.id !== id) return;
  burst = null;
  listeners.forEach((l) => l());
}

export function useConfetti(): ConfettiBurst | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => burst,
    () => burst,
  );
}
