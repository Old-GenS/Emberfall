# Painted unit art — prompt pack

The battle shows each hero and enemy as a painted image when one exists, and falls back to the code-drawn version when it doesn't. So art can arrive a few pieces at a time.

## How to add art

1. Generate the image with the prompts below and save it as `art/units/<id>.png` (`art/units/` is git-ignored; keep your originals elsewhere too).
2. Run `npm run units:prepare`. It removes the flat background, trims, finds the feet, and writes `public/assets/units/<id>.webp` plus `manifest.json`.
3. Run `npm run sprites -- --painted` and look at `sprite-out/painted-idle.png`, which shows every unit with its painted art.
4. Commit `public/assets/units/`.

Optional: `<id>-attack.png` with the same framing, mid-attack. The game cross-fades to it during attacks. Without one, attacks are a lean and lunge of the idle image.

## Rules for every image (give these to the image model each time)

- **Canvas:** square, 1024×1024 or larger, PNG.
- **Background:** one flat solid colour edge to edge, with no gradient, floor, shadow, vignette, texture or scenery. Use **pure green `#00FF00`**, except for the units marked **magenta** below, which use **pure magenta `#FF00FF`** because they are green themselves.
- **Framing:** one character, whole body in frame, nothing cropped. Feet (or lowest point) about 3% above the bottom edge, horizontally centred, about 10% empty margin at the top and sides.
- **Pose:** standing idle, **side-on three-quarter view facing right**, as if facing an enemy on the right. No ground line or cast shadow.
- **No text**, no frame, no border, no card or tarot-card layout, no signature.
- **Lighting:** lit from the upper front-right, with a soft rim light on the back edge.

### Style block (paste into every prompt)

> Dark gothic fantasy character illustration, painterly digital painting with confident dark ink linework, rich jewel tones glowing against deep shadow, stained-glass colour accents, dramatic chiaroscuro, highly detailed armour, cloth and texture, matching a gothic tarot card series. Full body, side three-quarter view facing right, isolated on a flat solid {BACKGROUND} background, no ground, no shadow, no text, no border.

Replace `{BACKGROUND}` with `pure green #00FF00` or `pure magenta #FF00FF`.

## Characters

Heroes should match their existing portraits (`public/assets/portraits/<id>.jpg`). Give the portrait to the image model as a reference if it accepts one.

### Heroes

| File id | Background | Prompt (after the style block) |
|---|---|---|
| `warden` | green | A tall knight in dark-blue plate armour with gold filigree, a great helm with a glowing gold cross-shaped visor, layered pauldrons, a gold sunburst on the breastplate, a blue kite shield with a gold sunburst, a longsword held ready, a deep-blue cloak with a tattered hem. Steadfast, protective. |
| `pyromancer` | green | A woman in a crimson hooded robe, her face half in shadow with ember-bright eyes, wide flowing sleeves, a rope belt hung with talismans, one hand raised holding a living flame of yellow, orange and red with rising embers, a phoenix-like curl of fire around her. |
| `shadowblade` | green | A lean assassin crouched low, knees bent, in a purple-black hood and face mask showing pale eyes, layered dark leather, two long scarf tails trailing behind, twin curved jade-green daggers held reverse-grip, a faint crescent-moon glow. |
| `spiritcaller` | **magenta** | A druid in a mossy green hooded robe with leaf and root embroidery, a hood crowned with branching antlers, a wooden staff hung with a glowing green lantern, three small spirit wisps around them, a ghostly green wolf spirit faintly at their side. |

### Realm I — the Ashen Reach (fire)

| File id | Background | Prompt |
|---|---|---|
| `cinder-imp` | green | A small hunched fire imp with curved horns, leathery bat wings, a long tail ending in a flame, charcoal skin with glowing orange cracks across its belly, grinning with ember eyes. |
| `ash-hound` | green | A lean charred hellhound on four legs, ribs showing through soot-black hide, glowing ember cracks along its body, smoke rising from its back, bared teeth. |
| `magma-brute` | green | A hulking ogre-golem of cooled black rock with rivers of glowing lava in the seams, enormous arms with knuckles near the ground, a small head sunk between massive shoulders. |
| `molten-warden` (boss) | green | A towering executioner in armour of cooling magma, molten metal dripping from glowing seams, a helm with a single slit of fire, a huge executioner's axe, a scorched tabard. |

### Realm II — the Whisperwood (forest)

| File id | Background | Prompt |
|---|---|---|
| `bramble-stalker` | **magenta** | A gaunt hunched humanoid woven from twisted thorny vines, long arms ending in thorn whips, glowing green eyes in a knot of roots. |
| `spore-wisp` | **magenta** | A floating mushroom spirit with a pale glowing domed cap with spots and gills underneath, wispy trailing tendrils instead of legs, glowing spores drifting around it. |
| `hollow-treant` | **magenta** | A hollow tree giant with cracked bark plates, a glowing green hollow in its chest, branch arms with twig fingers, root feet, hanging moss. |
| `pale-stag` (boss) | **magenta** | A spectral pure-white stag standing on four legs, enormous branching antlers, a moonlit silver glow, mist curling around its hooves, eerie green eyes. |

### Realm III — Frostveil (ice)

| File id | Background | Prompt |
|---|---|---|
| `rime-wolf` | green | A shaggy pale-blue wolf on four legs with frost-crusted fur, icicles in its mane, frosted breath, piercing ice-blue eyes. |
| `frost-wraith` | green | A floating spectral wraith in a tattered pale-blue cloak with no legs, skeletal hands, a crown of ice shards, the tatters dissolving into mist. |
| `ice-golem` | green | A massive golem built of faceted ice blocks with a glowing blue rune at its core, frost drifting from its shoulders. |
| `winters-herald` (boss) | green | A tall ice queen-angel with a crown of icicles, a frozen veil over her face, crystalline faceted wings, flowing frost-white robes, a staff topped with a star of ice. |

### Realm IV — the Sunken Sanctum (drowned)

| File id | Background | Prompt |
|---|---|---|
| `drowned-acolyte` | **magenta** | A hunched drowned priest in waterlogged teal robes, kelp hanging from the sleeves, a swinging censer on a chain, water dripping from the hem. |
| `tide-revenant` | **magenta** | A drowned soldier in a rusted helm and corroded armour, seaweed strands and barnacles, a long spear, sea-green glowing eyes. |
| `coral-sentinel` | green | A coral-encrusted armoured guardian holding a tall tower shield, pink and red coral spikes growing from its shoulders. |
| `leviathan-eye` (boss) | **magenta** | A giant abyssal eye with a slit pupil, ringed by rows of teeth, rising from churning dark water, six writhing tentacles around it. |

### Realm V — the Ember Throne (void)

| File id | Background | Prompt |
|---|---|---|
| `void-knight` | green | A dark knight in a horned helm and black plate armour with glowing violet cracks, a greatsword. No crown, no cape. |
| `ash-seraph` | green | A six-winged angel of ash with ember-tipped feathers, a faceless hood beneath a broken halo, burning robe tatters. |
| `dusk-wyrm` | green | A serpentine violet dragon with a long S-curved neck, membrane wings with finger bones, a glowing pink throat. |
| `ashen-king` (boss) | green | A towering lich-king in a ruined gold crown, burning red eyes, ember-cracked dark armour, a tattered purple cape, a flaming greatsword. |

### Ally

| File id | Background | Prompt |
|---|---|---|
| `spirit-wolf` | **magenta** | A ghostly spirit wolf on four legs, translucent glowing green with a soft inner light, wisps trailing from its fur. |
