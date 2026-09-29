// Checks that every bundle has the size the website displays (dist/downloads/sizes.json).
// Usage: node scripts/check-bundles.mjs <directory or base URL>
//   node scripts/check-bundles.mjs dist/downloads
//   node scripts/check-bundles.mjs https://histoatlas.com/bundles/downloads
import { readFileSync, statSync } from 'node:fs';

const base = process.argv[2]?.replace(/\/$/, '');
if (!base) throw new Error('usage: check-bundles.mjs <directory or base URL>');

const sizes = JSON.parse(readFileSync('dist/downloads/sizes.json', 'utf-8'));

async function actualSize(file) {
  if (!base.startsWith('http')) return statSync(`${base}/${file}`).size;
  const res = await fetch(`${base}/${file}?cb=${Date.now()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.arrayBuffer()).byteLength;
}

let failures = 0;
for (const [key, expected] of Object.entries(sizes)) {
  const file = key === 'all' ? 'histoatlas.zip' : `${key}.zip`;
  const actual = await actualSize(file).catch((e) => e.message);
  if (actual !== expected) {
    failures++;
    console.error(`MISMATCH ${file}: site shows ${expected} bytes, found ${actual}`);
  }
}
console.log(`${Object.keys(sizes).length - failures} of ${Object.keys(sizes).length} bundles match at ${base}`);
process.exit(failures ? 1 : 0);
