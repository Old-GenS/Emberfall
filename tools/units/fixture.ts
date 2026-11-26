import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { UNIT_ART_IDS } from './ids';
import { CLASSES, LOCATIONS } from '../../src/data';

interface UnitColors {
  main: string;
  dark: string;
}

type FigureKind = 'upright' | 'quadruped';

const QUADRUPEDS = new Set([
  'ash-hound',
  'rime-wolf',
  'spirit-wolf',
  'pale-stag',
  'dusk-wyrm',
]);

function hexRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function backgroundColor(main: string): string {
  const { r, g, b } = hexRgb(main);
  return g > r && g > b ? '#ff00ff' : '#00ff00';
}

function unitColors(): Map<string, UnitColors> {
  const map = new Map<string, UnitColors>();
  for (const cls of CLASSES) {
    map.set(cls.id, { main: cls.colors.main, dark: cls.colors.cloth });
  }
  for (const location of LOCATIONS) {
    for (const enemy of location.enemies) {
      map.set(enemy.id, { main: enemy.colors.main, dark: enemy.colors.dark });
    }
    map.set(location.boss.id, { main: location.boss.colors.main, dark: location.boss.colors.dark });
  }
  map.set('spirit-wolf', { main: '#6ef2b1', dark: '#1e5c40' });
  return map;
}

function gradient(main: string, dark: string): string {
  return `<radialGradient id="g" cx="42%" cy="32%" r="82%">
      <stop offset="0%" stop-color="${main}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </radialGradient>`;
}

function upright(outline: boolean): string {
  const fill = outline ? '#141018' : 'url(#g)';
  const edge = outline ? ' stroke="#141018" stroke-width="6"' : '';
  const arm = outline ? '#141018' : 'url(#g)';
  const upperArmWidth = outline ? 52 : 46;
  const forearmWidth = outline ? 21 : 15;
  return `<ellipse cx="512" cy="560" rx="150" ry="210" fill="${fill}"${edge}/>
    <rect x="420" y="690" width="64" height="300" rx="30" fill="${fill}"${edge}/>
    <rect x="540" y="690" width="64" height="300" rx="30" fill="${fill}"${edge}/>
    <circle cx="512" cy="280" r="92" fill="${fill}"${edge}/>
    <line x1="635" y1="505" x2="740" y2="445" stroke="${arm}" stroke-width="${upperArmWidth}" stroke-linecap="round"/>
    <line x1="740" y1="445" x2="880" y2="395" stroke="${arm}" stroke-width="${forearmWidth}" stroke-linecap="round"/>`;
}

function quadruped(outline: boolean): string {
  const fill = outline ? '#141018' : 'url(#g)';
  const edge = outline ? ' stroke="#141018" stroke-width="6"' : '';
  const tail = outline ? '#141018' : 'url(#g)';
  const tailWidth = outline ? 40 : 34;
  return `<line x1="265" y1="575" x2="175" y2="500" stroke="${tail}" stroke-width="${tailWidth}" stroke-linecap="round"/>
    <ellipse cx="500" cy="600" rx="280" ry="120" fill="${fill}"${edge}/>
    <rect x="290" y="700" width="56" height="290" rx="27" fill="${fill}"${edge}/>
    <rect x="390" y="700" width="56" height="290" rx="27" fill="${fill}"${edge}/>
    <rect x="610" y="700" width="56" height="290" rx="27" fill="${fill}"${edge}/>
    <rect x="710" y="700" width="56" height="290" rx="27" fill="${fill}"${edge}/>
    <circle cx="790" cy="520" r="85" fill="${fill}"${edge}/>`;
}

function vines(kind: FigureKind): string {
  const paths = kind === 'quadruped'
    ? [
        'M 500 600 C 400 660 300 700 180 740',
        'M 450 560 C 330 480 230 440 130 400',
        'M 600 660 C 620 760 700 800 820 860',
      ]
    : [
        'M 512 470 C 640 430 760 470 880 420',
        'M 470 620 C 330 640 220 700 150 760',
        'M 512 340 C 600 280 720 280 820 320',
      ];
  return paths
    .map(d => `<path d="${d}" fill="none" stroke="#141018" stroke-width="2" stroke-linecap="round"/>`)
    .join('\n    ');
}

function figureSvg(id: string, colors: UnitColors, kind: FigureKind, attack: boolean): string {
  const bg = backgroundColor(colors.main);
  const body = (outline: boolean): string =>
    kind === 'quadruped' ? quadruped(outline) : upright(outline);
  const transform = attack ? ' rotate(15 512 990)' : '';
  const outline = bg === '#ff00ff';
  const shadow = bg === '#00ff00';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"${bg === '#00ff00' ? ' shape-rendering="crispEdges"' : ''}>
  <defs>${gradient(colors.main, colors.dark)}</defs>
  <rect width="1024" height="1024" fill="${bg}"/>
  ${shadow ? '<ellipse cx="512" cy="1013" rx="210" ry="23" fill="#0a6e0a"/>' : ''}
  ${outline ? `<g transform="${transform}">${body(true)}</g>` : ''}
  <g transform="${transform}">${body(false)}</g>
  ${outline ? vines(kind) : ''}
</svg>`;
}

async function main(): Promise<void> {
  const positional = process.argv.slice(2).filter(arg => arg !== '--');
  if (positional.length === 0) {
    console.error('usage: units:fixture -- <output-dir>');
    process.exitCode = 1;
    return;
  }
  if (positional.length > 1) {
    console.warn(`warn: ignoring extra arguments ${positional.slice(1).join(' ')}`);
  }
  const outDir = positional[0]!;
  await fs.mkdir(outDir, { recursive: true });

  const colors = unitColors();
  const jobs: Array<{ name: string; id: string; attack: boolean }> = UNIT_ART_IDS.map(id => ({
    name: id,
    id,
    attack: false,
  }));
  jobs.push({ name: 'warden-attack', id: 'warden', attack: true });

  for (const job of jobs) {
    const unit = colors.get(job.id);
    if (!unit) throw new Error(`no colours for unit ${job.id}`);
    const kind: FigureKind = QUADRUPEDS.has(job.id) ? 'quadruped' : 'upright';
    const svg = figureSvg(job.id, unit, kind, job.attack);
    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(outDir, `${job.name}.png`));
  }

  console.log(`fixture: wrote ${jobs.length} images to ${outDir}`);
}

void main();
