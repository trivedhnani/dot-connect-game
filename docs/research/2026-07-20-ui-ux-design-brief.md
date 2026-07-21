# UI/UX design brief — from 3-agent research sweep (2026-07-20)

Sources: three parallel research reports (visual polish in minimal puzzle games;
haptics platform reality; dramatizing irreversible commitment). Citations live in
the reports' key claims below. System principles and aesthetic skins are kept
separate — skins are swappable, principles are not.

## What makes this game special

The door-budget push-your-luck mechanic ("Zip with stakes") is the identity.
Playtesting showed the mechanic works but its *weight* isn't felt: door-spend is
a color swap, the flip is a brief flash. The research consensus (Darkest
Dungeon's torch, Balatro's scoring, Card Thief): stakes are staged continuously,
not announced at the threshold.

### The four-stage door dramatization (system layer)

1. **Approach telegraph** — doors glow/pulse when the path tip is adjacent,
   synced with the HUD budget counter pulsing; at last-point, other doors
   flicker faintly red (previews the flip).
2. **Commit** — ~150ms time-scale hitch; the spent budget point flies from HUD
   into the door and burns; a one-way "door seals" animation + heavy clunk.
3. **Flip set-piece** — freeze beat, then remaining doors flip yellow→red
   *sequentially* (domino ripple, <800ms, tap-skippable), full-board palette
   shift to a danger regime.
4. **Post-flip world state** — persistent darkened/desaturated board, soft red
   vignette, red dots pulse; on red contact, a ghost-trail rewind animation so
   the cost is watched, not teleported past.

**Decay rules (required):** slow-mo/freeze full-drama only first 2–3 encounters
per session, then shrink; heartbeat/alarm audio ducks after ~5s; reduced-motion
toggle. Screen shake: tiny and only on red hits — both reports agree shake is
action-game grammar; vignette/heartbeat carries tension better in contemplative
puzzles.

## Universal "premium" fixes (system layer, any skin)

Priority order by evidence:

1. **Typography.** Monospace HUD is the loudest prototype signal. Move to a
   rounded geometric sans (Nunito/Quicksand class) with a display weight for
   titles; real hierarchy (level id small, lives/doors as icons not text).
2. **Palette discipline.** 1 background tone, 1–2 neutrals, 3–5 semantic
   accents. Current default-saturated hues → designed hues (tuned, slightly
   desaturated, consistent luminance).
3. **The line is the product.** Rounded caps, eased head that leads/settles,
   cell pop as the path enters, subtle glow/trail at the head. Rising per-cell
   audio pitch (Two Dots' signature). Highest-ROI juice; the core verb is
   drawing.
4. **Motion as material.** Nothing snaps: 100–200ms feedback tweens, 200–400ms
   transitions, ease-out arrivals. Illegal move = rubber-band shake, retract =
   smooth, win = path-traveling pulse + confetti (spend the budget here).
5. **Negative space.** Board is the poster; HUD recedes (small caps, low
   contrast until relevant — budget counter brightens only near doors).
6. **One dose of charm** (Threes' faces): a single personality element, e.g.
   the path head as a subtle "traveler" or doors with tiny keyholes. Exactly
   one; clutter kills minimal.

## Haptics (platform reality)

- **iOS Safari web: none.** No Vibration API; the checkbox-switch Taptic hack
  was patched in iOS 26.5 and never worked from drag gestures anyway. On iOS
  web, audio+visual juice *is* the haptic channel.
- **Android web: ship now.** `navigator.vibrate` behind a feature check.
- **Capacitor wrap: full fidelity free.** @capacitor/haptics = graded impacts +
  notification patterns + selection ticks; half-day `haptics.ts` wrapper
  designed around the native vocabulary, web-Android as degraded mode, silent
  otherwise. Settings toggle required (platform guidance on both OSes).

| Event | Native (Capacitor) | Web-Android |
|---|---|---|
| Cell entered | selectionChanged tick | vibrate(8) |
| Door entered | impact Medium | vibrate(25) |
| Flip | notification Warning | vibrate([30,40,30]) |
| Red hit | impact Heavy + Error | vibrate([60,40,60]) |
| Win | notification Success (+tick per star) | vibrate([40,60,40,60,80]) |

Rules: causality (same frame as the visual), harmony (sync with SFX), utility
(frequent events near-imperceptible, big commitments strong).

## Candidate skins (aesthetic layer — pick one, swappable later)

1. **Neon Vault** — near-black w/ ambient gradient orbs, glowing path,
   cyan/magenta/amber accents, glassmorphic HUD cards. Refs: Tomb of the Mask,
   dark-glassmorphism trend. *Best fit for the stakes/tension identity.*
2. **Transit** — Mini Metro/Beck: charcoal or off-white field, thick rounded
   transit-line path, bold flat line colors, station dots. Editorial-premium,
   ages well.
3. **Daily Editorial** — NYT/Zip: soft dark surface, rounded cells w/ soft
   shadows, one confident accent, serif/sans pairing, shareable end-card. Best
   if leaning daily-habit loop.

## Recommended phasing

- **Phase 1 (web, now):** typography + palette + line-drawing feel + per-cell
  audio. Carries most of the "modern" signal.
- **Phase 2 (web):** door dramatization stages 1–4 with decay rules.
- **Phase 3 (web):** `haptics.ts` wrapper + settings toggle (Android web
  active, iOS silent), skin commitment.
- **Phase 4 (app):** Capacitor wrap flips the wrapper to full Taptic fidelity.
