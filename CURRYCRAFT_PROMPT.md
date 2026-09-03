# CURRYCRAFT — Prompt pro Claude Code

Zkopíruj celý tento dokument jako první zprávu do Claude Code v prázdné složce projektu (např. `C:\Users\adtur\Downloads\minecraft`). Je navržen tak, aby ho agent zvládl provést po fázích, s commitem a vizuální kontrolou po každé fázi.

---

## 0. Cíl a realistické očekávání

Postav hru **CurryCraft** — voxelový sandbox 1. osoba, hratelný přímo v prohlížeči (desktop, WebGL2), inspirovaný Minecraftem co nejvěrněji **v mechanikách a pocitu ze hry** (těžba/stavění bloků, crafting, přežití, den/noc, moby, procedurální nekonečný svět).

Doslovné bajt-pro-bajt „1:1" klony Minecraftu nejsou reálně dosažitelné v jednom promptu (Mojang na hře pracuje roky s desítkami lidí) a navíc **nesmíš použít skutečné copyrightované textury, zvuky, kód ani assety Mojangu/Microsoftu**. Cíl je proto: **originální hra se stejnou herní smyčkou a stejným pocitem ovládání**, postavená iterativně přes níže definované fáze (Definition of Done pro MVP = fáze 0–8). Fáze 9+ jsou stretch goals.

Po každé fázi udělej git commit, aktualizuj `PROGRESS.md` (checklist) a stručně mi napiš, co je hotové a co si mám v prohlížeči vyzkoušet, než půjdeš dál. Nepokračuj do další fáze, pokud předchozí fáze nejede bez chyb v `npm run dev`.

---

## 1. Právní/etická poznámka k assetům

- Žádné soubory z Minecraftu (textury `.png`, zvuky `.ogg`, model soubory, kód) se nesmí kopírovat ani stahovat.
- Textury bloků generuj **programaticky přes `<canvas>`** (pixel-art 16×16, styl podobný — barevné plochy, šum, okraje — ale originální) nebo použij výslovně CC0/public-domain pixel-art texture pack, pokud nějaký najdeš a uvedeš zdroj s licencí do `THIRD_PARTY_LICENSES.md`.
- Zvuky: buď procedurálně generované přes Web Audio API (jednoduché syntetizované tóny pro kroky/těžbu/UI), nebo CC0 zvuky s uvedením zdroje.
- Název „CurryCraft", logo a texty (loading tipy, achievementy) musí být originální, ne kopie Minecraft textů.

---

## 2. Technologický stack

- **TypeScript** (strict mode) + **Vite** (dev server + build)
- **three.js** (aktuální stabilní verze) jako WebGL renderer — vlastní voxel engine nad ním (Three.js nemá voxel systém, tvoříme ho na míru)
- **simplex-noise** (npm balíček) pro multi-octave terén, případně vlastní OpenSimplex implementace
- **Web Workers** (bez OffscreenCanvas — worker jen počítá data chunků a mesh geometrii, hlavní vlákno je uploaduje do GPU) pro generování terénu a greedy meshing, aby hlavní vlákno nezasekávalo hru
- **IndexedDB** (přes lehký wrapper, např. `idb`) pro ukládání světa/hráče
- **Zustand** nebo vlastní jednoduchý event store pro UI stav (inventář, HUD, menu) — žádný React nutně není potřeba, ale pokud usnadní HUD/inventář/menu, použij React + Zustand nad Three.js canvasem
- **Howler.js** nebo čistý Web Audio API pro zvuk
- **ESLint + Prettier**, **Vitest** pro unit testy jádrových systémů (noise gen, meshing, crafting matcher, inventory logika)
- Cílové prohlížeče: aktuální Chrome/Edge/Firefox desktop, vyžaduje WebGL2 a Pointer Lock API. Mobil/dotyk je stretch goal (fáze 10+), na začátku zobraz varování při nedostupném WebGL2/PointerLock.

---

## 3. Struktura projektu

```
currycraft/
  src/
    engine/
      world/          # Chunk, ChunkManager, World, VoxelData
      mesh/            # greedy meshing, texture atlas, geometry builder
      worldgen/        # noise, biomes, cave carving, ore placement, tree/structure decorators
      physics/         # AABB collision, raycasting, gravity
      lighting/        # block-light + skylight flood-fill propagation
      fluids/          # water/lava spread simulation
    game/
      player/          # controls, camera, health/hunger, inventory state
      entities/        # mob base class, AI state machine, jednotlivé moby
      items/           # item + block registry (data-driven JSON/TS definice)
      crafting/        # recipe registry + matcher (shaped/shapeless), smelting
      time/            # day/night cycle, tick loop
    ui/
      hud/             # hotbar, health, hunger, crosshair, debug overlay (F3)
      inventory/       # inventář + crafting grid overlay
      menu/            # hlavní menu, pause menu, nastavení, výběr/vytvoření světa
    persistence/       # IndexedDB save/load, world diff serializace
    audio/
    assets/            # programaticky generované textury/atlas, zvuky
    main.ts
  PROGRESS.md
  THIRD_PARTY_LICENSES.md
  README.md
```

---

## 4. Voxel engine — jádro

- **Chunk**: 16×16×128 bloků (X×Z×Y). Blok = `uint8`/`uint16` ID v typed array (`Uint16Array` o délce 16*16*128), ať je paměťově úsporné a rychlé.
- **Block registry**: datově řízený seznam bloků, každý má `{id, name, textures (top/side/bottom nebo all), solid, transparent, lightEmission, hardness, requiredToolTier, drops[]}`.
- **Texture atlas**: jeden spritesheet (např. 16×16 dlaždic po 16×16 px = 256×256 px canvas), `NearestFilter` + `magFilter/minFilter = THREE.NearestFilter`, `generateMipmaps = false` — zachová ostrý pixel-art vzhled jako Minecraft.
- **Meshing**: pro každý chunk spočítej mesh v Web Workeru:
  1. **Face culling** — nerenderuj stěnu mezi dvěma neprůhlednými bloky.
  2. **Greedy meshing** — sluč sousední stejné a stejně osvětlené stěny do větších quadů (viz algoritmus z 0fps.net / greedy meshing reference), sníží počet trojúhelníků o řád.
  3. Výsledek pošli zpět jako `{positions, normals, uvs, indices, lightValues}` transferable buffery → hlavní vlákno je nahraje do `THREE.BufferGeometry`.
- **Chunk streaming**: kolem hráče udržuj čtvercovou oblast chunků dle `renderDistance` (default 8 chunků, nastavitelné 4–16 v menu). Chunky mimo dosah ulož (pokud modifikované) a uvolni z paměti/GPU. Generuj a mesuj asynchronně (fronta úkolů), aby FPS neklesal při pohybu.
- **Frustum culling** přes `THREE.Frustum` na úrovni chunků (ne per-block).

---

## 5. Generování světa

- Deterministické podle **seedu** (string/number zadaný hráčem nebo náhodný při „New World").
- **Výškové mapy**: kombinuj 4–6 oktáv simplex noise (continentalness — velké kopce/oceány, erosion — hladkost terénu, detail noise pro drobnosti) → finální výška terénu na sloupec X,Z.
- **Biomy**: druhá dvojice noise map — teplota a vlhkost — a jednoduchá Whittaker-like tabulka určí biom: Pláně, Les, Poušť, Hory (sníh nad určitou výškou), Tajga, Tundra, Džungle, Bažina, Pláž, Oceán. Každý biom má vlastní povrchový blok (tráva/písek/sníh...), paletu stromů/vegetace a hustotu spawnu vegetace.
- **Jeskyně**: 3D simplex noise „density" funkce — kde hodnota překročí práh, blok se nevygeneruje (je vzduch), v pásmu y≈5–60. Volitelně přidej pár „worm" tunelů (náhodná procházka s měnícím se poloměrem) pro zajímavější jeskynní systémy.
- **Rudy**: pod povrchem generuj žíly (coal, iron, gold, diamond, redstone, lapis) — čím vzácnější ruda, tím nižší y-rozsah a menší pravděpodobnost výskytu (podobně jako v MC — coal časté a mělké, diamond vzácný a hluboký).
- **Bedrock**: nezničitelná vrstva na dně světa (y=0, případně náhodně 0–2).
- **Stromy a vegetace**: dekorátor po vygenerování povrchu chunku — na základě biomu a šumu umísti stromy (log + leaves), trávu, květiny, kaktusy (poušť) atd.
- **Voda**: sea level konstanta (např. y=62); vše pod ní a nevyplněné terénem = voda blok.

---

## 6. Hráč — pohyb, fyzika, kolize

- **Kamera**: `PerspectiveCamera`, FOV ~70–90° nastavitelné, first-person, výška očí ~1.62 bloku nad nohama (jako MC).
- **Ovládání kamery**: `PointerLockControls` (klik do canvasu → zamkne kurzor, myš = rozhlížení, Esc = odemkne a otevře pause menu).
- **Pohyb**: WASD relativní ke směru kamery (jen yaw, ne pitch), gravitace konstantně táhne dolů, AABB collision hráče (hitbox např. 0.6×1.8×0.6) proti voxelovému světu (swept AABB nebo jednoduchý axis-by-axis resolve).
- **Akce**: mezerník = skok (jen když stojí na zemi), Shift = sneak (pomalejší pohyb, kamera níž, nespadne z hrany bloku), Ctrl nebo dvojité-ťuknutí W = sprint (rychlejší pohyb, mírně širší FOV), plavání ve vodě sníží gravitaci a umožní vertikální pohyb (mezerník = nahoru).
- **Pád**: fall damage při dopadu z výšky > 3 bloky (poškození úměrné výšce pádu, kromě dopadu do vody).
- **Creative/Survival toggle** (aspoň pro vývoj/debug): creative = volný let (dvojitý mezerník = toggle fly), nekonečné bloky, bez poškození.

---

## 7. Interakce s bloky

- **Raycast** ze středu kamery do světa (max dosah 5 bloků), najde první neprůhledný blok a jeho stěnu (pro placement na sousední pozici).
- **Zvýraznění cíleného bloku**: tenký wireframe box kolem bloku pod kurzorem.
- **Těžba (levé tlačítko, drž)**: doba těžby závisí na tvrdosti bloku (`hardness`) a nástroji v ruce (nástroj bez správného tieru těží pomaleji nebo blok nedropne — např. kámen bez pickaxy se rozbije, ale nevypadne cobblestone). Progres těžby zobraz jako „crack" overlay texturu na bloku (5–10 stupňů poškození) + částice při rozbití.
- **Pokládání (pravé tlačítko)**: umístí aktuálně vybraný blok/item z hotbaru na sousední pozici cíleného bloku, pokud tam není kolize s hráčem.
- **Drops**: rozbitý blok vytvoří „item entity" (malá plovoucí/rotující kostička ve světě), kterou hráč sebere průchodem blízko ní (magnetický pull v malém rádiu).

---

## 8. Inventář, hotbar, crafting

- **Hotbar**: 9 slotů dole na obrazovce, výběr klávesami 1–9 nebo kolečkem myši, zvýraznění aktivního slotu.
- **Inventář** (klávesa E): mřížka 9×3 hlavních slotů + hotbar + **crafting grid 2×2** (bez crafting table) přímo v inventáři, jako v MC.
- **Crafting table** (postavitelný blok, right-click otevře): crafting grid **3×3** + výstupní slot.
- **Recipe systém**: datově řízené recepty, podpora shaped (tvar záleží na rozestavění) i shapeless (jen množství ingrediencí). Implementuj matcher, co porovná aktuální mřížku s registrem receptů.
- **Furnace** (pec): 3 sloty — input, fuel, output; smeltuje postupně (např. 10s na položku), fuel má různou „burn time" (uhlí > dřevo).
- **Nástroje a tiery**: Wood → Stone → Iron → Diamond. Vyšší tier těží rychleji a umožní těžit tvrdší bloky (viz tabulka níže). Nástroje mají **durabilitu** (počet použití, pak se zničí).

### Základní recepty (implementuj minimálně tyto)

| Recept | Vstup | Výstup |
|---|---|---|
| Prkna (planks) | 1× log | 4× planks |
| Klacek (stick) | 2× planks (ve sloupci) | 4× sticks |
| Crafting table | 4× planks (2×2) | 1× crafting table |
| Furnace | 8× cobblestone (rámeček 3×3 bez středu) | 1× furnace |
| Chest (truhla) | 8× planks (rámeček) | 1× chest |
| Pickaxe (dle tieru) | 3× materiál (řada nahoře) + 2× stick | 1× pickaxe |
| Axe | 3× materiál (do L tvaru) + 2× stick | 1× axe |
| Shovel | 1× materiál + 2× stick | 1× shovel |
| Sword | 2× materiál (sloupec) + 1× stick | 1× sword |
| Hoe | 2× materiál (řada) + 2× stick | 1× hoe |
| Torch | 1× coal/charcoal + 1× stick | 4× torches |
| Ladder | 7× sticks (mřížka) | 3× ladders |
| Door | 6× planks (2×3) | 3× doors |
| Glass (smelting) | 1× sand → furnace | 1× glass |
| Charcoal (smelting) | 1× log → furnace | 1× charcoal |
| Ingot (smelting) | 1× ruda → furnace | 1× ingot |
| Bread | 3× wheat (řada) | 1× bread |

### Tiery nástrojů a tvrdost

| Tier | Rychlost těžby (×) | Může těžit |
|---|---|---|
| Ruka | 1× | dirt, sand, leaves |
| Wood | 2× | + cobblestone, coal ore |
| Stone | 4× | + iron ore |
| Iron | 6× | + gold, redstone, lapis, diamond ore |
| Diamond | 8× | + obsidian |

---

## 9. Katalog bloků a itemů (minimální seznam pro MVP)

Terén/přírodní: `air, bedrock, stone, cobblestone, dirt, grass_block, sand, gravel, sandstone, snow, ice, water, lava, clay`

Dřevo/vegetace: `oak_log, oak_leaves, oak_planks, birch_log, birch_leaves, birch_planks, spruce_log, spruce_leaves, spruce_planks, sapling, tall_grass, flower_red, flower_yellow, cactus, mushroom`

Rudy a ingoty (item, ne blok): `coal_ore, iron_ore, gold_ore, diamond_ore, redstone_ore, lapis_ore` → drop `coal, iron_ingot (po smeltu), gold_ingot (po smeltu), raw_iron, raw_gold, diamond, redstone_dust, lapis_lazuli`

Vyrobené bloky: `glass, brick_block, torch, crafting_table, furnace, chest, ladder, door_wood, obsidian, wool` (stačí 1 barva pro MVP, rozšíření na 16 je stretch)

Nástroje/zbraně (item): `*_pickaxe, *_axe, *_shovel, *_sword, *_hoe` (×4 tiery: wood/stone/iron/diamond)

Jídlo: `apple, bread, cooked_beef, cooked_porkchop, cooked_chicken, wheat`

Celkem cca 60–70 ID — dostatečné na plnohodnotný survival gameplay loop, dál rozšiřuj podle chuti.

---

## 10. Přežití — zdraví, hlad, den/noc

- **Zdraví**: 20 HP (10 srdíček v UI, každá ikonka = 2 HP). Poškození z pádu, moby, utonutí, lávy, hladovění (pod 0 hladu ubírá HP). Smrt → respawn screen → nový spawn na počáteční/posledním bezpečném místě.
- **Hlad**: 20 bodů (10 ikon), postupně klesá s časem/aktivitou, pod určitou hranicí neumožní sprint, na 0 začne ubírat zdraví. Jídlo doplňuje hlad.
- **Dýchání pod vodou**: bublinový ukazatel, ubývá pod vodou, při 0 začne ubírat zdraví.
- **Den/noc cyklus**: jeden plný cyklus = 20 reálných minut (poměr jako ve vanilla MC), dynamická obloha (barva/slunce/měsíc pozice přes vertex/uniform shader nebo jednoduchý `Sky` objekt), hvězdy v noci, směrové světlo (slunce) mění intenzitu a barvu podle denní doby.
- **Spawn hostilních mobů**: váže se na light level (viz sekce 12) — tmavá místa (level < 7) v noci nebo v jeskyních mohou spawnovat nepřátele; na osvětlených místech (pochodně) ne.

---

## 11. Moby a AI

Implementuj jako entity se společnou base třídou (pozice, hitbox, health, AI state machine, jednoduchá gravitace/kolize stejná jako u hráče, ale bez ovládání hráčem).

- **Pasivní**: `cow, pig, sheep, chicken` — stav `Idle/Wander`, náhodně bloudí, utíkají když jsou udeřeni, drop masa/vlny/vajec.
- **Nepřátelské**: `zombie` (melee útok, chase při spatření hráče v rádiu), `skeleton` (drží odstup, střílí projektily), `spider` (rychlejší, umí šplhat), `creeper` (přiblíží se a po 1.5s exploduje — jednoduchý particle + damage v rádiu, zničí pár okolních bloků).
- **AI state machine**: `Idle → Wander → (uvidí hráče) Chase → Attack`, jednoduchý pathing (raycast dopředu, pokud blok v cestě a je jen o 1 vyšší, skoč přes něj; jinak obejdi). Plná A* není nutná pro MVP.
- **Souboj hráče**: levé tlačítko na moba = útok mečem/pěstí (damage podle zbraně), knockback, 0.5s invulnerability po zásahu (i-frames), smrt moba → drop itemů + despawn animace.

---

## 12. Osvětlení a tekutiny

- **Světlo**: 2 kanály na blok — `skyLight` (0–15, sloupcově shora dolů dokud nenarazí na neprůhledný blok, pak se šíří do stran BFS flood-fillem s poklesem -1/blok) a `blockLight` (0–15, zdroje jako pochodeň emitují 14, šíří se stejně BFS flood-fillem). Výsledná jasnost bloku = max(skyLight, blockLight) použitá jako vertex color multiplier v meshi (dá to typický měkký Minecraft look).
- **Tekutiny**: zjednodušený model — `level 0–7` (0 = source/plný), voda se šíří do sousedních prázdných/nižších pozic a klesá o 1 level na krok, max dosah 7 bloků od zdroje; padá dolů pokud je pod ní vzduch. Láva stejná logika, ale pomalejší tick a způsobuje poškození/oheň při kontaktu s hráčem/hořlavými bloky.

---

## 13. UI / HUD / Menu

- **HUD za hry**: crosshair uprostřed, hotbar dole (9 slotů + ikony itemů), srdíčka zdraví vlevo nahoře nad hotbarem, drumsticky hladu vpravo, bubliny dechu při plavání, volitelně XP bar. Debug overlay (klávesa F3): FPS, souřadnice hráče, chunk coords, biom, seed.
- **Inventory screen** (E): viz sekce 8.
- **Pause menu** (Esc za hry): Pokračovat / Nastavení / Uložit a odejít do hlavního menu.
- **Hlavní menu**: Nová hra (zadání jména světa + seed, volitelně prázdné = náhodný) / Načíst hru (seznam uložených světů) / Nastavení (render distance, hlasitost, citlivost myši, FOV) / (stretch: Multiplayer).
- **Loading screen**: progress bar generování počátečních chunků + rotující originální „tipy" texty (CurryCraft styl, ne kopie MC hlášek).

---

## 14. Ukládání / načítání (persistence)

- World se **negeneruje znovu celý** při ukládání — ukládej jen `seed` + **diff modifikovaných bloků** (sparse mapa `"cx,cy,cz,x,y,z" → blockId`), při načtení se svět znovu vygeneruje ze seedu a diff se aplikuje navrch.
- Ulož i: pozici/rotaci hráče, health/hunger/breath, inventář, herní čas (pro den/noc), název světa, seed, datum poslední hry (pro seznam ve „Load World").
- **IndexedDB** object store `worlds`, klíč = world id, autosave každých ~60s + explicitní save v pause menu. Podpora více uložených světů (seznam s náhledem: jméno, seed, poslední hraní).

---

## 15. Zvuk

- Kroky (mění se dle bloku pod nohama — např. jiný zvuk na trávě vs. kameni), zvuk těžby/rozbití bloku, zvuk pokládání, zvuk útoku/zásahu, zvuky mobů (ambientní), UI klik zvuk, ambientní hudební smyčka na pozadí (tichá, loopovaná).
- Implementuj přes Web Audio API/Howler s pozičním (3D) audio pro moby a okolí, ne pro UI zvuky.
- Master/hudba/efekty hlasitost nastavitelná v menu.

---

## 16. Výkon a optimalizace (checklist)

- [ ] Greedy meshing per chunk ve Web Workeru
- [ ] Face culling mezi neprůhlednými bloky
- [ ] Frustum culling na úrovni chunků
- [ ] Chunk streaming (load/unload podle vzdálenosti od hráče), práce rozložená přes více snímků (fronta, ne vše najednou)
- [ ] Jeden materiál/texture atlas → jeden draw call na chunk
- [ ] Object pooling pro item-entity drops a částice
- [ ] Instancing (`InstancedMesh`) pro opakující se vegetaci/moby stejného typu
- [ ] Cíl: 60 FPS na střední desktop grafice při render distance 8

---

## 17. Ovládání (výchozí keybindy)

| Klávesa | Akce |
|---|---|
| W/A/S/D | Pohyb |
| Myš | Rozhlížení |
| Mezerník | Skok / nahoru (plavání, fly) |
| Shift | Sneak / dolů (plavání, fly) |
| Ctrl / dvojklik W | Sprint |
| Levé tlačítko myši | Těžba / útok |
| Pravé tlačítko myši | Pokládání / použití |
| 1–9 | Výběr slotu hotbaru |
| Kolečko myši | Přepínání hotbar slotu |
| E | Inventář |
| Esc | Pause menu / uvolnění kurzoru |
| F3 | Debug overlay |
| F | Přepnutí fly (creative) |

---

## 18. Vývojové fáze (roadmap) — postupuj přesně v tomto pořadí

**Fáze 0 — Scaffold**: Vite + TS + three.js projekt, prázdná scéna, kamera, jeden textured cube, `npm run dev` funguje.

**Fáze 1 — Voxel jádro**: Chunk data struktura, block registry, texture atlas generovaný přes canvas, culled meshing pro jeden statický plochý chunk (16×16×N flat world), render v three.js.

**Fáze 2 — Nekonečný svět**: noise-based generování výšky + biomy, chunk streaming (load/unload kolem hráče), greedy meshing přesunutý do Web Workeru, stromy/vegetace dekorátory.

**Fáze 3 — Hráč a interakce**: PointerLockControls, gravitace + AABB kolize, raycast na bloky, těžba/pokládání s progress crack overlay, block outline highlight.

**Fáze 4 — Inventář a crafting**: hotbar UI, inventory screen, crafting grid (2×2 a 3×3 crafting table), recipe matcher, furnace smelting, durabilita nástrojů.

**Fáze 5 — Přežití**: zdraví, hlad, fall damage, den/noc cyklus s dynamickou oblohou, respawn.

**Fáze 6 — Moby**: base entity třída, pasivní i nepřátelští mobové, AI state machine, souboj, spawn logika vázaná na light level.

**Fáze 7 — Osvětlení a tekutiny**: block/sky light flood-fill propagace promítnutá do meshe (vertex shading), voda a láva se šířením.

**Fáze 8 — Persistence, menu, audio, polish**: IndexedDB save/load, hlavní menu + pause menu + nastavení, zvuky, loading screen, ladění výkonu. **→ Toto je MVP release CurryCraft 1.0.**

**Fáze 9+ (stretch, jen pokud MVP jede stabilně)**: multiplayer (WebSocket server, Node.js), redstone-lite (dráty, páky, dveře), enchanting, počasí, struktury (vesnice, doly), dotykové ovládání pro mobil, více biomů/bloků/receptů, achievementy.

---

## 19. Pravidla práce pro Claude Code

1. Používej TypeScript strict mode, modulární kód (žádný jeden obří soubor).
2. Po každé fázi: spusť `npm run dev`, ověř vizuálně/funkčně v prohlížeči (pokud máš k dispozici browser tool, otestuj to sám), teprve pak commitni a pokračuj.
3. Piš unit testy (Vitest) pro čistě logické části: noise/height funkce, greedy meshing algoritmus, recipe matcher, AABB kolize, inventory operace.
4. Aktualizuj `PROGRESS.md` checklist po každé dokončené fázi.
5. Neimplementuj fáze mimo pořadí a nepřidávej featury navíc, dokud není MVP (fáze 0–8) hotové a stabilní.
6. Pokud narazíš na nejasnost ve specifikaci, udělej rozumné rozhodnutí konzistentní se zbytkem dokumentu a pokračuj — nezastavuj se na maličkostech, ale u zásadních architektonických rozhodnutí (např. změna chunk size, zásadní změna tech stacku) se zeptej.
7. Assets vytvářej vždy jen originální (viz sekce 1) — nikdy nestahuj ani nekopíruj soubory z Minecraftu.

---

## 20. Definition of Done pro MVP (CurryCraft 1.0)

- [ ] Hráč spustí `npm run dev`, otevře se hra v prohlížeči na `localhost`
- [ ] Vytvoří nový svět se seedem, pohybuje se v nekonečně generujícím se voxelovém světě s více biomy
- [ ] Může těžit a pokládat bloky, sbírat itemy
- [ ] Má funkční hotbar, inventář a crafting (ruční 2×2 i crafting table 3×3), umí vyrobit nástroje a postoupit tiery wood→stone→iron→diamond
- [ ] Má furnace na smelting
- [ ] Má zdraví, hlad, umírá a respawnuje se
- [ ] Zažije den/noc cyklus s vizuální změnou oblohy
- [ ] Potká pasivní i nepřátelské moby, umí s nimi bojovat
- [ ] Voda a láva se chovají jako tekutiny, osvětlení pochodní funguje
- [ ] Může hru uložit a znovu načíst se zachovaným stavem
- [ ] Běží plynule (~60 FPS) na střední desktop konfiguraci

---

*Konec promptu. Vlož tento celý dokument do Claude Code jako zadání a nech ho postupovat fázi po fázi.*
