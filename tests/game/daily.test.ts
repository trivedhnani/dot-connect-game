import { test, expect } from 'vitest'
import { dailyIndex, todayKey } from '../../src/game/daily'

test('todayKey formats local date as YYYYMMDD', () => {
  expect(todayKey(new Date(2026, 6, 19))).toBe(20260719)  // month is 0-based: 6 = July
})

test('dailyIndex is deterministic and in range', () => {
  const i = dailyIndex(20260719, 30)
  expect(i).toBe(dailyIndex(20260719, 30))
  expect(i).toBeGreaterThanOrEqual(0)
  expect(i).toBeLessThan(30)
  // consecutive days should not all map to the same index
  const days = [20260719, 20260720, 20260721, 20260722]
  expect(new Set(days.map((d) => dailyIndex(d, 30))).size).toBeGreaterThan(1)
})
