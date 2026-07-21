// event-mapped haptic feedback. Native (iOS/Android) via Capacitor Haptics
// when running as a native app; falls back to navigator.vibrate on web.
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { getHaptics } from './settings'

function buzz(pattern: number | number[]): void {
  try {
    const nav = globalThis.navigator as Navigator | undefined
    nav?.vibrate?.(pattern)
  } catch { /* never break the game for haptics */ }
}

export const haptic = {
  cell: () => {
    if (!getHaptics()) return
    if (Capacitor.isNativePlatform()) {
      void Haptics.selectionChanged().catch(() => {})
      return
    }
    buzz(8)
  },
  intro: () => {
    if (!getHaptics()) return
    if (Capacitor.isNativePlatform()) {
      void Haptics.selectionChanged().catch(() => {})
      return
    }
    buzz(8)
  },
  door: () => {
    if (!getHaptics()) return
    if (Capacitor.isNativePlatform()) {
      void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
      return
    }
    buzz(25)
  },
  flip: () => {
    if (!getHaptics()) return
    if (Capacitor.isNativePlatform()) {
      void Haptics.notification({ type: NotificationType.Warning }).catch(() => {})
      return
    }
    buzz([30, 40, 30])
  },
  red: () => {
    if (!getHaptics()) return
    if (Capacitor.isNativePlatform()) {
      void Haptics.impact({ style: ImpactStyle.Heavy })
        .then(() => Haptics.notification({ type: NotificationType.Error }))
        .catch(() => {})
      return
    }
    buzz([60, 40, 60])
  },
  win: () => {
    if (!getHaptics()) return
    if (Capacitor.isNativePlatform()) {
      void Haptics.notification({ type: NotificationType.Success }).catch(() => {})
      return
    }
    buzz([40, 60, 40, 60, 80])
  },
  restart: () => {
    if (!getHaptics()) return
    if (Capacitor.isNativePlatform()) {
      void Haptics.selectionStart()
        .then(() => Haptics.selectionEnd())
        .catch(() => {})
      return
    }
    buzz(15)
  },
}
