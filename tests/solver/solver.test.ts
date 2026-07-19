import { test, expect } from 'vitest'
import { solve } from '../../src/solver/solver'

test('finds the max-coverage path', () => {
  const res = solve({ size: 3, rows: ['Sg.', 'gg.', '..E'], yellowBudget: 1 })
  expect(res.kind).toBe('solved')
  if (res.kind !== 'solved') return
  expect(res.solution.grays).toBe(3)      // S→(0,1)g→(1,1)g→(1,0)g→(2,0)→(2,1)→(2,2)E
  expect(res.solution.yellowsSpent).toBe(0)
})

test('routes through a yellow door when forced, respecting budget', () => {
  const input = { size: 3, rows: ['Sy.', 'ry.', '..E'], yellowBudget: 1 }
  const res = solve(input)
  expect(res.kind).toBe('solved')
  if (res.kind !== 'solved') return
  expect(res.solution.yellowsSpent).toBe(1)
  expect(solve({ ...input, yellowBudget: 0 }).kind).toBe('unsolvable')
})

test('respects allowedYellows restriction', () => {
  const input = { size: 3, rows: ['Sy.', 'ry.', '..E'], yellowBudget: 1 }
  expect(solve(input, { allowedYellows: [{ r: 1, c: 1 }] }).kind).toBe('unsolvable') // (1,1) unreachable without (0,1)
  expect(solve(input, { allowedYellows: [{ r: 0, c: 1 }] }).kind).toBe('solved')
})

test('preActivated doors are free', () => {
  const input = { size: 3, rows: ['Sy.', 'ry.', '..E'], yellowBudget: 0 }
  const res = solve(input, { preActivated: [{ r: 0, c: 1 }] })
  expect(res.kind).toBe('solved')
  if (res.kind !== 'solved') return
  expect(res.solution.yellowsSpent).toBe(0)
})

test('mids are mandatory', () => {
  const res = solve({ size: 3, rows: ['S.M', '...', '..E'], yellowBudget: 1 })
  expect(res.kind).toBe('solved')
  if (res.kind !== 'solved') return
  expect(res.solution.path).toContainEqual({ r: 0, c: 2 })
})

test('walled-off exit is unsolvable', () => {
  expect(solve({ size: 2, rows: ['Sr', 'rE'], yellowBudget: 1 }).kind).toBe('unsolvable')
})

test('shortest objective minimizes length', () => {
  const res = solve({ size: 3, rows: ['Sg.', 'gg.', '..E'], yellowBudget: 1 }, { objective: 'shortest' })
  expect(res.kind).toBe('solved')
  if (res.kind !== 'solved') return
  expect(res.solution.path.length).toBe(5)  // S→(1,0)→(2,0)→(2,1)→(2,2) or symmetric
})
