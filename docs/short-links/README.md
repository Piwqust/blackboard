# Short links on GitHub Pages

The app stays at https://piwqust.github.io/blackboard/. A real static route, s/index.html, accepts a random 128-bit ID in the fragment and opens read.html?s=ID in the same project directory. GitHub Pages needs no rewrite or server function. Public addresses are 62 characters on the current domain regardless of note size.

The immutable copy is stored by a Cloudflare Worker and D1. SHORT_LINKS_API_URL is a public build setting, never a secret. Cloudflare credentials are not shipped to browsers.

## Behavior

Opening Share uploads nothing. Create short link uploads only the selected snapshot. Full links remain available and require no server storage. If the API is not configured, short links are disabled with an explanation.

A separate 256-bit management key controls each ID. Its hash is stored on the server; the key stays in a separate browser IndexedDB database. It is never included in recipient URLs or workspace backups. Clearing browser data loses management access.

ID, key and pending snapshot are saved locally before uploading. A lost response can retry the same ID and payload. Revocation removes the note payload and leaves an ID tombstone, so retries cannot resurrect it. Copies already saved by recipients cannot be recalled. The service operator can read stored copies: this is not end-to-end encryption.

Short-link reads use no-store. Opening them requires internet and a working service. Full links retain existing offline behavior.

## Boundaries

Maximum encoded copy: 900,000 characters. Existing decompression and geometry checks also apply. Larger copies can use full links or file export. The D1 store is capped at 100 MB of active payloads and 10,000 IDs including disabled IDs. Capacity errors do not evict existing notes.

Anonymous creates: 5/minute/IP. Reads/deletes: 120/minute/IP. Cloudflare limits are per location; they are not authentication or global DDoS protection. CORS permits configured origins but does not authenticate non-browser clients. No listing endpoint exists. Application logs omit payloads, IDs and management keys.

No paid plan is enabled by setup. Cloudflare account quotas still apply and may temporarily stop service at the free limit. Review account limits before raising caps.

## Local checks

1. npm ci
2. npm run verify
3. npx playwright install chromium
4. npm run test:browser
5. npm run test:shares
6. npm run shares:check

The share test runner creates a temporary local D1, applies the schema, starts real workerd, checks the API and runs browser tests for both build targets. It uses no user notes and never targets production.

Manual backend development:

    npx wrangler d1 migrations apply blackboard-text-shares --local --config backend/short-links/wrangler.jsonc
    npm run shares:dev

For local frontend development set SHORT_LINKS_API_URL=http://127.0.0.1:8787 before npm run build. The test runner permits its own local origin; production config only permits the Pages origin and extension origins.

## Production setup

These steps create separate new resources and never reuse another application's database.

1. Authorize Wrangler for the intended Cloudflare account.
2. Create D1 database blackboard-text-shares. Save the returned database_id in backend/short-links/wrangler.jsonc.
3. Apply backend/short-links/migrations only to that database.
4. Deploy Worker blackboard-text-shares. Keep ALLOWED_ORIGINS=https://piwqust.github.io.
5. Set repository Actions variable SHORT_LINKS_API_URL to the deployed HTTPS Worker URL.
6. Publish the tested v2.3.0 tag through Release PWA. It builds the configured frontend, runs regressions and local share tests before Pages deployment.
7. From actual Pages, create a synthetic copy, open it in another context, disable it and verify the URL no longer serves the note.

The extension artifact's CSP allows only the configured API origin. An unbuilt source-folder extension continues to offer full links only.

## Rollback

Keep the Worker and database alive when reverting the frontend: existing shared URLs need the reader route and API. To stop new creation, disable Create in the frontend or reject PUT while retaining GET/DELETE. Do not delete the database for rollback. It contains published copies. This schema is independent of local workspaces.

## Deployment verified on 20 September 2026

- Pages: https://piwqust.github.io/blackboard/
- API: https://blackboard-text-shares.pewqust.workers.dev
- Release tag: v2.3.0, source commit 4822a9cd18e0556b86f0f02c0d7623b8692f7a1c.
- Release workflow: https://github.com/Piwqust/blackboard/actions/runs/35499263715 — success, including Pages deployment.
- Validate workflow: https://github.com/Piwqust/blackboard/actions/runs/35499263708 — success.
- On live Pages, a disposable Chrome creator session made a synthetic short link (62 characters). A separate recipient session read the exact snapshot. The creator disabled it; reloading in the recipient session showed that the note was unavailable. No user notes were used.
- Full local regression: 24 core tests, 37 applicable browser tests; dedicated share suite: HTTP API checks and 4 browser tests against local workerd/D1.
- Live verification details: live-verification.json. The script scripts/verify-live-short-link.mjs uses synthetic data and disables its test link after use.

The D1 schema uses atomic batches rather than SQL triggers because the remote migration API rejected the original compound trigger statement. Both local and live creation/revocation were rechecked after this change.
