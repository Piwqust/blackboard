# Microsoft Edge Add-ons listing draft

## Product name

Blackboard Text

## Short description

A quiet, local-first writing space with page drawings and portable backups.

## Full description

Blackboard Text is a calm place to write. Create emoji-labelled pages, tune the type, draw directly over a page, and keep everything local to the browser.

Your notes do not require an account and are not uploaded to a server. Export a `.blackboard.json` backup whenever you want a portable copy, then import it into the PWA or another Edge installation.

## Privacy disclosure draft

- Does the extension collect or transmit personal data? No.
- Does it use analytics or advertising? No.
- What permission is requested? `storage`, only for legacy unpacked-extension migration. The current workspace itself lives in IndexedDB.
- Privacy-policy URL after publication: `https://<account>.github.io/<repository>/privacy.html`.

## Store assets to prepare manually

- 128×128 icon: `icons/icon-128.png`
- At least one current screenshot from the built Edge extension
- Public privacy-policy URL after GitHub Pages is enabled
- Public support URL (the repository issue tracker is sufficient for the first release)

## Submission checklist

1. Build with `npm run verify`.
2. Upload `dist/blackboard-text-edge-vX.Y.Z.zip` from the release workflow artifact.
3. Choose **Public** visibility.
4. Paste the description and privacy answers above, then attach screenshots from the release build.
5. After the first publication, publish a tiny `vX.Y.Z+1` update and verify that an installed Edge copy receives it.
