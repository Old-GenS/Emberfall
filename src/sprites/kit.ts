export const INK = '#05030a';
export const INK_SHADOW = 'rgba(5, 3, 11, 0.58)';

export type Seg = [number, number] | [number, number, number, number];

export function slugifyUnit(name: string): string {
  return name.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* ---------- Curved Gothic Bezier + Stained-Glass Leadwork Helpers --------- */

export function vGrad(
  ctx: CanvasRenderingContext2D,
  yTop: number,
  yBot: number,
  topCol: string,
  midCol: string,
  botCol: string,
): CanvasGradient {
  const g = ctx.createLinearGradient(0, yTop, 0, yBot);
  g.addColorStop(0, topCol);
  g.addColorStop(0.5, midCol);
  g.addColorStop(1, botCol);
  return g;
}

export function traceSegs(ctx: CanvasRenderingContext2D, segs: Seg[], close = true): void {
  ctx.beginPath();
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (i === 0) {
      ctx.moveTo(s[0], s[1]);
    } else if (s.length === 2) {
      ctx.lineTo(s[0], s[1]);
    } else {
      ctx.quadraticCurveTo(s[0], s[1], s[2], s[3]);
    }
  }
  if (close) ctx.closePath();
}

/**
 * Curved Gothic Stained-Glass Form:
 * 1) Outward pitch-black sumi-ink contour (preserves razor-sharp antlers/blades/crowns)
 * 2) Multi-stop jewel/metal stained-glass fill
 * 3) Optional comic-ink core shadow mass (Darkest Dungeon chiaroscuro)
 * 4) Crisp stained-glass / gold-leaf rim stroke
 */
export function gothicShape(
  ctx: CanvasRenderingContext2D,
  segs: Seg[],
  fill: string | CanvasGradient,
  inkWidth = 8.2,
  rim?: string,
  rimAlpha = 0.52,
  shadowSegs?: Seg[],
): void {
  traceSegs(ctx, segs, true);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (inkWidth > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = inkWidth * 1.38;
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  ctx.fill();

  if (shadowSegs) {
    traceSegs(ctx, shadowSegs, true);
    ctx.fillStyle = INK_SHADOW;
    ctx.fill();
  }

  if (rim) {
    traceSegs(ctx, segs, true);
    ctx.save();
    ctx.strokeStyle = rim;
    ctx.globalAlpha *= rimAlpha;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();
  }
}

export function softBacklight(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 0.24): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = ctx.createRadialGradient(x, y, r * 0.08, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Rotating fractured gothic stained-glass rose-window halo. */
export function drawGothicHalo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  accent: string,
  time: number,
  alpha = 0.55,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(time * 0.18);
  ctx.globalAlpha *= alpha;

  softBacklight(ctx, 0, 0, radius * 1.25, color, 0.34);

  for (const r of [radius, radius * 0.76]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.0;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const rays = 12;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const tip = i % 2 === 0 ? radius * 1.16 : radius * 0.96;
    ctx.save();
    ctx.globalAlpha *= 0.52;
    gothicShape(
      ctx,
      [
        [Math.cos(a - 0.1) * radius * 0.76, Math.sin(a - 0.1) * radius * 0.76],
        [Math.cos(a) * tip, Math.sin(a) * tip],
        [Math.cos(a + 0.1) * radius * 0.76, Math.sin(a + 0.1) * radius * 0.76],
      ],
      i % 2 === 0 ? color : accent,
      2.8,
      '#fff5d1',
      0.55,
    );
    ctx.restore();
  }
  ctx.restore();
}

export interface PaintOpts {
  edge?: string;          // outline colour: a dark shade of the unit's own palette, never INK/#000
  edgeWidth?: number;     // default 1.6; never above 2.4
  shade?: Seg[];          // sub-shape painted in shadeColor (core shadow), clipped to the main shape
  shadeColor?: string;    // default 'rgba(8,4,14,0.38)'
  light?: Seg[];          // sub-shape painted in lightColor (lit plane), clipped to the main shape
  lightColor?: string;    // default 'rgba(255,240,215,0.16)'
}

export function paintShape(
  ctx: CanvasRenderingContext2D,
  segs: Seg[],
  fill: string | CanvasGradient,
  o: PaintOpts = {},
): void {
  traceSegs(ctx, segs, true);
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.save();
  traceSegs(ctx, segs, true);
  ctx.clip();
  if (o.shade && o.shade.length) {
    traceSegs(ctx, o.shade, true);
    ctx.fillStyle = o.shadeColor ?? 'rgba(8,4,14,0.38)';
    ctx.fill();
  }
  if (o.light && o.light.length) {
    traceSegs(ctx, o.light, true);
    ctx.fillStyle = o.lightColor ?? 'rgba(255,240,215,0.16)';
    ctx.fill();
  }
  ctx.restore();

  traceSegs(ctx, segs, true);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = o.edge ?? 'rgba(10,6,16,0.85)';
  ctx.lineWidth = o.edgeWidth ?? 1.6;
  ctx.stroke();
}
