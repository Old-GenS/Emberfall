/**
 * Node checks for the branching path: deterministic offers, node rules, elites, shrines, events,
 * path state, the boon rarity floor and old saves. No browser; bundled like the balance CLI by
 * `npm run check:path`.
 */
import {
  AFFIXES, BOONS, EVENTS, LOCATIONS, TOTAL_STAGES, buildNodeWave, eventFor, nodeOffer,
  type EnemyInstance, type EventDef, type NodeType,
} from '../src/data';
import { BALANCE } from '../src/balance';
import {
  choosePath, completeNonCombat, completeStage, currentNode, getSave, needsPathChoice,
  normalizeSave, pickBoonChoices, resetSave, resolveEvent, selectClass, shrineOffering, shrineRest,
  stageRewardXp, updateSave,
} from '../src/state';
import { packDpsForWave } from './balance/scaling';

interface Check { name: string; run: () => string }

const fail = (msg: string): never => { throw new Error(msg); };
const assert = (ok: boolean, msg: string): void => { if (!ok) fail(msg); };
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
const VALID: NodeType[] = ['fight', 'elite', 'shrine', 'event'];
const share = (t: NodeType): boolean => t === 'fight' || t === 'elite';

/** Start a fresh run-shaped save at `stage` with `seed` and `hp`. */
function setup(stage: number, seed: number, hp = 0.5): void {
  resetSave();
  selectClass('warden');
  updateSave({ stage, runSeed: seed, hpPct: hp });
}

/** The first seed whose offer at `stage` contains `node`. */
function seedOffering(stage: number, node: NodeType): number {
  for (let seed = 1; seed <= 10000; seed++) if (nodeOffer(stage, seed).includes(node)) return seed;
  throw new Error(`no seed offers ${node} at stage ${stage}`);
}

/** The first seed at `stage` whose event is `id`. */
function seedForEvent(stage: number, id: EventDef['id']): number {
  for (let seed = 1; seed <= 10000; seed++) if (eventFor(stage, seed).id === id) return seed;
  throw new Error(`no seed gives the ${id} event at stage ${stage}`);
}

const shape = (wave: EnemyInstance[]) => wave.map((w) => ({
  id: w.def.id, name: w.name, affix: w.affix ?? null, hpScale: w.hpScale, atkScale: w.atkScale,
}));

const check: Check[] = [
  {
    name: 'Offers deterministic',
    run: () => {
      for (let stage = 0; stage < TOTAL_STAGES; stage++) {
        for (let seed = 1; seed <= 50; seed++) {
          const a = JSON.stringify(nodeOffer(stage, seed));
          const b = JSON.stringify(nodeOffer(stage, seed));
          assert(a === b, `stage ${stage} seed ${seed} differs between calls`);
        }
      }
      return 'stages 0–24 × seeds 1–50 identical';
    },
  },
  {
    name: 'Offer rules',
    run: () => {
      for (let seed = 1; seed <= 300; seed++) {
        for (let stage = 0; stage < TOTAL_STAGES; stage++) {
          const offer = nodeOffer(stage, seed);
          const step = stage % 5;
          if (step === 0 || step === 4) {
            assert(offer.length === 0, `step ${step} stage ${stage} seed ${seed} offered ${offer.join(',')}`);
            continue;
          }
          assert(offer.length === 2, `stage ${stage} seed ${seed} offered ${offer.length} nodes`);
          assert(new Set(offer).size === 2, `stage ${stage} seed ${seed} repeated a node: ${offer.join(',')}`);
          assert(offer.every((t) => VALID.includes(t)), `stage ${stage} seed ${seed} offered an invalid node: ${offer.join(',')}`);
          assert(offer.some(share), `stage ${stage} seed ${seed} offered no combat node: ${offer.join(',')}`);
        }
      }
      return 'steps 0/4 empty · steps 1–3 two distinct valid nodes, at least one fight/elite';
    },
  },
  {
    name: 'Offer mix',
    run: () => {
      const counts: Record<NodeType, number> = { fight: 0, elite: 0, shrine: 0, event: 0 };
      let offers = 0;
      let shrineStep1 = 0;
      let shrineStep3 = 0;
      for (let seed = 1; seed <= 1000; seed++) {
        for (const step of [1, 2, 3]) {
          const offer = nodeOffer(step, seed);
          offers++;
          for (const t of VALID) if (offer.includes(t)) counts[t]++;
          if (step === 1 && offer.includes('shrine')) shrineStep1++;
          if (step === 3 && offer.includes('shrine')) shrineStep3++;
        }
      }
      for (const t of VALID) {
        const pct = (100 * counts[t]) / offers;
        assert(pct >= 5, `${t} appears in ${pct.toFixed(1)}% of offers, below 5%`);
      }
      assert(shrineStep3 > shrineStep1, `shrine appears in ${shrineStep3} step-3 offers, not more than ${shrineStep1} at step 1`);
      return VALID.map((t) => `${t} ${((100 * counts[t]) / offers).toFixed(1)}%`).join(' · ') + ` · shrine step 1 ${shrineStep1} < step 3 ${shrineStep3}`;
    },
  },
  {
    name: 'Elite wave',
    run: () => {
      const hpS = BALANCE.path.eliteHp;
      const atkS = BALANCE.path.eliteAtk;
      for (let realm = 0; realm < LOCATIONS.length; realm++) {
        const eliteId = LOCATIONS[realm].enemies[2].id;
        for (const step of [1, 2, 3]) {
          const stage = realm * 5 + step;
          for (let seed = 1; seed <= 50; seed++) {
            const fight = buildNodeWave(stage, seed, 'fight');
            const wave = buildNodeWave(stage, seed, 'elite');
            const again = buildNodeWave(stage, seed, 'elite');
            assert(JSON.stringify(shape(wave)) === JSON.stringify(shape(again)), `stage ${stage} seed ${seed} elite wave differs between calls`);
            const elites = wave.filter((w) => w.def.id === eliteId);
            assert(elites.length === 1, `stage ${stage} seed ${seed} has ${elites.length} elites, expected 1`);
            for (const elite of elites) {
              assert(!!elite.affix, `stage ${stage} seed ${seed} elite has no affix`);
              const affix = AFFIXES.find((a) => a.id === elite.affix);
              assert(!!affix, `stage ${stage} seed ${seed} elite has an unknown affix ${elite.affix}`);
              assert(elite.name.startsWith(affix!.name), `stage ${stage} seed ${seed} elite "${elite.name}" does not start with "${affix!.name}"`);
            }
            assert(wave.length === fight.length, `stage ${stage} seed ${seed} elite wave has ${wave.length} enemies, fight has ${fight.length}`);
            for (let i = 0; i < wave.length; i++) {
              assert(near(wave[i].hpScale, fight[i].hpScale * hpS), `stage ${stage} seed ${seed} slot ${i} hpScale ${wave[i].hpScale} is not ${hpS} × ${fight[i].hpScale}`);
              assert(near(wave[i].atkScale, fight[i].atkScale * atkS), `stage ${stage} seed ${seed} slot ${i} atkScale ${wave[i].atkScale} is not ${atkS} × ${fight[i].atkScale}`);
            }
          }
        }
      }
      return `5 realms × steps 1–3 × seeds 1–50: one affixed elite, HP ×${hpS}, ATK ×${atkS}`;
    },
  },
  {
    name: 'Shrine',
    run: () => {
      const rest = BALANCE.path.restHeal;
      const cost = BALANCE.path.offeringCost;
      setup(1, 1, 0.5);
      shrineRest();
      assert(near(getSave().hpPct, 0.85), `rest from 0.5 left ${getSave().hpPct}, expected 0.85`);
      setup(1, 1, 0.9);
      shrineRest();
      assert(near(getSave().hpPct, 1), `rest from 0.9 left ${getSave().hpPct}, expected 1`);
      setup(1, 1, 0.5);
      shrineOffering();
      assert(near(getSave().hpPct, 0.3), `offering from 0.5 left ${getSave().hpPct}, expected 0.3`);
      setup(1, 1, 0.1);
      shrineOffering();
      assert(near(getSave().hpPct, BALANCE.path.hpFloor), `offering from 0.1 left ${getSave().hpPct}, expected the floor ${BALANCE.path.hpFloor}`);
      return `rest +${rest} (0.5→0.85, 0.9→1) · offering −${cost} (0.5→0.3, 0.1→floor ${BALANCE.path.hpFloor})`;
    },
  },
  {
    name: 'Events',
    run: () => {
      // eventFor: deterministic and all three appear.
      const seen = new Set<string>();
      for (let seed = 1; seed <= 200; seed++) {
        const a = JSON.stringify(eventFor(1, seed));
        const b = JSON.stringify(eventFor(1, seed));
        assert(a === b, `eventFor(1, ${seed}) differs between calls`);
        seen.add(eventFor(1, seed).id);
      }
      assert(seen.size === EVENTS.length, `only ${seen.size} of ${EVENTS.length} events appeared over seeds 1–200`);

      const shareXp = BALANCE.path.nonCombatXp;
      const floor = BALANCE.path.hpFloor;

      const merchant = seedForEvent(1, 'merchant');
      setup(1, merchant, 0.5);
      const trade = resolveEvent('trade');
      assert(trade.boon === 'rare', `merchant trade returned boon ${trade.boon}, expected rare`);
      assert(near(trade.xpShare, shareXp), `merchant trade returned xpShare ${trade.xpShare}, expected ${shareXp}`);
      assert(near(getSave().hpPct, Math.max(floor, 0.25)), `merchant trade left ${getSave().hpPct}, expected ${Math.max(floor, 0.25)}`);
      setup(1, merchant, 0.5);
      const leave = resolveEvent('leave');
      assert(leave.boon === null, `merchant leave returned boon ${leave.boon}`);
      assert(near(leave.xpShare, shareXp), `merchant leave returned xpShare ${leave.xpShare}`);
      assert(near(getSave().hpPct, 0.5), `merchant leave changed hp to ${getSave().hpPct}`);

      const reliquary = seedForEvent(1, 'reliquary');
      setup(1, reliquary, 0.5);
      const reliquaryLeave = resolveEvent('leave');
      assert(reliquaryLeave.boon === null, `reliquary leave returned boon ${reliquaryLeave.boon}`);
      assert(near(reliquaryLeave.xpShare, shareXp), `reliquary leave returned xpShare ${reliquaryLeave.xpShare}`);
      assert(near(getSave().hpPct, 0.5), `reliquary leave changed hp to ${getSave().hpPct}`);
      setup(1, reliquary, 0.5);
      const openA = resolveEvent('open');
      setup(1, reliquary, 0.5);
      const openB = resolveEvent('open');
      assert(JSON.stringify(openA) === JSON.stringify(openB), 'the reliquary outcome is not deterministic per seed');
      let epic = 0;
      let cursed = 0;
      for (let seed = 1; seed <= 200; seed++) {
        if (eventFor(1, seed).id !== 'reliquary') continue;
        setup(1, seed, 0.5);
        const out = resolveEvent('open');
        if (out.boon === 'epic') {
          epic++;
          assert(near(out.xpShare, shareXp), `reliquary epic returned xpShare ${out.xpShare}`);
          assert(near(getSave().hpPct, 0.5), `reliquary epic changed hp to ${getSave().hpPct}`);
        } else {
          cursed++;
          assert(out.boon === null, `reliquary open returned boon ${out.boon}`);
          assert(near(getSave().hpPct, Math.max(floor, 0.2)), `reliquary curse left ${getSave().hpPct}, expected ${Math.max(floor, 0.2)}`);
        }
      }
      assert(epic > 0 && cursed > 0, `reliquary outcomes over seeds: ${epic} epic, ${cursed} cursed`);

      const pilgrim = seedForEvent(1, 'pilgrim');
      setup(1, pilgrim, 0.5);
      const tend = resolveEvent('tend');
      assert(tend.boon === null && tend.xpShare === 1, `pilgrim tend returned boon ${tend.boon}, xpShare ${tend.xpShare}`);
      assert(near(getSave().hpPct, 0.5), `pilgrim tend changed hp to ${getSave().hpPct}`);
      setup(1, pilgrim, 0.4);
      const pray = resolveEvent('pray');
      assert(pray.boon === null && near(pray.xpShare, shareXp), `pilgrim pray returned boon ${pray.boon}, xpShare ${pray.xpShare}`);
      assert(near(getSave().hpPct, 0.6), `pilgrim pray from 0.4 left ${getSave().hpPct}, expected 0.6`);

      // Health never falls below the floor, whatever the event and choice.
      for (let seed = 1; seed <= 200; seed++) {
        const event = eventFor(1, seed);
        for (const choice of event.choices) {
          setup(1, seed, 0.1);
          resolveEvent(choice.id);
          assert(getSave().hpPct >= floor, `event ${event.id}/${choice.id} at seed ${seed} left ${getSave().hpPct}, below the floor ${floor}`);
        }
      }
      return `all 3 events · reliquary ${epic} epic / ${cursed} cursed · boons, XP and HP as documented · floor ${floor}`;
    },
  },
  {
    name: 'Path state',
    run: () => {
      resetSave();
      selectClass('warden');
      assert(currentNode() === 'fight', `currentNode at step 0 is ${currentNode()}, expected fight`);
      updateSave({ stage: 4, node: null });
      assert(currentNode() === 'boss', `currentNode at step 4 is ${currentNode()}, expected boss`);

      const stage = 1;
      const seed = seedOffering(stage, 'fight');
      setup(stage, seed, 0.5);
      const invalid = VALID.find((t) => !nodeOffer(stage, seed).includes(t))!;
      assert(!choosePath(invalid), `choosePath accepted ${invalid}, which was not offered`);
      assert(choosePath('fight'), 'choosePath rejected an offered fight');
      assert(getSave().node === 'fight' && currentNode() === 'fight', 'choosePath did not set the current node');

      // A normal win records 'fight' and advances.
      resetSave();
      selectClass('warden');
      completeStage(0.8);
      let save = getSave();
      assert(save.stage === 1 && save.path.length === 1 && save.path[0] === 'fight' && save.node === null,
        `after a stage-0 win: stage ${save.stage}, path ${save.path.join(',')}, node ${save.node}`);

      // A shrine records 'shrine', advances, and awards nonCombatXp × the stage XP.
      const shrineSeed = seedOffering(1, 'shrine');
      updateSave({ runSeed: shrineSeed });
      assert(choosePath('shrine'), 'choosePath rejected an offered shrine');
      const shrineXp = completeNonCombat();
      save = getSave();
      assert(save.stage === 2 && save.path.length === 2 && save.path[1] === 'shrine' && save.node === null,
        `after a shrine: stage ${save.stage}, path ${save.path.join(',')}, node ${save.node}`);
      assert(near(shrineXp.xp, stageRewardXp(1) * BALANCE.path.nonCombatXp), `shrine XP ${shrineXp.xp}, expected ${stageRewardXp(1) * BALANCE.path.nonCombatXp}`);

      // An elite win records 'elite' and awards eliteXp × the stage XP.
      resetSave();
      selectClass('warden');
      completeStage(0.8);
      const eliteSeed = seedOffering(1, 'elite');
      updateSave({ runSeed: eliteSeed });
      assert(choosePath('elite'), 'choosePath rejected an offered elite');
      const eliteXp = completeStage(0.8);
      save = getSave();
      assert(save.stage === 2 && save.path.length === 2 && save.path[1] === 'elite' && save.node === null,
        `after an elite: stage ${save.stage}, path ${save.path.join(',')}, node ${save.node}`);
      assert(near(eliteXp.xp, stageRewardXp(1) * BALANCE.path.eliteXp), `elite XP ${eliteXp.xp}, expected ${stageRewardXp(1) * BALANCE.path.eliteXp}`);
      assert(needsPathChoice(), 'the next step should offer a path choice after the elite cleared');
      return 'reject/accept · fight/boss at steps 0/4 · fight, shrine and elite recorded, node cleared · XP shares';
    },
  },
  {
    name: 'Boon floor',
    run: () => {
      resetSave();
      selectClass('warden');
      const rare = pickBoonChoices(3, [], 'rare');
      assert(rare.length > 0, 'no rare-or-better boons were offered');
      assert(rare.every((b) => b.rarity !== 'common'), `rare floor offered ${rare.map((b) => b.rarity).join(',')}`);
      const epicPool = BOONS.filter((b) => (!b.classes || b.classes.includes('warden')) && b.rarity === 'epic');
      const epic = pickBoonChoices(3, [], 'epic');
      assert(epic.length === Math.min(3, epicPool.length), `epic offer had ${epic.length} cards, pool has ${epicPool.length}`);
      assert(epic.every((b) => b.rarity === 'epic'), `epic floor offered ${epic.map((b) => b.rarity).join(',')}`);
      return `rare: ${rare.length} cards, no common · epic: ${epic.length} cards, all epic (pool ${epicPool.length})`;
    },
  },
  {
    name: 'Old saves',
    run: () => {
      const old = normalizeSave({ version: 1, classId: 'warden', stage: 7 });
      assert(old.node === null, `old save got node ${old.node}, expected null`);
      assert(old.path.length === 7, `old save got a path of length ${old.path.length}, expected 7`);
      assert(old.path[4] === 'boss', `old save path[4] is ${old.path[4]}, expected boss`);
      assert(old.path.every((p, i) => (i % 5 === 4 ? p === 'boss' : p === 'fight')), `old save path is ${old.path.join(',')}`);
      return `stage 7 without node/path → node null, path ${old.path.join(',')}`;
    },
  },
  {
    name: 'Elite pack DPS',
    run: () => {
      const out: string[] = [];
      for (let realm = 0; realm < LOCATIONS.length; realm++) {
        const bossStage = realm * 5 + 4;
        const bossDps = packDpsForWave(buildNodeWave(bossStage, 1, 'fight'), bossStage);
        // buildNodeWave's 'fight' is buildWave, and the boss wave is fixed.
        for (const step of [1, 2, 3]) {
          const stage = realm * 5 + step;
          let sum = 0;
          for (let seed = 1; seed <= 50; seed++) sum += packDpsForWave(buildNodeWave(stage, seed, 'elite'), stage);
          const meanDps = sum / 50;
          assert(meanDps < bossDps, `realm ${realm} step ${step} elite pack DPS ${meanDps.toFixed(1)} is not below the boss stage's ${bossDps.toFixed(1)}`);
        }
        out.push(`realm ${realm} < ${bossDps.toFixed(1)}`);
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
console.log(`path-check: ${passed}/${check.length} pass`);
if (passed !== check.length) process.exitCode = 1;
