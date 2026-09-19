// Strip anything an attacker could use to execute script if the stored
// content was ever tampered with by an external party (another extension
// writing to local storage, a buggy migration, an imported file, a published
// link someone hand-edited). Paste-into-editor is already sanitized to plain
// text, but we don't want `editor.innerHTML = page.content` to be a
// code-execution sink.

// Elements we never allow regardless of context.
const UNSAFE_TAGS = new Set([
  'SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'STYLE',
  'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'OPTION'
]);

// Attributes that may contain URLs requiring protocol validation.
const URL_ATTRS = new Set([
  'href', 'src', 'action', 'formaction', 'xlink:href',
  'poster', 'srcset', 'cite', 'data', 'codebase', 'longdesc'
]);

// Attributes that can trigger network requests in reader context.
const MEDIA_URL_ATTRS = new Set([
  'src', 'xlink:href', 'poster', 'srcset', 'cite', 'data'
]);

// Dangerous protocols that allow script execution.
const DANGEROUS_PROTOCOLS = new Set([
  'javascript:', 'data:text/html', 'vbscript:', 'file:'
]);

// Properties that give us the normalized, browser-parsed URL.
const URL_PROPERTIES = { href: 'href', src: 'src', 'xlink:href': 'href' };

function isRemoteUrl(value) {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.startsWith('#')) return false;
  if (/^(data|blob):/i.test(trimmed)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return true;
  // Protocol-relative URLs (//example.com/x.png) also leave this origin.
  return trimmed.startsWith('//');
}

// Check if a URL (after browser normalization) uses a dangerous protocol.
// We must check the *normalized* URL because browsers will transform
// "java\nscript:" into "javascript:" after parsing.
function hasDangerousProtocol(element, attrName) {
  // For href/src, read the normalized property.
  const propName = URL_PROPERTIES[attrName];
  if (propName && element[propName]) {
    const normalized = String(element[propName]).trim().toLowerCase();
    for (const proto of DANGEROUS_PROTOCOLS) {
      if (normalized.startsWith(proto)) return true;
    }
  }
  
  // For other attributes, check the raw value for protocols.
  const raw = element.getAttribute(attrName);
  if (!raw) return false;
  const cleaned = raw.replace(/[\s\x00-\x1f]/g, '').trim().toLowerCase();
  for (const proto of DANGEROUS_PROTOCOLS) {
    if (cleaned.startsWith(proto)) return true;
  }
  return false;
}

// Parse srcset and check if any URL is remote.
function srcsetHasRemoteUrl(srcsetValue) {
  const candidates = srcsetValue.split(',').map(s => s.trim().split(/\s+/)[0]);
  return candidates.some(url => isRemoteUrl(url));
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
      // Drop inline event handlers (onclick, onerror, …).
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase();
        
        // Remove any on* event handler attributes.
        if (name.startsWith('on')) {
          node.removeAttribute(attr.name);
          continue;
        }
        
        // Check URL attributes for dangerous protocols.
        if (URL_ATTRS.has(name)) {
          if (hasDangerousProtocol(node, name)) {
            node.removeAttribute(attr.name);
            continue;
          }
        }
        
        // In reader mode, block remote resources.
        if (!allowRemoteMedia) {
          // Block style attribute (can contain url() with remote resources).
          if (name === 'style') {
            node.removeAttribute(attr.name);
            continue;
          }
          
          // Block remote URLs in media attributes.
          if (MEDIA_URL_ATTRS.has(name)) {
            if (name === 'srcset' && srcsetHasRemoteUrl(attr.value)) {
              node.removeAttribute(attr.name);
            } else if (name !== 'srcset' && isRemoteUrl(attr.value)) {
              node.removeAttribute(attr.name);
            }
          }
        }
      }
    }
    node = walker.nextNode();
  }

  doomed.forEach(el => el.remove());
  return template.innerHTML;
}
