import test from 'node:test';
import assert from 'node:assert/strict';
import {newShareCredentials, shortLinkUrl, shortLinkId} from '../src/core/short-links.js';
import {createShareStore} from '../src/core/share-store.js';
import {indexedDB} from 'fake-indexeddb';
globalThis.indexedDB = indexedDB;

test('short URLs keep the GitHub Pages project prefix and no management key', () => {
  const credentials = newShareCredentials();
  const url = shortLinkUrl('https://piwqust.github.io/blackboard/editor.html', credentials.id);
  assert.equal(new URL(url).pathname, '/blackboard/s/');
  assert.equal(new URL(url).hash, '#'+credentials.id);
  assert.ok(url.length < 75);
  assert.ok(!url.includes(credentials.managementKey));
  assert.equal(shortLinkId({search:'?s='+credentials.id}),credentials.id);
  assert.throws(()=>shortLinkId({search:'?s=broken'}));
});

test('management details persist before publication in a separate database', async () => {
  const store = createShareStore();
  const record = {...newShareCredentials(), token:'example', createdAt:new Date().toISOString(), state:'pending'};
  await store.put(record);
  const loaded = (await createShareStore().list()).find(r=>r.id===record.id);
  assert.deepEqual(loaded,record);
  await store.put({...record, state:'revoked', token:undefined});
  assert.equal((await store.list())[0].state,'revoked');
});
