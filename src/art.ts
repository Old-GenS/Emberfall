import type { Battle, CombatEvent, Unit } from './combat';
import { type BodyKind, type ClassDef, type LocationDef } from './data';

export const DESIGN_W = 960;
export const DESIGN_H = 540;

const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export function classPortraitSVG(cls: ClassDef, decorative = true): string {
  const c = cls.colors;
  const id = cls.id;
  let features = '';
  if (id === 'warden') {
    features = `
      <path d="M60 150 L60 100 Q60 62 100 52 Q140 62 140 100 L140 150 Z" fill="${c.cloth}"/>
      <path d="M72 96 Q100 70 128 96 L132 112 L68 112 Z" fill="${c.accent}" opacity="0.9"/>
      <path d="M84 86 Q100 78 116 86 L116 100 L84 100 Z" fill="#1a1420"/>
      <path d="M80 96 L120 96" stroke="${c.main}" stroke-width="3"/>
      <path d="M100 52 L100 32" stroke="${c.main}" stroke-width="4"/>
      <path d="M100 34 L118 40 L100 48 Z" fill="${c.main}"/>
      <path d="M48 160 Q48 112 72 108 L72 160 Z" fill="${c.main}" opacity="0.85"/>
      <path d="M128 160 Q128 112 152 108 L152 160 Z" fill="${c.main}" opacity="0.85"/>`;
  } else if (id === 'pyromancer') {
    features = `
      <path d="M58 158 Q58 104 100 96 Q142 104 142 158 Q120 148 100 156 Q80 148 58 158 Z" fill="${c.cloth}"/>
      <path d="M68 102 Q100 58 132 102 Q116 92 100 94 Q84 92 68 102 Z" fill="${c.main}"/>
      <path d="M82 78 Q100 60 118 78 Q108 94 100 88 Q92 94 82 78 Z" fill="${c.accent}"/>
      <ellipse cx="100" cy="112" rx="20" ry="24" fill="#241426"/>
      <path d="M88 108 L96 108 M104 108 L112 108" stroke="${c.main}" stroke-width="3"/>
      <path d="M100 136 L100 150" stroke="${c.accent}" stroke-width="2" opacity="0.6"/>
      <path d="M148 70 Q160 58 156 44 Q170 58 162 76 Q158 84 148 84 Q144 78 148 70Z" fill="${c.main}" opacity="0.9"/>`;
  } else if (id === 'shadowblade') {
    features = `
      <path d="M58 158 Q64 100 100 94 Q136 100 142 158 L120 148 L100 156 L80 148 Z" fill="${c.cloth}"/>
      <path d="M70 104 Q100 64 130 104 Q116 88 100 86 Q84 88 70 104 Z" fill="#312a4a"/>
      <path d="M78 96 Q100 78 122 96 L118 118 Q100 108 82 118 Z" fill="#181426"/>
      <path d="M84 108 L96 110 M104 110 L116 108" stroke="${c.main}" stroke-width="3"/>
      <path d="M122 132 L156 100 L160 106 L128 140 Z" fill="${c.accent}"/>
      <path d="M124 146 L148 122 L152 127 L130 152 Z" fill="${c.accent}" opacity="0.8"/>
      <path d="M72 142 L50 120 L54 116 L78 136 Z" fill="${c.main}" opacity="0.8"/>`;
  } else {
    features = `
      <path d="M58 158 Q58 104 100 96 Q142 104 142 158 Q120 144 100 154 Q80 144 58 158 Z" fill="${c.cloth}"/>
      <path d="M66 110 Q100 72 134 110 Q118 100 100 100 Q82 100 66 110 Z" fill="#3a6b4b"/>
      <ellipse cx="100" cy="114" rx="19" ry="23" fill="#22352a"/>
      <path d="M86 110 L95 110 M105 110 L114 110" stroke="${c.main}" stroke-width="3"/>
      <path d="M78 92 Q60 62 52 40 M70 86 Q54 58 44 50 M84 84 Q74 54 72 36" stroke="${c.accent}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M122 92 Q140 62 148 40 M130 86 Q146 58 156 50 M116 84 Q126 54 128 36" stroke="${c.accent}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle cx="52" cy="38" r="4" fill="${c.main}"/><circle cx="148" cy="38" r="4" fill="${c.main}"/>
      <path d="M84 154 Q100 144 116 154" stroke="${c.accent}" stroke-width="2" fill="none"/>
      <path d="M140 150 Q154 138 148 126 Q164 140 154 154 Z" fill="${c.main}" opacity="0.8"/>`;
  }
  return `<svg viewBox="0 0 200 200" class="portrait-svg" role="img" aria-label="${cls.name}">
    <defs>
      <radialGradient id="bg-${id}" cx="50%" cy="38%" r="70%">
        <stop offset="0%" stop-color="${c.glow}" stop-opacity="0.5"/>
        <stop offset="55%" stop-color="${c.cloth}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#0b0a12" stop-opacity="0.95"/>
      </radialGradient>
      <linearGradient id="rim-${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c.main}"/><stop offset="100%" stop-color="${c.accent}"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#bg-${id})"/>
    ${decorative ? `<circle cx="100" cy="100" r="88" fill="none" stroke="${c.main}" stroke-opacity="0.22" stroke-width="1.5"/>
    <circle cx="100" cy="100" r="80" fill="none" stroke="${c.accent}" stroke-opacity="0.12" stroke-width="1" stroke-dasharray="2 7"/>` : ''}
    ${features}
    <ellipse cx="100" cy="170" rx="56" ry="8" fill="#000" opacity="0.35"/>
    <path d="M100 18 L104 26 L100 34 L96 26 Z" fill="${c.main}" opacity="0.8"/>
  </svg>`;
}

export function locationEmblemSVG(loc: LocationDef): string {
  const p = loc.palette;
  const rid = loc.id.replace(/[^a-z]/g, '');
  let art = '';
  if (loc.id === 'ashen-reach') {
    art = `<path d="M0 118 L48 60 L78 92 L118 40 L170 118 Z" fill="${p.mid}"/>
      <path d="M118 40 L126 54 L112 52 Z" fill="${p.accent}"/>
      <path d="M40 118 Q85 92 130 118" stroke="${p.accent}" stroke-width="2" fill="none" opacity="0.7"/>
      <circle cx="140" cy="40" r="12" fill="${p.accent}" opacity="0.25"/>`;
  } else if (loc.id === 'whisperwood') {
    art = `<path d="M40 120 L40 48 M34 60 Q22 46 30 32 M46 56 Q58 42 50 28" stroke="${p.mid}" stroke-width="7" fill="none"/>
      <path d="M120 120 L120 60 M112 74 Q100 56 110 44 M128 70 Q142 54 132 40" stroke="${p.mid}" stroke-width="6" fill="none"/>
      <path d="M28 34 Q40 18 54 32 Q40 30 28 34Z" fill="${p.accent}" opacity="0.8"/>
      <path d="M106 46 Q120 28 138 42 Q122 40 106 46Z" fill="${p.accent}" opacity="0.6"/>
      <path d="M0 120 Q60 100 100 118 Q140 132 170 112 L170 130 L0 130Z" fill="${p.near}"/>`;
  } else if (loc.id === 'frostveil') {
    art = `<path d="M0 120 L44 48 L66 82 L104 28 L148 96 L170 66 L170 130 L0 130 Z" fill="${p.mid}"/>
      <path d="M104 28 L116 52 L96 50 Z" fill="${p.accent}" opacity="0.9"/>
      <path d="M44 48 L52 64 L36 62 Z" fill="${p.accent}" opacity="0.5"/>
      <path d="M0 84 Q40 62 80 84 Q120 106 170 74" stroke="${p.accent}" stroke-width="2" fill="none" opacity="0.3"/>`;
  } else if (loc.id === 'sunken-sanctum') {
    art = `<path d="M30 120 L30 56 Q30 44 42 40 L58 40 Q70 44 70 56 L70 120" fill="none" stroke="${p.mid}" stroke-width="9"/>
      <path d="M100 120 L100 50 Q100 36 112 36 L128 36 Q140 40 140 50 L140 120" fill="none" stroke="${p.mid}" stroke-width="7"/>
      <path d="M30 56 L80 40 L80 50 L30 66Z" fill="${p.accent}" opacity="0.4"/>
      <path d="M0 112 Q42 100 84 112 Q126 124 170 110 L170 130 L0 130Z" fill="${p.near}"/>
      <circle cx="86" cy="72" r="9" fill="none" stroke="${p.accent}" stroke-width="2" opacity="0.8"/>`;
  } else {
    art = `<path d="M76 130 L76 52 L84 36 L92 52 L92 130 Z" fill="${p.mid}"/>
      <path d="M40 130 L40 76 L46 64 L52 76 L52 130Z" fill="${p.mid}" opacity="0.8"/>
      <path d="M118 130 L118 68 L126 54 L134 68 L134 130Z" fill="${p.mid}" opacity="0.9"/>
      <path d="M84 36 L88 24 L84 10 L96 22 L92 36Z" fill="${p.accent}"/>
      <circle cx="84" cy="70" r="2.5" fill="${p.accent}"/><circle cx="84" cy="92" r="2" fill="${p.accent}"/>
      <path d="M0 118 L60 104 L120 118 L170 104 L170 130 L0 130Z" fill="${p.near}"/>`;
  }
  return `<svg viewBox="0 0 170 130" class="loc-svg" aria-hidden="true">
    <defs><linearGradient id="sky-${rid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.skyTop}"/><stop offset="100%" stop-color="${p.skyBottom}"/>
    </linearGradient></defs>
    <rect width="170" height="130" fill="url(#sky-${rid})"/>
    <circle cx="${loc.id === 'ember-throne' ? 140 : 32}" cy="30" r="28" fill="${p.accent}" opacity="0.12"/>
    ${art}
    <rect width="170" height="130" fill="none" stroke="${p.accent}" stroke-opacity="0.18"/>
  </svg>`;
}

/* ------------------------------- backgrounds ------------------------------- */

function buildBackground(loc: LocationDef): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = DESIGN_W; c.height = DESIGN_H;
  const g = c.getContext('2d')!;
  const p = loc.palette;
  const rand = rng(loc.name.length * 999 + loc.id.length * 131);
  const sky = g.createLinearGradient(0, 0, 0, DESIGN_H);
  sky.addColorStop(0, p.skyTop);
  sky.addColorStop(0.65, p.skyBottom);
  sky.addColorStop(1, p.near);
  g.fillStyle = sky;
  g.fillRect(0, 0, DESIGN_W, DESIGN_H);

  // stars
  if (loc.particle !== 'bubble') {
    for (let i = 0; i < 70; i++) {
      const x = rand() * DESIGN_W, y = rand() * 260;
      g.globalAlpha = rand() * 0.5 + 0.1;
      g.fillStyle = p.accent;
      g.fillRect(x, y, rand() < 0.85 ? 1.4 : 2.4, rand() < 0.85 ? 1.4 : 2.4);
    }
    g.globalAlpha = 1;
  }

  if (loc.id === 'ashen-reach') {
    // moon + volcano layers
    const moon = g.createRadialGradient(760, 96, 4, 760, 96, 90);
    moon.addColorStop(0, 'rgba(255,200,140,0.55)');
    moon.addColorStop(1, 'rgba(255,120,60,0)');
    g.fillStyle = moon; g.fillRect(600, 0, 340, 220);
    g.fillStyle = 'rgba(255,180,120,0.5)'; g.beginPath(); g.arc(760, 96, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = p.far;
    g.beginPath(); g.moveTo(-20, 360); g.lineTo(120, 190); g.lineTo(230, 330); g.lineTo(340, 240); g.lineTo(460, 360); g.closePath(); g.fill();
    g.fillStyle = p.mid;
    g.beginPath(); g.moveTo(360, 380); g.lineTo(520, 150); g.lineTo(600, 250); g.lineTo(680, 210); g.lineTo(790, 380); g.closePath(); g.fill();
    // volcano glow + lava
    const lava = g.createLinearGradient(520, 250, 560, 320);
    lava.addColorStop(0, 'rgba(255,200,90,0.9)'); lava.addColorStop(1, 'rgba(255,80,40,0.2)');
    g.fillStyle = lava; g.beginPath(); g.moveTo(510, 230); g.lineTo(540, 270); g.lineTo(505, 300); g.closePath(); g.fill();
    g.fillStyle = p.near;
    g.beginPath(); g.moveTo(0, 400); g.lineTo(260, 350); g.lineTo(520, 400); g.lineTo(760, 360); g.lineTo(960, 400); g.lineTo(960, 540); g.lineTo(0, 540); g.fill();
    // cracks
    for (let i = 0; i < 7; i++) {
      let x = 80 + rand() * 800, y = 400 + rand() * 100;
      g.strokeStyle = `rgba(255,${100 + rand() * 80},50,${0.15 + rand() * 0.2})`;
      g.lineWidth = 1 + rand() * 2;
      g.beginPath(); g.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (rand() - 0.5) * 60; y += rand() * 22; g.lineTo(x, y); }
      g.stroke();
    }
  } else if (loc.id === 'whisperwood') {
    // moon
    g.fillStyle = 'rgba(200,255,210,0.35)'; g.beginPath(); g.arc(760, 100, 38, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(180,255,200,0.1)'; g.beginPath(); g.arc(760, 100, 80, 0, Math.PI * 2); g.fill();
    // distant tree lines
    g.fillStyle = p.far;
    for (let i = 0; i < 22; i++) {
      const x = i * 48 + rand() * 20, h = 150 + rand() * 120;
      g.fillRect(x, 380 - h, 8 + rand() * 8, h);
      g.beginPath(); g.arc(x + 6, 380 - h, 40 + rand() * 25, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = p.mid;
    // big near trunks
    for (let i = 0; i < 4; i++) {
      const x = 90 + i * 240 + rand() * 50;
      g.beginPath(); g.moveTo(x, 540); g.lineTo(x - 18, 120); g.lineTo(x + 4, 120); g.lineTo(x + 26, 540); g.closePath(); g.fill();
      g.strokeStyle = p.mid; g.lineWidth = 7;
      for (let b = 0; b < 3; b++) {
        g.beginPath(); g.moveTo(x, 200 + b * 70); g.quadraticCurveTo(x + 80, 160 + b * 50, x + 130, 120 + b * 40); g.stroke();
      }
    }
    // hanging vines
    g.strokeStyle = 'rgba(80,160,110,0.35)'; g.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const x = rand() * 960;
      g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 12, 50, x - 4, 90 + rand() * 80); g.stroke();
    }
    // moon through the canopy
    const mg = g.createRadialGradient(505, 92, 8, 505, 92, 140);
    mg.addColorStop(0, 'rgba(220,255,228,0.5)');
    mg.addColorStop(0.25, 'rgba(180,255,205,0.18)');
    mg.addColorStop(1, 'rgba(140,255,190,0)');
    g.fillStyle = mg; g.fillRect(330, 0, 350, 260);
    g.fillStyle = 'rgba(226,255,233,0.75)';
    g.beginPath(); g.arc(505, 92, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(150,220,170,0.25)';
    g.beginPath(); g.arc(494, 84, 9, 0, Math.PI * 2); g.arc(514, 102, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = p.near; g.fillRect(0, 430, 960, 110);
    for (let i = 0; i < 10; i++) { // mushrooms
      const x = rand() * 960, y = 440 + rand() * 60;
      g.fillStyle = 'rgba(140,255,190,0.15)';
      g.beginPath(); g.ellipse(x, y, 12 + rand() * 10, 5, 0, 0, Math.PI * 2); g.fill();
    }
  } else if (loc.id === 'frostveil') {
    // aurora
    for (let i = 0; i < 3; i++) {
      const grad = g.createLinearGradient(0, 60 + i * 30, 0, 260 + i * 40);
      grad.addColorStop(0, `rgba(${90 + i * 20},${220 - i * 20},255,0)`);
      grad.addColorStop(0.5, `rgba(${90 + i * 20},${220 - i * 20},255,${0.08 - i * 0.02})`);
      grad.addColorStop(1, 'rgba(90,200,255,0)');
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(0, 120 + i * 30);
      g.bezierCurveTo(280, 40 + i * 40, 500, 200 + i * 20, 960, 80 + i * 30);
      g.lineTo(960, 250 + i * 40); g.bezierCurveTo(600, 300, 300, 180, 0, 280 + i * 30); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(220,245,255,0.5)'; g.beginPath(); g.arc(180, 90, 24, 0, Math.PI * 2); g.fill();
    // peaks
    g.fillStyle = p.far;
    g.beginPath(); g.moveTo(-40, 400); g.lineTo(120, 140); g.lineTo(250, 330); g.lineTo(390, 100); g.lineTo(540, 340); g.lineTo(650, 200); g.lineTo(820, 380); g.lineTo(960, 250); g.lineTo(1000, 400); g.closePath(); g.fill();
    g.fillStyle = 'rgba(230,250,255,0.25)';
    g.beginPath(); g.moveTo(120, 140); g.lineTo(158, 210); g.lineTo(84, 210); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(390, 100); g.lineTo(440, 190); g.lineTo(338, 190); g.closePath(); g.fill();
    g.fillStyle = p.mid;
    g.beginPath(); g.moveTo(-40, 430); g.lineTo(200, 300); g.lineTo(420, 430); g.lineTo(620, 320); g.lineTo(1000, 440); g.lineTo(1000, 540); g.lineTo(0, 540); g.closePath(); g.fill();
    // ice sheet
    const ice = g.createLinearGradient(0, 430, 0, 540);
    ice.addColorStop(0, 'rgba(160,225,255,0.16)'); ice.addColorStop(1, 'rgba(10,30,45,0.1)');
    g.fillStyle = ice; g.fillRect(0, 430, 960, 110);
    g.strokeStyle = 'rgba(200,245,255,0.12)';
    for (let i = 0; i < 6; i++) {
      g.beginPath(); g.moveTo(rand() * 960, 440); g.lineTo(rand() * 960, 540); g.stroke();
    }
  } else if (loc.id === 'sunken-sanctum') {
    // distant glow
    const glow = g.createRadialGradient(480, 200, 20, 480, 200, 400);
    glow.addColorStop(0, 'rgba(90,240,220,0.18)'); glow.addColorStop(1, 'rgba(20,80,90,0)');
    g.fillStyle = glow; g.fillRect(0, 0, 960, 540);
    // drowned columns
    const drawColumn = (x: number, w: number, h: number, alpha: number) => {
      g.globalAlpha = alpha;
      g.fillStyle = p.mid;
      g.fillRect(x, 420 - h, w, h);
      g.fillStyle = p.far;
      g.fillRect(x - 8, 420 - h - 14, w + 16, 14);
      g.fillRect(x - 8, 412, w + 16, 12);
      g.globalAlpha = 1;
    };
    drawColumn(140, 40, 230, 0.75); drawColumn(230, 28, 170, 0.5);
    drawColumn(690, 44, 260, 0.8); drawColumn(800, 26, 150, 0.45);
    // arch
    g.strokeStyle = p.far; g.lineWidth = 24; g.globalAlpha = 0.7;
    g.beginPath(); g.moveTo(360, 420); g.lineTo(360, 250); g.quadraticCurveTo(480, 170, 600, 250); g.lineTo(600, 420); g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = p.accent; g.globalAlpha = 0.12;
    g.beginPath(); g.arc(480, 270, 68, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    // ground water
    const water = g.createLinearGradient(0, 420, 0, 540);
    water.addColorStop(0, 'rgba(30,110,115,0.35)'); water.addColorStop(1, 'rgba(4,20,28,0.9)');
    g.fillStyle = water; g.fillRect(0, 420, 960, 120);
    g.strokeStyle = 'rgba(120,255,235,0.15)';
    for (let i = 0; i < 12; i++) {
      const x = rand() * 960, y = 440 + rand() * 90;
      g.beginPath(); g.ellipse(x, y, 20 + rand() * 60, 2, 0, 0, Math.PI * 2); g.stroke();
    }
    // coral & kelp silhouettes
    for (let i = 0; i < 9; i++) {
      const x = 20 + rand() * 920, h = 30 + rand() * 90;
      g.strokeStyle = `rgba(${40 + rand() * 40},${140 + rand() * 60},${130 + rand() * 60},${0.25 + rand() * 0.3})`;
      g.lineWidth = 2 + rand() * 3;
      g.beginPath();
      g.moveTo(x, 540);
      g.quadraticCurveTo(x + Math.sin(i) * 16, 540 - h * 0.6, x + Math.cos(i * 2) * 24, 540 - h);
      g.stroke();
      g.fillStyle = 'rgba(120,255,235,0.12)';
      g.beginPath(); g.arc(x + Math.cos(i * 2) * 24, 540 - h, 5 + rand() * 4, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(150,255,240,0.35)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i - 1.5) * 0.55;
      g.beginPath(); g.arc(480, 300, 70, a - 0.09, a + 0.09); g.stroke();
    }
  } else {
    // void stars + throne
    for (let i = 0; i < 4; i++) {
      const grad = g.createRadialGradient(480, 260, 10, 480, 260, 320 + i * 40);
      grad.addColorStop(0, 'rgba(255,90,190,0.06)'); grad.addColorStop(1, 'rgba(80,20,120,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 960, 540);
    }
    g.fillStyle = 'rgba(15,8,24,0.85)';
    // floating citadel spires
    const spire = (x: number, w: number, top: number, base: number) => {
      g.beginPath(); g.moveTo(x, base); g.lineTo(x + w * 0.18, top); g.lineTo(x + w * 0.5, top - 50); g.lineTo(x + w * 0.82, top); g.lineTo(x + w, base); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,120,220,0.25)'; g.lineWidth = 2; g.stroke();
    };
    g.fillStyle = p.far; spire(90, 140, 180, 430); spire(300, 100, 240, 430);
    g.fillStyle = p.mid; spire(620, 160, 150, 440); spire(800, 120, 230, 440);
    // central throne / gate
    g.fillStyle = '#09050f';
    g.beginPath(); g.moveTo(420, 440); g.lineTo(420, 260); g.lineTo(450, 220); g.lineTo(510, 220); g.lineTo(540, 260); g.lineTo(540, 440); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,180,90,0.35)'; g.stroke();
    g.strokeStyle = 'rgba(255,140,220,0.5)'; g.lineWidth = 2;
    g.beginPath(); g.arc(480, 320, 44, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(480, 320, 28, 0, Math.PI * 2); g.stroke();
    // broken chains
    g.strokeStyle = 'rgba(200,180,255,0.1)'; g.lineWidth = 3;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(100 + i * 190, 0); g.quadraticCurveTo(130 + i * 190, 120, 90 + i * 190, 240); g.stroke(); }
    g.fillStyle = p.near; g.beginPath();
    g.moveTo(0, 440); g.lineTo(180, 420); g.lineTo(380, 448); g.lineTo(600, 422); g.lineTo(800, 446); g.lineTo(960, 424); g.lineTo(960, 540); g.lineTo(0, 540); g.closePath(); g.fill();
  }

  // ground base
  const ground = g.createLinearGradient(0, 430, 0, 540);
  ground.addColorStop(0, p.ground); ground.addColorStop(1, '#050409');
  g.fillStyle = ground; g.fillRect(0, 430, 960, 110);
  g.fillStyle = p.groundLit; g.globalAlpha = 0.25; g.fillRect(0, 430, 960, 3); g.globalAlpha = 1;

  // vignette
  const vg = g.createRadialGradient(480, 280, 180, 480, 280, 620);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = vg; g.fillRect(0, 0, 960, 540);
  return c;
}

/* --------------------------------- renderer -------------------------------- */

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number;
  size: number; color: string; gravity: number; kind: 'spark' | 'ember' | 'smoke' | 'heal' | 'ring' | 'soul';
}
interface Floater { x: number; y: number; text: string; color: string; life: number; maxLife: number; size: number; vy: number; }
interface Ambient { x: number; y: number; vx: number; vy: number; size: number; phase: number; speed: number; }

export class SceneRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private bgLocId = '';
  private battle: Battle | null = null;
  location: LocationDef | null = null;
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private ambient: Ambient[] = [];
  private shake = 0;
  private flash = 0;
  private floatStacks = new Map<number, { time: number; count: number }>();
  private flashColor = '255,255,255';
  private time = 0;
  speed = 1;
  private mobileView = false;
  private lastPositions = new Map<number, { x: number; y: number }>();
  private onResize = () => this.resize();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', this.onResize);
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.mobileView = rect.width < 560;
  }

  setLocation(loc: LocationDef): void {
    if (this.bgLocId !== loc.id) {
      this.location = loc;
      this.bg = buildBackground(loc);
      this.bgLocId = loc.id;
      this.ambient = Array.from({ length: 55 }, () => this.newAmbient(true));
    }
  }

  setBattle(battle: Battle): void {
    this.battle = battle;
  }

  private newAmbient(initial = false): Ambient {
    const kind = this.location?.particle ?? 'ember';
    const x = Math.random() * DESIGN_W;
    if (kind === 'snow') return { x, y: initial ? Math.random() * DESIGN_H : -10, vx: -8 - Math.random() * 18, vy: 16 + Math.random() * 30, size: 1 + Math.random() * 2.2, phase: Math.random() * 6.28, speed: 1 + Math.random() * 2 };
    if (kind === 'bubble') return { x, y: initial ? 200 + Math.random() * 340 : 545, vx: Math.random() * 8 - 4, vy: -12 - Math.random() * 22, size: 1.5 + Math.random() * 3, phase: Math.random() * 6.28, speed: 1 + Math.random() * 2 };
    if (kind === 'spore') return { x, y: initial ? Math.random() * DESIGN_H : 540, vx: (Math.random() - 0.5) * 10, vy: -4 - Math.random() * 12, size: 1 + Math.random() * 2, phase: Math.random() * 6.28, speed: 0.5 + Math.random() };
    return { x, y: initial ? Math.random() * DESIGN_H : 545, vx: (Math.random() - 0.5) * 14, vy: -18 - Math.random() * 34, size: 1 + Math.random() * 2.4, phase: Math.random() * 6.28, speed: 1 + Math.random() * 2.5 };
  }

  unitPosition(u: Unit): { x: number; y: number; scale: number } {
    const battle = this.battle;
    if (!battle || !this.location) return { x: 480, y: 420, scale: 1 };
    if (u.side === 'hero') return { x: 235, y: 430, scale: 1.2 * (this.mobileView ? 1.28 : 1) };
    if (u.side === 'ally') {
      const i = Math.max(0, battle.allies.indexOf(u));
      return { x: 395 + i * 60, y: 452, scale: 0.75 * (this.mobileView ? 1.28 : 1) };
    }
    const i = battle.enemies.indexOf(u);
    const n = battle.enemies.length;
    const baseXs = n <= 1 ? [720] : n === 2 ? [730, 850] : [630, 750, 862];
    const x = baseXs[i] ?? 700 + i * 100;
    const y = 424 + (i % 2) * 20;
    const boost = this.mobileView ? 1.32 : 1;
    return { x, y, scale: (u.boss ? 1.02 : 1.06) * (u.scale ?? 1) * boost };
  }

  onEvent(e: CombatEvent): void {
    if (!this.battle) return;
    switch (e.type) {
      case 'damage': {
        const pos = this.unitPosition(e.target);
        const color = e.kind === 'dot' ? '#b6ff9d' : e.crit ? '#ffd977' : e.kind === 'thorns' ? '#c8b4ff' : '#fff3e0';
        if (e.amount < 0.5) {
          this.damageFloater(e.target.uid, pos.x, pos.y - 150 * pos.scale - 55, 'blocked', '#ffe09a', 15, -28);
        } else {
          this.damageFloater(e.target.uid, pos.x, pos.y - 150 * pos.scale - 55,
            e.crit ? `${Math.round(e.amount)}!` : `${Math.round(e.amount)}`,
            color, e.crit ? 30 : e.kind === 'ult' ? 26 : 20, e.crit ? -58 : -44);
        }
        const burst = e.kind === 'dot' ? 3 : e.kind === 'ult' ? 18 : e.crit ? 12 : 6;
        for (let i = 0; i < burst; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 30 + Math.random() * (e.crit ? 190 : 100);
          this.particles.push({
            x: pos.x, y: pos.y - 75 * pos.scale + (Math.random() - 0.5) * 40,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
            life: 0.4 + Math.random() * 0.5, maxLife: 0.9,
            size: 1.5 + Math.random() * 2.5, color: e.kind === 'dot' ? '#9bff7a' : e.crit ? '#ffd36b' : '#ffd9b0',
            gravity: 260, kind: 'spark',
          });
        }
        if (e.kind !== 'dot') {
          this.shake = Math.max(this.shake, e.crit ? 7 : e.kind === 'ult' ? 12 : 2.5);
          this.flash = Math.max(this.flash, e.crit ? 0.1 : 0.04);
          this.flashColor = e.kind === 'ult' ? '255,170,80' : '255,240,220';
        }
        if (e.kind === 'thorns') this.flash = Math.max(this.flash, 0.05);
        break;
      }
      case 'heal': {
        const pos = this.unitPosition(e.target);
        this.damageFloater(e.target.uid, pos.x, pos.y - 150 * pos.scale - 55, `+${Math.round(e.amount)}`, '#8dffc2', 20, -46);
        for (let i = 0; i < 8; i++) {
          this.particles.push({
            x: pos.x + (Math.random() - 0.5) * 50, y: pos.y - 30 - Math.random() * 70,
            vx: (Math.random() - 0.5) * 18, vy: -30 - Math.random() * 40,
            life: 0.6 + Math.random() * 0.5, maxLife: 1.1, size: 1.5 + Math.random() * 2,
            color: '#8dffc2', gravity: -35, kind: 'heal',
          });
        }
        break;
      }
      case 'shield': {
        const pos = this.unitPosition(e.target);
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          this.particles.push({
            x: pos.x + Math.cos(a) * 38, y: pos.y - 78 + Math.sin(a) * 56,
            vx: Math.cos(a) * 20, vy: Math.sin(a) * 20,
            life: 0.5, maxLife: 0.5, size: 2, color: '#ffe09a', gravity: 0, kind: 'heal',
          });
        }
        break;
      }
      case 'dodge': {
        const pos = this.unitPosition(e.target);
        this.damageFloater(e.target.uid, pos.x, pos.y - 150 * pos.scale - 55, 'MISS', '#c8c3d8', 18, -30);
        break;
      }
      case 'cast': {
        const pos = this.unitPosition(e.source);
        const col = this.abilityColor(e.ability.name + ' ' + e.ability.icon);
        const isUlty = e.ult || e.ability.cooldown === 0;
        if (isUlty) {
          this.flash = 0.32; this.flashColor = '255,190,120'; this.shake = 8;
          this.ring(pos.x, pos.y - 70, col, 1.2, 100, 8);
        } else {
          this.ring(pos.x, pos.y - 70, col, 0.65, 55, 4);
        }
        for (let i = 0; i < (isUlty ? 34 : 12); i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 40 + Math.random() * (isUlty ? 200 : 80);
          this.particles.push({
            x: pos.x, y: pos.y - 70, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
            life: 0.5 + Math.random() * 0.7, maxLife: 1.2, size: 1.5 + Math.random() * 3,
            color: col, gravity: 60, kind: 'ember',
          });
        }
        if (isUlty) {
          this.floaters.push({ x: pos.x, y: pos.y - 170, text: e.ability.name.toUpperCase(), color: '#ffe2a8', life: 1.6, maxLife: 1.6, size: 22, vy: -14 });
        } else if (e.source.side === 'hero') {
          // Name the skill, under the hero's feet: above the head is where the damage numbers and
          // the name plate already are, and the battle log is hidden on a phone, so without this a
          // cast is only a ring (you could not tell Shield Slam from Dawnbreaker).
          this.floaters.push({ x: pos.x, y: pos.y + 30, text: e.ability.name, color: col, life: 1.4, maxLife: 1.4, size: 14, vy: -12 });
        }
        break;
      }
      case 'summon': {
        const pos = this.unitPosition(e.unit);
        this.ring(pos.x, pos.y - 40, '#8dffc2', 0.9, 70, 5);
        break;
      }
      case 'death': {
        const pos = this.unitPosition(e.unit);
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * Math.PI * 2;
          this.particles.push({
            x: pos.x, y: pos.y - 60, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 50,
            life: 0.8 + Math.random() * 0.7, maxLife: 1.5, size: 2 + Math.random() * 2,
            color: '#c8b4ff', gravity: -20, kind: 'soul',
          });
        }
        this.floaterAt(pos.x, pos.y - 140, 'slain', '#a99cc4', 14);
        break;
      }
      case 'end':
        this.flash = e.victory ? 0.3 : 0.2;
        this.flashColor = e.victory ? '255,220,150' : '180,40,60';
        break;
    }
  }


  private damageFloater(uid: number, x: number, y: number, text: string, color: string, size: number, vy: number): void {
    const now = this.time;
    const prev = this.floatStacks.get(uid);
    const count = prev && now - prev.time < 0.5 ? prev.count + 1 : 0;
    this.floatStacks.set(uid, { time: now, count });
    this.floaters.push({
      x: x + (Math.random() - 0.5) * 34,
      y: y - Math.min(count, 4) * 21,
      text, color, life: 1.1, maxLife: 1.1, size: Math.max(15, size - count * 1.5), vy,
    });
  }

  private floaterAt(x: number, y: number, text: string, color: string, size: number): void {
    this.floaters.push({ x, y, text, color, life: 1.2, maxLife: 1.2, size, vy: -28 });
  }

  private abilityColor(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('flame') || n.includes('ember') || n.includes('cinder') || n.includes('meteor') || n.includes('dawn')) return '#ff9d4d';
    if (n.includes('frost') || n.includes('ice') || n.includes('blizzard')) return '#9fe8ff';
    if (n.includes('spirit') || n.includes('bloom') || n.includes('gaia') || n.includes('thorn') || n.includes('wolf')) return '#8dffc2';
    if (n.includes('shield') || n.includes('ward') || n.includes('unbreak') || n.includes('radiant')) return '#ffd77a';
    if (n.includes('venom') || n.includes('smoke') || n.includes('death') || n.includes('fang')) return '#b48cff';
    if (n.includes('void') || n.includes('dusk')) return '#d7a0ff';
    return '#ffd27a';
  }

  private ring(x: number, y: number, color: string, life: number, size: number, width: number): void {
    this.particles.push({ x, y, vx: 0, vy: 0, life, maxLife: life, size, color, gravity: 0, kind: 'ring' });
    this.particles.push({ x, y, vx: 0, vy: 0, life: life * 1.4, maxLife: life * 1.4, size: size * 1.7, color, gravity: 0, kind: 'ring' });
  }

  draw(dt: number, battle: Battle | null): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.battle = battle;
    this.time += dt;
    // Uniform scale, anchored to the bottom (the ground stays on the bottom edge) and centred
    // sideways, with sky filling any spare canvas. The CSS keeps the arena at 16:9 so there is
    // normally none; the old stretch-to-fit transform drew the scene wide whenever the arena was
    // not exactly 16:9 (a height-capped desktop arena, a landscape phone).
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const s = Math.min(cw / DESIGN_W, ch / DESIGN_H);
    const ox = (cw - DESIGN_W * s) / 2;
    const oy = ch - DESIGN_H * s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.location?.palette.skyTop ?? '#0a0710';
    ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(s, 0, 0, s, ox, oy);

    const shakeX = (Math.random() - 0.5) * this.shake;
    const shakeY = (Math.random() - 0.5) * this.shake;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Drawn a few pixels oversized so the shake never shows the sky fill at the edges.
    if (this.bg) ctx.drawImage(this.bg, -6, -6, DESIGN_W + 12, DESIGN_H + 12);

    // ambient particles
    const kind = this.location?.particle;
    for (const a of this.ambient) {
      a.phase += dt * a.speed;
      a.x += a.vx * dt + Math.sin(a.phase) * 6 * dt;
      a.y += a.vy * dt;
      const out = a.y < -20 || a.y > DESIGN_H + 20 || a.x < -20 || a.x > DESIGN_W + 20;
      if (out) Object.assign(a, this.newAmbient(false));
      ctx.globalAlpha = kind === 'snow' ? 0.7 : 0.5;
      ctx.fillStyle = this.location?.palette.accent ?? '#fff';
      if (kind === 'snow') {
        ctx.beginPath(); ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'bubble') {
        ctx.strokeStyle = this.location?.palette.accent ?? '#fff';
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.size * 1.6, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillRect(a.x, a.y, a.size, a.size * (kind === 'ash' ? 1.6 : 1));
      }
    }
    ctx.globalAlpha = 1;

    if (!battle) { ctx.restore(); return; }

    // ally/hero/enemy shadows + sprites
    const all = [...battle.enemies, ...battle.allies, battle.hero];
    const sorted = all.filter(u => u.alive || u.deadTime < 2.4).sort((a, b) => this.unitPosition(a).y - this.unitPosition(b).y);
    for (const u of sorted) this.drawUnit(ctx, u);
    this.drawParticles(ctx, dt);
    this.drawFloaters(ctx, dt);

    // foreground fog band
    const p = this.location?.palette;
    if (p) {
      const fog = ctx.createLinearGradient(0, 420, 0, 540);
      fog.addColorStop(0, 'rgba(0,0,0,0)');
      fog.addColorStop(1, p.fog);
      ctx.fillStyle = fog; ctx.fillRect(0, 420, 960, 120);
    }
    ctx.restore();

    if (this.flash > 0.002) {
      ctx.globalAlpha = this.flash;
      ctx.fillStyle = `rgb(${this.flashColor})`;
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
      ctx.globalAlpha = 1;
    }
    this.shake = Math.max(0, this.shake - dt * 26);
    this.flash = Math.max(0, this.flash - dt * 1.6);
  }

  private drawParticles(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      const t = p.life / p.maxLife;
      if (p.kind === 'ring') {
        ctx.globalAlpha = t * 0.7;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.2 - t), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.fillStyle = p.color;
        if (p.kind === 'soul') {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2); ctx.fill();
        } else if (p.kind === 'heal') {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2); ctx.fill();
        } else if (p.kind === 'ember') {
          ctx.shadowBlur = 8; ctx.shadowColor = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size * 1.5);
          ctx.shadowBlur = 0;
        } else {
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawFloaters(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0) { this.floaters.splice(i, 1); continue; }
      const t = f.life / f.maxLife;
      f.y += f.vy * dt;
      ctx.globalAlpha = Math.min(1, t * 2.2);
      ctx.font = `700 ${f.size}px "Trebuchet MS", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(10,6,16,0.85)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawUnit(ctx: CanvasRenderingContext2D, u: Unit): void {
    const pos = this.unitPosition(u);
    const deathT = u.alive ? 0 : Math.min(1, u.deadTime / 1.2);
    const alpha = u.alive ? Math.min(1, u.anim.spawn * 1.3) : Math.max(0, 1 - deathT);
    if (alpha <= 0) return;
    const facing = u.side === 'enemy' ? -1 : 1;
    const bob = Math.sin(this.time * 2.2 + u.uid * 1.7) * 2;
    const lunge = u.anim.attack * 26 * facing;
    const rise = (1 - u.anim.spawn) * -14;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(pos.x + lunge, pos.y + bob + rise + deathT * 14);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 46 * pos.scale, 12 * pos.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    const s = pos.scale * (1 - deathT * 0.15);
    ctx.scale(facing * s, s);
    if (!u.alive) ctx.rotate(facing * deathT * 0.5);

    // aura / statuses
    const burning = u.effects.some(e => e.kind === 'burn');
    const poisoned = u.effects.some(e => e.kind === 'poison');
    const regen = u.effects.some(e => e.kind === 'regen');
    if (burning) {
      for (let i = 0; i < 3; i++) {
        const yy = -30 - ((this.time * 60 + i * 32) % 110);
        const xx = Math.sin(this.time * 5 + i * 2 + u.uid) * 20;
        ctx.fillStyle = `rgba(255,${120 + i * 30},50,${0.5 - i * 0.1})`;
        ctx.beginPath(); ctx.arc(xx, yy, 5 - i, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (regen) {
      ctx.strokeStyle = 'rgba(140,255,190,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -60 + Math.sin(this.time * 3) * 10, 55, 80, 0, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.filter = u.anim.hit > 0.05 ? `brightness(${1 + u.anim.hit * 1.1})` : 'none';
    if (u.side === 'hero' && u.classId) this.drawHero(ctx, u.classId, u);
    else if (u.side === 'ally') this.drawCreature(ctx, 'wolf', u.colors, u, true);
    else this.drawCreature(ctx, u.body, u.colors as any, u, false);
    ctx.filter = 'none';

    if (poisoned) {
      ctx.fillStyle = 'rgba(155,255,122,0.6)';
      for (let i = 0; i < 2; i++) {
        const yy = -20 - ((this.time * 36 + i * 45) % 100);
        ctx.beginPath(); ctx.arc(Math.sin(this.time + i) * 18, yy, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (u.effects.some(e => e.kind === 'stun')) {
      ctx.fillStyle = '#ffe28a';
      for (let i = 0; i < 3; i++) {
        const a = this.time * 4 + (i * Math.PI * 2) / 3;
        ctx.beginPath(); ctx.arc(Math.cos(a) * 26, -112 + Math.sin(a) * 6, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (u.shield > 0) {
      ctx.strokeStyle = 'rgba(255,220,140,0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(0, -62, 44, 68, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,140,0.06)'; ctx.fill();
    }

    ctx.restore();

    // HP bar (unscaled, above)
    if (u.alive && u.anim.spawn > 0.3) {
      ctx.save();
      const barW = u.boss ? 130 : 86;
      const barH = u.boss ? 9 : 6;
      const bx = pos.x - barW / 2 + lunge;
      const by = pos.y - 150 * pos.scale - 20;
      ctx.globalAlpha = Math.min(1, u.anim.spawn);
      ctx.fillStyle = 'rgba(8,5,12,0.75)';
      this.roundRect(ctx, bx - 2, by - 2, barW + 4, barH + 4, 3); ctx.fill();
      const pct = Math.max(0, u.hp / u.stats.maxHp);
      const col = u.side === 'enemy' ? (u.boss ? '#ff6d7a' : '#e8664f') : '#6fe3a6';
      ctx.fillStyle = col;
      this.roundRect(ctx, bx, by, barW * pct, barH, 2); ctx.fill();
      if (u.shield > 0) {
        ctx.fillStyle = 'rgba(255,225,150,0.85)';
        const sw = barW * Math.min(1, u.shield / u.stats.maxHp);
        this.roundRect(ctx, bx, by, Math.min(barW, sw), barH, 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(bx, by, barW, 1);
      ctx.font = `${u.boss ? 12 : 10}px "Trebuchet MS", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = u.boss ? '#ffc9a6' : 'rgba(235,225,240,0.9)';
      ctx.fillText(u.name + (u.boss ? '' : ''), pos.x + lunge, by - 7);
      ctx.restore();
    }
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* --------------------------------- sprites -------------------------------- */

  private drawHero(ctx: CanvasRenderingContext2D, classId: string, u: Unit): void {
    const c = u.colors;
    const accent = c.accent ?? c.main;
    if (classId === 'warden') {
      // cape
      ctx.fillStyle = c.dark;
      ctx.beginPath(); ctx.moveTo(-22, -92); ctx.quadraticCurveTo(-48, -60, -40, 2); ctx.lineTo(14, 2); ctx.quadraticCurveTo(22, -52, 12, -92); ctx.fill();
      // legs
      ctx.fillStyle = '#2c2633';
      ctx.fillRect(-16, -38, 12, 40); ctx.fillRect(7, -38, 12, 40);
      ctx.fillStyle = '#4a4357';
      ctx.fillRect(-18, -8, 15, 10); ctx.fillRect(6, -8, 15, 10);
      // torso armor
      const g = ctx.createLinearGradient(-24, -100, 24, -40);
      g.addColorStop(0, accent); g.addColorStop(0.5, '#b9c9e8'); g.addColorStop(1, '#55617e');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-24, -92); ctx.lineTo(24, -92); ctx.lineTo(20, -38); ctx.lineTo(-20, -38); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.main;
      ctx.fillRect(-4, -92, 8, 54);
      // shoulder pauldrons
      ctx.fillStyle = c.main;
      ctx.beginPath(); ctx.ellipse(-27, -88, 14, 10, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(27, -88, 14, 10, 0.3, 0, Math.PI * 2); ctx.fill();
      // head
      ctx.fillStyle = '#e8c9a8';
      ctx.beginPath(); ctx.arc(0, -112, 16, 0, Math.PI * 2); ctx.fill();
      // helm
      const helm = ctx.createLinearGradient(0, -134, 0, -100);
      helm.addColorStop(0, '#f2f5ff'); helm.addColorStop(1, '#8f9bb8');
      ctx.fillStyle = helm;
      ctx.beginPath(); ctx.arc(0, -114, 18, Math.PI, 0); ctx.lineTo(18, -102); ctx.lineTo(-18, -102); ctx.fill();
      ctx.fillStyle = '#1b1722'; ctx.fillRect(-13, -112, 26, 5);
      ctx.fillStyle = c.main; ctx.fillRect(-2, -136, 4, 9); ctx.beginPath(); ctx.moveTo(-8, -132); ctx.lineTo(8, -132); ctx.lineTo(4, -126); ctx.lineTo(-4, -126); ctx.fill();
      // shield left
      const sg = ctx.createLinearGradient(-56, -100, -22, -50);
      sg.addColorStop(0, c.main); sg.addColorStop(1, '#7d5a2a');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.moveTo(-48, -100); ctx.lineTo(-20, -100); ctx.lineTo(-22, -68); ctx.quadraticCurveTo(-34, -46, -46, -68); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffeec0'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,250,220,0.7)';
      ctx.beginPath(); ctx.arc(-34, -83, 6, 0, Math.PI * 2); ctx.fill();
      // sword right (raise if attacking)
      const ax = u.anim.attack;
      ctx.save();
      ctx.translate(28, -66);
      ctx.rotate(-0.35 - ax * 1.1);
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(-3, -4, 6, 16);
      ctx.fillStyle = c.main; ctx.fillRect(-9, -8, 18, 5);
      const blade = ctx.createLinearGradient(0, -70, 0, -8);
      blade.addColorStop(0, '#ffffff'); blade.addColorStop(1, '#9aa8c4');
      ctx.fillStyle = blade;
      ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(4, -8); ctx.lineTo(3, -66); ctx.lineTo(0, -78); ctx.lineTo(-3, -66); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (classId === 'pyromancer') {
      // robe
      const robe = ctx.createLinearGradient(0, -100, 0, 4);
      robe.addColorStop(0, c.main); robe.addColorStop(1, c.dark);
      ctx.fillStyle = robe;
      ctx.beginPath(); ctx.moveTo(-20, -96); ctx.lineTo(20, -96); ctx.quadraticCurveTo(34, -30, 46, 2); ctx.lineTo(-46, 2); ctx.quadraticCurveTo(-34, -30, -20, -96); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,180,0.25)';
      ctx.beginPath(); ctx.moveTo(-8, -92); ctx.lineTo(4, -92); ctx.lineTo(-10, 0); ctx.lineTo(-26, 0); ctx.fill();
      // sash
      ctx.fillStyle = '#f4b04a'; ctx.fillRect(-20, -56, 40, 7);
      // hood
      ctx.fillStyle = c.dark;
      ctx.beginPath(); ctx.arc(0, -112, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b1422';
      ctx.beginPath(); ctx.ellipse(2, -108, 15, 17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.glow;
      ctx.beginPath(); ctx.arc(-4, -110, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(7, -110, 2.4, 0, Math.PI * 2); ctx.fill();
      // flame orb
      ctx.save();
      ctx.translate(32, -64);
      const fl = this.time * 6;
      ctx.shadowBlur = 22; ctx.shadowColor = c.glow;
      ctx.fillStyle = c.main;
      ctx.beginPath(); ctx.arc(0, 0, 11 + Math.sin(fl) * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff3cf';
      ctx.beginPath(); ctx.arc(1, -2, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,140,60,0.8)';
      for (let i = 0; i < 3; i++) {
        const yy = -14 - ((this.time * 44 + i * 14) % 34);
        ctx.beginPath(); ctx.arc(Math.sin(this.time * 7 + i) * 5, yy, 3.5 - i * 0.7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } else if (classId === 'shadowblade') {
      // legs
      ctx.fillStyle = '#1c1828';
      ctx.fillRect(-18, -40, 13, 42); ctx.fillRect(8, -40, 13, 42);
      // cloak
      const cloak = ctx.createLinearGradient(0, -100, 0, 2);
      cloak.addColorStop(0, '#3a3158'); cloak.addColorStop(1, '#161222');
      ctx.fillStyle = cloak;
      ctx.beginPath(); ctx.moveTo(-22, -94); ctx.lineTo(20, -94); ctx.quadraticCurveTo(38, -40, 32, 4); ctx.lineTo(-30, 4); ctx.quadraticCurveTo(-36, -46, -22, -94); ctx.fill();
      // leather armor
      ctx.fillStyle = '#2b2440';
      ctx.fillRect(-16, -88, 32, 40);
      ctx.strokeStyle = c.main; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-16, -78); ctx.lineTo(16, -70); ctx.moveTo(-16, -64); ctx.lineTo(16, -56); ctx.stroke();
      // hood
      ctx.fillStyle = '#2e2748';
      ctx.beginPath(); ctx.arc(0, -110, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#12101c';
      ctx.beginPath(); ctx.ellipse(3, -106, 14, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.ellipse(-2, -108, 3.5, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(9, -108, 3.5, 2, 0, 0, Math.PI * 2); ctx.fill();
      // daggers
      ctx.save(); ctx.translate(-26, -62); ctx.rotate(0.5); this.dagger(ctx, { ...c, accent }); ctx.restore();
      ctx.save(); ctx.translate(26, -66); ctx.rotate(-0.6 + u.anim.attack * 0.8); this.dagger(ctx, { ...c, accent }); ctx.restore();
    } else {
      // spiritcaller robe
      const robe = ctx.createLinearGradient(0, -100, 0, 4);
      robe.addColorStop(0, '#3f7a56'); robe.addColorStop(1, '#173826');
      ctx.fillStyle = robe;
      ctx.beginPath(); ctx.moveTo(-18, -95); ctx.lineTo(18, -95); ctx.quadraticCurveTo(38, -30, 40, 2); ctx.lineTo(-40, 2); ctx.quadraticCurveTo(-38, -30, -18, -95); ctx.fill();
      // leaf mantle
      ctx.fillStyle = c.main;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.ellipse(-22 + i * 11, -88 + Math.abs(i - 2) * 4, 9, 5, -0.4 + i * 0.2, 0, Math.PI * 2); ctx.fill();
      }
      // face + hood
      ctx.fillStyle = '#dfc3a3';
      ctx.beginPath(); ctx.arc(0, -112, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b5a3c';
      ctx.beginPath(); ctx.arc(0, -118, 19, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
      ctx.fillStyle = '#173826'; ctx.fillRect(-19, -120, 7, 22); ctx.fillRect(12, -120, 7, 22);
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(-6, -110, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, -110, 2.2, 0, Math.PI * 2); ctx.fill();
      // antlers
      ctx.strokeStyle = accent; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-12, -128); ctx.quadraticCurveTo(-26, -142, -22, -156);
      ctx.moveTo(-18, -136); ctx.quadraticCurveTo(-30, -140, -34, -148);
      ctx.moveTo(12, -128); ctx.quadraticCurveTo(26, -142, 22, -156);
      ctx.moveTo(18, -136); ctx.quadraticCurveTo(30, -140, 34, -148); ctx.stroke();
      ctx.fillStyle = c.main;
      [-22, 22].forEach((x, i) => { ctx.beginPath(); ctx.arc(x, -156, 3, 0, Math.PI * 2); ctx.fill(); });
      // staff
      ctx.save(); ctx.translate(30, -64);
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(0, 62); ctx.stroke();
      ctx.fillStyle = c.main; ctx.shadowBlur = 16; ctx.shadowColor = c.glow;
      ctx.beginPath(); ctx.arc(0, -44, 8, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
      // fireflies
      for (let i = 0; i < 3; i++) {
        const a = this.time * 1.4 + i * 2.1;
        ctx.fillStyle = c.main; ctx.globalAlpha = 0.5 + Math.sin(a * 2) * 0.3;
        ctx.beginPath(); ctx.arc(Math.cos(a) * 40, -60 + Math.sin(a * 1.3) * 30, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  private dagger(ctx: CanvasRenderingContext2D, c: { main: string; dark: string; glow: string; accent?: string }): void {
    ctx.fillStyle = '#3a2c22'; ctx.fillRect(-2, -2, 4, 12);
    ctx.fillStyle = c.accent ?? '#7df2c0'; ctx.fillRect(-7, -4, 14, 3);
    const g = ctx.createLinearGradient(0, -34, 0, -5);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, c.main);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(4, -5); ctx.lineTo(2, -30); ctx.lineTo(0, -38); ctx.lineTo(-2, -30); ctx.closePath(); ctx.fill();
  }

  private drawCreature(ctx: CanvasRenderingContext2D, body: BodyKind, c: { main: string; dark: string; glow: string }, u: Unit, small: boolean): void {
    const glow = c.glow;
    const eye = (x: number, y: number, r = 3.4) => {
      ctx.fillStyle = glow;
      ctx.shadowBlur = 10; ctx.shadowColor = glow;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    };
    switch (body) {
      case 'imp': {
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.ellipse(0, -38, 24, 28, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.ellipse(0, -40, 18, 22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.moveTo(-16, -58); ctx.quadraticCurveTo(-26, -74, -14, -70); ctx.quadraticCurveTo(-8, -62, -5, -58); ctx.fill();
        ctx.beginPath(); ctx.moveTo(16, -58); ctx.quadraticCurveTo(26, -74, 14, -70); ctx.quadraticCurveTo(8, -62, 5, -58); ctx.fill();
        eye(-7, -44); eye(7, -44);
        ctx.strokeStyle = c.main; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(28, -8, 22, 8); ctx.stroke();
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.moveTo(22, 8); ctx.lineTo(30, 2); ctx.lineTo(26, 12); ctx.fill();
        // wings
        ctx.fillStyle = 'rgba(255,150,80,0.3)';
        ctx.beginPath(); ctx.moveTo(-22, -52); ctx.quadraticCurveTo(-54, -80, -44, -30); ctx.quadraticCurveTo(-36, -40, -22, -40); ctx.fill();
        ctx.beginPath(); ctx.moveTo(22, -52); ctx.quadraticCurveTo(54, -80, 44, -30); ctx.quadraticCurveTo(36, -40, 22, -40); ctx.fill();
        break;
      }
      case 'hound': case 'wolf': {
        const legPhase = Math.sin(this.time * 7 + u.uid) * 4;
        ctx.strokeStyle = c.dark; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-26, -38); ctx.lineTo(-32 + legPhase, -2);
        ctx.moveTo(24, -38); ctx.lineTo(30 - legPhase, -2); ctx.stroke();
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.ellipse(-2, -52, 42, 22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.ellipse(-4, -56, 36, 18, 0, 0, Math.PI * 2); ctx.fill();
        // mane
        ctx.fillStyle = glow;
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.ellipse(-22, -54, 16, 20, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // head
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.ellipse(32, -66, 20, 15, 0.25, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.moveTo(26, -78); ctx.lineTo(20, -96); ctx.lineTo(34, -82); ctx.fill();
        ctx.beginPath(); ctx.moveTo(40, -76); ctx.lineTo(40, -96); ctx.lineTo(48, -80); ctx.fill();
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.ellipse(49, -60, 12, 7, 0.2, 0, Math.PI * 2); ctx.fill();
        if (u.boss) {
          ctx.strokeStyle = glow; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(30, -78); ctx.quadraticCurveTo(22, -96, 26, -118);
          ctx.moveTo(26, -98); ctx.quadraticCurveTo(12, -108, 8, -122);
          ctx.moveTo(24, -106); ctx.quadraticCurveTo(32, -116, 30, -128);
          ctx.moveTo(44, -78); ctx.quadraticCurveTo(54, -98, 50, -120);
          ctx.moveTo(50, -100); ctx.quadraticCurveTo(64, -108, 68, -124);
          ctx.moveTo(48, -108); ctx.quadraticCurveTo(40, -118, 42, -130);
          ctx.stroke();
          ctx.fillStyle = glow;
          [[26,-118],[8,-122],[30,-128],[50,-120],[68,-124],[42,-130]].forEach(([x,y]) => {
            ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
          });
        }
        eye(38, -70, 3);
        // tail
        ctx.strokeStyle = c.main; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(-42, -58); ctx.quadraticCurveTo(-62, -76, -56, -92); ctx.stroke();
        break;
      }
      case 'brute': case 'golem': {
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.ellipse(0, -22, 46, 22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.ellipse(0, -28, 36, 18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.ellipse(0, -74, 40, 46, 0, 0, Math.PI * 2); ctx.fill();
        // rocky plates
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.ellipse(0, -78, 30, 36, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.moveTo(-30, -92); ctx.lineTo(-14, -68); ctx.lineTo(-28, -54); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(28, -96); ctx.lineTo(18, -74); ctx.lineTo(34, -60); ctx.closePath(); ctx.fill();
        // arms
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.ellipse(-46, -60, 16, 30, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(46, -62, 16, 32, 0.2, 0, Math.PI * 2); ctx.fill();
        // head
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.ellipse(2, -116, 22, 18, 0, 0, Math.PI * 2); ctx.fill();
        eye(-6, -118, 3.6); eye(10, -118, 3.6);
        // cracks
        ctx.strokeStyle = glow; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.moveTo(-12, -96); ctx.lineTo(-4, -80); ctx.lineTo(-12, -64); ctx.moveTo(14, -84); ctx.lineTo(8, -70); ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'stalker': {
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.moveTo(-34, 0); ctx.quadraticCurveTo(-10, -110, 8, -112); ctx.quadraticCurveTo(34, -84, 32, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.moveTo(-24, 0); ctx.quadraticCurveTo(-4, -94, 10, -98); ctx.quadraticCurveTo(26, -70, 22, 0); ctx.closePath(); ctx.fill();
        // hood shape
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.ellipse(8, -104, 18, 23, 0, 0, Math.PI * 2); ctx.fill();
        eye(2, -108, 3.2); eye(15, -108, 3.2);
        // thorn arms
        ctx.strokeStyle = c.main; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-18, -74); ctx.lineTo(-44, -50); ctx.lineTo(-38, -38);
        ctx.moveTo(20, -74); ctx.lineTo(44, -52); ctx.lineTo(40, -40); ctx.stroke();
        ctx.fillStyle = glow; ctx.globalAlpha = 0.5;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-34 + i * 20, -10 + Math.sin(this.time * 2 + i) * 4, 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
        break;
      }
      case 'revenant': {
        // drowned priest: tattered robe, coral growths, staff
        const sway = Math.sin(this.time * 1.8 + u.uid) * 3;
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.moveTo(-26 + sway, 0); ctx.quadraticCurveTo(-22, -68, -14, -94); ctx.lineTo(16, -94); ctx.quadraticCurveTo(26, -60, 26 + sway, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c.main; ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.moveTo(-16 + sway, 0); ctx.quadraticCurveTo(-12, -60, -8, -86); ctx.lineTo(10, -86); ctx.quadraticCurveTo(16, -50, 16 + sway, 0); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        // tattered hem
        ctx.fillStyle = c.dark;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath(); ctx.moveTo(-22 + i * 12, 0); ctx.lineTo(-16 + i * 12, -16 - (i % 2) * 8); ctx.lineTo(-8 + i * 12, 0); ctx.fill();
        }
        // hood + face
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.ellipse(0, -94, 20, 26, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#132b30';
        ctx.beginPath(); ctx.ellipse(2, -90, 13, 17, 0, 0, Math.PI * 2); ctx.fill();
        eye(-5, -93, 2.8); eye(8, -93, 2.8);
        // coral halo / fins
        ctx.strokeStyle = glow; ctx.globalAlpha = 0.5; ctx.lineWidth = 2.5;
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI + i * 0.45;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * 22, -94 + Math.sin(a) * 24);
          ctx.quadraticCurveTo(Math.cos(a) * 38, -112 + Math.sin(a) * 10, Math.cos(a) * 46, -104 + Math.sin(a) * 18); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // barnacle orbs
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = c.main;
          ctx.beginPath(); ctx.arc(-12 + i * 9, -50 + Math.sin(this.time * 2 + i) * 3, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        // staff
        ctx.strokeStyle = c.dark; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(28, -110); ctx.lineTo(32, 16); ctx.stroke();
        ctx.fillStyle = glow; ctx.shadowBlur = 14; ctx.shadowColor = glow;
        ctx.beginPath(); ctx.arc(27, -116, 7, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      case 'wisp': {
        ctx.shadowBlur = 24; ctx.shadowColor = glow;
        const g = ctx.createRadialGradient(0, -70, 4, 0, -70, 34);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, c.main); g.addColorStop(1, 'rgba(140,255,180,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, -70, 34, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = c.dark;
        for (let i = 0; i < 4; i++) {
          ctx.globalAlpha = 0.5;
          ctx.beginPath(); ctx.ellipse(0, -38 + i * 5, 4 + i * 2, 12, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        eye(-8, -72, 2.5); eye(8, -72, 2.5);
        break;
      }
      case 'treant': {
        ctx.strokeStyle = c.dark; ctx.lineWidth = 13; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-16, -20); ctx.lineTo(-20, 0); ctx.moveTo(14, -20); ctx.lineTo(20, 0); ctx.stroke();
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.moveTo(-26, -14); ctx.lineTo(-22, -100); ctx.lineTo(18, -106); ctx.lineTo(28, -12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.moveTo(-16, -20); ctx.lineTo(-12, -92); ctx.lineTo(12, -96); ctx.lineTo(18, -20); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = c.main; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(-14, -70); ctx.quadraticCurveTo(-50, -84, -44, -58);
        ctx.moveTo(12, -74); ctx.quadraticCurveTo(48, -90, 44, -60); ctx.stroke();
        // face
        eye(-6, -80, 2.6); eye(6, -80, 2.6);
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.ellipse(0, -66, 8, 5, 0, 0, Math.PI); ctx.fill();
        // foliage
        ctx.fillStyle = glow; ctx.globalAlpha = 0.55;
        for (let i = 0; i < 7; i++) {
          const a = i / 7 * Math.PI * 2;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 26, -106 + Math.sin(a) * 12, 14, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'wraith': {
        const sway = Math.sin(this.time * 2 + u.uid) * 5;
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.moveTo(-8, -10);
        ctx.quadraticCurveTo(-40, -60, -22, -96);
        ctx.quadraticCurveTo(0, -122, 22, -96);
        ctx.quadraticCurveTo(40, -60, 8, -10);
        ctx.quadraticCurveTo(0, -24, -8, -10);
        ctx.fill();
        ctx.fillStyle = c.main; ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.ellipse(0, -72, 20, 36, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.ellipse(0, -104, 17, 21, 0, 0, Math.PI * 2); ctx.fill();
        eye(-6, -108, 3); eye(7, -108, 3);
        ctx.strokeStyle = glow; ctx.globalAlpha = 0.3; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.ellipse(0, -60 + i * 16, 26 + i * 8, 8, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'crab': {
        // legs
        ctx.strokeStyle = c.dark; ctx.lineWidth = 4;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath(); ctx.moveTo(i * 14, -34); ctx.lineTo(i * 22, 0); ctx.stroke();
        }
        // shell
        const g = ctx.createLinearGradient(0, -90, 0, -20);
        g.addColorStop(0, c.main); g.addColorStop(1, c.dark);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(0, -48, 54, 38, 0, Math.PI, 0); ctx.lineTo(40, -28); ctx.quadraticCurveTo(0, -16, -40, -28); ctx.fill();
        // claws
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.ellipse(-64, -70, 18, 12, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(64, -70, 18, 12, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.moveTo(-74, -78); ctx.lineTo(-58, -62); ctx.lineTo(-80, -60); ctx.fill();
        ctx.beginPath(); ctx.moveTo(74, -78); ctx.lineTo(58, -62); ctx.lineTo(80, -60); ctx.fill();
        // eye
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -66, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.dark; ctx.beginPath(); ctx.arc(0, -66, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -66, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = c.main; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, -66, 22, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'sentinel': {
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-34, -54); ctx.lineTo(-26, -94); ctx.lineTo(0, -112); ctx.lineTo(26, -94); ctx.lineTo(34, -54); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(-24, -58); ctx.lineTo(-18, -88); ctx.lineTo(0, -100); ctx.lineTo(18, -88); ctx.lineTo(24, -58); ctx.closePath(); ctx.fill();
        // coral spikes
        ctx.strokeStyle = glow; ctx.lineWidth = 5; ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.5;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * 20, -70 + Math.sin(a) * 30);
          ctx.lineTo(Math.cos(a) * 40, -70 + Math.sin(a) * 50); ctx.stroke();
          ctx.fillStyle = c.main; ctx.beginPath(); ctx.arc(Math.cos(a) * 40, -70 + Math.sin(a) * 50, 5, 0, Math.PI * 2); ctx.fill();
        }
        eye(0, -70, 5);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, -68, 30, 40, 0, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'knight': {
        // legs
        ctx.fillStyle = c.dark; ctx.fillRect(-18, -36, 14, 38); ctx.fillRect(8, -36, 14, 38);
        // cape
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.moveTo(-16, -92); ctx.quadraticCurveTo(-46, -50, -36, 0); ctx.lineTo(0, 0); ctx.fill();
        // torso
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.moveTo(-24, -94); ctx.lineTo(24, -94); ctx.lineTo(18, -36); ctx.lineTo(-18, -36); ctx.fill();
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.moveTo(-18, -90); ctx.lineTo(18, -90); ctx.lineTo(14, -46); ctx.lineTo(-14, -46); ctx.fill();
        // pauldrons
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.ellipse(-26, -88, 13, 11, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(26, -88, 13, 11, 0.2, 0, Math.PI * 2); ctx.fill();
        // helm
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.arc(0, -112, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.arc(0, -114, 17, Math.PI, 0); ctx.lineTo(17, -102); ctx.lineTo(-17, -102); ctx.fill();
        eye(-7, -112, 2.5); eye(7, -112, 2.5);
        // crown/horns
        ctx.strokeStyle = glow; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-14, -128); ctx.quadraticCurveTo(-24, -146, -12, -156);
        ctx.moveTo(14, -128); ctx.quadraticCurveTo(24, -146, 12, -156); ctx.stroke();
        // sword
        ctx.save(); ctx.translate(30, -66); ctx.rotate(-0.4 + u.anim.attack * 0.9);
        ctx.fillStyle = '#3a2c22'; ctx.fillRect(-3, -6, 6, 22);
        const blade = ctx.createLinearGradient(0, -74, 0, -6);
        blade.addColorStop(0, '#fff'); blade.addColorStop(1, c.main);
        ctx.fillStyle = blade;
        ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(5, -8); ctx.lineTo(4, -66); ctx.lineTo(0, -84); ctx.lineTo(-4, -66); ctx.closePath(); ctx.fill();
        ctx.restore();
        if (u.boss) {
          ctx.fillStyle = glow; ctx.globalAlpha = 0.7;
          for (let i = 0; i < 4; i++) {
            const yy = -30 - ((this.time * 50 + i * 30) % 120);
            ctx.beginPath(); ctx.arc(Math.sin(this.time * 3 + i) * 24, yy, 3, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'seraph': {
        // wings
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        for (let side = -1; side <= 1; side += 2) {
          ctx.beginPath();
          ctx.moveTo(side * 14, -100);
          ctx.quadraticCurveTo(side * 78, -150, side * 94, -72);
          ctx.quadraticCurveTo(side * 60, -88, side * 26, -54);
          ctx.fill();
          ctx.strokeStyle = glow; ctx.globalAlpha = 0.3; ctx.lineWidth = 1.5;
          for (let i = 1; i <= 3; i++) {
            ctx.beginPath(); ctx.moveTo(side * 18, -94);
            ctx.quadraticCurveTo(side * (46 + i * 12), -124 + i * 6, side * (80 - i * 8), -82 + i * 8); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        // robe
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.moveTo(-22, -96); ctx.lineTo(22, -96); ctx.lineTo(30, 0); ctx.lineTo(-30, 0); ctx.fill();
        ctx.fillStyle = c.main; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.moveTo(-14, -92); ctx.lineTo(14, -92); ctx.lineTo(18, -12); ctx.lineTo(-18, -12); ctx.fill();
        ctx.globalAlpha = 1;
        // head + halo
        ctx.fillStyle = '#efe6ff';
        ctx.beginPath(); ctx.arc(0, -112, 14, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = glow; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, -132, 20, 6, 0, 0, Math.PI * 2); ctx.stroke();
        eye(-5, -113, 2); eye(5, -113, 2);
        // spear
        ctx.strokeStyle = c.main; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(30, -130); ctx.lineTo(30, 20); ctx.stroke();
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.moveTo(30, -150); ctx.lineTo(38, -132); ctx.lineTo(30, -136); ctx.lineTo(22, -132); ctx.fill();
        break;
      }
      case 'wyrm': {
        // wings
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.moveTo(0, -80); ctx.quadraticCurveTo(-70, -140, -82, -58); ctx.quadraticCurveTo(-52, -82, -12, -62); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, -80); ctx.quadraticCurveTo(70, -140, 82, -58); ctx.quadraticCurveTo(52, -82, 12, -62); ctx.fill();
        ctx.strokeStyle = glow; ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-12, -76); ctx.quadraticCurveTo(-44, -108, -66, -72);
        ctx.moveTo(12, -76); ctx.quadraticCurveTo(44, -108, 66, -72); ctx.stroke();
        ctx.globalAlpha = 1;
        // body
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.ellipse(-6, -42, 40, 34, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.ellipse(-14, -38, 24, 24, 0, 0, Math.PI * 2); ctx.fill();
        // neck + head
        ctx.strokeStyle = c.main; ctx.lineWidth = 18; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(18, -54); ctx.quadraticCurveTo(40, -100, 36, -124); ctx.stroke();
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.ellipse(42, -130, 24, 15, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.moveTo(48, -140); ctx.lineTo(44, -156); ctx.lineTo(58, -142); ctx.fill();
        eye(48, -132, 3.2);
        // tail
        ctx.strokeStyle = c.main; ctx.lineWidth = 12;
        ctx.beginPath(); ctx.moveTo(-40, -34); ctx.quadraticCurveTo(-70, -20, -74, 4); ctx.stroke();
        break;
      }
      case 'king': {
        // cape
        const cape = ctx.createLinearGradient(0, -110, 0, 10);
        cape.addColorStop(0, c.dark); cape.addColorStop(1, '#0c0712');
        ctx.fillStyle = cape;
        ctx.beginPath(); ctx.moveTo(-26, -100); ctx.quadraticCurveTo(-80, -40, -62, 14); ctx.lineTo(62, 14); ctx.quadraticCurveTo(80, -40, 26, -100); ctx.fill();
        // legs
        ctx.fillStyle = '#241a2e'; ctx.fillRect(-20, -40, 15, 48); ctx.fillRect(8, -40, 15, 48);
        // armor
        ctx.fillStyle = '#2a1c36';
        ctx.beginPath(); ctx.moveTo(-28, -98); ctx.lineTo(28, -98); ctx.lineTo(22, -36); ctx.lineTo(-22, -36); ctx.fill();
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.moveTo(-18, -94); ctx.lineTo(18, -94); ctx.lineTo(14, -44); ctx.lineTo(-14, -44); ctx.fill();
        ctx.fillStyle = '#1b1024';
        ctx.beginPath(); ctx.moveTo(0, -92); ctx.lineTo(6, -76); ctx.lineTo(0, -58); ctx.lineTo(-6, -76); ctx.fill();
        // pauldrons spikes
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.moveTo(-30, -96); ctx.lineTo(-48, -112); ctx.lineTo(-26, -80); ctx.fill();
        ctx.beginPath(); ctx.moveTo(30, -96); ctx.lineTo(48, -112); ctx.lineTo(26, -80); ctx.fill();
        // head
        ctx.fillStyle = '#e0c2a2';
        ctx.beginPath(); ctx.arc(0, -116, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.arc(0, -120, 18, Math.PI, 0); ctx.fill();
        eye(-5, -116, 3); eye(6, -116, 3);
        // burning crown
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.moveTo(-22, -130); ctx.lineTo(-16, -150); ctx.lineTo(-6, -136); ctx.lineTo(0, -158); ctx.lineTo(8, -136); ctx.lineTo(18, -150); ctx.lineTo(22, -130); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 18; ctx.shadowColor = glow;
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = `rgba(255,${90 + i * 30},80,${0.5 - i * 0.1})`;
          ctx.beginPath(); ctx.arc(-18 + i * 12, -142 - Math.sin(this.time * 4 + i) * 6, 5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;
        // greatsword
        ctx.save(); ctx.translate(40, -58); ctx.rotate(-0.25 + u.anim.attack * 0.7);
        ctx.fillStyle = '#2a1c20'; ctx.fillRect(-4, -10, 8, 26);
        const bg = ctx.createLinearGradient(0, -100, 0, -8);
        bg.addColorStop(0, '#ffd9a0'); bg.addColorStop(0.5, c.main); bg.addColorStop(1, '#5a3a2a');
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.moveTo(-7, -8); ctx.lineTo(7, -8); ctx.lineTo(5, -84); ctx.lineTo(0, -104); ctx.lineTo(-5, -84); ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }
      default: {
        ctx.fillStyle = c.dark;
        ctx.beginPath(); ctx.ellipse(0, -50, 26, 34, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.ellipse(0, -54, 17, 24, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(-5, -58, 2.5, 0, Math.PI * 2); ctx.arc(5, -58, 2.5, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
  }
}
