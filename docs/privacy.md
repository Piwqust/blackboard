# Privacy

Blackboard Text is local-first.

- Notes, page drawings, settings, and recovery snapshots are stored in the browser's IndexedDB for the current browser profile and origin.
- The app has no user accounts, analytics or automatic note-sync service. Optional short links upload only the copy selected by the user to Cloudflare; ordinary workspace data remains local.
- The PWA only fetches its application files from its own GitHub Pages origin so that it can install and update. It does not send note content there.
- The personal unpacked browser extension uses local extension storage only to copy a legacy workspace when it is available; it does not upload that data.
- A downloaded `.blackboard.json` backup is a file chosen and controlled by the user. Keep it somewhere private because it contains the note text and drawing data it exports.
- **Published links.** *Publish page* puts the page itself — its text, drawings, and appearance — inside the link, after the `#`. Browsers never send that part of a URL to the server, so publishing uploads nothing and GitHub Pages never receives the note. Two consequences follow: anyone holding the link can read the page, and a published link cannot be withdrawn, because there is no copy anywhere to delete. Only share one with people who should read the page.
- A published note is opened by `read.html`, which renders it read-only. Remote images and scripts inside a published note are stripped before it is displayed, so opening someone's link does not make the reader's browser call out to a third-party host.

Clearing site data, uninstalling the extension, or deleting a browser profile can remove local data. Export regular backups before doing any of those things. Page history is also local: up to 25 versions per page, 100 total and 10 MB. It is separate from downloaded workspace backups and is not uploaded automatically.

## Short links

Create short link explicitly uploads one immutable encoded note to the configured Cloudflare Worker/D1 service. The service operator can read stored copies. A random 128-bit ID locates the note; a separate 256-bit management key stays in the creator browser's separate IndexedDB store and never appears in a recipient URL or workspace backup. Clearing that browser data loses link management.

The optional link-management backup downloads these keys in a separate AES-GCM encrypted file protected by a passphrase-derived key (PBKDF2 SHA-256, 300,000 iterations). It contains link metadata and management keys, not shared note tokens. Keep the file and passphrase private. Importing it only restores local link controls; it does not upload or alter the shared copies. A pending creation can be disabled after key recovery, but retrying its upload requires the original browser's pending note token.

Disabling a link removes its stored payload and leaves a tombstone (ID, hashes, creation/revocation times) to prevent retry resurrection. New requests get no note; already downloaded copies cannot be recalled. Responses have Cache-Control: no-store. Cloudflare handles IPs for infrastructure and per-location rate limiting; the app does not save them in D1 or log payloads/management credentials.

Full links retain the existing no-upload behavior.
