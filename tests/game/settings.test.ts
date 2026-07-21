import { test, expect, beforeEach } from 'vitest'
import { getSound, setSound, getHaptics, setHaptics, __resetSettingsForTests } from '../../src/game/settings'

beforeEach(() => __resetSettingsForTests())

test('sound and haptics default to on', () => {
  expect(getSound()).toBe(true)
  expect(getHaptics()).toBe(true)
})

test('setters persist independently', () => {
  setSound(false)
  expect(getSound()).toBe(false)
  expect(getHaptics()).toBe(true)
  setHaptics(false)
  setSound(true)
  expect(getSound()).toBe(true)
  expect(getHaptics()).toBe(false)
})
