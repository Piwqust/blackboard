# Changelog

All notable changes to Blackboard Text. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), newest first.
Versions without a tag of their own (1.6.1, 2.2.1, 2.3.3 and 2.4.0) shipped
inside the next tagged release and are listed there.

The release workflow publishes the section whose heading matches the pushed
tag as the GitHub Release notes, so every tag needs a `## [x.y.z]` section here.

## [2.5.0] - 2026-10-23

A clearer interface, a website, and safer deletes. No data format changes:
backups and links stay compatible with 2.4.

### Added

- **Website.** The site root is now a short page about Blackboard Text: what
  it is, where notes live, how to install the app or the extension, how full
  and short links differ, and a few answers. English or Russian. An installed
  app still opens straight into the editor.
- **Undo after deleting a page.** A "Page deleted · Undo" message brings the
  page back in one tap.
- **Deleted pages in Recovery history.** Earlier versions of deleted pages
  can be recovered as new pages, even after the recovery snapshots rotate.
- **First-run tips** in a brand-new workspace: where drawing, pages and
  shortcuts are. They leave for good once you type or press Got it.
- **? opens Keyboard help**, which now lists all shortcuts.
- Pinned pages carry a small dot on their tab.

### Changed

- Drawing tools open from a **pen button** instead of a bare arrow.
- On phones the page button shows the **current page's emoji** and opens the
  page list.
- On desktop, **Settings opens beside the page rail** instead of covering it.
- **Page actions** are grouped into This page, Export, History and Help. Redo
  stays in the drawing toolbar's More menu.
- Without a sharing service, the share dialog offers full links only instead
  of a disabled option.
- Warnings are readable on dark themes; the Undo button and the delete
  confirmation have more contrast.
- Interface placeholders (such as the page name and search fields) are
  translated into Russian.
- The gear lines up with the page rail on desktop and phones.

### Fixed

- Drawing on long notes with many strokes attached to words is much faster:
  one text index per redraw instead of one walk through the note per stroke,
  and the recent-colour swatches are rebuilt only when they change.

### Security

- The editor, reader and short-link pages carry a Content-Security-Policy:
  scripts only from the app itself, no plugins, and network access only to
  the app and its sharing service.

## [2.4.2] - 2026-10-23

Bug fixes and polish. No data format changes: backups and links stay
compatible with 2.4.1. This version was tagged but not deployed on its own:
its fixes reached the website, and the extension zip, with 2.5.0.

### Fixed

- **Page actions → Name, emoji and delete…** no longer closes the moment it
  opens. On phones, where there is no page rail, the panel now rises from the
  bottom of the screen, so pages can be renamed and deleted there again.
- An import, a snapshot restore or a page recovery could be silently undone
  if the tab was hidden while it was being written. The old pages are no
  longer written back over the new ones.
- Tab and Shift+Tab on a selection indent each line in place. They used to
  merge the selected lines into one and drop bold, italics and links.
- The first line of a note no longer runs into the second in TXT and
  Markdown exports, search results and page-history previews.
- Read-only tabs now follow the editing tab, so their backup export and
  shared copies include the latest saved work.
- Content dragged in from other pages is inserted as plain text, like paste,
  and unsaved content flushed when a tab closes is sanitized first.
- Autosave now also runs during long stretches of continuous typing (at most
  five seconds apart), not only after a pause.
- New pages no longer upset the order of pinned pages; moving a page keeps
  pinned pages first.
- The save status no longer stays on "Saving…" after clearing drawings.
- Dragging in the colour picker no longer floods the recent colours.
- Offline use: the service worker skips the browser cache when installing an
  update, no longer stores every opened shared link separately, and opens the
  right page for a short link while offline.
- A non-JSON answer from the short-link service shows a readable error.

### Changed

- Russian interface: many missing translations (status messages, errors,
  screen-reader labels), correct plural forms ("3 страницы", "22 слова"),
  dates in the interface language, and buttons that no longer overflow. The
  language follows the browser until you choose one, and the selector moved
  under the themes.
- Keyboard: opening Settings from the keyboard moves focus into the panel;
  in Find a page, Enter opens the first result and the arrow keys move
  through the results.
- Touch screens get 44px targets for Settings, dialog and reader controls.
- Shared notes without drawings open in Readable text on phones.
- Exported files are named after the page name or its first line.
- Every GitHub Release now includes a ready-to-load extension zip
  (`blackboard-text-extension-<version>.zip`) with a SHA-256 checksum.
- New README, this changelog, and fresh screenshots.

## [2.4.1] - 2026-10-06

New drawing tools, page history, and PNG/PDF export. Includes the interface
pass prepared as 2.3.3 and the feature work prepared as 2.4.0. Short links
need the 2.4 short-link service, which accepts the new format.

### Added

- A small drawing toolbar beside page navigation: pen, marker, eraser and
  select, then Undo and **More**. Opening it never moves your text, changes
  wrapping or jumps the scroll position. On phones it sits above page
  navigation.
- Tap the active tool for its ink: six sizes, theme ink, four chalk colours,
  a custom colour and your recent colours, plus the tool's own switch
  (pressure for the pen, whole-stroke erasing, delete for a selection).
- Shift draws straight lines and Alt erases temporarily. Select moves or
  restyles a stroke. Drawing Redo. Each tool remembers its own settings.
- **More → Attach new strokes to words** pins an annotation to a word: typing
  before the word moves it along; deleting the word turns it into a free
  stroke instead of deleting it.
- **Export PNG or PDF** from **Settings → Page actions**, with text and
  drawings. Long pages become a multipage PDF. The PDF is an image of the
  board, so its text cannot be selected; use TXT or Markdown for that.
- **Page history** keeps up to 25 versions of each page (100 in total,
  10 MB) in this browser. Recovering a version creates a new page.
- Pin pages; search results show a snippet of the matching text.
- **Describe drawings** for people who read a shared copy with a screen reader.
- **Link management backup** (Settings → Your data) exports the keys that
  disable your short links, encrypted with a passphrase, so you can manage
  them from another browser. It contains no note text.
- Interface language: English or Russian. Your own text is never translated.

### Changed

- New strokes use one smoother renderer in the editor, the reader and exports.
  Older strokes keep their look until **More → Smooth existing**, which Undo
  can reverse.
- Drawings stay sharp however long the page gets.
- Settings keeps its title and Reset in place while the middle scrolls, and
  runs Pages → Theme → Layout → Colours → Your data.
- Dialogs are centred and share one style; Delete and Clear confirmations are
  opaque. One stroked icon set, press feedback on every control, and short
  motion that respects Reduce Motion.
- New backups and shared notes use format version 2. This release still opens
  version-1 backups and links; older apps refuse version-2 files instead of
  silently dropping drawing details, so update every copy you use.

### Fixed

- Reloading no longer jumps the note to an old scroll position, and a late
  scroll restore can't override a scroll you just made.
- The colour picker and font menu no longer close when the pointer leaves them.
- Save errors are tracked per operation; a successful save clears the warning.

## [2.3.2] - 2026-09-20

### Fixed

- Escape closes search, even when the search field already has text in it.

## [2.3.1] - 2026-09-20

### Changed

- The floating workspace bar above the note is gone, along with the empty
  header strip that clipped text as you scrolled.
- Search and page actions are rows inside Settings; backup is in **Your data**.
  **Ctrl/⌘ K** still opens search directly.
- Drawing tools start collapsed and open in the right gutter only when asked.

### Fixed

- Hidden Settings controls can no longer be reached with the keyboard while
  Settings is closed.

## [2.3.0] - 2026-09-20

Short links you can turn off, page search, and a round of safety fixes.
Includes the work prepared as 2.2.1.

### Added

- **Short links.** **Create short link** in the share dialog uploads one copy
  of the selected page to a small Cloudflare service and gives you a short
  address. Nothing else in your workspace leaves the browser.
- Disable a short link later from **Shared links from this browser**; it then
  stops opening. Full links, with nothing uploaded, remain the default.
- **Find a page** in Settings, or **Ctrl/⌘ K**, searches page names and text.
- **Page actions**: sharing, TXT and Markdown export, recovery, drawing redo
  and keyboard help in one place.
- Import can add pages instead of replacing the workspace; pages with matching
  IDs can be kept as copies or skipped.
- **Browse recovery history** previews the seven local snapshots and recovers
  single pages as new pages.
- Shared notes keep their original board and add **Readable text** and zoom.

### Fixed

- Security: the reader blocks dangerous link protocols and remote media in
  shared notes.
- Save failures are shown instead of passing silently, and the update Reload
  waits until your latest change is saved.
- Strokes from older versions keep their thickness after migration.
- Backup and confirmation dialogs are real modal dialogs; shortcuts no longer
  reach the editor behind them.
- Read-only tabs can switch pages and still manage shared copies.
- Reset to defaults uses the correct theme; opening the colour picker no longer
  changes the colour by itself.
- Reader layout fixes for scaled boards and drawing alignment.
- Very long notes cap the drawing bitmap at 8 million pixels to keep memory
  bounded. Note data is never cut.

## [2.2.0] - 2026-08-02

### Added

- **Share a page as a link.** The text, drawings, theme and typography are
  compressed into the link after the `#`, which browsers never send to a
  server: nothing is uploaded and there is no account or note ID.
- A read-only reader (`read.html`) that works offline like the rest of the app.
- The share dialog shows the link's length; turning off drawings is usually
  the biggest saving.
- Notes with drawings keep their published width and scale down as a whole on
  narrow screens, so strokes stay next to their words.

Anyone with the link can read the page, and such a link cannot be revoked.

## [2.1.0] - 2026-07-28

### Added

- Hover a page tab to preview its name, opening lines and dates.
- Pages record when they were created and edited; dates travel with backups.
  Pages from before 2.1 show no date rather than a made-up one.
- The drawing toolbar folds away behind an arrow in the top-right rail.

### Changed

- Toolbar, settings and close icons come from one consistent set.

## [2.0.1] - 2026-07-20

### Changed

- BoardGrotesque Sans (shown as Board Grotesk) ships with the app again.
- New workspaces open in the dark Blackboard palette (`#0B0B0D` background,
  `#DDDAD2` text, `#3D47FF` highlight) with Inter Tight. Saved themes are kept.
- The extension is now a personal, unpacked build; the Microsoft Edge Add-ons
  listing was dropped. The web app on GitHub Pages is the main app.

## [2.0.0] - 2026-07-20

From a Chrome extension to a local-first web app. Includes the unreleased
1.6.1 work.

### Added

- An installable web app (PWA) for Chrome and Edge, served from GitHub Pages.
  It works offline after the first visit and shows a **Reload** prompt when a
  new version is ready.
- The extension is built from the same source and focuses the existing editor
  tab instead of opening another one.
- Pages are stored as separate IndexedDB records. On first start, a 1.x
  extension copies its old workspace across and leaves the original in place.
- A single-writer lock: a second tab with the same workspace opens read-only,
  so it cannot overwrite the first.
- Portable `.blackboard.json` backups with validation.
- Recovery snapshots before import, deleting a page, clearing drawings and
  restoring; the seven most recent are kept.
- A highlight colour with auto-contrasting text, brush-size markers with
  "match theme colour", and a confirmation before clearing drawings.

### Changed

- New page is now **Alt+Shift+N**; browsers reserve Ctrl/⌘ N.

### Fixed

- Stored notes are sanitized before display, and storage quota errors appear
  in the save indicator.

## [1.6-beta] - 2026-05-18

First tagged version: a Chrome extension.

### Added

- A distraction-free editor with autosave and a word and character count.
- BoardGrotesque Sans in three weights, Inter and Inter Tight, with adjustable
  size, line height, letter spacing and width.
- Eight themes plus custom text, background and selection colours.
- Emoji page tabs you can reorder, in a scrollable rail.
- A drawing layer with brush, eraser and undo; strokes stay anchored to the
  text when the window resizes.
- Everything stays in `chrome.storage`: no account, network or telemetry.

[2.5.0]: https://github.com/Piwqust/blackboard/compare/v2.4.2...v2.5.0
[2.4.2]: https://github.com/Piwqust/blackboard/compare/v2.4.1...v2.4.2
[2.4.1]: https://github.com/Piwqust/blackboard/compare/v2.3.2...v2.4.1
[2.3.2]: https://github.com/Piwqust/blackboard/compare/v2.3.1...v2.3.2
[2.3.1]: https://github.com/Piwqust/blackboard/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/Piwqust/blackboard/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/Piwqust/blackboard/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/Piwqust/blackboard/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/Piwqust/blackboard/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/Piwqust/blackboard/compare/v1.6-beta...v2.0.0
[1.6-beta]: https://github.com/Piwqust/blackboard/releases/tag/v1.6-beta
