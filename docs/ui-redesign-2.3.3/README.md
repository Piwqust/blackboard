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

## Known trade-off

While the palette is open it can overlap the right end of the first line of a
wide note. That is the cost of the requested top-right position; the palette is
translucent, closed by default, and only open while drawing.

## Not verified here

Installed Chrome/Edge builds, a real installed PWA, physical touch and stylus
input, VoiceOver, and live short-link endpoints. The version was bumped to 2.3.3
but nothing was deployed.

