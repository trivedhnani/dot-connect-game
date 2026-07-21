interface Settings { sound: boolean; haptics: boolean }
const KEY = 'dot-connect-settings-v1'
let memory: string | null = null

function read(): Settings {
  let raw: string | null = null
  try { raw = globalThis.localStorage ? localStorage.getItem(KEY) : memory } catch { raw = memory }
  if (!raw) return { sound: true, haptics: true }
  try { return { sound: true, haptics: true, ...JSON.parse(raw) as Partial<Settings> } }
  catch { return { sound: true, haptics: true } }
}
function write(s: Settings): void {
  const v = JSON.stringify(s)
  try { if (globalThis.localStorage) localStorage.setItem(KEY, v); else memory = v } catch { memory = v }
}
export function __resetSettingsForTests(): void {
  memory = null
  try { globalThis.localStorage?.removeItem(KEY) } catch { /* ignore */ }
}
export const getSound = (): boolean => read().sound
export const getHaptics = (): boolean => read().haptics
export const setSound = (v: boolean): void => write({ ...read(), sound: v })
export const setHaptics = (v: boolean): void => write({ ...read(), haptics: v })
