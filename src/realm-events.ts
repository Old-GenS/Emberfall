import type { Battle } from './combat';
import type { ParticleKind } from './data';

/** Every realm event runs for this long, then leaves a spark behind. */
const EVENT_DURATION = 2.5;
/** Realm events are background flavour: everything they draw is scaled down to this opacity. */
const EVENT_INTENSITY = 0.55;
/** How long a spark stays tappable before it fades away. */
const SPARK_LIFETIME = 5;
/** The spark's tap radius in design pixels. */
export const SPARK_RADIUS = 34;

const EVENT_NAMES: Record<ParticleKind, string> = {
  ember: 'Ember Rain',
  spore: 'Spore Bloom',
  snow: 'Shardfall',
  bubble: 'Tide Surge',
  ash: 'Void Rift',
};

const KINDS: ParticleKind[] = ['ember', 'spore', 'snow', 'bubble', 'ash'];

interface FxParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  color: string;
  /** Spore puff origin / bubble origin. */
  originX: number;
  originY: number;
  /** Ash swirl state. */
  angle: number;
  radius: number;
  spin: number;
}

interface ArenaEvent {
  kind: ParticleKind;
  age: number;
  particles: FxParticle[];
  puffs: { x: number; y: number; r: number }[];
  seed: number;
  /** Void Rift: jagged offsets along the tear, top to bottom. */
  crack: number[];
  /** Shardfall: glints where shards strike the floor. */
  impacts: { x: number; y: number; age: number; size: number }[];
}

interface Spark {
  x: number;
  y: number;
  age: number;
}

interface FxRing {
  x: number;
  y: number;
  age: number;
  life: number;
  color: string;
}

interface FxFloater {
  x: number;
  y: number;
  age: number;
  life: number;
  text: string;
  color: string;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Realm-flavoured visual events plus the single tappable spark they leave behind.
 * Everything here is visual only except the +15 ultimate charge awarded by `hit`.
 */
export class RealmEvents {
  private kind: ParticleKind;
  private accent: string;
  private clock = 0;
  private nextAt = 15;
  private index = 0;
  private current: ArenaEvent | null = null;
  private _spark: Spark | null = null;
  private _eventsPlayed = 0;
  private rings: FxRing[] = [];
  private floaters: FxFloater[] = [];

  constructor(kind: ParticleKind, accent: string) {
    this.kind = kind;
    this.accent = accent;
  }

  get spark(): { x: number; y: number; age: number } | null {
    return this._spark;
  }

  get eventsPlayed(): number {
    return this._eventsPlayed;
  }

  /** Trigger an event immediately (debug hook); with no kind, pick a random one. */
  forceEvent(kind?: ParticleKind): void {
    const chosen = kind ?? KINDS[Math.floor(Math.random() * KINDS.length)];
    if (this.current) this.finishCurrent();
    this.start(chosen, this.clock);
  }

  update(dt: number, battle: Battle): void {
    this.clock = battle.elapsed;
    for (const ring of this.rings) ring.age += dt;
    this.rings = this.rings.filter((r) => r.age < r.life);
    for (const f of this.floaters) {
      f.age += dt;
      f.y -= 26 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.age < f.life);

    if (this._spark) {
      this._spark.age += dt;
      if (this._spark.age >= SPARK_LIFETIME) this._spark = null;
    }

    if (this.current) {
      this.current.age += dt;
      this.stepParticles(this.current, dt);
      if (this.current.age >= EVENT_DURATION) this.finishCurrent();
    }

    // Nothing new is scheduled once the battle is over; the last visuals finish naturally.
    if (!battle.ended && this.clock >= this.nextAt) {
      const chosen = KINDS[Math.floor(Math.random() * KINDS.length)];
      this.start(chosen, this.clock);
    }
  }

  hit(x: number, y: number): boolean {
    const spark = this._spark;
    if (!spark) return false;
    const bob = Math.sin(spark.age * 3) * 4;
    const dx = x - spark.x;
    const dy = y - (spark.y + bob);
    if (dx * dx + dy * dy > SPARK_RADIUS * SPARK_RADIUS) return false;
    this.rings.push({ x: spark.x, y: spark.y + bob, age: 0, life: 0.65, color: this.accent });
    this.floaters.push({
      x: spark.x,
      y: spark.y - 34 + bob,
      age: 0,
      life: 1.2,
      text: '+15 Ultimate',
      color: this.accent,
    });
    this._spark = null;
    return true;
  }

  private finishCurrent(): void {
    this.current = null;
    if (!this._spark) this.spawnSpark();
  }

  private spawnSpark(): void {
    this._spark = { x: rand(300, 660), y: rand(300, 420), age: 0 };
  }

  private start(kind: ParticleKind, at: number): void {
    this._eventsPlayed++;
    this.current = this.buildEvent(kind);
    // 20 s base, nudged by a short repeating pattern so events are not metronomic.
    const interval = 20 + ((this.index * 7) % 5) - 2;
    this.index++;
    this.nextAt = at + interval;
  }

  private buildEvent(kind: ParticleKind): ArenaEvent {
    const particles: FxParticle[] = [];
    const puffs: { x: number; y: number; r: number }[] = [];
    const push = (partial: Partial<FxParticle> & Pick<FxParticle, 'x' | 'y'>) => {
      particles.push({
        vx: 0, vy: 0, size: 2, phase: Math.random() * Math.PI * 2,
        color: this.accent, originX: partial.x, originY: partial.y,
        angle: 0, radius: 0, spin: 0, ...partial,
      });
    };

    if (kind === 'ember') {
      for (let i = 0; i < 40; i++) {
        push({
          x: rand(-140, 1060), y: rand(-360, 500),
          vx: rand(55, 130), vy: rand(120, 230),
          size: rand(1.6, 4.2), color: i % 4 === 0 ? '#ffe7a8' : '#ff8a3c',
        });
      }
    } else if (kind === 'spore') {
      for (let i = 0; i < 6; i++) {
        const ox = rand(80, 880);
        const oy = rand(430, 470);
        puffs.push({ x: ox, y: oy, r: rand(16, 34) });
        for (let s = 0; s < 9; s++) {
          push({
            x: ox + rand(-18, 18), y: oy - rand(0, 26),
            vx: rand(-24, 24), vy: rand(-46, -14),
            size: rand(1.4, 3.6), color: s % 3 === 0 ? '#e7ffd4' : '#6ef2b1',
            originX: ox, originY: oy,
          });
        }
      }
    } else if (kind === 'snow') {
      for (let i = 0; i < 34; i++) {
        // originY is the floor height this shard shatters on.
        push({
          x: rand(20, 940), y: rand(-520, 260),
          vx: rand(-10, 10), vy: rand(380, 560),
          size: rand(3.5, 8), color: i % 3 === 0 ? '#ffffff' : '#bff1ff',
          originY: rand(410, 500), angle: rand(-0.12, 0.12),
        });
      }
    } else if (kind === 'bubble') {
      for (let i = 0; i < 34; i++) {
        push({
          x: rand(-100, 1000), y: rand(390, 540),
          vx: rand(-6, 10), vy: rand(-70, -24),
          size: rand(1.8, 5), color: i % 4 === 0 ? '#c9fff6' : '#4fe0cf',
        });
      }
    } else {
      for (let i = 0; i < 48; i++) {
        push({
          x: 480, y: 252,
          size: rand(1.4, 3.6), color: i % 3 === 0 ? '#f1d6ff' : '#9a66ff',
          angle: rand(0, Math.PI * 2), radius: rand(40, 190), spin: rand(1.2, 2.6),
        });
      }
    }
    const crack: number[] = [];
    for (let i = 0; i <= 12; i++) crack.push(i === 0 || i === 12 ? 0 : rand(-13, 13));
    return { kind, age: 0, particles, puffs, seed: Math.random() * 1000, crack, impacts: [] };
  }

  private stepParticles(ev: ArenaEvent, dt: number): void {
    for (const im of ev.impacts) im.age += dt;
    ev.impacts = ev.impacts.filter((im) => im.age < 0.5);
    for (const p of ev.particles) {
      if (ev.kind === 'ash') {
        // Ash is pulled into the rift: spiralling in, faster as it nears the tear.
        p.angle += p.spin * dt * (1 + 60 / (p.radius + 20));
        p.radius -= (36 + 2200 / (p.radius + 30)) * dt;
        if (p.radius < 10) { p.radius = rand(150, 200); p.angle = rand(0, Math.PI * 2); }
        p.x = 480 + Math.cos(p.angle) * p.radius;
        p.y = 252 + Math.sin(p.angle) * p.radius * 0.55;
      } else if (ev.kind === 'snow') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y >= p.originY) {
          ev.impacts.push({ x: p.x, y: p.originY, age: 0, size: p.size });
          // Only re-drop while there is time for the shard to land again.
          if (ev.age < EVENT_DURATION - 0.9) { p.y -= rand(520, 700); p.x = rand(20, 940); }
          else p.y = 9999;
        }
      } else if (ev.kind === 'spore') {
        p.phase += dt * 2;
        p.x += p.vx * dt + Math.sin(p.phase) * 12 * dt;
        p.y += p.vy * dt;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      if (ev.kind === 'ember') {
        if (p.y > 560) { p.y -= 620; p.x -= 120; }
        if (p.x > 1010) p.x -= 1080;
        if (p.x < -60) p.x += 1080;
      } else if (ev.kind === 'bubble') {
        if (p.y < -20) { p.y = 548; p.x = rand(-100, 1000); }
      } else if (ev.kind === 'spore') {
        if (p.y < -30) { p.x = p.originX + rand(-14, 14); p.y = p.originY; }
      }
    }
  }

  /* --------------------------------- DRAW ---------------------------------- */

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    const ev = this.current;
    if (ev) this.drawEvent(ctx, ev, time);
    if (this._spark) this.drawSpark(ctx, this._spark, time);
    for (const ring of this.rings) this.drawRing(ctx, ring);
    for (const f of this.floaters) this.drawFloater(ctx, f);
  }

  private drawEvent(ctx: CanvasRenderingContext2D, ev: ArenaEvent, time: number): void {
    ctx.save();
    ctx.globalAlpha = EVENT_INTENSITY;
    if (ev.kind === 'ember') {
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ev.particles) {
        const a = 0.55 + 0.35 * Math.sin(time * 7 + p.phase);
        ctx.globalAlpha = EVENT_INTENSITY * (Math.max(0.2, a));
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 2.1, -0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (ev.kind === 'snow') {
      const fade = ev.age > EVENT_DURATION - 0.4 ? Math.max(0, (EVENT_DURATION - ev.age) / 0.4) : 1;
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ev.particles) {
        if (p.y > 900) continue;
        const w = p.size;
        const len = p.size * 5.5;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        // Motion streak above the shard.
        ctx.globalAlpha = EVENT_INTENSITY * (0.32 * fade);
        const streak = ctx.createLinearGradient(0, -len * 3.2, 0, -len * 0.5);
        streak.addColorStop(0, 'rgba(159,232,255,0)');
        streak.addColorStop(1, 'rgba(200,245,255,0.9)');
        ctx.strokeStyle = streak;
        ctx.lineWidth = w * 0.9;
        ctx.beginPath();
        ctx.moveTo(0, -len * 3.2);
        ctx.lineTo(0, -len * 0.5);
        ctx.stroke();
        // The crystal: a long faceted diamond, point down.
        ctx.globalAlpha = EVENT_INTENSITY * (0.95 * fade);
        const body = ctx.createLinearGradient(0, -len, 0, w);
        body.addColorStop(0, 'rgba(120,210,255,0.25)');
        body.addColorStop(0.7, p.color);
        body.addColorStop(1, '#ffffff');
        ctx.fillStyle = body;
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#9fe8ff';
        ctx.beginPath();
        ctx.moveTo(0, -len);
        ctx.lineTo(w, -len * 0.3);
        ctx.lineTo(0, w * 1.4);
        ctx.lineTo(-w, -len * 0.3);
        ctx.closePath();
        ctx.fill();
        // Facet highlight.
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -len * 0.92);
        ctx.lineTo(0, w * 1.1);
        ctx.stroke();
        ctx.restore();
      }
      for (const im of ev.impacts) {
        const t = im.age / 0.5;
        const a = (1 - t) * fade;
        ctx.globalAlpha = EVENT_INTENSITY * (a * 0.8);
        ctx.strokeStyle = '#d8f6ff';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#9fe8ff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(im.x, im.y, 6 + t * im.size * 5, 2 + t * im.size * 1.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Four-ray glint.
        const r = im.size * (1.6 + 2.2 * (1 - Math.abs(t * 2 - 0.6)));
        ctx.globalAlpha = EVENT_INTENSITY * (a);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(im.x - r, im.y - 3); ctx.lineTo(im.x + r, im.y - 3);
        ctx.moveTo(im.x, im.y - 3 - r * 1.2); ctx.lineTo(im.x, im.y - 3 + r * 0.6);
        ctx.stroke();
        // Tiny chips thrown up.
        ctx.fillStyle = '#e9fbff';
        for (let k = 0; k < 4; k++) {
          const dir = -Math.PI / 2 + (k - 1.5) * 0.55;
          const d = t * im.size * 4.5;
          ctx.fillRect(im.x + Math.cos(dir) * d, im.y - 3 + Math.sin(dir) * d + t * t * 14, 2, 2);
        }
      }
    } else if (ev.kind === 'spore') {
      ctx.globalCompositeOperation = 'lighter';
      if (ev.age < 0.9) {
        ctx.globalAlpha = EVENT_INTENSITY * (0.5 * (1 - ev.age / 0.9));
        ctx.fillStyle = '#8dffc2';
        for (const puff of ev.puffs) {
          ctx.beginPath();
          ctx.arc(puff.x, puff.y, puff.r * (0.5 + ev.age * 2), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (const p of ev.particles) {
        const life = Math.max(0, 1 - (p.originY - p.y) / 150);
        ctx.globalAlpha = EVENT_INTENSITY * (Math.min(1, life * 1.4) * 0.85);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#6ef2b1';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (ev.kind === 'bubble') {
      const fade = ev.age > EVENT_DURATION - 0.4 ? Math.max(0, (EVENT_DURATION - ev.age) / 0.4) : 1;
      // The crest runs from off-screen left to off-screen right; the body trails behind it.
      const crest = -120 + (ev.age / EVENT_DURATION) * 1400;
      const tail = 420;
      const base = 540;
      const riseAt = (x: number): number => {
        const u = (crest - x) / tail; // 0 at the crest, 1 at the end of the tail
        if (u <= 0 || u >= 1) return 0;
        return u < 0.12 ? Math.sin((u / 0.12) * Math.PI / 2) : 1 - ((u - 0.12) / 0.88) ** 1.4;
      };
      const top = (x: number) => {
        const rise = riseAt(x);
        return 478 - 92 * rise - Math.sin(x * 0.045 + ev.age * 7) * 4 * rise;
      };
      // The underside meets the crest at the front, so the wave has no hard vertical edge.
      const bottom = (x: number) => {
        const u = Math.min(1, Math.max(0, (crest - x) / tail / 0.5));
        return 478 + (base - 478) * u * u * (3 - 2 * u);
      };
      const x0 = Math.max(-20, crest - tail);
      const x1 = Math.min(980, crest + 2);
      if (x1 > x0) {
        ctx.globalAlpha = EVENT_INTENSITY * (fade);
        // Water body: deep teal at the floor, bright and clear near the crest.
        const body = ctx.createLinearGradient(crest - tail, 0, crest, 0);
        body.addColorStop(0, 'rgba(30,150,160,0)');
        body.addColorStop(0.55, 'rgba(40,180,185,0.2)');
        body.addColorStop(0.85, 'rgba(110,240,230,0.32)');
        body.addColorStop(1, 'rgba(180,255,248,0.22)');
        ctx.fillStyle = body;
        const shape = new Path2D();
        shape.moveTo(x0, bottom(x0));
        for (let x = x0; x <= x1; x += 6) shape.lineTo(x, top(x));
        shape.lineTo(x1, top(x1));
        for (let x = x1; x >= x0; x -= 6) shape.lineTo(x, bottom(x));
        shape.closePath();
        ctx.fill(shape);
        // A lighter inner band so the wave reads as a rolling volume, not a flat sheet.
        ctx.globalCompositeOperation = 'lighter';
        const sheen = ctx.createLinearGradient(0, 380, 0, 520);
        sheen.addColorStop(0, 'rgba(160,255,245,0.16)');
        sheen.addColorStop(1, 'rgba(160,255,245,0)');
        ctx.fillStyle = sheen;
        ctx.save();
        ctx.clip(shape);
        ctx.translate(-10, 14);
        ctx.fill(shape);
        ctx.restore();
        // Foam along the crest line, densest at the front.
        ctx.strokeStyle = 'rgba(235,255,252,0.85)';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#bffff6';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        const foamFrom = Math.max(x0, crest - tail * 0.55);
        for (let x = foamFrom; x <= x1; x += 5) {
          if (x === foamFrom) ctx.moveTo(x, top(x));
          else ctx.lineTo(x, top(x));
        }
        ctx.stroke();
        ctx.fillStyle = '#f2fffd';
        for (let i = 0; i < 26; i++) {
          const n = Math.sin(ev.seed + i * 12.9898) * 43758.5453;
          const r = n - Math.floor(n);
          const fx = crest - r * r * tail * 0.45 - 2;
          if (fx < x0 || fx > x1) continue;
          const lift = Math.sin(ev.age * 9 + i) * 3 + (1 - r) * 8;
          ctx.globalAlpha = EVENT_INTENSITY * (fade * (0.9 - r * 0.6));
          ctx.beginPath();
          ctx.arc(fx, top(fx) - lift, 1.2 + (1 - r) * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      for (const p of ev.particles) {
        ctx.globalAlpha = EVENT_INTENSITY * (0.65 * fade);
        ctx.strokeStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#4fe0cf';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = EVENT_INTENSITY * (0.5 * fade);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, Math.max(0.6, p.size * 0.22), 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const open = ev.age < 0.7 ? ev.age / 0.7 : ev.age > 1.9 ? Math.max(0, (EVENT_DURATION - ev.age) / 0.6) : 1;
      const ease = open * open * (3 - 2 * open);
      const cx = 480;
      const cy = 252;
      const half = 96 * (0.35 + 0.65 * ease);
      ctx.globalAlpha = EVENT_INTENSITY * (1);
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(cx, cy, 6, cx, cy, 200 * ease + 10);
      glow.addColorStop(0, 'rgba(160,100,255,0.55)');
      glow.addColorStop(0.5, 'rgba(110,50,220,0.18)');
      glow.addColorStop(1, 'rgba(90,40,200,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 220, cy - 220, 440, 440);

      // Swirl arms turning around the tear.
      ctx.lineCap = 'round';
      for (let arm = 0; arm < 3; arm++) {
        const base = ev.age * 2.4 + arm * (Math.PI * 2 / 3);
        ctx.strokeStyle = arm === 1 ? 'rgba(240,210,255,0.35)' : 'rgba(150,90,255,0.4)';
        ctx.lineWidth = 2.2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#8d5bff';
        ctx.beginPath();
        for (let k = 0; k <= 24; k++) {
          const t = k / 24;
          const a = base + t * 2.6;
          const r = (34 + t * 120) * ease;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r * 0.55;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.globalAlpha = EVENT_INTENSITY * (ease);
        ctx.stroke();
      }

      // The tear: a jagged lens, black-violet inside with a hot rim.
      const n = ev.crack.length - 1;
      const edge = (side: number): [number, number][] => {
        const pts: [number, number][] = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const w = Math.sin(t * Math.PI) * 24 * ease + Math.sin(ev.age * 11 + i * 2.1) * 1.5 * ease;
          pts.push([cx + ev.crack[i] * (0.5 + 0.5 * ease) + side * w, cy - half + t * half * 2]);
        }
        return pts;
      };
      const left = edge(-1);
      const right = edge(1);
      const tear = new Path2D();
      tear.moveTo(left[0][0], left[0][1]);
      for (const [x, y] of left) tear.lineTo(x, y);
      for (let i = right.length - 1; i >= 0; i--) tear.lineTo(right[i][0], right[i][1]);
      tear.closePath();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = EVENT_INTENSITY * (Math.min(1, ease * 1.4));
      const inside = ctx.createRadialGradient(cx, cy, 2, cx, cy, half);
      inside.addColorStop(0, '#05000c');
      inside.addColorStop(0.7, '#1a0536');
      inside.addColorStop(1, '#4a168f');
      ctx.fillStyle = inside;
      ctx.fill(tear);
      // Faint stars deep inside the rift.
      ctx.fillStyle = '#e8d8ff';
      for (let i = 0; i < 7; i++) {
        const sx = cx + Math.sin(ev.seed + i * 3.7) * 9 * ease;
        const sy = cy + Math.cos(ev.seed + i * 5.3) * half * 0.7;
        ctx.globalAlpha = EVENT_INTENSITY * (ease * (0.4 + 0.4 * Math.sin(ev.age * 6 + i)));
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = EVENT_INTENSITY * (ease);
      ctx.strokeStyle = 'rgba(232,196,255,0.95)';
      ctx.shadowBlur = 22;
      ctx.shadowColor = '#a46bff';
      ctx.lineWidth = 2.6;
      ctx.lineJoin = 'round';
      ctx.stroke(tear);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 6;
      ctx.stroke(tear);

      // Crackling arcs that flick off the rim.
      if (ease > 0.5) {
        ctx.strokeStyle = 'rgba(220,190,255,0.85)';
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 10;
        for (let b = 0; b < 2; b++) {
          if (Math.random() > 0.35) continue;
          const src = Math.random() < 0.5 ? left : right;
          const [sx, sy] = src[1 + Math.floor(Math.random() * (n - 1))];
          const dir = src === left ? -1 : 1;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          let x = sx;
          let y = sy;
          for (let k = 0; k < 4; k++) {
            x += dir * rand(8, 18);
            y += rand(-12, 12);
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // Ash being drawn into the tear.
      for (const p of ev.particles) {
        const near = Math.min(1, p.radius / 60);
        ctx.globalAlpha = EVENT_INTENSITY * (0.8 * ease * near);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 9;
        ctx.shadowColor = '#8d5bff';
        const stretch = 1 + (1 - near) * 2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle + Math.PI / 2);
        ctx.fillRect(-p.size / 2, -p.size * stretch / 2, p.size, p.size * stretch);
        ctx.restore();
      }
    }
    ctx.restore();

    // Event name, top centre, fading over 1.6 s.
    const textAlpha = Math.max(0, 1 - Math.max(0, ev.age - 0.3) / 1.6);
    if (textAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = textAlpha;
      ctx.font = '600 18px "Cinzel", "Palatino Linotype", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#050309';
      ctx.strokeText(EVENT_NAMES[ev.kind], 480, 46);
      ctx.fillStyle = '#f3e2c0';
      ctx.fillText(EVENT_NAMES[ev.kind], 480, 46);
      ctx.restore();
    }
  }

  private drawSpark(ctx: CanvasRenderingContext2D, spark: Spark, time: number): void {
    // Bob off the spark's own age so the drawn orb and hit() agree on its position.
    const bob = Math.sin(spark.age * 3) * 4;
    const x = spark.x;
    const y = spark.y + bob;
    const pulse = 0.85 + 0.15 * Math.sin(time * 4.2);
    const fade = spark.age > SPARK_LIFETIME - 1 ? Math.max(0, SPARK_LIFETIME - spark.age) : 1;

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(x, y, 2, x, y, 54 * pulse);
    halo.addColorStop(0, this.accent);
    halo.addColorStop(0.35, `${this.accent}99`);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - 60, y - 60, 120, 120);

    ctx.fillStyle = this.accent;
    ctx.shadowBlur = 22;
    ctx.shadowColor = this.accent;
    ctx.beginPath();
    ctx.arc(x, y, 9 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Four-point star.
    ctx.strokeStyle = '#fff8e8';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 14;
    ctx.shadowColor = this.accent;
    ctx.beginPath();
    ctx.moveTo(x - 17, y);
    ctx.lineTo(x, y);
    ctx.moveTo(x + 17, y);
    ctx.lineTo(x, y);
    ctx.moveTo(x, y - 17);
    ctx.lineTo(x, y);
    ctx.moveTo(x, y + 17);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  private drawRing(ctx: CanvasRenderingContext2D, ring: FxRing): void {
    const t = ring.age / ring.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t) * 0.9;
    ctx.strokeStyle = ring.color;
    ctx.shadowBlur = 18;
    ctx.shadowColor = ring.color;
    ctx.lineWidth = 3 * (1 - t) + 1;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, 14 + t * 74, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawFloater(ctx: CanvasRenderingContext2D, f: FxFloater): void {
    const t = f.age / f.life;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - t) * 2);
    ctx.font = '700 18px "Cinzel", "Palatino Linotype", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#050309';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}
