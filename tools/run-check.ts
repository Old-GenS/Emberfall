/**
 * Node checks for the roguelike run rules: deterministic random waves, elite affixes and health
 * carried within a realm. No browser; bundled like the balance CLI by `npm run check:run`.
 */
import {
  AFFIXES, LOCATIONS, TOTAL_STAGES, buildWave,
  type AffixId, type EnemyInstance,
} from '../src/data';
import { BALANCE } from '../src/balance';
import { makeEnemyUnit } from '../src/combat';
import {
  completeStage, getSave, normalizeSave, resetSave, selectClass, startHpPct, updateSave,
} from '../src/state';
import { packDpsByStage } from './balance/scaling';

interface Check { name: string; run: () => string }

const fail = (msg: string): never => { throw new Error(msg); };
const assert = (ok: boolean, msg: string): void => { if (!ok) fail(msg); };
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

const shape = (wave: EnemyInstance[]) => wave.map((w) => ({
  id: w.def.id,
  name: w.name,
  affix: w.affix ?? null,
  hpScale: w.hpScale,
  atkScale: w.atkScale,
}));

const check: Check[] = [
  {
    name: 'Deterministic',
    run: () => {
      for (let stage = 0; stage < TOTAL_STAGES; stage++) {
        for (let seed = 1; seed <= 20; seed++) {
          const a = JSON.stringify(shape(buildWave(stage, seed)));
          const b = JSON.stringify(shape(buildWave(stage, seed)));
          assert(a === b, `stage ${stage} seed ${seed} differs between calls`);
        }
      }
      return 'stages 0–24 × seeds 1–20 identical';
    },
  },
  {
    name: 'Varied',
    run: () => {
      const counts: string[] = [];
      for (const stage of [0, 5, 10, 15, 20]) {
        const comps = new Set<string>();
        for (let seed = 1; seed <= 200; seed++) {
          comps.add(buildWave(stage, seed).map((w) => w.def.id).sort().join(','));
        }
        assert(comps.size >= 3, `stage ${stage} has only ${comps.size} distinct compositions`);
        counts.push(`stage ${stage}: ${comps.size}`);
      }
      return counts.join(' · ');
    },
  },
  {
    name: 'Elite rules',
    run: () => {
      for (let realm = 0; realm < LOCATIONS.length; realm++) {
        const eliteId = LOCATIONS[realm].enemies[2].id;
        for (const inLoc of [0, 3]) {
          for (let seed = 1; seed <= 200; seed++) {
            const wave = buildWave(realm * 5 + inLoc, seed);
            const elites = wave.filter((w) => w.def.id === eliteId).length;
            if (inLoc === 0) assert(elites === 0, `realm ${realm} stageInLoc 0 seed ${seed} has an elite`);
            else assert(elites === 1, `realm ${realm} stageInLoc 3 seed ${seed} has ${elites} elites`);
          }
        }
        for (let inLoc = 0; inLoc < 4; inLoc++) {
          for (let seed = 1; seed <= 200; seed++) {
            const elites = buildWave(realm * 5 + inLoc, seed).filter((w) => w.def.id === eliteId).length;
            assert(elites <= 1, `realm ${realm} stageInLoc ${inLoc} seed ${seed} has ${elites} elites`);
          }
        }
      }
      return '5 realms × 200 seeds: none at stage 1, exactly one at stage 4, never two';
    },
  },
  {
    name: 'Bosses fixed',
    run: () => {
      for (const stage of [4, 9, 14, 19, 24]) {
        const base = JSON.stringify(shape(buildWave(stage, 1)));
        for (let seed = 1; seed <= 50; seed++) {
          const wave = buildWave(stage, seed);
          assert(JSON.stringify(shape(wave)) === base, `boss stage ${stage} changed on seed ${seed}`);
          assert(wave.every((w) => !w.affix), `boss stage ${stage} seed ${seed} has an affix`);
        }
      }
      return 'stages 4, 9, 14, 19, 24 identical on seeds 1–50, no affixes';
    },
  },
  {
    name: 'Affix rates',
    run: () => {
      const seen = new Set<AffixId>();
      const rate = (realm: number): number => {
        let elites = 0;
        let affixed = 0;
        for (let inLoc = 0; inLoc < 4; inLoc++) {
          for (let seed = 1; seed <= 1000; seed++) {
            const eliteId = LOCATIONS[realm].enemies[2].id;
            for (const w of buildWave(realm * 5 + inLoc, seed)) {
              if (w.def.id !== eliteId) continue;
              elites++;
              if (w.affix) { affixed++; seen.add(w.affix); }
            }
          }
        }
        return elites ? affixed / elites : 0;
      };
      const first = rate(0);
      const last = rate(4);
      assert(first >= 0.15 && first <= 0.35, `realm 0 affix share ${(first * 100).toFixed(1)}% is outside 15–35%`);
      assert(last >= 0.7, `realm 4 affix share ${(last * 100).toFixed(1)}% is below 70%`);
      assert(seen.size === AFFIXES.length, `only ${seen.size} of ${AFFIXES.length} affixes appeared`);
      return `realm 0 ${(first * 100).toFixed(1)}% · realm 4 ${(last * 100).toFixed(1)}% · all ${seen.size} affixes seen`;
    },
  },
  {
    name: 'Affix stats',
    run: () => {
      const def = LOCATIONS[4].enemies[2];
      const unit = (affix?: AffixId) => makeEnemyUnit({ def, name: 'test', hpScale: 1, atkScale: 1, affix }, 0);
      const plain = unit();
      const swift = unit('swift');
      assert(swift.stats.speed < plain.stats.speed, 'swift did not lower speed');
      const armored = unit('armored');
      assert(near(armored.stats.armor, plain.stats.armor + 12), 'armored did not add 12 armor');
      assert(near(armored.stats.damageReduction, 0.15), 'armored did not set 15% damage reduction');
      const vampiric = unit('vampiric');
      assert(near(vampiric.stats.lifesteal, 0.25), 'vampiric did not set 25% lifesteal');
      const burning = unit('burning');
      assert(burning.affix === 'burning', 'burning did not set the unit affix');
      return 'swift speed down · armored +12 armor / 15% DR · vampiric 25% lifesteal · burning tagged';
    },
  },
  {
    name: 'Health carry',
    run: () => {
      resetSave();
      selectClass('warden');
      updateSave({ hpPct: 0.5 });
      completeStage(0.4);
      const first = getSave().hpPct;
      const expected = Math.min(1, 0.4 + BALANCE.run.healOnWin);
      assert(near(first, expected), `completeStage(0.4) left hpPct ${first}, expected ${expected}`);
      assert(getSave().stage === 1, `stage is ${getSave().stage}, expected 1`);
      updateSave({ stage: 4 });
      completeStage(0.1);
      assert(near(getSave().hpPct, 1), `boss clear left hpPct ${getSave().hpPct}, expected 1`);
      assert(getSave().stage === 5, `stage is ${getSave().stage}, expected 5`);
      assert(near(startHpPct(1), getSave().hpPct), 'startHpPct(1) did not equal the carried health');
      updateSave({ hpPct: 0.1 });
      const retry = startHpPct(1 + BALANCE.rally.step);
      assert(near(retry, 0.35), `startHpPct(1 + step) = ${retry}, expected 0.35`);
      assert(near(startHpPct(1), BALANCE.run.minStartHp), `startHpPct(1) = ${startHpPct(1)}, expected the floor ${BALANCE.run.minStartHp}`);
      return `0.4 + ${BALANCE.run.healOnWin} = ${(0.4 + BALANCE.run.healOnWin).toFixed(2)} · boss restores to 1 · retry 0.1 + 0.25 = 0.35 · floor 0.2`;
    },
  },
  {
    name: 'Old saves',
    run: () => {
      const s = normalizeSave({ version: 1 });
      assert(Number.isInteger(s.runSeed) && s.runSeed >= 0, `old save got runSeed ${s.runSeed}`);
      assert(s.hpPct === 1, `old save got hpPct ${s.hpPct}`);
      const clamped = normalizeSave({ version: 1, hpPct: 2, runSeed: -3 });
      assert(clamped.hpPct === 1 && Number.isInteger(clamped.runSeed) && clamped.runSeed >= 0, 'invalid runSeed/hpPct were not normalised');
      const kept = normalizeSave({ version: 1, runSeed: 7, hpPct: 0.4 });
      assert(kept.runSeed === 7 && kept.hpPct === 0.4, 'valid runSeed/hpPct were not kept');
      return 'missing runSeed/hpPct get a valid seed and 100% · invalid values clamped';
    },
  },
  {
    name: 'Pack DPS rule',
    run: () => {
      const seeds = Array.from({ length: 50 }, (_, i) => i + 1);
      const mean = new Array<number>(TOTAL_STAGES).fill(0);
      for (const seed of seeds) {
        const dps = packDpsByStage(seed);
        for (let stage = 0; stage < TOTAL_STAGES; stage++) mean[stage] += dps[stage] / seeds.length;
      }
      const out: string[] = [];
      for (let realm = 0; realm < LOCATIONS.length; realm++) {
        const boss = mean[realm * 5 + 4];
        for (let inLoc = 0; inLoc < 4; inLoc++) {
          const stage = realm * 5 + inLoc;
          assert(mean[stage] < boss, `realm ${realm} stage ${stage} DPS ${mean[stage].toFixed(1)} ≥ boss ${boss.toFixed(1)}`);
        }
        out.push(`realm ${realm}: ${mean[realm * 5].toFixed(1)}–${mean[realm * 5 + 3].toFixed(1)} < ${boss.toFixed(1)}`);
      }
      return out.join(' · ');
    },
  },
];

let passed = 0;
for (const c of check) {
  try {
    const detail = c.run();
    passed++;
    console.log(`PASS  ${c.name} — ${detail}`);
  } catch (err) {
    console.log(`FAIL  ${c.name} — ${(err as Error).message}`);
  }
}
console.log(`run-check: ${passed}/${check.length} pass`);
if (passed !== check.length) process.exitCode = 1;
