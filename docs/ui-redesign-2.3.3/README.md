# Interface pass — 2.3.3

The 2.3.1 cleanup moved workspace commands into Settings and removed the clipped
header, but it also turned the brush palette into a vertical stack in the right
gutter, left Settings without a stable header or a clear order, and left every
modal unstyled. This pass reworks those surfaces. No note data, storage format,
published link or short-link behaviour changed.

## What changed

**Right gutter.** The drawing palette is horizontal again and hangs to the left
of its chip as an overlay, the way it did before 2.3.1. The gutter itself is one
column of 44 px chips — show tools, page tabs, add a page — with the settings
gear matching at the bottom. Collapsed is still the default, so nothing covers
the note until the palette is asked for.

**Settings.** The panel is a fixed shell: the title and Reset to defaults stay in
place while only the middle scrolls, which is what the old panel lost when its
header scrolled away. The order is Pages → Theme → Layout → Colours → Your data,
each with one label and a hairline between. The orphan "Appearance" label is
gone, the theme grid is 3x3 for nine themes instead of a 4-wide grid with a
single swatch on the last row, and Your data keeps two backup buttons with
snapshots behind a Recovery snapshots disclosure.

**Modals.** The universal `margin: 0` reset stripped the UA centring from
`<dialog>`, so every modal opened pinned to the top-left corner. They are
centred now, scroll inside one surface, and share a heading, option rows, select,
disclosure and buttons. Radio groups are selectable rows rather than a fieldset
box whose legend cut through the first option. Import only shows the matching-ID
rule in Add mode. Page settings lays its four actions out as a 2x2 grid with Done
as the only filled button.

**Confirmations.** Delete page and Clear drawings were translucent with no
backdrop blur, so the emoji grid behind them showed through the warning text.
They are opaque now.

## Verification

- `npm run lint`, `npm test` (24 core tests), `npm run build`.
- `npx playwright test`: 39 passed across the PWA and unpacked-extension
  targets, 7 skipped (target-specific and short-link tests that need a backend).
- The layout regression test was rewritten around the new intent: the rail must
  stay outside the writing column at 1440/1280/390/320 with no header offset and
  no horizontal overflow, while the palette may overlay the note but must stay on
  screen and beside the rail.
- Screenshots in `before/` and `after/` were taken at 1440x900 and 390x844,
  DPR 2, in Chromium, on synthetic notes.

## Second pass: icons, motion and measured targets

The first pass fixed the structure but left the surfaces plain and static.
This pass adds the layer that makes them feel finished, working from
[emil-design-eng](../../../.codex/skills/emil-design-eng/SKILL.md) for motion
and component craft and [apple-design](../../../.codex/skills/apple-design/SKILL.md)
for materials and reduced motion, plus the row and toolbar conventions in
Raycast, Linear, Figma, Apple Markup and Excalidraw.

**One icon set.** `src/ui/icons.js` holds every glyph at 24x24 with a 1.5
stroke and round joins, matching the drawing toolbar icons that already
existed. Static markup ships placeholders that reserve the icon box, so
hydrating them on load cannot shift a row. Icons appear where they help
scanning — settings rows, backup buttons, command lists — and nowhere
decorative.

**Rows are surfaces.** A settings row is now a 40 px target with a leading
icon, a label, and its shortcut or chevron, highlighted across the full width
of the panel. The chevron nudges 2 px on hover.

**Motion with a reason.** Tokens in `:root` fix one strong ease-out curve and
durations from 120 to 220 ms. Every pressable control scales to 0.97 on
`:active`, so feedback lands on press rather than release. Settings grows out
of the gear it belongs to and leaves faster than it arrives. Modals fade and
scale from 0.97 with `@starting-style`, no JavaScript. Disclosures animate
their height through `::details-content` with a chevron that turns. Opening
Find a page with Ctrl/Cmd K plays no animation at all: a shortcut used dozens
of times a day should never wait.

**Measured targets.** The palette keeps 44–52 px height, 32–40 px buttons and
12 px between groups. On phones it docks to the bottom centre with 44 px
targets, out of the way of the note, and rises from the edge it lives on.

**Reduced motion is gentler, not absent.** `--motion-shift` and
`--motion-blur` collapse to zero and press scaling to 1, so travel and blur
disappear while the fades that explain a change remain.

**One behaviour fix.** The colour picker and font menu used to close when the
pointer left them, a leftover from when Settings opened on hover. That could
dismiss the picker mid-adjustment — choosing a custom colour hides the "Match
theme" button, the panel resizes, and the pointer is suddenly outside it. Both
now close on an outside click or Escape like everything else.

## Known trade-off

On a desktop, an open palette can overlap the right end of the first line of a
wide note. That is the cost of the requested top-right position; the palette is
translucent, closed by default, and only open while drawing. Phones avoid it
entirely by docking the palette to the bottom.

## Not verified here

Installed Chrome/Edge builds, a real installed PWA, physical touch and stylus
input, VoiceOver, and live short-link endpoints. The version was bumped to 2.3.3
but nothing was deployed.
