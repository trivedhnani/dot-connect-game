import { writeFileSync, mkdirSync } from 'node:fs'
import type { Level } from '../engine/types'
import { generateCandidate, type GenParams } from './generate'
import { validateLevel } from './validate'
import { assess } from './difficulty'

interface Tier { tier: number; count: number; params: Omit<GenParams, 'seed'> }

const TIERS: Tier[] = [
  { tier: 1, count: 10, params: { size: 5, grays: 5, yellows: 2, budget: 1, reds: 3, mids: 0 } },
  { tier: 2, count: 20, params: { size: 6, grays: 7, yellows: 3, budget: 2, reds: 6, mids: 0 } },
  { tier: 3, count: 20, params: { size: 7, grays: 9, yellows: 4, budget: 2, reds: 9, mids: 1 } },
  { tier: 4, count: 10, params: { size: 9, grays: 12, yellows: 5, budget: 2, reds: 14, mids: 2 } },
]
const DAILY = { count: 30, tier: 3, params: { size: 7, grays: 8, yellows: 4, budget: 2, reds: 8, mids: 1 } }

function generateBatch(tier: number, params: Omit<GenParams, 'seed'>, count: number, seedBase: number) {
  const out: { level: Omit<Level, 'id'>; difficulty: number }[] = []
  for (let seed = seedBase; out.length < count && seed < seedBase + 200_000; seed++) {
    const cand = generateCandidate({ ...params, seed })
    if (!cand) continue
    const rep = validateLevel(cand)
    if (!rep.ok || !rep.benchmark) continue
    const a = assess(cand, rep.benchmark, tier)
    if (!a.interesting) continue
    out.push({
      level: { size: cand.size, rows: cand.rows, yellowBudget: cand.yellowBudget, lives: 3,
        benchmark: rep.benchmark, difficulty: a.difficulty },
      difficulty: a.difficulty,
    })
  }
  if (out.length < count) throw new Error(`tier ${tier}: only ${out.length}/${count} survivors — loosen filters or raise seed range`)
  out.sort((x, y) => x.difficulty - y.difficulty)
  return out.map((o) => o.level)
}

const campaign: Level[] = []
TIERS.forEach((t, i) => {
  const batch = generateBatch(t.tier, t.params, t.count, (i + 1) * 1_000_000)
  batch.forEach((lvl) => campaign.push({ ...lvl, id: `c${String(campaign.length + 1).padStart(2, '0')}` }))
})
const daily: Level[] = generateBatch(DAILY.tier, DAILY.params, DAILY.count, 9_000_000)
  .map((lvl, i) => ({ ...lvl, id: `d${String(i + 1).padStart(2, '0')}` }))

mkdirSync('src/levels', { recursive: true })
writeFileSync('src/levels/levels.json', JSON.stringify({ campaign, daily }, null, 1))
console.log(`wrote ${campaign.length} campaign + ${daily.length} daily levels`)
