import { test, expect, beforeEach } from 'vitest'
import { loadProgress, recordResult, spendRevealToken, __resetForTests } from '../../src/game/storage'

beforeEach(() => __resetForTests())

test('defaults: no stars, 3 reveal tokens', () => {
  const p = loadProgress()
  expect(p.revealTokens).toBe(3)
  expect(p.stars).toEqual({})
})

test('recordResult keeps best and grants a token on first 3-star only', () => {
  let p = recordResult('c01', 82, 2)
  expect(p.stars.c01).toBe(2)
  expect(p.revealTokens).toBe(3)
  p = recordResult('c01', 97, 3)
  expect(p.stars.c01).toBe(3)
  expect(p.best.c01).toBe(97)
  expect(p.revealTokens).toBe(4)     // first 3-star bonus
  p = recordResult('c01', 100, 3)
  expect(p.revealTokens).toBe(4)     // not granted twice
  expect(p.best.c01).toBe(100)
  p = recordResult('c01', 61, 1)
  expect(p.stars.c01).toBe(3)        // never regresses
  expect(p.best.c01).toBe(100)
})

test('spendRevealToken decrements and refuses at zero', () => {
  expect(spendRevealToken()).toBe(true)
  expect(spendRevealToken()).toBe(true)
  expect(spendRevealToken()).toBe(true)
  expect(spendRevealToken()).toBe(false)
  expect(loadProgress().revealTokens).toBe(0)
})
