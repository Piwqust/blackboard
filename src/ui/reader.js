import {
  convertPointToCanvasPixels,
  getBrushSizeInPixels,
  getStrokeReferenceFontSize,
  paintStroke
} from '../core/drawing-geometry.js';
import { decodePublishedNote, readPublishedNoteToken } from '../core/publish.js';
import { sanitizeStoredContent } from '../core/sanitize-html.js';
import { normalizeHex } from '../core/schema.js';

const board = document.getElementById('readerBoard');
const shell = document.getElementById('readerShell');
const content = document.getElementById('readerContent');
const canvas = document.getElementById('readerDrawings');
const header = document.getElementById('readerHeader');
const emojiElement = document.getElementById('readerEmoji');
const titleElement = document.getElementById('readerTitle');
const metaElement = document.getElementById('readerMeta');
const footer = document.getElementById('readerFooter');
const statePanel = document.getElementById('readerState');
const stateTitle = document.getElementById('readerStateTitle');
const stateText = document.getElementById('readerStateText');

const context = canvas?.getContext('2d') || null;
let published = null;
let resizeFrame = null;

function hexToRgba(hex, alpha) {
  const normalized = normalizeHex(hex, '#000000');
  const value = Number.parseInt(normalized.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function showState(title, text) {
  if (board) board.hidden = true;
  if (footer) footer.hidden = true;
  if (statePanel) statePanel.hidden = false;
  if (stateTitle) stateTitle.textContent = title;
  if (stateText) stateText.textContent = text;
}

function applyView(view) {
  const root = document.documentElement;
  root.style.setProperty('--font-family', view.fontFamily);
  root.style.setProperty('--font-size', `${view.fontSize}px`);
  root.style.setProperty('--line-height', view.lineHeight);
  root.style.setProperty('--letter-spacing', `${view.letterSpacing}em`);
  root.style.setProperty('--max-width', `${view.maxWidth}px`);
  root.style.setProperty('--text-color', view.textColor);
  root.style.setProperty('--bg-color', view.backgroundColor);
  root.style.setProperty('--selection-color', view.selectionColor);
  root.style.setProperty('--ui-text-muted', hexToRgba(view.textColor, 0.6));
  root.style.setProperty('--ui-border', hexToRgba(view.textColor, 0.12));
  document.body.style.backgroundColor = view.backgroundColor;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute('content', view.backgroundColor);
}

function formatPublishedDate(value) {
  if (!value) return '';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return '';
  return new Date(parsed).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// Drawings were placed against the text as it was laid out on the publisher's
// screen. Letting a phone reflow that text would slide the words out from under
// the strokes, so a note that has drawings is instead kept at its published
// width and the whole board — text and canvas together — is scaled to fit.
// A note without drawings has no such tie and simply reflows, which reads far
// better on a small screen.
function applyBoardLayout() {
  if (!board || !published) return 1;

  const publishedWidth = published.board.width;
  const hasDrawings = Array.isArray(published.note.drawings) && published.note.drawings.length > 0;
  const available = document.documentElement.clientWidth || window.innerWidth;

  if (!publishedWidth || !hasDrawings || available >= publishedWidth) {
    board.style.width = '';
    board.style.transform = '';
    board.style.marginBottom = '';
    board.style.maxWidth = publishedWidth ? `${publishedWidth}px` : '';
    return 1;
  }

  const scale = available / publishedWidth;
  board.style.maxWidth = 'none';
  board.style.width = `${publishedWidth}px`;
  board.style.transformOrigin = 'top left';
  board.style.transform = `scale(${scale})`;
  return scale;
}

// A transform doesn't change layout size, so the board still reserves its full
// unscaled height. Pull that difference back so the page scrolls to the bottom
// of what is actually drawn.
function compensateScaledHeight(boardHeight, scale) {
  if (!board) return;
  board.style.marginBottom = scale < 1 ? `${-Math.round(boardHeight * (1 - scale))}px` : '';
}

// Padding follows the width the note was published at, not the viewer's
// screen: it is part of where the strokes sit relative to the first line.
function applyShellPadding() {
  if (!shell) return;
  const publishedWidth = published?.board?.width || window.innerWidth;
  shell.style.padding = publishedWidth <= 768
    ? '48px 24px 100px 24px'
    : '48px 48px 120px 48px';
}

// In the editor the note's first line sits one padding-height below the top of
// the board, and strokes are stored against that same origin. The reader adds
// a title row above the text, so the canvas is pushed down by exactly that row
// to put the drawings back where they were relative to the words.
function getCanvasOffsetTop() {
  if (!board || !content || header?.hidden) return 0;
  const boardTop = board.getBoundingClientRect().top;
  const contentTop = content.getBoundingClientRect().top;
  const shellPaddingTop = Number.parseFloat(getComputedStyle(content.parentElement).paddingTop) || 0;
  return Math.max(0, Math.round(contentTop - boardTop - shellPaddingTop));
}

// A drawing can reach further down the page than the text does, so the board
// has to grow to hold it — otherwise the canvas would clip the stroke.
function getDrawnHeight(strokes, scale) {
  return strokes.reduce((lowest, stroke) => {
    const referenceFontSize = getStrokeReferenceFontSize(stroke, published.view.fontSize);
    const strokeEdge = getBrushSizeInPixels(stroke.width, published.view.fontSize, scale) / 2;
    return (stroke.points || []).reduce((deepest, point) => {
      const { y } = convertPointToCanvasPixels(point, referenceFontSize, published.view.fontSize, scale);
      return Math.max(deepest, y + strokeEdge);
    }, lowest);
  }, 0);
}

function paintDrawings() {
  if (!context || !canvas || !board || !published) return;

  applyShellPadding();
  const boardScale = applyBoardLayout();
  const width = Math.round(board.clientWidth);
  // A hidden or not-yet-laid-out page measures as zero; painting then would
  // bake a meaningless canvas size into the DOM.
  if (width < 1) return;

  const strokes = Array.isArray(published.note.drawings) ? published.note.drawings : [];
  const offsetTop = getCanvasOffsetTop();
  const drawnHeight = strokes.length > 0 ? offsetTop + getDrawnHeight(strokes, 1) + 48 : 0;
  // Measured from the flow content and the strokes, never from the board's own
  // scroll height: the canvas is a child of the board, so reading scrollHeight
  // would let the canvas grow itself on every repaint.
  const viewportHeight = Math.ceil((document.documentElement.clientHeight || window.innerHeight) / boardScale);
  const boardHeight = Math.ceil(Math.max(viewportHeight, shell.getBoundingClientRect().height / boardScale, drawnHeight));
  board.style.minHeight = `${boardHeight}px`;
  compensateScaledHeight(boardHeight, boardScale);

  const height = Math.max(1, boardHeight - offsetTop);
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.top = `${offsetTop}px`;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  // The board itself is already scaled when it needs to be, so strokes are
  // always painted at the size they were drawn.
  strokes.forEach(stroke => paintStroke(context, stroke, { fontSize: published.view.fontSize }));
}

function renderNote() {
  if (!published) return;

  applyView(published.view);
  content.innerHTML = published.note.content;

  const title = published.note.title.trim();
  const publishedOn = formatPublishedDate(published.publishedAt);
  document.title = title ? `${title} — Blackboard Text` : 'Published note — Blackboard Text';

  // Set every time, not just when there is a title: opening a second note
  // through a hash change must not inherit the first one's header.
  header.hidden = !title && !published.note.emoji;
  emojiElement.textContent = published.note.emoji || '';
  titleElement.textContent = title;
  titleElement.hidden = title === '';

  metaElement.textContent = publishedOn ? `Published ${publishedOn}` : 'Published note';
  if (footer) footer.hidden = false;
  if (statePanel) statePanel.hidden = true;
  if (board) board.hidden = false;

  // The board must be laid out before the canvas can match its height.
  requestAnimationFrame(paintDrawings);
}

async function openNoteFromHash() {
  const token = readPublishedNoteToken(globalThis.location?.hash);

  if (!token) {
    showState(
      'This link has no note in it',
      'A published Blackboard note carries its text inside the link. Copy the whole link, including everything after the # sign.'
    );
    return;
  }

  try {
    published = await decodePublishedNote(token, {
      // A note someone else wrote is untrusted input: strip scripting and any
      // media that would call out to a third-party host when this page opens.
      sanitizeHtml: value => sanitizeStoredContent(value, { allowRemoteMedia: false })
    });
    renderNote();
  } catch (error) {
    published = null;
    showState('This note could not be opened', error?.message || 'The link is not a published Blackboard note.');
  }
}

window.addEventListener('resize', () => {
  if (resizeFrame) cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null;
    paintDrawings();
  });
});

window.addEventListener('hashchange', () => {
  void openNoteFromHash();
});

// A page opened in a background tab measures as zero-width, so the first paint
// is skipped; repaint once it is actually on screen (this also covers a
// back-navigation restoring the page from the cache).
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) paintDrawings();
});
window.addEventListener('pageshow', () => paintDrawings());

if (document.fonts?.ready) {
  // Text reflows once the bundled font finishes loading, which changes how far
  // down the board the drawings need to reach.
  document.fonts.ready.then(() => paintDrawings()).catch(() => undefined);
}

void openNoteFromHash();
