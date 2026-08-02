import {
  DEFAULT_WORKSPACE_SETTINGS,
  MAX_PAGE_TITLE_LENGTH,
  normalizePage,
  normalizeSettings
} from './schema.js';

export const PUBLISH_FORMAT = 'BlackboardTextNote';
export const PUBLISH_SCHEMA_VERSION = 1;
export const PUBLISH_ROUTE = 'read.html';
export const PUBLISH_HASH_KEY = 'n';

// A published note travels inside the URL fragment, so both directions are
// bounded: the encoded token can't be unbounded, and a hostile link must not be
// able to expand into something that freezes the tab it is opened in.
export const MAX_PUBLISHED_BYTES = 2 * 1024 * 1024;
export const MAX_PUBLISHED_TOKEN_LENGTH = 3 * 1024 * 1024;

// Chat apps and mail clients truncate long URLs at wildly different limits, so
// the dialog grades a link rather than pretending there is one true maximum.
export const LINK_LENGTH_COMFORTABLE = 4_000;
export const LINK_LENGTH_LONG = 16_000;

const GZIP_MARKER = '1z';
const PLAIN_MARKER = '1p';
const POINT_PRECISION = 100;

const VIEW_KEYS = [
  'fontFamily',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'maxWidth',
  'textColor',
  'backgroundColor',
  'selectionColor',
  'currentTheme'
];

function hasCompressionStream() {
  return typeof globalThis.CompressionStream === 'function'
    && typeof globalThis.DecompressionStream === 'function';
}

function roundPoint(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * POINT_PRECISION) / POINT_PRECISION : 0;
}

// Stroke points carry far more precision than a screen can show. Rounding them
// is the single biggest size win available before compression.
function compactStroke(stroke) {
  return {
    id: stroke.id,
    tool: stroke.tool,
    color: stroke.color,
    width: Math.round(Number(stroke.width) * 10_000) / 10_000,
    points: (stroke.points || []).map(point => ({ x: roundPoint(point.x), y: roundPoint(point.y) })),
    coordinateSpace: stroke.coordinateSpace,
    referenceFontSize: stroke.referenceFontSize
  };
}

function pickView(settings) {
  const normalized = normalizeSettings(settings);
  return Object.fromEntries(VIEW_KEYS.map(key => [key, normalized[key]]));
}

export function createPublishedNote(page, settings, {
  appVersion = 'development',
  publishedAt = new Date().toISOString(),
  includeDrawings = true,
  boardWidth = null
} = {}) {
  const source = page && typeof page === 'object' ? page : {};
  const content = typeof source.content === 'string' ? source.content : '';
  const title = typeof source.title === 'string' ? source.title.slice(0, MAX_PAGE_TITLE_LENGTH) : '';
  const drawings = includeDrawings && Array.isArray(source.drawings) ? source.drawings.map(compactStroke) : [];
  const width = Number(boardWidth);

  return {
    format: PUBLISH_FORMAT,
    schemaVersion: PUBLISH_SCHEMA_VERSION,
    publishedAt,
    appVersion,
    note: {
      emoji: typeof source.emoji === 'string' ? source.emoji.slice(0, 16) : '📝',
      title,
      content,
      drawings,
      createdAt: typeof source.createdAt === 'string' ? source.createdAt : null,
      editedAt: typeof source.editedAt === 'string' ? source.editedAt : null
    },
    view: pickView(settings),
    board: { width: Number.isFinite(width) && width > 0 ? Math.round(width) : null }
  };
}

function bytesToBase64Url(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlToBytes(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  let binary;
  try {
    binary = atob(padded);
  } catch (error) {
    throw new Error('This link is not a complete Blackboard note.');
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function collectStream(stream, limit) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        throw new Error('This published note is too large to open.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function streamFromBytes(bytes) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}

export async function encodePublishedNote(note) {
  const json = JSON.stringify(note);
  const bytes = new TextEncoder().encode(json);

  if (bytes.length > MAX_PUBLISHED_BYTES) {
    throw new Error('This note is too large to publish as a link.');
  }

  if (!hasCompressionStream()) {
    return `${PLAIN_MARKER}${bytesToBase64Url(bytes)}`;
  }

  const compressed = await collectStream(
    streamFromBytes(bytes).pipeThrough(new globalThis.CompressionStream('gzip')),
    MAX_PUBLISHED_BYTES
  );
  return `${GZIP_MARKER}${bytesToBase64Url(compressed)}`;
}

export async function decodePublishedNote(token, { sanitizeHtml, defaults = DEFAULT_WORKSPACE_SETTINGS } = {}) {
  if (typeof token !== 'string' || token.length < 3) {
    throw new Error('This link does not contain a note.');
  }

  if (token.length > MAX_PUBLISHED_TOKEN_LENGTH) {
    throw new Error('This published note is too large to open.');
  }

  const marker = token.slice(0, 2);
  const payload = token.slice(2);
  if (marker !== GZIP_MARKER && marker !== PLAIN_MARKER) {
    throw new Error('This link was made by a different version of Blackboard Text.');
  }

  const bytes = base64UrlToBytes(payload);
  let decoded;

  if (marker === PLAIN_MARKER) {
    if (bytes.length > MAX_PUBLISHED_BYTES) {
      throw new Error('This published note is too large to open.');
    }
    decoded = bytes;
  } else {
    if (!hasCompressionStream()) {
      throw new Error('This browser cannot open compressed note links.');
    }
    try {
      decoded = await collectStream(
        streamFromBytes(bytes).pipeThrough(new globalThis.DecompressionStream('gzip')),
        MAX_PUBLISHED_BYTES
      );
    } catch (error) {
      if (error?.message?.includes('too large')) throw error;
      throw new Error('This link is not a complete Blackboard note.');
    }
  }

  let candidate;
  try {
    candidate = JSON.parse(new TextDecoder().decode(decoded));
  } catch (error) {
    throw new Error('This link is not a complete Blackboard note.');
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || candidate.format !== PUBLISH_FORMAT) {
    throw new Error('This link is not a published Blackboard note.');
  }

  if (candidate.schemaVersion !== PUBLISH_SCHEMA_VERSION) {
    throw new Error('This note was published by a newer version of Blackboard Text.');
  }

  const view = normalizeSettings(candidate.view, defaults);
  // The payload is entirely under the sender's control, so it goes through the
  // same normalize + sanitize boundary an imported backup does.
  const note = normalizePage(candidate.note, { fontSize: view.fontSize, sanitizeHtml });
  const boardWidth = Number(candidate.board?.width);

  return {
    publishedAt: typeof candidate.publishedAt === 'string' ? candidate.publishedAt : null,
    appVersion: typeof candidate.appVersion === 'string' ? candidate.appVersion : null,
    note,
    view,
    board: { width: Number.isFinite(boardWidth) && boardWidth > 0 ? boardWidth : null }
  };
}

// Keeps the app's own directory but always lands on the reader page, so this
// works from a subdirectory deployment such as GitHub Pages project sites.
export function buildPublishedNoteUrl(baseUrl, token) {
  const base = new URL(baseUrl);
  base.hash = '';
  base.search = '';
  base.pathname = base.pathname.replace(/[^/]*$/, PUBLISH_ROUTE);
  return `${base.href}#${PUBLISH_HASH_KEY}=${token}`;
}

export function readPublishedNoteToken(hash) {
  if (typeof hash !== 'string') return null;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw === '') return null;
  const params = new URLSearchParams(raw);
  const token = params.get(PUBLISH_HASH_KEY);
  return token && token.trim() !== '' ? token.trim() : null;
}

export function describePublishedLink(url) {
  const characters = typeof url === 'string' ? url.length : 0;
  const tier = characters <= LINK_LENGTH_COMFORTABLE
    ? 'ok'
    : (characters <= LINK_LENGTH_LONG ? 'long' : 'very-long');

  return { characters, kilobytes: Math.round((characters / 1024) * 10) / 10, tier };
}
