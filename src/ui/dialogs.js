// Native dialog supplies top-layer isolation; keep Tab inside the surface,
// including the last-to-first transition that can otherwise reach browser UI.
export function bindModalDialog(dialog, close) {
  if (!dialog) return;
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    close({ restoreFocus: true });
  });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')]
      .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
    const index = controls.indexOf(document.activeElement);
    if (!controls.length) { event.preventDefault(); dialog.focus(); return; }
    if (event.shiftKey && index <= 0) {
      event.preventDefault(); controls.at(-1).focus();
    } else if (!event.shiftKey && (index < 0 || index === controls.length - 1)) {
      event.preventDefault(); controls[0].focus();
    }
  });
}
