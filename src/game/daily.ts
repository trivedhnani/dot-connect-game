export function todayKey(now: Date): number {
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
}

export function dailyIndex(dateKey: number, poolSize: number): number {
  let x = dateKey >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0
  x = (x ^ (x >>> 16)) >>> 0
  return x % poolSize
}
