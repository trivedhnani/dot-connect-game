# dot-connect-game

Grid path puzzle: draw one line from start to exit, grab optional gray dots,
avoid reds, and spend a tight budget of yellow "door" checkpoints — then get
graded against the solver's best-known path.

## Develop
- `npm install`
- `npm run dev`          # local play at the printed URL
- `npm test`             # engine + solver + game unit tests
- `npm run gen:levels`   # regenerate src/levels/levels.json (deterministic seeds)
- `npm run validate:levels`  # CI gate: re-verify every shipped level

## Analytics
Set `VITE_ANALYTICS_URL` at build time to POST gameplay events
(level_start/won/lost, reveal_used, daily_start) as JSON beacons; unset = console only.

## Deploy
Push to `main` → GitHub Actions runs tests + level validation, builds, and
publishes to GitHub Pages.

Design spec: `docs/superpowers/specs/2026-07-19-dot-connect-game-design.md`.
