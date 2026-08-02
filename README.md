<div align="center">

<img src="./icons/icon-128.png" width="88" height="88" alt="Blackboard Text icon" />

# Blackboard Text

**A quiet, local-first place to think.**

Write, sketch, and keep your notes in the browser profile you control. No
account, telemetry, cloud database, or note sync service.

![Version](https://img.shields.io/badge/version-2.2.0-3D47FF?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-offline--ready-3D47FF?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-5B4FA8?style=flat-square)

</div>

![Blackboard Text — default Lavender theme](./screenshots/01-hero-lavender.png)

## What ships in v2

- **Publish a page as a link.** One page becomes a read-only link that anyone can open — the note travels inside the link itself, so nothing is uploaded and no account appears.
- A desktop PWA for Chrome and Edge, designed for GitHub Pages and offline use after the first visit.
- A local browser-extension build for personal use. The action focuses the existing editor page instead of opening competing writer tabs.
- IndexedDB storage: pages are individual records rather than one giant `chrome.storage` object.
- A single-writer lock. If the same workspace is opened in another tab, the new tab is clearly read-only, so it cannot overwrite the first tab's notes.
- Portable `.blackboard.json` export/import, with validation and a recovery snapshot before every import.
- Recovery snapshots before import, deleting a page, clearing drawings, and restoring a snapshot. The seven most recent are kept locally.
- Existing writing tools: emoji-labelled pages, optional page names, page reordering, custom typography, themes, drawing, undo/redo, and word count.
- New workspaces open with the dark **Blackboard** palette: `#0B0B0D` background, `#DDDAD2` text, and `#3D47FF` highlight. Existing saved themes are left unchanged.

## Where to use it

| Surface | Intended use | Updates |
| --- | --- | --- |
| PWA on GitHub Pages | Main app for Chrome and Edge desktop, and the address published links point at | A small **Reload** prompt appears when a new deployed version is ready. |
| Unpacked browser extension | Personal local copy and one-time migration/export path for older local data | Reload it manually after pulling a new version. |

The PWA and local extension intentionally keep separate local browser storage.
Move notes between them through an exported backup; this avoids accounts and
silent cloud sync.

## Publishing a note

Open the page tab, then **Publish page…**.

The page — its text, its drawings, and the theme and typography it was written
in — is compressed into the link itself, after the `#`. Browsers never send
that part of an address to a server, so publishing uploads nothing: the note
does not reach GitHub, and there is no account, database, or note ID anywhere.
The link opens in `read.html`, which renders the note read-only and works
offline like the rest of the app.

Two things follow from the note living inside the link:

- Anyone who has the link can read the page.
- A published link cannot be revoked. There is no server-side copy to delete,
  so treat sending one as final.

The dialog shows how long the link is. Under about 4 KB is comfortable
anywhere; past that, some chat apps shorten the address they display, and
turning off **Include this page's drawings** is usually the biggest saving.

A published note keeps the width it was published at. On a narrower screen a
note *with drawings* is scaled down as a whole, so the strokes stay where they
were drawn relative to the words; a note without drawings simply reflows.

## Backups and recovery

Open **Settings → Your data**:

1. **Export backup** downloads a `blackboard-text_*.blackboard.json` file.
2. **Import backup** validates the file, tells you how many pages it contains,
   and only replaces the current workspace after a local recovery snapshot is
   saved.
3. **Restore latest snapshot** lets you undo a destructive import, page delete,
   drawing clear, or earlier restore. Restoring itself first snapshots the
   workspace it replaces.

Browser storage can be removed by clearing site data, uninstalling an
extension, or deleting a browser profile. Export a backup before doing any of
those things. See [Privacy](./docs/privacy.md) for the exact data boundary.

## Migrating an existing unpacked Chrome extension

The old extension data is never deleted automatically.

1. In the original unpacked extension folder, update the project files to v2
   and press **Reload** on `chrome://extensions` so the extension keeps its
   existing extension identity and can still read its old `chrome.storage`.
2. Open Blackboard Text. It copies the legacy workspace into IndexedDB and
   leaves the old Chrome storage records in place.
3. Open **Settings → Your data → Export backup**.
4. Open the PWA or your local extension, then import that backup there.

Do not expect a newly loaded, different unpacked extension to see the old
extension's storage: browser extension storage is isolated by extension ID.

## Development

Requires Node 20 or later.

```bash
npm ci
npm run verify
```

`npm run verify` runs syntax/JSON checks, core migration and backup tests,
builds both targets, and checks the generated artifacts.

```text
dist/pwa/             GitHub Pages artifact
dist/edge-extension/  Load this directory as your local unpacked extension
```

`dist/` is generated and intentionally not committed.

## Shipping a change to the live PWA

GitHub Pages is the main product, so every feature has to reach it. The build
handles most of that for you:

- A new page or module is picked up by `scripts/build.mjs`, and the offline
  shell list inside `pwa-sw.js` is **generated from the files that were
  actually copied** — there is no hand-maintained cache list to forget.
- `scripts/verify-dist.mjs` fails the release if any deployed `.html`, `.css`,
  or `.js` file is missing from that shell, or if a build placeholder survived.
- `scripts/check.mjs` fails if `APP_VERSION` in `editor.js` and the version in
  `package.json` drift apart.

Add a brand-new top-level page to the `staticFiles` list in
`scripts/build.mjs`; everything under `src/` is copied and checked already.

1. In the repository's GitHub settings, enable **Pages** and choose **GitHub
   Actions** as the deployment source.
2. Change the version in `package.json` and `APP_VERSION` in `editor.js`, then
   create a matching tag such as `v2.2.0`.
3. Push the tag. The release workflow verifies the project, builds the PWA,
   and deploys it to GitHub Pages.
4. Visit `https://<account>.github.io/<repository>/` once while
   online. After that, the app shell works offline. Later deployments appear
   as an explicit Reload prompt rather than interrupting unsaved writing.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Alt` + `Shift` + `N` | New page |
| `Ctrl` / `Cmd` + `Z` | Undo text, or the last brush stroke in drawing mode |
| `Ctrl` / `Cmd` + `Shift` + `Z` or `Ctrl` + `Y` | Redo text |
| `Alt` + `Shift` + `B` / `E` | Toggle brush / eraser |
| `Tab` / `Shift` + `Tab` | Indent / outdent |
| `↑` `↓` on page tabs | Move focus between tabs (`Alt` + arrow reorders) |
| `Esc` | Close a picker, the publish dialog, or a confirmation |

## Licensing

The application code is available under the [MIT License](./LICENSE). Inter
and Inter Tight are bundled under the SIL Open Font License 1.1; see
[`fonts/Inter-OFL.txt`](./fonts/Inter-OFL.txt). Board Grotesk is a proprietary
project-owner asset supplied with permission; it is not covered by the MIT or
Inter font licenses.
