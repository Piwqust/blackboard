import test from "node:test";
import assert from "node:assert/strict";
import { indexedDB, IDBDatabase, IDBObjectStore } from "fake-indexeddb";
import { normalizeStroke, normalizePage } from "../src/core/schema.js";
import { strokePoints, traceStroke } from "../src/core/drawing-renderer.js";
import { createDrawingHistory } from "../src/core/drawing-history.js";
import { createWorkspaceStore } from "../src/core/workspace-store.js";
import { exportLinkKeys, importLinkKeys } from "../src/core/link-key-backup.js";
import { createShareStore } from "../src/core/share-store.js";
import { reconcileAnchor } from "../src/ui/text-anchors.js";
import worker from "../backend/short-links/worker.js";
import {
  createPublishedNote,
  encodePublishedNote,
} from "../src/core/publish.js";
import { parseWorkspaceBackup } from "../src/core/backup.js";
globalThis.indexedDB = indexedDB;
const stroke = {
  id: "stroke",
  tool: "brush",
  width: 0.2,
  referenceFontSize: 40,
  points: [
    { x: 48, y: 115 },
    { x: 90, y: 120 },
  ],
};

test("old strokes keep their renderer and new brush metadata survives normalization", () => {
  assert.equal(normalizeStroke(stroke).renderer, undefined);
  const modern = normalizeStroke({
    ...stroke,
    tool: "pen",
    renderer: "smooth-v1",
    referencePaddingX: 48,
    referencePaddingY: 112,
    referenceLineHeight: 1.6,
    points: [{ x: 48, y: 115, pressure: 0.2 }],
    anchor: {
      start: 0,
      end: 4,
      text: "word",
      box: { x: 48, y: 112, width: 80, height: 50 },
    },
  });
  assert.equal(modern.tool, "pen");
  assert.equal(modern.renderer, "smooth-v1");
  assert.equal(modern.points[0].pressure, 0.2);
  assert.equal(modern.anchor.text, "word");
  assert.equal(
    normalizePage({ pinned: true, drawingDescription: "A tree" })
      .drawingDescription,
    "A tree",
  );
});
test("font scaling respects the text origin and an attached word", () => {
  assert.deepEqual(
    strokePoints(stroke, { fontSize: 80, paddingX: 48, paddingY: 48 })[0],
    { x: 48, y: 182 },
  );
  const modern = { ...stroke, referencePaddingX: 48, referencePaddingY: 112 };
  assert.equal(
    strokePoints(modern, { fontSize: 40, paddingX: 48, paddingY: 48 })[0].y,
    51,
  );
  const anchored = {
    ...stroke,
    anchor: { box: { x: 48, y: 80, width: 100, height: 50 } },
  };
  assert.equal(
    strokePoints(anchored, {
      anchorBox: { x: 72, y: 180, width: 200, height: 100 },
    })[0].x,
    72,
  );
});
test("the smooth path retains exact endpoints and intentional corners", () => {
  const calls = [],
    ctx = {
      moveTo: (...v) => calls.push(["move", ...v]),
      lineTo: (...v) => calls.push(["line", ...v]),
      quadraticCurveTo: (...v) => calls.push(["curve", ...v]),
    };
  traceStroke(
    ctx,
    [
      { x: 0, y: 0 },
      { x: 10, y: 3 },
      { x: 20, y: 10 },
      { x: 30, y: 15 },
    ],
    true,
  );
  assert.ok(calls.some((c) => c[0] === "curve"));
  assert.deepEqual(calls.at(-1), ["line", 30, 15]);
  calls.length = 0;
  traceStroke(
    ctx,
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 20 },
    ],
    true,
  );
  assert.deepEqual(calls[1], ["line", 10, 0]);
});
test("drawing edits, deletion and clear undo without touching another page", () => {
  const history = createDrawingHistory(),
    drawings = [structuredClone(stroke)],
    after = { ...stroke, color: "#123456" };
  drawings[0] = after;
  history.record("a", { kind: "update", before: stroke, after });
  assert.ok(history.undo("a", drawings));
  assert.equal(drawings[0].color, undefined);
  history.redo("a", drawings);
  assert.equal(drawings[0].color, "#123456");
  history.record("a", { kind: "replace", before: drawings, after: [] });
  drawings.length = 0;
  history.undo("a", drawings);
  assert.equal(drawings.length, 1);
  assert.equal(history.canRedo("b"), false);
});
test("scroll saves one page and retains the other content", async () => {
  const store = createWorkspaceStore({
    dbName: "scroll-" + crypto.randomUUID(),
  });
  await store.saveWorkspace({
    pages: Array.from({ length: 100 }, (_, i) => ({
      id: "p" + i,
      content: "Note " + i,
      drawings: [],
    })),
    settings: {},
    currentPageId: "p0",
  });
  const original = IDBObjectStore.prototype.put;
  let writes = 0;
  IDBObjectStore.prototype.put = function (...args) {
    if (this.name === "pages") writes++;
    return original.apply(this, args);
  };
  try {
    await store.saveScrollPosition("p0", 300);
  } finally {
    IDBObjectStore.prototype.put = original;
  }
  assert.equal(writes, 1);
  const ws = await store.readWorkspace();
  assert.equal(ws.pages[0].scrollTop, 300);
  assert.equal(ws.pages[99].content, "Note 99");
});
test("successful retry of the failed page clears its error and stores an earlier version", async () => {
  const store = createWorkspaceStore({
    dbName: "retry-" + crypto.randomUUID(),
  });
  const page = { id: "a", content: "Earlier", drawings: [] };
  await store.saveWorkspace({
    pages: [page],
    settings: {},
    currentPageId: "a",
  });
  const original = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function () {
    throw new Error("Transient storage failure");
  };
  try {
    await assert.rejects(store.savePage({ ...page, content: "Later" }, "a"));
  } finally {
    IDBDatabase.prototype.transaction = original;
  }
  assert.equal(store.hasWriteError(), true);
  await store.savePage({ ...page, content: "Later" }, "a");
  assert.equal(store.hasWriteError(), false);
  const history = await store.listPageHistory("a");
  assert.equal(history[0].page.content, "Earlier");
  assert.equal((await store.readWorkspace()).pages[0].content, "Later");
});
test("word attachments shift with insertion and detach on replacement", () => {
  const anchor = { start: 6, end: 10, text: "word" };
  assert.equal(
    reconcileAnchor(anchor, "hello word", "new hello word").start,
    10,
  );
  assert.equal(reconcileAnchor(anchor, "hello word", "hello tree"), null);
});
test("encrypted link keys exclude note payloads and reject wrong passwords and endpoints", async () => {
  const record = {
    id: "a".repeat(22),
    managementKey: "b".repeat(43),
    endpoint: "https://shares.example",
    url: "https://app.example/s/#" + "a".repeat(22),
    createdAt: new Date().toISOString(),
    state: "active",
    token: "PRIVATE NOTE PAYLOAD",
  };
  const file = await exportLinkKeys([record], "correct passphrase");
  assert.ok(!file.includes("PRIVATE"));
  assert.ok(!file.includes(record.managementKey));
  const restored = await importLinkKeys(
    file,
    "correct passphrase",
    record.endpoint,
  );
  assert.equal(restored[0].managementKey, record.managementKey);
  assert.equal(restored[0].token, undefined);
  await assert.rejects(
    importLinkKeys(file, "wrong passphrase", record.endpoint),
  );
  await assert.rejects(
    importLinkKeys(file, "correct passphrase", "https://other.example"),
  );
});
test("management-key import refuses a conflicting key atomically", async () => {
  const store = createShareStore(),
    id = crypto.randomUUID(),
    record = {
      id,
      managementKey: "original",
      createdAt: new Date().toISOString(),
    };
  await store.put(record);
  await assert.rejects(
    store.merge([
      { ...record, managementKey: "different" },
      { id: "new", createdAt: record.createdAt },
    ]),
  );
  const saved = await store.list();
  assert.equal(saved.find((r) => r.id === id).managementKey, "original");
  assert.equal(
    saved.some((r) => r.id === "new"),
    false,
  );
});
test("a full short-link budget reports capacity instead of an ID collision", async () => {
  const env = {
    WRITE_LIMITER: { limit: async () => ({ success: true }) },
    DB: {
      prepare() {
        return {
          bind() {
            return this;
          },
          first: async () => null,
        };
      },
      batch: async () => [],
    },
  };
  const token = await encodePublishedNote(
      createPublishedNote({ content: "Quota test" }, {}),
    ),
    request = new Request("https://shares.example/v1/notes/" + "a".repeat(22), {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + "b".repeat(43),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 507);
  assert.match((await response.json()).error, /storage limit/);
});
test("page order is durable without rewriting note records", async () => {
  const store = createWorkspaceStore({
    dbName: "order-" + crypto.randomUUID(),
  });
  await store.saveWorkspace({
    pages: [
      { id: "a", content: "First" },
      { id: "b", content: "Second" },
    ],
    settings: {},
    currentPageId: "a",
  });
  const original = IDBObjectStore.prototype.put;
  let writes = 0;
  IDBObjectStore.prototype.put = function (...args) {
    if (this.name === "pages") writes++;
    return original.apply(this, args);
  };
  try {
    await store.savePageOrder(["b", "a"]);
  } finally {
    IDBObjectStore.prototype.put = original;
  }
  assert.equal(writes, 0);
  assert.deepEqual(
    (await store.readWorkspace()).pages.map((p) => p.id),
    ["b", "a"],
  );
});
test("a version-one database upgrades without discarding notes or recovery snapshots", async () => {
  const name = "upgrade-" + crypto.randomUUID();
  await new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("pages", { keyPath: "id" }).put({
        id: "old",
        content: "Existing notes",
        position: 0,
      });
      db.createObjectStore("meta", { keyPath: "key" }).put({
        key: "currentPageId",
        value: "old",
      });
      db.createObjectStore("snapshots", { keyPath: "id" }).put({
        id: "old-snapshot",
        createdAt: "2026-09-01T00:00:00.000Z",
        workspace: { pages: [{ id: "old", content: "Recovery notes" }] },
      });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
  const store = createWorkspaceStore({ dbName: name });
  assert.equal(
    (await store.readWorkspace()).pages[0].content,
    "Existing notes",
  );
  assert.equal(
    (await store.listSnapshots())[0].workspace.pages[0].content,
    "Recovery notes",
  );
  await store.savePage(
    { id: "old", content: "Updated notes", drawings: [] },
    "old",
  );
  assert.equal(
    (await store.listPageHistory("old"))[0].page.content,
    "Existing notes",
  );
});
test("version-one backups remain importable while new exports use the protected format", () => {
  const backup = {
    format: "BlackboardTextWorkspace",
    schemaVersion: 1,
    workspace: {
      pages: [{ id: "old", content: "Earlier backup", drawings: [stroke] }],
    },
  };
  assert.equal(
    parseWorkspaceBackup(JSON.stringify(backup)).workspace.pages[0].content,
    "Earlier backup",
  );
  assert.equal(
    createPublishedNote({ content: "Current note" }, {}).schemaVersion,
    2,
  );
});

test("a successful recovery snapshot cannot hide a failed note write", async () => {
  const store = createWorkspaceStore({
      dbName: "scoped-error-" + crypto.randomUUID(),
    }),
    page = { id: "a", content: "Original", drawings: [] };
  await store.saveWorkspace({
    pages: [page],
    settings: {},
    currentPageId: "a",
  });
  const original = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function () {
    throw new Error("Temporary failure");
  };
  try {
    await assert.rejects(store.savePage({ ...page, content: "Unsaved" }, "a"));
  } finally {
    IDBDatabase.prototype.transaction = original;
  }
  await store.createSnapshot("Recovery checkpoint");
  assert.equal(store.hasWriteError(), true);
  await store.savePage({ ...page, content: "Unsaved" }, "a");
  assert.equal(store.hasWriteError(), false);
});
