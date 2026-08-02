import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { indexedDB } from 'fake-indexeddb';

import {
  createWorkspaceBackup,
  parseWorkspaceBackup,
  serializeWorkspaceBackup
} from '../src/core/backup.js';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  migrateLegacyChromeWorkspace,
  normalizeWorkspace
} from '../src/core/schema.js';
import {
  MAX_PUBLISHED_BYTES,
  buildPublishedNoteUrl,
  createPublishedNote,
  decodePublishedNote,
  describePublishedLink,
  encodePublishedNote,
  readPublishedNoteToken
} from '../src/core/publish.js';
import { createWorkspaceStore } from '../src/core/workspace-store.js';

globalThis.indexedDB = indexedDB;

const drawing = {
  id: 'stroke-1',
  tool: 'brush',
  color: '#5b4fa8',
  width: 0.22,
  points: [{ x: 2, y: 3 }, { x: 8, y: 13 }],
  coordinateSpace: 'text-scaled-px',
  referenceFontSize: 40
};

test('migrates a legacy Chrome note without deleting its drawing data', () => {
  const workspace = migrateLegacyChromeWorkspace({
    pages: [{
      id: 'legacy-page',
      emoji: '📝',
      title: 'Old note',
      content: '<p>Hello</p>',
      drawings: [drawing]
    }],
    currentPageId: 'legacy-page',
    settings: { fontFamily: "'BoardGrotesque Sans', sans-serif", fontSize: 40 }
  });

  assert.equal(workspace.currentPageId, 'legacy-page');
  assert.equal(workspace.settings.fontFamily, "'BoardGrotesque Sans', sans-serif");
  assert.deepEqual(workspace.pages[0].drawings[0].points, drawing.points);
  assert.equal(workspace.pages[0].drawings[0].coordinateSpace, 'text-scaled-px');
});

test('uses the blackboard palette for new workspaces without changing a saved font choice', () => {
  const workspace = normalizeWorkspace({
    settings: { fontFamily: "'BoardGrotesque Sans', sans-serif" }
  });

  assert.equal(workspace.settings.fontFamily, "'BoardGrotesque Sans', sans-serif");
  assert.equal(workspace.settings.currentTheme, 'blackboard');
  assert.equal(workspace.settings.textColor, '#DDDAD2');
  assert.equal(workspace.settings.backgroundColor, '#0B0B0D');
  assert.equal(workspace.settings.selectionColor, '#3D47FF');
});

test('creates a portable versioned backup and restores the same pages', () => {
  const original = normalizeWorkspace({
    pages: [{ id: 'a', emoji: '✨', content: '<p>Keep this</p>', drawings: [drawing] }],
    currentPageId: 'a',
    settings: { ...DEFAULT_WORKSPACE_SETTINGS, fontSize: 52 }
  });

  const text = serializeWorkspaceBackup(original, {
    appVersion: '2.0.0-test',
    exportedAt: '2026-07-20T12:00:00.000Z'
  });
  const restored = parseWorkspaceBackup(text);

  assert.equal(restored.metadata.appVersion, '2.0.0-test');
  assert.equal(restored.workspace.currentPageId, 'a');
  assert.equal(restored.workspace.pages[0].content, '<p>Keep this</p>');
  assert.deepEqual(restored.workspace.pages[0].drawings[0].points, drawing.points);
});

test('sanitizes imported HTML through the caller-provided boundary', () => {
  const backup = createWorkspaceBackup({
    pages: [{ id: 'safe', content: '<p>Text</p><script>alert(1)</script>' }],
    currentPageId: 'safe',
    settings: DEFAULT_WORKSPACE_SETTINGS
  });

  const parsed = parseWorkspaceBackup(JSON.stringify(backup), {
    sanitizeHtml: html => html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  });

  assert.equal(parsed.workspace.pages[0].content, '<p>Text</p>');
});

test('rejects malformed and unsupported backups before workspace replacement', () => {
  assert.throws(() => parseWorkspaceBackup('not json'), /not valid JSON/);
  assert.throws(() => parseWorkspaceBackup(JSON.stringify({ format: 'wrong', schemaVersion: 1 })), /not a Blackboard Text backup/);
  assert.throws(() => parseWorkspaceBackup(JSON.stringify({
    format: 'BlackboardTextWorkspace',
    schemaVersion: 2,
    workspace: { pages: [{}] }
  })), /cannot be imported/);
});

test('carries page created/edited timestamps through a backup round trip', () => {
  const original = normalizeWorkspace({
    pages: [{
      id: 'dated',
      content: '<p>Timed</p>',
      createdAt: '2026-07-01T09:30:00.000Z',
      editedAt: '2026-07-20T18:05:00.000Z'
    }],
    currentPageId: 'dated'
  });

  assert.equal(original.pages[0].createdAt, '2026-07-01T09:30:00.000Z');
  assert.equal(original.pages[0].editedAt, '2026-07-20T18:05:00.000Z');

  const restored = parseWorkspaceBackup(serializeWorkspaceBackup(original));
  assert.equal(restored.workspace.pages[0].createdAt, '2026-07-01T09:30:00.000Z');
  assert.equal(restored.workspace.pages[0].editedAt, '2026-07-20T18:05:00.000Z');
});

test('leaves page timestamps null when they are missing or unparsable', () => {
  const workspace = normalizeWorkspace({
    pages: [
      { id: 'legacy', content: 'No dates recorded' },
      { id: 'bogus', content: 'Bad dates', createdAt: 'not a date', editedAt: 42 }
    ],
    currentPageId: 'legacy'
  });

  assert.equal(workspace.pages[0].createdAt, null);
  assert.equal(workspace.pages[0].editedAt, null);
  assert.equal(workspace.pages[1].createdAt, null);
  assert.equal(workspace.pages[1].editedAt, null);
});

test('normalizes duplicate page ids so an imported backup cannot overwrite a sibling page', () => {
  const workspace = normalizeWorkspace({
    pages: [{ id: 'same', content: 'first' }, { id: 'same', content: 'second' }],
    currentPageId: 'same'
  });

  assert.equal(workspace.pages.length, 2);
  assert.notEqual(workspace.pages[0].id, workspace.pages[1].id);
});

test('keeps a recovery snapshot before a workspace replacement and restores it', async () => {
  const store = createWorkspaceStore({ dbName: `blackboard-text-test-${Date.now()}-${Math.random()}`, maxSnapshots: 7 });
  const original = normalizeWorkspace({
    pages: [
      { id: 'first', content: '<p>First page</p>', drawings: [drawing] },
      { id: 'second', content: '<p>Second page</p>' }
    ],
    currentPageId: 'second',
    settings: DEFAULT_WORKSPACE_SETTINGS
  });
  const imported = normalizeWorkspace({
    pages: [{ id: 'imported', content: '<p>Imported replacement</p>' }],
    currentPageId: 'imported',
    settings: { ...DEFAULT_WORKSPACE_SETTINGS, fontSize: 52 }
  });

  await store.saveWorkspace(original);
  await store.replaceWorkspaceWithSnapshot(imported, 'Before backup import');

  const afterImport = await store.readWorkspace();
  assert.equal(afterImport.pages.length, 1);
  assert.equal(afterImport.pages[0].content, '<p>Imported replacement</p>');

  const [snapshot] = await store.listSnapshots();
  assert.equal(snapshot.label, 'Before backup import');
  assert.equal(snapshot.workspace.pages[1].content, '<p>Second page</p>');

  const restored = await store.restoreSnapshot(snapshot.id);
  assert.equal(restored.currentPageId, 'second');
  assert.equal(restored.pages.length, 2);
  assert.deepEqual(restored.pages[0].drawings[0].points, drawing.points);
});

// --- Publishing a page as a link ------------------------------------------

const publishedPage = {
  id: 'publish-me',
  emoji: '🌱',
  title: 'Shared note',
  content: '<div>Hello reader</div>',
  drawings: [drawing],
  createdAt: '2026-07-01T09:30:00.000Z',
  editedAt: '2026-07-20T18:05:00.000Z'
};

test('publishes a page into a link and reads the same note back', async () => {
  const note = createPublishedNote(publishedPage, { ...DEFAULT_WORKSPACE_SETTINGS, fontSize: 52 }, {
    appVersion: '2.2.0-test',
    publishedAt: '2026-08-02T10:00:00.000Z',
    boardWidth: 1440
  });

  const token = await encodePublishedNote(note);
  const decoded = await decodePublishedNote(token);

  assert.equal(decoded.appVersion, '2.2.0-test');
  assert.equal(decoded.publishedAt, '2026-08-02T10:00:00.000Z');
  assert.equal(decoded.note.title, 'Shared note');
  assert.equal(decoded.note.emoji, '🌱');
  assert.equal(decoded.note.content, '<div>Hello reader</div>');
  assert.equal(decoded.view.fontSize, 52);
  assert.equal(decoded.board.width, 1440);
  assert.equal(decoded.note.drawings.length, 1);
  assert.equal(decoded.note.drawings[0].tool, 'brush');
  assert.equal(decoded.note.drawings[0].referenceFontSize, drawing.referenceFontSize);
});

test('keeps published stroke geometry within a pixel of the original', async () => {
  const preciseDrawing = {
    ...drawing,
    points: [{ x: 12.345678, y: 400.987654 }, { x: 900.123456, y: 3.14159 }]
  };
  const token = await encodePublishedNote(
    createPublishedNote({ ...publishedPage, drawings: [preciseDrawing] }, DEFAULT_WORKSPACE_SETTINGS, { boardWidth: 1200 })
  );
  const decoded = await decodePublishedNote(token);

  decoded.note.drawings[0].points.forEach((point, index) => {
    assert.ok(Math.abs(point.x - preciseDrawing.points[index].x) < 0.01);
    assert.ok(Math.abs(point.y - preciseDrawing.points[index].y) < 0.01);
  });
});

test('leaves drawings out of the link when they were not included', async () => {
  const withDrawings = await encodePublishedNote(
    createPublishedNote(publishedPage, DEFAULT_WORKSPACE_SETTINGS, { boardWidth: 1200 })
  );
  const withoutDrawings = await encodePublishedNote(
    createPublishedNote(publishedPage, DEFAULT_WORKSPACE_SETTINGS, { boardWidth: 1200, includeDrawings: false })
  );

  assert.equal((await decodePublishedNote(withoutDrawings)).note.drawings.length, 0);
  assert.ok(withoutDrawings.length < withDrawings.length);
});

test('sanitizes a published note through the caller-provided boundary', async () => {
  const token = await encodePublishedNote(
    createPublishedNote({ ...publishedPage, content: '<p>Text</p><script>alert(1)</script>' }, DEFAULT_WORKSPACE_SETTINGS)
  );

  const decoded = await decodePublishedNote(token, {
    sanitizeHtml: html => html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  });

  assert.equal(decoded.note.content, '<p>Text</p>');
});

test('refuses links that are not published Blackboard notes', async () => {
  const foreign = await encodePublishedNote({ format: 'SomethingElse', schemaVersion: 1 });
  const future = await encodePublishedNote({ format: 'BlackboardTextNote', schemaVersion: 99 });

  await assert.rejects(decodePublishedNote(foreign), /not a published Blackboard note/);
  await assert.rejects(decodePublishedNote(future), /newer version/);
  await assert.rejects(decodePublishedNote('1z!!!not-base64!!!'), /not a complete Blackboard note/);
  await assert.rejects(decodePublishedNote('xxbm90ZQ'), /different version/);
  await assert.rejects(decodePublishedNote(''), /does not contain a note/);
});

test('refuses a published note that would expand past the size ceiling', async () => {
  // Built by hand rather than through encodePublishedNote, which refuses to
  // make an oversized link in the first place: this is the reader's own guard
  // against a link that compresses small and expands enormously.
  const oversized = JSON.stringify(
    createPublishedNote({ ...publishedPage, content: 'x'.repeat(MAX_PUBLISHED_BYTES + 1_000) }, DEFAULT_WORKSPACE_SETTINGS)
  );
  const hostile = `1z${gzipSync(Buffer.from(oversized, 'utf8')).toString('base64url')}`;

  await assert.rejects(decodePublishedNote(hostile), /too large to open/);
});

test('builds a reader URL beside the app and reads its token back', async () => {
  const token = await encodePublishedNote(createPublishedNote(publishedPage, DEFAULT_WORKSPACE_SETTINGS));

  const url = buildPublishedNoteUrl('https://example.github.io/blackboard/editor.html?x=1#stale', token);
  assert.ok(url.startsWith('https://example.github.io/blackboard/read.html#n='));
  assert.equal(readPublishedNoteToken(new URL(url).hash), token);
  assert.equal(readPublishedNoteToken(''), null);
  assert.equal(readPublishedNoteToken('#other=1'), null);
});

test('grades link length so the dialog can warn before a chat app truncates it', () => {
  assert.equal(describePublishedLink('https://example.com/#n=' + 'a'.repeat(100)).tier, 'ok');
  assert.equal(describePublishedLink('a'.repeat(9_000)).tier, 'long');
  assert.equal(describePublishedLink('a'.repeat(20_000)).tier, 'very-long');
});
