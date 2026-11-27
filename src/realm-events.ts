import type { Battle } from './combat';
import type { ParticleKind } from './data';

/** Every realm event runs for this long, then leaves a spark behind. */
const EVENT_DURATION = 2.5;
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
  private nextAt = 10;
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
    // 12 s base, nudged by a short repeating pattern so events are not metronomic.
    const interval = 12 + ((this.index * 7) % 5) - 2;
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
      for (let i = 0; i < 30; i++) {
        push({
          x: rand(-20, 980), y: rand(-360, 520),
          vx: rand(-14, 14), vy: rand(150, 290),
          size: rand(1.4, 3.4), color: i % 3 === 0 ? '#e9fbff' : '#9fe8ff',
        });
      }
    } else if (kind === 'bubble') {
      for (let i = 0; i < 26; i++) {
        push({
          x: rand(-100, 1000), y: rand(390, 540),
          vx: rand(-6, 10), vy: rand(-70, -24),
          size: rand(1.8, 5), color: i % 4 === 0 ? '#c9fff6' : '#4fe0cf',
        });
      }
    } else {
      for (let i = 0; i < 34; i++) {
        push({
          x: rand(400, 560), y: rand(190, 330),
          size: rand(1.4, 3.6), color: i % 3 === 0 ? '#e4b8ff' : '#8d5bff',
          angle: rand(0, Math.PI * 2), radius: rand(18, 100), spin: rand(0.7, 2.1),
        });
      }
    }
    return { kind, age: 0, particles, puffs, seed: Math.random() * 1000 };
  }

  private stepParticles(ev: ArenaEvent, dt: number): void {
    for (const p of ev.particles) {
      if (ev.kind === 'ash') {
        p.angle += p.spin * dt;
        p.radius += 14 * dt;
        p.x = 480 + Math.cos(p.angle) * p.radius;
        p.y = 255 + Math.sin(p.angle) * p.radius * 0.62;
      } else if (ev.kind === 'spore') {
        p.phase += dt * 2;
        p.x += p.vx * dt + Math.sin(p.phase) * 12 * dt;
        p.y += p.vy * dt;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      if (ev.kind === 'ember' || ev.kind === 'snow') {
        if (p.y > 560) { p.y -= 620; p.x -= ev.kind === 'ember' ? 120 : 0; }
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
    if (ev.kind === 'ember') {
      if (ev.age < 0.6) {
        ctx.globalAlpha = 0.16 * (1 - ev.age / 0.6);
        ctx.fillStyle = '#ff8a3c';
        ctx.fillRect(0, 0, 960, 540);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ev.particles) {
        const a = 0.55 + 0.35 * Math.sin(time * 7 + p.phase);
        ctx.globalAlpha = Math.max(0.2, a);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 2.1, -0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (ev.kind === 'snow') {
      if (ev.age < 0.55) {
        ctx.globalAlpha = 0.13 * (1 - ev.age / 0.55);
        ctx.fillStyle = '#bdefff';
        ctx.fillRect(0, 0, 960, 540);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ev.particles) {
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#9fe8ff';
        ctx.lineWidth = p.size * 0.7;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.size * 3.5);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.fillStyle = '#f2fdff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (ev.kind === 'spore') {
      ctx.globalCompositeOperation = 'lighter';
      if (ev.age < 0.9) {
        ctx.globalAlpha = 0.5 * (1 - ev.age / 0.9);
        ctx.fillStyle = '#8dffc2';
        for (const puff of ev.puffs) {
          ctx.beginPath();
          ctx.arc(puff.x, puff.y, puff.r * (0.5 + ev.age * 2), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (const p of ev.particles) {
        const life = Math.max(0, 1 - (p.originY - p.y) / 150);
        ctx.globalAlpha = Math.min(1, life * 1.4) * 0.85;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#6ef2b1';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (ev.kind === 'bubble') {
      const sweep = -180 + (ev.age / EVENT_DURATION) * 1320;
      const band = ctx.createLinearGradient(sweep - 120, 0, sweep + 120, 0);
      band.addColorStop(0, 'rgba(79,224,207,0)');
      band.addColorStop(0.5, 'rgba(79,224,207,0.22)');
      band.addColorStop(1, 'rgba(79,224,207,0)');
      ctx.fillStyle = band;
      ctx.fillRect(sweep - 130, 360, 260, 180);
      ctx.fillStyle = 'rgba(120,255,240,0.16)';
      ctx.fillRect(sweep - 90, 425, 180, 22);
      for (const p of ev.particles) {
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#4fe0cf';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      const open = ev.age < 1 ? Math.min(1, ev.age / 1) : ev.age > 1.9 ? Math.max(0, (EVENT_DURATION - ev.age) / 0.6) : 1;
      const cx = 480;
      const cy = 252;
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 130 * open + 10);
      glow.addColorStop(0, 'rgba(141,91,255,0.55)');
      glow.addColorStop(1, 'rgba(141,91,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 180, cy - 190, 360, 380);
      ctx.strokeStyle = 'rgba(228,184,255,0.9)';
      ctx.shadowBlur = 24;
      ctx.shadowColor = '#8d5bff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 12 + 16 * open, 78 * open, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(ev.age * 9) * 6, cy - 74 * open);
      ctx.quadraticCurveTo(cx + 20 * open, cy, cx - Math.sin(ev.age * 7) * 6, cy + 74 * open);
      ctx.stroke();
      for (const p of ev.particles) {
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 9;
        ctx.shadowColor = '#8d5bff';
        ctx.fillRect(p.x, p.y, p.size, p.size * 1.5);
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
