export function createStatusAnnouncer(element) {
  let timeoutId;

  function clear() {
    if (!element) return;
    globalThis.clearTimeout(timeoutId);
    element.textContent = '';
    element.hidden = true;
    element.removeAttribute('data-kind');
  }

  return {
    show(message, { kind = 'info', duration = 5_000 } = {}) {
      if (!element) return;
      globalThis.clearTimeout(timeoutId);
      element.textContent = message;
      element.hidden = false;
      element.dataset.kind = kind;
      if (duration > 0) timeoutId = globalThis.setTimeout(clear, duration);
    },
    clear
  };
}
