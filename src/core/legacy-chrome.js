import { migrateLegacyChromeWorkspace } from './schema.js';

function hasChromeStorage() {
  return Boolean(globalThis.chrome?.storage?.local && globalThis.chrome?.storage?.sync);
}

async function getStorage(area, keys) {
  try {
    return await area.get(keys);
  } catch (initialError) {
    return new Promise((resolve, reject) => {
      try {
        area.get(keys, result => {
          const runtimeError = globalThis.chrome?.runtime?.lastError;
          if (runtimeError) reject(new Error(runtimeError.message));
          else resolve(result || {});
        });
      } catch (fallbackError) {
        reject(initialError || fallbackError);
      }
    });
  }
}

export function isExtensionContext() {
  return Boolean(globalThis.chrome?.runtime?.id) || /-extension:$/.test(globalThis.location?.protocol || '');
}

export async function readLegacyChromeWorkspace(options = {}) {
  if (!hasChromeStorage()) return null;

  const [local, sync] = await Promise.all([
    getStorage(globalThis.chrome.storage.local, ['pages', 'currentPageId', 'noteContent']),
    getStorage(globalThis.chrome.storage.sync, ['settings'])
  ]);

  const hasPages = Array.isArray(local.pages) && local.pages.length > 0;
  const hasNote = typeof local.noteContent === 'string' && local.noteContent.length > 0;
  const hasSettings = Boolean(sync.settings && typeof sync.settings === 'object');
  if (!hasPages && !hasNote && !hasSettings) return null;

  return migrateLegacyChromeWorkspace({
    pages: local.pages,
    currentPageId: local.currentPageId,
    noteContent: local.noteContent,
    settings: sync.settings
  }, options);
}
