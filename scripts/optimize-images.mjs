// prebuild image pass: converts png/jpg in public/ to webp and rewrites src
// references. og.png is hand-finished and intentionally png - never converted.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const SRC_DIR = path.join(process.cwd(), 'src');
const PROTECTED = new Set(['og.png']);
const CONVERTABLE = new Set(['.png', '.jpg', '.jpeg']);
const SRC_EXTS = new Set(['.astro', '.md', '.mdx', '.ts', '.tsx', '.js', '.mjs']);
const QUALITY = 82;
const MAX_WIDTH = 2000;

const IMG_RE = /(png|jpe?g)$/i;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (CONVERTABLE.has(path.extname(entry.name).toLowerCase()) && !PROTECTED.has(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

async function rewriteReferences(oldPath, newPath) {
  let files = 0;
  for (const file of walkFiles(SRC_DIR)) {
    if (!SRC_EXTS.has(path.extname(file).toLowerCase())) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes(oldPath)) {
      fs.writeFileSync(file, text.split(oldPath).join(newPath));
      files++;
    }
  }
  return files;
}

const sources = walk(PUBLIC_DIR);
let converted = 0;
for (const file of sources) {
  const rel = path.relative(PUBLIC_DIR, file);
  const served = '/' + rel.split(path.sep).join('/');
  const servedWebp = served.replace(IMG_RE, 'webp');
  const webpFile = file.replace(IMG_RE, 'webp');
  const webpStat = fs.existsSync(webpFile) ? fs.statSync(webpFile).mtimeMs : 0;
  if (fs.statSync(file).mtimeMs < webpStat) continue; // already fresh

  try {
    await sharp(file)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(webpFile);
    const rewrote = await rewriteReferences(served, servedWebp);
    fs.unlinkSync(file);
    converted++;
    console.log(`images: ${served} -> ${servedWebp} (${rewrote} ref(s) rewritten)`);
  } catch (err) {
    console.warn(`images: skipped ${served} - ${err.message}`);
  }
}
console.log(`images: ${converted} converted, ${sources.length - converted} already fresh`);