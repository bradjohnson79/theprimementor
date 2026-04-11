/**
 * Converts PNG/JPEG assets under src/assets and public/ to WebP using sharp.
 * Usage:
 *   node scripts/optimize-images.mjs
 *   node scripts/optimize-images.mjs --delete-sources   # remove originals after success
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const SCAN_ROOTS = [path.join(ROOT, "src/assets"), path.join(ROOT, "public")];

const EXT_RE = /\.(png|jpe?g)$/i;
const deleteSources = process.argv.includes("--delete-sources");

async function collectRasterFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await collectRasterFiles(full)));
    } else if (EXT_RE.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const files = [];
  for (const root of SCAN_ROOTS) {
    files.push(...(await collectRasterFiles(root)));
  }

  if (files.length === 0) {
    console.log("No PNG/JPEG files found under src/assets or public.");
    return;
  }

  let converted = 0;
  for (const inputPath of files) {
    const dir = path.dirname(inputPath);
    const base = path.basename(inputPath).replace(EXT_RE, "");
    const outPath = path.join(dir, `${base}.webp`);

    await sharp(inputPath)
      .webp({ quality: 82, effort: 4 })
      .toFile(outPath);

    const inStat = await fs.stat(inputPath);
    const outStat = await fs.stat(outPath);
    const savedPct = Math.round((1 - outStat.size / inStat.size) * 100);
    console.log(`${path.relative(ROOT, inputPath)} → ${path.relative(ROOT, outPath)} (${savedPct}% smaller)`);
    converted += 1;

    if (deleteSources) {
      await fs.unlink(inputPath);
    }
  }

  console.log(`\nDone: ${converted} file(s) converted to WebP${deleteSources ? "; sources removed." : "."}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
