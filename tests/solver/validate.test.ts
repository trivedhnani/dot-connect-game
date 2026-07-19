import { test, expect } from 'vitest'
import { validateLevel, reachableActivationSets } from '../../src/solver/validate'

test('accepts a sound level and returns its benchmark', () => {
  const rep = validateLevel({ size: 3, rows: ['Sy.', 'ry.', 'g.E'], yellowBudget: 1 })
  expect(rep.ok).toBe(true)
  expect(rep.benchmark).toBeDefined()
  expect(rep.benchmark!.yellowsSpent).toBe(1)
})

test('rejects a level with a yellow-free route', () => {
  const rep = validateLevel({ size: 3, rows: ['S..', '.y.', '..E'], yellowBudget: 1 })
  expect(rep.ok).toBe(false)
  expect(rep.reasons).toContain('yellow-free-route-exists')
})

test('rejects an unsolvable level', () => {
  const rep = validateLevel({ size: 3, rows: ['Sry', 'rry', 'yyE'], yellowBudget: 1 })
  expect(rep.ok).toBe(false)
  expect(rep.reasons.some((r) => r.startsWith('unsolvable'))).toBe(true)
})

test('reachableActivationSets only includes geometrically reachable orders', () => {
  // (1,1) yellow can only be opened after (0,1): sets are [], [(0,1)] for budget 1
  const sets = reachableActivationSets({ size: 3, rows: ['Sy.', 'ry.', '..E'], yellowBudget: 1 })
  expect(sets).toContainEqual([])
  expect(sets).toContainEqual([{ r: 0, c: 1 }])
  expect(sets).not.toContainEqual([{ r: 1, c: 1 }])
})

test('rejects a trap: opening the decoy first makes the level unwinnable', () => {
  // Budget 1. Two doors openable first: (0,1) leads to the exit via the right column;
  // (1,0) leads into a dead pocket ((2,0), walled by reds). A player who spends the
  // budget on (1,0) flips (0,1) to red -> unwinnable. Validator must reject.
  const rep = validateLevel({ size: 3, rows: ['Sy.', 'yr.', '.rE'], yellowBudget: 1 })
  expect(rep.ok).toBe(false)
  expect(rep.reasons.some((r) => r.startsWith('trap'))).toBe(true)
})
