import type { Unit } from './combat';
import type { BodyKind } from './data';

const INK = '#05030a';
const INK_SHADOW = 'rgba(5, 3, 11, 0.58)';

export type Seg = [number, number] | [number, number, number, number];

export function slugifyUnit(name: string): string {
  return name.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* ---------- Curved Gothic Bezier + Stained-Glass Leadwork Helpers --------- */

function vGrad(
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

function traceSegs(ctx: CanvasRenderingContext2D, segs: Seg[], close = true): void {
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
function gothicShape(
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

function leadLines(
  ctx: CanvasRenderingContext2D,
  lines: Array<[number, number, number, number]>,
  width = 1.7,
  col = INK,
  alpha = 0.82,
): void {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.globalAlpha *= alpha;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of lines) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();
  ctx.restore();
}

function softBacklight(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 0.24): void {
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

function glowGem(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, rx = 3.2, ry = 1.9, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  softBacklight(ctx, 0, 0, Math.max(rx, ry) * 3.2, color, 0.6);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(rx * 0.12, -ry * 0.1, rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2);
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

/* -------- Shared Anatomical Limb Helper (Thigh + Knee + Curved Greave) ----- */
function drawArmoredLeg(
  ctx: CanvasRenderingContext2D,
  hipX: number,
  hipY: number,
  kneeX: number,
  kneeY: number,
  footX: number,
  footY: number,
  topCol: string,
  midCol: string,
  botCol: string,
  rimCol: string,
  kneeGemCol?: string,
): void {
  // Thigh
  gothicShape(
    ctx,
    [
      [hipX - 8, hipY],
      [hipX + 8, hipY],
      [hipX + 7, (hipY + kneeY) * 0.5, kneeX + 6, kneeY],
      [kneeX - 6, kneeY],
      [hipX - 9, (hipY + kneeY) * 0.5, hipX - 8, hipY],
    ],
    vGrad(ctx, hipY, kneeY, midCol, botCol, '#0c0817'),
    5.2,
    rimCol,
    0.55,
  );
  // Flared Greave + Pointed Sabaton
  gothicShape(
    ctx,
    [
      [kneeX - 6, kneeY - 2],
      [kneeX + 6, kneeY - 2],
      [kneeX + 10, (kneeY + footY) * 0.45, footX + 6, footY - 5],
      [footX + 14, footY + 2],
      [footX - 8, footY + 2],
      [kneeX - 9, (kneeY + footY) * 0.55, kneeX - 6, kneeY - 2],
    ],
    vGrad(ctx, kneeY, footY + 2, topCol, midCol, botCol),
    5.4,
    rimCol,
    0.75,
    [
      [kneeX - 6, kneeY - 2],
      [kneeX - 1, kneeY - 2],
      [footX - 1, footY + 2],
      [footX - 8, footY + 2],
    ],
  );
  // Diamond Gothic Poleyn (Knee Guard)
  gothicShape(
    ctx,
    [[kneeX, kneeY - 9], [kneeX + 7, kneeY - 1], [kneeX, kneeY + 7], [kneeX - 7, kneeY - 1]],
    kneeGemCol ?? rimCol,
    3.8,
    '#fff8dc',
    0.85,
  );
}

/* ------------------ 4 HEROIC 7-HEAD STAINED-GLASS RIGS -------------------- */

export function drawHeroGothic(ctx: CanvasRenderingContext2D, classId: string, u: Unit, time: number): void {
  const breath = Math.sin(time * 2.5 + u.uid) * 1.8;
  const sway = Math.sin(time * 1.9 + u.uid * 0.7) * 4.5;
  const atk = u.anim.attack;
  const cast = u.anim.cast;

  softBacklight(ctx, 0, -88, 78, u.colors.main, 0.22 + cast * 0.25);
  drawGothicHalo(ctx, -2, -118, 42, u.colors.main, u.colors.glow, time * (0.9 + cast * 1.8), 0.32 + cast * 0.45);

  if (classId === 'warden') {
    // 1. Billowing S-curved Dawnwatch Cloak with Stained-Glass Leadwork
    gothicShape(
      ctx,
      [
        [-10, -132 + breath],
        [-32, -106, -46 + sway * 0.6, -56],
        [-54 + sway, -18, -48 + sway, 2],
        [-34 + sway * 0.7, -10],
        [-22 + sway * 0.4, 2],
        [-10, -14],
        [8, -72, 10, -128 + breath],
      ],
      vGrad(ctx, -132, 2, '#4a76cc', '#243c70', '#0e1730'),
      5.6,
      '#9ec0ff',
      0.6,
      [[-10, -132 + breath], [-34, -92, -38 + sway * 0.6, -8], [-16, -8], [4, -128 + breath]],
    );
    leadLines(ctx, [[-22, -114 + breath, -38 + sway * 0.7, -14], [-14, -96, -24 + sway * 0.4, -4]], 1.5, '#7ca2eb', 0.45);

    // 2. Long Heroic Splayed Legs (7-head proportions: hip at -78, knee at -40, foot at 0!)
    drawArmoredLeg(ctx, -12, -78, -17, -40, -24, 0, '#6c95e3', '#31497d', '#152140', '#adc9ff', '#e8be62');
    drawArmoredLeg(ctx, 10, -78, 16, -40, 22, 0, '#86aef7', '#3c5a99', '#19284d', '#ffe59e', '#f5cb6e');

    ctx.save();
    ctx.translate(0, -78 + breath);
    ctx.rotate(atk * 0.16 - cast * 0.08);

    // 3. Fluted Gothic Faulds/Tassets + Narrow Armored Waist + Broad Sunburst Cuirass
    gothicShape(
      ctx,
      [[-16, -4], [16, -4], [24, 16], [11, 22], [2, 8], [-8, 22], [-22, 15]],
      vGrad(ctx, -4, 22, '#5a83d4', '#283f73', '#131e3b'),
      5.0,
      '#f2c768',
    );
    gothicShape(
      ctx,
      [[-12, 0], [-14, -18, -24, -48], [0, -56], [24, -48], [14, -18, 12, 0]],
      vGrad(ctx, -56, 0, '#7ca5f2', '#385896', '#19284a'),
      5.8,
      '#ffe59e',
      0.85,
      [[-12, 0], [-24, -48], [-2, -55], [-2, 0]],
    );
    // Gold Sunburst Emblem on Chest
    gothicShape(
      ctx,
      [[2, -45], [5, -35], [14, -37], [7, -29], [14, -21], [5, -23], [2, -13], [-1, -23], [-9, -21], [-3, -29], [-9, -37], [-1, -35]],
      '#f7cd6d',
      3.2,
      '#fff8dc',
    );

    // 4. Sword Arm + Long Radiant Dawnwatch Greatsword
    ctx.save();
    ctx.translate(-18, -46);
    ctx.rotate(-0.32 + atk * 1.5 - cast * 0.4);
    gothicShape(
      ctx,
      [[-4, -14], [4, -14], [5.5, -88], [0, -112], [-5.5, -88]],
      vGrad(ctx, -112, -14, '#ffffff', '#dce8ff', '#7896cf'),
      5.2,
      '#fff5cc',
      0.95,
    );
    leadLines(ctx, [[0, -20, 0, -98]], 2.2, '#ffd478', 0.95);
    gothicShape(ctx, [[-15, -13], [0, -19], [15, -13], [11, -8], [0, -11], [-11, -8]], '#f5ca69', 4.0, '#fff7d6');
    gothicShape(ctx, [[-3, -8], [3, -8], [3, 7], [-3, 7]], '#5c3726', 3.6);
    glowGem(ctx, 0, -13, '#fff2b2', 3.0, 3.0, 0);
    ctx.restore();

    // 5. Layered Cathedral-Arch Pauldrons
    gothicShape(ctx, [[-34, -42], [-28, -58, -12, -54], [-12, -34], [-26, -32, -34, -42]], vGrad(ctx, -58, -32, '#628be0', '#2b4378', '#152140'), 5.2, '#f2c768');
    gothicShape(ctx, [[12, -54], [28, -60, 36, -42], [28, -31, 13, -34]], vGrad(ctx, -60, -31, '#8cb4ff', '#3d5fa1', '#1c2d54'), 5.2, '#ffeaa8');

    // 6. Gorget + Compact Heroic T-Visored Barbute Greathelm (22px tall -> true 7-head scale!)
    gothicShape(ctx, [[-10, -53], [10, -53], [12, -60], [-12, -60]], '#f2c668', 3.8, '#fff7d6');
    gothicShape(
      ctx,
      [[-11, -59], [-13, -72, -10, -81], [0, -86], [10, -81], [13, -72, 11, -59], [2, -55], [-3, -55]],
      vGrad(ctx, -86, -55, '#8ab3ff', '#3b5c9e', '#182747'),
      5.4,
      '#e0ebff',
      0.85,
      [[-11, -59], [-12, -78], [-2, -85], [-2, -56]],
    );
    gothicShape(ctx, [[-2, -85], [0, -97], [5, -90], [3, -77], [-2, -77]], '#f7cd6d', 3.8, '#fff8dc');
    gothicShape(ctx, [[-9, -73], [10, -73], [8, -68], [2.5, -68], [2, -59], [-1, -59], [-1.5, -68], [-8, -68]], '#080510', 2.4);
    glowGem(ctx, 1.2, -70.5, '#ffdf80', 7.8, 1.7, 0);
    glowGem(ctx, 0.5, -65, '#ffb238', 1.6, 5.2, 0);

    // 7. Ornate Leaded Sunburst Kite Shield
    ctx.save();
    ctx.translate(22 - atk * 4 + cast * 4, -22);
    ctx.rotate(0.05 - atk * 0.12);
    gothicShape(
      ctx,
      [[-16, -34], [2, -41], [20, -32], [20, 0, 2, 36], [-15, 2, -16, -34]],
      vGrad(ctx, -41, 36, '#628ce0', '#2b4478', '#121d38'),
      6.0,
      '#ffe69e',
      0.92,
      [[-16, -34], [1, -40], [1, 35], [-15, 2, -16, -34]],
    );
    leadLines(ctx, [[2, -39, 2, 33], [-14, -12, 18, -12]], 1.8, '#f5ca69', 0.75);
    gothicShape(ctx, [[2, -23], [5, -13], [13, -15], [7, -6], [13, 3], [5, 0], [2, 11], [-1, 0], [-9, 3], [-3, -6], [-9, -15], [-1, -13]], '#f7cd6d', 3.2, '#fff9de');
    ctx.restore();

    ctx.restore();
    return;
  }

  if (classId === 'pyromancer') {
    // 1. Flowing Ruby Stained-Glass Battle-Mantle with Leaded Flame Facets
    gothicShape(
      ctx,
      [
        [-12, -130 + breath],
        [-34, -98, -46 + sway * 0.7, -48],
        [-50 + sway, -14, -42 + sway, 2],
        [-26 + sway * 0.5, -14],
        [-14, 3],
        [0, -12],
        [14, 3],
        [28 - sway * 0.3, -10],
        [36 - sway * 0.4, 2],
        [32, -44, 14, -130 + breath],
      ],
      vGrad(ctx, -130, 3, '#e0385c', '#851833', '#2e0815'),
      5.6,
      '#ffaa66',
      0.72,
      [[-12, -130 + breath], [-40, -76, -38 + sway * 0.6, -4], [-8, -6], [-2, -128 + breath]],
    );
    leadLines(ctx, [[-18, -108, -32 + sway * 0.5, -12], [16, -108, 28, -14]], 1.6, '#ff9c59', 0.5);

    // 2. Long Boots & Gold-Trimmed Split Skirt (7-head proportions)
    drawArmoredLeg(ctx, -9, -76, -13, -38, -18, 0, '#782642', '#3d1324', '#1a0710', '#f5be6b');
    drawArmoredLeg(ctx, 9, -76, 14, -38, 19, 0, '#942e50', '#4a172c', '#1f0914', '#ffd88a');
    gothicShape(
      ctx,
      [[-15, -78], [15, -78], [24, -42, 26, -12], [12, -26], [3, -58], [-5, -24], [-22, -14]],
      vGrad(ctx, -78, -12, '#5c1f3c', '#2b0e20', '#140610'),
      5.0,
      '#f5c26b',
      0.75,
    );

    ctx.save();
    ctx.translate(0, -78 + breath);
    ctx.rotate(atk * 0.16 + cast * 0.06);

    // 3. Sleek Corseted Obsidian-and-Gold Scholar Bodice + Ruby Cincture
    gothicShape(
      ctx,
      [[-10, 2], [-11, -18, -19, -46], [0, -52], [19, -46], [11, -18, 10, 2]],
      vGrad(ctx, -52, 2, '#692648', '#301124', '#140711'),
      5.4,
      '#ffd07a',
      0.8,
      [[-10, 2], [-19, -46], [-2, -51], [-2, 2]],
    );
    gothicShape(ctx, [[-13, -3], [0, -9], [13, -3], [11, 4], [0, 8], [-11, 4]], '#f2ba5c', 3.8, '#fff5cc');
    glowGem(ctx, 0, 0, '#ff4d3d', 3.4, 3.4, 0);
    // Layered Crimson Shoulder Mantle
    gothicShape(
      ctx,
      [[-28, -38], [-22, -54, 0, -55], [22, -54, 28, -38], [16, -28], [2, -38], [-14, -28]],
      vGrad(ctx, -55, -28, '#eb3d63', '#8c1a36', '#3d0b1a'),
      5.2,
      '#ffc478',
    );

    // 4. Compact Pointed Battle-Scholar Cowl + Shadowed Face + Blazing Eye (-52 to -82 = 30px with peak!)
    gothicShape(
      ctx,
      [[-13, -51], [-16, -68, -5, -83], [6, -87], [15, -72, 14, -52], [3, -47], [-7, -47]],
      vGrad(ctx, -87, -47, '#eb3b60', '#821833', '#300916'),
      5.4,
      '#ffd084',
    );
    gothicShape(ctx, [[-6, -72], [9, -72], [9, -56], [2, -51], [-6, -56]], '#d9ab8c', 3.6);
    gothicShape(ctx, [[-7, -73], [9, -73], [2, -61], [-7, -58]], '#0b0610', 2.2);
    glowGem(ctx, 4.8, -66, '#ffa238', 3.0, 1.7, -0.08);

    // 5. Outstretched Charred Arm + Layered Crackling Flame Phoenix!
    ctx.save();
    ctx.translate(26 + atk * 10, -34 - cast * 10);
    const fl = Math.sin(time * 8.5) * 3.5;
    softBacklight(ctx, 4, -24, 42, '#ff7b29', 0.6);
    gothicShape(
      ctx,
      [
        [0, 6],
        [-14, -4, -22, -28 + fl],
        [-7, -16],
        [-13, -36, -6, -54 - fl],
        [2, -30],
        [7, -48, 13, -64 + fl],
        [13, -32],
        [24, -44, 29, -36 - fl],
        [16, -18, 20, -6],
        [8, 4],
      ],
      vGrad(ctx, -64, 6, '#ffcf5c', '#f25c29', '#9e1722'),
      4.8,
      '#ffd27d',
      0.7,
    );
    // White-hot inner flame core
    gothicShape(
      ctx,
      [[2, 2], [-7, -14], [1, -34 - fl * 0.6], [6, -18], [11, -40 + fl * 0.6], [12, -14], [7, 2]],
      vGrad(ctx, -40, 2, '#ffffff', '#fff3ad', '#ff8c2b'),
      2.6,
    );
    gothicShape(ctx, [[-12, 8], [-4, -1], [5, 1], [3, 9]], '#261522', 3.8, '#ffa047');
    ctx.restore();

    glowGem(ctx, -24, -24 + Math.sin(time * 6) * 3, '#ff8c38', 5.5, 5.5, 0);
    ctx.restore();
    return;
  }

  if (classId === 'shadowblade') {
    // 1. Sweeping Nocturnal Amethyst Cloak Ribbons
    gothicShape(
      ctx,
      [
        [-8, -124 + breath],
        [-36, -96, -54 + sway * 0.8, -46],
        [-60 + sway, -14, -50 + sway, 2],
        [-32 + sway * 0.6, -16],
        [-20 + sway * 0.3, 0],
        [-8, -26],
        [8, -80, 8, -120 + breath],
      ],
      vGrad(ctx, -124, 2, '#6c50b3', '#33245c', '#120b24'),
      5.4,
      '#c5a3ff',
      0.65,
      [[-8, -124 + breath], [-42, -80, -44 + sway * 0.7, -8], [-18, -14], [2, -120 + breath]],
    );

    // 2. Agile Crouched Assassin Stance (7-head proportions)
    drawArmoredLeg(ctx, -12, -74, -19, -38, -28, 0, '#624b9e', '#2d214f', '#130d24', '#b494ff');
    drawArmoredLeg(ctx, 8, -74, 18, -37, 26, 0, '#7459ba', '#35275e', '#150f29', '#7df2c0', '#7df2c0');

    ctx.save();
    ctx.translate(4, -74 + breath);
    ctx.rotate(0.14 + atk * 0.22);

    // 3. Fitted Night-Leather Cuirass + Cross-Harnesses + Silver Skull Buckle
    gothicShape(
      ctx,
      [[-10, 2], [-12, -18, -20, -46], [0, -52], [19, -46], [12, -18, 10, 2]],
      vGrad(ctx, -52, 2, '#7559bd', '#362761', '#160f2b'),
      5.4,
      '#d2b8ff',
      0.8,
      [[-10, 2], [-20, -46], [-2, -51], [-2, 2]],
    );
    leadLines(ctx, [[-16, -42, 13, -10], [-14, -12, 15, -40]], 2.2, '#dfd1ff', 0.55);
    gothicShape(ctx, [[-5, -2], [0, -7], [5, -2], [4, 4], [-4, 4]], '#dde4fa', 3.4, '#ffffff');

    // 4. Reverse-Grip Offhand Jade Dagger
    ctx.save();
    ctx.translate(-22, -30);
    ctx.rotate(0.55 - atk * 1.35);
    drawCurvedJadeDagger(ctx, -1);
    ctx.restore();

    // 5. Sharp Assassin Pauldrons + Pointed Hood + Masked Amethyst Gaze
    gothicShape(ctx, [[-30, -38], [-22, -54, -10, -49], [-12, -33]], '#5a4394', 4.8, '#bfa1ff');
    gothicShape(ctx, [[10, -49], [22, -55, 31, -38], [13, -33]], '#765abd', 4.8, '#7df2c0');
    gothicShape(
      ctx,
      [[-12, -50], [-15, -67, -4, -82], [8, -80], [15, -66, 12, -49]],
      vGrad(ctx, -82, -49, '#7c5fc7', '#392966', '#160f2b'),
      5.4,
      '#d8bdff',
    );
    gothicShape(ctx, [[-6, -70], [10, -70], [9, -54], [-5, -54]], '#0b0817', 2.8);
    gothicShape(ctx, [[-7, -62], [11, -62], [9, -50], [1, -46], [-6, -50]], '#48367d', 3.6, '#b89cff');
    glowGem(ctx, -0.5, -65.5, '#dfadff', 2.6, 1.5, 0.08);
    glowGem(ctx, 6.8, -65.5, '#dfadff', 2.6, 1.5, -0.08);

    // 6. Lead Curved Jade-Venom Kris Dagger
    ctx.save();
    ctx.translate(22 + atk * 10, -30);
    ctx.rotate(-0.52 + atk * 1.55);
    drawCurvedJadeDagger(ctx, 1);
    ctx.restore();

    ctx.restore();
    return;
  }

  // SPIRITCALLER — Tall Emerald Druid Oracle, Stag-Skull Antler Crown & Spirit Lantern!
  gothicShape(
    ctx,
    [
      [-12, -130 + breath],
      [-34, -98, -44 + sway * 0.7, -46],
      [-46 + sway, -12, -38 + sway, 2],
      [-22 + sway * 0.4, -12],
      [-10, 3],
      [2, -10],
      [15, 3],
      [28, -8],
      [34, 2],
      [30, -48, 14, -130 + breath],
    ],
    vGrad(ctx, -130, 3, '#4fb077', '#255e3d', '#0d2618'),
    5.6,
    '#a6ffd0',
    0.7,
    [[-12, -130 + breath], [-38, -76, -34 + sway * 0.5, -4], [-8, -6], [-2, -128 + breath]],
  );

  drawArmoredLeg(ctx, -9, -76, -12, -38, -16, 0, '#599e73', '#29543a', '#102418', '#9effc8');
  drawArmoredLeg(ctx, 9, -76, 13, -38, 18, 0, '#6eba8b', '#316646', '#132b1d', '#c7ffe0');

  ctx.save();
  ctx.translate(0, -78 + breath);
  ctx.rotate(atk * 0.12 + cast * 0.08);

  // Tapered Bark-and-Emerald Vestments + Leaf Shoulder Mantle
  gothicShape(
    ctx,
    [[-11, 4], [-13, -18, -19, -46], [0, -52], [19, -46], [13, -18, 12, 4]],
    vGrad(ctx, -52, 4, '#449666', '#204f34', '#0e2619'),
    5.4,
    '#9effc8',
    0.8,
  );
  gothicShape(
    ctx,
    [[-28, -36], [-20, -54, 0, -55], [20, -54, 28, -36], [18, -24], [8, -34], [0, -22], [-9, -34], [-19, -24]],
    vGrad(ctx, -55, -22, '#62c78b', '#2d6b47', '#133321'),
    5.2,
    '#c7ffe0',
  );
  glowGem(ctx, 0, -35, '#85ffc0', 3.4, 4.4, 0);

  // Sweeping Bleached-Bone Stag Antlers!
  drawCurvedAntler(ctx, -8, -76, -1, '#f7f2e4');
  drawCurvedAntler(ctx, 8, -76, 1, '#ffffff');

  // Compact Oracle Hood + Pale Visage + Glowing Emerald Eyes
  gothicShape(
    ctx,
    [[-13, -50], [-15, -67, -5, -81], [6, -81], [15, -67, 13, -50]],
    vGrad(ctx, -81, -50, '#5bbd82', '#296340', '#102b1c'),
    5.4,
    '#c4ffdc',
  );
  gothicShape(ctx, [[-6, -71], [8, -71], [8, -56], [1, -51], [-6, -56]], '#dbd7c8', 3.6);
  glowGem(ctx, -1.5, -64, '#8dffc2', 2.5, 1.5, 0);
  glowGem(ctx, 5.2, -64, '#8dffc2', 2.5, 1.5, 0);

  // Tall Gnarled Greatstaff + Swinging Wrought-Iron Emerald Lantern
  ctx.save();
  ctx.translate(26 + atk * 6, -18 - cast * 8);
  ctx.rotate(-0.05 + atk * 0.35);
  gothicShape(
    ctx,
    [[-3, 94], [-2.5, -66], [-2, -84, 12, -86], [24, -85, 24, -71], [17, -69], [17, -77, 8, -77], [3, -75, 3, 94]],
    vGrad(ctx, -86, 94, '#ba8c5c', '#734f2e', '#362212'),
    4.8,
    '#ecc695',
  );
  ctx.save();
  ctx.translate(20, -70);
  ctx.rotate(Math.sin(time * 3.1 + u.uid) * 0.14);
  leadLines(ctx, [[0, 0, 0, 10]], 2.2, '#ebd08a', 1);
  softBacklight(ctx, 0, 23, 34, '#6effb3', 0.65);
  gothicShape(ctx, [[-9, 14], [0, 8], [9, 14], [10, 29], [0, 36], [-10, 29]], vGrad(ctx, 8, 36, '#f0fff4', '#4df5a1', '#187047'), 4.6, '#ffffff', 0.9);
  leadLines(ctx, [[0, 9, 0, 35], [-9, 15, 9, 15], [-9, 28, 9, 28]], 1.9, INK, 0.9);
  ctx.restore();
  ctx.restore();

  ctx.restore();
}

function drawCurvedJadeDagger(ctx: CanvasRenderingContext2D, dir: number): void {
  ctx.save();
  ctx.scale(dir, 1);
  gothicShape(
    ctx,
    [[-3.5, -6], [4.5, -6], [10, -24, 5, -42], [11, -54, 9, -64], [-2, -50, -5, -26]],
    vGrad(ctx, -64, -6, '#ebfff5', '#42e8a3', '#194f49'),
    4.6,
    '#ffffff',
    0.9,
  );
  gothicShape(ctx, [[-11, -6], [0, -10], [11, -6], [7, -2], [-7, -2]], '#deb868', 3.6, '#fff4c7');
  gothicShape(ctx, [[-2.8, -2], [2.8, -2], [2.8, 10], [-2.8, 10]], '#362652', 3.4);
  glowGem(ctx, 0, 12, '#68f7b2', 2.4, 2.4, 0);
  ctx.restore();
}

function drawCurvedAntler(ctx: CanvasRenderingContext2D, x: number, y: number, side: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side, 1);
  gothicShape(
    ctx,
    [
      [-2, 4],
      [4, 2],
      [14, -8, 28, -14],
      [36, -18, 40, -32],
      [30, -21, 18, -20],
      [24, -34, 30, -50],
      [19, -40, 12, -26],
      [10, -38, 6, -46],
      [1, -30, 4, -12],
    ],
    vGrad(ctx, -50, 4, '#ffffff', color, '#9e9278'),
    4.6,
    '#ffffff',
    0.9,
  );
  ctx.restore();
}

/* --------------------- BESPOKE BOSS & ENEMY DISPATCHER -------------------- */

export function drawCreatureGothic(
  ctx: CanvasRenderingContext2D,
  body: BodyKind,
  c: { main: string; dark: string; glow: string },
  u: Unit,
  time: number,
  isAlly: boolean,
): void {
  const slug = slugifyUnit(u.name);
  const breath = Math.sin(time * 2.3 + u.uid * 1.1) * 2.2;
  const atk = u.anim.attack;
  const cast = u.anim.cast;

  softBacklight(ctx, 0, -86, u.boss ? 94 : 64, c.glow, u.boss ? 0.28 : 0.2);

  if (u.boss) {
    drawGothicHalo(ctx, -4, -108, 64, c.main, c.glow, time * (1 + cast), 0.58 + cast * 0.25);
  } else if (cast > 0.05) {
    drawGothicHalo(ctx, 0, -82, 44, c.main, c.glow, time * 2, cast * 0.55);
  }

  if (isAlly) {
    drawDireWolf(ctx, { main: '#6ef2b1', dark: '#1e5c40', glow: '#e7ffd4' }, time + u.uid, breath, atk, true, false);
    return;
  }

  if (slug === 'molten-warden') { drawBossMoltenWarden(ctx, time, breath, atk); return; }
  if (slug === 'pale-stag') { drawBossPaleStag(ctx, time, breath, atk); return; }
  if (slug === 'winters-herald') { drawBossWintersHerald(ctx, time, atk); return; }
  if (slug === 'leviathan-eye') { drawBossLeviathanEye(ctx, time, breath, atk); return; }
  if (slug === 'ashen-king' || body === 'king') { drawBossAshenKing(ctx, time, breath, atk); return; }
  if (slug === 'tide-revenant') { drawTideRevenant(ctx, c, time + u.uid, breath, atk); return; }

  switch (body) {
    case 'imp': drawCinderImp(ctx, c, u, time, breath, atk); break;
    case 'hound': drawDireWolf(ctx, { main: '#e87d4a', dark: '#5e231c', glow: '#ffd275' }, time + u.uid, breath, atk, false, false, true); break;
    case 'wolf': drawDireWolf(ctx, c, time + u.uid, breath, atk, false, true, false); break;
    case 'brute': drawMagmaBrute(ctx, c, breath, atk); break;
    case 'golem': drawIceGolem(ctx, c, breath, atk); break;
    case 'stalker': drawBrambleStalker(ctx, c, breath, atk); break;
    case 'wisp': drawSporeWisp(ctx, c, time); break;
    case 'treant': drawHollowTreant(ctx, c, breath, atk); break;
    case 'wraith': drawFrostWraith(ctx, c, time, atk); break;
    case 'revenant': drawDrownedAcolyte(ctx, c, time, breath, atk); break;
    case 'sentinel': drawCoralSentinel(ctx, c, time, atk); break;
    case 'crab': drawBossLeviathanEye(ctx, time, breath, atk); break;
    case 'knight': drawVoidKnight(ctx, c, breath, atk); break;
    case 'seraph': drawAshSeraph(ctx, c, time, atk); break;
    case 'wyrm': drawDuskWyrm(ctx, c, time, breath, atk); break;
    default: drawVoidKnight(ctx, c, breath, atk); break;
  }
}

/* ------------------------ 5 BESPOKE SOVEREIGN BOSSES ---------------------- */

function drawBossMoltenWarden(ctx: CanvasRenderingContext2D, time: number, breath: number, atk: number): void {
  // Heavy Splayed Dreadnought Legs with Magma Knee-Forges
  drawArmoredLeg(ctx, -16, -76, -23, -38, -32, 0, '#855356', '#45262a', '#1c0e11', '#ffa454', '#ff8429');
  drawArmoredLeg(ctx, 14, -76, 22, -38, 30, 0, '#9c6266', '#4f2c30', '#211014', '#ffd478', '#ffa838');

  ctx.save();
  ctx.translate(0, -76 + breath);
  ctx.rotate(atk * 0.18);

  // Twin Obsidian Forge-Stacks Belching Fire
  gothicShape(ctx, [[-26, -54], [-22, -88], [-12, -88], [-10, -54]], vGrad(ctx, -88, -54, '#8a5659', '#3b2024', '#1a0d10'), 5.0, '#ff9c4a');
  gothicShape(ctx, [[10, -54], [14, -92], [25, -92], [26, -54]], vGrad(ctx, -92, -54, '#996063', '#422429', '#1a0d10'), 5.0, '#ffc76b');
  glowGem(ctx, -17, -91, '#ff7b29', 6, 3.5, 0);
  glowGem(ctx, 19.5, -95, '#ffa23d', 6.5, 3.8, 0);

  // Broad V-Tapered Iron Dreadnought Chest + Barred Roaring Magma Furnace!
  gothicShape(
    ctx,
    [[-16, 4], [-20, -22, -36, -56], [0, -64], [36, -56], [20, -22, 16, 4]],
    vGrad(ctx, -64, 4, '#945d60', '#4a292e', '#1f1013'),
    6.0,
    '#ffc870',
    0.85,
    [[-16, 4], [-36, -56], [-4, -63], [-4, 4]],
  );
  gothicShape(ctx, [[-18, -48], [18, -48], [12, -8], [-12, -8]], vGrad(ctx, -48, -8, '#fffce0', '#ff8e2b', '#ba1e18'), 4.2, '#fff4b8');
  leadLines(ctx, [[-9, -48, -6, -8], [0, -48, 0, -8], [9, -48, 6, -8], [-16, -28, 16, -28]], 3.2, INK, 0.95);

  // Curved Spiked Cathedral Pauldrons
  gothicShape(ctx, [[-48, -42], [-42, -66, -16, -56], [-22, -30, -48, -42]], vGrad(ctx, -66, -30, '#996063', '#47272b', '#211114'), 5.6, '#ffb357');
  gothicShape(ctx, [[16, -56], [42, -68, 50, -42], [24, -29, 16, -56]], vGrad(ctx, -68, -29, '#ad6d70', '#542e33', '#241216'), 5.6, '#ffdf8c');

  // Compact Horned Iron Forge-Helm (-58 to -84)
  gothicShape(ctx, [[-13, -58], [-15, -76, 0, -85], [15, -76, 13, -58], [0, -53]], vGrad(ctx, -85, -53, '#9e6568', '#47282c', '#1f1014'), 5.4, '#ffd984');
  gothicShape(ctx, [[-12, -72], [-28, -82, -32, -98], [-18, -90, -9, -79]], vGrad(ctx, -98, -72, '#ffc066', '#633438', '#261317'), 4.8, '#ffe6a3');
  gothicShape(ctx, [[12, -72], [28, -82, 32, -98], [18, -90, 9, -79]], vGrad(ctx, -98, -72, '#ffd27d', '#703b40', '#261317'), 4.8, '#ffedb8');
  glowGem(ctx, 1.5, -70, '#ffe88c', 9.5, 2.4, 0);

  // Wicked Bearded Magma Executioner Great-Axe (obsidian spine + blazing molten edge!)
  ctx.save();
  ctx.translate(32, -34);
  ctx.rotate(-0.38 + atk * 1.45);
  leadLines(ctx, [[0, 62, 0, -96]], 6.8, INK, 1);
  leadLines(ctx, [[0, 62, 0, -96]], 2.8, '#ad7758', 1);
  // Top spear spike
  gothicShape(ctx, [[-4, -82], [0, -106], [4, -82]], '#ffd478', 4.2, '#ffffff');
  // Dark forged-iron axe body
  gothicShape(
    ctx,
    [[0, -82], [22, -92], [38, -74, 36, -46], [24, -24, 28, -10], [14, -20, 12, -38], [0, -44]],
    vGrad(ctx, -92, -10, '#6e3b3e', '#381b1f', '#1c0c0f'),
    5.6,
    '#ffb866',
  );
  // Glowing molten cutting edge
  gothicShape(
    ctx,
    [[20, -90], [38, -74, 36, -46], [24, -24, 28, -10], [20, -24, 25, -48], [27, -70, 20, -90]],
    vGrad(ctx, -90, -10, '#fffad4', '#ff882e', '#d92b1e'),
    3.4,
    '#ffffff',
  );
  ctx.restore();
  ctx.restore();
}

function drawBossPaleStag(ctx: CanvasRenderingContext2D, time: number, breath: number, atk: number): void {
  const sway = Math.sin(time * 2.1) * 5;
  // Tattered Swamp-Moss Shroud + S-Curved Digitigrade Wendigo Hindlegs
  gothicShape(
    ctx,
    [[-14, -124 + breath], [-38, -88, -48 + sway, -18], [-34 + sway, 2], [-18, -28], [-2, -118 + breath]],
    vGrad(ctx, -124, 2, '#478f66', '#204a34', '#0c1f15'),
    5.2,
    '#9effc8',
  );
  drawArmoredLeg(ctx, -14, -76, -26, -40, -16, 0, '#6ba882', '#2e5940', '#14291d', '#adffd2');
  drawArmoredLeg(ctx, 10, -76, 2, -40, 20, 0, '#82c49b', '#386b4d', '#173022', '#d1ffe6');

  ctx.save();
  ctx.translate(4, -76 + breath);
  ctx.rotate(0.08 + atk * 0.22);

  // Gaunt Arched Ribcage Torso + Bioluminescent Soul-Heart
  gothicShape(
    ctx,
    [[-12, 4], [-18, -22, -22, -52], [0, -60], [20, -54], [22, -24, 8, 6]],
    vGrad(ctx, -60, 6, '#569e74', '#26543b', '#10261a'),
    5.6,
    '#b3ffd6',
  );
  gothicShape(ctx, [[-8, -46], [13, -48], [10, -14], [-6, -14]], '#091a11', 3.2);
  glowGem(ctx, 3, -31, '#7affbf', 7.5, 11.5, 0);
  leadLines(ctx, [[-8, -40, 13, -41], [-8, -31, 12, -32], [-7, -22, 10, -23]], 2.6, '#f2fae9', 0.95);

  // Long Curved Wendigo Claws
  ctx.save();
  ctx.translate(18, -44);
  ctx.rotate(-0.22 + atk * 1.15);
  gothicShape(ctx, [[-4, -4], [6, -4], [18, 18, 28, 46], [18, 36], [12, 48], [4, 24, -4, -4]], vGrad(ctx, -4, 48, '#f7fced', '#75ad8a', '#294d38'), 4.8, '#ffffff');
  ctx.restore();

  // Cathedral-Arch Crown of Antlers + Hanging Soul-Lantern
  drawCurvedAntler(ctx, -4, -80, -1.25, '#ebf7ea');
  drawCurvedAntler(ctx, 14, -82, 1.3, '#ffffff');
  const lx = 44, ly = -92 + Math.sin(time * 3.4) * 2.5;
  leadLines(ctx, [[44, -108, lx, ly - 7]], 2.0, '#b3ffd6', 0.9);
  glowGem(ctx, lx, ly, '#8dffc2', 5.0, 7.0, 0);

  // Elongated Bleached Cervine Skull (-56 to -86)
  gothicShape(
    ctx,
    [[-8, -64], [-6, -86], [14, -86], [30, -76, 44, -64], [30, -58, 12, -60], [26, -53], [6, -53]],
    vGrad(ctx, -86, -53, '#ffffff', '#e3f2e4', '#7e9e88'),
    5.4,
    '#ffffff',
    0.92,
  );
  gothicShape(ctx, [[8, -79], [18, -77], [15, -70], [7, -72]], '#07120c', 2.6);
  glowGem(ctx, 13, -74, '#7affbe', 3.2, 1.9, 0.1);
  ctx.restore();
}

function drawBossWintersHerald(ctx: CanvasRenderingContext2D, time: number, atk: number): void {
  const hover = Math.sin(time * 2.0) * 6;
  ctx.save();
  ctx.translate(0, hover - 8);

  // Six Sweeping Stained-Glass Ice Seraph Wings
  const flap = Math.sin(time * 3.2) * 0.1;
  const wings: Array<[number, number, number]> = [[-1, -112, 1.05], [-1, -82, 0.82], [1, -112, 0.94]];
  for (const [dir, wy, sc] of wings) {
    ctx.save();
    ctx.translate(dir * 8, wy);
    ctx.scale(dir * sc, sc);
    ctx.rotate(flap * dir);
    gothicShape(
      ctx,
      [[0, 0], [28, -34, 76, -28], [58, -10], [68, 2], [44, 6], [50, 18], [18, 14, 0, 0]],
      vGrad(ctx, -34, 18, '#ffffff', '#8ad8fa', '#2b5e85'),
      5.0,
      '#ffffff',
      0.88,
    );
    leadLines(ctx, [[12, -6, 56, -20], [14, 2, 48, -2]], 1.5, '#234c6e', 0.7);
    ctx.restore();
  }

  // Tall Liturgical Glacier Vestments (-118 to 4)
  gothicShape(
    ctx,
    [[-14, -114], [14, -114], [22, -56, 28, -4], [14, 5], [3, -10], [-6, 6], [-18, -8], [-26, 2], [-20, -56, -14, -114]],
    vGrad(ctx, -114, 6, '#4d8cba', '#234b6e', '#0e2236'),
    5.4,
    '#baefff',
  );
  gothicShape(ctx, [[-11, -112], [11, -112], [15, -34], [0, -12], [-14, -34]], vGrad(ctx, -112, -12, '#ffffff', '#ade6ff', '#3d7399'), 4.8, '#ffffff');

  // Spiked Frost Sunburst Halo + Compact Porcelain Mask (-114 to -142)
  leadLines(ctx, [[-22, -130, 22, -130], [0, -152, 0, -112], [-15, -145, 15, -115], [-15, -115, 15, -145]], 2.4, '#dff9ff', 0.9);
  gothicShape(ctx, [[-10, -136], [0, -145], [10, -136], [9, -116], [0, -111], [-9, -116]], vGrad(ctx, -145, -111, '#ffffff', '#cef0ff', '#699ec2'), 4.8, '#ffffff');
  glowGem(ctx, -3.5, -127, '#7ce4ff', 2.8, 1.5, 0);
  glowGem(ctx, 4.2, -127, '#7ce4ff', 2.8, 1.5, 0);

  // Crystalline Glacial Lance
  ctx.save();
  ctx.translate(24, -76);
  ctx.rotate(-0.3 + atk * 1.25);
  leadLines(ctx, [[0, 74, 0, -82]], 5.8, INK, 1);
  leadLines(ctx, [[0, 74, 0, -82]], 2.5, '#c2f2ff', 1);
  gothicShape(ctx, [[0, -108], [9, -74], [20, -68], [7, -62], [4, -36], [-4, -36], [-7, -62], [-20, -68], [-9, -74]], vGrad(ctx, -108, -36, '#ffffff', '#99e8ff', '#336d94'), 4.6, '#ffffff');
  ctx.restore();
  ctx.restore();
}

function drawBossLeviathanEye(ctx: CanvasRenderingContext2D, time: number, breath: number, atk: number): void {
  const legWave = Math.sin(time * 5) * 4;
  for (let i = -2; i <= 2; i++) {
    const lx = i * 19;
    gothicShape(
      ctx,
      [[lx - 5, -42], [lx + 5, -42], [lx + i * 9, -20, lx + i * 10 + (i % 2 === 0 ? legWave : -legWave), 2], [lx + i * 7 - 7, 2]],
      vGrad(ctx, -42, 2, '#54b8bd', '#215661', '#0e2830'),
      5.0,
      '#9effef',
    );
  }

  ctx.save();
  ctx.translate(0, -42 + breath);
  ctx.rotate(atk * 0.12);

  // Sunken Cathedral Spires on Carapace
  gothicShape(ctx, [[-32, -52], [-24, -102], [-15, -52]], vGrad(ctx, -102, -52, '#73e3d8', '#255c66', '#112e36'), 5.0, '#b5fff4');
  gothicShape(ctx, [[-9, -58], [0, -118], [10, -58]], vGrad(ctx, -118, -58, '#a8fff2', '#2e737d', '#143842'), 5.2, '#ffffff');
  gothicShape(ctx, [[16, -50], [27, -94], [35, -48]], vGrad(ctx, -94, -48, '#ffbaba', '#7a3348', '#331420'), 5.0, '#ffdada');

  // Curved Gothic Carapace Vault
  gothicShape(
    ctx,
    [[-56, -8], [-52, -52, 0, -74], [52, -52, 56, -8], [34, 8, -34, 8]],
    vGrad(ctx, -74, 8, '#5cc9c4', '#235e69', '#0f2c36'),
    6.0,
    '#b5fff4',
    0.85,
  );

  // Hypnotic Slit-Pupil Abyssal Eye
  gothicShape(ctx, [[-25, -32], [0, -52, 25, -32], [0, -12, -25, -32]], '#071a21', 5.0, '#9effef');
  gothicShape(ctx, [[-17, -32], [0, -50, 17, -32], [0, -14, -17, -32]], vGrad(ctx, -50, -14, '#ffffff', '#6ff4e0', '#16757d'), 3.8, '#ffffff');
  gothicShape(ctx, [[0, -46], [4.5, -32], [0, -18], [-4.5, -32]], '#04090f', 2.0);
  glowGem(ctx, 5, -37, '#ffffff', 2.8, 2.8, 0);

  // Curved Crusher Pincer
  ctx.save();
  ctx.translate(44 + atk * 14, -18);
  ctx.rotate(-0.2 + atk * 0.55);
  gothicShape(ctx, [[-8, -14], [22, -30, 46, -10], [20, -4], [42, 10], [16, 18, -8, 4]], vGrad(ctx, -30, 18, '#a1fff2', '#31858a', '#153d45'), 5.4, '#ffffff');
  ctx.restore();
  ctx.restore();
}

function drawBossAshenKing(ctx: CanvasRenderingContext2D, time: number, breath: number, atk: number): void {
  const sway = Math.sin(time * 2.0) * 5;
  // Towering Imperial Stained-Glass Mantle (-142 to 4)
  gothicShape(
    ctx,
    [
      [-16, -140 + breath],
      [-46, -102, -62 + sway, -32],
      [-64 + sway, -4, -54 + sway, 6],
      [-34 + sway * 0.6, -12],
      [-18, 6],
      [0, -10],
      [20, 6],
      [38, -8],
      [30, -76, 18, -140 + breath],
    ],
    vGrad(ctx, -140, 6, '#9e3073', '#4f1542', '#1c071a'),
    5.8,
    '#ffda85',
    0.78,
    [[-16, -140 + breath], [-48, -88, -48 + sway * 0.7, -4], [-14, -6], [-2, -138 + breath]],
  );
  leadLines(ctx, [[-26, -118, -44 + sway * 0.6, -12], [18, -118, 30, -14]], 1.7, '#ffcf7a', 0.55);

  // Long Sovereign Greaves (7.5-head proportions!)
  drawArmoredLeg(ctx, -14, -80, -20, -40, -28, 2, '#7d4f96', '#382047', '#170d21', '#ffd984', '#ff5983');
  drawArmoredLeg(ctx, 12, -80, 19, -40, 27, 2, '#945eb0', '#432757', '#1a0f26', '#ffe8a6', '#ff5983');

  ctx.save();
  ctx.translate(0, -80 + breath);
  ctx.rotate(atk * 0.18);

  // V-Tapered Sovereign Plate + Flaming Rose-Window Heart
  gothicShape(
    ctx,
    [[-13, 4], [-16, -22, -30, -58], [0, -66], [30, -58], [16, -22, 13, 4]],
    vGrad(ctx, -66, 4, '#834fa1', '#3b204f', '#170c21'),
    6.0,
    '#ffe08f',
    0.88,
    [[-13, 4], [-30, -58], [-3, -65], [-3, 4]],
  );
  glowGem(ctx, 0, -36, '#ff4d73', 6.5, 13.5, 0);
  leadLines(ctx, [[-17, -48, -5, -42], [17, -48, 5, -42], [-15, -34, -5, -30], [15, -34, 5, -30]], 2.3, '#ffe08f', 0.9);

  // Cathedral-Spire Spiked Pauldrons
  gothicShape(ctx, [[-44, -46], [-32, -80], [-22, -60], [-16, -70], [-12, -46], [-34, -34]], vGrad(ctx, -80, -34, '#9158b0', '#422457', '#1b0e26'), 5.6, '#ffe08f');
  gothicShape(ctx, [[12, -46], [18, -72], [25, -60], [36, -82], [46, -46], [34, -33]], vGrad(ctx, -82, -33, '#a666c9', '#4d2b66', '#1e102b'), 5.6, '#ffedb3');

  // Compact Sovereign Skull-Helm (-62 to -86) + Towering Burning Golden Crown (-84 to -108)!
  gothicShape(ctx, [[-11, -60], [-13, -76, 0, -85], [13, -76, 11, -60], [0, -55]], vGrad(ctx, -85, -55, '#8c57a6', '#3b214d', '#170c21'), 5.2, '#ffe08f');
  glowGem(ctx, -3.5, -72, '#ff4d73', 2.8, 1.6, 0.1);
  glowGem(ctx, 5.2, -72, '#ff4d73', 2.8, 1.6, -0.1);
  for (let i = -1; i <= 1; i++) {
    glowGem(ctx, i * 8, -98 - Math.sin(time * 6 + i) * 3, '#ff5983', 4.5, 8.0, 0);
  }
  gothicShape(
    ctx,
    [[-15, -78], [-18, -98], [-8, -86], [-5, -105], [0, -88], [5, -110], [9, -87], [17, -100], [15, -78]],
    vGrad(ctx, -110, -78, '#fffbe0', '#ffd063', '#b86824'),
    4.6,
    '#ffffff',
    0.92,
  );

  // Colossal Magma-Veined Obsidian Greatsword
  ctx.save();
  ctx.translate(32, -32);
  ctx.rotate(-0.3 + atk * 1.45);
  gothicShape(ctx, [[-6, -12], [6, -12], [8.5, -96], [0, -124], [-8.5, -96]], vGrad(ctx, -124, -12, '#fff4c2', '#ff597d', '#3e2154'), 5.6, '#ffeca8');
  leadLines(ctx, [[0, -18, 0, -108]], 2.5, '#fff9de', 0.95);
  gothicShape(ctx, [[-20, -12], [0, -19], [20, -12], [14, -4], [0, -8], [-14, -4]], '#f7cc6d', 4.4, '#fff6d1');
  gothicShape(ctx, [[-3.5, -4], [3.5, -4], [3.5, 16], [-3.5, 16]], '#452142', 3.8);
  ctx.restore();
  ctx.restore();
}

/* --------------------- 15 CURVED GOTHIC REGULAR ENEMIES ------------------- */

function drawDireWolf(
  ctx: CanvasRenderingContext2D,
  c: { main: string; dark: string; glow: string },
  time: number,
  breath: number,
  atk: number,
  spirit = false,
  iceMane = false,
  magmaRibs = false,
): void {
  const stride = Math.sin(time * 6.5) * 6;
  ctx.save();
  if (spirit) ctx.globalAlpha *= 0.94;
  // Curved Plumed Wolf Tail
  gothicShape(ctx, [[-34, -52 + breath], [-56, -76, -70, -64], [-54, -48], [-68, -42], [-46, -34, -36, -40 + breath]], vGrad(ctx, -76, -34, c.glow, c.main, c.dark), 4.8, '#ffffff');
  // Muscular Digitigrade Hind & Fore Limbs
  drawArmoredLeg(ctx, -28, -44, -36 + stride, -22, -28 + stride, 0, c.main, c.dark, '#0d121a', c.glow);
  drawArmoredLeg(ctx, 18, -44, 24 - stride, -22, 28 - stride, 0, c.glow, c.main, c.dark, '#ffffff');
  // Deep Arched Lupine Ribcage + Narrow Tuck-Up Waist
  gothicShape(
    ctx,
    [[-38, -46 + breath], [-22, -68, 18, -74 + breath], [36, -54 + breath], [22, -30, 8, -32], [-14, -42, -34, -36]],
    vGrad(ctx, -74, -30, c.main, c.dark, '#101420'),
    5.4,
    c.glow,
  );
  if (magmaRibs) leadLines(ctx, [[-8, -60 + breath, -6, -38], [2, -62 + breath, 4, -38], [12, -62 + breath, 13, -38]], 2.6, c.glow, 0.95);
  if (iceMane || spirit) {
    gothicShape(ctx, [[-18, -66 + breath], [-6, -90 + breath], [2, -70 + breath], [13, -92 + breath], [22, -68 + breath]], vGrad(ctx, -92, -66, '#ffffff', c.glow, c.main), 4.4, '#ffffff');
  }
  // Snarling Fanged Lupine Head
  ctx.save();
  ctx.translate(32 + atk * 9, -64 + breath);
  ctx.rotate(atk * 0.2);
  gothicShape(ctx, [[-12, -12], [-7, -32], [3, -16], [12, -30], [16, -12], [36, -5], [32, 4], [8, 4], [24, 14], [-6, 10]], vGrad(ctx, -32, 14, c.glow, c.main, c.dark), 5.0, '#ffffff');
  glowGem(ctx, 12, -6, c.glow, 3.2, 1.8, 0.15);
  leadLines(ctx, [[18, 4, 19, 9], [25, 4, 26, 9]], 2.0, '#ffffff', 0.95);
  ctx.restore();
  ctx.restore();
}

function drawCinderImp(ctx: CanvasRenderingContext2D, c: { main: string; dark: string; glow: string }, u: Unit, time: number, breath: number, atk: number): void {
  const flap = Math.sin(time * 7 + u.uid) * 8;
  // Curved Bat-Fiend Wing + Barbed Tail
  gothicShape(ctx, [[-4, -66 + breath], [-32, -104 + flap, -58, -84 + flap], [-40, -64 + flap, -38, -48], [-18, -54, -8, -50]], vGrad(ctx, -104, -48, c.glow, c.main, c.dark), 4.6, c.glow);
  drawArmoredLeg(ctx, -10, -42, -18, -20, -14, 0, c.main, c.dark, '#1a0a10', c.glow);
  drawArmoredLeg(ctx, 8, -42, 16, -20, 18, 0, c.glow, c.main, c.dark, '#ffe6a3');
  ctx.save();
  ctx.translate(2, -44 + breath);
  ctx.rotate(0.14 + atk * 0.3);
  gothicShape(ctx, [[-9, 2], [-16, -34], [16, -36], [9, 2]], vGrad(ctx, -36, 2, c.main, c.dark, '#260d14'), 5.0, c.glow);
  // Horned Imp Skull
  gothicShape(ctx, [[-10, -52], [12, -54], [22, -40], [6, -32], [-10, -35]], vGrad(ctx, -54, -32, c.glow, c.main, c.dark), 4.8, '#ffebb3');
  gothicShape(ctx, [[-5, -50], [-18, -68, -24, -78], [-8, -70, 3, -53]], vGrad(ctx, -78, -50, c.glow, '#591e26', '#1c0b10'), 4.4, c.glow);
  glowGem(ctx, 9, -43, c.glow, 3.0, 1.9, 0.15);
  glowGem(ctx, 26 + atk * 10, -22, c.glow, 6.5, 6.5, 0);
  ctx.restore();
}

function drawMagmaBrute(ctx: CanvasRenderingContext2D, c: { main: string; dark: string; glow: string }, breath: number, atk: number): void {
  drawArmoredLeg(ctx, -18, -62, -24, -30, -28, 0, c.main, c.dark, '#1c0a0d', c.glow);
  drawArmoredLeg(ctx, 16, -62, 24, -30, 28, 0, c.glow, c.main, c.dark, '#ffe599');
  ctx.save();
  ctx.translate(0, -62 + breath);
  ctx.rotate(atk * 0.2);
  gothicShape(ctx, [[-34, -54], [-24, -96], [-8, -68], [5, -104], [20, -68], [33, -90], [34, -52]], vGrad(ctx, -104, -52, '#fff0a8', c.main, c.dark), 5.2, '#ffffff');
  gothicShape(ctx, [[-18, 6], [-32, -22, -42, -56], [0, -64], [40, -58], [30, -22, 18, 6]], vGrad(ctx, -64, 6, c.main, '#6b2226', '#240b0e'), 5.8, c.glow);
  leadLines(ctx, [[-18, -48, -3, -24], [-3, -24, -13, -6], [16, -46, 6, -20], [-3, -24, 12, -12]], 3.0, c.glow, 0.95);
  gothicShape(ctx, [[2, -72], [24, -72], [28, -52], [4, -50]], vGrad(ctx, -72, -50, c.glow, c.main, c.dark), 5.0, '#fff2b8');
  glowGem(ctx, 12, -62, '#fff5bd', 3.0, 1.8, 0);
  glowGem(ctx, 22, -62, '#fff5bd', 3.0, 1.8, 0);
  ctx.save();
  ctx.translate(32, -38);
  ctx.rotate(-0.3 + atk * 1.2);
  gothicShape(ctx, [[-10, -10], [16, -12], [28, 16, 24, 42], [-6, 44], [-18, 20, -10, -10]], vGrad(ctx, -12, 44, c.glow, c.main, c.dark), 5.4, '#ffe699');
  ctx.restore();
  ctx.restore();
}

function drawIceGolem(ctx: CanvasRenderingContext2D, c: { main: string; dark: string; glow: string }, breath: number, atk: number): void {
  drawArmoredLeg(ctx, -16, -64, -22, -32, -26, 0, '#e3f8ff', '#5894b8', '#203e57', '#ffffff');
  drawArmoredLeg(ctx, 16, -64, 22, -32, 26, 0, '#ffffff', '#6aaad1', '#254866', '#ffffff');
  ctx.save();
  ctx.translate(0, -64 + breath);
  ctx.rotate(atk * 0.18);
  gothicShape(ctx, [[-18, 6], [-44, -46], [-32, -88], [-12, -70], [0, -106], [14, -70], [34, -90], [44, -46], [18, 6]], vGrad(ctx, -106, 6, '#ffffff', '#8ad2f2', '#2c5878'), 5.8, '#ffffff');
  gothicShape(ctx, [[-12, -52], [12, -52], [8, -18], [-8, -18]], '#0d2538', 3.8);
  glowGem(ctx, 0, -35, '#9fe8ff', 7.0, 10.0, 0);
  glowGem(ctx, 6, -68, '#ffffff', 4.5, 2.0, 0);
  ctx.save();
  ctx.translate(34, -38);
  ctx.rotate(-0.25 + atk * 1.15);
  gothicShape(ctx, [[-8, -12], [16, -16], [24, 40], [6, 50], [-12, 34]], vGrad(ctx, -16, 50, '#ffffff', '#9be0fc', '#316285'), 5.2, '#ffffff');
  ctx.restore();
  ctx.restore();
}

function drawBrambleStalker(ctx: CanvasRenderingContext2D, c: { main: string; dark: string; glow: string }, breath: number, atk: number): void {
  drawArmoredLeg(ctx, -12, -68, -20, -34, -16, 0, '#6ec479', '#2e663d', '#122b1a', c.glow);
  drawArmoredLeg(ctx, 10, -68, 18, -34, 22, 0, '#85db90', '#387a4a', '#16331f', '#d4ffde');
  ctx.save();
  ctx.translate(2, -68 + breath);
  gothicShape(ctx, [[-14, 4], [-22, -48], [0, -58], [20, -48], [14, 4]], vGrad(ctx, -58, 4, '#6ec479', '#316e42', '#122e1b'), 5.4, c.glow);
  gothicShape(ctx, [[-4, -78], [18, -74], [18, -50], [4, -46], [-8, -58]], vGrad(ctx, -78, -46, '#f5ead0', '#b89f74', '#5e4c32'), 4.8, '#ffffff');
  glowGem(ctx, 5, -62, c.glow, 2.8, 1.8, 0.1);
  glowGem(ctx, 13, -60, c.glow, 2.8, 1.8, -0.1);
  leadLines(ctx, [[14, -38, 48 + atk * 22, -4]], 6.0, INK, 1);
  leadLines(ctx, [[14, -38, 48 + atk * 22, -4]], 2.8, '#85e08e', 1);
  ctx.restore();
}

function drawTideRevenant(ctx: CanvasRenderingContext2D, c: { main: string; dark: string; glow: string }, time: number, breath: number, atk: number): void {
  const sway = Math.sin(time * 2.2) * 4.5;
  gothicShape(ctx, [[-12, -122 + breath], [-38, -76, -44 + sway, -12], [-26 + sway, 2], [6, -6], [10, -118 + breath]], vGrad(ctx, -122, 2, '#459dad', '#1c4d59', '#0b2229'), 5.0, c.glow);
  drawArmoredLeg(ctx, -10, -72, -15, -36, -20, 0, c.main, c.dark, '#0c242b', c.glow);
  drawArmoredLeg(ctx, 10, -72, 16, -36, 22, 0, '#96f2fa', c.main, c.dark, '#ffffff');
  ctx.save();
  ctx.translate(0, -72 + breath);
  ctx.rotate(atk * 0.2);
  gothicShape(ctx, [[-11, 2], [-20, -48], [0, -54], [20, -48], [11, 2]], vGrad(ctx, -54, 2, '#82e2f0', '#2d7585', '#133742'), 5.4, '#c7fff7');
  //Tricorne Abyssal Helm (-52 to -78)
  gothicShape(ctx, [[-20, -58], [-8, -80], [9, -82], [22, -58], [5, -52], [-8, -52]], vGrad(ctx, -82, -52, '#96eef7', '#2e7282', '#133540'), 5.0, '#ffffff');
  glowGem(ctx, 6, -63, c.glow, 4.5, 1.8, 0);
  ctx.save();
  ctx.translate(22, -28);
  ctx.rotate(-0.48 + atk * 1.4);
  leadLines(ctx, [[-8, 56, 12, -78]], 5.4, INK, 1);
  leadLines(ctx, [[-8, 56, 12, -78]], 2.3, '#88ebef', 1);
  gothicShape(ctx, [[12, -78], [20, -106], [25, -76], [14, -68], [2, -74]], vGrad(ctx, -106, -68, '#ffffff', c.glow, c.main), 4.4, '#ffffff');
  ctx.restore();
  ctx.restore();
}

function drawSporeWisp(ctx: CanvasRenderingContext2D, c: { main: string; dark: string; glow: string }, time: number): void {
  const floatY = -78 + Math.sin(time * 3.1) * 7;
  softBacklight(ctx, 0, floatY, 48, c.glow, 0.5);
  for (let i = -2; i <= 2; i++) {
    const sx = i * 9 + Math.sin(time * 3.5 + i) * 5;
    leadLines(ctx, [[i * 6, floatY + 12, sx, floatY + 54]], 3.6, '#32825c', 0.95);
    glowGem(ctx, sx, floatY + 54, c.glow, 2.6, 2.6, 0);
  }
  gothicShape(ctx, [[-14, floatY - 8], [14, floatY - 8], [10, floatY + 18], [-10, floatY + 18]], '#122e20', 4.4, c.main);
  gothicShape(ctx, [[-38, floatY - 6], [-22, floatY - 34, 0, floatY - 40], [22, floatY - 34, 38, floatY - 6], [0, floatY - 14, -38, floatY - 6]], vGrad(ctx, floatY - 40, floatY - 6, '#ffffff', c.main, '#266345'), 5.2, '#ffffff');
  glowGem(ctx, -4.5, floatY + 3, c.glow, 3.0, 2.0, 0);
  glowGem(ctx, 6.5, floatY + 3, c.glow, 3.0, 2.0, 0);
}

function drawHollowTreant(ctx: CanvasRenderingContext2D, c: { main: string; dark: string; glow: string }, breath: number, atk: number): void {
  drawArmoredLeg(ctx, -16, -54, -22, -26, -28, 0, '#78b374', '#335434', '#162618', c.glow);
  drawArmoredLeg(ctx, 14, -54, 22, -26, 28, 0, '#87c482', '#3b613c', '#182b1a', '#d4ffad');
  ctx.save();
  ctx.translate(0, -52 + breath);
  ctx.rotate(atk * 0.16);
  gothicShape(
    ctx,
    [[-20, 4], [-26, -72], [-44, -102], [-18, -86], [-8, -114], [6, -88], [30, -110], [24, -78], [22, 4]],
    vGrad(ctx, -114, 4, '#83c27c', '#3f6b3f', '#1a301d'),
    5.8,
    '#d6ffb2',
  );
  gothicShape(ctx, [[-10, -52], [14, -52], [10, -22], [-8, -22]], '#0c1f10', 3.6);
  glowGem(ctx, 2, -37, c.glow, 6.5, 9.5, 0);
  glowGem(ctx, -5, -66, c.glow, 3.4, 2.0, 0.2);
  glowGem(ctx, 10, -66, c.glow, 3.4, 2.0, -0.2);
  ctx.save();
  ctx.translate(24, -56);
  ctx.rotate(-0.2 + atk * 1.1);
  gothicShape(ctx, [[-4, -6], [28, -16], [38, 18], [22, 12], [18, 28], [6, 8]], vGrad(ctx, -16, 28, '#87c77f', '#3d693e', '#1a301c'), 5.0, c.glow);
  ctx.restore();
  ctx.restore();
}

function drawFrostWraith(ctx: CanvasRenderingContext2D, c: { main: string; dark: string; glow: string }, time: number, atk: number): void {
  const hover = Math.sin(time * 2.6) * 6;
  const sway = Math.sin(time * 3.2) * 6;
  ctx.save();
  ctx.translate(0, hover - 6);
  gothicShape(
    ctx,
    [[-13, -112], [13, -112], [26, -60, 22 + sway, -4], [6 + sway, -24], [-4 + sway, 2], [-18 + sway, -22], [-30 + sway, -6], [-24, -60, -13, -112]],
    vGrad(ctx, -112, 2, '#c4eeff', '#4884b0', '#1a3854'),
    5.2,
    '#ffffff',
  );
  gothicShape(ctx, [[-12, -108], [-14, -126, 0, -140], [14, -126, 12, -108]], vGrad(ctx, -140, -108, '#ffffff', '#7ec4eb', '#2a5578'), 5.0, '#ffffff');
  gothicShape(ctx, [[-7, -126], [9, -126], [7, -110], [-5, -110]], '#0c1d30', 3.0);
  glowGem(ctx, 0, -118, '#d9f8ff', 2.8, 1.6, 0);
  glowGem(ctx, 6.5, -118, '#d9f8ff', 2.8, 1.6, 0);
  gothicShape(ctx, [[12, -88], [38 + atk * 14, -96], [48 + atk * 16, -80], [32 + atk * 10, -78]], '#e6faff', 4.4, '#ffffff');
  ctx.restore();
}

function drawDrownedAcolyte(ctx: CanvasRenderingContext2D, c: { main: string; dark: string; glow: string }, time: number, breath: number, atk: number): void {
  const sway = Math.sin(time * 2.0) * 4;
  gothicShape(
    ctx,
    [[-22 + sway, 2], [-18, -56, -14, -104 + breath], [14, -104 + breath], [18, -56, 24 + sway, 2], [10 + sway, -12], [-6 + sway, 2]],
    vGrad(ctx, -104, 2, '#85ebe3', '#2c787d', '#11363b'),
    5.2,
    '#c7fff7',
  );
  gothicShape(ctx, [[-12, -102 + breath], [-5, -138 + breath], [8, -140 + breath], [14, -102 + breath]], vGrad(ctx, -140, -102, '#b0fff7', '#34858a', '#143d42'), 5.0, '#ffffff');
  gothicShape(ctx, [[-6, -116 + breath], [9, -116 + breath], [7, -102 + breath], [-4, -102 + breath]], '#091f24', 3.0);
  glowGem(ctx, 0, -109 + breath, c.glow, 2.6, 1.6, 0);
  glowGem(ctx, 6.5, -109 + breath, c.glow, 2.6, 1.6, 0);
  ctx.save();
  ctx.translate(22, -68 + breath);
  ctx.rotate(-0.12 + atk * 0.65);
  leadLines(ctx, [[0, 70, 0, -56]], 5.2, INK, 1);
  leadLines(ctx, [[0, 70, 0, -56]], 2.2, '#88f0e8', 1);
  glowGem(ctx, 8, -50, c.glow, 6.5, 6.5, 0);
  ctx.restore();
}

function drawCoralSentinel(ctx: CanvasRenderingContext2D, c: { main: string; dark: string; glow: string }, time: number, atk: number): void {
  const hover = Math.sin(time * 2.4) * 5;
  ctx.save();
  ctx.translate(0, hover - 14);
  for (let i = 0; i < 4; i++) {
    const a = time * 1.6 + (i * Math.PI) / 2;
    const ox = Math.cos(a) * 44;
    const oy = -68 + Math.sin(a) * 28;
    gothicShape(ctx, [[ox, oy - 14], [ox + 8, oy], [ox, oy + 14], [ox - 8, oy]], vGrad(ctx, oy - 14, oy + 14, '#ffffff', c.main, c.dark), 4.2, '#ffffff');
  }
  gothicShape(ctx, [[0, -124], [32, -82], [26, -36], [0, -4], [-26, -36], [-32, -82]], vGrad(ctx, -124, -4, '#ffcfcf', '#db6e7d', '#5e283b'), 5.8, '#fff2eb');
  leadLines(ctx, [[0, -122, 0, -6], [-30, -80, 30, -80], [-24, -38, 24, -38]], 1.7, '#ffe0dc', 0.55);
  gothicShape(ctx, [[0, -86], [14, -66], [0, -46], [-14, -66]], '#161224', 3.8);
  glowGem(ctx, atk * 4, -66, '#fff2e6', 6.8, 6.8, 0);
  ctx.restore();
}

function drawVoidKnight(ctx: CanvasRenderingContext2D, c: { main: string; dark: string; glow: string }, breath: number, atk: number): void {
  gothicShape(ctx, [[-12, -128 + breath], [-38, -82, -46, -12], [-26, 2], [4, -8], [10, -124 + breath]], vGrad(ctx, -128, 2, '#7858ba', '#332059', '#140b26'), 5.2, c.glow);
  drawArmoredLeg(ctx, -12, -76, -18, -38, -24, 0, '#9a7cf0', '#422c75', '#1d1238', c.glow);
  drawArmoredLeg(ctx, 10, -76, 17, -38, 23, 0, '#b296ff', '#4e358a', '#211540', '#ffffff');
  ctx.save();
  ctx.translate(0, -76 + breath);
  ctx.rotate(atk * 0.2);
  gothicShape(ctx, [[-12, 2], [-15, -20, -24, -50], [0, -56], [24, -50], [15, -20, 12, 2]], vGrad(ctx, -56, 2, '#c0a8ff', '#5c3fa3', '#27184a'), 5.6, '#efe6ff');
  gothicShape(ctx, [[-36, -42], [-22, -62], [-11, -46], [-28, -30]], vGrad(ctx, -62, -30, '#a68af0', '#493182', '#21153d'), 5.0, c.glow);
  gothicShape(ctx, [[11, -46], [24, -64], [38, -42], [28, -29]], vGrad(ctx, -64, -29, '#ccb8ff', '#5e40a6', '#261847'), 5.0, '#ffffff');
  gothicShape(ctx, [[-11, -54], [-13, -72, 0, -82], [13, -72, 11, -54]], vGrad(ctx, -82, -54, '#d1bdff', '#583b9c', '#241645'), 5.2, '#ffffff');
  gothicShape(ctx, [[-9, -72], [-20, -98], [-4, -80]], '#987ae8', 4.4, '#efe6ff');
  gothicShape(ctx, [[9, -72], [20, -98], [4, -80]], '#bda6ff', 4.4, '#ffffff');
  glowGem(ctx, 2, -67, '#ffffff', 7.5, 1.9, 0);
  ctx.save();
  ctx.translate(24, -32);
  ctx.rotate(-0.38 + atk * 1.45);
  gothicShape(ctx, [[-4.5, -10], [4.5, -10], [6.5, -82], [0, -104], [-6.5, -82]], vGrad(ctx, -104, -10, '#ffffff', '#c4adff', '#4b3187'), 5.0, '#ffffff');
  gothicShape(ctx, [[-15, -10], [15, -10], [11, -4], [-11, -4]], '#ebe0ff', 4.0, '#ffffff');
  ctx.restore();
  ctx.restore();
}

function drawAshSeraph(ctx: CanvasRenderingContext2D, c: { main: string; dark: string; glow: string }, time: number, atk: number): void {
  const hover = Math.sin(time * 2.8) * 5;
  ctx.save();
  ctx.translate(0, hover - 8);
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.scale(dir, 1);
    gothicShape(ctx, [[8, -104], [42, -138, 76, -98], [48, -82], [60, -64], [20, -66, 8, -104]], vGrad(ctx, -138, -64, '#ffdef4', '#d96ca8', '#591e47'), 4.8, '#ffffff');
    ctx.restore();
  }
  gothicShape(ctx, [[-14, -104], [14, -104], [22, -48, 24, 0], [6, -12], [-8, 2], [-22, -4], [-20, -48, -14, -104]], vGrad(ctx, -104, 2, '#ffc2e8', '#a8437d', '#421433'), 5.2, '#ffeaf7');
  leadLines(ctx, [[-16, -136, 16, -136]], 2.8, '#ffdef4', 0.9);
  gothicShape(ctx, [[-9, -104], [-10, -122, 0, -130], [10, -122, 9, -104]], vGrad(ctx, -130, -104, '#ffffff', '#f5a6d4', '#692452'), 4.8, '#ffffff');
  glowGem(ctx, 2, -116, '#ffffff', 5.2, 1.8, 0);
  ctx.save();
  ctx.translate(22, -72);
  ctx.rotate(-0.3 + atk * 1.2);
  leadLines(ctx, [[0, 70, 0, -68]], 5.2, INK, 1);
  leadLines(ctx, [[0, 70, 0, -68]], 2.2, '#ffc2e8', 1);
  gothicShape(ctx, [[-8, -64], [-10, -94], [-2, -72], [6, -72], [10, -96], [10, -64]], '#ffe8f7', 4.4, '#ffffff');
  ctx.restore();
  ctx.restore();
}

function drawDuskWyrm(ctx: CanvasRenderingContext2D, c: { main: string; dark: string; glow: string }, time: number, breath: number, atk: number): void {
  const flap = Math.sin(time * 4.2) * 10;
  // Scalloped Gothic Dragon Wings with Clawed Wing-Thumb & Leaded Ribs!
  gothicShape(
    ctx,
    [
      [-6, -82 + breath],
      [-34, -138 + flap],
      [-42, -152 + flap],
      [-46, -134 + flap],
      [-92, -124 + flap],
      [-70, -100 + flap, -76, -78 + flap],
      [-52, -84 + flap * 0.6, -48, -66 + flap * 0.5],
      [-30, -74, -18, -56],
    ],
    vGrad(ctx, -152, -56, '#ff9ef0', '#6d4cd9', '#25154f'),
    5.4,
    '#ffd9fa',
  );
  leadLines(ctx, [[-36, -134 + flap, -74, -80 + flap], [-36, -134 + flap, -48, -68 + flap * 0.5]], 2.2, INK, 0.88);

  // Barbed Wyrm Tail, Clawed Hindlegs & Armored Scales!
  gothicShape(ctx, [[-26, -32], [-62, -26, -94, 2], [-80, -12], [-72, 4, -20, -12]], vGrad(ctx, -32, 4, '#9e85f5', '#443082', '#1b1138'), 5.2, '#ffa6f2');
  drawArmoredLeg(ctx, -18, -38, -24, -18, -20, 2, '#957bf0', '#3d2a78', '#191036', '#ffa6f2');
  drawArmoredLeg(ctx, 14, -38, 20, -18, 24, 2, '#b39cff', '#4c3591', '#1e1340', '#ffffff');

  gothicShape(
    ctx,
    [[-30, -42 + breath], [-18, -68, 22, -66 + breath], [30, -44, 22, -16], [-8, -6, -30, -22]],
    vGrad(ctx, -68, -6, '#aa91ff', '#4e3899', '#1f1340'),
    5.6,
    '#ffc2f6',
  );
  leadLines(ctx, [[-8, -52 + breath, 16, -50 + breath], [-10, -38 + breath, 18, -36 + breath], [-8, -24, 14, -22]], 2.2, INK, 0.85);

  // Spined S-Curved Dragon Neck & Horned Wyrm Skull with Fangs!
  ctx.save();
  ctx.translate(18, -60 + breath);
  ctx.rotate(atk * 0.28);
  gothicShape(ctx, [[-12, -8], [-22, -24], [-8, -28], [-16, -44], [2, -46]], '#ff9ef0', 3.8);
  gothicShape(ctx, [[-10, 8], [-4, -24, 8, -52], [24, -50], [14, -20, 12, 10]], vGrad(ctx, -52, 10, '#aa91ff', '#4c3594', '#1f1340'), 5.2, '#ffc2f6');
  gothicShape(
    ctx,
    [[4, -48], [-18, -74], [6, -62], [18, -70], [40, -58, 52, -46], [42, -38, 20, -40], [38, -29], [12, -31]],
    vGrad(ctx, -74, -29, '#ffd9fa', '#8465eb', '#311e66'),
    5.4,
    '#ffffff',
  );
  glowGem(ctx, 23, -51, '#ffffff', 3.5, 1.9, 0.15);
  leadLines(ctx, [[32, -40, 33, -35], [40, -40, 41, -35]], 1.9, '#ffffff', 0.95);
  ctx.restore();
}
