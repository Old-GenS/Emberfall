import type { Unit } from '../combat';
import { vGrad, paintShape, softBacklight, type Seg } from './kit';

/* --------------------------------------------------------------------------
 * Four heroes, painted in local unit space: feet on y = 0, facing +x.
 * Every body part goes through paintShape with a vertical gradient, a shade
 * plane on its lower/back side and a light plane on its upper/front plane.
 * Only sin/cos of time and uid drive the idle variation.
 * ------------------------------------------------------------------------ */

const EDGE_WARDEN = '#0a1226';
const EDGE_PYRO = '#280713';
const EDGE_SHADOW = '#100a20';
const EDGE_SPIRIT = '#0a2115';

const SHADE = 'rgba(8,4,14,0.32)';
const LIGHT = 'rgba(255,244,222,0.15)';

/* --------------------------------- helpers -------------------------------- */

function limbSegs(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w1: number,
  w2: number,
  bend = 0,
): Seg[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const mx = (x1 + x2) / 2 + px * bend;
  const my = (y1 + y2) / 2 + py * bend;
  const wm = (w1 + w2) / 2;
  return [
    [x1 + px * w1 * 0.82, y1 + py * w1 * 0.82],
    [mx + px * wm, my + py * wm, x2 + px * w2, y2 + py * w2],
    [x2 + ux * w2 * 0.45 + px * w2 * 0.55, y2 + uy * w2 * 0.45 + py * w2 * 0.55],
    [x2 + ux * w2 * 0.45 - px * w2 * 0.55, y2 + uy * w2 * 0.45 - py * w2 * 0.55],
    [x2 - px * w2, y2 - py * w2],
    [mx - px * wm, my - py * wm, x1 - px * w1, y1 - py * w1],
    [x1 - ux * w1 * 0.3 - px * w1 * 0.82, y1 - uy * w1 * 0.3 - py * w1 * 0.82],
  ];
}

function limbStrip(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w1: number,
  w2: number,
  side: number,
  bend = 0,
): Seg[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * side;
  const py = (dx / len) * side;
  const ox1 = px * w1 * 0.45;
  const oy1 = py * w1 * 0.45;
  const ox2 = px * w2 * 0.45;
  const oy2 = py * w2 * 0.45;
  return limbSegs(
    x1 + ox1,
    y1 + oy1,
    x2 + ox2,
    y2 + oy2,
    w1 * 0.52,
    w2 * 0.52,
    bend,
  );
}

function limb(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w1: number,
  w2: number,
  bend: number,
  top: string,
  mid: string,
  bot: string,
  edge: string,
  ew = 1.7,
  side = 1,
): void {
  const segs = limbSegs(x1, y1, x2, y2, w1, w2, bend);
  const yT = Math.min(y1, y2) - Math.max(w1, w2);
  const yB = Math.max(y1, y2) + Math.max(w1, w2);
  paintShape(ctx, segs, vGrad(ctx, yT, yB, top, mid, bot), {
    edge,
    edgeWidth: ew,
    shade: limbStrip(x1, y1, x2, y2, w1, w2, side, bend),
    light: limbStrip(x1, y1, x2, y2, w1, w2, -side, bend),
    shadeColor: SHADE,
    lightColor: LIGHT,
  });
}

function part(
  ctx: CanvasRenderingContext2D,
  segs: Seg[],
  yT: number,
  yB: number,
  top: string,
  mid: string,
  bot: string,
  edge: string,
  shade?: Seg[],
  light?: Seg[],
  ew = 1.8,
): void {
  paintShape(ctx, segs, vGrad(ctx, yT, yB, top, mid, bot), {
    edge,
    edgeWidth: ew,
    shade,
    light,
    shadeColor: SHADE,
    lightColor: LIGHT,
  });
}

function ellipseSegs(cx: number, cy: number, rx: number, ry: number, rot = 0): Seg[] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const p = (x: number, y: number): [number, number] => [cx + x * c - y * s, cy + x * s + y * c];
  const k = 0.5523;
  return [
    p(rx, 0),
    [...p(rx, ry * k), ...p(0, ry)],
    [...p(-rx, ry * k), ...p(-rx, 0)],
    [...p(-rx, -ry * k), ...p(0, -ry)],
    [...p(rx, -ry * k), ...p(rx, 0)],
  ] as Seg[];
}

function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  edge: string,
  ew = 1,
): void {
  paintShape(ctx, ellipseSegs(x, y, rx, ry), fill, { edge, edgeWidth: ew });
}

/** Soft additive-ish glow for flames, eyes, lanterns and motes. */
function glowAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = ctx.createRadialGradient(x, y, r * 0.04, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(0.45, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function folds(
  ctx: CanvasRenderingContext2D,
  lines: Array<[number, number, number, number, number, number]>,
  color: string,
  width = 1,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [x1, y1, cx, cy, x2, y2] of lines) {
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
  }
  ctx.stroke();
  ctx.restore();
}

function streak(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  alpha = 0.55,
  width = 1.1,
): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function sunburstSegs(cx: number, cy: number, r: number, rIn: number, rays: number, rot = 0): Seg[] {
  const pts: Seg[] = [];
  for (let i = 0; i < rays * 2; i++) {
    const a = rot + (i / (rays * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : rIn;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

/* ---------------------------------- WARDEN -------------------------------- */

function wardenShield(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cast: number,
  gold: string,
  goldGlow: string,
  blue: string,
): void {
  ctx.save();
  ctx.translate(x, y - cast * 17);
  ctx.rotate(-cast * 0.22);
  if (cast > 0.01) glowAt(ctx, 0, 4, 48, goldGlow, 0.18 + cast * 0.34);
  const kite: Seg[] = [
    [-15, -37],
    [1, -43],
    [16, -36],
    [17, -10, 12, 10],
    [7, 30, 1, 41],
    [-7, 29, -14, 8],
    [-17, -12, -15, -37],
  ];
  part(
    ctx,
    kite,
    -43,
    41,
    blue,
    '#22386a',
    '#0c1730',
    EDGE_WARDEN,
    [[-17, -12], [1, -43], [1, 41], [-14, 8]],
    [[1, -43], [16, -36], [13, -6], [1, -8]],
    2.0,
  );
  streak(ctx, 7, -28, 10, -6, '#eef5ff', 0.5, 1.1);
  // gold border inset
  ctx.save();
  ctx.strokeStyle = gold;
  ctx.globalAlpha *= 0.72;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-13, -32);
  ctx.lineTo(1, -37);
  ctx.lineTo(13, -31);
  ctx.lineTo(13, -9);
  ctx.quadraticCurveTo(11, 12, 1, 32);
  ctx.quadraticCurveTo(-9, 11, -13, -9);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  const sun = sunburstSegs(0, -3, 15, 5.5, 8, 0.2);
  part(ctx, sun, -18, 12, '#fff0b0', gold, '#a97a21', EDGE_WARDEN, undefined, undefined, 1.5);
  dot(ctx, 0, -3, 3.4, 3.4, goldGlow, '#6d4a14', 1);
  folds(ctx, [[-10, 13, 4, 26, 9, 14]], 'rgba(151,185,240,0.5)', 1);
  ctx.restore();
}

function drawWarden(ctx: CanvasRenderingContext2D, u: Unit, time: number): void {
  const c = u.colors;
  const gold = c.main;
  const goldGlow = c.glow;
  const blue = c.cloth ?? '#3b5c9e';
  const steel = c.accent ?? '#dfe8ff';

  const breath = Math.sin(time * 2.45 + u.uid * 0.9) * 2.3;
  const sway = Math.sin(time * 1.55 + u.uid * 1.3) * 4.2;
  const sway2 = Math.sin(time * 1.9 + u.uid * 0.6 + 1.1) * 3;
  const atk = u.anim.attack;
  const cast = u.anim.cast;
  const lean = atk * 0.34;
  const hipY = -98;

  softBacklight(ctx, -6, -128, 86, blue, 0.16);

  // Cloak, behind everything, with a tattered hem and its own slow sway.
  const cloak: Seg[] = [
    [-5, -174 + breath],
    [-30, -156, -44, -112],
    [-53 + sway, -58, -54 + sway * 0.8, -6],
    [-47 + sway, 5],
    [-41 + sway, -9],
    [-34 + sway, 3],
    [-27 + sway, -11],
    [-19 + sway, 2],
    [-12 + sway * 0.5, -9],
    [-7, -58],
    [-1, -124, -4, -172 + breath],
  ];
  part(
    ctx,
    cloak,
    -174,
    5,
    '#4267a9',
    '#243c6d',
    '#0b1328',
    EDGE_WARDEN,
    [[-12, -160], [-46, -92], [-52 + sway, 1], [-17, 1], [-8, -78]],
    [[-4, -170], [-22, -150], [-24, -110], [-6, -118]],
    2.0,
  );
  folds(
    ctx,
    [
      [-20, -150, -35, -80, -38 + sway, -6],
      [-11, -140, -23, -78, -28 + sway, -2],
      [-4, -120, -10, -66, -6, -18],
    ],
    'rgba(10,20,44,0.5)',
    1.05,
  );

  // Legs: long, armoured and slightly splayed. No diamond poleyns.
  limb(ctx, -12, hipY, -18, -46, 9, 7, -1.5, '#7f9cd6', '#35518a', '#15223f', EDGE_WARDEN, 1.8, -1);
  limb(ctx, -18, -48, -23, -10, 7.5, 5.2, 0.5, '#8ea9de', '#3b5a94', '#162442', EDGE_WARDEN, 1.7, -1);
  part(
    ctx,
    [[-31, -12], [-17, -14], [-11, -7], [-13, 1], [-24, 3], [-33, 1]],
    -14,
    3,
    '#91abe0',
    '#3a5992',
    '#14213e',
    EDGE_WARDEN,
    [[-31, -12], [-14, -13], [-14, 2], [-31, 1]],
    [[-25, -12], [-18, -10], [-16, -2]],
    1.8,
  );
  limb(ctx, 12, hipY, 18, -46, 9, 7, 1.5, '#9ab3e6', '#40609c', '#172648', EDGE_WARDEN, 1.8, 1);
  limb(ctx, 18, -48, 23, -10, 7.5, 5.2, -0.5, '#a6bdec', '#4567a5', '#182848', EDGE_WARDEN, 1.7, 1);
  part(
    ctx,
    [[21, -13], [31, -14], [40, -7], [38, 1], [25, 3], [19, 1]],
    -15,
    3,
    '#a9c1ef',
    '#466aa8',
    '#182a4a',
    EDGE_WARDEN,
    [[22, -13], [39, -7], [38, 1], [21, 2]],
    [[27, -13], [34, -9], [35, -3]],
    1.8,
  );
  // bright steel streaks down the greaves
  streak(ctx, -21, -42, -19, -20, steel, 0.5, 1.1);
  streak(ctx, 20, -42, 22, -20, steel, 0.5, 1.1);
  // rounded gold poleyn trim at each knee
  dot(ctx, -17, -47, 5.5, 4, gold, '#72511a', 1.2);
  dot(ctx, 19, -47, 5.5, 4, gold, '#72511a', 1.2);

  ctx.save();
  ctx.translate(0, -breath);
  ctx.translate(0, hipY);
  ctx.rotate(lean);
  ctx.translate(0, -hipY);
  ctx.translate(atk * 3, 0);

  // Faulds / skirt of plate.
  part(
    ctx,
    [[-18, -104], [18, -104], [25, -83], [12, -74], [3, -82], [-7, -74], [-24, -84]],
    -104,
    -74,
    '#5076bc',
    '#27406f',
    '#101c38',
    EDGE_WARDEN,
    [[-18, -104], [-24, -84], [-7, -74], [-3, -92]],
    [[1, -103], [18, -104], [12, -78], [1, -86]],
    1.9,
  );
  streak(ctx, -12, -100, -20, -80, gold, 0.5, 1);
  streak(ctx, 0, -101, 0, -77, gold, 0.45, 1);
  streak(ctx, 13, -100, 19, -81, gold, 0.5, 1);

  // Cuirass.
  part(
    ctx,
    [
      [-24, -165],
      [-18, -150, -15, -126],
      [-12, -112],
      [0, -104],
      [12, -112],
      [15, -126, 18, -150],
      [24, -165],
      [12, -172],
      [0, -175],
      [-12, -172],
    ],
    -175,
    -104,
    '#8faae0',
    '#35538d',
    '#111e3a',
    EDGE_WARDEN,
    [[-24, -165], [-12, -112], [0, -104], [0, -160], [-12, -172]],
    [[0, -175], [24, -165], [15, -140], [0, -148]],
    2.1,
  );
  // fluting
  folds(
    ctx,
    [
      [-14, -160, -8, -140, -8, -120],
      [0, -170, 1, -138, 0, -110],
      [14, -160, 10, -140, 9, -122],
    ],
    'rgba(15,30,64,0.55)',
    1.1,
  );
  streak(ctx, 11, -158, 6, -128, steel, 0.55, 1.2);

  // Gold sunburst on the breastplate.
  const chestSun = sunburstSegs(1, -140, 15.5, 5.5, 8, 0.15);
  part(ctx, chestSun, -156, -124, '#fff1b8', gold, '#9c701d', EDGE_WARDEN, undefined, undefined, 1.5);
  dot(ctx, 1, -140, 4, 4, goldGlow, '#6e4a12', 1);
  // Gorget.
  part(
    ctx,
    [[-13, -168], [13, -168], [10, -176], [0, -179], [-10, -176]],
    -179,
    -168,
    '#fff0b2',
    gold,
    '#9b6d1e',
    EDGE_WARDEN,
    [[-13, -168], [0, -179], [0, -172]],
    [[0, -179], [10, -176], [13, -168]],
    1.7,
  );

  // Head: great helm with a glowing gold cross visor.
  ctx.save();
  ctx.rotate(-lean * 0.22 + Math.sin(time * 1.7 + u.uid) * 0.012);
  part(
    ctx,
    [
      [-13, -176],
      [-15, -194, -9, -207],
      [-4, -215, 0, -217],
      [7, -213, 11, -203],
      [15, -191, 13, -176],
      [5, -170],
      [-4, -170],
    ],
    -217,
    -170,
    '#a8c0ee',
    '#3e5e9c',
    '#152343',
    EDGE_WARDEN,
    [[-13, -176], [-15, -196], [-2, -216], [-1, -178]],
    [[-2, -216], [8, -211], [13, -190], [4, -180]],
    2.0,
  );
  streak(ctx, 7, -204, 11, -184, steel, 0.55, 1.1);
  // dark visor recess
  part(
    ctx,
    [[-11, -198], [10, -198], [9, -181], [0, -177], [-10, -181]],
    -198,
    -177,
    '#10203c',
    '#0b152a',
    '#060c18',
    EDGE_WARDEN,
    undefined,
    undefined,
    1.3,
  );
  // gold cross
  part(
    ctx,
    [[-1.7, -205], [2.3, -205], [2.3, -180], [-1.7, -180]],
    -205,
    -180,
    '#fff4c0',
    gold,
    '#a4731e',
    EDGE_WARDEN,
    undefined,
    undefined,
    1.2,
  );
  part(
    ctx,
    [[-9, -195], [10, -195], [10, -191.5], [-9, -191.5]],
    -195,
    -191.5,
    '#fff4c0',
    gold,
    '#a4731e',
    EDGE_WARDEN,
    undefined,
    undefined,
    1.2,
  );
  glowAt(ctx, 0, -193, 16, goldGlow, 0.3 + cast * 0.25 + atk * 0.15);
  // helm crest ridge
  part(
    ctx,
    [[-3, -214], [0, -227], [4, -214], [0, -210]],
    -227,
    -210,
    '#fff1b4',
    gold,
    '#946a1c',
    EDGE_WARDEN,
    [[-3, -214], [0, -227], [0, -211]],
    [[0, -227], [4, -214], [1, -212]],
    1.3,
  );
  ctx.restore();

  // Layered pauldrons.
  const pauldron = (
    x: number,
    y: number,
    side: number,
    top: string,
    mid: string,
    bot: string,
  ): void => {
    for (let i = 0; i < 3; i++) {
      const off = i * 4.5;
      const yy = y + off;
      const segs: Seg[] = [
        [x - side * 2, yy],
        [x + side * (10 - i * 1.5), yy - 5 + i],
        [x + side * (18 - i * 2), yy + 3],
        [x + side * (12 - i * 1.5), yy + 8],
        [x + side * 2, yy + 6],
      ];
      part(
        ctx,
        segs,
        yy - 7,
        yy + 9,
        top,
        mid,
        bot,
        EDGE_WARDEN,
        [[x - side * 2, yy], [x + side * (12 - i * 2), yy + 6], [x + side * 2, yy + 6]],
        [[x + side * 5, yy - 3], [x + side * (16 - i * 2), yy + 1], [x + side * 9, yy + 5]],
        1.5,
      );
      streak(ctx, x + side * 5, yy - 2, x + side * 12, yy + 2, gold, 0.5, 1);
    }
  };
  pauldron(-22, -166, -1, '#7f9bd6', '#2c477e', '#111d39');
  pauldron(22, -166, 1, '#9db6e8', '#3a5b97', '#152444');

  // Sword arm.
  const handX = 45 + atk * 12;
  const handY = -122;
  limb(ctx, 25, -160, 38, -140, 7.5, 6, 1, '#91ace2', '#3b5a95', '#152342', EDGE_WARDEN, 1.7, 1);
  limb(ctx, 38, -140, handX - 3, handY, 6, 4.8, 0.5, '#9db7e9', '#42629e', '#172647', EDGE_WARDEN, 1.6, 1);
  dot(ctx, handX - 3, handY - 1, 4, 4, '#2c3f68', EDGE_WARDEN, 1.1);

  // Longsword, rotating forward with the attack.
  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(-0.12 + atk * 1.5 + Math.sin(time * 1.6 + u.uid) * 0.015);
  const blade: Seg[] = [
    [-5, -10],
    [-5.5, -78],
    [-2.5, -99],
    [0, -105],
    [2.5, -99],
    [5.5, -78],
    [5, -10],
  ];
  part(
    ctx,
    blade,
    -105,
    -10,
    '#ffffff',
    '#dce8ff',
    '#7d9ace',
    EDGE_WARDEN,
    [[-5, -10], [-5.5, -78], [0, -105], [0, -10]],
    [[0, -105], [2.5, -99], [5, -10], [0, -12]],
    1.7,
  );
  streak(ctx, 1.6, -96, 1.6, -22, '#ffffff', 0.55, 1.1);
  // fuller
  streak(ctx, -1.6, -80, -1.6, -18, '#6f8ab8', 0.5, 1);
  // crossguard
  part(
    ctx,
    [[-15, -7], [-15, -3], [0, -1], [15, -3], [15, -7], [0, -9]],
    -9,
    -1,
    '#fff0ac',
    gold,
    '#9b6c1c',
    EDGE_WARDEN,
    [[-15, -4], [0, -1], [15, -4], [0, -5]],
    [[0, -9], [15, -7], [15, -4], [0, -5]],
    1.3,
  );
  part(ctx, [[-3, -1], [3, -1], [3, 13], [0, 16], [-3, 13]], -1, 16, '#5d4030', '#3a2419', '#1c110c', EDGE_WARDEN, undefined, undefined, 1.2);
  dot(ctx, 0, 16, 3.4, 3, gold, '#6e4b14', 1.1);
  ctx.restore();

  // Shield arm and ornate kite shield, lifting and glowing on cast.
  ctx.save();
  ctx.translate(0, -cast * 5);
  limb(ctx, -24, -160, -40, -134, 7, 5.5, -1, '#7f9ad4', '#2f4a80', '#111d39', EDGE_WARDEN, 1.7, -1);
  limb(ctx, -40, -134, -46, -114 + cast * 8, 5.5, 4.4, -0.4, '#8aa5dc', '#345089', '#13203d', EDGE_WARDEN, 1.6, -1);
  dot(ctx, -46, -113 + cast * 8, 3.6, 3.6, '#2c3f68', EDGE_WARDEN, 1.1);
  wardenShield(ctx, -48, -104 + cast * 8, cast, gold, goldGlow, blue);
  ctx.restore();

  ctx.restore();
}

/* -------------------------------- PYROMANCER ------------------------------ */

function drawFlame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  time: number,
  uid: number,
  phase: number,
  alpha: number,
): void {
  if (scale <= 0.01) return;
  const fl = Math.sin(time * 7.2 + phase + uid) * 2.6;
  const fl2 = Math.sin(time * 5.1 + phase * 1.7 + uid) * 2;
  const fl3 = Math.sin(time * 9.4 + phase * 0.6 + uid) * 1.4;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;
  glowAt(ctx, 1, -22, 40, '#ff7a24', 0.42);
  // red outer tongue
  part(
    ctx,
    [
      [-11, 4],
      [-17, -8, -15, -24 + fl],
      [-10, -15],
      [-9, -34, -3, -46 - fl],
      [2, -34],
      [8, -42, 13, -55 + fl2],
      [13, -36, 16, -24],
      [22, -30, 23, -18 + fl3],
      [15, -12, 12, 2],
    ],
    -56,
    5,
    '#ffb347',
    '#f0512b',
    '#8f1520',
    EDGE_PYRO,
    [[-13, 2], [-15, -22], [-7, -34], [-2, 2], [-2, -14]],
    [[0, -44], [12, -42], [15, -20], [7, -12]],
    1.5,
  );
  // orange middle tongue
  part(
    ctx,
    [
      [-6, 3],
      [-11, -8, -9, -22 + fl3],
      [-4, -16],
      [-3, -32, 2, -41 - fl],
      [6, -31],
      [10, -35, 12, -42 + fl2],
      [12, -25, 10, -10],
      [4, 3],
    ],
    -43,
    4,
    '#fff0a0',
    '#ffb227',
    '#e0571d',
    EDGE_PYRO,
    [[-6, 2], [-8, -20], [-2, -30], [0, 2]],
    [[2, -37], [10, -31], [9, -14], [4, -4]],
    1.3,
  );
  // yellow-white core
  part(
    ctx,
    [
      [-3, 2],
      [-5, -8, -3, -19],
      [0, -14],
      [1, -27, 4, -32 - fl],
      [7, -24, 6, -12],
      [3, 2],
    ],
    -33,
    3,
    '#ffffff',
    '#fff3a8',
    '#ffb52e',
    '#5b2a08',
    undefined,
    undefined,
    1.1,
  );
  folds(ctx, [[-2, 0, -1, -14, 0, -22], [4, 0, 4, -12, 3, -20]], 'rgba(130,40,12,0.55)', 0.9);
  ctx.restore();

  // 4 rising embers with their own phases.
  for (let i = 0; i < 4; i++) {
    const ph = phase + i * 1.9;
    const bob = (Math.sin(time * 2.1 + ph + uid) + 1) * 0.5;
    const ex = x + Math.sin(time * 1.3 + ph) * (9 + i * 2);
    const ey = y - 16 - i * 10 - bob * 10;
    glowAt(ctx, ex, ey, 7, i % 2 === 0 ? '#ffd25a' : '#ff8030', alpha * 0.8);
    dot(ctx, ex, ey, 1.5, 2.1, i % 2 === 0 ? '#fff1a0' : '#ffb24b', '#7a250c', 0.8);
  }
}

function drawPyromancer(ctx: CanvasRenderingContext2D, u: Unit, time: number): void {
  const c = u.colors;
  const ember = c.main;
  const glow = c.glow;
  const wine = c.cloth ?? '#7d2c4a';
  const pale = c.accent ?? '#ffd9a0';
  const robeMid = '#8e2f4c';
  const robeDark = '#3e1224';

  const breath = Math.sin(time * 2.35 + u.uid * 1.1) * 2.2;
  const sway = Math.sin(time * 1.45 + u.uid * 0.8) * 4;
  const atk = u.anim.attack;
  const cast = u.anim.cast;
  const lean = atk * 0.31;
  const hipY = -88;

  softBacklight(ctx, 2, -122, 76, glow, 0.15);

  // Boots.
  part(ctx, [[-17, -9], [-5, -9], [-2, -2], [-9, 2], [-20, 1], [-22, -5]], -9, 2, '#7a3448', '#3d1626', '#190810', EDGE_PYRO, [[-17, -9], [-2, -2], [-20, 1]], [[-12, -8], [-6, -4], [-9, 0]], 1.6);
  part(ctx, [[2, -9], [13, -9], [19, -3], [18, 1], [0, 2], [-2, -4]], -9, 2, '#945064', '#4a1d30', '#1d0a13', EDGE_PYRO, [[0, -8], [18, -2], [18, 1], [0, 2]], [[3, -8], [10, -5], [12, 0]], 1.6);

  // Long under-robe / skirt, behind the bodice.
  const skirt: Seg[] = [
    [-20, -98],
    [-30, -78, -33 + sway, -32],
    [-34 + sway, -12, -31 + sway, 2],
    [-25 + sway, 7],
    [-19 + sway, -3],
    [-12 + sway * 0.6, 5],
    [-5 + sway * 0.3, -4],
    [2, 4],
    [10 - sway * 0.3, -3],
    [18 - sway * 0.5, 6],
    [26 - sway * 0.6, 1],
    [31 - sway * 0.7, -10],
    [28, -46, 20, -98],
  ];
  part(
    ctx,
    skirt,
    -98,
    7,
    '#a83b58',
    wine,
    '#350e1f',
    EDGE_PYRO,
    [[-20, -98], [-33 + sway, -32], [-31 + sway, 2], [-6, 2], [-4, -55]],
    [[0, -96], [20, -98], [26, -60], [4, -70]],
    2.0,
  );
  folds(
    ctx,
    [
      [-18, -88, -28, -42, -29 + sway, 1],
      [-7, -90, -12, -42, -12 + sway, 3],
      [13, -90, 22, -48, 24 - sway, 2],
    ],
    'rgba(34,7,18,0.55)',
    1.05,
  );

  ctx.save();
  ctx.translate(0, -breath);
  ctx.translate(0, hipY);
  ctx.rotate(lean);
  ctx.translate(0, -hipY);
  ctx.translate(atk * 3, 0);

  // Bodice.
  part(
    ctx,
    [[-18, -150], [-14, -128], [-13, -108], [-11, -92], [0, -86], [11, -92], [13, -108], [14, -128], [18, -150], [0, -157]],
    -157,
    -86,
    '#b24662',
    robeMid,
    robeDark,
    EDGE_PYRO,
    [[-18, -150], [-13, -108], [0, -86], [0, -150]],
    [[0, -157], [18, -150], [13, -108], [0, -112]],
    2.0,
  );
  // corset lacing
  folds(
    ctx,
    [
      [-8, -140, 0, -128, 8, -140],
      [-7, -128, 0, -116, 7, -128],
      [-5, -116, 0, -106, 5, -116],
    ],
    'rgba(255,206,142,0.55)',
    1,
  );

  // Rope belt and hanging talismans: dark cord outline with a lit inner twist.
  ctx.save();
  ctx.strokeStyle = '#4a2a12';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-15, -96);
  ctx.quadraticCurveTo(0, -88, 15, -96);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(216,161,94,0.55)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-14, -95);
  ctx.quadraticCurveTo(0, -87, 14, -95);
  ctx.stroke();
  ctx.restore();
  dot(ctx, 0, -91, 3.4, 3.4, '#e8b06c', '#5e3518', 1.1);
  const talisman = (x: number, y: number, len: number): void => {
    part(
      ctx,
      [[x - 2.4, y], [x + 2.4, y], [x + 3.4, y + len - 3], [x, y + len], [x - 3.4, y + len - 3]],
      y,
      y + len,
      '#f0d5a4',
      '#c9975d',
      '#6e4420',
      EDGE_PYRO,
      [[x - 2.4, y], [x, y + len], [x - 3, y + len - 3]],
      [[x + 1, y + 2], [x + 2, y + len - 4], [x, y + len - 2]],
      1.1,
    );
    streak(ctx, x - 1, y + 3, x - 1, y + len - 4, '#6b3a52', 0.5, 1);
  };
  talisman(-11, -94, 16);
  talisman(0, -94, 20);
  talisman(10, -94, 14);

  // Head: pointed crimson hood, shadowed face and two ember eyes.
  ctx.save();
  ctx.rotate(-lean * 0.18 + cast * 0.12);
  part(
    ctx,
    [
      [-18, -148],
      [-24, -168, -14, -186],
      [-6, -197, 2, -194],
      [14, -184, 15, -164],
      [17, -152, 10, -144],
      [0, -140],
      [-11, -142],
    ],
    -197,
    -140,
    '#c24a68',
    wine,
    '#380e20',
    EDGE_PYRO,
    [[-18, -148], [-14, -182], [2, -196], [1, -150]],
    [[2, -196], [14, -184], [16, -156], [4, -148]],
    2.0,
  );
  folds(ctx, [[-12, -178, -18, -162, -12, -148], [8, -184, 12, -166, 9, -152]], 'rgba(38,8,20,0.55)', 1);
  // face shadow inside the hood
  part(
    ctx,
    [[-5, -174], [10, -176], [12, -156], [5, -146], [-4, -150], [-8, -160]],
    -176,
    -146,
    '#351a26',
    '#1c0c16',
    '#0a0409',
    '#290714',
    undefined,
    undefined,
    1.4,
  );
  glowAt(ctx, 3, -163, 13, glow, 0.32);
  dot(ctx, 1.2, -165, 2.2, 1.4, '#ffb24e', '#6a2a0c', 0.9);
  dot(ctx, 8, -163, 2.4, 1.5, '#ffbe5c', '#6a2a0c', 0.9);
  streak(ctx, 0, -164.5, 3, -165.5, '#fff1c0', 0.55, 0.8);
  // hood point flicker tassel
  ctx.restore();

  // Back sleeve (left), raised on cast.
  const backHandX = -30 - cast * 2;
  const backHandY = -105 - cast * 38;
  limb(
    ctx,
    -19,
    -148,
    -27,
    -126 - cast * 16,
    6.5,
    5,
    -1.5,
    '#a63a58',
    wine,
    '#350d1e',
    EDGE_PYRO,
    1.6,
    -1,
  );
  limb(
    ctx,
    -27,
    -126 - cast * 16,
    backHandX,
    backHandY,
    5,
    4.2,
    -1,
    '#b04a66',
    '#7f2944',
    '#3b1022',
    EDGE_PYRO,
    1.5,
    -1,
  );
  // wide bell sleeve hanging from the back arm
  const bell: Seg[] = [
    [-31, -138 - cast * 16],
    [-45, -134 - cast * 16 + sway * 0.4],
    [-50 + sway * 0.5, -112 - cast * 22],
    [-44, -96 - cast * 26],
    [-34, -108 - cast * 18],
    [-24, -122 - cast * 16],
  ];
  part(
    ctx,
    bell,
    -140,
    -92,
    '#bf4d6c',
    robeMid,
    '#431126',
    EDGE_PYRO,
    [[-31, -138 - cast * 16], [-50 + sway * 0.5, -112 - cast * 22], [-35, -100 - cast * 22]],
    [[-30, -130 - cast * 16], [-38, -114 - cast * 20], [-30, -106 - cast * 18]],
    1.6,
  );
  folds(ctx, [[-34, -132 - cast * 16, -41, -116 - cast * 20, -38 + sway, -100 - cast * 22]], 'rgba(44,9,23,0.55)', 1);
  dot(ctx, backHandX, backHandY, 3.6, 3.6, '#b9816a', '#4a2418', 1);

  // Front sleeve, raised, holding the flame.
  const fhX = 42 + atk * 18;
  const fhY = -164 - cast * 9 - atk * 4;
  const elbowX = 31 + atk * 10;
  const elbowY = -151 + atk * 2;
  limb(ctx, 18, -148, elbowX, elbowY, 7, 5.5, 1.2, '#c05470', wine, '#390f21', EDGE_PYRO, 1.6, 1);
  limb(ctx, elbowX, elbowY, fhX, fhY, 5.5, 4.4, 0.5, '#c85d76', '#852d49', '#3c1023', EDGE_PYRO, 1.5, 1);
  // wide flowing front sleeve
  const frontBell: Seg[] = [
    [elbowX - 3, elbowY - 3],
    [elbowX + 10, elbowY - 10],
    [elbowX + 18, elbowY + 9],
    [elbowX + 15, elbowY + 30 + sway],
    [elbowX + 3, elbowY + 18],
    [elbowX - 6, elbowY + 8],
  ];
  part(
    ctx,
    frontBell,
    elbowY - 10,
    elbowY + 32 + sway,
    '#c85c78',
    robeMid,
    '#3d1022',
    EDGE_PYRO,
    [[elbowX - 4, elbowY], [elbowX + 16, elbowY + 12], [elbowX + 12, elbowY + 30 + sway]],
    [[elbowX + 2, elbowY - 8], [elbowX + 15, elbowY + 2], [elbowX + 12, elbowY + 16]],
    1.6,
  );
  folds(ctx, [[elbowX + 2, elbowY - 4, elbowX + 10, elbowY + 12, elbowX + 8, elbowY + 26 + sway]], 'rgba(46,10,24,0.55)', 1);
  dot(ctx, fhX, fhY, 4.2, 4, '#c08a70', '#4e2719', 1.1);

  // Flame in the raised hand: three layered tongues, 4 rising embers.
  const flameScale = (1 + atk * 0.5 + cast * 0.85) * (0.96 + Math.sin(time * 2.6 + u.uid) * 0.04);
  glowAt(ctx, fhX, fhY - 20, 38 + cast * 20, glow, 0.3 + cast * 0.22 + atk * 0.12);
  drawFlame(ctx, fhX, fhY - 2, flameScale, time, u.uid, 0, 1);
  if (cast > 0.05) {
    drawFlame(ctx, backHandX, backHandY - 4, 0.5 + cast * 0.5, time, u.uid + 2, 2.3, 0.9);
  }

  ctx.restore();
}

/* -------------------------------- SHADOWBLADE ----------------------------- */

function jadeDagger(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  scale: number,
  glow: string,
  jade: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  // curved jade blade
  const blade: Seg[] = [
    [-4, -3],
    [4, -3],
    [6, -14, 10, -26],
    [13, -36, 7, -43],
    [3, -38, 1, -26],
    [-2, -14, -4, -6],
  ];
  part(
    ctx,
    blade,
    -43,
    -3,
    '#f0fff8',
    jade,
    '#12503f',
    EDGE_SHADOW,
    [[-4, -3], [1, -26], [7, -43], [1, -20]],
    [[0, -40], [9, -34], [5, -14], [1, -8]],
    1.5,
  );
  streak(ctx, 2, -34, 0.5, -12, '#ffffff', 0.55, 0.9);
  folds(ctx, [[1, -10, 5, -20, 3, -32]], 'rgba(9,48,38,0.5)', 0.8);
  // gold guard
  part(
    ctx,
    [[-10, -4], [0, -6], [10, -4], [8, 0], [0, -1], [-8, 0]],
    -6,
    0,
    '#ffe9a8',
    '#c99844',
    '#6a4417',
    EDGE_SHADOW,
    [[-10, -4], [0, -1], [8, 0], [0, -2]],
    [[0, -6], [10, -4], [8, 0], [0, -2]],
    1.1,
  );
  // wrapped grip and pommel
  part(ctx, [[-2.7, 0], [2.7, 0], [2.7, 12], [-2.7, 12]], 0, 12, '#5b4376', '#392a50', '#1a1228', EDGE_SHADOW, [[-2.7, 0], [0, 12], [0, 0]], [[0, 0], [2.7, 0], [2.7, 12]], 1.1);
  for (let i = 0; i < 3; i++) {
    streak(ctx, -2.5, 2 + i * 3.4, 2.5, 3.4 + i * 3.4, '#9d84c4', 0.5, 0.8);
  }
  glowAt(ctx, 0, 13, 8, glow, 0.35);
  dot(ctx, 0, 13, 2.2, 2.2, jade, '#0f3a30', 0.9);
  ctx.restore();
}

function drawShadowblade(ctx: CanvasRenderingContext2D, u: Unit, time: number): void {
  const c = u.colors;
  const purple = c.main;
  const glow = c.glow;
  const leather = c.cloth ?? '#24203a';
  const jade = c.accent ?? '#7df2c0';

  const breath = Math.sin(time * 2.4 + u.uid * 0.7) * 2.0;
  const sway = Math.sin(time * 1.75 + u.uid * 1.2) * 5;
  const sway2 = Math.sin(time * 1.45 + u.uid * 0.4 + 2.1) * 4.5;
  const atk = u.anim.attack;
  const cast = u.anim.cast;
  const lean = 0.12 + atk * 0.34;
  const hipY = -80;

  softBacklight(ctx, -8, -110, 70, purple, 0.15);

  // Two trailing scarf tails, each with its own phase.
  const scarf = (baseX: number, baseY: number, dx: number, dy: number, ph: number, top: string, mid: string): void => {
    const s = Math.sin(time * 1.85 + u.uid * 0.9 + ph) * 5;
    const s2 = Math.sin(time * 1.4 + ph + 1.2) * 3.5;
    const segs: Seg[] = [
      [baseX, baseY],
      [baseX - 14, baseY - 6 + s2, baseX - 26 + s, baseY + dy * 0.2],
      [baseX - 32 + s, baseY + dy * 0.55 + s2, baseX - 30 + s * 1.3, baseY + dy],
      [baseX - 24 + s, baseY + dy + 5, baseX - 20 + s2, baseY + dy - 2],
      [baseX - 14, baseY + dy * 0.5, baseX - 4, baseY + 2],
    ];
    part(
      ctx,
      segs,
      baseY - 8,
      baseY + dy + 6,
      top,
      mid,
      '#120b22',
      EDGE_SHADOW,
      [[baseX - 4, baseY], [baseX - 30 + s, baseY + dy], [baseX - 20, baseY + dy - 1]],
      [[baseX - 2, baseY + 1], [baseX - 20 + s, baseY + dy * 0.4], [baseX - 12, baseY + dy * 0.6]],
      1.5,
    );
    folds(ctx, [[baseX - 6, baseY + 2, baseX - 22 + s, baseY + dy * 0.5, baseX - 26 + s, baseY + dy - 3]], 'rgba(20,10,40,0.55)', 0.9);
  };
  scarf(-6, -136, 46, 8, 0, '#6b539e', '#3a2a60');
  scarf(-2, -126, 54, 22, 1.7, '#7c62b2', '#432f6e');

  // Crouched legs, knees bent and tracking forward.
  limb(ctx, -8, hipY, -21, -40, 8.5, 6, -2, '#64509a', '#30244f', '#130d24', EDGE_SHADOW, 1.7, -1);
  limb(ctx, -21, -40, -28, -10, 6.5, 4.5, -0.6, '#6f5aa6', '#362a58', '#150f28', EDGE_SHADOW, 1.6, -1);
  part(ctx, [[-36, -9], [-24, -12], [-19, -5], [-22, 1], [-33, 3], [-40, 0]], -12, 3, '#7560aa', '#3a2c5c', '#171028', EDGE_SHADOW, [[-36, -9], [-20, -6], [-20, 2], [-38, 1]], [[-29, -11], [-23, -7], [-25, -1]], 1.6);
  limb(ctx, 8, hipY, 25, -40, 8.5, 6, 2, '#7d66b5', '#3b2d60', '#16102c', EDGE_SHADOW, 1.7, 1);
  limb(ctx, 25, -40, 15, -10, 6.5, 4.5, 0.8, '#8770bf', '#413267', '#18112f', EDGE_SHADOW, 1.6, 1);
  part(ctx, [[7, -10], [19, -11], [27, -4], [25, 1], [10, 3], [4, 0]], -11, 3, '#8b74c3', '#44346c', '#191232', EDGE_SHADOW, [[8, -10], [25, -4], [24, 1], [7, 1]], [[13, -10], [20, -6], [20, -1]], 1.6);
  // leather leg straps
  streak(ctx, -24, -30, -15, -33, '#b99ce8', 0.45, 1);
  streak(ctx, -26, -20, -17, -23, '#b99ce8', 0.4, 1);
  streak(ctx, 15, -30, 24, -34, jade, 0.45, 1);
  streak(ctx, 12, -20, 21, -23, jade, 0.4, 1);

  ctx.save();
  ctx.translate(atk * 5, -breath);
  ctx.translate(0, hipY);
  ctx.rotate(lean);
  ctx.translate(0, -hipY);

  // Hip / abdomen wrap.
  part(
    ctx,
    [[-15, -92], [15, -92], [17, -76], [10, -66], [-10, -66], [-17, -76]],
    -92,
    -66,
    '#5a467f',
    '#2b2047',
    '#120c20',
    EDGE_SHADOW,
    [[-15, -92], [-17, -76], [-10, -66], [-4, -80]],
    [[0, -90], [15, -92], [12, -70], [2, -74]],
    1.7,
  );
  // layered leather cuirass
  part(
    ctx,
    [[-16, -142], [-12, -118], [-10, -98], [0, -92], [10, -98], [12, -118], [16, -142], [0, -150]],
    -150,
    -92,
    '#7b64b0',
    '#3a2b5e',
    '#150f29',
    EDGE_SHADOW,
    [[-16, -142], [-10, -98], [0, -92], [0, -140]],
    [[0, -150], [16, -142], [12, -118], [0, -122]],
    1.9,
  );
  // overlapping chest panels
  part(
    ctx,
    [[-14, -138], [12, -141], [14, -128], [10, -120], [-11, -122]],
    -141,
    -120,
    '#8a72c2',
    '#4a3874',
    '#1a1231',
    EDGE_SHADOW,
    [[-14, -138], [10, -120], [-1, -121], [-6, -132]],
    [[-2, -139], [13, -140], [11, -128], [0, -130]],
    1.4,
  );
  part(
    ctx,
    [[-11, -122], [11, -121], [12, -108], [7, -101], [-9, -102]],
    -122,
    -101,
    '#9a82d0',
    '#513f80',
    '#1d1438',
    EDGE_SHADOW,
    [[-11, -122], [7, -101], [-1, -103], [-3, -115]],
    [[0, -121], [12, -120], [10, -108], [0, -110]],
    1.3,
  );
  // crossed shoulder strap
  ctx.save();
  ctx.strokeStyle = '#241a3c';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-13, -138);
  ctx.lineTo(12, -104);
  ctx.stroke();
  ctx.strokeStyle = '#a88be0';
  ctx.lineWidth = 1;
  ctx.globalAlpha *= 0.55;
  ctx.beginPath();
  ctx.moveTo(-13, -140);
  ctx.lineTo(12, -106);
  ctx.stroke();
  ctx.restore();
  dot(ctx, 1, -118, 3.2, 3.2, '#d9ccf4', '#2a2040', 1);
  folds(ctx, [[-9, -136, -4, -120, -6, -104], [8, -134, 5, -118, 7, -104]], 'rgba(26,16,48,0.55)', 1);

  // Head: pointed hood, face mask, two pale eyes.
  ctx.save();
  ctx.rotate(-lean * 0.25);
  part(
    ctx,
    [
      [-14, -146],
      [-17, -163, -7, -177],
      [2, -183, 8, -176],
      [17, -162, 15, -144],
      [8, -137],
      [-4, -138],
    ],
    -183,
    -137,
    '#8369bd',
    '#3e2e68',
    '#17102e',
    EDGE_SHADOW,
    [[-14, -146], [-17, -164], [-2, -181], [-2, -145]],
    [[-2, -181], [8, -176], [16, -156], [3, -146]],
    1.9,
  );
  folds(ctx, [[-11, -166, -15, -153, -9, -143], [9, -170, 13, -155, 9, -144]], 'rgba(24,14,46,0.55)', 1);
  // face mask (lower face covered)
  part(
    ctx,
    [[-4, -168], [11, -169], [12, -151], [6, -142], [-2, -144], [-7, -155]],
    -169,
    -142,
    '#4e3a78',
    '#2c204c',
    '#120b22',
    EDGE_SHADOW,
    [[-4, -168], [-2, -144], [-7, -155]],
    [[3, -168], [12, -160], [9, -148]],
    1.3,
  );
  // pale eyes
  glowAt(ctx, 4, -163, 10, '#cfe8ff', 0.3);
  dot(ctx, 2.2, -164, 2.4, 1.25, '#e8f3ff', '#1c1530', 0.8);
  dot(ctx, 8.6, -163, 2.6, 1.3, '#e8f3ff', '#1c1530', 0.8);
  streak(ctx, 1.2, -164.5, 4, -165.5, '#ffffff', 0.55, 0.7);
  ctx.restore();

  // Arms, hands and reverse-grip daggers.
  const bhx = -28 + atk * 46 + cast * 22;
  const bhy = -106 - atk * 4 - cast * 20;
  const fhx = 33 + atk * 13 - cast * 27;
  const fhy = -110 - atk * 2 - cast * 14;
  const bElbowX = -26 + atk * 16 + cast * 8;
  const bElbowY = -126 - atk * 2 - cast * 4;
  const fElbowX = 29 + atk * 6 - cast * 10;
  const fElbowY = -126 - atk * 2 - cast * 3;
  limb(ctx, -15, -139, bElbowX, bElbowY, 6.5, 5, -1, '#6e57a3', '#352851', '#130d27', EDGE_SHADOW, 1.6, -1);
  limb(ctx, bElbowX, bElbowY, bhx, bhy, 5, 4, -0.5, '#7b64b1', '#3d2e5f', '#16102c', EDGE_SHADOW, 1.5, -1);
  dot(ctx, bhx, bhy, 3.4, 3.4, '#7a5f9e', '#2a1c40', 1);
  limb(ctx, 14, -139, fElbowX, fElbowY, 6.5, 5, 1, '#7b64b1', '#3a2c5c', '#141027', EDGE_SHADOW, 1.6, 1);
  limb(ctx, fElbowX, fElbowY, fhx, fhy, 5, 4, 0.6, '#886fbf', '#42336a', '#17112f', EDGE_SHADOW, 1.5, 1);
  dot(ctx, fhx, fhy, 3.6, 3.4, '#866aa8', '#2c1e44', 1);

  const backAngle = 2.62 + atk * (1.57 - 2.62) + cast * (-0.45 - 2.62);
  const frontAngle = -2.62 + atk * (1.57 + 2.62) + cast * (0.45 + 2.62);
  if (cast > 0.02) glowAt(ctx, (bhx + fhx) / 2, (bhy + fhy) / 2 - 10, 22, jade, cast * 0.45);
  jadeDagger(ctx, bhx, bhy, backAngle, 1, glow, jade);
  jadeDagger(ctx, fhx, fhy, frontAngle, 1, glow, jade);

  ctx.restore();
}

/* -------------------------------- SPIRITCALLER ---------------------------- */

function antler(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  side: number,
  edge: string,
  sway: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side, 1);
  ctx.rotate(sway * 0.03);
  const bone = '#f4ead3';
  const boneMid = '#cdbf9e';
  const boneDark = '#6d6248';
  // main beam
  const beam: Seg[] = [
    [-3, 6],
    [4, 3],
    [8, -8, 13, -22],
    [17, -34, 24, -41],
    [20, -43, 15, -35],
    [9, -23, 4, -7],
  ];
  part(ctx, beam, -43, 6, bone, boneMid, boneDark, edge, [[-2, 4], [2, -10], [20, -41], [12, -37]], [[4, 2], [10, -16], [23, -39], [16, -38]], 1.4);
  // three tines
  const tine = (bx: number, by: number, tx: number, ty: number, w: number): void => {
    const segs: Seg[] = [
      [bx - w, by],
      [bx + w, by],
      [tx + w * 0.4, ty + 5, tx, ty],
      [tx - w * 0.5, ty + 5],
    ];
    part(ctx, segs, ty, by, bone, boneMid, boneDark, edge, [[bx - w, by], [tx, ty], [tx - w * 0.5, ty + 5]], [[bx, by - w], [tx, ty + 4], [tx - w * 0.3, ty + 2]], 1.2);
  };
  tine(12, -20, 29, -23, 2.6);
  tine(16, -33, 34, -36, 2.4);
  tine(21, -40, 37, -50, 2.2);
  tine(7, -10, 18, -9, 2.2);
  ctx.restore();
}

function drawSpiritcaller(ctx: CanvasRenderingContext2D, u: Unit, time: number): void {
  const c = u.colors;
  const green = c.main;
  const glow = c.glow;
  const moss = c.cloth ?? '#2d5a3f';
  const pale = c.accent ?? '#e7ffd4';

  const breath = Math.sin(time * 2.5 + u.uid * 1.3) * 2.0;
  const sway = Math.sin(time * 1.5 + u.uid * 0.6) * 4.5;
  const sway2 = Math.sin(time * 1.85 + u.uid * 1.1 + 1.4) * 3;
  const atk = u.anim.attack;
  const cast = u.anim.cast;
  const lean = atk * 0.30;
  const hipY = -92;
  const orbit = time * (0.65 + cast * 1.45) + u.uid * 0.4;

  softBacklight(ctx, 0, -128, 82, green, 0.17);

  // Spirit motes orbit the shoulders; cast speeds them up.
  for (let i = 0; i < 3; i++) {
    const a = orbit + (i / 3) * Math.PI * 2;
    const mx = Math.cos(a) * (43 - i * 4);
    const my = -142 + Math.sin(a) * 26 - 4 * i;
    const pulse = 0.85 + 0.15 * Math.sin(time * 2.2 + i * 2.1 + u.uid);
    glowAt(ctx, mx, my, 13 * pulse, green, 0.3 + cast * 0.18);
    dot(ctx, mx, my, 4.2 * pulse, 4.8 * pulse, pale, '#19533a', 1);
    dot(ctx, mx - 0.8, my - 1.2, 1.7 * pulse, 1.9 * pulse, '#ffffff', '#19533a', 0.7);
  }

  // Boots.
  part(ctx, [[-16, -9], [-4, -9], [-1, -2], [-8, 2], [-19, 1], [-21, -5]], -9, 2, '#4f7e5d', '#26452f', '#0c1d13', EDGE_SPIRIT, [[-16, -9], [-1, -2], [-19, 1]], [[-11, -8], [-5, -4], [-8, 0]], 1.5);
  part(ctx, [[2, -9], [12, -9], [18, -3], [17, 1], [0, 2], [-2, -5]], -9, 2, '#5d906c', '#2c5038', '#0e2217', EDGE_SPIRIT, [[0, -8], [17, -2], [17, 1], [0, 2]], [[3, -8], [9, -5], [11, 0]], 1.5);

  // Robe skirt with a mossy, leaf-trimmed hem.
  const skirt: Seg[] = [
    [-19, -102],
    [-28, -78, -31 + sway, -34],
    [-33 + sway, -12, -29 + sway, 2],
    [-23 + sway, 7],
    [-17 + sway, -2],
    [-11 + sway * 0.6, 5],
    [-4 + sway * 0.3, -3],
    [3, 4],
    [11 - sway * 0.4, -3],
    [18 - sway * 0.6, 6],
    [26 - sway * 0.7, 1],
    [30 - sway * 0.7, -12],
    [27, -52, 19, -102],
  ];
  part(
    ctx,
    skirt,
    -102,
    7,
    '#4f9b6c',
    moss,
    '#0e2618',
    EDGE_SPIRIT,
    [[-19, -102], [-31 + sway, -34], [-29 + sway, 2], [-5, 2], [-3, -60]],
    [[0, -100], [19, -102], [24, -64], [4, -72]],
    2.0,
  );
  folds(
    ctx,
    [
      [-16, -92, -25, -46, -26 + sway, 1],
      [-6, -94, -11, -46, -12 + sway, 3],
      [12, -94, 19, -50, 21 - sway, 2],
    ],
    'rgba(7,32,19,0.55)',
    1.05,
  );

  // Leaves and roots at the hem.
  const leaf = (x: number, y: number, len: number, ang: number, top: string, mid: string): void => {
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;
    const px = -Math.sin(ang) * len * 0.28;
    const py = Math.cos(ang) * len * 0.28;
    part(
      ctx,
      [
        [x, y],
        [x + dx * 0.5 + px, y + dy * 0.5 + py, x + dx, y + dy],
        [x + dx * 0.5 - px, y + dy * 0.5 - py, x, y],
      ],
      y + Math.min(0, dy),
      y + Math.max(0, dy),
      top,
      mid,
      '#123725',
      EDGE_SPIRIT,
      [[x, y], [x + dx, y + dy], [x + dx * 0.5, y + dy * 0.5 - py]],
      [[x, y], [x + dx * 0.6, y + dy * 0.6 + py * 0.4]],
      1.1,
    );
  };
  leaf(-28 + sway, 1, 11, -0.5, '#8fe0a6', '#3d8959');
  leaf(-18 + sway, 4, 9, -1.2, '#7ed39a', '#357a4e');
  leaf(-6, 3, 10, 0.4, '#8fe0a6', '#3d8959');
  leaf(6 - sway * 0.3, 4, 9, 0.9, '#7ed39a', '#357a4e');
  leaf(18 - sway * 0.5, 5, 11, 0.5, '#8fe0a6', '#3d8959');
  leaf(28 - sway * 0.6, 1, 10, 1.1, '#7ed39a', '#357a4e');
  // root tendrils
  limb(ctx, -26 + sway, -2, -34, 2, 2.2, 1.2, 1, '#7fae74', '#3f6a40', '#152c1b', EDGE_SPIRIT, 1);
  limb(ctx, 25 - sway, -1, 34, 2, 2.2, 1.2, -1, '#7fae74', '#3f6a40', '#152c1b', EDGE_SPIRIT, 1);

  ctx.save();
  ctx.translate(0, -breath);
  ctx.translate(0, hipY);
  ctx.rotate(lean);
  ctx.translate(0, -hipY);
  ctx.translate(atk * 3, 0);

  // Robe body / vestments.
  part(
    ctx,
    [[-17, -150], [-13, -128], [-12, -108], [-10, -94], [0, -88], [10, -94], [12, -108], [13, -128], [17, -150], [0, -158]],
    -158,
    -88,
    '#64b881',
    '#2e6b47',
    '#0f2a1b',
    EDGE_SPIRIT,
    [[-17, -150], [-12, -108], [0, -88], [0, -152]],
    [[0, -158], [17, -150], [13, -108], [0, -112]],
    2.0,
  );
  folds(ctx, [[-10, -142, -14, -118, -9, -100], [8, -142, 12, -120, 8, -102]], 'rgba(9,34,21,0.55)', 1);

  // Leaf mantle across the shoulders.
  part(
    ctx,
    [[-24, -150], [-16, -162, 0, -164], [16, -162, 24, -148], [18, -138], [8, -148], [0, -138], [-9, -148], [-18, -138]],
    -164,
    -138,
    '#7fd39a',
    '#3d8a58',
    '#12351f',
    EDGE_SPIRIT,
    [[-24, -150], [-18, -138], [0, -138], [0, -156]],
    [[0, -164], [24, -148], [18, -138], [4, -145]],
    1.8,
  );
  leaf(-19, -146, 10, -2.1, '#9be8b0', '#3d8959');
  leaf(-9, -153, 9, -1.5, '#a5efb8', '#438f60');
  leaf(10, -154, 10, -1.3, '#9be8b0', '#3d8959');
  leaf(19, -146, 9, -0.9, '#a5efb8', '#438f60');
  dot(ctx, 0, -150, 3.4, 4.2, green, '#164b32', 1);

  // Head: pale visage under the antlered hood.
  ctx.save();
  ctx.rotate(cast * 0.14 - lean * 0.2 + Math.sin(time * 1.8 + u.uid) * 0.015);
  antler(ctx, -10, -170, -1, EDGE_SPIRIT, sway);
  antler(ctx, 9, -170, 1, EDGE_SPIRIT, sway2);
  part(
    ctx,
    [
      [-14, -150],
      [-17, -167, -8, -181],
      [2, -187, 9, -180],
      [17, -166, 15, -148],
      [6, -141],
      [-5, -142],
    ],
    -187,
    -141,
    '#78c895',
    '#347550',
    '#102d1c',
    EDGE_SPIRIT,
    [[-14, -150], [-17, -168], [-2, -185], [-2, -148]],
    [[-2, -185], [8, -180], [16, -162], [3, -150]],
    1.9,
  );
  folds(ctx, [[-11, -170, -15, -157, -10, -147], [9, -174, 13, -160, 9, -148]], 'rgba(8,32,19,0.55)', 1);
  // pale face
  part(
    ctx,
    [[-3, -174], [9, -175], [10, -156], [4, -147], [-4, -150], [-7, -162]],
    -175,
    -147,
    '#e7e2cd',
    '#b9b79f',
    '#6a6d57',
    '#1c3527',
    [[-3, -174], [-4, -150], [-7, -162]],
    [[1, -173], [10, -166], [7, -152]],
    1.3,
  );
  glowAt(ctx, 3, -163, 11, green, 0.32 + cast * 0.15);
  dot(ctx, 0.8, -164, 2.2, 1.4, '#b6ffd6', '#16452f', 0.8);
  dot(ctx, 7, -163, 2.4, 1.5, '#b6ffd6', '#16452f', 0.8);
  streak(ctx, 0, -164, 3, -165, '#ffffff', 0.55, 0.7);
  ctx.restore();

  // Staff arm (front) and free back arm.
  limb(ctx, 16, -146, 28, -132, 6, 5, 1, '#5bab78', '#2c6746', '#102b1c', EDGE_SPIRIT, 1.5, 1);
  limb(ctx, 28, -132, 35 + atk * 12, -116, 5, 4, 0.5, '#66b784', '#316f4d', '#112d1e', EDGE_SPIRIT, 1.5, 1);
  dot(ctx, 35 + atk * 12, -116, 3.6, 3.5, '#bfae8a', '#3b2c1e', 1);
  limb(ctx, -16, -146, -28, -126, 5.5, 4.5, -1, '#57a373', '#295f41', '#0f2a1b', EDGE_SPIRIT, 1.5, -1);
  limb(ctx, -28, -126, -31, -108, 4.5, 3.5, -0.5, '#62b17e', '#2e6848', '#102c1d', EDGE_SPIRIT, 1.4, -1);
  dot(ctx, -31, -107, 3.2, 3.2, '#bfae8a', '#3b2c1e', 1);

  // Greatstaff with a swinging green lantern.
  const gripX = 35 + atk * 12;
  const gripY = -116 - cast * 14;
  ctx.save();
  ctx.translate(gripX, gripY);
  ctx.rotate(atk * 1.05 - cast * 0.12);
  const shaft: Seg[] = [
    [-3.2, 118],
    [-3, 20, -3.6, -40],
    [-4, -66, -2, -80],
    [1, -88, 7, -89],
    [13, -90, 15, -84],
    [16, -79, 12, -77],
    [7, -76, 4, -79],
    [1, -82, 1, -74],
    [2, -30, 3.5, 118],
  ];
  part(
    ctx,
    shaft,
    118,
    -90,
    '#c9a06a',
    '#825c34',
    '#3b2614',
    EDGE_SPIRIT,
    [[-3.2, 118], [-4, -66], [1, -88], [7, -89], [4, 118]],
    [[1, -80], [7, -89], [13, -90], [12, -84], [2, -70]],
    1.7,
  );
  // knots and grain
  dot(ctx, 0, -52, 3, 2.2, '#5d4125', '#2b1b0e', 0.9);
  dot(ctx, 1, -18, 2.8, 2, '#5d4125', '#2b1b0e', 0.9);
  folds(ctx, [[-1, 90, -3, 20, 0, -40], [1.5, 70, 2, 0, 1, -50]], 'rgba(45,28,14,0.5)', 1);
  // lantern hanging from the crook
  ctx.save();
  ctx.translate(13, -80);
  ctx.rotate(Math.sin(time * 2.2 + u.uid) * 0.22 + atk * 0.6);
  ctx.strokeStyle = '#d8bc82';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 9);
  ctx.stroke();
  const flare = atk > 0.05 ? atk : 0;
  glowAt(ctx, 0, 23, 28 + cast * 16 + flare * 16, green, 0.4 + cast * 0.22 + flare * 0.25);
  part(
    ctx,
    [[-9, 9], [9, 9], [11, 17], [8, 32], [0, 38], [-8, 32], [-11, 17]],
    -5,
    38,
    '#e9fff1',
    green,
    '#145a3b',
    EDGE_SPIRIT,
    [[-9, 9], [-11, 17], [-8, 32], [0, 38], [0, 12]],
    [[0, 9], [9, 9], [11, 17], [4, 22], [0, 12]],
    1.5,
  );
  // lantern cage
  ctx.save();
  ctx.strokeStyle = '#2c1d10';
  ctx.lineWidth = 1.1;
  ctx.globalAlpha *= 0.55;
  ctx.beginPath();
  ctx.moveTo(0, 9);
  ctx.lineTo(0, 38);
  ctx.moveTo(-9, 17);
  ctx.lineTo(9, 17);
  ctx.moveTo(-8, 26);
  ctx.lineTo(8, 26);
  ctx.stroke();
  ctx.restore();
  part(ctx, [[-10, 6], [0, 2], [10, 6], [8, 10], [0, 8], [-8, 10]], 2, 10, '#fff1c0', '#d4ae6a', '#6a471e', EDGE_SPIRIT, undefined, undefined, 1.1);
  ctx.restore();
  ctx.restore();

  ctx.restore();
}

/* ------------------------------- dispatcher ------------------------------- */

export function drawHeroGothic(ctx: CanvasRenderingContext2D, classId: string, u: Unit, time: number): void {
  if (classId === 'warden') drawWarden(ctx, u, time);
  else if (classId === 'pyromancer') drawPyromancer(ctx, u, time);
  else if (classId === 'shadowblade') drawShadowblade(ctx, u, time);
  else drawSpiritcaller(ctx, u, time);
}
