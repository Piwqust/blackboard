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
    // action: { label, onClick } adds one button, such as Undo after a delete.
    show(message, { kind = 'info', duration = 5_000, action = null } = {}) {
      if (!element) return;
      globalThis.clearTimeout(timeoutId);
      element.textContent = message;
      if (action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'app-status-action';
        button.textContent = action.label;
        button.addEventListener('click', () => { clear(); action.onClick(); }, { once: true });
        element.append(' ', button);
      }
      element.hidden = false;
      element.dataset.kind = kind;
      if (duration > 0) timeoutId = globalThis.setTimeout(clear, duration);
    },
    clear
  };
}
