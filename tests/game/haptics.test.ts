import { test, expect, vi, beforeEach } from 'vitest'
import { haptic } from '../../src/game/haptics'
import { setHaptics, __resetSettingsForTests } from '../../src/game/settings'

beforeEach(() => __resetSettingsForTests())

test('fires navigator.vibrate with the mapped pattern when enabled', () => {
  const vib = vi.fn()
  Object.defineProperty(globalThis, 'navigator', {
    value: { vibrate: vib },
    writable: true,
    configurable: true,
  })
  haptic.door()
  expect(vib).toHaveBeenCalledWith(25)
  haptic.flip()
  expect(vib).toHaveBeenCalledWith([30, 40, 30])
})

test('silent when disabled or when vibrate is missing', () => {
  const vib = vi.fn()
  Object.defineProperty(globalThis, 'navigator', {
    value: { vibrate: vib },
    writable: true,
    configurable: true,
  })
  setHaptics(false)
  haptic.red()
  expect(vib).not.toHaveBeenCalled()
  Object.defineProperty(globalThis, 'navigator', {
    value: {},
    writable: true,
    configurable: true,
  })
  setHaptics(true)
  expect(() => haptic.win()).not.toThrow()
})
