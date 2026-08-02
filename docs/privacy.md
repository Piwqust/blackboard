# Privacy

Blackboard Text is local-first.

- Notes, page drawings, settings, and recovery snapshots are stored in the browser's IndexedDB for the current browser profile and origin.
- The app has no accounts, analytics, telemetry, remote database, or note-sync service.
- The PWA only fetches its application files from its own GitHub Pages origin so that it can install and update. It does not send note content there.
- The personal unpacked browser extension uses local extension storage only to copy a legacy workspace when it is available; it does not upload that data.
- A downloaded `.blackboard.json` backup is a file chosen and controlled by the user. Keep it somewhere private because it contains the note text and drawing data it exports.
- **Published links.** *Publish page* puts the page itself — its text, drawings, and appearance — inside the link, after the `#`. Browsers never send that part of a URL to the server, so publishing uploads nothing and GitHub Pages never receives the note. Two consequences follow: anyone holding the link can read the page, and a published link cannot be withdrawn, because there is no copy anywhere to delete. Only share one with people who should read the page.
- A published note is opened by `read.html`, which renders it read-only. Remote images and scripts inside a published note are stripped before it is displayed, so opening someone's link does not make the reader's browser call out to a third-party host.

Clearing site data, uninstalling the extension, or deleting a browser profile can remove local data. Export regular backups before doing any of those things.
