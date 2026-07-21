export const C = {
  paper: 0xf3f1ed, card: 0xfffdf9, ink: 0x23211c, sub: 0x6b675f, hair: 0xe2ddd3,
  line: 0x3459e6, door: 0xeab63e, hazard: 0xd94f45, go: 0x2fa36b, loot: 0xa9a49b,
  emptyDot: 0xdcd7cd,
} as const
export const CS = {
  paper: '#f3f1ed', card: '#fffdf9', ink: '#23211c', sub: '#6b675f', hair: '#e2ddd3',
  line: '#3459e6', door: '#eab63e', hazard: '#d94f45', go: '#2fa36b', loot: '#a9a49b',
} as const
export const F = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "-apple-system, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
} as const
export const T = {
  pop: 140, lootFade: 200, doorDrain: 220, chipDip: 180,
  flipBeat: 250, flipStagger: 110, flipFade: 180, noteFade: 240,
  redPulse: 160, heartFade: 200, rewindPerCell: 60,
  sweep: 500, starStagger: 150, solvedFade: 300,
  introGroup: 140, introWithin: 45, introDot: 220, introLead: 150,
  unwind: 250, headSpringMs: 90,
} as const
export const REDUCED: boolean =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
