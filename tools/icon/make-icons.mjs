import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE = path.join(ROOT, 'tools/icon/source.png');
const OUT_DIR = path.join(ROOT, 'public/icons');
const BACKGROUND = '#07050c';

/** Flatten onto the game's dark background so every icon is opaque RGB, never alpha. */
const opaque = () => sharp(SOURCE).flatten({ background: BACKGROUND }).removeAlpha();

async function writeFullBleed(size, filename) {
  await opaque()
    .resize(size, size, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, filename));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  await writeFullBleed(192, 'icon-192.png');
  await writeFullBleed(512, 'icon-512.png');
  await writeFullBleed(180, 'apple-touch-icon.png');
  await writeFullBleed(32, 'favicon-32.png');

  // Maskable icons keep their content inside a safe zone: a 400 px emblem centred on 512 px.
  const emblem = await opaque()
    .resize(400, 400, { fit: 'fill' })
    .png()
    .toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 3, background: BACKGROUND },
  })
    .composite([{ input: emblem, left: 56, top: 56 }])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, 'icon-maskable-512.png'));

  console.log('icons: wrote 5 PNGs to public/icons');
}

await main();
