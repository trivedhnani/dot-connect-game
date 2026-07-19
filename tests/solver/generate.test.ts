import { test, expect } from 'vitest'
import { generateCandidate, mulberry32 } from '../../src/solver/generate'
import { assess } from '../../src/solver/difficulty'
import { validateLevel } from '../../src/solver/validate'
import { solve } from '../../src/solver/solver'

test('mulberry32 is deterministic', () => {
  const a = mulberry32(42), b = mulberry32(42)
  expect([a(), a(), a()]).toEqual([b(), b(), b()])
})

test('generateCandidate is reproducible from its seed and respects counts', () => {
  const p = { size: 5, grays: 4, yellows: 2, budget: 1, reds: 3, mids: 0, seed: 7 }
  const a = generateCandidate(p), b = generateCandidate(p)
  expect(a).toEqual(b)
  if (!a) return
  const flat = a.rows.join('')
  expect([...flat].filter((ch) => ch === 'g').length).toBe(4)
  expect([...flat].filter((ch) => ch === 'y').length).toBe(2)
  expect([...flat].filter((ch) => ch === 'r').length).toBe(3)
  expect([...flat].filter((ch) => ch === 'S').length).toBe(1)
  expect([...flat].filter((ch) => ch === 'E').length).toBe(1)
})

test('some seeds yield levels that pass validation (generator is productive)', () => {
  let found = 0
  for (let seed = 0; seed < 500 && found < 1; seed++) {
    const cand = generateCandidate({ size: 5, grays: 4, yellows: 2, budget: 1, reds: 3, mids: 0, seed })
    if (cand && validateLevel(cand).ok) found++
  }
  // Most random boards fail validation (usually a yellow-free route exists) — that is the
  // filter working. We only require that the generator finds SOME valid board in 500 seeds.
  expect(found).toBeGreaterThanOrEqual(1)
})

test('assess computes a positive difficulty from a solved benchmark', () => {
  const input = { size: 3, rows: ['Sy.', 'ry.', 'g.E'], yellowBudget: 1 }
  const res = solve(input)
  expect(res.kind).toBe('solved')
  if (res.kind !== 'solved') return
  const b = { grays: res.solution.grays, yellowsSpent: res.solution.yellowsSpent,
    pathLength: res.solution.path.length, path: res.solution.path }
  const a = assess(input, b, 1)
  expect(a.difficulty).toBeGreaterThan(0)
  expect(typeof a.interesting).toBe('boolean')
})
