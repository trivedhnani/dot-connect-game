export type EventName = 'level_start' | 'level_won' | 'level_lost' | 'level_restart' | 'reveal_used' | 'daily_start'

export function track(event: EventName, props: Record<string, string | number> = {}): void {
  const url = import.meta.env.VITE_ANALYTICS_URL as string | undefined
  const payload = JSON.stringify({ event, props, t: Date.now() })
  if (url) {
    try { navigator.sendBeacon(url, payload) } catch { /* never break the game for analytics */ }
  } else {
    console.debug('[analytics]', payload)
  }
}
