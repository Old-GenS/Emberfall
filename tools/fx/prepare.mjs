// Prepare painted battle effects: art/fx/<name>.png (effect on pure black) ->
// public/assets/fx/<name>.webp, cropped to the glowing part and kept on black.
// The game draws them with additive blending, so black is invisible and no keying is needed.
import sharp from 'sharp';
import { readFileSync, existsSync } from 'node:fs';

const PICKS = JSON.parse(readFileSync('tools/fx/picks.json', 'utf8'));
const MAX = 384;
const THRESH = 36; // luminance below this counts as background

for (const [name, src] of Object.entries(PICKS)) {
  const file = `art/fx/${src}.png`;
  if (!existsSync(file)) { console.log(`skip ${name}: ${file} missing`); continue; }
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (l > THRESH) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  // Square crop around the effect's centre, padded so glows fade out before the edge.
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const side = Math.min(Math.max(w, h), Math.round(Math.max(x1 - x0, y1 - y0) * 1.12) + 16);
  const left = Math.round(Math.min(Math.max(0, cx - side / 2), w - side));
  const top = Math.round(Math.min(Math.max(0, cy - side / 2), h - side));
  // Edge darkness check: additive sprites with bright edges show a visible square.
  const edge = [];
  for (let k = 0; k < side; k++) for (const [x, y] of [[left + k, top], [left + k, top + side - 1], [left, top + k], [left + side - 1, top + k]]) {
    const i = (y * w + x) * 3; edge.push(Math.max(data[i], data[i + 1], data[i + 2]));
  }
  const edgeMax = Math.max(...edge);
  const out = `public/assets/fx/${name}.webp`;
  const size = Math.min(MAX, side);
  // Fade the outer 8% to black so no square ever shows.
  const vignette = Buffer.from(`<svg width="${size}" height="${size}"><defs><radialGradient id="g" cx="50%" cy="50%" r="71%"><stop offset="84%" stop-color="#fff"/><stop offset="100%" stop-color="#000"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  await sharp(file).removeAlpha().extract({ left, top, width: side, height: side }).resize(size, size)
    .composite([{ input: vignette, blend: 'multiply' }]).webp({ quality: 86 }).toFile(out);
  console.log(`${name}: ${src} crop ${side}px -> ${size}px, edge max ${edgeMax}${edgeMax > 40 ? ' (WARN bright edge)' : ''}`);
}
