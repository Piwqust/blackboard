function createToken() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function acquireLocalStorageLock(name) {
  const storage = globalThis.localStorage;
  const key = `blackboard-text:writer:${name}`;
  const token = createToken();
  const leaseMs = 12_000;
  const now = Date.now();

  try {
    const existing = JSON.parse(storage.getItem(key) || 'null');
    if (existing?.expiresAt > now && existing.token !== token) {
      return { acquired: false, reason: 'another-tab' };
    }

    storage.setItem(key, JSON.stringify({ token, expiresAt: now + leaseMs }));
    const confirmed = JSON.parse(storage.getItem(key) || 'null');
    if (confirmed?.token !== token) return { acquired: false, reason: 'another-tab' };
  } catch (error) {
    return { acquired: false, reason: 'storage-unavailable' };
  }

  const refresh = () => {
    try {
      storage.setItem(key, JSON.stringify({ token, expiresAt: Date.now() + leaseMs }));
    } catch (error) {
      // The browser's Locks API is used in supported Chrome/Edge builds. This
      // fallback deliberately fails closed if localStorage becomes unavailable.
    }
  };
  const interval = globalThis.setInterval(refresh, Math.floor(leaseMs / 3));

  return {
    acquired: true,
    release() {
      globalThis.clearInterval(interval);
      try {
        const current = JSON.parse(storage.getItem(key) || 'null');
        if (current?.token === token) storage.removeItem(key);
      } catch (error) {
        // Nothing else to clean up.
      }
    }
  };
}

export async function acquireWorkspaceLock(name = 'blackboard-text') {
  const lockManager = globalThis.navigator?.locks;
  if (!lockManager?.request) return acquireLocalStorageLock(name);

  let releaseHold;
  let resolveAcquired;
  const hold = new Promise(resolve => {
    releaseHold = resolve;
  });
  const acquired = new Promise(resolve => {
    resolveAcquired = resolve;
  });

  try {
    void lockManager.request(name, { mode: 'exclusive', ifAvailable: true }, lock => {
      if (!lock) {
        resolveAcquired(null);
        return undefined;
      }

      resolveAcquired({
        acquired: true,
        release() {
          releaseHold();
        }
      });
      return hold;
    }).catch(error => resolveAcquired({ acquired: false, reason: 'lock-error', error }));
  } catch (error) {
    return acquireLocalStorageLock(name);
  }

  return (await acquired) || { acquired: false, reason: 'another-tab' };
}

export function createWorkspaceChannel(name = 'blackboard-text') {
  if (!globalThis.BroadcastChannel) {
    return { post() {}, close() {}, onMessage() {} };
  }

  const channel = new globalThis.BroadcastChannel(`${name}:events`);
  return {
    post(type, detail = {}) {
      channel.postMessage({ type, detail, sentAt: Date.now() });
    },
    onMessage(listener) {
      const handler = event => listener(event.data);
      channel.addEventListener('message', handler);
      return () => channel.removeEventListener('message', handler);
    },
    close() {
      channel.close();
    }
  };
}
