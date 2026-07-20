const DB_VERSION = 1;
const PAGES_STORE = 'pages';
const META_STORE = 'meta';
const SNAPSHOTS_STORE = 'snapshots';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error || new Error('IndexedDB request failed.')), { once: true });
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', resolve, { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('IndexedDB transaction was aborted.')), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error || new Error('IndexedDB transaction failed.')), { once: true });
  });
}

function copy(value) {
  return globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function stripStorageMetadata(record) {
  const { position, updatedAt, ...page } = record;
  return { ...page, position };
}

function snapshotId() {
  return globalThis.crypto?.randomUUID?.() || `snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createWorkspaceStore({ dbName = 'blackboard-text', maxSnapshots = 7 } = {}) {
  let databasePromise;
  let writeTail = Promise.resolve();

  function openDatabase() {
    if (databasePromise) return databasePromise;
    if (!globalThis.indexedDB) {
      return Promise.reject(new Error('IndexedDB is unavailable in this browser profile.'));
    }

    databasePromise = new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(dbName, DB_VERSION);
      request.addEventListener('upgradeneeded', () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PAGES_STORE)) db.createObjectStore(PAGES_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) db.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'id' });
      });
      request.addEventListener('success', () => {
        const db = request.result;
        db.addEventListener('versionchange', () => db.close());
        resolve(db);
      }, { once: true });
      request.addEventListener('error', () => reject(request.error || new Error('Could not open local storage.')), { once: true });
    });

    return databasePromise;
  }

  function enqueue(task) {
    const result = writeTail.then(task);
    writeTail = result.catch(() => undefined);
    return result;
  }

  async function readWorkspaceNow() {
    const db = await openDatabase();
    const transaction = db.transaction([PAGES_STORE, META_STORE], 'readonly');
    const pagesRequest = transaction.objectStore(PAGES_STORE).getAll();
    const settingsRequest = transaction.objectStore(META_STORE).get('settings');
    const currentPageRequest = transaction.objectStore(META_STORE).get('currentPageId');
    const [storedPages, settingsRecord, currentPageRecord] = await Promise.all([
      requestResult(pagesRequest),
      requestResult(settingsRequest),
      requestResult(currentPageRequest),
      transactionComplete(transaction)
    ]);

    const pages = storedPages
      .sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
      .map(stripStorageMetadata);

    return {
      pages,
      settings: settingsRecord?.value ?? null,
      currentPageId: currentPageRecord?.value ?? null
    };
  }

  async function replaceWorkspaceNow(workspace) {
    const db = await openDatabase();
    const transaction = db.transaction([PAGES_STORE, META_STORE], 'readwrite');
    const pagesStore = transaction.objectStore(PAGES_STORE);
    const metaStore = transaction.objectStore(META_STORE);
    const pageKeysRequest = pagesStore.getAllKeys();
    const now = new Date().toISOString();

    pageKeysRequest.addEventListener('success', () => {
      const wantedIds = new Set(workspace.pages.map(page => page.id));
      pageKeysRequest.result.forEach(id => {
        if (!wantedIds.has(id)) pagesStore.delete(id);
      });
      workspace.pages.forEach((page, position) => {
        pagesStore.put({ ...copy(page), position, updatedAt: now });
      });
      metaStore.put({ key: 'settings', value: copy(workspace.settings) });
      metaStore.put({ key: 'currentPageId', value: workspace.currentPageId });
      metaStore.put({ key: 'schemaVersion', value: 1 });
    }, { once: true });

    await transactionComplete(transaction);
  }

  async function savePageNow(page, currentPageId) {
    const db = await openDatabase();
    const transaction = db.transaction([PAGES_STORE, META_STORE], 'readwrite');
    const pagesStore = transaction.objectStore(PAGES_STORE);
    const metaStore = transaction.objectStore(META_STORE);
    const existingRequest = pagesStore.get(page.id);
    const now = new Date().toISOString();

    existingRequest.addEventListener('success', () => {
      const position = Number.isInteger(page.position)
        ? page.position
        : (existingRequest.result?.position ?? 0);
      pagesStore.put({ ...copy(page), position, updatedAt: now });
      if (typeof currentPageId === 'string') {
        metaStore.put({ key: 'currentPageId', value: currentPageId });
      }
    }, { once: true });

    await transactionComplete(transaction);
  }

  async function saveSettingsNow(settings) {
    const db = await openDatabase();
    const transaction = db.transaction(META_STORE, 'readwrite');
    transaction.objectStore(META_STORE).put({ key: 'settings', value: copy(settings) });
    await transactionComplete(transaction);
  }

  async function saveCurrentPageIdNow(currentPageId) {
    const db = await openDatabase();
    const transaction = db.transaction(META_STORE, 'readwrite');
    transaction.objectStore(META_STORE).put({ key: 'currentPageId', value: currentPageId });
    await transactionComplete(transaction);
  }

  async function createSnapshotNow(label, workspace) {
    const db = await openDatabase();
    const transaction = db.transaction(SNAPSHOTS_STORE, 'readwrite');
    const store = transaction.objectStore(SNAPSHOTS_STORE);
    const allRequest = store.getAll();
    const snapshot = {
      id: snapshotId(),
      label,
      createdAt: new Date().toISOString(),
      workspace: copy(workspace)
    };

    allRequest.addEventListener('success', () => {
      const existing = allRequest.result.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      existing.slice(Math.max(0, maxSnapshots - 1)).forEach(item => store.delete(item.id));
      store.put(snapshot);
    }, { once: true });

    await transactionComplete(transaction);
    return snapshot;
  }

  return {
    readWorkspace: () => writeTail.then(readWorkspaceNow),
    saveWorkspace: workspace => enqueue(() => replaceWorkspaceNow(workspace)),
    savePage: (page, currentPageId) => enqueue(() => savePageNow(page, currentPageId)),
    saveSettings: settings => enqueue(() => saveSettingsNow(settings)),
    saveCurrentPageId: currentPageId => enqueue(() => saveCurrentPageIdNow(currentPageId)),
    createSnapshot: (label, workspace) => enqueue(async () => {
      const source = workspace || await readWorkspaceNow();
      return createSnapshotNow(label, source);
    }),
    replaceWorkspaceWithSnapshot: (workspace, label = 'Before import') => enqueue(async () => {
      const currentWorkspace = await readWorkspaceNow();
      const snapshot = await createSnapshotNow(label, currentWorkspace);
      await replaceWorkspaceNow(workspace);
      return snapshot;
    }),
    listSnapshots: () => writeTail.then(async () => {
      const db = await openDatabase();
      const transaction = db.transaction(SNAPSHOTS_STORE, 'readonly');
      const snapshots = await requestResult(transaction.objectStore(SNAPSHOTS_STORE).getAll());
      await transactionComplete(transaction);
      return snapshots.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    }),
    restoreSnapshot: snapshotIdToRestore => enqueue(async () => {
      const db = await openDatabase();
      const transaction = db.transaction(SNAPSHOTS_STORE, 'readonly');
      const snapshot = await requestResult(transaction.objectStore(SNAPSHOTS_STORE).get(snapshotIdToRestore));
      await transactionComplete(transaction);
      if (!snapshot?.workspace) throw new Error('That recovery snapshot is no longer available.');
      await replaceWorkspaceNow(snapshot.workspace);
      return copy(snapshot.workspace);
    }),
    flush: () => writeTail
  };
}
