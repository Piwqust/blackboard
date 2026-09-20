import { createWorkspaceId, normalizePage, normalizeWorkspace } from './schema.js';

// Merge never silently overwrites an existing page. ID conflicts are explicit.
export function mergeWorkspacePages(current, incoming, { conflicts = 'copy' } = {}) {
  const workspace = normalizeWorkspace(current);
  const source = normalizeWorkspace(incoming);
  const ids = new Set(workspace.pages.map(page => page.id));
  let added = 0;
  let skipped = 0;
  for (const page of source.pages) {
    if (ids.has(page.id) && conflicts === 'skip') { skipped += 1; continue; }
    const duplicate = ids.has(page.id);
    const copy = { ...page, id: duplicate ? createWorkspaceId() : page.id,
      title: duplicate ? (page.title || 'Untitled page') + ' (copy)' : page.title,
      position: workspace.pages.length };
    ids.add(copy.id);
    workspace.pages.push(copy);
    added += 1;
  }
  return { workspace: normalizeWorkspace(workspace), added, skipped };
}

export function recoverPageAsNew(current, source) {
  const workspace = normalizeWorkspace(current);
  const page = normalizePage({ ...source, id: createWorkspaceId(), position: workspace.pages.length,
    title: (source.title || 'Untitled page') + ' (recovered)' });
  workspace.pages.push(page);
  workspace.currentPageId = page.id;
  return normalizeWorkspace(workspace);
}

export function pageText(html, { markdown = false } = {}) {
  const root = document.createElement('template');
  root.innerHTML = html;
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    const text = [...node.childNodes].map(walk).join('');
    const tag = node.nodeName;
    if (tag === 'BR') return '\n';
    if (markdown && ['B','STRONG'].includes(tag)) return '**'+text+'**';
    if (markdown && ['I','EM'].includes(tag)) return '*'+text+'*';
    if (markdown && tag === 'A' && /^(https?:|mailto:)/i.test(node.getAttribute('href') || '')) return '['+text+']('+node.getAttribute('href')+')';
    if (markdown && /^H[1-6]$/.test(tag)) return '#'.repeat(Number(tag[1]))+' '+text+'\n';
    if (markdown && tag === 'LI') return '- '+text+'\n';
    return text + (['DIV','P','LI','H1','H2','H3','H4','PRE','BLOCKQUOTE'].includes(tag) ? '\n' : '');
  }
  return walk(root.content).replace(/\n{3,}/g,'\n\n').trimEnd();
}
