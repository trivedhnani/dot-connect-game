import { test, expect } from 'vitest'
import { createRound, tryMove } from '../../src/engine/round'
import { gradeRound, starsFor } from '../../src/engine/grading'
import type { Level } from '../../src/engine/types'

function lvlWithBenchmark(rows: string[], budget: number, b: { grays: number; yellowsSpent: number; pathLength: number }): Level {
  return { id: 't', size: rows.length, rows, yellowBudget: budget, lives: 3,
    benchmark: { ...b, path: [] }, difficulty: 0 }
}

// Board: S g y / . r g / . . E   optimal: S→g→y→g(1,2)→E  grays=2, yellows=1, length=5
const ROWS = ['Sgy', '.rg', '..E']

test('perfect run grades 100 with 3 stars', () => {
  const s = createRound(lvlWithBenchmark(ROWS, 2, { grays: 2, yellowsSpent: 1, pathLength: 5 }))
  tryMove(s, { r: 0, c: 1 }); tryMove(s, { r: 0, c: 2 })
  tryMove(s, { r: 1, c: 2 }); tryMove(s, { r: 2, c: 2 })
  const grade = gradeRound(s)
  expect(grade.percent).toBe(100)
  expect(grade.stars).toBe(3)
  expect(grade.graysCovered).toBe(2)
  expect(grade.hint).toBe('perfect line!')
})

test('missing grays and taking longer reduces the grade with a hint', () => {
  const s = createRound(lvlWithBenchmark(ROWS, 2, { grays: 2, yellowsSpent: 1, pathLength: 5 }))
  // Lazy bottom route skipping both grays and the yellow: S→(1,0)→(2,0)→(2,1)→(2,2)E.
  // Expected: grays 0/2 → 0 of 75; y=0 → yellow term 0 (guarded); length 5/5 → 10. Total 10.
  // (The engine doesn't force yellows — that's the validator's job on shipped levels.)
  tryMove(s, { r: 1, c: 0 }); tryMove(s, { r: 2, c: 0 })
  tryMove(s, { r: 2, c: 1 }); tryMove(s, { r: 2, c: 2 })
  const grade = gradeRound(s)
  expect(grade.percent).toBe(10)
  expect(grade.percent).toBeLessThan(60)
  expect(grade.stars).toBe(0)
  expect(grade.hint).toContain('+2 grays possible')
})

test('red hits subtract 8 points each', () => {
  const s = createRound(lvlWithBenchmark(ROWS, 2, { grays: 2, yellowsSpent: 1, pathLength: 5 }))
  tryMove(s, { r: 0, c: 1 }); tryMove(s, { r: 1, c: 1 })      // red hit, rewound to start
  tryMove(s, { r: 0, c: 1 }); tryMove(s, { r: 0, c: 2 })
  tryMove(s, { r: 1, c: 2 }); tryMove(s, { r: 2, c: 2 })
  const grade = gradeRound(s)
  expect(grade.percent).toBe(92)  // 100 − 8
  expect(grade.hint).toContain('avoid red hits')
})

test('starsFor thresholds', () => {
  expect(starsFor(59)).toBe(0); expect(starsFor(60)).toBe(1)
  expect(starsFor(80)).toBe(2); expect(starsFor(95)).toBe(3)
})

test('grading a non-won round throws', () => {
  const s = createRound(lvlWithBenchmark(ROWS, 2, { grays: 2, yellowsSpent: 1, pathLength: 5 }))
  expect(() => gradeRound(s)).toThrow()
})
