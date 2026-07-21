// event-mapped vibration. Android web only today; iOS no-ops.
import { getHaptics } from './settings'

function buzz(pattern: number | number[]): void {
  if (!getHaptics()) return
  try {
    const nav = globalThis.navigator as Navigator | undefined
    nav?.vibrate?.(pattern)
  } catch { /* never break the game for haptics */ }
}
export const haptic = {
  cell: () => buzz(8),
  intro: () => buzz(8),
  door: () => buzz(25),
  flip: () => buzz([30, 40, 30]),
  red: () => buzz([60, 40, 60]),
  win: () => buzz([40, 60, 40, 60, 80]),
  restart: () => buzz(15),
}
