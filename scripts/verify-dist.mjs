import { access, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'dist/pwa/index.html',
  'dist/pwa/editor.html',
  'dist/pwa/read.html',
  'dist/pwa/privacy.html',
  'dist/pwa/site.webmanifest',
  'dist/pwa/pwa-sw.js',
  'dist/pwa/src/core/workspace-store.js',
  'dist/pwa/src/core/publish.js',
  'dist/pwa/src/core/sanitize-html.js',
  'dist/pwa/src/core/drawing-geometry.js',
  'dist/pwa/src/ui/reader.js',
  'dist/pwa/fonts/InterVariable.woff2',
  'dist/pwa/fonts/BoardGrotesqueSans-Regular.otf',
  'dist/pwa/icons/icon-192.png',
  'dist/pwa/icons/icon-512.png',
  'dist/edge-extension/editor.html',
  'dist/edge-extension/read.html',
  'dist/edge-extension/manifest.json',
  'dist/edge-extension/src/core/workspace-lock.js'
];

await Promise.all(required.map(relativePath => access(path.join(root, relativePath))));
const edgeManifest = JSON.parse(await readFile(path.join(root, 'dist/edge-extension/manifest.json'), 'utf8'));
if (!edgeManifest.options_ui?.open_in_tab || edgeManifest.version !== JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version) {
  throw new Error('The generated Edge manifest is missing its focused editor page or has the wrong version.');
}

const pwaCss = await readFile(path.join(root, 'dist/pwa/editor.css'), 'utf8');
if (!pwaCss.includes('BoardGrotesque Sans')) throw new Error('The PWA is missing the Board Grotesk font declaration.');

const worker = await readFile(path.join(root, 'dist/pwa/pwa-sw.js'), 'utf8');
if (worker.includes('__APP_VERSION__') || worker.includes('__APP_SHELL__')) {
  throw new Error('The generated service worker still contains build placeholders.');
}

// A page that is deployed but never cached silently stops working offline, so
// every page and module in the artifact has to appear in the generated shell.
const shellMatch = worker.match(/const APP_SHELL = (\[[\s\S]*?\]);/);
if (!shellMatch) throw new Error('The generated service worker has no app shell list.');
const appShell = new Set(JSON.parse(shellMatch[1]));

const pwaRoot = path.join(root, 'dist/pwa');
const entries = await readdir(pwaRoot, { recursive: true, withFileTypes: true });
const cacheable = entries
  .filter(entry => entry.isFile())
  .map(entry => path.relative(pwaRoot, path.join(entry.parentPath ?? entry.path, entry.name)).split(path.sep).join('/'))
  .filter(relativePath => ['.html', '.css', '.js'].includes(path.extname(relativePath)))
  .filter(relativePath => !['pwa-sw.js', 'service-worker.js', 'icons/generate-icons.html'].includes(relativePath));

const missing = cacheable.filter(relativePath => !appShell.has(`./${relativePath}`));
if (missing.length > 0) {
  throw new Error(`These deployed files are missing from the offline app shell: ${missing.join(', ')}`);
}

console.log(`Generated PWA and Edge extension artifacts are structurally valid (${appShell.size} shell entries).`);
