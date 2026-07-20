import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkedFiles = [
  'editor.js',
  'service-worker.js',
  'pwa-sw.js',
  ...((await readdir(path.join(root, 'src', 'core'))).filter(file => file.endsWith('.js')).map(file => `src/core/${file}`)),
  ...((await readdir(path.join(root, 'src', 'ui'))).filter(file => file.endsWith('.js')).map(file => `src/ui/${file}`))
];

for (const relativePath of checkedFiles) {
  const result = spawnSync(process.execPath, ['--check', relativePath], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

for (const relativePath of ['manifest.json', 'manifests/edge.manifest.json', 'site.webmanifest', 'package.json']) {
  JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

console.log(`Syntax and JSON checks passed for ${checkedFiles.length} JavaScript files.`);
