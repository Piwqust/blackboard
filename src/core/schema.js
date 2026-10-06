export const WORKSPACE_FORMAT = 'BlackboardTextWorkspace';
export const WORKSPACE_SCHEMA_VERSION = 2;
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
      : baseline.currentTheme,
    drawTools:Object.fromEntries(['brush','eraser','marker','pen'].filter(tool=>source.drawTools?.[tool]&&typeof source.drawTools[tool]==='object').map(tool=>[tool,{size:finiteNumber(source.drawTools[tool].size,baseline.drawSize,0.08,1.4),color:normalizeHex(source.drawTools[tool].color,textColor),mode:source.drawTools[tool].mode==='theme'?'theme':'custom'}])),
    drawLastTool:['brush','eraser','marker','pen'].includes(source.drawLastTool)?source.drawLastTool:'brush',
    drawFollowText:source.drawFollowText===true,
    drawEraseWhole:source.drawEraseWhole===true,
    // Older workspaces chose the pressure pen as a separate tool.
    drawPressure:source.drawPressure===true||source.drawLastTool==='pen'
  };
}

function normalizePoint(point) {
  if (!point || typeof point !== 'object') return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y, ...(Number.isFinite(Number(point.pressure)) ? {pressure:finiteNumber(point.pressure,0.5,0,1)} : {}) };
}

export function normalizeStroke(stroke = {}, fallbackFontSize = DEFAULT_WORKSPACE_SETTINGS.fontSize) {
  const source = stroke && typeof stroke === 'object' ? stroke : {};
  const points = Array.isArray(source.points)
    ? source.points.map(normalizePoint).filter(Boolean)
    : [];

  const referenceFontSize = finiteNumber(source.referenceFontSize ?? source.fontSize, fallbackFontSize, 1, 512);
  const hasCoordinateSpace = typeof source.coordinateSpace === 'string' && source.coordinateSpace;
  const width = finiteNumber(source.width, hasCoordinateSpace ? DEFAULT_WORKSPACE_SETTINGS.drawSize : 4, 0.001, 128);
  const normalizedWidth = hasCoordinateSpace ? width : width / referenceFontSize;
  const normalizedPoints = source.coordinateSpace === 'font-relative'
    ? points.map(({x, y}) => ({x: x * referenceFontSize, y: y * referenceFontSize}))
    : points;

  return {
    id: typeof source.id === 'string' && source.id ? source.id : createWorkspaceId(),
    tool: ['eraser','marker','pen'].includes(source.tool) ? source.tool : 'brush',
    color: normalizeHex(source.color, DEFAULT_WORKSPACE_SETTINGS.drawColor),
    width: normalizedWidth,
    points: normalizedPoints,
    coordinateSpace: 'text-scaled-px',
    referenceFontSize,
    ...(source.renderer === 'smooth-v1' ? {renderer:'smooth-v1'} : {}),
    ...(Number.isFinite(source.referencePaddingX) ? {referencePaddingX:finiteNumber(source.referencePaddingX,48,0,1000)} : {}),
    ...(Number.isFinite(source.referencePaddingY) ? {referencePaddingY:finiteNumber(source.referencePaddingY,48,0,1000)} : {}),
    ...(Number.isFinite(source.referenceLineHeight) ? {referenceLineHeight:finiteNumber(source.referenceLineHeight,1.6,1,3)} : {}),
    ...(source.tool === 'marker' ? {opacity:finiteNumber(source.opacity,0.25,0.05,0.8)} : {}),
    ...(source.anchor && Number.isInteger(source.anchor.start) && Number.isInteger(source.anchor.end) && source.anchor.start>=0 && source.anchor.end>source.anchor.start && source.anchor.box && ['x','y','width','height'].every(key=>Number.isFinite(source.anchor.box[key])&&Math.abs(source.anchor.box[key])<=1_000_000)
      ? {anchor:{start:source.anchor.start,end:source.anchor.end,text:String(source.anchor.text||'').slice(0,1000),box:{x:source.anchor.box.x,y:source.anchor.box.y,width:Math.max(1,source.anchor.box.width),height:Math.max(1,source.anchor.box.height)}}} : {})
  };
}

// Page timestamps travel as ISO strings; anything unparsable becomes null so a
// hand-edited backup can't put a bogus date on the page card.
export function normalizeTimestamp(value) {
  if (typeof value !== 'string' || value === '') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
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
    pinned: source.pinned === true,
    drawingDescription: typeof source.drawingDescription === 'string' ? source.drawingDescription.slice(0,2000) : '',
    content: typeof sanitizedContent === 'string' ? sanitizedContent : '',
    drawings: Array.isArray(source.drawings)
      ? source.drawings.map(stroke => normalizeStroke(stroke, fontSize))
      : [],
    scrollTop: finiteNumber(source.scrollTop, 0, 0, Number.MAX_SAFE_INTEGER),
    createdAt: normalizeTimestamp(source.createdAt),
    editedAt: normalizeTimestamp(source.editedAt),
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
