# Privacy

Blackboard Text is local-first.

- Notes, page drawings, settings, and recovery snapshots are stored in the browser's IndexedDB for the current browser profile and origin.
- The app has no accounts, analytics, telemetry, remote database, or note-sync service.
- The PWA only fetches its application files from its own GitHub Pages origin so that it can install and update. It does not send note content there.
- The personal unpacked browser extension uses local extension storage only to copy a legacy workspace when it is available; it does not upload that data.
- A downloaded `.blackboard.json` backup is a file chosen and controlled by the user. Keep it somewhere private because it contains the note text and drawing data it exports.

Clearing site data, uninstalling the extension, or deleting a browser profile can remove local data. Export regular backups before doing any of those things.
