import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
const ref = process.env.GITHUB_REF_NAME;

if (!ref) {
  console.log(`Release version check skipped outside GitHub Actions (package version ${version}).`);
  process.exit(0);
}

if (ref !== `v${version}`) {
  throw new Error(`Tag ${ref} does not match package version v${version}.`);
}

console.log(`Release tag ${ref} matches package version.`);
