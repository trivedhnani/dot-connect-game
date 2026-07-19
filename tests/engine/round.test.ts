import { test, expect } from 'vitest'
import { createRound, tryMove } from '../../src/engine/round'
import type { Level } from '../../src/engine/types'

export function lvl(rows: string[], yellowBudget = 1, lives = 3): Level {
  return {
    id: 't', size: rows.length, rows, yellowBudget, lives,
    benchmark: { grays: 0, yellowsSpent: 1, pathLength: 0, path: [] }, difficulty: 0,
  }
}

test('createRound starts path at the start cell with level lives', () => {
  const s = createRound(lvl(['S..', '...', '..E']))
  expect(s.path).toEqual([{ r: 0, c: 0 }])
  expect(s.lives).toBe(3)
  expect(s.status).toBe('playing')
})

test('moves to an adjacent free cell; rejects non-adjacent and visited', () => {
  const s = createRound(lvl(['S..', '...', '..E']))
  expect(tryMove(s, { r: 0, c: 1 })).toEqual({ kind: 'moved' })
  expect(tryMove(s, { r: 2, c: 0 })).toEqual({ kind: 'rejected', reason: 'not-adjacent' })
  expect(tryMove(s, { r: 1, c: 1 })).toEqual({ kind: 'moved' })
  expect(tryMove(s, { r: 1, c: 0 })).toEqual({ kind: 'moved' })
  expect(tryMove(s, { r: 0, c: 0 })).toEqual({ kind: 'rejected', reason: 'visited' })
})

test('stepping back onto the previous cell retracts the tip', () => {
  const s = createRound(lvl(['S..', '...', '..E']))
  tryMove(s, { r: 0, c: 1 })
  tryMove(s, { r: 0, c: 2 })
  expect(tryMove(s, { r: 0, c: 1 })).toEqual({ kind: 'retracted' })
  expect(s.path).toEqual([{ r: 0, c: 0 }, { r: 0, c: 1 }])
})

test('reaching the exit wins when there are no mids; further moves rejected', () => {
  const s = createRound(lvl(['SE', '..']))
  expect(tryMove(s, { r: 0, c: 1 })).toEqual({ kind: 'won' })
  expect(s.status).toBe('won')
  expect(tryMove(s, { r: 1, c: 1 })).toEqual({ kind: 'rejected', reason: 'not-playing' })
})

test('exit is locked until all mids are on the path', () => {
  const s = createRound(lvl(['S.M', '...', '..E']))
  tryMove(s, { r: 0, c: 1 })
  tryMove(s, { r: 1, c: 1 })
  tryMove(s, { r: 1, c: 2 })
  expect(tryMove(s, { r: 2, c: 2 })).toEqual({ kind: 'rejected', reason: 'mids-remaining' })
  expect(s.path.length).toBe(4) // exit step rolled back
  tryMove(s, { r: 1, c: 1 }) // retract
  tryMove(s, { r: 0, c: 1 }) // retract
  tryMove(s, { r: 0, c: 2 }) // mid
  tryMove(s, { r: 1, c: 2 })
  expect(tryMove(s, { r: 2, c: 2 })).toEqual({ kind: 'won' })
})
