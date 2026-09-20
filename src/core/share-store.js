// Separate from portable workspace backups: management keys must not travel
// to a recipient who receives a note or a workspace export.
export function createShareStore() {
  let database;
  async function open() {
    if (!database) database = new Promise((resolve, reject) => {
      const request = indexedDB.open('blackboard-text-share-management', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('links', {keyPath: 'id'});
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {database = null;reject(request.error);};
    });
    return database;
  }
  async function transact(mode, run) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('links', mode);
      const request = run(transaction.objectStore('links'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error || new Error('Could not save link management details.'));
      transaction.onerror = () => reject(transaction.error || new Error('Could not save link management details.'));
    });
  }
  return {
    put(record) {return transact('readwrite', store => store.put(structuredClone(record)));},
    async list() {return (await transact('readonly', store => store.getAll())).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  };
}
