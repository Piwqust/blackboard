# Interface cleanup — 2.3.1

Requested change: remove the intrusive workspace bar and the fixed empty header that clipped scrolled text.

- Deleted the floating Pages / Page actions / Backup / Saved locally bar.
- Search and page actions are quiet icon rows inside Settings; backup uses the existing Your data section.
- Save status is a text label; a retry action appears only after a save error.
- Removed the 112–192 px body offset; the note now scrolls from the top of the viewport. Canvas width cannot overflow while resizing.
- Drawing tools start collapsed and expand vertically within the existing right gutter instead of overlapping note text.
- Closed Settings are inert; opening search closes Settings, and Escape restores the launching control when appropriate.

Verification: 24 core tests, 39 applicable browser regression tests, four short-link browser tests and real workerd API checks. Seven skipped entries in the normal browser run are target-specific/runtime-share tests, covered by the separate share run where applicable. Chrome 153 and Edge 153 layout checks covered 12 pages and widths 320/390/1280/1440 at DPR 2. Screenshots of editor and Settings on desktop/mobile were inspected.

Notes, snapshots, published URLs and cloud storage are unchanged. Deployment uses the existing GitHub Pages pipeline and configured short-link endpoint.
