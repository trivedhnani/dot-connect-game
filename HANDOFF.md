# Handoff — dot-connect-game (written 2026-07-20)

v1 is **shipped and live**: https://trivedhnani.github.io/dot-connect-game/
Owner: trivedhnani. Repo: github.com/trivedhnani/dot-connect-game (public). Local: `Mac Projects/dot-connect-game`.

## What this is
First title of a games-with-ads venture (pivot from video content). Strategy set by the economics research at `Mac Projects/mobile-game-ads-economics.md`: puzzle genre, web-first, prove fun before monetizing, prototype-test discipline. Read that report before making monetization or genre decisions.

Game: "Zip with stakes" — grid path puzzle. Draw one line start→exit; gray dots = optional loot; **yellow dots are doors** (entering spends a tight budget point, permanently; spending the last one flips remaining yellows to red); red = lose a life + rewind to last door; win is graded vs a build-time exact-solver benchmark (60/80/95% → 1/2/3 stars); reveal tokens show the best path (future rewarded-ad hook). Mandatory-yellow + flip is the novel mechanic (verified unique by a 3-agent market sweep, 2026-07-19).

## Authoritative docs (in this repo)
- Design spec: `docs/superpowers/specs/2026-07-19-dot-connect-game-design.md` (rules are canonical here; includes a decisions log)
- Implementation plan (executed, 15/15): `docs/superpowers/plans/2026-07-19-dot-connect-game-v1.md`
- Progress ledger + minor-findings backlog: `.superpowers/sdd/progress.md` (git-ignored, local only)

## Architecture (the boundaries matter)
- `src/engine/` — pure-TS rules (board, round, grading). No Phaser/browser imports. Fully unit-tested.
- `src/solver/` — exact solver, ship invariants (incl. reachable-set no-trap check), seeded generator, difficulty/interestingness filters, CLI (`npm run gen:levels`) emitting `src/levels/levels.json` (60 campaign + 30 daily pool, all solver-proven).
- `src/game/` — thin Phaser 3 scenes (PlayScene, GradeOverlay, LevelSelect, HowToPlay) + storage (localStorage), daily selection, analytics stub, `ui.ts` (TEXT_RESOLUTION for high-DPI text).
- CI (`.github/workflows/deploy.yml`): test → typecheck → re-validate all 90 levels (benchmark drift = build failure) → build → Pages deploy on push to main. An unfair/unwinnable level cannot ship.
- Commands: `npm run dev` / `test` / `typecheck` / `gen:levels` / `validate:levels` / `build`.

## Current state
44/44 tests, tsc clean, deploy green. User has played it and likes it. Recent post-launch fixes: how-to-play screen, visible "⌂ levels" home button, high-DPI crisp text, responsive/notch-safe HUD, rules note that covering every gray is usually impossible.

## Next steps (priority order)
1. **Friend playtest gate** (spec's v1 exit criterion): ≥20 levels finished unprompted, players replaying for stars, someone asking for more. Share the live URL.
2. **Real analytics**: `track()` in `src/game/analytics.ts` beacons JSON to `VITE_ANALYTICS_URL` if set at build time, else console. Stand up a free endpoint (PostHog or similar) and set the env in the deploy workflow to get level-funnel data.
3. **Difficulty tuning from data**: fail/grade spikes per level → reorder or replace levels (regenerate via `cli.ts` tiers; levels are data, not code).
4. **Backlog minors** (from reviews, none blocking): storage shape validation on load; budget-0 flipped init edge in `createRound`; `assess()` treats shortest-solve timeout as gap-inflating; GradeOverlay/LevelSelect don't re-layout on rotation; LevelSelect tiles cramped <380px; reveal button silently no-ops at 0 tokens; level-select grid left-aligned on wide desktop.
5. **Monetization phase — only after the playtest gate passes**: Capacitor wrap → App Store/Play Store → reveal button becomes rewarded ad (AppLovin MAX / AdMob per the economics report) → light IAP (remove-ads + tokens). Deliberately deferred: level-curation browser (spec pipeline step 5), moving/blinking red mechanic drips, scattered-dot skin.

## Working agreements with the user
- Human eye is the final arbiter of feel/fun; LM judges and scores are advisory (long-standing preference).
- Data-driven over theory for taste/market decisions — research first.
- Fast momentum, compressed reviews on small tasks; superpowers workflow (brainstorm → spec → plan → subagent-driven dev) for big ones.
- Playtest found real bugs code review missed — always run the actual game in a browser before shipping gameplay changes.
