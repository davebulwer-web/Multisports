#!/usr/bin/env node
// Package the game for publishing: `npm run package`.
//
// Copies only what the browser needs into dist/podium-88/ and zips it to
// dist/podium-88-<version>.zip, with index.html at the top of the zip, which
// is what itch.io (and most web game hosts) expect. Zero dependencies: the zip
// is written by hand with node's built-in deflate.
//
// Left out: tools/, tests/, docs/, node_modules/ and assets/art/ (the
// per-frame source PNGs that `npm run export-sprites` bakes into
// assets/sprites/; the game never loads them).
//
// The build refuses to finish if any shipped file looks like it holds an API
// key, so a PixelLab key can never ride along by accident.

import { readFile, readdir, mkdir, rm, writeFile, stat } from 'node:fs/promises';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const NAME = 'podium-88';

// What ships. Directories are copied recursively.
const INCLUDE = [
  'index.html',
  'studio.html',
  'src',
  'assets/sprites',
  'assets/title',
  'assets/palette.gpl',
  'assets/palette.png',
];
const SKIP = [/(^|\/)\.DS_Store$/, /(^|\/)Thumbs\.db$/, /\.log$/];

// Anything that looks like a secret stops the build.
const SECRET_PATTERNS = [
  /pixl_[A-Za-z0-9]{8,}/,                       // PixelLab keys
  /PIXELLAB_API_KEY\s*[=:]\s*['"][^'"]+['"]/,   // a key pasted into code
  /sk-[A-Za-z0-9_-]{20,}/,                      // common API key shape
  /gh[pousr]_[A-Za-z0-9]{30,}/,                 // GitHub tokens
];

async function walk(path) {
  const s = await stat(path);
  if (!s.isDirectory()) return [path];
  const out = [];
  for (const e of (await readdir(path)).sort()) out.push(...await walk(join(path, e)));
  return out;
}

const files = [];
for (const p of INCLUDE) {
  for (const abs of await walk(join(root, p))) {
    const rel = relative(root, abs).split(sep).join('/');
    if (!SKIP.some((re) => re.test(rel))) files.push(rel);
  }
}

// Secret scan over every text file that ships.
const problems = [];
for (const rel of files) {
  if (!/\.(m?js|html|json|css|gpl|txt|md)$/.test(rel)) continue;
  const text = await readFile(join(root, rel), 'utf8');
  for (const re of SECRET_PATTERNS) if (re.test(text)) problems.push(`${rel} matches ${re}`);
}
if (problems.length) {
  console.error('Refusing to package: these files look like they contain a secret:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// ---- copy to dist/podium-88/ (handy for any static host) ----
const dist = join(root, 'dist');
const outDir = join(dist, NAME);
await rm(outDir, { recursive: true, force: true });
const entries = [];
for (const rel of files) {
  const data = await readFile(join(root, rel));
  await mkdir(dirname(join(outDir, rel)), { recursive: true });
  await writeFile(join(outDir, rel), data);
  entries.push({ name: rel, data });
}

// ---- zip ----
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Fixed timestamp (1988-08-08) so the same files always give the same zip.
const DOS_TIME = 0;
const DOS_DATE = ((1988 - 1980) << 9) | (8 << 5) | 8;

function zip(items) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of items) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = deflateRawSync(data, { level: 9 });
    const stored = deflated.length >= data.length;
    const body = stored ? data : deflated;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);              // version needed
    local.writeUInt16LE(0x0800, 6);          // UTF-8 names
    local.writeUInt16LE(stored ? 0 : 8, 8);  // method
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);            // version made by
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(items.length, 8);
  end.writeUInt16LE(items.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const zipName = `${NAME}-${pkg.version}.zip`;
const zipBuf = zip(entries);
await writeFile(join(dist, zipName), zipBuf);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const raw = entries.reduce((n, e) => n + e.data.length, 0);
console.log(`Packaged ${entries.length} files (${kb(raw)}) into:`);
console.log(`  dist/${NAME}/      upload this folder to any static web host`);
console.log(`  dist/${zipName}  ${kb(zipBuf.length)}, upload this to itch.io`);
