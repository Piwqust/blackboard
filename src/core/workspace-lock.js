export async function acquireWorkspaceLock(name = 'blackboard-text') {
  const lockManager = globalThis.navigator?.locks;
  if (!lockManager?.request) return { acquired: false, reason: 'unsupported-locks' };

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
    return { acquired: false, reason: 'unsupported-locks' };
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
