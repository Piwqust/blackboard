import assert from 'node:assert/strict';
import test from 'node:test';
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
