export const WORKSPACE_FORMAT = 'BlackboardTextWorkspace';
export const WORKSPACE_SCHEMA_VERSION = 1;
export const MAX_PAGE_TITLE_LENGTH = 80;
export const MAX_BACKUP_PAGES = 10_000;

export const DEFAULT_WORKSPACE_SETTINGS = Object.freeze({
  fontFamily: "'Inter Tight', sans-serif",
  fontSize: 40,
  lineHeight: 1.6,
  letterSpacing: 0,
  maxWidth: 1600,
  drawSize: 4 / 18,
  drawColor: '#DDDAD2',
  drawColorMode: 'theme',
  textColor: '#DDDAD2',
  backgroundColor: '#0B0B0D',
  selectionColor: '#3D47FF',
  currentTheme: 'blackboard'
});

const BOARD_GROTESK_FONT_FAMILY = "'BoardGrotesque Sans', sans-serif";
const LEGACY_BOARD_GROTESK_PATTERN = /boardgrotesque|unica\s*77/i;

function finiteNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function createWorkspaceId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function normalizeHex(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed.slice(1).split('').map(char => char + char).join('')}`.toUpperCase();
  }
  return fallback;
}

export function migrateFontFamily(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return DEFAULT_WORKSPACE_SETTINGS.fontFamily;
  }

  return LEGACY_BOARD_GROTESK_PATTERN.test(value)
    ? BOARD_GROTESK_FONT_FAMILY
    : value;
}

export function normalizeSettings(input = {}, defaults = DEFAULT_WORKSPACE_SETTINGS) {
  const source = input && typeof input === 'object' ? input : {};
  const baseline = { ...DEFAULT_WORKSPACE_SETTINGS, ...defaults };
  const textColor = normalizeHex(source.textColor, baseline.textColor);
  const selectionFallback = source.selectionColor === undefined && source.textColor === undefined
    ? baseline.selectionColor
    : textColor;

  return {
    fontFamily: migrateFontFamily(source.fontFamily ?? baseline.fontFamily),
    fontSize: finiteNumber(source.fontSize, baseline.fontSize, 12, 128),
    lineHeight: finiteNumber(source.lineHeight, baseline.lineHeight, 1, 3),
    letterSpacing: finiteNumber(source.letterSpacing, baseline.letterSpacing, -0.05, 0.2),
    maxWidth: finiteNumber(source.maxWidth, baseline.maxWidth, 400, 2400),
    drawSize: finiteNumber(source.drawSize, baseline.drawSize, 0.08, 1.4),
    drawColor: normalizeHex(source.drawColor, textColor),
    drawColorMode: source.drawColorMode === 'custom' ? 'custom' : 'theme',
    textColor,
    backgroundColor: normalizeHex(source.backgroundColor, baseline.backgroundColor),
    selectionColor: normalizeHex(source.selectionColor, selectionFallback),
    currentTheme: typeof source.currentTheme === 'string' && source.currentTheme.trim()
      ? source.currentTheme.trim().slice(0, 40)
      : baseline.currentTheme
  };
}

function normalizePoint(point) {
  if (!point || typeof point !== 'object') return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function normalizeStroke(stroke = {}, fallbackFontSize = DEFAULT_WORKSPACE_SETTINGS.fontSize) {
  const source = stroke && typeof stroke === 'object' ? stroke : {};
  const points = Array.isArray(source.points)
    ? source.points.map(normalizePoint).filter(Boolean)
    : [];

  return {
    id: typeof source.id === 'string' && source.id ? source.id : createWorkspaceId(),
    tool: source.tool === 'eraser' ? 'eraser' : 'brush',
    color: normalizeHex(source.color, DEFAULT_WORKSPACE_SETTINGS.drawColor),
    width: finiteNumber(source.width, DEFAULT_WORKSPACE_SETTINGS.drawSize, 0.01, 128),
    points,
    coordinateSpace: typeof source.coordinateSpace === 'string' && source.coordinateSpace
      ? source.coordinateSpace
      : 'text-scaled-px',
    referenceFontSize: finiteNumber(source.referenceFontSize, fallbackFontSize, 1, 512)
  };
}

export function normalizePage(page = {}, {
  index = 0,
  fontSize = DEFAULT_WORKSPACE_SETTINGS.fontSize,
  sanitizeHtml = value => value
} = {}) {
  const source = page && typeof page === 'object' ? page : {};
  const content = typeof source.content === 'string' ? source.content : '';
  const sanitizedContent = typeof sanitizeHtml === 'function' ? sanitizeHtml(content) : content;
  const title = typeof source.title === 'string' ? source.title : '';

  return {
    id: typeof source.id === 'string' && source.id ? source.id : createWorkspaceId(),
    emoji: typeof source.emoji === 'string' ? source.emoji.slice(0, 16) : '📝',
    title: title.slice(0, MAX_PAGE_TITLE_LENGTH),
    content: typeof sanitizedContent === 'string' ? sanitizedContent : '',
    drawings: Array.isArray(source.drawings)
      ? source.drawings.map(stroke => normalizeStroke(stroke, fontSize))
      : [],
    scrollTop: finiteNumber(source.scrollTop, 0, 0, Number.MAX_SAFE_INTEGER),
    position: Number.isInteger(source.position) && source.position >= 0 ? source.position : index
  };
}

export function normalizeWorkspace(workspace = {}, options = {}) {
  const source = workspace && typeof workspace === 'object' ? workspace : {};
  const settings = normalizeSettings(source.settings, options.defaults);
  const rawPages = Array.isArray(source.pages) ? source.pages : [];

  if (rawPages.length > MAX_BACKUP_PAGES) {
    throw new Error(`A backup can contain at most ${MAX_BACKUP_PAGES.toLocaleString('en-US')} pages.`);
  }

  const seenIds = new Set();
  const pages = rawPages.map((page, index) => {
    const normalized = normalizePage(page, {
      ...options,
      index,
      fontSize: settings.fontSize
    });
    if (seenIds.has(normalized.id)) normalized.id = createWorkspaceId();
    seenIds.add(normalized.id);
    return normalized;
  }).sort((a, b) => a.position - b.position);

  const requestedCurrentPageId = typeof source.currentPageId === 'string' ? source.currentPageId : null;
  const currentPageId = pages.some(page => page.id === requestedCurrentPageId)
    ? requestedCurrentPageId
    : pages[0]?.id ?? null;

  return { pages, currentPageId, settings };
}

export function migrateLegacyChromeWorkspace({ pages, currentPageId, noteContent, settings } = {}, options = {}) {
  const legacyPages = Array.isArray(pages) && pages.length > 0
    ? pages
    : (typeof noteContent === 'string' ? [{ id: createWorkspaceId(), emoji: '📝', content: noteContent }] : []);

  return normalizeWorkspace({ pages: legacyPages, currentPageId, settings }, options);
}
