import { test, expect } from 'vitest'
import { noteFreq, sfx } from '../../src/game/sfx'

test('noteFreq walks the chromatic scale from a base', () => {
  expect(noteFreq(392, 0)).toBeCloseTo(392)
  expect(noteFreq(392, 12)).toBeCloseTo(784)   // one octave
  expect(noteFreq(440, 3)).toBeCloseTo(523.25, 1)
})

test('sfx methods are callable without an AudioContext (node env)', () => {
  expect(() => { sfx.tick(3); sfx.clunk(); sfx.chord() }).not.toThrow()
})
