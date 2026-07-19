# Dot-Connect Game — v1 Design

Working title: `dot-connect-game` (real name TBD before store release; not a blocker for v1).
Date: 2026-07-19. Status: draft for user review.

## Vision & positioning

A grid path-drawing puzzle — "Zip with stakes." The player draws one continuous path from a start dot to an exit dot, greedily covering optional gray dots while avoiding lethal red dots, and must route through scarce yellow checkpoint dots. Unlike Zip/Flow Free (pure logic, one correct answer), every level is a **push-your-luck optimization**: the round is graded against the solver's best-known path.

Uniqueness research (2026-07-18/19, three-agent sweep): no existing mobile/web game combines (1) anchored drawn path, (2) optional score collectibles, (3) lethal hazard dots, (4) a limited spendable checkpoint resource. Closest neighbors: LinkedIn Zip (viral proof of the drawn-path dot puzzle), Tomb of the Mask (500M+ installs; proof of greed-vs-hazard on a grid), Card Thief (path + push-your-luck, niche premium, random-deal). The limited-checkpoint mechanic appears in no found title. Uniqueness is real but not a moat — speed to market and level quality are the defensible assets.

Business context: first title of a games-with-ads venture (see `Mac Projects/mobile-game-ads-economics.md`). Strategy: prove fun first via free web playtests, monetize later (rewarded ads on the reveal mechanic, then IAP). Puzzle is the right genre bet (72% of casual revenue is Puzzle+Casino).

## Core rules

**Board.** Square grid, 5×5 → 9×9. Cells: empty, green (start / exit / mid-checkpoints), gray (optional loot), yellow (activatable checkpoint), red (hazard).

**Drawing.** Press the start green, drag orthogonally cell-to-cell. A cell may be visited once; the trail is a wall. Dragging backward retracts the path (free, unlimited). Lifting the finger pauses; resume from the tip. "Stuck" never ends a round — retract and reroute.

**Yellows (the signature mechanic) — door semantics.**
- Yellows are doors: **entering a yellow cell IS the activation** — it spends one budget point automatically. You cannot enter a yellow with zero budget remaining. No separate tap.
- Every level REQUIRES ≥1 activation by construction: no route to the exit avoids all yellow cells, so "which yellows do I choose" is purely a routing decision.
- Per-level activation budget (e.g., 4 yellows on board, max 2 activations). Activation is permanent (survives rewind and retraction); an activated yellow is a green checkpoint, freely re-enterable.
- When the last allowed activation is spent, **all remaining yellows flip to red** — animated clearly, with an "activations left" counter always visible. Flipping poisons routes you were saving.

**Reds & lives.** Touching red: lose 1 life, path rewinds to the last activated checkpoint on the current path (else the start); grays collected past that point return to the board. Lives are per-level (default 3), reset each level. Lives exhausted → full level reset. No timers, no global lives pool, no waiting.

**Round end.** Win: reach the exit green. There is no "stuck" ending and no mid-round scoring.

## Scoring: end-of-round grading vs solver benchmark

Nothing scores during play. On completion, the path is graded against the solver's optimal path for the level:

- **Optimality (priority order):** grays covered (max) → yellows spent (min, ≥1 required) → red hits (heavy deduction each) → path length (tiebreak).
- Player sees a percentage grade ("Path rating: 87%") plus a directional hint ("a better route exists: +2 grays, 1 fewer yellow") — never the route itself.
- **Stars:** ⭐ ≥60% · ⭐⭐ ≥80% · ⭐⭐⭐ ≥95%. The replay hook is "can I find THE line?" (golf par, not coin collecting).
- **Reveal mechanic:** post-round "Reveal best path" button. v1: 3 free reveal tokens + earnable via stars. Monetization phase: same button becomes rewarded-ad / IAP gated. Scoring ≥95% reveals the optimal path free as a flourish.
- Exact point/threshold numbers are tuning placeholders; ratios are the design (a red hit ≈ losing ~5 grays of value).

Design rationale (decided after explicit comparison): coverage ("more grays = better") over efficiency ("fewer/shorter") because (a) humans eyeball short routes easily but are bad at max-coverage routing — harder puzzle, stronger replay itch; (b) efficiency-grading makes grays and reds meaningless, collapsing the game into a maze-runner; (c) both are equally gradable by algorithm (see solver). "Fewest dots" inverted mode is a possible post-v1 special level type.

## Solver & generator

**Solver (build-time only; pure TS run under Node).** For each level: exact search (DP over frontier / branch-and-bound with pruning; board ≤9×9 keeps this tractable) computing the optimal path per the grading criteria. Candidates that time out are discarded — we only ship what the solver solved exactly. The runtime grader never searches; it compares the player's path to the precomputed benchmark.

**Validation invariants (all must hold to ship a level):**
1. Beatable within the yellow budget.
2. Every winning route activates ≥1 yellow (yellows are chokepoints by construction).
3. After any legal sequence of activations exhausts the budget (flipping remaining yellows to red), completion remains possible from every reachable state — the flip can never hard-trap.
4. Optimal path computed and stored as the 100% benchmark.

**Level generation pipeline ("we author filters, not levels"):**
1. **Bulk generation:** random placement under per-tier knobs (grid size, red density, yellow count/budget, gray count); each candidate is `seed + params`, fully reproducible. Thousands of candidates; most are garbage by design.
2. **Solver filter:** discard candidates violating any invariant.
3. **Interestingness filters (computable fun-adjacent properties):**
   - Obvious-route grade < ~85% of optimal (there must be a discovery gap; eyeball-solvable levels are duds).
   - Mid/late tiers: ≥1 decoy yellow (looks right, caps achievable grade).
   - Optimal path passes red-adjacent several times (danger on the good line, not beside it).
   - Near-optimal alternatives within a few % exist (ambiguity creates deliberation).
4. **Difficulty scoring** (obvious-vs-optimal gap, solution count, size, yellow tightness) buckets survivors into the ramp. Planned enhancement (post-v1 or during tuning): a scripted **naive bot** (greedy gray-chaser, shallow lookahead) plays each candidate; the naive-grade-vs-optimal gap is a deterministic proxy for the human discovery gap. (LLM players were considered and rejected: the exact solver already beats them at solving, and LM-judges are unreliable at rating fun; humans remain the fun arbiter.)
5. **Human curation:** generator emits ~300 ranked survivors; we play top candidates in a dev-build level-browser page and cherry-pick the shipped 60. Taste is the last filter.
6. **Playtest loop:** analytics (grade distributions, fail counts per level) drive reordering/replacement from the survivor pool. Levels are JSON; swapping is editing data.

## Difficulty progression (v1: 60 levels)

- **1–10 (5×5):** teach by design, no text tutorials. Obvious paths; reds appear ~level 3 (peripheral); yellows ~level 6 (obviously valuable); the yellow→red flip demonstrated ~level 8 on a board where it is safe but visible.
- **11–30 (6×6–7×7):** reds form walls/chokepoints; gray clusters get red guards; yellow budget tightens.
- **31–50 (7×7–8×8):** mid-green must-visit checkpoints (all must be on the path before the exit opens) force zigzags; trail-as-wall self-blocking becomes the puzzle.
- **51–60 (9×9):** decoy yellows + flip management + gray-order planning combined.
- **Daily level:** date-seeded pick from a pregenerated pool; same engine, zero marginal content cost; primary comeback-tomorrow hook.
- Post-v1 mechanic drip (explicitly out of v1): blinking reds, moving reds, portals, keys/locks.

## Architecture

- **Stack:** Phaser 3 + TypeScript, Vite. Hosted on GitHub Pages (auto-deploy on push). Later: same codebase wrapped with Capacitor for iOS/Android stores.
- **Module boundaries (the architecture in one line: pure-TS core, thin Phaser skin):**
  1. `engine/` — rules: board state, path legality, activation, flip, rewind, grading. Pure TS, zero Phaser imports, fully unit-tested.
  2. `solver/` — generator + exact solver + filters + difficulty scoring. Pure TS, runs at build time via Node script; emits static level JSON (layout, budget, benchmark, difficulty).
  3. `game/` — Phaser scenes: render, drag/retract input, animations (flip, rewind, grade reveal), post-round screen, level select.
- **Data:** levels + daily pool as static JSON baked into the bundle. Progress (stars, best grades, reveal tokens) in localStorage. No backend, no accounts.
- **Analytics:** minimal anonymous events (level start/complete/fail, grade, reveals used) via a free-tier service (e.g., PostHog) — needed to tune difficulty from real playtests.

## Testing

- vitest unit tests: engine (path legality, activation/flip edges, rewind-with-retraction edges, grading) and solver (invariants on known boards, benchmark correctness on small handcrafted cases).
- **CI gate:** every shipped level JSON re-validated by the solver on push; an invalid level cannot deploy.
- Human playtest gate before calling v1 done: 5–10 friends via link. Success signals: ≥20 levels finished unprompted; some players replay for 3 stars; anyone asks for more levels.

## v1 scope

**In:** 60 levels + daily level; full rule set; grading + stars + reveal tokens; touch-first controls (mobile browser) + desktop; three polished juice moments (flip, rewind, grade reveal); localStorage; GitHub Pages; minimal analytics.

**Out (deferred):** ads, IAP, accounts, leaderboards, store wrap (Capacitor), sound beyond basics, mechanic drips, localization, custom domain, real title/branding.

## Key decisions log

| Decision | Choice | Why |
|---|---|---|
| Session structure | Level-based puzzle | Round ends only on win (exit reached) or lives out; "stuck" = retract & reroute. Proven casual format. |
| Board | Grid, orthogonal moves | Unambiguous red-touch detection; tractable solver; generator control. Scattered-dot skin possible later. |
| Yellow semantics | Mandatory (≥1), tight budget, permanent activation, remainder flips to red | User's rule; makes yellow choice the core decision and deepens push-your-luck. |
| Fail loop | Per-level lives (3), score-relevant red hits, full reset on exhaustion; no ads v1 | User choice; no wait-timers. |
| Grading | End-of-round vs solver optimum; coverage > efficiency | Harder for humans, preserves greed-vs-danger identity, equally algorithmic. |
| Reveal | Free tokens v1 → rewarded-ad/IAP later | User request; best-converting ad placement in genre. |
| Build | Web-first (Phaser) → Capacitor wrap later | Fastest playtest loop (shareable link); defers store friction until fun is proven. |
