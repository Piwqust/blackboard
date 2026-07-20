import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(root, 'dist');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const version = packageJson.version;

const staticFiles = [
  'index.html',
  'editor.html',
  'editor.css',
  'editor.js',
  'privacy.html',
  'service-worker.js',
  'site.webmanifest'
];

async function copyFile(relativePath, destination) {
  const source = path.join(root, relativePath);
  const target = path.join(destination, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target);
}

async function copyRuntime(destination, { includePwaWorker }) {
  await mkdir(destination, { recursive: true });
  await Promise.all(staticFiles.map(file => copyFile(file, destination)));
  await cp(path.join(root, 'src'), path.join(destination, 'src'), { recursive: true });
  await cp(path.join(root, 'icons'), path.join(destination, 'icons'), { recursive: true });
  await copyFile('fonts/InterVariable.woff2', destination);
  await copyFile('fonts/InterTight-Variable.ttf', destination);
  await copyFile('fonts/BoardGrotesqueSans-Light.otf', destination);
  await copyFile('fonts/BoardGrotesqueSans-Regular.otf', destination);
  await copyFile('fonts/BoardGrotesqueSans-Medium.otf', destination);

  if (includePwaWorker) {
    const worker = await readFile(path.join(root, 'pwa-sw.js'), 'utf8');
    await writeFile(path.join(destination, 'pwa-sw.js'), worker.replaceAll('__APP_VERSION__', version));
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
await writeFile(path.join(edgeDestination, 'manifest.json'), edgeManifest.replaceAll('__VERSION__', version));

console.log(`Built Blackboard Text ${version}`);
console.log(`  PWA:  ${path.relative(root, pwaDestination)}`);
console.log(`  Edge: ${path.relative(root, edgeDestination)}`);
