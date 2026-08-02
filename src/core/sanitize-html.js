// Strip anything an attacker could use to execute script if the stored
// content was ever tampered with by an external party (another extension
// writing to local storage, a buggy migration, an imported file, a published
// link someone hand-edited). Paste-into-editor is already sanitized to plain
// text, but we don't want `editor.innerHTML = page.content` to be a
// code-execution sink.
const UNSAFE_TAGS = new Set([
  'SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'STYLE',
  'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'OPTION'
]);
const UNSAFE_URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);
const MEDIA_URL_ATTRS = new Set(['src', 'xlink:href']);

function isRemoteUrl(value) {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.startsWith('#')) return false;
  if (/^(data|blob):/i.test(trimmed)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return true;
  // Protocol-relative URLs (//example.com/x.png) also leave this origin.
  return trimmed.startsWith('//');
}

// `allowRemoteMedia: false` is what the published-note reader uses: a note
// someone else wrote must not be able to make the reader's browser call out to
// a third-party host, which would leak that they opened the link.
export function sanitizeStoredContent(html, { allowRemoteMedia = true } = {}) {
  if (typeof html !== 'string' || html.length === 0) {
    return '';
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  const doomed = [];
  let node = walker.nextNode();

  while (node) {
    if (UNSAFE_TAGS.has(node.tagName)) {
      doomed.push(node);
    } else {
      // Drop inline event handlers (onclick, onerror, …) and javascript: URLs.
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) {
          node.removeAttribute(attr.name);
          continue;
        }
        if (UNSAFE_URL_ATTRS.has(name)) {
          const value = attr.value.trim().toLowerCase();
          if (value.startsWith('javascript:') || value.startsWith('data:text/html')) {
            node.removeAttribute(attr.name);
            continue;
          }
          if (!allowRemoteMedia && MEDIA_URL_ATTRS.has(name) && isRemoteUrl(attr.value)) {
            node.removeAttribute(attr.name);
          }
        }
      }
    }
    node = walker.nextNode();
  }

  doomed.forEach(el => el.remove());
  return template.innerHTML;
}
