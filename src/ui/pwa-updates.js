import { isExtensionContext } from '../core/legacy-chrome.js';

function canRegisterServiceWorker() {
  const protocol = globalThis.location?.protocol;
  const hostname = globalThis.location?.hostname;
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
  return !isExtensionContext() && Boolean(globalThis.navigator?.serviceWorker) && (protocol === 'https:' || local);
}

export function registerPwaUpdates({ onUpdateReady, onControllerChange, onError } = {}) {
  if (!canRegisterServiceWorker()) return null;

  let registration;
  let updateRequested = false;
  const hasExistingController = Boolean(globalThis.navigator.serviceWorker.controller);
  const announceWaitingWorker = () => {
    // A first install becomes the controller through clients.claim(), so use
    // the state from before registration rather than testing controller later.
    // Only a page that already had a controller can be receiving an update.
    if (!registration?.waiting || !hasExistingController) return;
    onUpdateReady?.({
      apply() {
        updateRequested = true;
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  };
  const watchInstallingWorker = worker => {
    if (!worker) return;
    const changed = () => {
      if (worker.state === 'installed' && globalThis.navigator.serviceWorker.controller) {
        announceWaitingWorker();
      }
    };
    worker.addEventListener('statechange', changed);
    changed();
  };

  const ready = globalThis.navigator.serviceWorker.register('./pwa-sw.js', { scope: './' })
    .then(nextRegistration => {
      registration = nextRegistration;
      announceWaitingWorker();
      registration.addEventListener('updatefound', () => watchInstallingWorker(registration.installing));
      watchInstallingWorker(registration.installing);
      return registration;
    })
    .catch(error => {
      onError?.(error);
      return null;
    });

  globalThis.navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateRequested) onControllerChange?.();
  });

  return {
    ready,
    applyUpdate() {
      updateRequested = true;
      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    }
  };
}
