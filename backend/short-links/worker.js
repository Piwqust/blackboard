import { decodePublishedNote } from '../../src/core/publish.js';

const ID = /^[A-Za-z0-9_-]{22}$/;
const KEY = /^[A-Za-z0-9_-]{43}$/;
const MAX_BODY = 901_000;
const MAX_TOKEN = 900_000;

function corsOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  return allowed.includes(origin) || (env.ALLOW_EXTENSION_ORIGINS === 'true' && /^chrome-extension:\/\/[a-p]{32}$/.test(origin)) ? origin : null;
}

function reply(request, env, status, body) {
  const headers = new Headers({
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8'
  });
  const origin = corsOrigin(request, env);
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Max-Age', '600');
  }
  if (status === 429) headers.set('Retry-After', '60');
  return new Response(status === 204 ? null : JSON.stringify(body), {status, headers});
}

async function digest(text) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function boundedJSON(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) throw new RangeError('Request too large');
  if (!request.body) throw new SyntaxError('Missing body');
  const reader = request.body.getReader();
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const {value, done} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY) { await reader.cancel(); throw new RangeError('Request too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** @type {ExportedHandler<Env>} */
export default {
  async fetch(request, env) {
    const respond = (status, body) => reply(request, env, status, body);
    const path = new URL(request.url).pathname;
    if (request.headers.has('Origin') && !corsOrigin(request, env)) return respond(403, {error: 'Origin not allowed.'});
    if (path === '/health' && request.method === 'GET') return respond(200, {service: 'blackboard-short-links', version: 1});
    const match = /^\/v1\/notes\/([^/]+)$/.exec(path);
    if (!match || !ID.test(match[1])) return respond(404, {error: 'Link not found.'});
    if (request.method === 'OPTIONS') return respond(204);
    if (!['GET', 'PUT', 'DELETE'].includes(request.method)) return respond(405, {error: 'Method not allowed.'});
    const id = match[1];
    try {
      const limiter = request.method === 'PUT' ? env.WRITE_LIMITER : env.READ_LIMITER;
      const {success} = await limiter.limit({key: request.headers.get('CF-Connecting-IP') || 'local'});
      if (!success) return respond(429, {error: 'Too many requests. Try again in a minute.'});
      if (request.method === 'GET') {
        const row = await env.DB.prepare('SELECT token, revoked_at FROM shares WHERE id = ?').bind(id).first();
        if (!row || row.revoked_at) return respond(404, {error: 'This link is unavailable or has been disabled.'});
        return respond(200, {token: row.token});
      }
      const key = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
      if (!KEY.test(key)) return respond(401, {error: 'Missing link management key.'});
      const ownerHash = await digest(key);
      if (request.method === 'DELETE') {
        // Database comparison uses a fixed-size digest, never a plaintext credential.
        const row = await env.DB.prepare('SELECT revoked_at FROM shares WHERE id = ? AND owner_hash = ?').bind(id, ownerHash).first();
        if (!row) return respond(404, {error: 'Link not found or management key is invalid.'});
        await env.DB.batch([
          env.DB.prepare('UPDATE share_budget SET bytes = bytes - coalesce((SELECT length(token) FROM shares WHERE id = ? AND owner_hash = ?), 0) WHERE singleton = 1').bind(id, ownerHash),
          env.DB.prepare('UPDATE shares SET token = NULL, revoked_at = coalesce(revoked_at, ?) WHERE id = ? AND owner_hash = ?').bind(new Date().toISOString(), id, ownerHash)
        ]);
        return respond(204);
      }
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return respond(415, {error: 'Expected JSON.'});
      const body = await boundedJSON(request);
      if (!body || typeof body.token !== 'string' || body.token.length > MAX_TOKEN || !/^1[zp][A-Za-z0-9_-]+$/.test(body.token)) {
        return respond(400, {error: 'This copy is invalid or too large for a short link. Use the full link or a backup.'});
      }
      try { await decodePublishedNote(body.token); }
      catch { return respond(400, {error: 'Invalid Blackboard note.'}); }
      const payloadHash = await digest(body.token);
      const createdAt = new Date().toISOString();
      // D1 batch is one transaction. changes() counts the preceding insert,
      // so retries and collisions never consume storage budget twice.
      await env.DB.batch([
        env.DB.prepare('INSERT INTO shares (id, token, owner_hash, payload_hash, created_at) SELECT ?, ?, ?, ?, ? WHERE (SELECT bytes + ? <= 100000000 AND records < 10000 FROM share_budget WHERE singleton = 1) ON CONFLICT(id) DO NOTHING')
          .bind(id, body.token, ownerHash, payloadHash, createdAt, body.token.length),
        env.DB.prepare('UPDATE share_budget SET bytes = bytes + ?, records = records + 1 WHERE singleton = 1 AND changes() = 1').bind(body.token.length)
      ]);
      const row = await env.DB.prepare('SELECT created_at, revoked_at, payload_hash FROM shares WHERE id = ? AND owner_hash = ?').bind(id, ownerHash).first();
      if (!row) return respond(409, {error: 'This link ID is already in use.'});
      if (row.revoked_at) return respond(410, {error: 'This link was disabled and cannot be recreated.'});
      if (row.payload_hash !== payloadHash) return respond(409, {error: 'A published copy cannot be changed. Create a new link.'});
      return respond(200, {id, createdAt: row.created_at});
    } catch (error) {
      if (error instanceof RangeError) return respond(413, {error: 'This copy is too large for a short link.'});
      if (error instanceof SyntaxError) return respond(400, {error: 'Invalid JSON.'});
      // Do not log note content, link IDs, Authorization, or raw database errors.
      console.error(JSON.stringify({event: 'short_link_failed', method: request.method}));
      return respond(503, {error: 'Short links are temporarily unavailable. Your local note is safe. Try again later.'});
    }
  }
};
