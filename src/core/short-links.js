import { SHORT_LINKS_API } from '../config.js';
const ID = /^[A-Za-z0-9_-]{22}$/;
const MANAGEMENT_KEY = /^[A-Za-z0-9_-]{43}$/;
export const MAX_SHORT_TOKEN = 900_000;

export function shortLinksEndpoint() {
  if (!SHORT_LINKS_API) return null;
  const url = new URL(SHORT_LINKS_API);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) throw new Error('Invalid short-link service address.');
  return url.href.replace(/\/$/, '');
}
export function newShareCredentials() {
  const random = length => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(length)))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return {id: random(16), managementKey: random(32)};
}
export function shortLinkUrl(baseUrl, id) {
  if (!ID.test(id)) throw new Error('Invalid short link.');
  const url = new URL('./s/', baseUrl);
  url.hash = id;
  return url.href;
}
export function shortLinkId(location = globalThis.location) {
  const query = new URLSearchParams(location.search).get('s');
  if (query === null) return null;
  if (!ID.test(query)) throw new Error('This short link is incomplete. Copy the whole address.');
  return query;
}
async function api(id, { method = 'GET', managementKey, token, signal } = {}) {
  const endpoint = shortLinksEndpoint();
  if (!endpoint) throw new Error('Short links are not connected yet. The full link still works.');
  if (!ID.test(id) || (managementKey && !MANAGEMENT_KEY.test(managementKey))) throw new Error('Invalid link management details.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, {once: true});
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(cancel, 20_000);
  try {
    const headers = {};
    if (managementKey) headers.Authorization = 'Bearer ' + managementKey;
    if (token !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(endpoint + '/v1/notes/' + id, {
      method, headers, body: token === undefined ? undefined : JSON.stringify({token}),
      cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal
    });
    if (response.status === 204) return null;
    // The configured service is trusted, but still cap response allocation.
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    try {
      for (;;) {
        const {value, done} = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > MAX_SHORT_TOKEN + 4096) { await reader.cancel(); throw new Error('Short-link response is too large.'); }
        chunks.push(value);
      }
    } finally {reader.releaseLock();}
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset);offset += chunk.length;}
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Short link unavailable.');
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The request was interrupted. Retry from Shared links to check the result.');
    if (error instanceof TypeError) throw new Error('Cannot reach the short-link service. Check your internet connection and try again.');
    throw error;
  } finally {clearTimeout(timeout);signal?.removeEventListener('abort', cancel);}
}
export async function uploadShortLink(record) {
  if (typeof record.token !== 'string' || record.token.length > MAX_SHORT_TOKEN) throw new Error('This copy is too large for a short link. Use the full link or export a backup.');
  const data = await api(record.id, {method: 'PUT', managementKey: record.managementKey, token: record.token});
  if (data?.id !== record.id || typeof data.createdAt !== 'string') throw new Error('The short-link service returned an invalid response. Retry from Shared links.');
  return data;
}
export async function fetchShortLink(id, signal) {
  const data = await api(id, {signal});
  if (typeof data?.token !== 'string' || data.token.length > MAX_SHORT_TOKEN) throw new Error('Invalid published copy.');
  return data.token;
}
export function revokeShortLink(record) {return api(record.id, {method: 'DELETE', managementKey: record.managementKey});}
