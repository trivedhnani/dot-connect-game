# Restart button + yellow placement constraint (2026-07-20)

Post-launch design fixes from owner playtest. Approved in conversation 2026-07-20.

## Problems

1. **Yellow adjacent to start telegraphs the opening move.** The generator places
   yellows uniformly at random; a door next to the start removes the first routing
   decision. (Collectible-placement practice: bonuses belong at decision points on
   detours, not at the mouth of the level.)
2. **Door-commit trap after a red hit.** Enter a yellow → hit red → rewind to that
   yellow: the player is locked into a committed door on a route the red just proved
   wrong. The only escape today is deliberately burning the remaining lives.

## Research grounding

Path-drawing games (Flow Free, LinkedIn Zip) allow free retraction AND free full
restart; they counter brute force through the score dimension, not undo limits.
Games that penalize retries (Two Dots lives) do it for monetization and it is their
most-criticized feature. This game's anti-brute-force lever is the solver-benchmark
star grading, which is unaffected by free restarts.

## Design

1. **Restart button** on the play HUD (`↻ restart`, top-right next to `⌂ levels`).
   One tap = fresh attempt: path, yellow activations, flip state, and lives all
   reset (same as dying out, without feeding dots to reds). Lives MUST reset too,
   else deliberate death becomes the better refund. Implemented as
   `scene.restart`, active only while `status === 'playing'`. Analytics event:
   `level_restart`.
2. **Retraction stays non-refunding** (unchanged). Two-tier model:
   drag back = fix your line; restart = rethink your plan. Decisions-log rule
   "activation is permanent (survives rewind and retraction)" stands — restart is
   a new attempt, not an undo.
3. **Generator constraint**: every yellow at Manhattan distance ≥ 2 from the start
   (≥ 3 on boards of size ≥ 7). Regenerate all 90 levels through the existing
   solver pipeline; CI re-validates benchmarks.
4. **How-to-play copy**: note that restart is free and resets everything.

## Out of scope

Exit-adjacent yellows (same telegraphing argument could apply; revisit with
playtest data). Refund-on-retract variants (rejected: keeps push-your-luck
identity). Restart confirmation dialog (restart is cheap; no destructive-action
guard needed).
