import { test, expect } from 'vitest'
import { createRound, tryMove, effectiveKind } from '../../src/engine/round'
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

test('entering a yellow spends budget and activates it (door semantics)', () => {
  const s = createRound(lvl(['Sy.', '...', 'y.E'], 2))
  const res = tryMove(s, { r: 0, c: 1 })
  expect(res).toEqual({ kind: 'activated', flipped: false })
  expect(s.yellowsUsed).toBe(1)
  expect(s.activatedYellows).toEqual([{ r: 0, c: 1 }])
})

test('spending the last budget point flips remaining yellows to red', () => {
  const s = createRound(lvl(['Sy.', '...', 'y.E'], 1))
  const res = tryMove(s, { r: 0, c: 1 })
  expect(res).toEqual({ kind: 'activated', flipped: true })
  expect(s.flipped).toBe(true)
  expect(effectiveKind(s, { r: 2, c: 0 })).toBe('red')     // unspent yellow is now red
  expect(effectiveKind(s, { r: 0, c: 1 })).toBe('empty')   // opened door stays safe
})

test('activation is permanent across retraction; re-entry is free', () => {
  const s = createRound(lvl(['Sy.', '...', 'y.E'], 2))
  tryMove(s, { r: 0, c: 1 })            // activate
  tryMove(s, { r: 0, c: 0 })            // retract off it
  expect(s.yellowsUsed).toBe(1)          // budget NOT refunded
  expect(tryMove(s, { r: 0, c: 1 })).toEqual({ kind: 'moved' }) // re-enter open door: free
  expect(s.yellowsUsed).toBe(1)
})

test('touching red costs a life and rewinds to start when no checkpoint', () => {
  const s = createRound(lvl(['S.r', '...', 'y.E'], 1))
  tryMove(s, { r: 0, c: 1 })
  const res = tryMove(s, { r: 0, c: 2 })
  expect(res).toEqual({ kind: 'red-hit', rewoundTo: { r: 0, c: 0 }, livesLeft: 2 })
  expect(s.path).toEqual([{ r: 0, c: 0 }])
  expect(s.redHits).toBe(1)
})

test('rewind returns to the last activated yellow on the path', () => {
  const s = createRound(lvl(['Sy.', '..r', '..E'], 2))
  tryMove(s, { r: 0, c: 1 })   // activate yellow checkpoint
  tryMove(s, { r: 0, c: 2 })
  const res = tryMove(s, { r: 1, c: 2 })  // red
  expect(res).toEqual({ kind: 'red-hit', rewoundTo: { r: 0, c: 1 }, livesLeft: 2 })
  expect(s.path).toEqual([{ r: 0, c: 0 }, { r: 0, c: 1 }])
})

test('cells freed by rewind can be re-entered', () => {
  const s = createRound(lvl(['S.r', '...', '..E'], 1))
  tryMove(s, { r: 0, c: 1 })
  tryMove(s, { r: 0, c: 2 })            // red-hit, rewound to start
  expect(tryMove(s, { r: 0, c: 1 })).toEqual({ kind: 'moved' })
})

test('losing the last life loses the round', () => {
  const s = createRound(lvl(['Sr', 'yE'], 1, 1))
  const res = tryMove(s, { r: 0, c: 1 })
  expect(res).toEqual({ kind: 'lost' })
  expect(s.status).toBe('lost')
  expect(tryMove(s, { r: 1, c: 0 })).toEqual({ kind: 'rejected', reason: 'not-playing' })
})
