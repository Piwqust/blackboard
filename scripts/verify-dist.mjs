import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'dist/pwa/index.html',
  'dist/pwa/editor.html',
  'dist/pwa/privacy.html',
  'dist/pwa/site.webmanifest',
  'dist/pwa/pwa-sw.js',
  'dist/pwa/src/core/workspace-store.js',
  'dist/pwa/fonts/InterVariable.woff2',
  'dist/pwa/icons/icon-192.png',
  'dist/pwa/icons/icon-512.png',
  'dist/edge-extension/editor.html',
  'dist/edge-extension/manifest.json',
  'dist/edge-extension/src/core/workspace-lock.js'
];

await Promise.all(required.map(relativePath => access(path.join(root, relativePath))));
const edgeManifest = JSON.parse(await readFile(path.join(root, 'dist/edge-extension/manifest.json'), 'utf8'));
if (!edgeManifest.options_ui?.open_in_tab || edgeManifest.version !== JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version) {
  throw new Error('The generated Edge manifest is missing its focused editor page or has the wrong version.');
}

const pwaCss = await readFile(path.join(root, 'dist/pwa/editor.css'), 'utf8');
if (pwaCss.includes('BoardGrotesque')) throw new Error('The PWA still contains a removed legacy font reference.');

console.log('Generated PWA and Edge extension artifacts are structurally valid.');
