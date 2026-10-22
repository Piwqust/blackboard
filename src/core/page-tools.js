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

const BLOCK_TAGS = new Set(['DIV','P','LI','UL','OL','H1','H2','H3','H4','H5','H6','PRE','BLOCKQUOTE']);

export function pageText(html, { markdown = false } = {}) {
  const root = document.createElement('template');
  root.innerHTML = html;
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    // contenteditable keeps the first line as a bare text node and wraps the
    // following lines in blocks, so a block must also start on its own line.
    let text = '';
    for (const child of node.childNodes) {
      const part = walk(child);
      if (BLOCK_TAGS.has(child.nodeName) && text && !text.endsWith('\n')) text += '\n';
      text += part;
    }
    const tag = node.nodeName;
    if (tag === 'BR') return '\n';
    if (markdown && ['B','STRONG'].includes(tag)) return '**'+text+'**';
    if (markdown && ['I','EM'].includes(tag)) return '*'+text+'*';
    if (markdown && tag === 'A' && /^(https?:|mailto:)/i.test(node.getAttribute('href') || '')) return '['+text+']('+node.getAttribute('href')+')';
    if (markdown && /^H[1-6]$/.test(tag)) return '#'.repeat(Number(tag[1]))+' '+text+'\n';
    if (markdown && tag === 'LI') return '- '+text+'\n';
    return text + (BLOCK_TAGS.has(tag) && !['UL','OL'].includes(tag) ? '\n' : '');
  }
  return walk(root.content).replace(/\n{3,}/g,'\n\n').trimEnd();
}

// File name for an exported page: its name, else its first line of text.
export function pageFileName(page, fallback = 'Blackboard note') {
  const name = (page?.title || '').trim() || pageText(page?.content || '').split('\n', 1)[0].trim() || fallback;
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}
