import { vGrad, paintShape, softBacklight, type Seg } from './kit';

/* ------------------------------------------------------------------------- *
 *  BOSSES — five bespoke sovereign designs.
 *  Everything is painted in local unit space: feet on y = 0, body faces +x.
 *  Only paintShape (palette-dark edges) is used for body parts; softBacklight
 *  and tiny arcs are reserved for glows and particles.
 * ------------------------------------------------------------------------- */

type Pt = [number, number];

interface LimbStyle {
  hi: string;
  mid: string;
  lo: string;
  edge: string;
  edgeWidth?: number;
  shade?: string;
  light?: string;
}

/** Rotate the following drawing around the pivot (px, py). */
function pivot(ctx: CanvasRenderingContext2D, px: number, py: number, rot: number): void {
  ctx.translate(px, py);
  ctx.rotate(rot);
  ctx.translate(-px, -py);
}

function unitVec(dx: number, dy: number): Pt {
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}

/** A tapered, gently curved limb / tine / tentacle segment. */
function limb(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  w0: number,
  w1: number,
  s: LimbStyle,
): void {
  const a = unitVec(cx - x0, cy - y0);
  const b = unitVec(x1 - cx, y1 - cy);
  const n0: Pt = [-a[1], a[0]];
  const n1: Pt = [-b[1], b[0]];
  const l1 = Math.hypot(cx - x0, cy - y0);
  const l2 = Math.hypot(x1 - cx, y1 - cy);
  const wm = (w0 + w1) * 0.5;

  const blx = x0 + n0[0] * w0;
  const bly = y0 + n0[1] * w0;
  const brx = x0 - n0[0] * w0;
  const bry = y0 - n0[1] * w0;
  const mlx = cx + n0[0] * wm;
  const mly = cy + n0[1] * wm;
  const mrx = cx - n0[0] * wm;
  const mry = cy - n0[1] * wm;
  const tlx = x1 + n1[0] * w1;
  const tly = y1 + n1[1] * w1;
  const trx = x1 - n1[0] * w1;
  const tr_y = y1 - n1[1] * w1;

  const segs: Seg[] = [
    [blx, bly],
    [blx + a[0] * l1 * 0.34, bly + a[1] * l1 * 0.34, mlx, mly],
    [mlx + b[0] * l2 * 0.3, mly + b[1] * l2 * 0.3, tlx, tly],
    [x1, y1],
    [trx, tr_y],
    [mrx + b[0] * l2 * 0.3, mry + b[1] * l2 * 0.3, mrx, mry],
    [brx + a[0] * l1 * 0.34, bry + a[1] * l1 * 0.34, brx, bry],
  ];
  const shade: Seg[] = [
    [blx, bly],
    [mlx, mly],
    [x1, y1],
    [mrx, mry],
    [brx, bry],
  ];
  const light: Seg[] = [
    [x1, y1],
    [trx, tr_y],
    [mrx, mry],
    [brx, bry],
  ];
  const ys = [bly, mly, tly, y1, tr_y, mry, bry];
  paintShape(ctx, segs, vGrad(ctx, Math.min(...ys), Math.max(...ys), s.hi, s.mid, s.lo), {
    edge: s.edge,
    edgeWidth: s.edgeWidth ?? 1.6,
    shade,
    shadeColor: s.shade ?? 'rgba(7,3,11,0.34)',
    light,
    lightColor: s.light ?? 'rgba(255,248,230,0.15)',
  });
}

/** Interior detail line: always thin and restrained. */
function line(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, width = 1, alpha = 0.5): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha *= Math.min(alpha, 0.6);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.min(width, 1.2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.restore();
}

/** Thin bright specular streak on a metal plane. */
function spec(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, w: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  paintShape(
    ctx,
    [
      [0, -len * 0.5],
      [w, -len * 0.1],
      [0, len * 0.5],
      [-w, len * 0.1],
    ],
    color,
    { edge: 'rgba(0,0,0,0)', edgeWidth: 0 },
  );
  ctx.restore();
}

/** Soft luminous particle (eyes, motes, embers) — glow, not a body part. */
function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, core = '#fffbe8', alpha = 0.55): void {
  softBacklight(ctx, x, y, r * 3.6, color, alpha);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x - r * 0.15, y - r * 0.2, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function ellipseSegs(cx: number, cy: number, rx: number, ry: number, n = 18, rot = 0): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rot;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

function fold(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, alpha = 0.32, width = 1): void {
  line(ctx, pts, color, width, alpha);
}

/* ========================================================================== *
 *  1. THE MOLTEN WARDEN — giant executioner in cooling-magma armour.
 * ========================================================================== */

const MW = {
  edge: '#1b0608',
  plateHi: '#a9623d',
  plateMid: '#53241f',
  plateLo: '#240c10',
  hot: '#ffb14d',
  hotDeep: '#c23a1a',
  glow: '#ffe08a',
};

export function drawBossMoltenWarden(ctx: CanvasRenderingContext2D, time: number, breath: number, atk: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 3.1);
  softBacklight(ctx, 4, -144, 128, '#ff7c2e', 0.16);

  /* ---- legs: heavy splayed executioner greaves ---- */
  const drawLeg = (dir: number, hipX: number, kneeX: number, ankleX: number, footX: number): void => {
    limb(ctx, hipX, -112, kneeX - dir * 4, -86, kneeX, -60, 16, 10, {
      hi: MW.plateHi,
      mid: MW.plateMid,
      lo: MW.plateLo,
      edge: MW.edge,
      edgeWidth: 1.8,
    });
    limb(ctx, kneeX, -62, ankleX + dir * 3, -32, ankleX, -8, 10, 7, {
      hi: '#8e4d34',
      mid: '#47201d',
      lo: '#1f0b0e',
      edge: MW.edge,
      edgeWidth: 1.8,
    });
    // knee cope (round, no gem)
    paintShape(
      ctx,
      [
        [kneeX - 10, -66],
        [kneeX - 2, -73],
        [kneeX + 9, -66],
        [kneeX + 7, -56],
        [kneeX - 3, -51],
        [kneeX - 11, -57],
      ],
      vGrad(ctx, -73, -51, '#b46c42', '#592723', '#250d10'),
      {
        edge: MW.edge,
        edgeWidth: 1.6,
        shade: [
          [kneeX - 11, -57],
          [kneeX + 7, -56],
          [kneeX + 9, -66],
          [kneeX - 2, -73],
        ],
        light: [
          [kneeX - 6, -68],
          [kneeX - 1, -71],
          [kneeX + 5, -65],
          [kneeX - 1, -62],
        ],
        lightColor: 'rgba(255,240,200,0.2)',
      },
    );
    // sabaton
    paintShape(
      ctx,
      [
        [ankleX - 9, -10],
        [footX - 13, -4],
        [footX + 13, -3],
        [footX + 15, 2],
        [footX - 7, 5],
        [ankleX - 11, 1],
      ],
      vGrad(ctx, -10, 5, '#8c4c34', '#401d1c', '#1a090c'),
      {
        edge: MW.edge,
        edgeWidth: 1.9,
        shade: [
          [ankleX - 9, -10],
          [footX - 13, -4],
          [footX + 2, 1],
          [footX - 7, 5],
          [ankleX - 11, 1],
        ],
        light: [
          [footX + 1, -4],
          [footX + 15, 2],
          [footX - 7, 5],
          [footX + 2, 1],
        ],
      },
    );
    // glowing magma seam down the greave + drips
    line(ctx, [[kneeX + 1, -54], [ankleX + 2, -34], [ankleX - 1, -14]], MW.glow, 1.1, 0.55);
    line(ctx, [[kneeX + 1, -54], [kneeX + 6, -44], [kneeX + 4, -34]], MW.hot, 0.9, 0.45);
    const drip = 4 + Math.sin(time * 1.7 + dir * 1.3) * 2.5;
    paintShape(
      ctx,
      [
        [ankleX + 1 - 2, -14],
        [ankleX + 3, -14],
        [ankleX + 3, -14 + drip],
        [ankleX + 1, -11 + drip],
        [ankleX - 1, -14 + drip],
      ],
      vGrad(ctx, -14, -14 + drip, MW.glow, MW.hot, MW.hotDeep),
      { edge: 'rgba(60,14,6,0.55)', edgeWidth: 0.7 },
    );
  };

  drawLeg(-1, -18, -30, -28, -44);
  drawLeg(1, 14, 28, 22, 38);

  /* ---- torso group (breathing + forward lean on attack) ---- */
  ctx.save();
  pivot(ctx, 0, -112, atk * 0.16);
  ctx.translate(0, breath * 0.85);

  // dark back-arm first
  limb(ctx, -40, -176, -62, -154, -46, -126, 12, 7, {
    hi: '#7c4030',
    mid: '#3c1a1a',
    lo: '#1b090c',
    edge: MW.edge,
  });
  paintShape(
    ctx,
    [
      [-56, -132],
      [-44, -138],
      [-33, -128],
      [-35, -115],
      [-47, -110],
      [-57, -120],
    ],
    vGrad(ctx, -138, -110, '#8a4a34', '#421e1d', '#1c0a0d'),
    {
      edge: MW.edge,
      edgeWidth: 1.7,
      shade: [[-57, -120], [-35, -115], [-36, -124], [-47, -128]],
      light: [[-50, -134], [-43, -136], [-36, -126], [-44, -123]],
    },
  );

  // broad chest cuirass
  paintShape(
    ctx,
    [
      [-22, -114],
      [-35, -144],
      [-31, -172],
      [-9, -192],
      [15, -194],
      [35, -178],
      [38, -146],
      [27, -118],
      [6, -108],
    ],
    vGrad(ctx, -194, -108, '#b06a42', '#5a2923', '#260e11'),
    {
      edge: MW.edge,
      edgeWidth: 2.0,
      shade: [
        [-22, -114],
        [-35, -144],
        [-31, -172],
        [-9, -192],
        [-2, -152],
        [-4, -116],
      ],
      light: [
        [-4, -190],
        [15, -194],
        [35, -178],
        [30, -160],
        [6, -162],
      ],
      lightColor: 'rgba(255,232,190,0.2)',
    },
  );
  spec(ctx, -4, -178, -0.5, 44, 2.2, 'rgba(255,244,215,0.4)');

  // dripping glowing seam network across the breastplate
  const seam = (pts: Pt[]): void => {
    line(ctx, pts, MW.glow, 1.15, 0.55);
    for (const p of pts) softBacklight(ctx, p[0], p[1], 9, MW.hot, 0.16);
  };
  seam([[2, -118], [3, -138], [1, -160], [5, -180]]);
  seam([[3, -138], [-12, -146], [-20, -140]]);
  seam([[3, -138], [17, -146], [24, -140]]);
  seam([[1, -160], [-13, -166], [-18, -160]]);
  seam([[1, -160], [15, -166], [21, -160]]);
  seam([[5, -180], [-4, -186]]);
  seam([[5, -180], [14, -186]]);
  for (let i = 0; i < 4; i++) {
    const dx = -16 + i * 10;
    const len = 5 + ((i * 7) % 5);
    paintShape(
      ctx,
      [
        [dx - 2, -142],
        [dx + 2, -142],
        [dx + 1.5, -138 + len],
        [dx, -134 + len],
        [dx - 1.5, -138 + len],
      ],
      vGrad(ctx, -142, -134 + len, MW.glow, MW.hot, MW.hotDeep),
      { edge: 'rgba(56,12,5,0.5)', edgeWidth: 0.6 },
    );
  }

  // heavy belt + furnace buckle
  paintShape(
    ctx,
    [
      [-25, -120],
      [27, -124],
      [29, -107],
      [-24, -103],
    ],
    vGrad(ctx, -124, -103, '#7f452f', '#3a1a19', '#1a080b'),
    {
      edge: MW.edge,
      edgeWidth: 1.7,
      shade: [[-25, -120], [27, -124], [27, -117], [-24, -113]],
      light: [[-24, -111], [29, -115], [29, -107], [-24, -103]],
    },
  );
  paintShape(
    ctx,
    [
      [-9, -116],
      [6, -118],
      [8, -107],
      [-7, -105],
    ],
    vGrad(ctx, -118, -105, '#ffe7a6', '#ff9a34', '#b32a13'),
    { edge: '#3a0d06', edgeWidth: 1.2 },
  );
  glowDot(ctx, 0, -111, 3.5 + pulse * 1.2, '#ffcf6a', '#fff6d0', 0.35);

  // huge layered pauldrons
  paintShape(
    ctx,
    [
      [-28, -180],
      [-52, -196],
      [-68, -178],
      [-59, -155],
      [-33, -152],
    ],
    vGrad(ctx, -196, -152, '#a5603e', '#50231f', '#210c0f'),
    {
      edge: MW.edge,
      edgeWidth: 1.9,
      shade: [[-28, -180], [-52, -196], [-50, -176], [-33, -166]],
      light: [[-56, -188], [-33, -180], [-33, -168], [-49, -170]],
    },
  );
  paintShape(
    ctx,
    [
      [-56, -192],
      [-42, -208],
      [-26, -198],
      [-31, -184],
    ],
    vGrad(ctx, -208, -184, '#b66c45', '#5b2923', '#260e11'),
    { edge: MW.edge, edgeWidth: 1.6, shade: [[-56, -192], [-31, -184], [-34, -190]], light: [[-46, -202], [-38, -205], [-31, -193]] },
  );
  limb(ctx, -62, -186, -74, -196, -84, -208, 4.5, 1.2, {
    hi: '#d9a06a',
    mid: '#6a3427',
    lo: '#2a0f0f',
    edge: MW.edge,
    edgeWidth: 1.4,
  });

  paintShape(
    ctx,
    [
      [22, -186],
      [48, -202],
      [68, -182],
      [58, -158],
      [32, -155],
    ],
    vGrad(ctx, -202, -155, '#c27649', '#5f2c25', '#260e11'),
    {
      edge: MW.edge,
      edgeWidth: 2.0,
      shade: [[22, -186], [48, -202], [52, -180], [32, -170]],
      light: [[50, -194], [32, -184], [30, -168], [48, -172]],
    },
  );
  paintShape(
    ctx,
    [
      [48, -198],
      [64, -216],
      [74, -198],
      [56, -184],
    ],
    vGrad(ctx, -216, -184, '#d08452', '#633028', '#2a1012'),
    { edge: MW.edge, edgeWidth: 1.7, shade: [[48, -198], [56, -184], [62, -194]], light: [[62, -210], [70, -200], [58, -190]] },
  );
  limb(ctx, 64, -194, 76, -204, 88, -216, 4.8, 1.3, {
    hi: '#e0a66c',
    mid: '#6d3528',
    lo: '#2b1010',
    edge: MW.edge,
    edgeWidth: 1.4,
  });

  // helm
  paintShape(
    ctx,
    [
      [-14, -196],
      [-22, -214],
      [-14, -230],
      [10, -232],
      [22, -218],
      [20, -200],
      [5, -194],
    ],
    vGrad(ctx, -232, -194, '#b06a44', '#542622', '#230d10'),
    {
      edge: MW.edge,
      edgeWidth: 1.9,
      shade: [[-14, -196], [-22, -214], [-14, -230], [0, -232], [-2, -210], [-4, -198]],
      light: [[2, -228], [10, -232], [22, -218], [18, -208], [4, -210]],
      lightColor: 'rgba(255,236,196,0.2)',
    },
  );
  spec(ctx, 10, -220, -0.15, 20, 1.6, 'rgba(255,246,220,0.4)');

  // horns
  limb(ctx, -16, -222, -36, -232, -46, -250, 5.5, 1.4, {
    hi: '#f0c184',
    mid: '#8a4a2f',
    lo: '#3a1512',
    edge: MW.edge,
    edgeWidth: 1.6,
  });
  limb(ctx, 14, -226, 32, -238, 44, -254, 5.5, 1.4, {
    hi: '#f7d59a',
    mid: '#925032',
    lo: '#3c1612',
    edge: MW.edge,
    edgeWidth: 1.6,
  });

  // helm slit of fire
  paintShape(
    ctx,
    [
      [-10, -214],
      [17, -211],
      [17, -204],
      [-10, -207],
    ],
    vGrad(ctx, -214, -204, '#fff4c0', '#ffad42', '#c23518'),
    { edge: '#3a0d07', edgeWidth: 1.2 },
  );
  softBacklight(ctx, 3, -209, 24, '#ff9c3e', 0.4);

  // front arm to the axe haft
  limb(ctx, 44, -176, 64, -150, 52, -118, 12, 7, {
    hi: '#c07648',
    mid: '#5e2a23',
    lo: '#270f12',
    edge: MW.edge,
  });
  paintShape(
    ctx,
    [
      [44, -124],
      [57, -132],
      [66, -119],
      [62, -106],
      [49, -102],
      [40, -112],
    ],
    vGrad(ctx, -132, -102, '#cf8a58', '#633027', '#2a1113'),
    {
      edge: MW.edge,
      edgeWidth: 1.7,
      shade: [[44, -124], [62, -106], [52, -104], [42, -114]],
      light: [[50, -128], [60, -119], [55, -113], [47, -117]],
    },
  );

  /* ---- executioner's great axe ---- */
  ctx.save();
  ctx.translate(52, -108);
  ctx.rotate(-0.15 + atk * 1.5);
  // haft
  limb(ctx, 0, 56, 1, -30, 0, -140, 5.4, 3.8, {
    hi: '#8a5a3e',
    mid: '#40251e',
    lo: '#1a0b0c',
    edge: MW.edge,
    edgeWidth: 1.5,
  });
  spec(ctx, -1, -40, 0.02, 70, 1.1, 'rgba(255,226,180,0.3)');
  // crescent blade
  paintShape(
    ctx,
    [
      [3, -146],
      [26, -158],
      [52, -148],
      [64, -122],
      [56, -96],
      [36, -98],
      [30, -114],
      [3, -124],
    ],
    vGrad(ctx, -158, -96, '#77403a', '#381b20', '#180a0e'),
    {
      edge: MW.edge,
      edgeWidth: 2.0,
      shade: [[3, -146], [26, -158], [40, -140], [24, -122], [3, -124]],
      light: [[52, -148], [64, -122], [56, -96], [46, -106], [52, -130]],
      lightColor: 'rgba(255,236,200,0.18)',
    },
  );
  // molten cutting edge
  paintShape(
    ctx,
    [
      [48, -150],
      [62, -130],
      [64, -116],
      [56, -96],
      [44, -99],
      [54, -120],
      [54, -136],
      [42, -148],
    ],
    vGrad(ctx, -150, -96, '#fffbd8', '#ff9a32', '#cf2b16'),
    { edge: '#5a1508', edgeWidth: 1.1 },
  );
  softBacklight(ctx, 56, -122, 30, '#ff8c2e', 0.3);
  // dripping edge
  for (let i = 0; i < 3; i++) {
    const dy = 4 + ((i * 9) % 7) + Math.sin(time * 1.9 + i) * 3;
    paintShape(
      ctx,
      [
        [48 + i * 4 - 1.5, -96],
        [51 + i * 4, -96],
        [51 + i * 4, -92 + dy],
        [49.5 + i * 4, -89 + dy],
        [48 + i * 4, -92 + dy],
      ],
      vGrad(ctx, -96, -89 + dy, '#fff2ac', '#ff8a2c', '#b52512'),
      { edge: 'rgba(60,14,6,0.5)', edgeWidth: 0.6 },
    );
  }
  // top spike
  limb(ctx, 0, -130, 1, -140, 2, -156, 4.5, 1, {
    hi: '#ffe3a4',
    mid: '#a05a34',
    lo: '#3a1712',
    edge: MW.edge,
    edgeWidth: 1.4,
  });
  ctx.restore();

  // rising embers (secondary idle motion, own phases)
  for (let i = 0; i < 7; i++) {
    const ph = i * 1.9;
    const ex = -30 + i * 12 + Math.sin(time * 1.6 + ph) * 4;
    const ey = -104 - ((time * 9 + i * 23) % 96) + Math.cos(time * 2.1 + ph) * 2;
    glowDot(ctx, ex, ey, 1.2 + (i % 3) * 0.5, '#ffad4a', '#fff0bc', 0.24);
  }

  ctx.restore();
}

/* ========================================================================== *
 *  2. THE PALE STAG — spectral white stag, branching antlers, moonlit mist.
 * ========================================================================== */

const PS = {
  edge: '#173a2a',
  hi: '#f8fff8',
  mid: '#d3e9d8',
  lo: '#7fa68e',
  glow: '#8dffc2',
};

function stagAntler(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  dir: number,
  time: number,
  phase: number,
): void {
  const sway = Math.sin(time * 1.2 + phase) * 3;
  const style: LimbStyle = {
    hi: '#ffffff',
    mid: '#d8ecdc',
    lo: '#87ab94',
    edge: '#1d4030',
    edgeWidth: 1.5,
  };
  // main beam: base -> high out-curved tip
  limb(ctx, bx, by, bx + dir * 24 + sway * 0.3, by - 26, bx + dir * 38 + sway, by - 50, 7.4, 2.4, style);
  // six long tines, each forked, fanning up and out
  for (let i = 0; i < 6; i++) {
    const t = 0.16 + i * 0.14;
    const px = bx + dir * (8 + t * 32) + sway * t;
    const py = by - 5 - t * 42;
    const len = 21 - i * 1.0 + Math.sin(time * 1.4 + phase + i) * 1.4;
    // alternate the fan: lower tines reach out, upper tines reach up
    const out = dir * (18 - i * 1.8 + (i % 2) * 4);
    const cx = px + dir * (out * 0.5);
    const cy = py - len * (0.45 + (i % 2) * 0.12);
    limb(ctx, px, py, cx, cy, px + out, py - len, 5.0, 1.1, {
      ...style,
      edgeWidth: 1.4,
    });
    // forked sub-tine
    const fx = px + out * 0.55;
    const fy = py - len * 0.55;
    limb(ctx, fx, fy, fx + dir * 4, fy - 3, fx + dir * (8 + i), fy - 9, 2.6, 0.55, {
      hi: '#ffffff',
      mid: '#cfe6d4',
      lo: '#7fa28b',
      edge: '#1d4030',
      edgeWidth: 1.1,
    });
    // brow tine pointing forward low on the beam
    if (i < 2) {
      limb(ctx, px, py + 5, px + dir * 10, py + 1, px + dir * 20, py - 4, 3.0, 0.7, {
        hi: '#ffffff',
        mid: '#cfe6d4',
        lo: '#7fa28b',
        edge: '#1d4030',
        edgeWidth: 1.2,
      });
    }
  }
}

export function drawBossPaleStag(ctx: CanvasRenderingContext2D, time: number, breath: number, atk: number): void {
  const sway = Math.sin(time * 1.9) * 3.2;
  const mistPhase = Math.sin(time * 0.9);
  softBacklight(ctx, 44, -214, 96, PS.glow, 0.16);
  softBacklight(ctx, 44, -214, 44, '#ffffff', 0.12);

  // drifting mist at the hooves
  for (let i = 0; i < 5; i++) {
    const mx = -78 + i * 38 + Math.sin(time * 0.7 + i * 1.3) * 10;
    const my = -8 + Math.cos(time * 0.9 + i) * 3;
    const rx = 26 + (i % 3) * 9;
    paintShape(
      ctx,
      [
        [mx - rx, my],
        [mx - rx * 0.4, my - 9 - (i % 2) * 4, mx + rx * 0.2, my],
        [mx + rx, my + 1],
        [mx + rx * 0.4, my + 9, mx - rx * 0.3, my + 6],
      ],
      'rgba(214,255,231,0.16)',
      { edge: 'rgba(32,74,55,0.28)', edgeWidth: 0.8 },
    );
  }

  /* ---- four slender legs ---- */
  const leg = (hipX: number, kneeX: number, hoofX: number, near: boolean): void => {
    limb(ctx, hipX, -116, kneeX - 5, -66, kneeX, -24, near ? 10 : 9, 6, {
      hi: near ? '#f4fff4' : '#dfeedf',
      mid: near ? '#c7e0cf' : '#a9c6b6',
      lo: '#789a85',
      edge: PS.edge,
      edgeWidth: 1.5,
    });
    limb(ctx, kneeX, -26, hoofX - 2, -12, hoofX, -3, 5.4, 4.2, {
      hi: '#ffffff',
      mid: '#c9e2d2',
      lo: '#78988a',
      edge: PS.edge,
      edgeWidth: 1.4,
    });
    paintShape(
      ctx,
      [
        [hoofX - 5, -4],
        [hoofX + 4, -5],
        [hoofX + 7, 1],
        [hoofX + 2, 4],
        [hoofX - 7, 3],
      ],
      vGrad(ctx, -5, 4, '#e8fff0', '#9fc4ae', '#4f7261'),
      { edge: PS.edge, edgeWidth: 1.4, shade: [[hoofX - 7, 3], [hoofX + 2, 4], [hoofX + 4, 0], [hoofX - 5, 0]], light: [[hoofX, -4], [hoofX + 6, -1], [hoofX + 2, 2], [hoofX - 1, 0]] },
    );
    // faint joint line
    line(ctx, [[kneeX - 2, -30], [kneeX + 2, -26]], '#5d8271', 0.8, 0.35);
  };
  // haunch and shoulder masses soften the silhouette
  paintShape(
    ctx,
    ellipseSegs(-44, -122, 19, 17, 14),
    vGrad(ctx, -139, -105, '#ffffff', '#cfe5d6', '#7fa28b'),
    {
      edge: PS.edge,
      edgeWidth: 1.5,
      shade: [[-63, -122], [-44, -105], [-25, -122], [-44, -128]],
      light: [[-56, -132], [-40, -138], [-28, -128], [-40, -120]],
      lightColor: 'rgba(255,255,255,0.4)',
    },
  );
  paintShape(
    ctx,
    ellipseSegs(24, -124, 18, 16, 14),
    vGrad(ctx, -140, -108, '#ffffff', '#cfe5d6', '#7fa28b'),
    {
      edge: PS.edge,
      edgeWidth: 1.5,
      shade: [[6, -124], [24, -108], [42, -124], [24, -130]],
      light: [[12, -134], [28, -138], [38, -128], [24, -122]],
      lightColor: 'rgba(255,255,255,0.4)',
    },
  );
  leg(-52, -60, -70, false);
  leg(-26, -24, -14, true);
  leg(20, 28, 16, true);
  leg(40, 50, 56, false);

  /* ---- torso group ---- */
  ctx.save();
  pivot(ctx, -6, -120, atk * 0.14);
  ctx.translate(atk * 6, breath * 0.9);

  // tail
  const tsw = Math.sin(time * 2.6) * 6;
  limb(ctx, -62, -142, -76, -150 + tsw * 0.4, -84 + sway * 0.3, -124 + tsw, 5, 1.4, {
    hi: '#ffffff',
    mid: '#d6e9da',
    lo: '#8aa994',
    edge: PS.edge,
    edgeWidth: 1.4,
  });

  // barrel
  paintShape(
    ctx,
    [
      [-68, -122],
      [-58, -150],
      [-30, -162],
      [8, -162],
      [38, -150],
      [46, -128],
      [32, -108],
      [-10, -104],
      [-48, -110],
    ],
    vGrad(ctx, -162, -104, '#fbfffb', '#d8ecdc', '#8fb39a'),
    {
      edge: PS.edge,
      edgeWidth: 1.9,
      shade: [[-68, -122], [-58, -150], [-30, -162], [-6, -162], [-10, -128], [-48, -110]],
      light: [[-30, -160], [8, -162], [38, -150], [26, -136], [-12, -142]],
      lightColor: 'rgba(255,255,255,0.35)',
    },
  );
  // ribs / moon-mark
  for (let i = 0; i < 4; i++) {
    const rx = -34 + i * 15;
    fold(ctx, [[rx, -150], [rx - 4, -136], [rx - 1, -122]], '#6f9482', 0.32, 1);
  }
  paintShape(
    ctx,
    ellipseSegs(4, -136, 13, 17, 14),
    vGrad(ctx, -153, -119, 'rgba(141,255,194,0.55)', 'rgba(141,255,194,0.18)', 'rgba(141,255,194,0.02)'),
    { edge: 'rgba(46,92,69,0.6)', edgeWidth: 1.1 },
  );

  // neck and head (charges forward on attack)
  ctx.save();
  pivot(ctx, 26, -150, atk * 0.5);
  ctx.translate(atk * 10, atk * 5);
  limb(ctx, 22, -146, 42, -176, 54, -192, 16, 11, {
    hi: '#ffffff',
    mid: '#d8ecdc',
    lo: '#87ab94',
    edge: PS.edge,
    edgeWidth: 1.7,
  });
  // mane wisps
  for (let i = 0; i < 4; i++) {
    limb(ctx, 22 + i * 7, -160 - i * 7, 12 + i * 5, -168 - i * 8, 2 + i * 4, -176 - i * 8, 3.2, 0.7, {
      hi: '#ffffff',
      mid: '#d9ecdd',
      lo: '#8db09a',
      edge: 'rgba(30,70,52,0.5)',
      edgeWidth: 1,
    });
  }

  // cervine skull
  paintShape(
    ctx,
    [
      [42, -190],
      [48, -206],
      [62, -214],
      [78, -208],
      [88, -200],
      [104, -194],
      [106, -184],
      [94, -177],
      [82, -181],
      [74, -176],
      [58, -182],
      [44, -183],
    ],
    vGrad(ctx, -214, -176, '#ffffff', '#e3f2e4', '#8fae98'),
    {
      edge: PS.edge,
      edgeWidth: 1.8,
      shade: [[42, -190], [48, -206], [62, -214], [78, -208], [74, -196], [56, -194], [44, -183]],
      light: [[88, -200], [104, -194], [106, -184], [94, -177], [86, -186]],
      lightColor: 'rgba(255,255,255,0.4)',
    },
  );
  // jaw
  line(ctx, [[60, -184], [80, -184], [94, -180]], '#5b7d6c', 1, 0.45);
  // hollow eye + glow
  paintShape(
    ctx,
    ellipseSegs(74, -196, 4.4, 3.2, 10, -0.2),
    '#10281d',
    { edge: '#0d2118', edgeWidth: 0.9 },
  );
  glowDot(ctx, 75, -196, 2.2, PS.glow, '#ffffff', 0.5);
  // nostril
  paintShape(ctx, ellipseSegs(100, -188, 2.4, 1.5, 8), '#3f6352', { edge: '#2e4d3e', edgeWidth: 0.7 });

  // antlers (five+ tines on each side)
  stagAntler(ctx, 58, -209, 1, time, 0.4);
  stagAntler(ctx, 40, -204, -1, time, 2.1);

  // ears
  limb(ctx, 44, -204, 32, -212, 26, -220, 3, 0.8, {
    hi: '#ffffff',
    mid: '#d7ebdb',
    lo: '#89ab96',
    edge: PS.edge,
    edgeWidth: 1.2,
  });
  ctx.restore();

  ctx.restore();

  // moonlit motes drifting around the antlers
  for (let i = 0; i < 8; i++) {
    const a = time * 0.4 + i * 0.85;
    const mx = 46 + Math.cos(a) * (26 + (i % 3) * 13);
    const my = -226 + Math.sin(a * 1.2) * 18 + (i % 4) * 9;
    glowDot(ctx, mx, my, 1 + (i % 2) * 0.6, PS.glow, '#ffffff', 0.2);
  }
  // soft ground haze
  softBacklight(ctx, 0, -4, 96, '#9dffc9', 0.1 + mistPhase * 0.02);
}

/* ========================================================================== *
 *  3. THE WINTER'S HERALD — ice queen-angel: crown, veil, crystal wings, star.
 * ========================================================================== */

const WH = {
  edge: '#153348',
  robeHi: '#f4feff',
  robeMid: '#a9dcf2',
  robeLo: '#3d6b8c',
  deepHi: '#8fd0ea',
  deepMid: '#3d7b9e',
  deepLo: '#173a53',
  glow: '#8fe3ff',
};

export function drawBossWintersHerald(ctx: CanvasRenderingContext2D, time: number, atk: number): void {
  const hover = Math.sin(time * 1.8) * 3;
  const flap = Math.sin(time * 2.4) * 0.09;
  const veilSway = Math.sin(time * 1.5 + 0.7) * 2.5;
  softBacklight(ctx, -6, -174, 108, WH.glow, 0.15);

  ctx.save();
  ctx.translate(0, hover - 2);

  /* ---- crystalline faceted wings (back = -x) ---- */
  ctx.save();
  ctx.translate(-8, -180);
  ctx.rotate(flap);

  // upper wing — broad crystal plane
  paintShape(
    ctx,
    [
      [0, 0],
      [-26, -30],
      [-64, -36],
      [-96, -26],
      [-82, -6],
      [-46, 2],
      [-16, 10],
    ],
    vGrad(ctx, -36, 10, '#ffffff', '#b7e6f7', '#3b7290'),
    {
      edge: WH.edge,
      edgeWidth: 1.7,
      shade: [[0, 0], [-26, -30], [-64, -36], [-96, -26], [-68, -16], [-28, -8]],
      light: [[-82, -6], [-46, 2], [-16, 10], [-34, -4], [-62, -8]],
      lightColor: 'rgba(255,255,255,0.3)',
    },
  );
  paintShape(ctx, [[-26, -30], [-64, -36], [-68, -16], [-36, -12]], 'rgba(255,255,255,0.24)', { edge: 'rgba(28,68,92,0.5)', edgeWidth: 0.9 });
  paintShape(ctx, [[-68, -16], [-96, -26], [-82, -6], [-50, 0]], 'rgba(42,96,128,0.34)', { edge: 'rgba(28,68,92,0.5)', edgeWidth: 0.9 });
  line(ctx, [[0, 0], [-46, -18], [-84, -22]], '#eafcff', 1, 0.45);

  // lower wing
  paintShape(
    ctx,
    [
      [-2, 2],
      [-28, 10],
      [-60, 18],
      [-80, 38],
      [-60, 48],
      [-30, 38],
      [-6, 22],
    ],
    vGrad(ctx, 2, 48, '#eafbff', '#94d2ea', '#2f6484'),
    {
      edge: WH.edge,
      edgeWidth: 1.6,
      shade: [[-2, 2], [-28, 10], [-60, 18], [-80, 38], [-58, 34], [-28, 24], [-6, 14]],
      light: [[-60, 48], [-30, 38], [-6, 22], [-24, 30], [-48, 40]],
      lightColor: 'rgba(255,255,255,0.28)',
    },
  );
  paintShape(ctx, [[-28, 10], [-60, 18], [-52, 32], [-26, 24]], 'rgba(39,88,116,0.3)', { edge: 'rgba(28,68,92,0.5)', edgeWidth: 0.9 });
  line(ctx, [[-4, 8], [-40, 22], [-66, 38]], '#eafcff', 1, 0.4);

  // third inner plane, tucked between them
  paintShape(
    ctx,
    [
      [-2, -12],
      [-28, -20],
      [-54, -16],
      [-68, -2],
      [-52, 6],
      [-24, 8],
      [-6, 2],
    ],
    vGrad(ctx, -20, 8, '#ffffff', '#c3e9f6', '#4b819d'),
    {
      edge: WH.edge,
      edgeWidth: 1.5,
      shade: [[-2, -12], [-28, -20], [-54, -16], [-38, -6], [-14, -2]],
      light: [[-68, -2], [-52, 6], [-24, 8], [-38, -1]],
    },
  );

  ctx.restore();

  /* ---- tall glacier vestments ---- */
  paintShape(
    ctx,
    [
      [-15, -166],
      [-24, -112],
      [-35, -46],
      [-30, -6],
      [-18, 0],
      [-9, -16],
      [-2, 0],
      [10, 0],
      [24, -10],
      [30, -48],
      [24, -112],
      [15, -166],
    ],
    vGrad(ctx, -166, 0, WH.robeHi, WH.robeMid, '#284f6c'),
    {
      edge: WH.edge,
      edgeWidth: 2.0,
      shade: [[-15, -166], [-24, -112], [-35, -46], [-30, -6], [-18, 0], [-14, -62], [-10, -150]],
      light: [[10, 0], [24, -10], [30, -48], [24, -112], [15, -166], [9, -112], [7, -30]],
      lightColor: 'rgba(255,255,255,0.24)',
      shadeColor: 'rgba(14,38,58,0.44)',
    },
  );
  // four folds
  fold(ctx, [[-6, -154], [-15, -88], [-21, -16]], '#28536f', 0.42, 1);
  fold(ctx, [[5, -150], [10, -82], [15, -10]], '#28536f', 0.34, 1);
  fold(ctx, [[-20, -124], [-27, -70], [-29, -22]], '#28536f', 0.28, 1);
  fold(ctx, [[14, -120], [19, -62], [21, -16]], '#28536f', 0.24, 1);
  // icy hem shards
  for (let i = 0; i < 5; i++) {
    const hx = -26 + i * 13;
    paintShape(
      ctx,
      [
        [hx - 5, -3],
        [hx + 5, -4],
        [hx + 3, -13 - (i % 2) * 5],
        [hx - 2, -8],
      ],
      vGrad(ctx, -18, -2, '#ffffff', '#b9ecff', '#4a86a6'),
      { edge: WH.edge, edgeWidth: 1.2 },
    );
  }

  // chest bodice with a high frost collar
  paintShape(
    ctx,
    [
      [-14, -164],
      [-18, -188],
      [-2, -198],
      [15, -190],
      [15, -162],
      [0, -156],
    ],
    vGrad(ctx, -198, -156, '#ffffff', '#c4eaf9', '#588aa8'),
    {
      edge: WH.edge,
      edgeWidth: 1.8,
      shade: [[-14, -164], [-18, -188], [-2, -198], [-3, -170]],
      light: [[0, -196], [15, -190], [15, -162], [4, -170]],
      lightColor: 'rgba(255,255,255,0.35)',
    },
  );
  // shoulder crystal plates
  for (let s = -1; s <= 1; s += 2) {
    paintShape(
      ctx,
      [
        [s * 10, -178],
        [s * 22, -190],
        [s * 28, -180],
        [s * 20, -170],
      ],
      vGrad(ctx, -190, -170, '#ffffff', '#bfe8f7', '#4c7f9d'),
      { edge: WH.edge, edgeWidth: 1.4, shade: [[s * 10, -178], [s * 20, -170], [s * 18, -176]], light: [[s * 22, -190], [s * 28, -180], [s * 22, -180]] },
    );
  }
  // pale sash
  paintShape(
    ctx,
    [
      [-22, -138],
      [22, -142],
      [22, -132],
      [-21, -128],
    ],
    'rgba(150,214,236,0.5)',
    { edge: 'rgba(22,56,78,0.7)', edgeWidth: 1.1 },
  );

  // arms
  limb(ctx, -12, -182, -26, -158, -18, -136, 8, 5, {
    hi: '#f5feff',
    mid: '#b7e3f4',
    lo: '#4f7f9c',
    edge: WH.edge,
    edgeWidth: 1.5,
  });
  limb(ctx, 12, -184, 26, -160, 30, -138, 8, 5, {
    hi: '#ffffff',
    mid: '#c4ebfa',
    lo: '#557f9b',
    edge: WH.edge,
    edgeWidth: 1.5,
  });
  paintShape(ctx, ellipseSegs(-18, -134, 5.4, 4.2, 12), vGrad(ctx, -138, -130, '#ffffff', '#bfe7f7', '#4c7b99'), { edge: WH.edge, edgeWidth: 1.3 });

  /* ---- head, frozen veil, icicle crown ---- */
  // pale porcelain face
  paintShape(
    ctx,
    [
      [-9, -190],
      [-8, -208],
      [2, -215],
      [12, -207],
      [13, -191],
      [3, -185],
    ],
    vGrad(ctx, -215, -185, '#ffffff', '#e8f7ff', '#8fb4c9'),
    {
      edge: WH.edge,
      edgeWidth: 1.7,
      shade: [[-9, -190], [-8, -208], [2, -215], [0, -196]],
      light: [[2, -215], [12, -207], [13, -191], [4, -196]],
      shadeColor: 'rgba(61,105,130,0.32)',
      lightColor: 'rgba(255,255,255,0.4)',
    },
  );
  // frozen veil draped over the face, transparent so the eyes glow through
  paintShape(
    ctx,
    [
      [12, -211],
      [21 + veilSway * 0.4, -198],
      [25 + veilSway, -176],
      [18 + veilSway, -154],
      [8 + veilSway * 0.6, -156],
      [4, -178],
      [5, -200],
    ],
    'rgba(219,246,255,0.56)',
    {
      edge: 'rgba(40,88,116,0.75)',
      edgeWidth: 1.3,
      shade: [[12, -211], [25 + veilSway, -176], [18 + veilSway, -154], [10, -160], [11, -186]],
      shadeColor: 'rgba(90,146,176,0.2)',
      light: [[4, -178], [5, -200], [12, -211], [16, -190]],
      lightColor: 'rgba(255,255,255,0.45)',
    },
  );
  // eyes glimmering through the veil
  glowDot(ctx, 8, -200, 2, '#bff5ff', '#ffffff', 0.5);
  glowDot(ctx, 15, -198, 1.8, '#bff5ff', '#ffffff', 0.45);

  // crown of icicles
  const crown = [-17, -11, -5, 1, 7, 13, 19];
  for (let i = 0; i < crown.length; i++) {
    const cx = crown[i];
    const ch = i === 3 ? 15 : i === 2 || i === 4 ? 13 : 9 + (i % 2) * 2;
    paintShape(
      ctx,
      [
        [cx - 3.8, -208],
        [cx + 3.8, -208],
        [cx + 1.8, -208 - ch * 0.7],
        [cx, -208 - ch],
        [cx - 1.8, -208 - ch * 0.7],
      ],
      vGrad(ctx, -208, -208 - ch, '#ffffff', '#c9f1ff', '#5b9bbb'),
      { edge: WH.edge, edgeWidth: 1.2 },
    );
    // bright inner facet
    line(ctx, [[cx, -209], [cx, -208 - ch + 2]], '#ffffff', 0.9, 0.5);
  }
  // crown band
  paintShape(
    ctx,
    [
      [-16, -210],
      [17, -212],
      [17, -203],
      [-16, -202],
    ],
    vGrad(ctx, -212, -202, '#ffffff', '#d9f6ff', '#77aac6'),
    { edge: WH.edge, edgeWidth: 1.2 },
  );

  /* ---- staff topped with a star of ice ---- */
  ctx.save();
  ctx.translate(atk * 20, -atk * 3);
  ctx.rotate(atk * 0.35);
  limb(ctx, 30, -134, 38, -168, 42, -198, 4.6, 3.2, {
    hi: '#dff8ff',
    mid: '#8cc9e2',
    lo: '#2b5c7a',
    edge: WH.edge,
    edgeWidth: 1.4,
  });
  // hand around the shaft
  paintShape(ctx, ellipseSegs(30, -136, 6, 4.6, 12), vGrad(ctx, -141, -131, '#ffffff', '#c3e9f8', '#4b7997'), { edge: WH.edge, edgeWidth: 1.3 });
  // star of ice
  const starPts: Seg[] = [];
  const starR = 15;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? starR : starR * 0.38;
    starPts.push([42 + Math.cos(a) * r, -201 + Math.sin(a) * r]);
  }
  paintShape(ctx, starPts, vGrad(ctx, -216, -186, '#ffffff', '#bceeff', '#4f92b4'), {
    edge: WH.edge,
    edgeWidth: 1.5,
    shade: [[42, -201], [42 + 6, -197], [49, -201], [42 + 4, -206]],
    light: [[42, -216], [48, -201], [42, -201]],
    lightColor: 'rgba(255,255,255,0.45)',
  });
  softBacklight(ctx, 42, -201, 28, WH.glow, 0.35);
  // ice burst on attack
  if (atk > 0.01) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const r0 = 16 + 6 * Math.sin(time * 3 + i);
      const r1 = (22 + 16 * atk) * (0.75 + (i % 3) * 0.14);
      paintShape(
        ctx,
        [
          [42 + Math.cos(a) * r0, -201 + Math.sin(a) * r0],
          [42 + Math.cos(a + 0.12) * r1, -201 + Math.sin(a + 0.12) * r1],
          [42 + Math.cos(a + 0.24) * r0, -201 + Math.sin(a + 0.24) * r0],
        ],
        vGrad(ctx, -201 - r1, -201 + r1, '#ffffff', '#b9efff', '#4f92b4'),
        { edge: 'rgba(28,66,88,0.6)', edgeWidth: 0.9 },
      );
    }
    softBacklight(ctx, 42, -201, 42 + atk * 16, '#c9f7ff', 0.3);
  }
  ctx.restore();

  // slow crystalline motes
  for (let i = 0; i < 7; i++) {
    const a = time * 0.45 + i * 0.9;
    const mx = Math.cos(a) * (26 + (i % 3) * 12);
    const my = -150 + Math.sin(a * 1.3) * 34 + (i % 4) * 8;
    glowDot(ctx, mx, my, 1 + (i % 2) * 0.5, WH.glow, '#ffffff', 0.2);
  }

  ctx.restore();
}

/* ========================================================================== *
 *  4. THE LEVIATHAN EYE — abyssal eye, teeth rings, churning water, tentacles.
 * ========================================================================== */

const LE = {
  edge: '#07202a',
  fleshHi: '#4c9a9a',
  fleshMid: '#1e5360',
  fleshLo: '#0b2832',
  glow: '#d8fff8',
  main: '#7cf0d8',
};

/** A ring of inward-pointing teeth around the eye. */
function toothRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  count: number,
  len: number,
  time: number,
  flip: number,
): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + flip;
    const half = (Math.PI * 2 / count) * 0.42;
    const jitter = Math.sin(time * 2.2 + i * 1.7) * 1.6;
    const l = len + jitter;
    const p0x = cx + Math.cos(a - half) * r;
    const p0y = cy + Math.sin(a - half) * r;
    const p1x = cx + Math.cos(a + half) * r;
    const p1y = cy + Math.sin(a + half) * r;
    const tx = cx + Math.cos(a) * (r - l);
    const ty = cy + Math.sin(a) * (r - l);
    const segs: Seg[] = [
      [p0x, p0y],
      [(p0x + tx) / 2 + Math.cos(a) * 1.5, (p0y + ty) / 2 + Math.sin(a) * 1.5, tx, ty],
      [p1x, p1y],
    ];
    const ys = [p0y, p1y, ty];
    paintShape(ctx, segs, vGrad(ctx, Math.min(...ys), Math.max(...ys), '#e8fff9', '#9fdfd2', '#3d7d7d'), {
      edge: LE.edge,
      edgeWidth: 1.1,
      shade: [[p0x, p0y], [tx, ty], [cx + Math.cos(a) * (r - l * 0.4), cy + Math.sin(a) * (r - l * 0.4)]],
      light: [[p1x, p1y], [tx, ty], [cx + Math.cos(a) * (r - l * 0.5), cy + Math.sin(a) * (r - l * 0.5)]],
      lightColor: 'rgba(255,255,255,0.22)',
    });
  }
}

export function drawBossLeviathanEye(ctx: CanvasRenderingContext2D, time: number, breath: number, atk: number): void {
  const eyeOpen = 1 + atk * 0.16;
  const eyeCX = 2;
  const eyeCY = -162 + breath * 0.5;
  softBacklight(ctx, eyeCX, eyeCY, 116, '#3fe0c9', 0.16);

  /* ---- six tentacles curling independently out of the water ---- */
  for (let i = 0; i < 6; i++) {
    const ph = i * 1.7;
    const baseX = -70 + i * 28;
    const dir = baseX < 0 ? -1 : 1;
    const sway = Math.sin(time * 1.25 + ph);
    const sway2 = Math.cos(time * 1.05 + ph * 1.3);
    const bx = baseX;
    const by = -22;
    const m1x = baseX + dir * 12 + sway * 6 + atk * 12;
    const m1y = -56 - (i % 3) * 10 + sway2 * 6;
    const m2x = baseX + dir * (26 + (i % 3) * 4) + sway * 8 + atk * 24;
    const m2y = -86 - (i % 2) * 16 + sway2 * 7;
    const tx = baseX + dir * (34 + (i % 3) * 4) + sway * 7 + atk * 38;
    const ty = -112 - (i % 3) * 10 + sway2 * 9 - atk * 8;
    const style: LimbStyle = {
      hi: '#a9f4e4',
      mid: '#3d8b8a',
      lo: '#103a42',
      edge: LE.edge,
      edgeWidth: 1.7,
    };
    limb(ctx, bx, by, m1x, m1y, m2x, m2y, 14, 8, style);
    limb(ctx, m2x, m2y, (m2x + tx) / 2 + sway2 * 7, (m2y + ty) / 2, tx, ty, 8, 1.6, style);
    // suckers along the outer curl
    for (let k = 0; k < 3; k++) {
      const t = 0.25 + k * 0.26;
      const sx = m2x + (tx - m2x) * t + dir * 3;
      const sy = m2y + (ty - m2y) * t + 3;
      paintShape(ctx, ellipseSegs(sx, sy, 2.6 - k * 0.4, 2 - k * 0.3, 8), vGrad(ctx, sy - 3, sy + 3, '#d8fff8', '#67b7b1', '#1d525c'), {
        edge: 'rgba(5,24,30,0.6)',
        edgeWidth: 0.8,
      });
    }
  }

  /* ---- churning water ---- */
  const wave = (y0: number, amp: number, phase: number, colTop: string, colMid: string, colBot: string): void => {
    const pts: Seg[] = [];
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const x = -108 + (i / n) * 216;
      const y = y0 + Math.sin(i * 1.1 + time * 1.5 + phase) * amp + Math.sin(i * 2.3 - time * 1.1) * amp * 0.5;
      pts.push([x, y]);
    }
    pts.push([108, 6], [-108, 6]);
    paintShape(ctx, pts, vGrad(ctx, y0 - amp * 2, 6, colTop, colMid, colBot), {
      edge: 'rgba(6,32,40,0.7)',
      edgeWidth: 1.4,
      shade: [[-108, 6], [108, 6], [108, y0], [-108, y0]],
    });
  };
  wave(-6, 5, 0, '#d4fff8', '#3a9c98', '#0f3a44');
  wave(-15, 6, 1.8, '#8fe9da', '#256f76', '#0b2c36');
  wave(-26, 5, 3.4, '#58c4bc', '#164e5a', '#082028');
  // bright animated crest lines
  for (let w = 0; w < 3; w++) {
    const pts: Pt[] = [];
    for (let i = 0; i <= 9; i++) {
      const x = -104 + (i / 9) * 208;
      const y = -4 - w * 9 + Math.sin(i * 1.2 + time * 1.5 + w * 1.9) * 4;
      pts.push([x, y]);
    }
    line(ctx, pts, '#eafffb', 1.1, 0.5);
  }
  // foam flecks
  for (let i = 0; i < 8; i++) {
    const fx = -88 + i * 26 + Math.sin(time * 1.7 + i * 1.2) * 6;
    const fy = -10 - (i % 3) * 5 + Math.cos(time * 1.3 + i) * 2;
    paintShape(ctx, ellipseSegs(fx, fy, 7 + (i % 3) * 2.5, 2.2, 8), 'rgba(220,255,250,0.35)', { edge: 'rgba(30,90,95,0.3)', edgeWidth: 0.7 });
  }

  /* ---- fleshy mantle behind the eye ---- */
  paintShape(
    ctx,
    [
      [-30, -56],
      [-39, -94],
      [-34, -130],
      [-16, -148],
      [16, -150],
      [36, -134],
      [39, -96],
      [30, -56],
      [15, -50],
      [-16, -52],
    ],
    vGrad(ctx, -150, -46, LE.fleshHi, LE.fleshMid, LE.fleshLo),
    {
      edge: LE.edge,
      edgeWidth: 1.8,
      shade: [[-38, -58], [-44, -94], [-36, -130], [-16, -148], [-4, -108], [-8, -70]],
      light: [[16, -150], [38, -134], [44, -96], [30, -92], [10, -112]],
      lightColor: 'rgba(200,255,245,0.2)',
    },
  );
  // veins
  for (let i = 0; i < 4; i++) {
    const vx = -28 + i * 18;
    line(ctx, [[vx, -52], [vx + 5, -84], [vx + (i % 2 ? 9 : -5), -112]], '#082630', 1, 0.4);
  }

  /* ---- socket + teeth rings ---- */
  paintShape(ctx, ellipseSegs(eyeCX, eyeCY, 44, 42 * eyeOpen, 22), vGrad(ctx, eyeCY - 44, eyeCY + 44, '#8fe6d8', '#2c7076', '#0c2f38'), {
    edge: LE.edge,
    edgeWidth: 2.0,
    shade: [[eyeCX - 44, eyeCY], [eyeCX, eyeCY + 42], [eyeCX + 44, eyeCY], [eyeCX, eyeCY + 20]],
    light: [[eyeCX - 30, eyeCY - 33], [eyeCX, eyeCY - 42], [eyeCX + 30, eyeCY - 33], [eyeCX, eyeCY - 25]],
    lightColor: 'rgba(220,255,250,0.22)',
  });
  toothRing(ctx, eyeCX, eyeCY, 46, 22, 10, time, 0.1);
  toothRing(ctx, eyeCX, eyeCY, 53, 28, 8, time + 0.7, 0.23);
  toothRing(ctx, eyeCX, eyeCY, 58, 34, 6.5, time + 1.4, 0.37);

  /* ---- the eye itself ---- */
  const irisX = eyeCX + Math.sin(time * 1.35) * 7;
  const irisY = eyeCY + Math.cos(time * 1.05) * 4;
  const irisR = 22 + atk * 4;
  // sclera
  paintShape(ctx, ellipseSegs(eyeCX, eyeCY, 31, 28 * eyeOpen, 24), vGrad(ctx, eyeCY - 30, eyeCY + 30, '#ffffff', '#dcfff6', '#7fc4bd'), {
    edge: '#0a2a33',
    edgeWidth: 1.5,
    shade: [[eyeCX - 31, eyeCY], [eyeCX, eyeCY + 28], [eyeCX + 31, eyeCY], [eyeCX + 13, eyeCY + 7]],
    light: [[eyeCX - 22, eyeCY - 22], [eyeCX, eyeCY - 28], [eyeCX + 22, eyeCY - 22], [eyeCX, eyeCY - 15]],
    lightColor: 'rgba(255,255,255,0.35)',
  });
  // iris (moving)
  paintShape(ctx, ellipseSegs(irisX, irisY, irisR, irisR * 0.92, 24), vGrad(ctx, irisY - irisR, irisY + irisR, '#d8fff8', '#58d9c5', '#10636b'), {
    edge: '#0a3038',
    edgeWidth: 1.4,
    shade: [[irisX - irisR, irisY], [irisX, irisY + irisR * 0.9], [irisX + irisR, irisY], [irisX, irisY + 8]],
    light: [[irisX - irisR * 0.55, irisY - irisR * 0.6], [irisX + irisR * 0.2, irisY - irisR * 0.75], [irisX + irisR * 0.4, irisY - irisR * 0.2]],
    lightColor: 'rgba(255,255,255,0.3)',
  });
  // radial iris fibres
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    line(ctx, [[irisX + Math.cos(a) * irisR * 0.4, irisY + Math.sin(a) * irisR * 0.4], [irisX + Math.cos(a) * irisR * 0.92, irisY + Math.sin(a) * irisR * 0.92]], '#1b7a7d', 0.8, 0.35);
  }
  // slit pupil — widens as the eye wakes
  const pw = 5.5 + atk * 3.5;
  paintShape(
    ctx,
    [
      [irisX, irisY - irisR * 0.78],
      [irisX + pw, irisY - irisR * 0.2],
      [irisX + pw * 0.7, irisY + irisR * 0.55],
      [irisX, irisY + irisR * 0.8],
      [irisX - pw * 0.7, irisY + irisR * 0.55],
      [irisX - pw, irisY - irisR * 0.2],
    ],
    vGrad(ctx, irisY - irisR, irisY + irisR, '#0c2a30', '#04161c', '#020a0d'),
    { edge: '#031217', edgeWidth: 1.2 },
  );
  glowDot(ctx, irisX + irisR * 0.28, irisY - irisR * 0.38, 3.4, '#ffffff', '#ffffff', 0.5);

  // heavy lids (retract with attack)
  const lidDrop = 9 - atk * 6;
  paintShape(
    ctx,
    [
      [eyeCX - 32, eyeCY - 4],
      [eyeCX - 24, eyeCY - 26],
      [eyeCX, eyeCY - 31],
      [eyeCX + 25, eyeCY - 25],
      [eyeCX + 32, eyeCY - 3],
      [eyeCX + 21, eyeCY - 9 - lidDrop * 0.3],
      [eyeCX, eyeCY - 14 - lidDrop * 0.4],
      [eyeCX - 23, eyeCY - 9 - lidDrop * 0.3],
    ],
    vGrad(ctx, eyeCY - 31, eyeCY, '#70cabf', '#27646b', '#0b2c34'),
    {
      edge: LE.edge,
      edgeWidth: 1.5,
      shade: [[eyeCX - 32, eyeCY - 4], [eyeCX + 32, eyeCY - 3], [eyeCX + 21, eyeCY - 9], [eyeCX - 23, eyeCY - 9]],
      light: [[eyeCX - 24, eyeCY - 26], [eyeCX, eyeCY - 31], [eyeCX + 25, eyeCY - 25], [eyeCX, eyeCY - 20]],
    },
  );

  // breath motes rising off the water
  for (let i = 0; i < 6; i++) {
    const bx = -64 + i * 25 + Math.sin(time * 1.1 + i) * 5;
    const by = -46 - ((time * 8 + i * 19) % 70) + Math.cos(time * 1.7 + i) * 2;
    glowDot(ctx, bx, by, 1.4, LE.glow, '#ffffff', 0.2);
  }
}

/* ========================================================================== *
 *  5. THE ASHEN KING — lich-king, ruined crown, ember armour, cape, greatsword.
 * ========================================================================== */

const AK = {
  edge: '#0c050f',
  armorHi: '#5d3a6a',
  armorMid: '#2a1533',
  armorLo: '#120816',
  goldHi: '#ffe8a4',
  goldMid: '#c79543',
  goldLo: '#6a441b',
  goldEdge: '#3a240a',
  capeHi: '#69294f',
  capeMid: '#2f1233',
  capeLo: '#150818',
  glow: '#ff4d6d',
  ember: '#ffa23d',
};

export function drawBossAshenKing(ctx: CanvasRenderingContext2D, time: number, breath: number, atk: number): void {
  const capeSway = Math.sin(time * 1.35) * 5;
  const capeSway2 = Math.sin(time * 1.7 + 1.2) * 4;
  const flame = Math.sin(time * 4.2);
  softBacklight(ctx, -14, -200, 150, AK.glow, 0.14);

  /* ---- legs ---- */
  const leg = (dir: number, hipX: number, kneeX: number, footX: number): void => {
    limb(ctx, hipX, -126, kneeX + dir * 4, -84, kneeX, -58, 15, 9, {
      hi: AK.armorHi,
      mid: AK.armorMid,
      lo: AK.armorLo,
      edge: AK.edge,
      edgeWidth: 1.8,
    });
    limb(ctx, kneeX, -58, footX - dir * 3, -28, footX, -6, 9, 6, {
      hi: '#4b2c58',
      mid: '#24122d',
      lo: '#0f0714',
      edge: AK.edge,
      edgeWidth: 1.8,
    });
    // knee cope — curved plate, no gem
    paintShape(
      ctx,
      [
        [kneeX - 9, -63],
        [kneeX - 1, -69],
        [kneeX + 9, -62],
        [kneeX + 6, -53],
        [kneeX - 4, -49],
        [kneeX - 10, -55],
      ],
      vGrad(ctx, -69, -49, '#6a4378', '#2e1939', '#120817'),
      { edge: AK.edge, edgeWidth: 1.5, shade: [[kneeX - 10, -55], [kneeX + 6, -53], [kneeX + 9, -62], [kneeX - 1, -69]], light: [[kneeX - 5, -64], [kneeX + 1, -66], [kneeX + 6, -60], [kneeX, -57]] },
    );
    // sabaton
    paintShape(
      ctx,
      [
        [footX - 9, -8],
        [footX - 12, -3],
        [footX + 13, -2],
        [footX + 16, 3],
        [footX - 6, 5],
        [footX - 12, 1],
      ],
      vGrad(ctx, -8, 5, '#5b3568', '#28142f', '#100712'),
      { edge: AK.edge, edgeWidth: 1.8, shade: [[footX - 9, -8], [footX - 12, -3], [footX + 2, 1], [footX - 6, 5], [footX - 12, 1]], light: [[footX + 1, -3], [footX + 16, 3], [footX - 6, 5]] },
    );
    // ember crack down the greave
    line(ctx, [[kneeX + 1, -52], [footX + 1, -32], [footX - 2, -12]], AK.glow, 1.05, 0.55);
    line(ctx, [[kneeX + 1, -52], [kneeX + 7, -42], [kneeX + 4, -32]], AK.ember, 0.9, 0.45);
  };
  leg(-1, -16, -24, -34);
  leg(1, 14, 22, 32);

  /* ---- tattered cape behind ---- */
  ctx.save();
  pivot(ctx, -6, -196, atk * 0.1);
  paintShape(
    ctx,
    [
      [-18, -204],
      [-46, -190],
      [-72 + capeSway * 0.5, -152],
      [-86 + capeSway, -96],
      [-82 + capeSway, -48],
      [-90 + capeSway * 1.2, -10],
      [-64 + capeSway, -22],
      [-50 + capeSway2, -4],
      [-36 + capeSway2 * 0.6, -24],
      [-20, -8],
      [-8, -40],
      [-6, -110],
      [-10, -170],
    ],
    vGrad(ctx, -204, -4, AK.capeHi, AK.capeMid, AK.capeLo),
    {
      edge: AK.edge,
      edgeWidth: 2.0,
      shade: [[-18, -204], [-46, -190], [-72 + capeSway * 0.5, -152], [-86 + capeSway, -96], [-82 + capeSway, -48], [-90 + capeSway * 1.2, -10], [-64, -40], [-58, -120]],
      light: [[-8, -40], [-6, -110], [-10, -170], [-18, -204], [-20, -130], [-22, -60]],
      lightColor: 'rgba(255,180,210,0.12)',
    },
  );
  // tatter strips with independent sway
  for (let i = 0; i < 4; i++) {
    const ph = i * 1.4;
    const sw = Math.sin(time * 1.5 + ph) * (5 + i);
    const sx = -68 + i * 13;
    limb(ctx, sx, -66, sx - 7 + sw * 0.5, -40, sx - 2 + sw, -10 + (i % 2) * 4, 7 - i, 1.5, {
      hi: AK.capeHi,
      mid: AK.capeMid,
      lo: AK.capeLo,
      edge: AK.edge,
      edgeWidth: 1.4,
    });
  }
  // 2-4 fold lines in the cloth
  fold(ctx, [[-20, -194], [-48, -132], [-62, -46]], '#a24e7c', 0.32, 1);
  fold(ctx, [[-12, -186], [-34, -118], [-40, -34]], '#a24e7c', 0.26, 1);
  fold(ctx, [[-58, -160], [-72, -96], [-74, -30]], '#a24e7c', 0.24, 1);
  ctx.restore();

  /* ---- torso group ---- */
  ctx.save();
  pivot(ctx, 0, -126, atk * 0.15);
  ctx.translate(0, breath * 0.9);

  // back arm
  limb(ctx, -38, -200, -66, -176, -58, -146, 12, 7, {
    hi: '#4b2c58',
    mid: '#23122c',
    lo: '#0f0714',
    edge: AK.edge,
  });

  // cuirass
  paintShape(
    ctx,
    [
      [-22, -128],
      [-37, -160],
      [-33, -194],
      [-10, -212],
      [16, -212],
      [40, -194],
      [40, -162],
      [27, -130],
      [6, -120],
    ],
    vGrad(ctx, -212, -120, AK.armorHi, AK.armorMid, AK.armorLo),
    {
      edge: AK.edge,
      edgeWidth: 2.0,
      shade: [[-22, -128], [-37, -160], [-33, -194], [-10, -212], [-4, -170], [-6, -130]],
      light: [[-2, -208], [16, -212], [40, -194], [34, -174], [6, -176]],
      lightColor: 'rgba(235,210,255,0.16)',
    },
  );
  spec(ctx, 10, -196, -0.3, 40, 2, 'rgba(255,248,230,0.4)');
  // gold trim
  paintShape(
    ctx,
    [
      [-20, -180],
      [34, -188],
      [36, -182],
      [-19, -174],
    ],
    vGrad(ctx, -188, -174, AK.goldHi, AK.goldMid, AK.goldLo),
    { edge: AK.goldEdge, edgeWidth: 1.1 },
  );
  paintShape(
    ctx,
    [
      [-8, -205],
      [10, -207],
      [12, -198],
      [-7, -196],
    ],
    vGrad(ctx, -207, -196, AK.goldHi, AK.goldMid, AK.goldLo),
    { edge: AK.goldEdge, edgeWidth: 1.1 },
  );
  // ember cracks
  const burn = (pts: Pt[]): void => {
    line(ctx, pts, AK.glow, 1.1, 0.55);
    for (const p of pts) softBacklight(ctx, p[0], p[1], 8, AK.glow, 0.12);
  };
  burn([[1, -128], [2, -148], [0, -168], [4, -188]]);
  burn([[2, -148], [-12, -156], [-18, -150]]);
  burn([[2, -148], [16, -156], [22, -150]]);
  burn([[0, -168], [-14, -176], [-18, -170]]);
  burn([[0, -168], [16, -176], [20, -170]]);

  // belt with gold skull-ish buckle
  paintShape(
    ctx,
    [
      [-25, -132],
      [28, -136],
      [29, -118],
      [-24, -114],
    ],
    vGrad(ctx, -136, -114, AK.armorHi, AK.armorMid, AK.armorLo),
    { edge: AK.edge, edgeWidth: 1.6, shade: [[-25, -132], [28, -136], [28, -128], [-24, -124]], light: [[-24, -122], [29, -126], [29, -118], [-24, -114]] },
  );
  paintShape(
    ctx,
    [
      [-8, -131],
      [8, -133],
      [9, -121],
      [-7, -119],
    ],
    vGrad(ctx, -133, -119, AK.goldHi, AK.goldMid, AK.goldLo),
    { edge: AK.goldEdge, edgeWidth: 1.2 },
  );

  // pauldrons — cathedral spikes
  paintShape(
    ctx,
    [
      [-28, -196],
      [-56, -214],
      [-76, -194],
      [-64, -168],
      [-36, -166],
    ],
    vGrad(ctx, -214, -166, '#5d3a6a', '#2b1636', '#110817'),
    {
      edge: AK.edge,
      edgeWidth: 1.9,
      shade: [[-28, -196], [-56, -214], [-56, -190], [-36, -180]],
      light: [[-60, -206], [-36, -198], [-36, -184], [-54, -186]],
    },
  );
  limb(ctx, -64, -204, -78, -216, -90, -232, 5, 1.2, {
    hi: AK.goldHi,
    mid: AK.goldMid,
    lo: AK.goldLo,
    edge: AK.goldEdge,
    edgeWidth: 1.3,
  });
  paintShape(
    ctx,
    [
      [22, -204],
      [50, -222],
      [72, -202],
      [60, -176],
      [32, -172],
    ],
    vGrad(ctx, -222, -172, '#6a4378', '#301a3c', '#130919'),
    {
      edge: AK.edge,
      edgeWidth: 2.0,
      shade: [[22, -204], [50, -222], [52, -198], [32, -188]],
      light: [[52, -214], [32, -206], [32, -192], [50, -194]],
    },
  );
  limb(ctx, 60, -212, 76, -226, 86, -242, 5, 1.2, {
    hi: AK.goldHi,
    mid: AK.goldMid,
    lo: AK.goldLo,
    edge: AK.goldEdge,
    edgeWidth: 1.3,
  });

  // front arm / gauntlet holding the sword
  limb(ctx, 44, -202, 68, -184, 56, -160, 12, 7, {
    hi: '#5b3769',
    mid: '#2a1534',
    lo: '#100713',
    edge: AK.edge,
  });
  paintShape(
    ctx,
    [
      [48, -166],
      [62, -174],
      [72, -160],
      [66, -146],
      [52, -143],
      [43, -154],
    ],
    vGrad(ctx, -174, -143, '#6d477c', '#311a3d', '#140a19'),
    { edge: AK.edge, edgeWidth: 1.7, shade: [[48, -166], [66, -146], [56, -144], [45, -156]], light: [[54, -168], [64, -160], [57, -154], [50, -158]] },
  );

  // head — gaunt lich skull
  paintShape(
    ctx,
    [
      [-12, -218],
      [-14, -234],
      [-4, -244],
      [10, -244],
      [18, -234],
      [17, -220],
      [8, -212],
      [-3, -212],
    ],
    vGrad(ctx, -244, -212, '#6a4678', '#2d1739', '#120917'),
    {
      edge: AK.edge,
      edgeWidth: 1.8,
      shade: [[-12, -218], [-14, -234], [-4, -244], [0, -228], [-1, -216]],
      light: [[4, -242], [10, -244], [18, -234], [14, -224], [4, -226]],
    },
  );
  // jaw / teeth
  paintShape(
    ctx,
    [
      [-6, -218],
      [16, -220],
      [14, -210],
      [2, -207],
      [-7, -211],
    ],
    vGrad(ctx, -220, -207, '#4b2c58', '#23112c', '#0e0713'),
    { edge: AK.edge, edgeWidth: 1.4 },
  );
  for (let i = 0; i < 4; i++) {
    line(ctx, [[-3 + i * 4, -219], [-2 + i * 4, -213]], '#c9a06a', 0.8, 0.4);
  }
  // burning eyes
  glowDot(ctx, -2, -231, 3, AK.glow, '#fff0c0', 0.6);
  glowDot(ctx, 9, -231, 3, AK.glow, '#fff0c0', 0.6);
  // brow shadow
  line(ctx, [[-9, -236], [2, -238], [12, -236]], '#170a1d', 1.1, 0.55);

  // ruined crown — asymmetric, one broken tine
  paintShape(
    ctx,
    [
      [-16, -242],
      [-24, -260],
      [-13, -248],
      [-9, -268],
      [-2, -250],
      [3, -272],
      [7, -248],
      [16, -264],
      [15, -250],
      [22, -254],
      [20, -240],
      [-14, -238],
    ],
    vGrad(ctx, -272, -238, AK.goldHi, AK.goldMid, AK.goldLo),
    {
      edge: AK.goldEdge,
      edgeWidth: 1.4,
      shade: [[-16, -242], [-24, -260], [-9, -268], [3, -272], [7, -248], [-2, -246]],
      light: [[7, -248], [16, -264], [22, -254], [20, -240], [10, -246]],
      lightColor: 'rgba(255,255,240,0.4)',
    },
  );
  // broken tine
  limb(ctx, 2, -270, 6, -280, 4, -286, 2.4, 0.8, {
    hi: AK.goldHi,
    mid: AK.goldMid,
    lo: AK.goldLo,
    edge: AK.goldEdge,
    edgeWidth: 1.1,
  });
  // crown embers
  for (let i = 0; i < 3; i++) {
    const ex = -10 + i * 11;
    const ey = -258 - i * 8 + Math.sin(time * 4 + i * 2) * 3;
    glowDot(ctx, ex, ey, 1.6, AK.ember, '#fff2c0', 0.3);
  }

  /* ---- flaming greatsword ---- */
  ctx.save();
  ctx.translate(58 + atk * 10, -152);
  ctx.rotate(-0.22 + atk * 1.55);
  // grip and pommel
  paintShape(
    ctx,
    [
      [-3.5, -6],
      [3.5, -6],
      [3.5, 20],
      [-3.5, 20],
    ],
    vGrad(ctx, -6, 20, '#6a4a30', '#33201a', '#150a0a'),
    { edge: '#140a08', edgeWidth: 1.2 },
  );
  paintShape(ctx, ellipseSegs(0, 23, 4.5, 4, 10), vGrad(ctx, 19, 27, AK.goldHi, AK.goldMid, AK.goldLo), { edge: AK.goldEdge, edgeWidth: 1.1 });
  // crossguard
  paintShape(
    ctx,
    [
      [-22, -10],
      [-6, -16],
      [6, -16],
      [22, -10],
      [18, -2],
      [6, -6],
      [-6, -6],
      [-18, -2],
    ],
    vGrad(ctx, -16, -2, AK.goldHi, AK.goldMid, AK.goldLo),
    { edge: AK.goldEdge, edgeWidth: 1.3 },
  );
  // blade
  paintShape(
    ctx,
    [
      [-7, -14],
      [7, -14],
      [10, -64],
      [7, -116],
      [0, -142],
      [-7, -116],
      [-10, -64],
    ],
    vGrad(ctx, -142, -14, '#4a4a58', '#25202f', '#100a14'),
    {
      edge: '#0c0710',
      edgeWidth: 1.7,
      shade: [[-7, -14], [-10, -64], [-7, -116], [0, -142], [0, -70], [-1, -20]],
      light: [[7, -14], [10, -64], [7, -116], [2, -134], [3, -70]],
      lightColor: 'rgba(255,240,210,0.18)',
    },
  );
  // ember-cracked fuller + burning edge
  line(ctx, [[0, -20], [1, -60], [-1, -98], [0, -126]], AK.glow, 1.1, 0.55);
  paintShape(
    ctx,
    [
      [6, -18],
      [9, -64],
      [7, -114],
      [2, -136],
      [0, -142],
      [4, -114],
      [5, -64],
      [3, -18],
    ],
    vGrad(ctx, -142, -18, '#fff2c0', '#ff8a2e', '#c42a18'),
    { edge: 'rgba(74,16,8,0.6)', edgeWidth: 1 },
  );
  softBacklight(ctx, 6, -90, 26, '#ff7a2e', 0.26);
  // layered flame tongues along the blade
  for (let i = 0; i < 4; i++) {
    const fy = -40 - i * 26;
    const away = 7 + i * 1.5;
    const flick = Math.sin(time * 5 + i * 1.7) * 4;
    paintShape(
      ctx,
      [
        [away - 2, fy + 9],
        [away + 8, fy + 2],
        [away + 2 + flick, fy - 10 - (i % 2) * 6],
        [away + 6, fy - 2],
        [away + 1, fy - 16],
        [away - 1, fy - 2],
      ],
      vGrad(ctx, fy - 18, fy + 10, '#fff0b0', '#ff9a2e', '#c2331b'),
      { edge: 'rgba(76,18,8,0.55)', edgeWidth: 0.8 },
    );
  }
  // flickering tip flame
  paintShape(
    ctx,
    [
      [-4, -132],
      [4, -132],
      [7 + flame * 3, -148],
      [1, -142],
      [-2 + flame * 2, -154],
      [-5, -142],
    ],
    vGrad(ctx, -156, -132, '#fff6c8', '#ff9a30', '#c22e19'),
    { edge: 'rgba(80,20,8,0.55)', edgeWidth: 0.8 },
  );
  ctx.restore();

  // rising embers around the king
  for (let i = 0; i < 8; i++) {
    const ph = i * 1.7;
    const ex = -54 + i * 17 + Math.sin(time * 1.4 + ph) * 5;
    const ey = -136 - ((time * 11 + i * 27) % 118) + Math.cos(time * 2 + ph) * 3;
    glowDot(ctx, ex, ey, 1.2 + (i % 3) * 0.5, AK.ember, '#fff0bc', 0.24);
  }

  ctx.restore();
}
