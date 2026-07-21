# Daily Editorial redesign — design system spec (2026-07-21)

Source of truth for the visual/motion/haptic redesign. Decided interactively with the owner
(2026-07-20/21); reference mocks live in two claude.ai artifacts (owner has links; the values
below are authoritative and complete — the artifacts are only pictures of them).

## Palette (one hue = one job)

| Token | Hex | Job |
|---|---|---|
| paper | `#f3f1ed` | screen background |
| card | `#fffdf9` | cell cards, chips, buttons |
| ink | `#23211c` | text, primary buttons, exit bullseye |
| sub | `#6b675f` | secondary text |
| hair | `#e2ddd3` | hairline borders |
| line | `#3459e6` | the player's line (and current-level accents) |
| door | `#eab63e` | yellow doors + door chip + stars |
| hazard | `#d94f45` | red dots + hearts |
| go | `#2fa36b` | start dot ONLY |
| loot | `#a9a49b` | gray loot dots |
| emptyDot | `#dcd7cd` | tiny dots on empty cells |

## Marking system (fixes start/exit/open-door confusion)

- **Start**: solid green circle. Green appears nowhere else.
- **Exit**: ink bullseye — small solid ink dot + ink ring around it. No green.
- **Door (unspent)**: solid yellow circle + soft yellow ring (gap 4).
- **Door (opened)**: fill drained to paper, yellow ring stays (slightly smaller, ring gap 3).
  "Identity over state" — same rule as the HUD chip.
- **Door (after flip)**: ordinary red dot, identical to other reds. No ring.
- **Loot**: gray dot; once covered by the line → 40% alpha, no scale change.
- **Empty**: tiny `emptyDot` circle.
- Cell = white `card` rounded rect (radius ~11 at 64px cell) with a soft shadow
  (Phaser: offset duplicate rect, `ink` at 0.06 alpha, +2y).

## Typography

- Display/serif voice: `Georgia, 'Times New Roman', serif` — masthead "Dot Connect",
  level label *No. 7* (italic), "Solved.", section titles.
- UI: system sans `-apple-system, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif`,
  weight 600–650 for labels/buttons.
- Eyebrows/small caps: 11px, letter-spacing wide, uppercase, `sub`.
- No monospace anywhere.

## Screens (layout contracts)

- **Play**: top banner = status only: serif "No. 7" left, hearts center, door chip right
  (chip: card pill, hairline border, small yellow ringed dot + "× N"; dot stays yellow at ×0).
  Board vertically centered between banner and bottom bar. Bottom thumb bar: three 44px
  hairline circle icon buttons — help (?) left, home (⌂) center, restart (↻) right.
  Flip note "DOORS SEALED" in `sub` small caps under the board — calm, no red anywhere.
- **Home**: centered serif masthead + short ink rule above it + uppercase date; featured
  "Today's puzzle" card (blue circle icon, serif title, → affordance); "CAMPAIGN" eyebrow;
  4-col grid of card tiles (number + tiny stars; locked = 45% opacity lock glyph; current =
  blue border); help + settings circle buttons clustered bottom-right.
- **Win card (GradeOverlay)**: full-screen paper takeover (not a floating box): stars stamp
  in (earned = solid `door` color, unearned = hollow), serif "Solved.", "NN% of the
  best-known route" + "X of Y loot" substat, route thumbnail in a card frame, then buttons:
  "Next puzzle" (ink pill, primary), row of ghost buttons Replay / Reveal (token-gated as
  today) / Levels. Keep existing recordResult/reveal-token mechanics unchanged.
- **How to play**: serif title, one-line sub, then a dot GLOSSARY (icon left, bold term +
  short text right, hairline separators): start(green)&exit(ink ring) / loot ("never needed
  to finish — but most of your score") / doors (hollow when opened; last spend flips rest
  to red) / hazards (life + rewind; ↻ restart always free) / grade (60/80/95 stars).
  Ink pill "Got it — play".

## Motion system (from the motion-lab spec)

Tokens: feedback 120–180ms; transitions 240–320ms; stagger 110ms; nothing >800ms; any tap
skips to end state. Easing: arrive = cubic ease-out; celebrate = back-out overshoot;
leave = ease-in. `prefers-reduced-motion` → movement collapses to fades, same timings.
**No screen shake, no flash overlays — remove existing `cameras.shake` and `flashOverlay`.**

| Moment | Animation | Sound | Haptic (web Android) |
|---|---|---|---|
| Level intro | dots grow in (back-out, 220ms each): loot group → hazards → doors → start+exit; groups 140ms apart, 45ms within; input enabled after (~700ms) or on tap-skip | 4 soft rising ticks, one per group | vibrate(8) per group |
| Draw | visual head SPRINGS toward pointer, ~90ms exponential smoothing — never snaps; entered cell card pops 1→1.06→1 (140ms); line = blue, round caps (circles at joints) | rising chromatic tick per cell from G4 | vibrate(8) per cell |
| Retract | same glide reversed | falling ticks | none |
| Illegal move | 3px rubber-band on head | none | none |
| Loot | gray fades to 40% over 200ms | soft pip (B5) | none extra |
| Door commit | fill drains yellow→paper 220ms, ring stays yellow, dot shrinks ~20%; chip numeral dips 3px 180ms and decrements | woody clunk (130Hz tri + 98Hz sine) | vibrate(25) |
| Flip (last door) | commit → 250ms beat → remaining doors crossfade yellow→red 180ms each, 110ms stagger → "DOORS SEALED" fades in 240ms. CALM: no tint/vignette | one muted low tick per flipping door | vibrate([30,40,30]) once |
| Red hit | red dot pulses ×1.15 160ms; heart empties (fade 200ms); line rewinds 60ms/cell to checkpoint | low thud (90Hz) + falling ticks during rewind | vibrate([60,40,60]) |
| Win | white pulse sweeps the full path 500ms → grade overlay: stars stamp back-out 150ms stagger → "Solved." fades 300ms | rising 3-note chord C5-E5-G5 | vibrate([40,60,40,60,80]) |
| Restart | line unwinds 250ms ease-in; states cross-fade back last 150ms | soft brush down-sweep | vibrate(15) |

**Decay:** first 3 door/flip moments per session play full; afterwards the pre-flip beat
drops to 0 and staggers halve. Session = JS module lifetime (no persistence needed).

## Sound & haptics infrastructure

- All sounds synthesized via WebAudio (no assets): short sine/triangle blips ≤ −18dB;
  AudioContext lazily created on first user gesture.
- `haptics`: `navigator.vibrate` behind `'vibrate' in navigator` (Android web only; iOS
  silently no-ops). Designed so a Capacitor build can later swap in native impacts.
- Both user-toggleable, persisted; toggles live in a small settings popup on Home
  (sound on/off, vibration on/off). Defaults: on.

## Out of scope

Capacitor wrap, ambient music, level-select re-theming beyond the layout above, win-card
social share image generation (plain `navigator.share` text is in scope when available).
