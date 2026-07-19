import { readFileSync } from 'node:fs'
import type { Level } from '../src/engine/types'
import { validateLevel } from '../src/solver/validate'

const data = JSON.parse(readFileSync('src/levels/levels.json', 'utf-8')) as { campaign: Level[]; daily: Level[] }
const all = [...data.campaign, ...data.daily]
if (data.campaign.length !== 60 || data.daily.length !== 30) {
  console.error(`bad counts: ${data.campaign.length} campaign, ${data.daily.length} daily`)
  process.exit(1)
}
let failed = 0
for (const lvl of all) {
  const rep = validateLevel({ size: lvl.size, rows: lvl.rows, yellowBudget: lvl.yellowBudget })
  if (!rep.ok) { console.error(`${lvl.id}: ${rep.reasons.join(', ')}`); failed++; continue }
  const b = rep.benchmark!
  if (b.grays !== lvl.benchmark.grays || b.yellowsSpent !== lvl.benchmark.yellowsSpent
      || b.pathLength !== lvl.benchmark.pathLength) {
    console.error(`${lvl.id}: benchmark drift (shipped ${JSON.stringify(lvl.benchmark)} vs ${JSON.stringify(b)})`)
    failed++
  }
}
if (failed) { console.error(`${failed} invalid levels`); process.exit(1) }
console.log(`all ${all.length} levels valid`)
