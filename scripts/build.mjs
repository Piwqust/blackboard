import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(root, 'dist');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const version = packageJson.version;
const sharingApi = (process.env.SHORT_LINKS_API_URL || '').trim();
if (sharingApi) {
  const url = new URL(sharingApi);
  const local = ['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) {
    throw new Error('SHORT_LINKS_API_URL must be an HTTPS service address without credentials, query or fragment.');
  }
}

// Shared by the PWA and the extension build.
const staticFiles = [
  'editor.html',
  'editor.css',
  'editor.js',
  'read.html',
  's/index.html',
  'privacy.html',
  'service-worker.js',
  'site.webmanifest',
  'LICENSE',
  'fonts/Inter-OFL.txt'
];

// The landing page and its screenshots exist only on the website. The
// extension opens editor.html directly (manifest action and options_ui), so it
// never ships them.
const pwaOnlyFiles = ['index.html'];
const pwaOnlyDirectories = ['landing'];

// Files the app shell is cached from. Anything not listed here still works
// online, but would not survive going offline.
const SHELL_EXTENSIONS = new Set(['.html', '.css', '.js', '.woff2', '.ttf', '.otf', '.png', '.webmanifest', '.txt', '']);
const SHELL_EXCLUDED = new Set(['service-worker.js', 'pwa-sw.js', 'icons/generate-icons.html']);
// Landing screenshots are cached only when someone views them. Precaching
// would make every install download images the installed app never shows.
// Pages, styles and scripts may not live here: scripts/verify-dist.mjs
// requires every one of those in the shell.
const SHELL_EXCLUDED_DIRECTORIES = ['landing/'];

async function listShellFiles(destination) {
  const entries = await readdir(destination, { recursive: true, withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile())
    .map(entry => path.relative(destination, path.join(entry.parentPath ?? entry.path, entry.name)))
    .map(relativePath => relativePath.split(path.sep).join('/'))
    .filter(relativePath => SHELL_EXTENSIONS.has(path.extname(relativePath)) && !SHELL_EXCLUDED.has(relativePath))
    .filter(relativePath => !SHELL_EXCLUDED_DIRECTORIES.some(directory => relativePath.startsWith(directory)))
    .sort();

  return ['./', ...files.map(relativePath => `./${relativePath}`)];
}

async function copyFile(relativePath, destination) {
  const source = path.join(root, relativePath);
  const target = path.join(destination, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target);
}

async function copyPwaOnlyFiles(destination) {
  await Promise.all(pwaOnlyFiles.map(file => copyFile(file, destination)));
  await Promise.all(pwaOnlyDirectories.map(directory => cp(path.join(root, directory), path.join(destination, directory), { recursive: true })));
  const landingPath = path.join(destination, 'index.html');
  const landing = await readFile(landingPath, 'utf8');
  await writeFile(landingPath, landing.replaceAll('__APP_VERSION__', version));
}

async function copyRuntime(destination, { includePwaWorker }) {
  await mkdir(destination, { recursive: true });
  await Promise.all(staticFiles.map(file => copyFile(file, destination)));
  await cp(path.join(root, 'src'), path.join(destination, 'src'), { recursive: true });
  await writeFile(path.join(destination, 'src/config.js'), 'export const SHORT_LINKS_API = '+JSON.stringify(sharingApi)+';\n');
  await cp(path.join(root, 'icons'), path.join(destination, 'icons'), { recursive: true, filter: source => !source.endsWith('generate-icons.html') });
  await copyFile('fonts/InterVariable.woff2', destination);
  await copyFile('fonts/InterTight-Variable.ttf', destination);
  await copyFile('fonts/BoardGrotesqueSans-Light.otf', destination);
  await copyFile('fonts/BoardGrotesqueSans-Regular.otf', destination);
  await copyFile('fonts/BoardGrotesqueSans-Medium.otf', destination);

  if (includePwaWorker) {
    // Copied before the shell list is generated, so the landing page is
    // precached like every other page.
    await copyPwaOnlyFiles(destination);
    const worker = await readFile(path.join(root, 'pwa-sw.js'), 'utf8');
    const shellFiles = await listShellFiles(destination);
    await writeFile(
      path.join(destination, 'pwa-sw.js'),
      worker
        .replaceAll('__APP_VERSION__', version)
        .replaceAll("'__APP_SHELL__'", shellFiles.map(file => JSON.stringify(file)).join(', '))
    );
  }
}

// dist is a generated release directory. It is intentionally recreated from
// source on every build so a deployment can never include stale old files.
await rm(distRoot, { recursive: true, force: true });

const pwaDestination = path.join(distRoot, 'pwa');
const edgeDestination = path.join(distRoot, 'edge-extension');
await copyRuntime(pwaDestination, { includePwaWorker: true });
await copyRuntime(edgeDestination, { includePwaWorker: false });

const edgeManifest = await readFile(path.join(root, 'manifests', 'edge.manifest.json'), 'utf8');
const generatedManifest = JSON.parse(edgeManifest.replaceAll('__VERSION__', version));
if (sharingApi) {
  const origin = new URL(sharingApi).origin;
  generatedManifest.content_security_policy.extension_pages = generatedManifest.content_security_policy.extension_pages.replace("connect-src 'self'", "connect-src 'self' "+origin);
}
await writeFile(path.join(edgeDestination, 'manifest.json'), JSON.stringify(generatedManifest,null,2)+'\n');

console.log(`Built Blackboard Text ${version}`);
console.log(`  PWA:  ${path.relative(root, pwaDestination)}`);
console.log(`  Edge: ${path.relative(root, edgeDestination)}`);
