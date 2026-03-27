import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = parseDir(process.argv.slice(2));
const files = walk(dir);

const manifest = files.map((file) => ({
  file,
  sha256: createHash('sha256').update(readFileSync(join(dir, file))).digest('hex'),
}));

writeFileSync(join(dir, 'checksums.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
writeFileSync(
  join(dir, 'checksums.txt'),
  manifest.map(({ file, sha256 }) => `${sha256}  ${file}`).join('\n') + '\n',
  'utf8',
);

function parseDir(argv) {
  const idx = argv.indexOf('--dir');
  if (idx < 0 || !argv[idx + 1]) {
    throw new Error('Usage: node scripts/release/generate-checksums.mjs --dir <path>');
  }
  return resolve(argv[idx + 1]);
}

function walk(dir, prefix = '') {
  return readdirSync(join(dir, prefix)).flatMap((entry) => {
    if (entry === 'checksums.json' || entry === 'checksums.txt') return [];
    const rel = prefix ? join(prefix, entry) : entry;
    const abs = join(dir, rel);
    return statSync(abs).isDirectory() ? walk(dir, rel) : [rel];
  }).sort();
}
