# CurryCraft — Progress

## Phase 0 — Scaffold ✅
- Vite + TypeScript + three.js project, dev server, resize handling.

## Phase 1 — Voxel jádro ✅
- Block registry (~45 blocks) with hardness/tool-tier/drop metadata: [src/game/items/blocks.ts](src/game/items/blocks.ts)
- Procedural texture atlas (canvas-drawn, no external assets): [src/engine/mesh/textureAtlas.ts](src/engine/mesh/textureAtlas.ts)
- Chunk data structure (16×16×128, `Uint16Array`): [src/engine/world/chunk.ts](src/engine/world/chunk.ts)
- Culled meshing (opaque + transparent split, baked per-face vertex shading): [src/engine/mesh/culledMesher.ts](src/engine/mesh/culledMesher.ts)
- Static test-chunk visual verification (via Browser tool + OrbitControls): [src/engine/world/testWorld.ts](src/engine/world/testWorld.ts)

### Gotcha found & fixed (important for later phases)
This environment's WebGL pipeline renders a texture as **solid black everywhere**
if the source canvas/DataTexture contains **any alpha=0 pixels anywhere**, even in
regions never sampled. Fix applied in `textureAtlas.ts`:
- Atlas canvases are pre-filled fully opaque (magenta debug color) before any
  tile is drawn, so unused tile slots never carry alpha=0.
- All draw helpers (`solid`, `speckled`, `grain`, `liquid`, `glassTile`,
  `crossFoliage`, ...) paint alpha=255 only — no `clearRect`/`rgba(...,<1)`.
  Per-block translucency (water/glass/lava) is done via the *material*
  (`transparent:true, opacity:0.7`), not per-pixel atlas alpha.
- Texture upload uses `THREE.DataTexture` from `ctx.getImageData(...)`
  rather than `THREE.CanvasTexture` directly (the raw canvas-to-WebGL share
  path was unreliable here too).
- `flipY = false` on the atlas texture (matches the `u0/v0/v1` math in
  `TextureAtlasBuilder.register`, which assumes row 0 = top, no flip).

**Consequence for Phase 2 (cross-shaped billboards for grass/flowers/saplings):**
true alpha-cutout sprites need a separate, non-shared texture (or `alphaTest`
on a dedicated material) rather than punching alpha holes in the shared atlas.

## Phase 2 — Nekonečný svět ✅
- Multi-octave simplex noise height + temperature/humidity biome picker (10
  biomes incl. mountains/ocean/beach height overrides): [src/engine/worldgen/terrain.ts](src/engine/worldgen/terrain.ts), [src/engine/worldgen/biomes.ts](src/engine/worldgen/biomes.ts)
- 3D-noise cave carving + per-ore depth-banded vein-ish placement (deterministic
  coordinate hashing, no sequential RNG state — safe across workers): [src/engine/worldgen/random.ts](src/engine/worldgen/random.ts)
- Tree decorator (oak/birch/spruce) + grass/flower scattering
- Block registry split: [src/game/items/blockDefs.ts](src/game/items/blockDefs.ts) (pure
  data, worker-safe) vs [src/game/items/blocks.ts](src/game/items/blocks.ts) (adds
  canvas texture tiles, main-thread only) — needed so meshing can run in a
  Web Worker without a `document`
- Terrain gen + culled meshing now run in a pooled Web Worker
  ([src/engine/mesh/chunkWorker.ts](src/engine/mesh/chunkWorker.ts)); main thread only
  builds `BufferGeometry` from the transferred typed arrays
- `ChunkManager` streams chunks in/out around a moving center point
  (circular render distance, dispose on unload): [src/engine/world/chunkManager.ts](src/engine/world/chunkManager.ts)
- Cross-shaped billboard geometry added to the mesher for `renderType:'cross'`
  blocks (grass/flowers/saplings/torch), using solid (non-cutout) textures —
  see the Phase 1 gotcha note above for why

### Known simplification (noted, not a bug)
Chunk meshing does not look at neighboring chunks' block data, so boundary
faces between adjacent chunks always render on both sides (visually correct,
some redundant hidden geometry at seams). Fine for now; revisit if profiling
in Phase 9 polish shows it matters.

## Phase 3 — Hráč a interakce ✅
- `PointerLockControls` for mouse-look + custom WASD/sprint/sneak/jump/fly
  movement: [src/game/player/playerController.ts](src/game/player/playerController.ts)
- Axis-separated AABB collision (binary-search boundary resolve, Y-then-X-then-Z)
  against `ChunkManager.isSolid`: [src/engine/physics/voxelPhysics.ts](src/engine/physics/voxelPhysics.ts)
- Amanatides & Woo voxel DDA raycasting for block targeting (no mesh raycasting
  needed): [src/engine/world/voxelRaycast.ts](src/engine/world/voxelRaycast.ts)
- Break (left click) / place (right click) wired to `ChunkManager.setBlock`,
  which edits the chunk's block array and remeshes just that chunk on the main
  thread; block-outline wireframe highlight on the targeted block; 5-slot
  hotbar (keys 1-5, placeholder blocks — real inventory is Phase 4)
- Click-to-play overlay + crosshair, shown/hidden on pointer lock/unlock

### Verified how (important caveat)
This dev sandbox's browser pane is CDP-automated, and `document.pointerLockElement`
never actually engages here even on a real click (a known restriction of many
automated/remote-controlled Chromium setups) — so the mouse-look + click-to-break
interaction could not be visually demoed inside this harness. Instead verified
directly by driving `PlayerController.update()` / `ChunkManager.isSolid|getBlock|setBlock`
/ `raycastVoxels` from the console: gravity + landing (fell from y=90 to
y≈59 and stopped, `grounded:true`), WASD-driven movement, a straight-down
raycast hitting the correct block+face normal, and a set→get→remove block
edit round-trip. **Please sanity-check pointer lock / mouse-look yourself in
a normal browser tab** (`npm run dev` → open http://localhost:5173) since
that's the one control path this harness structurally can't exercise.

## Phase 4 — Inventář a crafting ✅
- Item registry (blocks-as-items + tools/ingots/food, ~35 non-block items):
  [src/game/items/items.ts](src/game/items/items.ts)
- `Inventory` (9 hotbar + 27 storage) with vanilla-style click-to-hold-then-place
  slot interaction (`Inventory.clickSlot`, right-click = half-stack):
  [src/game/player/inventory.ts](src/game/player/inventory.ts)
- Shaped/shapeless recipe registry + bounding-box + mirror-aware matcher
  (~30 recipes incl. all 4 tool tiers × 5 tool types generatively):
  [src/game/crafting/recipes.ts](src/game/crafting/recipes.ts), [src/game/crafting/craftingMatcher.ts](src/game/crafting/craftingMatcher.ts)
- Furnace smelting + fuel burn-time state machine, ticked every frame:
  [src/game/crafting/furnaceManager.ts](src/game/crafting/furnaceManager.ts)
- `GameUI`: hotbar HUD, inventory screen (E, 2×2 grid), crafting-table screen
  (right-click table → 3×3 grid), furnace screen (right-click furnace):
  [src/ui/gameUI.ts](src/ui/gameUI.ts)
- Breaking now checks `minToolTier` for pickaxe-gated blocks (stone/ores/
  obsidian) before granting a drop, matching the tool-tier table in the spec;
  wrong/no tool still breaks the block, just no item

### Verified how
Pointer lock is unavailable in this harness (see Phase 3 note), but the
inventory/crafting UI is plain DOM and needed no pointer lock to test — used
real simulated mouse clicks (not just console calls) end-to-end: opened the
inventory (E), picked up a log from the hotbar, dropped it in the 2×2 grid,
watched the output slot correctly show 4 oak planks, collected them, saw the
log stack decrement and the planks land in storage. Furnace smelting verified
via the manager directly (5 sand + coal fuel over 20 simulated seconds →
2 glass, 1 coal consumed, correct remaining burn time).

## Phase 5 — Přežití ✅
- `SurvivalState`: 20 HP / 20 hunger, hunger drains over time (faster while
  sprinting), starves for damage at 0 hunger, regenerates health when hunger
  is high; `eat()` for food items: [src/game/player/survival.ts](src/game/player/survival.ts)
- Fall damage tracked in `PlayerController` (peak height since last grounded
  → damage on landing if >3 blocks, skipped while flying), applied via
  `survival.takeDamage()` in the main loop — kept out of the physics/movement
  class on purpose so HP stays a separate concern
- `GameClock`: 20-minute (1200s) day/night cycle, sine sun elevation drives
  sky/fog color (day → sunset → night → dawn) and a cheap night-darkness
  overlay div (real per-block light response is Phase 7's job, see the
  baked-vertex-shading note in Phase 1): [src/game/time/gameClock.ts](src/game/time/gameClock.ts)
- Death screen + respawn-at-spawn-point button; hearts/hunger HUD:
  [src/ui/hud/survivalHUD.ts](src/ui/hud/survivalHUD.ts)
- Right-click with a food item selected now eats it (checked before the
  place-block path)

### Verified how
Console-driven test (pointer lock still unavailable in this harness, see
Phase 3): simulated 200s of hunger drain (20→4, matches the 12s/point rate),
starvation → 0 HP → `dead:true`, `respawn()` → full HP / 10 hunger; sampled
the day/night sky color at four points across one full cycle and got the
expected day → dusk-orange → night progression; fall-damage math checked
(minor test-harness quirk noted in code review, not a game bug: manually
setting `position` bypasses the per-frame peak-height tracking that a real
play session updates continuously).

### Known gap (deferred to Phase 7 on purpose)
Water blocks aren't solid yet, so there's no swimming resistance or breath/
drowning mechanic — falling into water currently behaves like falling through
air. This is grouped with Phase 7 (fluids) rather than Phase 5 since it needs
the same "is this block a liquid" handling as fluid flow simulation.

## Phase 6 — Moby ✅
- `Entity` base class shares the exact same AABB/gravity physics as the
  player (`stepPhysics`) so mobs collide with terrain correctly for free:
  [src/game/entities/entity.ts](src/game/entities/entity.ts)
- Procedural box-built mob silhouettes (cow/pig/sheep/chicken/zombie/skeleton/
  spider/creeper) — same no-external-assets approach as block textures:
  [src/game/entities/mobMeshes.ts](src/game/entities/mobMeshes.ts)
- `Mob` state machine: Idle/Wander for passive, +Chase/Attack for hostile,
  +Flee when hit, +Fuse for the creeper (proximity-triggered countdown →
  AoE damage + self-destruct): [src/game/entities/mob.ts](src/game/entities/mob.ts)
- `MobManager`: spawns passive mobs by day / hostile by night near the player
  on valid grass-ish surface columns (via a `findSurfaceY` scan), caps
  population, despawns far-away mobs, ticks AI, brute-force ray-vs-mob-sphere
  hit test for combat (mobs are `THREE.Group`s of boxes, not one raycastable
  mesh — fine at this mob count): [src/game/entities/mobManager.ts](src/game/entities/mobManager.ts)
- Combat wired into the existing left-click handler (checked before block
  breaking): damage = held item's `attackDamage` (swords > axes > everything
  else, see the Phase 6 items.ts tweak), knockback, tool durability loss;
  kill drops go straight into the player's inventory

### Known simplifications (noted, not bugs)
- Hostile spawning is gated on `clock.getSky().isNight` only — real per-block
  light-level gating (torches keeping an area safe at night) is Phase 7's job
  once block/sky light propagation exists.
- Skeleton "shoots" at melee range for now (no projectile arrows yet) — listed
  as a stretch-goal polish item, not core to the MVP loop.
- No mob pathfinding/jumping over obstacles yet (straight-line movement only,
  physics still stops them at walls) — acceptable for MVP, matches the
  "simple steering, not full A*" scope from the original design doc.

### Verified how
Console-driven (pointer lock still unavailable in this harness): manually
ticked `MobManager` to confirm auto-spawning works (found real terrain via
`findSurfaceY`, spawned mobs, respected day/night gating); spawned a zombie
directly, dealt lethal damage, confirmed `dead:true` and drop item(s) landed
in inventory; spawned a creeper next to the test player position, ticked
through its fuse, and confirmed the explosion callback fired with the
expected damage/radius and the creeper died. (One console/HMR hiccup mid-test
— the harness's own network stack briefly suspended and Vite's dev-client
reconnect triggered a full page reload, wiping in-memory test state; unrelated
to game code, just restarted the manual verification.)

## Phase 7 — Osvětlení a tekutiny ✅
- Per-chunk BFS light propagation (combined sky+block channel, 0-15): seeds
  every open-air column cell down to the first opaque block (so an
  unobstructed shaft stays fully lit) plus every light-emitting block, then
  floods outward with -1 falloff through transparent blocks. Computed in the
  chunk worker right alongside meshing, and again on the main thread whenever
  a block edit requires a remesh: [src/engine/lighting/lightPropagation.ts](src/engine/lighting/lightPropagation.ts)
- Mesher now multiplies each face's baked shade by the light level of the
  transparent cell it faces into (not its own — solid blocks don't hold
  light, matching vanilla): [src/engine/mesh/culledMesher.ts](src/engine/mesh/culledMesher.ts)
- `ChunkManager.getLightLevel()` exposes it for gameplay code
- Swimming physics (reduced gravity, capped rise/fall speed, slower move
  speed) + breath meter that drains underwater and damages at 0, regenerates
  on surfacing; continuous lava damage: [src/game/player/playerController.ts](src/game/player/playerController.ts), [src/game/player/survival.ts](src/game/player/survival.ts)
- Breath-bubble HUD row (only shown while it matters): [src/ui/hud/survivalHUD.ts](src/ui/hud/survivalHUD.ts)
- Hostile mob spawning now gated on real light level (≤7, vanilla's
  threshold) instead of just night — works for caves at midday too, not only
  after dark: [src/game/entities/mobManager.ts](src/game/entities/mobManager.ts)
- Ran a full `tsc --noEmit` pass and fixed 3 real type bugs it caught (a
  stale `CanvasTexture` field type left over from the Phase 1 DataTexture
  fix, and `ItemDef.toolType` incorrectly reusing blockDefs' narrower
  block-harvest `ToolType` instead of a separate type that includes
  sword/hoe) — worth doing this check periodically, Vite's dev server only
  transpiles and doesn't type-check

### Known simplification (documented on purpose, not a bug)
No dynamic fluid spreading — water/lava placed by world-gen is static, it
doesn't flow to fill new space when terrain changes nearby. Implementing
real leveled flow (0-7 falloff like vanilla) needs either extending the
block-id space per fluid level or a parallel per-chunk metadata array,
which is a big enough architectural addition that it's pushed to the
stretch-goal phases (§18 Fáze 9+) rather than bolted on here. Swimming,
breath, and lava damage all work against the static fluid blocks already
in the world, so the gameplay loop this phase promised is intact.

### Verified how
Console-driven (pointer lock still unavailable in this harness): read light
levels down a real terrain column (open air → 15, through water → still 15,
into solid stone → 0); carved a 3×3×3 pocket underground, placed a torch,
and confirmed light read 14/13/12 at increasing distance before dropping to
0 at the pocket's solid boundary — an exact match for the falloff design.
Positioned the player inside real water and confirmed `headUnderwater`/
`inWater` flags set correctly; ran `SurvivalState.updateBreath` for 10
simulated seconds submerged (breath 10→0) then resurfaced (regenerated to
10). Visually confirmed outdoor terrain still renders identically to
pre-lighting screenshots (everything outdoors is fully sky-lit, as expected)
so this didn't regress Phases 1-2's rendering.

## Phase 8 — Persistence, menu, audio, polish ✅ — CurryCraft 1.0 (MVP) reached
- **Persistence**: IndexedDB (`idb`) stores seed + a sparse block-edit diff
  (not the whole world) + inventory + player position/rotation/health/hunger/
  breath + game clock. `ChunkManager` tracks every player edit and replays
  the relevant diff onto each chunk as it streams back in from the worker:
  [src/persistence/saveSystem.ts](src/persistence/saveSystem.ts), `ChunkManager.getEdits/loadEdits` in [src/engine/world/chunkManager.ts](src/engine/world/chunkManager.ts)
- **Main menu**: New World (name + optional seed), Load World (list/play/
  delete saved worlds), Settings (render distance, mouse sensitivity, FOV,
  master/sfx/music volume — persisted to `localStorage`):
  [src/ui/mainMenu.ts](src/ui/mainMenu.ts), [src/persistence/settings.ts](src/persistence/settings.ts)
- **Pause menu**: Esc mid-game → Resume / Settings / Save & Quit (saves then
  reloads the page back to the main menu — the simplest reliable way to fully
  tear down the Three.js scene, workers, and DOM for a clean restart)
- **Loading screen**: progress bar tracking real chunk-ready count + rotating
  original tip text: [src/ui/loadingScreen.ts](src/ui/loadingScreen.ts)
- **Audio**: fully procedural Web Audio (noise-burst footsteps that vary by
  the block underfoot, break/place/hit/damage/craft/UI-click sounds, a
  looping ambient drone) — no external audio files, same originals-only rule
  as the visuals: [src/audio/soundEngine.ts](src/audio/soundEngine.ts)
- **`main.ts` restructured**: was one big top-level script; now a `MainMenu`
  boots first and `startGame(opts)` (still in main.ts) wires up a session
  from either a fresh seed or a loaded save

### UI visual pass (mid-Phase-8, user-directed)
The user shared 3 reference screenshots of vanilla Minecraft's own main
menu, inventory, and hotbar and asked for CurryCraft's UI to match that
*style* closely (branded as CurryCraft, not copying Mojang's actual assets
or wordmark). Built a shared "chunky beveled stone GUI" system and reskinned
every screen with it:
- [src/ui/pixelStyle.ts](src/ui/pixelStyle.ts) — raised/sunken 2px-bevel CSS
  (buttons pop out, slots sink in, both get a solid black pixel outline),
  shared panel/button/slot/input style builders, the carved-letters logo
  text-shadow technique
- [src/ui/pixelIcons.ts](src/ui/pixelIcons.ts) — hand-authored pixel-grid
  heart/drumstick/bubble bitmaps rendered to tiny canvases → data-URLs,
  scaled crisply via `image-rendering:pixelated` (set globally in
  [index.html](index.html)) — replaces the old emoji-based HUD icons
- "Press Start 2P" (Google Fonts, OFL-licensed) for the blocky CURRYCRAFT
  logo + titles only; regular UI text stays in a readable system font
- Applied to: main menu incl. a rotating original splash-text joke in the
  corner (not Mojang's actual splash strings), New World / Load World /
  Settings screens, the in-game pause/intro overlay, and the hotbar/
  inventory/crafting-table/furnace slots in [src/ui/gameUI.ts](src/ui/gameUI.ts)
- Visually verified via the Browser tool against the reference layout
  (menu button stack, 2×2-grid→arrow→output crafting layout, sunken hotbar
  slots with a white selected-slot outline) — close match, the one
  intentional omission is the character/armor-preview column from vanilla's
  inventory screen, since CurryCraft has no skins/armor system (out of MVP
  scope)

### Known simplifications (documented on purpose)
- "Save & Quit" does a full `location.reload()` rather than manually
  disposing every Three.js/worker/DOM resource in place — reliable, if not
  the most elegant, and the save happens first so nothing is lost.
- Settings changes to render distance only take effect on next world load
  (ChunkManager is constructed once per session with a fixed render
  distance); FOV and mouse sensitivity DO apply live from the pause menu.

### Verified how
Real simulated mouse clicks through the Browser tool (pointer-lock-gated
gameplay is still the one thing this harness can't exercise — see the Phase
3 note): created a new world end-to-end through the main menu → loading
screen → gameplay HUD; round-tripped `saveWorld`/`listWorlds`/`loadWorld`/
`deleteWorld` through real IndexedDB with full data fidelity; opened the
inventory screen and visually confirmed the reskinned panel/slot/crafting
layout. Ran `tsc --noEmit` clean after every source change in this phase.

---

## MVP Definition of Done — status
- [x] `npm run dev` opens the game in a browser at localhost
- [x] New seeded world, infinite streamed generation, multiple biomes
- [x] Break/place blocks, collect items
- [x] Hotbar + inventory + crafting (hand 2×2 and table 3×3), tool tiers
      wood→stone→iron→diamond
- [x] Furnace smelting
- [x] Health, hunger, death + respawn
- [x] Day/night cycle with visual sky change
- [x] Passive + hostile mobs, combat
- [x] Water/lava behave like liquids (static, not flowing — see Phase 7
      note) + torches light the world correctly
- [x] Save and reload a world with state intact
- [ ] Runs at a smooth ~60 FPS on mid desktop hardware — **not verified**,
      this harness can't measure real frame timing meaningfully; ask a real
      browser tab and watch the F3-style debug HUD (top-left) if this matters

See [CURRYCRAFT_PROMPT.md](CURRYCRAFT_PROMPT.md) §18 for stretch goals
(Fáze 9+: multiplayer, redstone, weather, structures, mobile controls, more
biomes/recipes) if you want to keep going past the MVP.

---

## Post-MVP: user bug reports + content expansion

User play-tested in a real browser tab (the one thing this harness can't do)
and reported 3 bugs, all fixed and verified:
- **A/D strafe was inverted** — `playerController.ts`'s right-vector had a
  stray `.negate()` from an earlier draft that never got removed. Verified
  via console: D now moves +X (camera-right when facing default -Z), A
  moves -X.
- **Caves looked like transparent holes into the void** — not a rendering
  bug, a legibility one: unlit faces were floored at 4% brightness
  (`MIN_LIGHT_FACTOR` in [culledMesher.ts](src/engine/mesh/culledMesher.ts)),
  indistinguishable from empty space against a dark background. Raised to
  18% — caves stay dark/moody (torches still matter) but read as solid rock.
- **Mouse stayed camera-locked while the inventory (E) was open**, so you
  couldn't click slots — `GameUI` only released pointer lock when opening
  the crafting table/furnace, not the plain inventory screen. Added an
  `onOpenScreen` callback fired from all three `open*()` methods, wired to
  `player.controls.unlock()` in main.ts.

### Content expansion (user asked for "as much of real Minecraft as possible")
Added everything below with a genuine in-game obtain path — deliberately did
*not* pad the item list with things that would have no way to craft/find
(see the "what's still missing" note):
- **7 storage blocks** (iron/gold/diamond/coal/lapis/redstone/emerald) +
  emerald ore, both directions (9 ingot/gem ↔ 1 block, matching vanilla's
  own ratio) — [blockDefs.ts](src/game/items/blockDefs.ts)/[blocks.ts](src/game/items/blocks.ts)/[recipes.ts](src/game/crafting/recipes.ts)
- **6 dyes** each with a real source (flower_red/yellow → dye, lapis → blue,
  coal → black, bone → white, cactus smelted → green, matching or closely
  mirroring vanilla's actual dye sources) + **5 more wool colors** via
  `wool + dye → wool_<color>`
- **Full armor system**: 16 items (leather/iron/gold/diamond ×
  helmet/chestplate/leggings/boots) with vanilla's exact defense values,
  shaped recipes matching vanilla's patterns, 4 dedicated armor slots in the
  inventory screen (type-validated — a helmet only fits the helmet slot),
  and a damage-reduction formula applied to every damage source (fall, mob
  hits, explosions, lava) — matches vanilla's -4%/point, capped at 20:
  [inventory.ts](src/game/player/inventory.ts), `applyDamage()` in [main.ts](src/main.ts)
- **Buckets**: craftable empty bucket; right-click a water/lava source with
  it to scoop (removes the block, gives a filled bucket); right-click with a
  filled bucket to place the fluid back and get the empty bucket back
- **More food**: carrot/potato (zombie drops, matching vanilla's own rare
  zombie loot table), baked potato (furnace), golden apple (apple + 8 gold
  ingots, vanilla's real recipe)
- **Leather** added as a cow drop (also needed for leather armor)

### What's still missing vs. real Minecraft (honest scope note)
Didn't add: stairs/slabs/fences/panes (need new non-full-cube mesh geometry,
a bigger mesher change than this pass), redstone circuits (lever/repeater/
comparator logic), enchanting/potions, farming (seeds/crop growth — carrot/
potato are drop-only for now), beds/boats/minecarts (dedicated physics),
villagers/trading, the Nether/End dimensions, and the other ~5 vanilla wool
colors that don't have a clean ingredient source in this world yet. These
are reasonable Fáze 9+ candidates, not silently dropped — flagging them so
nothing is assumed done that isn't.

### Verified how
Console-driven + real clicks (pointer lock still blocked in this harness):
confirmed D/A move the correct world-space direction after the fix; matched
every new recipe type (storage both directions, armor, dye, wool-dye,
bucket) through the real `matchRecipe` function; equipped a full diamond
armor set and confirmed `getTotalDefense()` returns 20 (matches vanilla) and
`applyDamage(10)` correctly reduces to 2 HP lost (80% reduction, capped) vs.
10 HP lost unarmored; opened the inventory with real mouse clicks and
visually confirmed the 4 armor slots render with per-type placeholder labels
and reject/accept items correctly, then equipped a diamond helmet by
clicking it from the hotbar into the helmet slot.
