export type EventName = 'level_start' | 'level_won' | 'level_lost' | 'level_restart' | 'reveal_used' | 'daily_start'

// Anonymous per-browser id so PostHog can build funnels; no personal data.
const ID_KEY = 'dot-connect-device-id'
let memoryId: string | null = null

function distinctId(): string {
  try {
    const existing = globalThis.localStorage?.getItem(ID_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    globalThis.localStorage?.setItem(ID_KEY, id)
    return id
  } catch {
    if (!memoryId) memoryId = crypto.randomUUID()
    return memoryId
  }
}

export function track(event: EventName, props: Record<string, string | number> = {}): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com'
  if (key) {
    const payload = JSON.stringify({
      api_key: key,
      event,
      distinct_id: distinctId(),
      properties: { ...props },
      timestamp: new Date().toISOString(),
    })
    try { navigator.sendBeacon(`${host}/capture/`, payload) } catch { /* never break the game for analytics */ }
  } else {
    console.debug('[analytics]', JSON.stringify({ event, props, t: Date.now() }))
  }
}
