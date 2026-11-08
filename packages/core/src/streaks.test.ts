import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_IDS, ACHIEVEMENT_RULES, calendarWeeks, computeStreak, weekDays } from './streaks';

describe('computeStreak', () => {
  it('is empty without activity', () => {
    expect(computeStreak([], '2026-11-08')).toEqual({ current: 0, longest: 0, lastActiveDate: null, activeToday: false, atRisk: false });
  });

  it('counts consecutive active days and knows today already counts', () => {
    const s = computeStreak(['2026-11-06', '2026-11-07', '2026-11-08'], '2026-11-08');
    expect(s).toMatchObject({ current: 3, longest: 3, activeToday: true, atRisk: false });
  });

  it('forgives one missed day but counts active days only', () => {
    const s = computeStreak(['2026-11-03', '2026-11-04', '2026-11-06', '2026-11-07'], '2026-11-07');
    expect(s.current).toBe(4);
  });

  it('ends the streak after two missed days in a row', () => {
    const s = computeStreak(['2026-11-01', '2026-11-02', '2026-11-05'], '2026-11-05');
    expect(s.current).toBe(1);
    expect(s.longest).toBe(2);
  });

  it('keeps a streak alive (at risk) when only yesterday or the day before was active', () => {
    expect(computeStreak(['2026-11-06', '2026-11-07'], '2026-11-08')).toMatchObject({ current: 2, atRisk: true, activeToday: false });
    expect(computeStreak(['2026-11-05', '2026-11-06'], '2026-11-08')).toMatchObject({ current: 2, atRisk: true });
    expect(computeStreak(['2026-11-04', '2026-11-05'], '2026-11-08')).toMatchObject({ current: 0, longest: 2, atRisk: false });
  });

  it('ignores duplicates and order (time-zone changes can repeat or reorder dates)', () => {
    const s = computeStreak(['2026-11-08', '2026-11-07', '2026-11-08', '2026-11-06'], '2026-11-08');
    expect(s.current).toBe(3);
  });

  it('treats a local date ahead of the reference day as today', () => {
    expect(computeStreak(['2026-11-09'], '2026-11-08')).toMatchObject({ current: 1, activeToday: true });
  });

  it('handles month and DST boundaries', () => {
    const s = computeStreak(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-31', '2026-11-01'], '2026-11-01');
    expect(s.current).toBe(2);
    expect(s.longest).toBe(3);
  });
});

describe('week helpers', () => {
  it('returns the Monday-first week', () => {
    expect(weekDays('2026-11-08')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    expect(weekDays('2026-11-09')[0]).toBe('2026-11-09');
  });

  it('builds calendar weeks ending with the current week', () => {
    const weeks = calendarWeeks('2026-11-08', 3);
    expect(weeks).toHaveLength(3);
    expect(weeks[2]![6]).toBe('2026-11-08');
    expect(weeks[0]![0]).toBe('2026-10-19');
  });
});

describe('achievement rules', () => {
  it('define a rule for every achievement', () => {
    for (const id of ACHIEVEMENT_IDS) expect(ACHIEVEMENT_RULES[id].target).toBeGreaterThan(0);
  });
});
