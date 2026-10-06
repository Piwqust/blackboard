// Strip anything an attacker could use to execute script if the stored
// content was ever tampered with by an external party (another extension
// writing to local storage, a buggy migration, an imported file, a published
// link someone hand-edited). Paste-into-editor is already sanitized to plain
// text, but we don't want `editor.innerHTML = page.content` to be a
// code-execution sink.

// Notes use text formatting, never active documents, SVG, forms or media.
const SAFE_TAGS = new Set(['DIV', 'P', 'BR', 'SPAN', 'B', 'STRONG', 'I', 'EM',
  'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'HR', 'SUB', 'SUP']);
const DROP_CONTENT = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'SVG', 'MATH',
  'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT']);

// `allowRemoteMedia: false` is what the published-note reader uses: a note
// someone else wrote must not be able to make the reader's browser call out to
// a third-party host, which would leak that they opened the link.
export function sanitizeStoredContent(html, { allowRemoteMedia = true } = {}) {
  if (typeof html !== 'string' || html.length === 0) {
    return '';
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  function clean(parent) {
    for (const node of Array.from(parent.children)) {
      if (DROP_CONTENT.has(node.tagName.toUpperCase())) {
        node.remove();
        continue;
      }
      clean(node);
      if (!SAFE_TAGS.has(node.tagName)) {
        node.replaceWith(...node.childNodes);
        continue;
      }
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase();
        if (name === 'href' && node.tagName === 'A') {
          // URL schemes ignore ASCII whitespace and controls.
          // eslint-disable-next-line no-control-regex
          const value = attr.value.replace(/[\u0000-\u0020\u007f]/g, '');
          if (/^(https?:|mailto:|#)/i.test(value)) continue;
        }
        if (name === 'title') continue;
        node.removeAttribute(attr.name);
      }
    }
  }
  clean(template.content);
  return template.innerHTML;
}
