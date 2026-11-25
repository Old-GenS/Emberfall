# Emberfall — Legends of the Shattered Vale

A handcrafted, single-page browser RPG and auto-battler. Choose one of four heroes, cross five ruined realms, collect boons, and put the Ashen King back in the ground.

**Play:** once the included GitHub Pages workflow finishes, the game is live at the Pages URL for this repository (for project sites, typically `https://<owner>.github.io/ds-rpg/`).

Everything you see and hear is original and generated at runtime: no external images, sprites, audio files, or fonts. The art is procedural canvas/SVG, and the soundtrack is synthesized live with the Web Audio API.

## Quick start

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build into dist/
npm run preview  # preview the production build
```

Requires Node 20+. Click once anywhere and the music begins (browser autoplay rules).

## How it plays

- **Pick a hero.** Each class has its own passive, three auto-cast skills, and a charged ultimate.
- **Combat is automatic.** The hero attacks and casts on cooldown. You decide when to spend the ultimate, and when to make the next run.
- **Five realms × five stages.** Every realm has a unique palette, bestiary, music theme and a boss at stage five.
- **Boons after every victory.** Three random choices; commons, rares, and class-specific epics. They stack for the whole run.
- **No death penalty.** Retry a stage as many times as you like. Each defeat grants a small Rally bonus for the next attempt.
- **Auto-save.** Progress is stored in `localStorage`. The title screen can resume, reset, or start a new run.

### Classes

| Class | Role | Signature |
| --- | --- | --- |
| The Warden | Armored guardian | Shields, stuns, damage reflection |
| The Pyromancer | Glass cannon | Burn damage, AoE nukes, meteors |
| The Shadowblade | Assassin | Poison, bleeds, guaranteed critical ultimate |
| The Spiritcaller | Sustain | Regeneration, healing, a summoned spirit wolf |

### Controls

| Input | Action |
| --- | --- |
| Click / tap | Menus, choose boons, unleash ultimate |
| `Space` or `1`–`3` | Release the ultimate when charged |
| `Esc` | Pause / resume |
| Speed button | Toggle 1× / 2× battle speed |

## Tech

- TypeScript + Vite, no runtime dependencies.
- Canvas 2D renderer: procedural parallax backgrounds, vector characters, particles, floating combat text.
- Web Audio synthesis: five original generative tracks (one per realm) plus a title/map theme, with reverb, pads, plucked arps, leads and drums; all SFX are synthesized too.
- DOM/CSS UI for menus, map, loadout and results.
- `localStorage` save file, no backend.
- GitHub Actions → GitHub Pages deployment.

## Project layout

```
src/
  main.ts       game flow, screens, battle loop, input
  combat.ts     deterministic-ish auto-battler engine (stats, statuses, AI)
  data.ts       classes, abilities, boons, enemies, realms, balance
  art.ts        procedural canvas art, SVG portraits/emblems
  audio.ts      Web Audio music sequencer and SFX
  state.ts      save data, XP/levels, boon rolls
  ui.ts         screen templates and icon set
  style.css     visual design
```

## Deployment

Pushes to `main` build and deploy through `.github/workflows/deploy.yml`. In the repository settings, set **Pages → Source** to **GitHub Actions**. The Vite base is relative (`./`), so it works from a project subpath.

## Notes

- Balance is tuned for a relaxed, readable auto-battler: most runs complete, bosses occasionally require a retry, and every defeat gives a stacking Rally bonus.
- Battles never stall: after 70 seconds a soft enrage increases all damage.
- Audio is optional and can be toggled separately for music and effects.
