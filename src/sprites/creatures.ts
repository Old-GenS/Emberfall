import type { Unit } from '../combat';
import type { BodyKind } from '../data';
import { slugifyUnit, vGrad, softBacklight, paintShape, drawGothicHalo, type Seg } from './kit';
import { drawBossMoltenWarden, drawBossPaleStag, drawBossWintersHerald, drawBossLeviathanEye, drawBossAshenKing } from './bosses';

/* --------------------- BESPOKE BOSS & ENEMY DISPATCHER -------------------- */

export function drawCreatureGothic(
  ctx: CanvasRenderingContext2D,
  body: BodyKind,
  c: { main: string; dark: string; glow: string },
  u: Unit,
  time: number,
  isAlly: boolean,
): void {
  const slug = u.defId ?? slugifyUnit(u.name);
  const breath = Math.sin(time * 2.3 + u.uid * 1.1) * 2.2;
  const atk = u.anim.attack;
  const cast = u.anim.cast;

  softBacklight(ctx, 0, -86, u.boss ? 94 : 64, c.glow, u.boss ? 0.28 : 0.2);

  if (u.boss) {
    drawGothicHalo(ctx, -4, -108, 64, c.main, c.glow, time * (1 + cast), 0.58 + cast * 0.25);
  }

  if (isAlly) {
    drawWolf(ctx, c, time, u.uid, breath, atk, cast, 'spirit');
    return;
  }

  if (slug === 'molten-warden') { drawBossMoltenWarden(ctx, time, breath, atk); return; }
  if (slug === 'pale-stag') { drawBossPaleStag(ctx, time, breath, atk); return; }
  if (slug === 'winters-herald' || slug === 'winter-s-herald') { drawBossWintersHerald(ctx, time, atk); return; }
  if (slug === 'leviathan-eye') { drawBossLeviathanEye(ctx, time, breath, atk); return; }
  if (slug === 'ashen-king' || body === 'king') { drawBossAshenKing(ctx, time, breath, atk); return; }
  if (slug === 'tide-revenant') { drawTideRevenant(ctx, c, time, u.uid, breath, atk, cast); return; }

  switch (body) {
    case 'imp': drawCinderImp(ctx, c, time, u.uid, breath, atk, cast); break;
    case 'hound': drawWolf(ctx, { main: '#e87d4a', dark: '#5e231c', glow: '#ffd275' }, time, u.uid, breath, atk, cast, 'ash'); break;
    case 'wolf': drawWolf(ctx, c, time, u.uid, breath, atk, cast, 'rime'); break;
    case 'brute': drawMagmaBrute(ctx, c, time, u.uid, breath, atk, cast); break;
    case 'golem': drawIceGolem(ctx, c, time, u.uid, breath, atk, cast); break;
    case 'stalker': drawBrambleStalker(ctx, c, time, u.uid, breath, atk, cast); break;
    case 'wisp': drawSporeWisp(ctx, c, time, u.uid, breath, atk, cast); break;
    case 'treant': drawHollowTreant(ctx, c, time, u.uid, breath, atk, cast); break;
    case 'wraith': drawFrostWraith(ctx, c, time, u.uid, breath, atk, cast); break;
    case 'revenant': drawDrownedAcolyte(ctx, c, time, u.uid, breath, atk, cast); break;
    case 'sentinel': drawCoralSentinel(ctx, c, time, u.uid, breath, atk, cast); break;
    case 'crab': drawBossLeviathanEye(ctx, time, breath, atk); break;
    case 'knight': drawVoidKnight(ctx, c, time, u.uid, breath, atk, cast); break;
    case 'seraph': drawAshSeraph(ctx, c, time, u.uid, breath, atk, cast); break;
    case 'wyrm': drawDuskWyrm(ctx, c, time, u.uid, breath, atk, cast); break;
    default: drawVoidKnight(ctx, c, time, u.uid, breath, atk, cast); break;
  }
}

/* --------------------------- PAINTED ART HELPERS -------------------------- */

interface Pal { main: string; dark: string; glow: string }

function parseHex(h: string): [number, number, number] {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((x) => x + x).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(A[0] + (B[0] - A[0]) * k);
  const g = Math.round(A[1] + (B[1] - A[1]) * k);
  const bl = Math.round(A[2] + (B[2] - A[2]) * k);
  return `rgb(${r},${g},${bl})`;
}

function deep(c: Pal): string {
  return mix(c.dark, '#0a0712', 0.28);
}

/** Three-tone palette gradient: lit crest -> body -> shadowed base. */
function toneGrad(ctx: CanvasRenderingContext2D, c: Pal, yTop: number, yBot: number, up = 0.34, down = 0.68): CanvasGradient {
  return vGrad(ctx, yTop, yBot, mix(c.main, c.glow, up), c.main, mix(c.main, c.dark, down));
}

function darkGrad(ctx: CanvasRenderingContext2D, c: Pal, yTop: number, yBot: number, up = 0.28): CanvasGradient {
  return vGrad(ctx, yTop, yBot, mix(c.dark, c.main, up), c.dark, deep(c));
}

/** A broad horizontal slab used as a clipped shade / light sub-shape. */
function slab(y0: number, y1: number): Seg[] {
  return [[-320, y0], [320, y0], [320, y1], [-320, y1]];
}

/**
 * Paint a major body part with the full painted treatment: palette edge,
 * top-to-bottom gradient, clipped core-shadow slab and clipped lit slab.
 */
function part(
  ctx: CanvasRenderingContext2D,
  segs: Seg[],
  c: Pal,
  yTop: number,
  yBot: number,
  fill?: string | CanvasGradient,
  shade?: Seg[],
  light?: Seg[],
): void {
  const span = Math.max(1, yBot - yTop);
  paintShape(ctx, segs, fill ?? toneGrad(ctx, c, yTop, yBot), {
    edge: deep(c),
    edgeWidth: 1.8,
    shade: shade ?? slab(yTop + span * 0.58, yBot + 40),
    light: light ?? slab(yTop - 40, yTop + span * 0.28),
    shadeColor: 'rgba(5,3,10,0.34)',
    lightColor: 'rgba(255,245,225,0.16)',
  });
}

/** Organic tapered limb from A to B with a sideways bend. */
function taper(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, bend = 0): Seg[] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const mx = (x0 + x1) * 0.5 + nx * bend;
  const my = (y0 + y1) * 0.5 + ny * bend;
  const cw = (w0 + w1) * 0.5;
  return [
    [x0 + nx * w0, y0 + ny * w0],
    [mx + nx * cw, my + ny * cw, x1 + nx * w1, y1 + ny * w1],
    [x1 - nx * w1, y1 - ny * w1],
    [mx - nx * cw, my - ny * cw, x0 - nx * w0, y0 - ny * w0],
  ];
}

function limb(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w0: number,
  w1: number,
  bend = 0,
  fill?: string | CanvasGradient,
): void {
  const top = Math.min(y0, y1) - Math.max(w0, w1);
  const bot = Math.max(y0, y1) + Math.max(w0, w1);
  part(ctx, taper(x0, y0, x1, y1, w0, w1, bend), c, top, bot, fill ?? toneGrad(ctx, c, top, bot));
}

function detail(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, color: string, width = 1, alpha = 0.5): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.min(width, 1.2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
    else ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.stroke();
  ctx.restore();
}

function spec(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, alpha = 0.55): void {
  detail(ctx, [[x0, y0], [x1, y1]], 'rgba(255,255,255,0.92)', 1, alpha);
  detail(ctx, [[x0, y0 - 1], [x1, y1 - 1]], 'rgba(255,255,255,0.75)', 0.8, alpha * 0.5);
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 0.65): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
  g.addColorStop(0, color);
  g.addColorStop(0.35, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, c: Pal, r = 2.4, alpha = 0.8): void {
  dot(ctx, x, y, r * 2.5, c.glow, alpha * 0.55);
  paintShape(ctx, [[x - r, y], [x, y - r * 0.72], [x + r, y], [x, y + r * 0.72]], c.glow, {
    edge: mix(c.dark, c.glow, 0.2),
    edgeWidth: 1.2,
    shade: [[x - r, y], [x + r, y], [x + r, y + r], [x - r, y + r]],
    shadeColor: 'rgba(60,20,20,0.25)',
  });
  dot(ctx, x + r * 0.2, y - r * 0.2, r * 1.2, '#fffbe8', 0.8);
}

function cracks(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, c: Pal, alpha = 0.55): void {
  detail(ctx, pts, c.glow, 1.05, alpha);
  for (let i = 1; i < pts.length - 1; i += 2) {
    dot(ctx, pts[i][0], pts[i][1], 2.4, c.glow, alpha * 0.4);
  }
}

/* ------------------------------- ASH / RIME WOLF -------------------------- */

function wolfLeg(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  hipX: number, hipY: number,
  kneeX: number, kneeY: number,
  ankleX: number, ankleY: number,
  pawX: number, pawY: number,
  far: boolean,
): void {
  const p: Pal = far
    ? { main: mix(c.main, c.dark, 0.42), dark: c.dark, glow: mix(c.glow, c.dark, 0.3) }
    : c;
  limb(ctx, p, hipX, hipY, kneeX, kneeY, 7.5, 5.2, 2);
  limb(ctx, p, kneeX, kneeY, ankleX, ankleY, 5.0, 3.4, -2);
  limb(ctx, p, ankleX, ankleY, pawX, pawY, 3.4, 4.2, 0);
  part(ctx, [[pawX - 3, pawY - 2], [pawX + 7, pawY - 2], [pawX + 10, pawY + 1], [pawX - 4, pawY + 1]], p,
    pawY - 3, pawY + 2, darkGrad(ctx, p, pawY - 3, pawY + 2));
  detail(ctx, [[pawX + 1, pawY - 1], [pawX + 8, pawY]], p.glow, 0.9, 0.35);
}

function drawWolf(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  time: number,
  uid: number,
  breath: number,
  atk: number,
  cast: number,
  kind: 'rime' | 'ash' | 'spirit',
): void {
  const rise = breath * 0.55;
  const wag = Math.sin(time * 4.2 + uid * 1.3) * 8;
  const lean = atk * 0.24;
  const spirit = kind === 'spirit';
  const ice = kind === 'rime' || spirit;
  const ash = kind === 'ash';

  ctx.save();
  if (spirit) {
    ctx.globalAlpha *= 0.8;
    softBacklight(ctx, 0, -62, 92, c.glow, 0.34);
  }
  ctx.translate(0, -22);
  ctx.rotate(lean);
  ctx.translate(0, 22);

  // Far legs.
  const stride = Math.sin(time * 3.1 + uid) * 1.6;
  wolfLeg(ctx, c, -26, -52 + rise, -36, -30, -42, -16, -30 + stride, -2, true);
  wolfLeg(ctx, c, 18, -54 + rise, 32, -34, 37, -18, 49 - stride, -2, true);

  // Bushy tail with its own lazy swing.
  part(ctx,
    [[-30, -60 + rise], [-52, -70 + rise, -66, -58 + wag * 0.4],
      [-62, -46 + wag * 0.5], [-74, -40 + wag, -58, -32 + wag * 0.5],
      [-44, -32 + rise, -32, -42 + rise]],
    c, -78, -30, ice ? toneGrad(ctx, c, -78, -30, 0.6, 0.55) : toneGrad(ctx, c, -78, -30),
  );
  detail(ctx, [[-40, -54 + rise], [-56, -52 + wag * 0.4], [-66, -44 + wag * 0.6]], c.glow, 1, 0.42);
  detail(ctx, [[-38, -44 + rise], [-56, -42 + wag * 0.5], [-66, -37 + wag * 0.7]], mix(c.main, c.dark, 0.55), 1, 0.5);

  // Ribcage / arched torso.
  part(ctx,
    [[-38, -50 + rise], [-30, -74 + rise, -8, -84 + rise], [16, -84 + rise],
      [38, -70 + rise, 38, -58 + rise], [24, -38 + rise, 4, -34 + rise],
      [-20, -34 + rise, -38, -50 + rise]],
    c, -86, -32, toneGrad(ctx, c, -86, -32),
  );
  // Belly / lower flank core shadow.
  detail(ctx, [[-28, -40 + rise], [-6, -36 + rise], [20, -42 + rise]], deep(c), 1.1, 0.5);

  if (ash) {
    // Ember cracks along the ribs.
    cracks(ctx, [[-12, -72 + rise], [-8, -60 + rise], [-16, -52 + rise]], c, 0.55);
    cracks(ctx, [[2, -76 + rise], [5, -62 + rise], [-1, -50 + rise]], c, 0.6);
    cracks(ctx, [[16, -72 + rise], [13, -60 + rise], [19, -50 + rise]], c, 0.55);
    // Charred plate shards.
    part(ctx, [[-26, -78 + rise], [-14, -70 + rise], [-20, -62 + rise], [-30, -68 + rise]], c,
      -80, -60, darkGrad(ctx, c, -80, -60));
    part(ctx, [[8, -82 + rise], [20, -76 + rise], [14, -66 + rise], [4, -72 + rise]], c,
      -84, -64, darkGrad(ctx, c, -84, -64));
    // Smoke wisps from the back.
    for (let i = 0; i < 3; i++) {
      const bx = -16 + i * 14;
      const sway = Math.sin(time * 2.0 + uid + i * 1.7) * 5;
      detail(ctx, [[bx, -78 + rise], [bx + sway * 0.4 - 3, -92 + rise], [bx + sway, -104 + rise]], '#b9a79a', 1, 0.4);
      detail(ctx, [[bx + 3, -80 + rise], [bx + 5 + sway * 0.5, -96 + rise]], '#8f7e78', 0.9, 0.32);
    }
  }

  if (ice) {
    // Layered jagged fur strips along the spine and flanks.
    for (let i = 0; i < 6; i++) {
      const bx = -28 + i * 11;
      const sway = Math.sin(time * 2.7 + uid + i * 0.8) * (1.2 + i * 0.15);
      const top = -80 + rise + (i % 2 === 0 ? -4 : 0);
      part(ctx,
        [[bx, -70 + rise], [bx + 3 + sway, top - 8], [bx + 7, top - 2], [bx + 9 + sway, -74 + rise], [bx + 4, -70 + rise]],
        c, top - 10, -68, toneGrad(ctx, c, top - 10, -68, 0.65, 0.5),
      );
    }
    for (let i = 0; i < 4; i++) {
      const bx = -24 + i * 14;
      part(ctx, [[bx, -38 + rise], [bx + 2, -26 + rise], [bx + 7, -36 + rise]], c,
        -40, -24, toneGrad(ctx, c, -40, -24, 0.5, 0.6));
    }
  }

  // Near legs.
  wolfLeg(ctx, c, -18, -50 + rise, -28, -32, -32, -16, -20 - stride, -2, false);
  wolfLeg(ctx, c, 24, -54 + rise, 38, -34, 43, -18, 55 + stride, -2, false);
  if (ice) {
    detail(ctx, [[26, -48 + rise], [40, -44 + rise], [48, -38 + rise]], c.glow, 1, 0.35);
    detail(ctx, [[-18, -44 + rise], [-28, -38 + rise], [-32, -30 + rise]], c.glow, 1, 0.3);
  }
  if (ash) {
    cracks(ctx, [[30, -58 + rise], [34, -46 + rise], [40, -38 + rise]], c, 0.5);
  }

  // Neck and head, lunge forward on attack.
  ctx.save();
  ctx.translate(34 + atk * 17, -68 + rise - cast * 6);
  ctx.rotate(-0.05 + atk * 0.1 - cast * 0.14);
  part(ctx, [[-12, 8], [-6, -14, 4, -22], [14, -18], [16, -4], [4, 8]], c, -24, 10,
    toneGrad(ctx, c, -24, 10));
  detail(ctx, [[-6, -12], [2, -18], [10, -14]], c.glow, 1, 0.35);

  // Ears.
  part(ctx, [[-4, -22], [-6, -38], [4, -28]], c, -40, -20, toneGrad(ctx, c, -40, -20, 0.6, 0.5));
  part(ctx, [[8, -24], [13, -40], [17, -24]], c, -42, -22, toneGrad(ctx, c, -42, -22, 0.4, 0.6));
  // Skull.
  part(ctx, [[-8, -18], [-2, -32, 12, -30], [22, -20, 30, -14],
    [24, -4, 12, 0], [-2, 0, -8, -8]], c, -34, 2, toneGrad(ctx, c, -34, 2));
  // Muzzle and nose.
  part(ctx, [[20, -18], [36, -14, 44, -12], [40, -5], [24, -4]], c, -20, -2,
    toneGrad(ctx, c, -20, -2, 0.5, 0.6));
  part(ctx, [[42, -12], [47, -11], [43, -6]], c, -13, -4, darkGrad(ctx, c, -13, -4));
  // Open jaw.
  ctx.save();
  ctx.translate(22, -6);
  ctx.rotate(atk * 0.55);
  part(ctx, [[0, 0], [16, -2, 22, 3], [10, 8], [0, 6]], c, -4, 10,
    toneGrad(ctx, c, -4, 10, 0.4, 0.6));
  detail(ctx, [[6, 3], [10, 3]], '#e8e0d0', 1, 0.55);
  detail(ctx, [[13, 3], [17, 3]], '#e8e0d0', 1, 0.55);
  ctx.restore();
  eye(ctx, 18, -15, c, 2.5, spirit ? 0.95 : 0.85);
  // Frost breath puffs / spectral motes.
  if (ice) {
    for (let i = 0; i < 4; i++) {
      const px = 48 + i * 7 + Math.sin(time * 2.4 + uid + i) * 2;
      const py = -10 - i * 6 + Math.cos(time * 2.1 + i) * 2;
      dot(ctx, px, py, 4 - i * 0.5, c.glow, 0.25 + cast * 0.35);
    }
  }
  if (cast > 0.03) {
    dot(ctx, 45, -10, 6 + cast * 12, c.glow, 0.4 + cast * 0.4);
  }
  ctx.restore();

  if (spirit) {
    // Drifting spirit motes with their own phase.
    for (let i = 0; i < 5; i++) {
      const px = Math.sin(time * 1.1 + uid + i * 1.9) * 30;
      const py = -28 + Math.cos(time * 1.5 + uid + i * 1.3) * 22 - i * 3;
      dot(ctx, px, py, 2.6, c.glow, 0.55);
      dot(ctx, px + 2, py - 2, 1.3, '#ffffff', 0.5);
    }
  }
  ctx.restore();
}

/* -------------------------------- CINDER IMP ------------------------------ */

function drawCinderImp(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  time: number,
  uid: number,
  breath: number,
  atk: number,
  cast: number,
): void {
  const rise = breath * 0.6;
  const flap = Math.sin(time * 6.4 + uid) * 9;
  const tailSway = Math.sin(time * 2.6 + uid) * 7;

  ctx.save();
  ctx.translate(0, -6);
  ctx.rotate(atk * 0.27);
  ctx.translate(0, 6);

  // Long barbed tail with a burning tip.
  part(ctx,
    [[-10, -46 + rise], [-28, -42 + tailSway * 0.3, -44, -34 + tailSway * 0.6],
      [-54, -26 + tailSway, -62, -38 + tailSway], [-54, -30 + tailSway, -46, -31 + tailSway * 0.6]],
    c, -52, -24, toneGrad(ctx, c, -52, -24, 0.4, 0.6),
  );
  detail(ctx, [[-16, -43 + rise], [-32, -36 + tailSway * 0.5]], c.glow, 1, 0.4);
  part(ctx,
    [[-62, -38 + tailSway], [-68, -48 + tailSway, -74, -44 + tailSway],
      [-70, -36 + tailSway, -60, -33 + tailSway]],
    { main: c.glow, dark: c.main, glow: '#fff6d0' }, -50, -32,
    vGrad(ctx, -50, -30, '#fffbe0', c.glow, c.main),
  );
  dot(ctx, -68, -41 + tailSway, 7, c.glow, 0.45);

  // Far bat wing.
  part(ctx,
    [[-4, -76 + rise], [-22, -102 + flap * 0.7, -46, -94 + flap],
      [-40, -80 + flap * 0.6, -56, -70 + flap * 0.4], [-34, -70, -22, -62 + rise]],
    { main: mix(c.main, c.dark, 0.4), dark: c.dark, glow: c.glow }, -106, -60,
    darkGrad(ctx, c, -106, -60),
  );
  // Near bat wing.
  part(ctx,
    [[2, -78 + rise], [-18, -112 + flap, -44, -104 + flap],
      [-36, -88 + flap * 0.6, -52, -78 + flap * 0.4], [-30, -76, -14, -66 + rise]],
    c, -116, -64, toneGrad(ctx, c, -116, -64, 0.45, 0.62),
  );
  detail(ctx, [[-4, -80 + rise], [-20, -104 + flap], [-42, -100 + flap]], c.glow, 1, 0.45);
  detail(ctx, [[-2, -78 + rise], [-30, -82 + flap * 0.5], [-48, -78 + flap * 0.4]], c.main, 1, 0.45);

  // Legs: digitigrade with claws.
  limb(ctx, { main: mix(c.main, c.dark, 0.35), dark: c.dark, glow: c.glow }, -14, -42 + rise, -22, -24, 6.5, 4.5, 1);
  limb(ctx, { main: mix(c.main, c.dark, 0.35), dark: c.dark, glow: c.glow }, -22, -24, -14, -10, 4.5, 3.2, 1);
  part(ctx, [[-22, -12], [-6, -4], [-4, 0], [-24, 0]], c, -14, 2, darkGrad(ctx, c, -14, 2));
  detail(ctx, [[-8, -4], [-3, -2]], c.glow, 0.9, 0.4);
  limb(ctx, c, -2, -42 + rise, 6, -22, 7, 4.6, 1);
  limb(ctx, c, 6, -22, 12, -8, 4.6, 3.0, 1);
  part(ctx, [[4, -12], [20, -4], [22, 0], [2, 0]], c, -14, 2, toneGrad(ctx, c, -14, 2, 0.4, 0.65));

  // Hunched torso with a glowing cracked belly.
  part(ctx,
    [[-14, -44 + rise], [-12, -68 + rise, 2, -80 + rise], [18, -74 + rise],
      [22, -54 + rise, 14, -38 + rise], [0, -34 + rise, -10, -36 + rise]],
    c, -82, -32, toneGrad(ctx, c, -82, -32, 0.4, 0.62),
  );
  part(ctx, [[2, -56 + rise], [18, -50 + rise], [15, -38 + rise], [0, -40 + rise]], c,
    -58, -36, toneGrad(ctx, c, -58, -36, 0.7, 0.5));
  cracks(ctx, [[-2, -59 + rise], [5, -54 + rise], [3, -46 + rise]], c, 0.6);
  cracks(ctx, [[9, -52 + rise], [13, -45 + rise], [10, -39 + rise]], c, 0.5);

  // Far arm.
  limb(ctx, { main: mix(c.main, c.dark, 0.35), dark: c.dark, glow: c.glow }, 12, -74 + rise, 24, -58 + rise, 4.5, 3.2, -2);

  // Near arm: claw swipe on attack.
  const handX = 30 + atk * 30;
  const handY = -54 + rise - atk * 8;
  limb(ctx, c, 14, -74 + rise, 28 - atk * 2, -66 + rise, 5.5, 3.6, 2);
  limb(ctx, c, 28 - atk * 2, -66 + rise, handX, handY, 3.6, 2.4, 1);
  for (let i = 0; i < 3; i++) {
    const fy = handY - 4 + i * 3;
    limb(ctx, c, handX, handY, handX + 9 + i * 2, fy, 1.8, 0.7, 0.5);
  }
  dot(ctx, handX + 3, handY, 4, c.glow, 0.3);

  // Horned demon skull.
  ctx.save();
  ctx.translate(16, -92 + rise - cast * 4);
  ctx.rotate(-0.06 + atk * 0.08 - cast * 0.08);
  part(ctx, [[-12, 8], [-10, -12, 2, -18], [16, -14], [22, -2], [14, 10], [0, 12]], c,
    -20, 12, toneGrad(ctx, c, -20, 12));
  // Horns.
  part(ctx, [[-8, -10], [-20, -24, -26, -32], [-12, -22, -1, -12]], c,
    -34, -8, toneGrad(ctx, c, -34, -8, 0.55, 0.5));
  part(ctx, [[8, -13], [16, -28, 26, -34], [15, -24, 13, -12]], c,
    -36, -10, toneGrad(ctx, c, -36, -10, 0.4, 0.6));
  eye(ctx, 10, -6, c, 2.4, 0.9);
  // Fanged mouth, opens for the cast spit.
  ctx.save();
  ctx.translate(14, 4);
  ctx.rotate(cast * 0.55);
  part(ctx, [[0, 0], [10, 1, 14, 4], [2, 7], [0, 4]], { main: c.dark, dark: deep(c), glow: c.glow },
    -2, 8, darkGrad(ctx, c, -2, 8));
  detail(ctx, [[4, 3], [7, 3]], '#f2e3c4', 1, 0.55);
  detail(ctx, [[9, 3], [12, 3]], '#f2e3c4', 1, 0.55);
  ctx.restore();
  if (cast > 0.03) {
    dot(ctx, 13, 7, 4 + cast * 11, c.glow, 0.4 + cast * 0.45);
    dot(ctx, 13, 7, 2 + cast * 3, '#fff9df', 0.7);
  }
  ctx.restore();

  ctx.restore();
}

/* ------------------------------- MAGMA BRUTE ------------------------------ */

function drawMagmaBrute(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  time: number,
  uid: number,
  breath: number,
  atk: number,
  cast: number,
): void {
  const rise = breath * 0.55;
  const t = atk;
  const ember = 0.35 + 0.2 * Math.sin(time * 3.0 + uid);
  const farSway = Math.sin(time * 2.1 + uid) * 5 * (1 - t);
  const nearSway = Math.sin(time * 1.7 + uid + 1.2) * 5 * (1 - t);

  ctx.save();
  ctx.translate(0, -4);
  ctx.rotate(atk * 0.20);
  ctx.translate(0, 4);

  // Far leg.
  limb(ctx, { main: mix(c.main, c.dark, 0.5), dark: c.dark, glow: c.glow }, -18, -66 + rise, -26, -30, 12, 8, 2);
  limb(ctx, { main: mix(c.main, c.dark, 0.5), dark: c.dark, glow: c.glow }, -26, -30, -28, -6, 8, 10, 0);
  part(ctx, [[-42, -8], [-8, -8], [-6, 0], [-44, 0]], { main: mix(c.main, c.dark, 0.45), dark: c.dark, glow: c.glow },
    -10, 2, darkGrad(ctx, c, -10, 2));

  // Near leg.
  limb(ctx, c, 12, -66 + rise, 22, -30, 13, 9, -2);
  limb(ctx, c, 22, -30, 26, -6, 9, 11, 0);
  part(ctx, [[8, -8], [44, -8], [46, 0], [6, 0]], c, -10, 2, toneGrad(ctx, c, -10, 2, 0.35, 0.7));

  // Far arm, hanging with knuckles near the ground.
  const fElbowX = -34 + t * 26;
  const fElbowY = -96 - t * 70 + farSway;
  const fFistX = -46 + t * 78;
  const fFistY = -18 - t * 132 + farSway * 0.55;
  limb(ctx, { main: mix(c.main, c.dark, 0.5), dark: c.dark, glow: c.glow }, -22, -136 + rise, fElbowX, fElbowY, 15, 12, 6);
  limb(ctx, { main: mix(c.main, c.dark, 0.5), dark: c.dark, glow: c.glow }, fElbowX, fElbowY, fFistX, fFistY, 12, 14, 3);
  part(ctx, [[fFistX - 16, fFistY - 12], [fFistX + 12, fFistY - 14], [fFistX + 18, fFistY + 4],
    [fFistX + 6, fFistY + 16], [fFistX - 16, fFistY + 12]], c, fFistY - 16, fFistY + 18,
    toneGrad(ctx, c, fFistY - 16, fFistY + 18, 0.3, 0.75));

  // Massive trunk torso with cooled-rock plates and lava seams.
  part(ctx,
    [[-36, -70 + rise], [-42, -122 + rise, -30, -150 + rise], [-6, -156 + rise],
      [22, -150 + rise, 40, -126 + rise], [36, -90 + rise, 30, -66 + rise],
      [4, -56 + rise, -20, -58 + rise]],
    c, -158, -54, vGrad(ctx, -158, -54, mix(c.main, c.glow, 0.2), c.main, mix(c.dark, c.main, 0.25)),
  );
  // Overlapping cooled-rock plates.
  part(ctx, [[-32, -138 + rise], [-6, -150 + rise], [16, -142 + rise], [10, -124 + rise], [-20, -120 + rise]], c,
    -152, -118, darkGrad(ctx, c, -152, -118, 0.15));
  part(ctx, [[22, -146 + rise], [38, -124 + rise], [32, -102 + rise], [14, -112 + rise]], c,
    -148, -100, toneGrad(ctx, c, -148, -100, 0.25, 0.75));
  part(ctx, [[-34, -108 + rise], [-6, -118 + rise], [18, -110 + rise], [14, -82 + rise], [-12, -78 + rise]], c,
    -120, -76, darkGrad(ctx, c, -120, -76, 0.2));
  // Lava seams.
  cracks(ctx, [[-26, -134 + rise], [-16, -118 + rise], [-20, -100 + rise], [-8, -86 + rise]], c, 0.55 + ember * 0.2);
  cracks(ctx, [[18, -146 + rise], [10, -126 + rise], [18, -110 + rise], [8, -92 + rise]], c, 0.5 + ember * 0.2);
  cracks(ctx, [[-32, -92 + rise], [-18, -80 + rise], [-2, -72 + rise]], c, 0.5);
  dot(ctx, -18, -108 + rise, 16, c.glow, 0.12 + ember * 0.06);

  // Near arm: overhead double-fist slam.
  const nElbowX = 48 + t * -6;
  const nElbowY = -100 - t * 72 + nearSway;
  const nFistX = 64 + t * 22;
  const nFistY = -14 - t * 136 + nearSway * 0.55;
  limb(ctx, c, 28, -142 + rise, nElbowX, nElbowY, 17, 13, -5);
  limb(ctx, c, nElbowX, nElbowY, nFistX, nFistY, 13, 15, -3);
  part(ctx, [[nFistX - 18, nFistY - 12], [nFistX + 12, nFistY - 16], [nFistX + 22, nFistY + 2],
    [nFistX + 8, nFistY + 18], [nFistX - 18, nFistY + 12]], c, nFistY - 18, nFistY + 18,
    toneGrad(ctx, c, nFistY - 18, nFistY + 18, 0.4, 0.7));
  for (let i = 0; i < 3; i++) {
    part(ctx, [[nFistX - 14 + i * 10, nFistY + 12], [nFistX - 6 + i * 10, nFistY + 20],
      [nFistX - 2 + i * 10, nFistY + 16]], c, nFistY + 10, nFistY + 22, darkGrad(ctx, c, nFistY + 10, nFistY + 22));
  }
  cracks(ctx, [[nElbowX - 4, nElbowY + 8], [nElbowX + 6, nElbowY - 6], [nFistX - 6, nFistY + 6]], c, 0.5);

  // Small head sunk between the shoulders.
  ctx.save();
  ctx.translate(22, -154 + rise - cast * 5);
  ctx.rotate(atk * 0.1);
  part(ctx, [[-12, 6], [-14, -12, -2, -20], [14, -18], [20, -4], [12, 8], [-2, 10]], c,
    -22, 12, toneGrad(ctx, c, -22, 12, 0.4, 0.65));
  eye(ctx, 6, -6, c, 2.6, 0.9);
  eye(ctx, 14, -6, c, 2.2, 0.8);
  part(ctx, [[-10, -14], [-16, -26, -8, -30], [-2, -18]], c, -32, -12,
    darkGrad(ctx, c, -32, -12));
  part(ctx, [[8, -16], [14, -30, 22, -26], [14, -14]], c, -32, -12,
    toneGrad(ctx, c, -32, -12, 0.5, 0.6));
  // Molten maw.
  part(ctx, [[2, 2], [16, 3], [14, 9], [4, 8]], { main: mix(c.dark, c.glow, 0.4), dark: c.dark, glow: c.glow },
    -1, 10, vGrad(ctx, -1, 10, c.glow, c.main, c.dark));
  if (cast > 0.03) {
    dot(ctx, 12, 6, 5 + cast * 13, c.glow, 0.4 + cast * 0.5);
    dot(ctx, 12, 6, 2 + cast * 4, '#fff4c6', 0.7);
  }
  ctx.restore();

  ctx.restore();
}

/* ------------------------------ BRAMBLE STALKER --------------------------- */

function thorn(ctx: CanvasRenderingContext2D, c: Pal, x: number, y: number, ang: number, len = 5): void {
  const tx = x + Math.cos(ang) * len;
  const ty = y + Math.sin(ang) * len;
  part(ctx, [[x, y + 2], [tx, ty], [x + 2, y - 2]], c, Math.min(y, ty) - 2, Math.max(y, ty) + 2,
    darkGrad(ctx, c, Math.min(y, ty) - 2, Math.max(y, ty) + 2));
}

function drawBrambleStalker(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  time: number,
  uid: number,
  breath: number,
  atk: number,
  cast: number,
): void {
  const rise = breath * 0.6;
  const sway = Math.sin(time * 2.2 + uid) * 2;
  const lash = Math.sin(time * 3.4 + uid) * 4;

  ctx.save();
  ctx.translate(0, -4);
  ctx.rotate(atk * 0.25);
  ctx.translate(0, 4);

  // Bent vine legs with root toes.
  limb(ctx, { main: mix(c.main, c.dark, 0.4), dark: c.dark, glow: c.glow }, -10, -66 + rise, -22, -38, 7, 4.5, -3);
  limb(ctx, { main: mix(c.main, c.dark, 0.4), dark: c.dark, glow: c.glow }, -22, -38, -16, -12, 4.5, 3, 2);
  part(ctx, [[-26, -10], [-4, -6], [-2, 0], [-28, 0]], { main: mix(c.main, c.dark, 0.4), dark: c.dark, glow: c.glow },
    -12, 2, darkGrad(ctx, c, -12, 2));
  limb(ctx, c, 8, -66 + rise, 20, -36, 7, 4.5, 3);
  limb(ctx, c, 20, -36, 18, -10, 4.5, 3, -1);
  part(ctx, [[4, -10], [30, -6], [32, 0], [2, 0]], c, -12, 2, toneGrad(ctx, c, -12, 2, 0.35, 0.65));

  // Twisted vine torso: several braided strands.
  part(ctx,
    [[-16, -64 + rise], [-22, -104 + rise, -12, -136 + rise], [6, -144 + rise],
      [18, -128 + rise, 16, -96 + rise], [10, -72 + rise, -2, -62 + rise]],
    c, -146, -60, toneGrad(ctx, c, -146, -60, 0.35, 0.7),
  );
  limb(ctx, { main: mix(c.main, c.dark, 0.3), dark: c.dark, glow: c.glow }, -12, -74 + rise, -4, -112 + rise, 5, 3.5, 4);
  limb(ctx, { main: mix(c.main, c.glow, 0.15), dark: c.dark, glow: c.glow }, 8, -78 + rise, 2, -116 + rise, 4, 3, -3);
  // Thorns along the trunk.
  for (let i = 0; i < 5; i++) {
    const yy = -76 - i * 12 + rise;
    thorn(ctx, c, i % 2 === 0 ? -14 : 10, yy, i % 2 === 0 ? -2.4 : -0.5, 6);
  }
  detail(ctx, [[-8, -80 + rise], [-2, -104 + rise], [2, -128 + rise]], c.glow, 0.9, 0.32);

  // Long arms; the near one carries the lashing thorn whip.
  limb(ctx, { main: mix(c.main, c.dark, 0.4), dark: c.dark, glow: c.glow }, -4, -136 + rise, -24, -110 + rise, 5, 3, -5);
  limb(ctx, { main: mix(c.main, c.dark, 0.4), dark: c.dark, glow: c.glow }, -24, -110 + rise, -18 + lash, -78 + rise, 3, 2, 3);
  limb(ctx, c, 12, -136 + rise, 30, -114 + rise, 5.5, 3.4, 4);
  limb(ctx, c, 30, -114 + rise, 40 + atk * 10, -92 + rise, 3.4, 2.4, 2);

  // Whip: three tapered vine segments with a thorned tip.
  const wx = 40 + atk * 34;
  const wy = -92 + rise - atk * 16;
  limb(ctx, c, 40 + atk * 10, -92 + rise, wx - 4, wy - 10, 3.2, 2.2, 4);
  limb(ctx, c, wx - 4, wy - 10, wx + 24, wy - 4 + lash, 2.2, 1.3, -3);
  limb(ctx, c, wx + 24, wy - 4 + lash, wx + 46 + atk * 12, wy - 22 + lash * 0.6, 1.3, 0.5, 3);
  thorn(ctx, c, wx + 46 + atk * 12, wy - 22 + lash * 0.6, -1.2 + atk * 0.5, 7);
  thorn(ctx, c, wx + 10, wy - 8, -0.6, 5);
  thorn(ctx, c, wx + 28, wy - 2 + lash, -2.2, 5);

  // Root-knot head with glowing eyes.
  ctx.save();
  ctx.translate(14, -146 + rise - cast * 5);
  ctx.rotate(-0.08 + atk * 0.12 - cast * 0.1);
  part(ctx, [[-14, 8], [-16, -10, -4, -18], [10, -20], [20, -8], [14, 8], [0, 12]], c,
    -22, 12, toneGrad(ctx, c, -22, 12, 0.4, 0.65));
  // Twisting root horns.
  for (let i = 0; i < 4; i++) {
    const a = -2.2 + i * 0.5;
    limb(ctx, c, -8 + i * 6, -16, -8 + i * 6 + Math.cos(a) * 13, -16 + Math.sin(a) * 14, 2.2, 0.8, 2);
  }
  detail(ctx, [[-6, -6], [2, -10], [10, -4]], deep(c), 1, 0.5);
  eye(ctx, 4, -3, c, 2.2, 0.95);
  eye(ctx, 13, -4, c, 2.0, 0.9);
  if (cast > 0.03) {
    dot(ctx, 9, -2, 5 + cast * 12, c.glow, 0.35 + cast * 0.45);
  }
  ctx.restore();

  ctx.restore();
}

/* ------------------------------- TIDE REVENANT ---------------------------- */

function drawTideRevenant(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  time: number,
  uid: number,
  breath: number,
  atk: number,
  cast: number,
): void {
  const rise = breath * 0.5;
  const sway = Math.sin(time * 1.9 + uid) * 4;
  const weed = Math.sin(time * 2.3 + uid) * 5;

  ctx.save();
  ctx.translate(0, -4);
  ctx.rotate(atk * 0.22);
  ctx.translate(0, 4);

  // Rusted greaves.
  limb(ctx, { main: mix(c.main, c.dark, 0.45), dark: c.dark, glow: c.glow }, -12, -76, -18, -38, 8, 6, 1);
  limb(ctx, { main: mix(c.main, c.dark, 0.45), dark: c.dark, glow: c.glow }, -18, -38, -16, -12, 6, 4, 2);
  part(ctx, [[-30, -8], [-4, -8], [-2, 0], [-32, 0]], { main: mix(c.main, c.dark, 0.45), dark: c.dark, glow: c.glow },
    -10, 2, darkGrad(ctx, c, -10, 2));
  limb(ctx, c, 8, -76, 16, -38, 8, 6, -1);
  limb(ctx, c, 16, -38, 20, -12, 6, 4, -2);
  part(ctx, [[4, -8], [32, -8], [34, 0], [2, 0]], c, -10, 2, toneGrad(ctx, c, -10, 2, 0.35, 0.65));

  // Tattered tabard / drowned coat.
  part(ctx,
    [[-18, -84 + rise], [-24, -128 + rise], [-8, -150 + rise], [18, -146 + rise],
      [28, -118 + rise, 24 + sway, -84], [14 + sway, -68], [4 + sway * 0.5, -80],
      [-8 + sway * 0.6, -66], [-22 + sway, -82]],
    c, -152, -64, vGrad(ctx, -152, -64, mix(c.main, c.glow, 0.15), c.main, mix(c.main, c.dark, 0.72)),
  );
  detail(ctx, [[-10 + sway * 0.4, -120 + rise], [-4, -98], [-12 + sway * 0.6, -74]], deep(c), 1, 0.5);
  detail(ctx, [[6, -124 + rise], [10 + sway * 0.3, -100], [4 + sway * 0.5, -72]], c.glow, 1, 0.3);
  detail(ctx, [[-14, -112 + rise], [-2, -104], [14, -112 + rise]], mix(c.main, c.dark, 0.5), 1, 0.5);

  // Seaweed strands hanging from the shoulders and helm.
  for (let i = 0; i < 4; i++) {
    const bx = -14 + i * 10;
    limb(ctx, { main: mix(c.main, c.dark, 0.2), dark: c.dark, glow: c.glow },
      bx, -142 + rise, bx + weed * (0.5 + i * 0.2), -112 + rise, 2.2, 1.0, 2);
    thorn(ctx, c, bx + weed * (0.5 + i * 0.2), -112 + rise, 1.5, 4);
  }

  // Armoured torso plates.
  part(ctx,
    [[-16, -88 + rise], [-20, -126 + rise, -2, -144 + rise], [18, -140 + rise],
      [24, -112 + rise, 16, -84 + rise], [-2, -80 + rise]],
    c, -146, -78, toneGrad(ctx, c, -146, -78, 0.28, 0.72),
  );
  part(ctx, [[-14, -132 + rise], [16, -130 + rise], [12, -112 + rise], [-12, -114 + rise]], c,
    -134, -110, darkGrad(ctx, c, -134, -110, 0.15));
  spec(ctx, -8, -134 + rise, 10, -132 + rise, 0.45);
  // Rust and barnacle spots.
  dot(ctx, -6, -120 + rise, 3, mix(c.main, c.dark, 0.5), 0.5);
  dot(ctx, 6, -102 + rise, 2.5, mix(c.main, c.dark, 0.4), 0.5);
  dot(ctx, 14, -92 + rise, 2, c.glow, 0.35);

  // Pauldron.
  part(ctx, [[-22, -140 + rise], [-2, -158 + rise, 16, -150 + rise], [20, -138 + rise], [-4, -132 + rise]], c,
    -160, -130, toneGrad(ctx, c, -160, -130, 0.4, 0.65));
  spec(ctx, -12, -148 + rise, 8, -146 + rise, 0.5);

  // Rusted helm.
  ctx.save();
  ctx.translate(2, -158 + rise - cast * 4);
  ctx.rotate(atk * 0.1);
  part(ctx, [[-16, 14], [-18, -10, -4, -24], [14, -22], [22, -2], [12, 14], [-4, 16]], c,
    -26, 18, vGrad(ctx, -26, 18, mix(c.main, c.glow, 0.2), c.main, mix(c.main, c.dark, 0.75)));
  // Helm crest and cheek guards.
  part(ctx, [[-18, -6], [-30, 4, -24, 16], [-8, 12]], c, -8, 18, darkGrad(ctx, c, -8, 18));
  part(ctx, [[-4, -22], [-2, -34, 8, -36], [12, -24]], c, -38, -20, toneGrad(ctx, c, -38, -20, 0.5, 0.6));
  detail(ctx, [[-6, 0], [10, 0]], deep(c), 1.1, 0.5);
  eye(ctx, 6, 1, c, 2.4, 0.9);
  // Barnacles on the helm.
  dot(ctx, -10, -12, 2.4, c.glow, 0.4);
  dot(ctx, 14, -8, 2, c.glow, 0.35);
  ctx.restore();

  // Vertical spear, held in the front hand and thrust on attack.
  const handX = 28 + atk * 12;
  const handY = -116 + rise;
  limb(ctx, c, 14, -134 + rise, handX, handY, 5, 3.5, 2);
  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(-0.18 + atk * 1.35 + Math.sin(time * 1.7 + uid) * 0.015);
  // Shaft.
  paintShape(ctx, [[-1.6, 88], [1.6, 88], [1.6, -92], [-1.6, -92]], vGrad(ctx, -92, 88, mix(c.main, c.glow, 0.35), c.main, mix(c.main, c.dark, 0.8)), {
    edge: deep(c),
    edgeWidth: 1.6,
    shade: [[1.6, 88], [8, 88], [8, -92], [1.6, -92]],
    shadeColor: 'rgba(5,3,10,0.32)',
    light: [[-3.2, -92], [0, -92], [0, 88], [-3.2, 88]],
    lightColor: 'rgba(255,250,235,0.22)',
  });
  spec(ctx, 0, 80, 0, -86, 0.5);
  // Leaf-shaped blade.
  part(ctx, [[0, -92], [-9, -108, -2, -136], [0, -144], [3, -134, 9, -110], [3, -94]], c,
    -146, -90, vGrad(ctx, -146, -90, '#ffffff', c.glow, c.main));
  detail(ctx, [[0, -100], [0, -138]], deep(c), 0.9, 0.35);
  // Weed wrapped around the shaft.
  limb(ctx, { main: mix(c.main, c.dark, 0.2), dark: c.dark, glow: c.glow }, -2, -30, 3 + weed, -2, 1.6, 0.8, 1);
  if (cast > 0.03) {
    dot(ctx, 0, -132, 5 + cast * 12, c.glow, 0.4 + cast * 0.5);
    dot(ctx, 0, -132, 2 + cast * 3, '#ffffff', 0.7);
  }
  ctx.restore();

  // Dripping water drops.
  for (let i = 0; i < 3; i++) {
    const dy = -70 + ((Math.sin(time * 1.4 + uid + i * 2) + 1) * 0.5) * 54;
    dot(ctx, 20 + i * 6, dy, 1.8, c.glow, 0.5);
  }

  ctx.restore();
}

/* -------------------------------- SPORE WISP ------------------------------ */

function drawSporeWisp(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  time: number,
  uid: number,
  breath: number,
  atk: number,
  cast: number,
): void {
  const bob = Math.sin(time * 2.7 + uid) * 4 + breath * 0.4;
  const tendril = Math.sin(time * 3.3 + uid) * 7;

  ctx.save();
  ctx.translate(atk * 22, bob);
  ctx.rotate(atk * 0.2 + cast * 0.05);

  // Four trailing wispy tendrils.
  for (let i = 0; i < 4; i++) {
    const bx = -150 + i * 100;
    const wave = Math.sin(time * 2.6 + uid + i * 1.4) * (5 + i);
    const tip = -6 + i * 2;
    limb(ctx, { main: mix(c.main, c.dark, 0.25), dark: c.dark, glow: c.glow },
      bx * 0.14, -58, bx * 0.3 + wave, -36, 2.6 - i * 0.3, 1.6, 2);
    limb(ctx, { main: mix(c.main, c.dark, 0.25), dark: c.dark, glow: c.glow },
      bx * 0.3 + wave, -36, bx * 0.38 + tendril * (i % 2 === 0 ? 1 : -1), tip, 1.6, 0.6, 2);
    dot(ctx, bx * 0.38 + tendril * (i % 2 === 0 ? 1 : -1), tip, 2.2, c.glow, 0.35);
  }

  // Small mushroom stem / spirit body.
  part(ctx, [[-11, -86], [-14, -68, -6, -58], [8, -58], [14, -70, 11, -86]], c,
    -88, -56, toneGrad(ctx, c, -88, -56, 0.35, 0.7));
  eye(ctx, -2, -70, c, 2, 0.85);
  eye(ctx, 7, -70, c, 2, 0.85);

  // Gills under the cap.
  for (let i = -3; i <= 3; i++) {
    detail(ctx, [[0, -90], [i * 9, -82 - Math.abs(i) * 0.5]], mix(c.main, c.dark, 0.55), 0.9, 0.45);
  }
  part(ctx, [[-26, -84], [-10, -92, 0, -92], [10, -92, 26, -84], [14, -78], [-14, -78]], c,
    -94, -76, darkGrad(ctx, c, -94, -76, 0.12));

  // Domed cap with pale spots.
  part(ctx,
    [[-38, -86], [-34, -102, -18, -108], [0, -110], [18, -108, 34, -102], [38, -86],
      [18, -90, 0, -90], [-18, -90, -38, -86]],
    c, -112, -84, vGrad(ctx, -112, -84, mix(c.main, c.glow, 0.55), c.main, mix(c.main, c.dark, 0.55)),
  );
  // Cap rim underside shadow.
  part(ctx, [[-38, -86], [0, -90], [38, -86], [34, -82], [0, -85], [-34, -82]], c,
    -90, -80, darkGrad(ctx, c, -90, -80, 0.1));
  // Pale spots on the cap.
  for (let i = 0; i < 5; i++) {
    const sx = -24 + i * 12;
    const sy = -102 + (i % 2) * 4;
    part(ctx, [[sx - 4, sy], [sx - 2, sy - 3], [sx + 3, sy - 2], [sx + 5, sy + 1], [sx, sy + 3], [sx - 3, sy + 2]],
      { main: mix(c.glow, '#ffffff', 0.3), dark: c.dark, glow: c.glow }, sy - 4, sy + 4,
      vGrad(ctx, sy - 4, sy + 4, '#ffffff', c.glow, c.main));
  }
  // Cast glow beneath the cap.
  if (cast > 0.03) {
    dot(ctx, 0, -82, 7 + cast * 16, c.glow, 0.4 + cast * 0.4);
  }

  // Drifting glowing spores.
  for (let i = 0; i < 7; i++) {
    const sx = Math.sin(time * 1.3 + uid + i * 1.7) * 42;
    const sy = -70 + Math.cos(time * 1.1 + i * 2.1) * 30;
    dot(ctx, sx, sy, 2.6, c.glow, 0.45);
  }
  // Attack spore burst streaming forward.
  if (atk > 0.02) {
    for (let i = 0; i < 8; i++) {
      const sx = 10 + atk * (28 + i * 9);
      const sy = -70 - atk * (i * 7 - 24) + Math.sin(time * 3 + i) * 3;
      dot(ctx, sx, sy, 2.4 + (i % 3), c.glow, 0.35 + atk * 0.25);
    }
  }

  ctx.restore();
}

/* ------------------------------- HOLLOW TREANT ---------------------------- */

function drawHollowTreant(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  time: number,
  uid: number,
  breath: number,
  atk: number,
  cast: number,
): void {
  const rise = breath * 0.6;
  const leaf = Math.sin(time * 2.0 + uid) * 4;

  ctx.save();
  ctx.translate(0, -4);
  ctx.rotate(atk * 0.20);
  ctx.translate(0, 4);

  // Root legs and root toes.
  for (const side of [-1, 1]) {
    const p: Pal = side < 0 ? { main: mix(c.main, c.dark, 0.4), dark: c.dark, glow: c.glow } : c;
    const hx = side * 16;
    limb(ctx, p, hx, -62 + rise, hx + side * 8, -30, 12, 9, side * 2);
    limb(ctx, p, hx + side * 8, -30, hx + side * 4, -8, 9, 11, 0);
    part(ctx, [[hx - 18, -8], [hx + 18, -8], [hx + 22, -4], [hx + 10, 0], [hx - 10, 0], [hx - 22, -4]], p,
      -10, 2, darkGrad(ctx, p, -10, 2));
    detail(ctx, [[hx + side * 2, -6], [hx + side * 16, -2]], p.glow, 0.9, 0.3);
  }

  // Trunk torso with layered bark plates.
  part(ctx,
    [[-30, -64 + rise], [-34, -112 + rise, -22, -146 + rise], [6, -150 + rise],
      [28, -132 + rise, 30, -94 + rise], [20, -66 + rise, 0, -58 + rise]],
    c, -152, -56, vGrad(ctx, -152, -56, mix(c.main, c.dark, 0.25), c.main, mix(c.main, c.dark, 0.75)),
  );
  // Bark plates with grain.
  part(ctx, [[-28, -132 + rise], [-14, -146 + rise], [4, -138 + rise], [2, -112 + rise], [-20, -108 + rise]], c,
    -148, -106, darkGrad(ctx, c, -148, -106, 0.15));
  part(ctx, [[10, -142 + rise], [26, -128 + rise], [24, -102 + rise], [8, -110 + rise]], c,
    -144, -100, toneGrad(ctx, c, -144, -100, 0.3, 0.68));
  part(ctx, [[-26, -104 + rise], [-8, -112 + rise], [10, -104 + rise], [12, -78 + rise], [-16, -76 + rise]], c,
    -114, -74, darkGrad(ctx, c, -114, -74, 0.2));
  // Grain lines.
  detail(ctx, [[-16, -140 + rise], [-12, -124], [-18, -110 + rise]], deep(c), 1, 0.5);
  detail(ctx, [[14, -132 + rise], [18, -116], [14, -106 + rise]], deep(c), 1, 0.45);
  detail(ctx, [[-18, -96 + rise], [-10, -86], [-14, -78 + rise]], mix(c.glow, c.main, 0.3), 1, 0.3);
  // Moss patches.
  part(ctx, [[-32, -120 + rise], [-18, -126 + rise], [-8, -118 + rise], [-20, -112 + rise]], c,
    -128, -110, vGrad(ctx, -128, -110, mix(c.main, c.glow, 0.35), c.main, mix(c.main, c.dark, 0.4)));
  part(ctx, [[8, -72 + rise], [20, -78 + rise], [30, -70 + rise], [20, -64 + rise]], c,
    -80, -62, vGrad(ctx, -80, -62, mix(c.main, c.glow, 0.3), c.main, mix(c.main, c.dark, 0.5)));

  // Hollow chest cavity, glowing from within.
  const hollowGlow = 0.45 + cast * 0.45 + Math.sin(time * 2.4 + uid) * 0.06;
  part(ctx, [[-10, -116 + rise], [-2, -128 + rise, 14, -124 + rise], [18, -106 + rise],
    [8, -84 + rise, -6, -88 + rise], [-12, -102 + rise]], { main: deep(c), dark: deep(c), glow: c.glow },
    -130, -82, vGrad(ctx, -130, -82, mix(c.dark, c.glow, 0.15), deep(c), '#120c14'));
  dot(ctx, 3, -104 + rise, 17 + cast * 10, c.glow, hollowGlow);
  dot(ctx, 3, -104 + rise, 7 + cast * 5, '#fff3c2', hollowGlow * 0.75);
  detail(ctx, [[-8, -118 + rise], [-6, -104 + rise], [-10, -90 + rise]], mix(c.glow, c.main, 0.3), 1, 0.5);

  // Branch arms with twig fingers; near arm swings on attack.
  limb(ctx, { main: mix(c.main, c.dark, 0.35), dark: c.dark, glow: c.glow }, -24, -136 + rise, -48 + leaf, -104 + rise, 7, 5, -5);
  limb(ctx, { main: mix(c.main, c.dark, 0.35), dark: c.dark, glow: c.glow }, -48 + leaf, -104 + rise, -48 + leaf, -70 + rise, 5, 3, 3);
  for (let i = 0; i < 3; i++) {
    limb(ctx, { main: mix(c.main, c.dark, 0.35), dark: c.dark, glow: c.glow },
      -48 + leaf, -70 + rise, -56 + leaf + i * 5, -58 + rise + i * 2, 2.2, 0.8, 1.5);
  }

  const armX = 44 + atk * 34;
  const armY = -108 + rise - atk * 18;
  limb(ctx, c, 26, -136 + rise, armX - 4, armY, 7.5, 5, 5);
  limb(ctx, c, armX - 4, armY, armX + 18, armY + 26 - atk * 34, 5, 3, -3);
  for (let i = 0; i < 3; i++) {
    const fx = armX + 18 + i * 6;
    const fy = armY + 26 - atk * 34 + i * 3;
    limb(ctx, c, armX + 18, armY + 26 - atk * 34, fx + 12, fy - 10 + i * 4, 2.4, 0.8, 2);
    limb(ctx, c, fx + 12, fy - 10 + i * 4, fx + 16, fy + 2 + i * 2, 0.8, 0.4, 0.5);
  }
  // Twigs sprouting from the shoulder.
  limb(ctx, c, 22, -142 + rise, 36 + leaf, -156 + rise, 2.4, 0.8, 2);

  // Head between the branches.
  ctx.save();
  ctx.translate(10, -152 + rise - cast * 5);
  ctx.rotate(-0.06 + atk * 0.1);
  part(ctx, [[-15, 8], [-16, -10, -4, -18], [12, -16], [18, -2], [10, 10], [-4, 12]], c,
    -20, 12, darkGrad(ctx, c, -20, 12, 0.2));
  limb(ctx, c, -6, -14, -18, -28, 2.4, 0.8, 2);
  limb(ctx, c, 4, -16, 4, -32, 2.2, 0.8, -1);
  limb(ctx, c, 10, -12, 24, -24, 2.4, 0.8, 2);
  eye(ctx, 2, -3, c, 2, 0.55);
  eye(ctx, 10, -4, c, 1.8, 0.5);
  if (cast > 0.03) {
    dot(ctx, 6, 2, 5 + cast * 11, c.glow, 0.35 + cast * 0.45);
  }
  ctx.restore();

  ctx.restore();
}

/* -------------------------------- FROST WRAITH ---------------------------- */

function drawFrostWraith(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  time: number,
  uid: number,
  breath: number,
  atk: number,
  cast: number,
): void {
  const hover = Math.sin(time * 2.5 + uid) * 5 + breath * 0.4;

  ctx.save();
  ctx.translate(0, hover);
  ctx.translate(0, -38);
  ctx.rotate(atk * 0.22);
  ctx.translate(0, 38);

  // Rippling trailing tatters behind the cloak.
  for (let i = 0; i < 4; i++) {
    const sway = Math.sin(time * 2.2 + uid + i * 1.3) * (5 + i);
    const bx = -26 + i * 15;
    part(ctx,
      [[bx, -52], [bx - 8, -30 + sway * 0.4, bx - 12 + sway, -8],
        [bx - 2, -18 + sway * 0.5], [bx + 2, -36], [bx + 8, -54]],
      { main: mix(c.main, c.dark, 0.3), dark: c.dark, glow: c.glow },
      -56, -6, vGrad(ctx, -56, -6, mix(c.main, c.glow, 0.1), c.main, mix(c.main, c.dark, 0.6)),
    );
    detail(ctx, [[bx - 2, -46], [bx - 4 + sway * 0.5, -28], [bx - 6 + sway, -12]], c.glow, 1, 0.3);
  }

  // Main cloak body (no legs).
  part(ctx,
    [[-18, -120], [-4, -132, 14, -128], [24, -112], [34, -74],
      [26 + Math.sin(time * 2.4 + uid) * 6, -34], [14, -14], [4, -26],
      [-6, -6], [-16, -22], [-30, -16], [-34, -56], [-26, -88]],
    c, -134, -4, vGrad(ctx, -134, -4, mix(c.main, c.glow, 0.25), c.main, mix(c.main, c.dark, 0.78)),
  );
  // Cloak folds.
  detail(ctx, [[-12, -116], [-16, -86], [-8, -50], [-14, -22]], deep(c), 1, 0.5);
  detail(ctx, [[4, -116], [6, -82], [2, -48], [8, -20]], mix(c.glow, c.main, 0.3), 1, 0.35);
  detail(ctx, [[18, -108], [20, -76], [16, -42]], deep(c), 1, 0.45);

  // Hood and hollow face.
  part(ctx, [[-16, -118], [-12, -140, 2, -146], [18, -136], [24, -116], [4, -108]], c,
    -148, -106, toneGrad(ctx, c, -148, -106, 0.4, 0.65));
  part(ctx, [[-4, -126], [-2, -138, 10, -136], [14, -124], [6, -118], [-2, -120]],
    { main: deep(c), dark: deep(c), glow: c.glow }, -140, -116,
    vGrad(ctx, -140, -116, c.dark, deep(c), '#0b1220'));
  eye(ctx, 2, -126, c, 1.9, 0.55);
  eye(ctx, 8, -126, c, 1.7, 0.5);

  // Crown of ice shards.
  for (let i = 0; i < 5; i++) {
    const cx = -12 + i * 7;
    const top = -148 - (i === 2 ? 12 : i === 1 || i === 3 ? 8 : 4);
    part(ctx, [[cx - 4, -142], [cx, top], [cx + 4, -140], [cx + 2, -134], [cx - 2, -134]], c,
      top - 2, -132, vGrad(ctx, top, -132, '#ffffff', c.main, c.dark));
    spec(ctx, cx, top + 2, cx + 1, -136, 0.5);
  }

  // Far skeletal hand.
  limb(ctx, { main: mix(c.main, c.dark, 0.4), dark: c.dark, glow: c.glow }, -24, -102, -34, -82, 3.2, 2.4, 2);
  for (let i = 0; i < 3; i++) {
    limb(ctx, { main: mix(c.main, c.dark, 0.4), dark: c.dark, glow: c.glow }, -34, -82, -40 - i * 3, -70 + i * 3, 1.6, 0.6, 1);
  }

  // Near skeletal hand: reaches forward on attack.
  const hx = 34 + atk * 34;
  const hy = -96 + cast * 10;
  limb(ctx, c, 20, -112, hx - 12, hy + 14, 4.2, 3, 2);
  limb(ctx, c, hx - 12, hy + 14, hx, hy, 3, 2.2, 1);
  // Palm.
  part(ctx, [[hx - 4, hy - 5], [hx + 5, hy - 6], [hx + 7, hy + 3], [hx - 3, hy + 5]], c,
    hy - 7, hy + 7, toneGrad(ctx, c, hy - 7, hy + 7, 0.5, 0.6));
  for (let i = 0; i < 4; i++) {
    const fa = -0.6 - i * 0.25;
    limb(ctx, c, hx + 4, hy - 2 + i * 2, hx + 4 + Math.cos(fa) * 12, hy - 2 + i * 2 + Math.sin(fa) * 12, 1.5, 0.5, 1);
  }
  if (cast > 0.03) {
    dot(ctx, hx + 6, hy - 2, 5 + cast * 12, c.glow, 0.4 + cast * 0.45);
  }

  // Drifting frost motes.
  for (let i = 0; i < 6; i++) {
    const px = Math.sin(time * 1.2 + uid + i * 1.9) * 38;
    const py = -100 + Math.cos(time * 1.5 + i * 1.4) * 44;
    dot(ctx, px, py, 2, c.glow, 0.4);
  }

  ctx.restore();
}

/* --------------------------------- ICE GOLEM ------------------------------ */

function iceBlock(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  segs: Seg[],
  yTop: number,
  yBot: number,
  tint = 0,
): void {
  const hi = tint > 0 ? mix(c.glow, '#ffffff', 0.4) : mix(c.main, c.glow, 0.5);
  const lo = tint > 0 ? mix(c.main, c.dark, 0.45) : mix(c.main, c.dark, 0.72);
  paintShape(ctx, segs, vGrad(ctx, yTop, yBot, hi, tint > 0 ? c.main : mix(c.main, c.glow, 0.2), lo), {
    edge: deep(c),
    edgeWidth: 1.7,
    shade: slab(yTop + (yBot - yTop) * 0.55, yBot + 30),
    light: [[segs[0][0], yTop - 20], [segs[0][0] + 30, yTop - 20], [segs[0][0] + 30, yTop + (yBot - yTop) * 0.45], [segs[0][0], yTop + (yBot - yTop) * 0.45]],
    shadeColor: 'rgba(5,10,20,0.36)',
    lightColor: 'rgba(255,255,255,0.2)',
  });
  // Facet edge glints.
  const first = segs[0];
  const last = segs[segs.length - 1];
  spec(ctx, first[0] + 2, yTop + 4, last[0] - 2, yTop + 8, 0.4);
}

function drawIceGolem(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  time: number,
  uid: number,
  breath: number,
  atk: number,
  cast: number,
): void {
  const rise = breath * 0.6;
  const frost = Math.sin(time * 1.8 + uid) * 4;

  ctx.save();
  ctx.translate(0, -4);
  ctx.rotate(atk * 0.21);
  ctx.translate(0, 4);

  // Legs of faceted ice blocks.
  iceBlock(ctx, { main: mix(c.main, c.dark, 0.35), dark: c.dark, glow: c.glow },
    [[-30, -68 + rise], [-10, -72 + rise], [-8, -34], [-22, -30], [-34, -42]], -74, -28, -1);
  iceBlock(ctx, { main: mix(c.main, c.dark, 0.25), dark: c.dark, glow: c.glow },
    [[-24, -34], [-10, -34], [-8, -2], [-26, -2], [-30, -14]], -36, 0);
  iceBlock(ctx, c, [[6, -70 + rise], [30, -66 + rise], [32, -34], [14, -30], [4, -44]], -72, -28);
  iceBlock(ctx, { main: mix(c.main, c.glow, 0.1), dark: c.dark, glow: c.glow },
    [[12, -34], [30, -34], [30, -2], [10, -2], [8, -16]], -36, 0);

  // Far arm, a chain of ice blocks.
  iceBlock(ctx, { main: mix(c.main, c.dark, 0.4), dark: c.dark, glow: c.glow },
    [[-38, -142 + rise], [-20, -148 + rise], [-14, -114], [-30, -108]], -150, -106, -1);
  iceBlock(ctx, { main: mix(c.main, c.dark, 0.35), dark: c.dark, glow: c.glow },
    [[-32, -110], [-16, -116], [-10, -82], [-26, -76]], -118, -74, -1);
  iceBlock(ctx, { main: mix(c.main, c.dark, 0.3), dark: c.dark, glow: c.glow },
    [[-30, -78], [-12, -84], [-8, -58], [-28, -54]], -86, -52);

  // Torso: clustered faceted blocks.
  iceBlock(ctx, c, [[-34, -70 + rise], [-40, -120 + rise], [-26, -152 + rise], [6, -158 + rise],
    [30, -142 + rise, 34, -110 + rise], [26, -76 + rise, 4, -66 + rise]], -160, -64);
  iceBlock(ctx, { main: mix(c.main, c.dark, 0.2), dark: c.dark, glow: c.glow },
    [[-34, -124 + rise], [-12, -140 + rise], [-4, -112 + rise], [-22, -98 + rise]], -142, -96, -1);
  iceBlock(ctx, { main: mix(c.main, c.glow, 0.2), dark: c.dark, glow: c.glow },
    [[8, -148 + rise], [28, -136 + rise], [26, -108 + rise], [8, -116 + rise]], -150, -106);
  iceBlock(ctx, { main: mix(c.main, c.dark, 0.15), dark: c.dark, glow: c.glow },
    [[-30, -96 + rise], [-8, -104 + rise], [10, -94 + rise], [4, -72 + rise], [-22, -70 + rise]], -106, -68);
  // Shoulder plates.
  iceBlock(ctx, c, [[-42, -140 + rise], [-18, -156 + rise], [-6, -142 + rise], [-22, -130 + rise]], -158, -128);
  iceBlock(ctx, c, [[12, -156 + rise], [38, -146 + rise], [40, -128 + rise], [16, -132 + rise]], -158, -126);

  // Glowing rune core.
  const core = 0.55 + cast * 0.4 + Math.sin(time * 2.4 + uid) * 0.06;
  part(ctx, [[-8, -124 + rise], [2, -134 + rise, 12, -126 + rise], [10, -108 + rise],
    [0, -98 + rise, -10, -106 + rise]], { main: deep(c), dark: deep(c), glow: c.glow },
    -136, -96, vGrad(ctx, -136, -96, mix(c.main, c.glow, 0.4), c.dark, deep(c)));
  dot(ctx, 0, -116 + rise, 14 + cast * 9, c.glow, core * 0.5);
  detail(ctx, [[0, -130 + rise], [0, -104 + rise]], '#ffffff', 1.1, 0.55);
  detail(ctx, [[-6, -120 + rise], [6, -120 + rise]], '#ffffff', 1.1, 0.5);
  detail(ctx, [[-4, -110 + rise], [4, -110 + rise]], '#ffffff', 1, 0.4);

  // Near arm and punching fist.
  const punch = atk;
  const elbowX = 46 + punch * 18;
  const elbowY = -112 - punch * 8;
  const fistX = 58 + punch * 46;
  const fistY = -92 + punch * 6;
  iceBlock(ctx, c, [[24, -146 + rise], [44, -150 + rise, 48, -122 + rise], [30, -116 + rise, 22, -130 + rise]], -152, -114);
  iceBlock(ctx, c, [[elbowX - 14, elbowY - 14], [elbowX + 10, elbowY - 18], [elbowX + 16, elbowY + 10], [elbowX - 10, elbowY + 14]], elbowY - 18, elbowY + 16);
  iceBlock(ctx, c, [[fistX - 16, fistY - 16], [fistX + 10, fistY - 18], [fistX + 20, fistY + 2], [fistX + 8, fistY + 16], [fistX - 14, fistY + 12]], fistY - 18, fistY + 18);
  spec(ctx, fistX - 10, fistY - 14, fistX + 4, fistY - 12, 0.6);
  detail(ctx, [[fistX - 10, fistY + 2], [fistX + 10, fistY + 2]], deep(c), 1, 0.45);

  // Small angled head.
  ctx.save();
  ctx.translate(10, -170 + rise - cast * 5);
  ctx.rotate(-0.04 + atk * 0.08);
  iceBlock(ctx, c, [[-16, 14], [-18, -8, -4, -18], [14, -16], [20, 0], [10, 14], [-4, 16]], -20, 18);
  // Brow ridge and eye sockets.
  part(ctx, [[-12, -2], [0, -10, 14, -4], [10, 2], [-8, 4]], { main: mix(c.dark, c.main, 0.3), dark: c.dark, glow: c.glow },
    -10, 6, darkGrad(ctx, c, -10, 6, 0.15));
  dot(ctx, -1, 1, 3, c.glow, 0.65);
  dot(ctx, 9, 1, 2.6, c.glow, 0.6);
  if (cast > 0.03) {
    dot(ctx, 4, 6, 5 + cast * 11, c.glow, 0.35 + cast * 0.45);
  }
  ctx.restore();

  // Drifting frost.
  for (let i = 0; i < 7; i++) {
    const px = Math.sin(time * 1.4 + uid + i * 1.8) * 46 + frost;
    const py = -60 + Math.cos(time * 1.2 + i * 1.5) * 56;
    dot(ctx, px, py, 1.8, c.glow, 0.4);
  }

  ctx.restore();
}

/* ------------------------------ DROWNED ACOLYTE --------------------------- */

function drawDrownedAcolyte(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  time: number,
  uid: number,
  breath: number,
  atk: number,
  cast: number,
): void {
  const rise = breath * 0.55;
  const sway = Math.sin(time * 2.0 + uid) * 4;
  const chainAng = -0.08 + Math.sin(time * 2.2 + uid) * 0.1 + atk * 1.4;

  ctx.save();
  ctx.translate(0, -4);
  ctx.rotate(atk * 0.21);
  ctx.translate(0, 4);

  // Boots under the waterlogged robe.
  part(ctx, [[-18, -8], [-4, -6], [-2, 0], [-22, 0]], { main: mix(c.main, c.dark, 0.45), dark: c.dark, glow: c.glow },
    -10, 2, darkGrad(ctx, c, -10, 2));
  part(ctx, [[4, -8], [20, -6], [22, 0], [2, 0]], c, -10, 2, toneGrad(ctx, c, -10, 2, 0.3, 0.7));

  // Hunched waterlogged robe, jagged hanging hem.
  part(ctx,
    [[-18, -112 + rise], [-6, -130 + rise, 12, -126 + rise], [24, -108 + rise],
      [30, -66, 24 + sway, -30], [16, -8], [8, -18], [0, -4], [-10, -16],
      [-20, -6], [-26 + sway, -34], [-24, -72]],
    c, -132, -2, vGrad(ctx, -132, -2, mix(c.main, c.glow, 0.2), c.main, mix(c.main, c.dark, 0.8)),
  );
  // Front robe layer with folds.
  part(ctx, [[-10, -104 + rise], [14, -100 + rise], [22, -62], [12 + sway * 0.5, -18],
    [2, -26], [-8 + sway * 0.4, -10], [-16, -44], [-16, -76]], c, -106, -8,
    vGrad(ctx, -106, -8, mix(c.main, c.glow, 0.1), c.main, mix(c.main, c.dark, 0.7)));
  detail(ctx, [[-6, -96 + rise], [-2 + sway * 0.3, -62], [-8 + sway * 0.4, -24]], deep(c), 1, 0.5);
  detail(ctx, [[6, -98 + rise], [10, -60], [4 + sway * 0.4, -20]], mix(c.glow, c.main, 0.35), 1, 0.35);
  detail(ctx, [[16, -88 + rise], [18, -56], [14 + sway * 0.4, -28]], deep(c), 1, 0.45);

  // Kelp strands hanging from the shoulders.
  for (let i = 0; i < 4; i++) {
    const bx = -18 + i * 9;
    const sway2 = Math.sin(time * 1.8 + uid + i * 1.3) * 5;
    limb(ctx, { main: mix(c.main, c.dark, 0.3), dark: c.dark, glow: c.glow },
      bx, -112 + rise, bx + sway2, -78, 2.4, 1.2, 2);
    limb(ctx, { main: mix(c.main, c.dark, 0.3), dark: c.dark, glow: c.glow },
      bx + sway2, -78, bx + sway2 * 1.4, -58, 1.2, 0.5, 1);
  }

  // Shoulders and hood.
  part(ctx, [[-22, -110 + rise], [-18, -132 + rise], [2, -140 + rise], [22, -130 + rise], [26, -110 + rise], [2, -104 + rise]], c,
    -142, -102, toneGrad(ctx, c, -142, -102, 0.3, 0.68));
  ctx.save();
  ctx.translate(8, -136 + rise - cast * 4);
  ctx.rotate(-0.04 + atk * 0.1);
  part(ctx, [[-17, 12], [-18, -10, -4, -22], [12, -20], [20, -2], [12, 14], [-4, 16]], c,
    -24, 18, toneGrad(ctx, c, -24, 18, 0.35, 0.68));
  part(ctx, [[-6, 6], [-6, -8, 4, -12], [12, -6], [10, 6], [2, 10]], { main: deep(c), dark: deep(c), glow: c.glow },
    -14, 10, vGrad(ctx, -14, 10, c.dark, deep(c), '#0a1216'));
  eye(ctx, 1, 0, c, 1.9, 0.6);
  eye(ctx, 8, 0, c, 1.7, 0.55);
  if (cast > 0.03) {
    dot(ctx, 5, 6, 5 + cast * 11, c.glow, 0.35 + cast * 0.45);
  }
  ctx.restore();

  // Censer arm and chain.
  const handX = 26 + atk * 10;
  const handY = -92 + rise - cast * 8;
  limb(ctx, c, 14, -118 + rise, handX, handY, 4.5, 3, 2);
  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(chainAng);
  detail(ctx, [[0, 0], [0, 34]], mix(c.main, c.dark, 0.5), 1.1, 0.55);
  for (let i = 0; i < 4; i++) {
    paintShape(ctx, [[-2, i * 8 + 3], [2, i * 8 + 3], [2, i * 8 + 8], [-2, i * 8 + 8]],
      i % 2 === 0 ? c.main : c.dark, { edge: deep(c), edgeWidth: 1.4 });
  }
  // Censer.
  part(ctx, [[-9, 34], [9, 34], [12, 46], [6, 56], [0, 58], [-6, 56], [-12, 46]], c,
    32, 60, vGrad(ctx, 32, 60, mix(c.main, c.glow, 0.3), c.main, mix(c.main, c.dark, 0.7)));
  part(ctx, [[-10, 32], [10, 32], [8, 26], [-8, 26]], c, 24, 34, darkGrad(ctx, c, 24, 34, 0.2));
  detail(ctx, [[-6, 44], [0, 54], [6, 44]], c.glow, 1, 0.5);
  const cg = 0.45 + cast * 0.5 + Math.sin(time * 3 + uid) * 0.05;
  dot(ctx, 0, 46, 9 + cast * 10, c.glow, cg);
  dot(ctx, 0, 46, 3, '#fffbe0', cg * 0.8);
  ctx.restore();

  // Dripping water drops.
  for (let i = 0; i < 4; i++) {
    const dy = -70 + ((Math.sin(time * 1.2 + uid + i * 1.9) + 1) * 0.5) * 62;
    dot(ctx, -14 + i * 11, dy, 1.7, c.glow, 0.5);
  }

  ctx.restore();
}

/* ------------------------------- CORAL SENTINEL --------------------------- */

function drawCoralSentinel(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  time: number,
  uid: number,
  breath: number,
  atk: number,
  cast: number,
): void {
  const rise = breath * 0.55;
  const surge = atk * 20;

  ctx.save();
  ctx.translate(0, -4);
  ctx.rotate(atk * 0.2);
  ctx.translate(0, 4);

  // Armoured legs.
  limb(ctx, { main: mix(c.main, c.dark, 0.38), dark: c.dark, glow: c.glow }, -12, -66 + rise, -20, -32, 8, 5.5, 1);
  limb(ctx, { main: mix(c.main, c.dark, 0.38), dark: c.dark, glow: c.glow }, -20, -32, -18, -10, 5.5, 4, 2);
  part(ctx, [[-30, -8], [-6, -8], [-4, 0], [-32, 0]], { main: mix(c.main, c.dark, 0.38), dark: c.dark, glow: c.glow },
    -10, 2, darkGrad(ctx, c, -10, 2));
  limb(ctx, c, 10, -66 + rise, 18, -32, 8, 5.5, -1);
  limb(ctx, c, 18, -32, 20, -10, 5.5, 4, -2);
  part(ctx, [[6, -8], [32, -8], [34, 0], [4, 0]], c, -10, 2, toneGrad(ctx, c, -10, 2, 0.35, 0.65));

  // Armoured torso.
  part(ctx,
    [[-22, -64 + rise], [-26, -100 + rise, -12, -124 + rise], [8, -128 + rise],
      [24, -110 + rise, 24, -78 + rise], [12, -62 + rise, -6, -58 + rise]],
    c, -130, -56, vGrad(ctx, -130, -56, mix(c.main, c.glow, 0.2), c.main, mix(c.main, c.dark, 0.72)),
  );
  // Breastplate and belt plates.
  part(ctx, [[-18, -118 + rise], [8, -120 + rise], [18, -104 + rise], [10, -86 + rise], [-14, -88 + rise]], c,
    -122, -84, toneGrad(ctx, c, -122, -84, 0.35, 0.65));
  spec(ctx, -10, -114 + rise, 10, -110 + rise, 0.55);
  detail(ctx, [[-16, -78 + rise], [12, -76 + rise]], deep(c), 1.1, 0.5);
  detail(ctx, [[-12, -70 + rise], [14, -68 + rise]], deep(c), 1, 0.45);

  // Coral spikes on the shoulders.
  for (let side = 0; side < 2; side++) {
    const bx = side === 0 ? -28 : 22;
    const dir = side === 0 ? -1 : 1;
    for (let i = 0; i < 3; i++) {
      const swayC = Math.sin(time * 1.8 + uid + i) * 2;
      limb(ctx, { main: mix(c.glow, c.main, 0.35), dark: c.dark, glow: c.glow },
        bx, -120 + rise, bx + dir * (8 + i * 4) + swayC, -132 - i * 5 + rise, 3, 1.2, 2);
    }
  }

  // Tower shield: tall, coral-encrusted.
  ctx.save();
  ctx.translate(34 + surge, -72 + rise - cast * 8);
  ctx.rotate(-0.06 - atk * 0.12);
  part(ctx,
    [[-18, 44], [-22, -18], [-14, -46], [0, -52], [14, -46], [22, -18], [18, 44], [0, 52]],
    c, -54, 54, vGrad(ctx, -54, 54, mix(c.main, c.glow, 0.25), c.main, mix(c.main, c.dark, 0.8)),
  );
  // Shield bands and central boss.
  detail(ctx, [[-18, -30], [18, -30]], deep(c), 1.1, 0.5);
  detail(ctx, [[-20, 20], [20, 20]], deep(c), 1.1, 0.5);
  part(ctx, [[-10, 0], [-8, -8], [0, -12], [8, -8], [10, 0], [8, 8], [0, 12], [-8, 8]], c, -14, 14,
    vGrad(ctx, -14, 14, mix(c.glow, '#ffffff', 0.2), c.main, mix(c.main, c.dark, 0.6)));
  dot(ctx, 0, -1, 7 + cast * 10, c.glow, 0.35 + cast * 0.4);
  // Coral rosette around the boss.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    limb(ctx, { main: mix(c.glow, c.main, 0.3), dark: c.dark, glow: c.glow },
      Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a) * 16, Math.sin(a) * 16, 2, 0.7, 1);
  }
  // Coral branches growing over the shield rim.
  for (let i = 0; i < 3; i++) {
    const cx = -14 + i * 14;
    limb(ctx, { main: mix(c.glow, c.main, 0.35), dark: c.dark, glow: c.glow },
      cx, -44, cx - 5 + i * 4, -60 - i * 4, 2.6, 0.9, 2);
    limb(ctx, { main: mix(c.glow, c.main, 0.35), dark: c.dark, glow: c.glow },
      cx - 2, -50, cx + 7 - i * 2, -58 - i * 2, 1.6, 0.5, 1);
  }
  spec(ctx, -12, -42, 4, -38, 0.55);
  spec(ctx, -10, 34, 8, 40, 0.45);
  // Coral growths and barnacles on the shield.
  for (let i = 0; i < 4; i++) {
    const cx = -14 + (i % 2) * 26;
    const cy = -34 + i * 18;
    limb(ctx, { main: mix(c.glow, c.main, 0.3), dark: c.dark, glow: c.glow },
      cx, cy, cx + (i % 2 === 0 ? -8 : 8), cy - 7, 2.2, 0.8, 1);
  }
  dot(ctx, 10, -12, 2.6, c.glow, 0.4);
  dot(ctx, -8, 30, 2.2, c.glow, 0.35);
  ctx.restore();

  // Helm.
  ctx.save();
  ctx.translate(2, -127 + rise - cast * 4);
  ctx.rotate(atk * 0.08);
  part(ctx, [[-16, 12], [-18, -8, -4, -18], [12, -16], [20, 0], [12, 12], [-2, 16]], c,
    -20, 18, toneGrad(ctx, c, -20, 18, 0.4, 0.65));
  part(ctx, [[-14, -8], [-4, -22, 8, -20], [12, -8], [2, -4], [-8, -4]], c,
    -24, -4, darkGrad(ctx, c, -24, -4, 0.2));
  eye(ctx, 4, -6, c, 2.2, 0.7);
  // Coral crest.
  for (let i = 0; i < 3; i++) {
    limb(ctx, { main: mix(c.glow, c.main, 0.4), dark: c.dark, glow: c.glow },
      -2 + i * 5, -18, -8 + i * 7, -30 - i * 2, 2.4, 0.9, 2);
  }
  ctx.restore();

  // Shield arm behind the shield.
  limb(ctx, c, 12, -116 + rise, 28 + surge, -92 + rise, 5, 3.5, 2);

  ctx.restore();
}

/* --------------------------------- VOID KNIGHT ---------------------------- */

function drawVoidKnight(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  time: number,
  uid: number,
  breath: number,
  atk: number,
  cast: number,
): void {
  const rise = breath * 0.5;
  const shimmer = 0.5 + Math.sin(time * 2.6 + uid) * 0.08;

  ctx.save();
  ctx.translate(0, -22);
  ctx.rotate(atk * 0.2);
  ctx.translate(0, 22);

  // Armoured legs (no gem kneecaps).
  limb(ctx, { main: mix(c.main, c.dark, 0.38), dark: c.dark, glow: c.glow }, -12, -92 + rise, -20, -48, 9, 6.5, 1);
  limb(ctx, { main: mix(c.main, c.dark, 0.38), dark: c.dark, glow: c.glow }, -20, -48, -18, -14, 6.5, 4.5, 2);
  part(ctx, [[-32, -12], [-6, -10], [-2, 0], [-36, 0]], { main: mix(c.main, c.dark, 0.38), dark: c.dark, glow: c.glow },
    -16, 2, darkGrad(ctx, c, -16, 2));
  limb(ctx, c, 10, -92 + rise, 18, -48, 9, 6.5, -1);
  limb(ctx, c, 18, -48, 22, -14, 6.5, 4.5, -2);
  part(ctx, [[6, -12], [34, -10], [38, 0], [4, 0]], c, -16, 2, toneGrad(ctx, c, -16, 2, 0.3, 0.72));
  // Void cracks on the greaves.
  cracks(ctx, [[-18, -60 + rise], [-14, -44], [-20, -30]], c, shimmer * 0.55);
  cracks(ctx, [[18, -58 + rise], [16, -42], [20, -24]], c, shimmer * 0.5);

  // Torso plate.
  part(ctx,
    [[-20, -94 + rise], [-26, -138 + rise, -8, -160 + rise], [14, -162 + rise],
      [26, -142 + rise, 22, -106 + rise], [8, -88 + rise, -8, -86 + rise]],
    c, -164, -84, vGrad(ctx, -164, -84, mix(c.main, c.glow, 0.22), c.main, mix(c.main, c.dark, 0.8)),
  );
  // Breastplate and belt.
  part(ctx, [[-14, -152 + rise], [8, -156 + rise], [20, -136 + rise], [10, -112 + rise], [-12, -116 + rise]], c,
    -158, -110, toneGrad(ctx, c, -158, -110, 0.35, 0.68));
  spec(ctx, -8, -146 + rise, 10, -140 + rise, 0.6);
  detail(ctx, [[-16, -104 + rise], [16, -100 + rise]], deep(c), 1.1, 0.5);
  detail(ctx, [[-10, -92 + rise], [14, -88 + rise]], deep(c), 1, 0.45);
  cracks(ctx, [[-6, -148 + rise], [0, -136], [-4, -124], [4, -116]], c, shimmer * 0.6);
  cracks(ctx, [[12, -140 + rise], [8, -128], [14, -118]], c, shimmer * 0.5);

  // Pauldrons.
  part(ctx, [[-34, -150 + rise], [-20, -170 + rise], [-4, -158 + rise], [-14, -142 + rise]], c,
    -172, -140, toneGrad(ctx, c, -172, -140, 0.4, 0.65));
  spec(ctx, -28, -160 + rise, -12, -156 + rise, 0.6);
  part(ctx, [[12, -160 + rise], [30, -172 + rise], [38, -152 + rise], [22, -142 + rise]], c,
    -174, -140, toneGrad(ctx, c, -174, -140, 0.3, 0.7));
  spec(ctx, 20, -162 + rise, 32, -156 + rise, 0.5);

  // Neck and horned helm.
  ctx.save();
  ctx.translate(4, -176 + rise - cast * 4);
  ctx.rotate(-0.03 + atk * 0.08);
  part(ctx, [[-14, 12], [-16, -10, -2, -20], [14, -18], [20, -2], [10, 14], [-4, 16]], c,
    -22, 18, vGrad(ctx, -22, 18, mix(c.main, c.glow, 0.25), c.main, mix(c.main, c.dark, 0.78)));
  // Visor slit and eyes.
  part(ctx, [[-12, 0], [14, 2], [12, 7], [-10, 6]], { main: deep(c), dark: deep(c), glow: c.glow },
    -2, 9, vGrad(ctx, -2, 9, c.dark, deep(c), '#0c0814'));
  eye(ctx, 0, 3, c, 1.9, 0.85);
  eye(ctx, 8, 3.5, c, 1.8, 0.8);
  // Horns (no crown).
  part(ctx, [[-12, -8], [-30, -22, -40, -30], [-22, -20, -6, -8]], c,
    -32, -6, toneGrad(ctx, c, -32, -6, 0.35, 0.68));
  part(ctx, [[10, -10], [24, -26, 36, -34], [22, -20, 14, -8]], c,
    -36, -6, toneGrad(ctx, c, -36, -6, 0.3, 0.7));
  detail(ctx, [[-6, -6], [4, 8], [14, 4]], deep(c), 1, 0.45);
  if (cast > 0.03) {
    dot(ctx, 4, 6, 5 + cast * 11, c.glow, 0.4 + cast * 0.45);
  }
  ctx.restore();

  // Sword arm and greatsword. Idle blade rises; attack thrusts forward.
  const swordAng = -1.32 + atk * 1.38 + Math.sin(time * 1.7 + uid) * 0.02;
  const handX = 28 + atk * 14;
  const handY = -118 + rise;
  limb(ctx, c, 16, -148 + rise, handX, handY, 5.5, 3.6, 2);
  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(swordAng);
  // Grip.
  paintShape(ctx, [[-3, 4], [3, 4], [3, -16], [-3, -16]], vGrad(ctx, -16, 4, mix(c.main, c.glow, 0.2), c.main, c.dark), {
    edge: deep(c), edgeWidth: 1.6,
    shade: [[0, -16], [4, -16], [4, 4], [0, 4]], shadeColor: 'rgba(5,3,10,0.35)',
    light: [[-4, -16], [-1, -16], [-1, 4], [-4, 4]], lightColor: 'rgba(255,250,235,0.2)',
  });
  // Crossguard.
  part(ctx, [[-16, -14], [16, -14], [12, -20], [-12, -20]], c, -21, -13,
    vGrad(ctx, -21, -13, mix(c.glow, '#ffffff', 0.2), c.main, c.dark));
  // Blade.
  part(ctx, [[-6, -20], [6, -20], [4, -104], [0, -116], [-4, -104]], c,
    -118, -18, vGrad(ctx, -118, -18, '#ffffff', mix(c.main, c.glow, 0.45), mix(c.main, c.dark, 0.5)));
  spec(ctx, 0, -24, 0, -100, 0.65);
  detail(ctx, [[-3, -30], [-1, -96]], mix(c.glow, '#ffffff', 0.4), 1, 0.45);
  // Void aura along the blade.
  detail(ctx, [[2, -28], [1, -104]], c.glow, 1, shimmer * 0.55);
  if (cast > 0.03) {
    dot(ctx, 0, -80, 6 + cast * 14, c.glow, 0.4 + cast * 0.45);
    dot(ctx, 0, -110, 3 + cast * 5, '#ffffff', 0.65);
  }
  ctx.restore();

  ctx.restore();
}

/* -------------------------------- ASH SERAPH ------------------------------ */

function seraphWing(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  bx: number,
  by: number,
  ang: number,
  len: number,
  dark: boolean,
): void {
  const p: Pal = dark
    ? { main: mix(c.main, c.dark, 0.45), dark: c.dark, glow: mix(c.glow, c.dark, 0.25) }
    : c;
  // Five individually drawn ember feathers fanning off the wing arm.
  const feathers = 6;
  for (let i = 0; i < feathers; i++) {
    const spread = (i / (feathers - 1) - 0.5) * 0.75;
    const a = ang + spread;
    const baseX = bx + Math.cos(ang) * (i * len * 0.11);
    const baseY = by + Math.sin(ang) * (i * len * 0.11);
    const fl = len * (0.55 + 0.45 * Math.sin((i / (feathers - 1)) * Math.PI * 0.75));
    const tipX = baseX + Math.cos(a) * fl;
    const tipY = baseY + Math.sin(a) * fl;
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    part(ctx,
      [[baseX + nx * 4, baseY + ny * 4],
        [baseX + Math.cos(a) * fl * 0.5 + nx * 7, baseY + Math.sin(a) * fl * 0.5 + ny * 7, tipX, tipY],
        [baseX + Math.cos(a) * fl * 0.48 - nx * 5, baseY + Math.sin(a) * fl * 0.48 - ny * 5, baseX - nx * 3, baseY - ny * 3]],
      p, Math.min(baseY, tipY) - 6, Math.max(baseY, tipY) + 6,
      vGrad(ctx, Math.min(baseY, tipY) - 6, Math.max(baseY, tipY) + 6,
        mix(p.main, p.glow, 0.45), p.main, mix(p.main, p.dark, 0.55)),
    );
    // Rachis.
    detail(ctx, [[baseX, baseY], [tipX, tipY]], mix(p.main, p.dark, 0.45), 0.9, 0.45);
    // Ember tip.
    dot(ctx, tipX, tipY, 2.6, p.glow, 0.45);
  }
}

function drawAshSeraph(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  time: number,
  uid: number,
  breath: number,
  atk: number,
  cast: number,
): void {
  const hover = Math.sin(time * 2.7 + uid) * 5 + breath * 0.35;
  const flare = atk * 0.3;

  ctx.save();
  ctx.translate(atk * 22, hover);
  ctx.translate(0, -60);
  ctx.rotate(atk * 0.21);
  ctx.translate(0, 60);

  // Six wings: three far, three near, each of drawn feathers.
  const farAngles = [-2.65, -3.1, 2.9];
  const nearAngles = [-2.35 + flare, -2.95 + flare * 0.6, 2.55 - flare];
  for (let i = 0; i < 3; i++) {
    seraphWing(ctx, c, -8, -108, farAngles[i], 72 + atk * 18, true);
  }
  for (let i = 0; i < 3; i++) {
    seraphWing(ctx, c, -4, -110, nearAngles[i], 84 + atk * 24, false);
  }

  // Robe body with burning tatters.
  part(ctx,
    [[-18, -132], [-6, -146, 12, -144], [22, -126], [28, -90],
      [20 + Math.sin(time * 2.1 + uid) * 5, -44], [12, -10], [4, -24],
      [-4, -4], [-12, -22], [-22, -8], [-26, -52], [-22, -92]],
    c, -148, -2, vGrad(ctx, -148, -2, mix(c.main, c.glow, 0.2), c.main, mix(c.main, c.dark, 0.8)),
  );
  detail(ctx, [[-10, -124], [-14, -88], [-8, -50], [-14, -18]], deep(c), 1, 0.5);
  detail(ctx, [[4, -126], [6, -92], [2, -56], [8, -24]], mix(c.glow, c.main, 0.35), 1, 0.35);
  detail(ctx, [[16, -114], [18, -82], [14, -46]], deep(c), 1, 0.45);
  // Burning robe tatters.
  for (let i = 0; i < 4; i++) {
    const bx = -18 + i * 12;
    const flick = Math.sin(time * 4.2 + uid + i * 1.5) * 4;
    part(ctx, [[bx, -34], [bx + 3 + flick, -14], [bx + 8, -26 + flick], [bx + 6, -4], [bx - 3, -18]], c,
      -36, 0, vGrad(ctx, -36, 0, mix(c.glow, c.main, 0.3), c.main, mix(c.main, c.dark, 0.4)));
    dot(ctx, bx + 4, -10 + flick, 2.4, c.glow, 0.4);
  }

  // Faceless hood and shoulder mantle.
  part(ctx, [[-20, -126], [-14, -146, 2, -154], [18, -146], [26, -126], [4, -118], [-12, -120]], c,
    -156, -116, toneGrad(ctx, c, -156, -116, 0.35, 0.68));
  part(ctx, [[-8, -136], [-4, -148, 8, -148], [14, -136], [6, -128], [-2, -130]],
    { main: deep(c), dark: deep(c), glow: c.glow }, -150, -126,
    vGrad(ctx, -150, -126, c.dark, deep(c), '#130a18'));
  // Broken halo above the hood.
  for (let i = 0; i < 3; i++) {
    const a0 = -2.6 + i * 0.7;
    const a1 = a0 + 0.45;
    const r = 22;
    part(ctx,
      [[Math.cos(a0) * r, -158 + Math.sin(a0) * r],
        [Math.cos((a0 + a1) * 0.5) * (r + 3), -158 + Math.sin((a0 + a1) * 0.5) * (r + 3), Math.cos(a1) * r, -158 + Math.sin(a1) * r],
        [Math.cos(a1) * (r - 2), -158 + Math.sin(a1) * (r - 2)],
        [Math.cos((a0 + a1) * 0.5) * (r - 2), -158 + Math.sin((a0 + a1) * 0.5) * (r - 2), Math.cos(a0) * (r - 2), -158 + Math.sin(a0) * (r - 2)]],
      c, -184, -134, vGrad(ctx, -184, -134, '#ffffff', c.glow, c.main));
    dot(ctx, Math.cos(a1) * r, -158 + Math.sin(a1) * r, 2.4, c.glow, 0.5);
  }

  // Skeletal hands; one lifts during cast.
  const handY = -92 + riseHand(cast);
  limb(ctx, c, 16, -116, 30, handY + 8, 4.2, 2.6, 2);
  part(ctx, [[26, handY - 2], [36, handY - 4], [38, handY + 4], [28, handY + 6]], c,
    handY - 6, handY + 8, toneGrad(ctx, c, handY - 6, handY + 8, 0.5, 0.6));
  for (let i = 0; i < 3; i++) {
    limb(ctx, c, 36, handY + i * 2, 46, handY - 4 + i * 4, 1.4, 0.5, 1);
  }
  limb(ctx, { main: mix(c.main, c.dark, 0.4), dark: c.dark, glow: c.glow }, -14, -114, -28, -96, 3.4, 2.2, -2);
  if (cast > 0.03) {
    dot(ctx, 34, handY - 2, 5 + cast * 12, c.glow, 0.4 + cast * 0.45);
  }

  // Drifting embers.
  for (let i = 0; i < 6; i++) {
    const px = Math.sin(time * 1.3 + uid + i * 1.7) * 44;
    const py = -110 + Math.cos(time * 1.1 + i * 1.4) * 54;
    dot(ctx, px, py, 2, c.glow, 0.4);
  }

  ctx.restore();
}

function riseHand(cast: number): number {
  return cast * 16;
}

/* --------------------------------- DUSK WYRM ------------------------------ */

function drawDuskWyrm(
  ctx: CanvasRenderingContext2D,
  c: Pal,
  time: number,
  uid: number,
  breath: number,
  atk: number,
  cast: number,
): void {
  const rise = breath * 0.5;
  const flap = Math.sin(time * 4.0 + uid) * 7;
  const tail = Math.sin(time * 2.4 + uid) * 7;
  const neckX = atk * 34;
  const neckY = -atk * 6 + cast * -10;

  ctx.save();
  ctx.translate(0, -4);
  ctx.rotate(atk * 0.21);
  ctx.translate(0, 4);

  // Coiled tail and low body.
  part(ctx,
    [[-12, -42 + rise], [-34, -32 + rise, -58, -12 + tail * 0.3],
      [-86, -8 + tail, -96, -22 + tail], [-70, -4 + tail * 0.4, -44, -6],
      [-22, -10, -8, -26 + rise]],
    c, -44, 2, vGrad(ctx, -44, 2, mix(c.main, c.glow, 0.15), c.main, mix(c.main, c.dark, 0.8)),
  );
  detail(ctx, [[-24, -22], [-48, -12 + tail * 0.4], [-78, -14 + tail * 0.7]], c.glow, 1, 0.35);
  // Sprouting barbs along the tail.
  for (let i = 0; i < 4; i++) {
    thorn(ctx, c, -40 - i * 14, -12 - i * 0.5 + tail * (0.3 + i * 0.12), -1.9, 6);
  }

  // Low legs.
  limb(ctx, { main: mix(c.main, c.dark, 0.35), dark: c.dark, glow: c.glow }, -14, -36, -22, -14, 7, 5, 1);
  limb(ctx, { main: mix(c.main, c.dark, 0.35), dark: c.dark, glow: c.glow }, -22, -14, -18, -2, 5, 3.5, 2);
  part(ctx, [[-28, -4], [-10, -3], [-8, 0], [-30, 0]], { main: mix(c.main, c.dark, 0.35), dark: c.dark, glow: c.glow },
    -5, 1, darkGrad(ctx, c, -5, 1));
  limb(ctx, c, 8, -38, 16, -14, 7, 5, -1);
  limb(ctx, c, 16, -14, 22, -2, 5, 3.5, -2);
  part(ctx, [[10, -4], [30, -3], [32, 0], [8, 0]], c, -5, 1, toneGrad(ctx, c, -5, 1, 0.3, 0.7));

  // Torso.
  part(ctx,
    [[-24, -44 + rise], [-20, -70 + rise, 0, -84 + rise], [22, -78 + rise],
      [34, -56 + rise, 26, -34 + rise], [4, -26 + rise, -16, -30 + rise]],
    c, -86, -24, vGrad(ctx, -86, -24, mix(c.main, c.glow, 0.2), c.main, mix(c.main, c.dark, 0.8)),
  );
  // Hinted scales.
  for (let i = 0; i < 4; i++) {
    detail(ctx, [[-16 + i * 9, -64 + rise], [-10 + i * 9, -52 + rise], [-16 + i * 9, -42 + rise]], mix(c.glow, c.main, 0.35), 0.9, 0.32);
  }

  // Membrane wings with finger bones.
  const wingAngle = -2.55 - atk * 0.15;
  const wingLen = 82 + atk * 18;
  for (let side = 0; side < 2; side++) {
    const p: Pal = side === 0
      ? { main: mix(c.main, c.dark, 0.4), dark: c.dark, glow: mix(c.glow, c.dark, 0.2) }
      : c;
    const bx = -10 - side * 6;
    const by = -74 + rise + side * 4;
    const a = wingAngle + side * 0.12;
    const tipX = bx + Math.cos(a) * wingLen;
    const tipY = by + Math.sin(a) * wingLen + flap;
    part(ctx,
      [[bx, by], [bx + Math.cos(a - 0.25) * wingLen * 0.55, by + Math.sin(a - 0.25) * wingLen * 0.55 + flap * 0.5, tipX, tipY],
        [bx - 24, by + 16 + flap * 0.4], [bx - 34, by + 2], [bx - 20, by - 10]],
      p, Math.min(by, tipY) - 8, Math.max(by, tipY) + 18,
      vGrad(ctx, Math.min(by, tipY) - 8, Math.max(by, tipY) + 18,
        mix(p.main, p.glow, 0.35), p.main, mix(p.main, p.dark, 0.6)),
    );
    // Finger bones.
    for (let f = 0; f < 4; f++) {
      const fa = a - 0.28 + f * 0.17;
      detail(ctx, [[bx, by], [bx + Math.cos(fa) * wingLen * 0.8, by + Math.sin(fa) * wingLen * 0.8 + flap * 0.6]], mix(p.main, p.dark, 0.35), 1, 0.5);
    }
    // Clawed wing thumb.
    limb(ctx, p, bx - 4, by - 8, bx - 20, by - 24 + flap * 0.3, 2.4, 0.8, 2);
  }

  // S-curved neck rising from the shoulders.
  const n0x = 16;
  const n0y = -68 + rise;
  const n1x = 28 + neckX * 0.3;
  const n1y = -102 + rise + neckY * 0.4;
  const n2x = 22 + neckX * 0.7;
  const n2y = -132 + rise + neckY * 0.8;
  part(ctx,
    [[n0x - 13, n0y], [n1x - 14, n1y, n1x - 10, n1y + 18], [n2x - 9, n2y, n2x - 7, n2y + 16],
      [n2x + 7, n2y + 16], [n2x + 10, n2y - 2, n1x + 12, n1y + 20],
      [n1x + 14, n1y + 34, n0x + 13, n0y]],
    c, Math.min(n0y, n2y) - 16, Math.max(n0y, n2y) + 8,
    vGrad(ctx, Math.min(n0y, n2y) - 16, Math.max(n0y, n2y) + 8,
      mix(c.main, c.glow, 0.25), c.main, mix(c.main, c.dark, 0.8)),
  );
  // Neck scales and glowing throat.
  for (let i = 0; i < 5; i++) {
    const sy = n0y - 12 - i * 10;
    const sx = n0x + (n2x - n0x) * (i / 5);
    detail(ctx, [[sx - 7, sy], [sx, sy - 5], [sx + 7, sy]], mix(c.glow, c.main, 0.4), 0.9, 0.3);
  }
  dot(ctx, n1x + 8, n1y + 18, 8 + cast * 10, c.glow, 0.3 + cast * 0.4);

  // Dragon skull, jaw open on attack.
  ctx.save();
  ctx.translate(n2x + 16, n2y - 12);
  ctx.rotate(-0.08 + atk * 0.18 - cast * 0.12);
  part(ctx, [[-18, 8], [-16, -12, -2, -22], [18, -20], [30, -8], [24, 6], [4, 12]], c,
    -24, 14, toneGrad(ctx, c, -24, 14, 0.35, 0.7));
  // Snout.
  part(ctx, [[16, -10], [38, -12, 48, -8], [44, 0], [20, 2]], c, -14, 4,
    toneGrad(ctx, c, -14, 4, 0.5, 0.6));
  // Horns and crest.
  part(ctx, [[-10, -14], [-26, -30, -34, -40], [-18, -28, -2, -16]], c,
    -42, -12, toneGrad(ctx, c, -42, -12, 0.3, 0.68));
  part(ctx, [[4, -18], [10, -34, 20, -42], [16, -30, 14, -18]], c,
    -44, -16, toneGrad(ctx, c, -44, -16, 0.5, 0.55));
  for (let i = 0; i < 3; i++) {
    limb(ctx, c, -8 + i * 8, -18, -14 + i * 9, -30 - i * 2, 2.2, 0.8, 2);
  }
  eye(ctx, 14, -6, c, 2.4, 0.9);
  // Lower jaw.
  ctx.save();
  ctx.translate(18, 6);
  ctx.rotate(atk * 0.6 + cast * 0.15);
  part(ctx, [[0, 0], [18, -2, 26, 2], [14, 10], [0, 8]], c, -4, 12,
    toneGrad(ctx, c, -4, 12, 0.35, 0.7));
  for (let i = 0; i < 3; i++) {
    detail(ctx, [[6 + i * 6, 3], [6 + i * 6, 7]], '#f6ead4', 1, 0.55);
  }
  ctx.restore();
  if (cast > 0.03) {
    dot(ctx, 36, 2, 5 + cast * 12, c.glow, 0.35 + cast * 0.45);
  }
  ctx.restore();

  ctx.restore();
}
