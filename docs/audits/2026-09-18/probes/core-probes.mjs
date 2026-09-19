// Audit diagnostics: fake in-memory storage only. Does not touch browser data.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { indexedDB, IDBDatabase } from 'fake-indexeddb';
const root = process.env.BLACKBOARD_AUDIT_ROOT || '/Users/dameer/Desktop/code/blackboard-text';
const source = file => import(new URL('file://' + root + '/' + file).href);
const { parseWorkspaceBackup } = await source('src/core/backup.js');
const { migrateLegacyChromeWorkspace, normalizeWorkspace } = await source('src/core/schema.js');
const { getBrushSizeInPixels } = await source('src/core/drawing-geometry.js');
const { createWorkspaceStore } = await source('src/core/workspace-store.js');
const { acquireWorkspaceLock } = await source('src/core/workspace-lock.js');
const results = [];
const record = (id, invariant, expected, actual, pass) => results.push({ id, invariant, expected, actual, pass });

const malformed = { format: 'BlackboardTextWorkspace', schemaVersion: 1, workspace: { pages: [null, 42, {}] } };
let malformedResult;
try { malformedResult = parseWorkspaceBackup(JSON.stringify(malformed)); } catch { malformedResult = null; }
record('IMPORT-SHAPE', 'Malformed page records must be rejected before replacement', 'reject', malformedResult ? 'accepted ' + malformedResult.workspace.pages.length + ' blank pages' : 'reject', malformedResult === null);
const quoteId = 'audit-"-quote-id';
const acceptedId = normalizeWorkspace({ pages: [{ id: quoteId, content: 'Retain this text' }] }).pages[0].id;
record('IMPORT-ID', 'Accepted IDs need safe lookup in current UI', 'normalize or escape at lookup', acceptedId, !acceptedId.includes('"'));

const oldStroke = { id: 'old-pixel-stroke', width: 4, points: [{ x: 48, y: 98 }, { x: 350, y: 98 }], color: '#DDDAD2' };
const migrated = migrateLegacyChromeWorkspace({ pages: [{ id: 'legacy', content: 'Old note', drawings: [oldStroke] }], settings: { fontSize: 40 } });
const renderedWidth = getBrushSizeInPixels(migrated.pages[0].drawings[0].width, 40);
record('LEGACY-WIDTH', 'Direct migration preserves an old 4px stroke at 40px font size', 4, renderedWidth, Math.abs(renderedWidth - 4) < 0.01);

globalThis.indexedDB = indexedDB;
const store = createWorkspaceStore({ dbName: 'blackboard-audit-memory-only' });
const workspace = normalizeWorkspace({ pages: [{ id: 'p1', content: 'saved' }], currentPageId: 'p1' });
await store.saveWorkspace(workspace);
const originalTransaction = IDBDatabase.prototype.transaction;
let rejectedWrite = false;
let rejectedFlush = false;
try {
  IDBDatabase.prototype.transaction = function (names, mode, ...rest) {
    if (mode === 'readwrite') throw new DOMException('Audit quota failure', 'QuotaExceededError');
    return originalTransaction.call(this, names, mode, ...rest);
  };
  try { await store.savePage({ ...workspace.pages[0], content: 'unsaved' }, 'p1'); } catch { rejectedWrite = true; }
  try { await store.flush(); } catch { rejectedFlush = true; }
} finally { IDBDatabase.prototype.transaction = originalTransaction; }
record('FLUSH-ERROR', 'An update save barrier must expose a failed preceding write', { rejectedWrite: true, rejectedFlush: true }, { rejectedWrite, rejectedFlush }, rejectedWrite && rejectedFlush);

const previous = { nav: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), storage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), set: globalThis.setInterval, clear: globalThis.clearInterval, now: Date.now };
let clock = 1000;
let interval = 0;
const callbacks = new Map();
const storage = new Map();
try {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } });
  globalThis.setInterval = fn => { callbacks.set(++interval, fn); return interval; };
  globalThis.clearInterval = id => callbacks.delete(id);
  Date.now = () => clock;
  const first = await acquireWorkspaceLock('audit-fallback');
  clock += 13000;
  const second = await acquireWorkspaceLock('audit-fallback');
  const before = JSON.parse(storage.values().next().value).token;
  callbacks.get(1)();
  const after = JSON.parse(storage.values().next().value).token;
  const actual = { firstAcquired: first.acquired, secondAcquired: second.acquired, oldWriterOverwroteNewLease: before !== after };
  record('FALLBACK-LEASE', 'Resuming an expired writer must not overwrite a new writer lease', false, actual, !actual.oldWriterOverwroteNewLease);
  first.release();
  second.release();
} finally {
  if (previous.nav) Object.defineProperty(globalThis, 'navigator', previous.nav); else delete globalThis.navigator;
  if (previous.storage) Object.defineProperty(globalThis, 'localStorage', previous.storage); else delete globalThis.localStorage;
  globalThis.setInterval = previous.set;
  globalThis.clearInterval = previous.clear;
  Date.now = previous.now;
}

const packageVersion = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
const rootManifestVersion = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')).version;
record('ROOT-MANIFEST', 'Root unpacked-extension version matches package version', packageVersion, rootManifestVersion, packageVersion === rootManifestVersion);
const duplicate = normalizeWorkspace({ pages: [{ id: 'same', content: 'a' }, { id: 'same', content: 'b' }] });
const distinct = new Set(duplicate.pages.map(p => p.id)).size;
record('DUPLICATE-IDS', 'Duplicate IDs are repaired without losing sibling pages', 2, distinct, distinct === 2);

const output = { generatedAt: new Date().toISOString(), node: process.version, scope: 'in-memory diagnostic probes, not application test suite', checks: results.length, failures: results.filter(r => !r.pass).length, results };
await writeFile(path.join(path.dirname(fileURLToPath(import.meta.url)), 'core-probes.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
// Exit 0 means successful diagnostic collection. pass:false records a defect.
