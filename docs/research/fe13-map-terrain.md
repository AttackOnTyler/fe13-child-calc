# Where Awakening's ROM keeps map terrain, and how it is encoded

Answers [#236](https://github.com/AttackOnTyler/fe13-child-calc/issues/236) (part of #224).
Verified on 2026-09-27 against the user's own dump, *Fire Emblem Awakening (US), CTR-P-AFEE v0.0.0*,
decrypted CCI. No ROM bytes are committed here; everything below is a small derived fact
(offsets, dimensions, ids, and the game's own table values).

## TL;DR

| What | Where (romfs) | Encoding |
|---|---|---|
| Terrain grid + map size, per map | `data/terrain/<MAP>.bin.lz` | LZ13 wrapper around LZ11, then a standard FE13 `.bin`: `u32 width, u32 height, u8 grid[32*32]` (row-major, stride 32, one terrain index per tile) |
| Unit placement (player start tiles, deployment slots, enemies) | `data/dispos/<CHAPTER>.bin.lz` | LZ13/LZ11, `.bin`: faction list, then 0x74-byte spawn records with `x,y` bytes |
| Terrain types (names, Def/Avo/Heal, movement-cost column) | `data/GameData.bin.lz`, labels `TerrainData`, `TerrainCategoryData` | 71 x 28-byte tile records; 18 x 4-byte category records `[def, avo, heal%, 0]` |
| Movement cost per movement class | `data/GameData.bin.lz`, label `TerrainCostData` | `u32 18`, then 14 rows x 20 bytes (18 costs + 2 pad), `0xFF` = impassable. The row is the class's `mov_cost_index` |
| Chapter ids and names | `GameData.bin` `ChapterData` (`CID_*`) plus text `m/E/GameData.bin.lz` (`MCID_*`) | see the table below |

Chapter ids: `P001` = Premonition, `P002` = Prologue, `001` to `025` = Chapters 1 to 25, `026` = Endgame,
`X001` to `X023` = Paralogues 1 to 23. `000` ("Chapter 0: A New Fight") is a 32x32 test map, and `E000` is the Outrealm Gate.
**Each chapter loads the terrain file with its own id, with one exception: Premonition (`P001`) loads `023`**
(the Dragon's Table). There is no `data/terrain/P001.bin.lz`.

## 1. Extracting the romfs locally

`ctrtool.exe` in the decryptor folder is neimod/3DSGuy CTRTOOL (built 2018-07-18). The CCI is already
decrypted, so pass `-p` (plain) and pick NCCH partition 0:

```sh
cd "C:/Users/tyler/Downloads/Batch CIA 3DS Decryptor"
./ctrtool.exe -p --ncch=0 \
  --romfsdir="<scratch>/romfs" \
  --exefsdir="<scratch>/exefs" \
  "00040000000A0500 Fire Emblem Awakening (CTR-P-AFEE) (v0.0.0) (U).legit-decrypted.cci"
```

This takes about 15 s and writes about 1.1 GB. `<scratch>` must be outside the repo, or gitignored.
Use `--listromfs` to list files without extracting. It only reads the CCI.

Folders that matter:

```
romfs/data/terrain/   000 P002 001..026 X001..X023 (.bin.lz)          terrain grid
romfs/data/dispos/    000 P001 P002 001..026 X001..X023, *E variants,  unit placement
                      aDebug  (.bin.lz)
romfs/data/GameData.bin.lz                                            terrain / cost / job / chapter tables
romfs/m/E/GameData.bin.lz                                             English names (MCID_*, MTID_*, MJID_*)
romfs/scripts/<CH>.cmb                                                chapter script (calls ev::TerrainLoad)
romfs/map/terrain/<MAP>.bcres.lz                                      3D map model (not needed)
romfs/map/data/<MAP>.bin                                              lighting/music config (not needed)
romfs/map/height/<MAP>.bin                                            height field (not needed)
```

## 2. Compression: "LZ13", which is LZ11 with a 4-byte prefix

Every `.lz` file starts `13 xx xx xx 11 xx xx xx`. FEAT handles it by checking
`filedata[0] == 0x13 && filedata[4] == 0x11`, skipping the first 4 bytes, and running a plain
**Nintendo LZ11** decompressor on the rest
([SciresM/FEAT `FEAT/Form1.cs`](https://github.com/SciresM/FEAT/blob/66ba34be648006874df9d103160b2c0b1478f8df/FEAT/Form1.cs#L160-L163)).
LZ11 has a 24-bit size in the header, or `0` followed by a 32-bit size. Each flag byte covers 8 tokens, MSB first.
A token's high nibble 0 means length `+0x11` (3-byte token), 1 means length `+0x111` (4-byte token), and
anything else means length `nibble+1`. The displacement is always `+1`. A 25-line decoder decoded all ~280 `data/**/*.bin.lz` files plus
`m/E/GameData.bin.lz` to their declared sizes.

`map/data/*.bin` and `map/height/*.bin` are not compressed.

## 3. The FE13 `.bin` container

All data files use this container
([RainThunder/fefates-tools wiki, "BIN (File Format)"](https://github.com/RainThunder/fefates-tools/wiki/BIN-(File-Format)),
which covers Awakening and Fates). All values are little-endian:

| Offset | Size | Field |
|---|---|---|
| 0x00 | 4 | file size |
| 0x04 | 4 | data region size D |
| 0x08 | 4 | P1: count of pointer offsets (each a u32 offset into data where a pointer lives) |
| 0x0C | 4 | P2: count of labels (`u32 data_offset, u32 label_offset`) |
| 0x10 | 16 | zero |
| 0x20 | D | **data region**. Every pointer and offset is relative to 0x20 |
| 0x20+D | 4*P1 | pointer table |
| ... | 8*P2 | label table |
| ... | rest | Shift-JIS strings (labels and string fields) |

A string field is a u32 pointer whose data offset is listed in the P1 table. Follow it (+0x20) to a
NUL-terminated Shift-JIS string. Labels such as `TerrainData` mark where a table starts.

## 4. Terrain grid: `data/terrain/<MAP>.bin`

The data region is exactly 0x408 bytes (the file is always 1064 bytes, with P1 = P2 = 0). This matches Paragon's `Grid` type
([thane98/paragon `Data/FE13/Types/Grid.yml`](https://github.com/thane98/paragon/blob/d11d601889c3ea391aff02f9ad546e9e2ed42ea5/Data/FE13/Types/Grid.yml)):

| Data offset | File offset | Type | Field |
|---|---|---|---|
| 0x000 | 0x20 | u32 | `map_width` (columns, x) |
| 0x004 | 0x24 | u32 | `map_height` (rows, y) |
| 0x008 | 0x28 | u8[1024] | grid: `tile(x,y) = grid[y*32 + x]`. The array is always 32x32. Cells outside `width x height` are 0 |

Each byte is an **index into `TerrainData`** (0..70, section 6). Index 0 is `TID_移動不可` ("Obstacle",
impassable), and it also appears inside the map bounds.

The row-major layout and the width-first order were checked on the non-square maps. On `002` (17x22),
columns 0..16 of rows 0..21 are filled. On `003` (23x17), columns 0..22 of rows 0..16 are filled. The dispos coordinates
(section 5) land on sensible tiles.

### Verified example: Prologue (`P002`, Southtown), 17 x 16

Rendered from the dump with the game's player start tiles `p` and enemy tiles `e` (all difficulties) drawn over it.
Legend: `.` Plain (1), `~` Water/river (0x10), `=` Bridge (0x44), `#` Obstacle (0) / Edifice (0x1d), `?` Partition (0x25).

```
......#####......
........e........
......e.e.e......
~~~~~~~e=e~~~~~~~
~~~~~~~===~~~~~~~
~~~~~~~===~~~~~~~
..........e~~....
...........~~....
.e.??..??..==....
.......e...==....
....e......~~....
...??..??..~~~==~
.........e.~~~==~
.p.p.......~~....
..p.p......~~....
...........~~....
```

Player starts: Chrom (3,13), Robin (4,14), Lissa (1,13), Frederick (2,14). The boss is at (8,1), past the
three-wide bridge over the river. The layout is plausible (a river crossing with brigands north of it),
but it has not been compared against an in-game screenshot yet.

Premonition (`P001`) is placed on the `023` grid (27x27): Chrom (2,5), Robin (3,4), boss Validar (13,5), all on Floor (0x21).

## 5. Spawns: `data/dispos/<CHAPTER>.bin`

Layout from Paragon
([`Types/Dispo.yml`](https://github.com/thane98/paragon/blob/d11d601889c3ea391aff02f9ad546e9e2ed42ea5/Data/FE13/Types/Dispo.yml),
flag names from [`UI/Modules/Spawn.yml`](https://github.com/thane98/paragon/blob/d11d601889c3ea391aff02f9ad546e9e2ed42ea5/Data/FE13/UI/Modules/Spawn.yml)),
checked against the dump.

- The data region starts with a **faction list** of 12-byte entries `{ptr name, ptr table, u32 count}`, ending at the
  first entry whose name is not a pointer. Faction names: `Player`, `Enemy`, `Event01..`, `Support01..` and others.
  A script picks one with `ev::Dispos("Player")`.
- `table` points to `count` spawn records of **0x74 bytes**:

| Offset | Type | Field |
|---|---|---|
| 0x00 | ptr | `PID_*` (person) |
| 0x08 | ptr | spawn condition (often empty) |
| 0x10 | u8 | flags1: 0x02 forced unit, **0x10 deployment slot**, 0x20 recruit at end, **0x40 Normal, 0x80 Hard** |
| 0x11 | u8 | flags2: **0x01 Lunatic**, 0x04 new player unit (?), 0x08 boss (?), 0x10 can't move |
| 0x14 | u8 | team: 0 player, 1 enemy, 2 ally |
| 0x16 | u8,u8 | `coord_1` = (x, y) where the unit appears |
| 0x18 | u8,u8 | `coord_2` = (x, y) where it ends up. It equals coord_1 for normal starts. Event and reinforcement entries walk from coord_1 to coord_2 |
| 0x1C.. | | 5 x {ptr item IID, u32 drop flags}, then AI strings (action / mission / attack / move and their params) |

For the planner:
- **Player start tiles** are the `Player` faction's records at `coord_2`. Deployment chapters list one record per
  slot with flag 0x10. Forced units such as Chrom have 0x02 instead. Example: Chapter 10 has 13 Player records, and 12 of them carry 0x10.
- **Enemies depend on difficulty.** A Lunatic-only record has flags1 0x00 / flags2 0x01, and some tiles hold two
  records for different difficulties. For Lunatic+ Classic, take the Enemy records where `flags2 & 0x01`.
- `NNN E.bin` files (such as `001E`) are the skirmish ("Encount") layouts, loaded by `Encount.cmb` via
  `ev::ChapterGetEncountName`. They are not the story chapter.

## 6. Terrain type table: `GameData.bin` → `TerrainData`

`TerrainDataNum` = 71 records of **28 bytes**
([Paragon `Types/Terrain.yml`](https://github.com/thane98/paragon/blob/d11d601889c3ea391aff02f9ad546e9e2ed42ea5/Data/FE13/Types/Terrain.yml)):

| Off | Type | Field |
|---|---|---|
| 0x00 | ptr | `TID_*` (Japanese key) |
| 0x04 | ptr | `MTID_*` message key. The English name is in `m/E/GameData.bin.lz` |
| 0x08 | ptr | **category**: points into `TerrainCategoryData`. `(ptr - TerrainCategoryData) / 4` gives the category index 0..17 |
| 0x0C | u8[4] | change-to terrain ids, inferred: village 0x16 → 0x17 (closed) / 0x18 (ruined), door 0x29 → 0x01, chest 0x2b → 0x2c |
| 0x10 | u8[4] | flags (Paragon marks them unknown). Byte 1 = 1 on sand and snow tiles |
| 0x14 | u8[4] | minimap RGBA |
| 0x18 | ptr | footstep sound (`FLAT1`, `SAND1`, ...) |

`TerrainCategoryData` holds **18 records of 4 bytes `[Def, Avo, Heal%, 0]`**. Paragon types them as bytes, and the meaning
was checked against the Fire Emblem Wiki's Awakening terrain page: Woods +1 Def/+10 Avo, Fort +2/+20/20%,
Gate and Throne +3/+20/20%, Village +5 Avo, Stairs +10 Avo. The 4th byte is always 0, so Awakening terrain gives no Res bonus.
**The category index is also the column in the cost table.**

| Cat | Def | Avo | Heal | Terrain indices (name) |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0x00 Obstacle, 0x0d Mast, 0x15 Castle, 0x1d Edifice, 0x1e Altar, 0x28 Wall, 0x29/0x2a/0x43 Door, 0x30 Barrier, 0x37 Wall (changeable) |
| 1 | 0 | 0 | 0 | 0x01 Plain, 0x02 Waste, 0x0e/0x3f/0x44 Bridge, 0x33 Back, 0x34 Wing, 0x3b Plain (snow) |
| 2 | 1 | 10 | 0 | 0x03 Woods, 0x3d Woods (snow) |
| 3 | 0 | 0 | 0 | 0x04 Desert, 0x05 Beach |
| 4 | 2 | 20 | 0 | 0x06 Mountain, 0x3e Mountain (snow) |
| 5 | 0 | 0 | 0 | 0x10 Water (river) |
| 6 | 0 | 0 | 0 | fliers only: 0x07 Peak, 0x08/0x09 Cliff, 0x0a Sky, 0x0b Bones, 0x0c Ship, 0x11 Sea, 0x12 Lake, 0x1c Building, 0x1f Rubble, 0x20 Fence, 0x25 Partition, 0x26 Supplies, 0x27 Coffin, 0x2b Chest, 0x2c Scrap, 0x2f Lava, 0x35 Hill, 0x39 Grave, 0x3a Spring, 0x46 Sea (ship) |
| 7 | 2 | 20 | 20 | 0x13 Fort |
| 8 | 3 | 20 | 20 | 0x14 Gate |
| 9 | 0 | 5 | 0 | 0x16/0x40 Village, 0x17/0x41 (Village), 0x19 House, 0x1a (House), 0x36 Village (illusion) |
| 10 | 0 | 0 | 0 | 0x18/0x42 ruined Village, 0x1b ruined House |
| 11 | 0 | 0 | 0 | 0x0f Bridge (indoor), 0x21/0x2d/0x3c/0x45 Floor, 0x38 Breach |
| 12 | 0 | 10 | 0 | 0x22 Stairs |
| 13 | 1 | 10 | 0 | 0x23 Pillar |
| 14 | 3 | 20 | 20 | 0x24 Throne |
| 15 | 0 | 0 | 0 | 0x2e Hazard (lava floor) |
| 16 | 3 | 20 | 0 | 0x31 Ire |
| 17 | 1 | 10 | 0 | 0x32 Sigil |

Lava damage and terrain healing are code (`ProcTerrainDamage`, `ProcTerrainHeal` in `code.bin`). Only the heal %
is in this table.

## 7. Movement costs: `GameData.bin` → `TerrainCostData`

The layout is `u32 columns = 18`, then **14 rows x stride 20** (18 costs and 2 pad bytes, stride = `(18+3) & ~3`). The FE11 (DS)
decompilation reads its table the same way, `cost = data[row*stride + category]`
([Eebit/fe11-us `src/database.cpp`](https://github.com/Eebit/fe11-us/blob/83f8abc778288d316d6b97990beed95b69313865/src/database.cpp)).
Paragon only exposes the table as 284 raw bytes. The row is `Job.mov_cost_index`, the u8 at offset 0x50 of each
class record, with `mov` at 0x51
([Paragon `Types/Job.yml`](https://github.com/thane98/paragon/blob/d11d601889c3ea391aff02f9ad546e9e2ed42ea5/Data/FE13/Types/Job.yml)).
`-` = 0xFF = impassable.

| Row | Classes (from the dump) | 0 | 1 Pl | 2 Wd | 3 Ds | 4 Mt | 5 Wa | 6 | 7 Ft | 8 Gt | 9 Vl | 10 | 11 Fl | 12 St | 13 Pi | 14 Th | 15 Hz | 16 | 17 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Lord, Tactician, Dancer, Manakete, Taguel | - | 1 | 2 | 2 | 4 | 5 | - | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | 2 | - | - |
| 1 | Great Lord, Grandmaster, Lodestar | - | 1 | 2 | 2 | 3 | 5 | - | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | 2 | - | - |
| 2 | Knight | - | 1 | 2 | 2 | - | - | - | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | 2 | - | - |
| 3 | General | - | 1 | 2 | 2 | - | - | - | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | 2 | - | - |
| 4 | Mercenary, Archer, Myrmidon | - | 1 | 2 | 2 | 4 | - | - | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | 2 | - | - |
| 5 | Hero, Sniper, Swordmaster | - | 1 | 2 | 2 | 3 | 5 | - | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | 2 | - | - |
| 6 | Barbarian, Fighter, Soldier, Villager, Merchant, Revenant, Entombed | - | 1 | 2 | 2 | 3 | - | - | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | 2 | - | - |
| 7 | Berserker, Warrior, Assassin, Trickster | - | 1 | 2 | 2 | 3 | 5 | - | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | 2 | - | - |
| 8 | Thief | - | 1 | 2 | 2 | 3 | 5 | - | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | 2 | - | - |
| 9 | Priest, Cleric, Mage, Dark Mage | - | 1 | 2 | 1 | 4 | - | - | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | 2 | - | - |
| 10 | War Monk/Cleric, Sage, Sorcerer | - | 1 | 2 | 1 | 4 | - | - | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 1 | 2 | - | - |
| 11 | Cavalier, Troubadour | - | 1 | 3 | 3 | - | - | - | 2 | 2 | 1 | 1 | 1 | 1 | 3 | 1 | 2 | - | - |
| 12 | Paladin, Great Knight, Bow Knight, Valkyrie, Dark Knight, Conqueror | - | 1 | 3 | 3 | 6 | - | - | 2 | 2 | 1 | 1 | 1 | 1 | 3 | 1 | 2 | - | - |
| 13 | Pegasus/Falcon Knight, Dark Flier, Wyvern Rider/Lord, Griffon Rider | - | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | - | - |

(Column heads: Pl Plain, Wd Woods, Ds Desert, Mt Mountain, Wa Water, Ft Fort, Gt Gate, Vl Village, Fl Floor,
St Stairs, Pi Pillar, Th Throne, Hz Hazard. Column 6 is fliers only, 10 ruined village, 16 Ire, 17 Sigil.)

Class records in `GameData.bin` are the `JID_*` labels. The English name comes from the pointer at +0x10 (`MJID_*`).

## 8. Chapter ids → names, map file, size

`ChapterData` has 0x44-byte records `{CID, CEID, MCID, MCID_T, ...}`. The display strings are `MCID_<id>_T` (the "Chapter N"
tag), `MCID_<id>` (the title) and `MCID_T_<id>` (the location), all in `m/E/GameData.bin.lz`. The m-file format is
parsed as in FEAT's `ExtractFireEmblemMessageArchive`: UTF-16LE messages with Shift-JIS keys.

Chapter scripts `scripts/<id>.cmb` call `ev::ChapterGetName` → `ev::TerrainLoad` → `ev::DisposLoad`, so the terrain file
normally has the chapter's own id. `P001.cmb` passes the literal `"023"` instead. The only other literal is in `aDebug.cmb`.

| id | Chapter | Location | terrain file | W x H | Player records (slot-flagged) |
|---|---|---|---|---|---|
| `P001` | Premonition: Invisible Ties | | **023** | 27x27 | 2 (0) |
| `P002` | Prologue: The Verge of History | Southtown | P002 | 17x16 | 4 (0) |
| `001` | Chapter 1: Unwelcome Change | West of Ylisstol | 001 | 18x18 | 4 (0) |
| `002` | Chapter 2: Shepherds | The Northroad | 002 | 17x22 | 8 (0) |
| `003` | Chapter 3: Warrior Realm | The Longfort | 003 | 23x17 | 8 (7) |
| `004` | Chapter 4: Two Falchions | Arena Ferox | 004 | 16x16 | 6 (5) |
| `005` | Chapter 5: The Exalt and the King | Border Pass | 005 | 18x22 | 9 (8) |
| `006` | Chapter 6: Foreseer | Ylisstol | 006 | 22x22 | 10 (9) |
| `007` | Chapter 7: Incursion | Breakneck Pass | 007 | 22x18 | 11 (10) |
| `008` | Chapter 8: The Grimleal | Border Sands | 008 | 18x24 | 10 (9) |
| `009` | Chapter 9: Emmeryn | Plegia Castle Courtyard | 009 | 22x22 | 12 (11) |
| `010` | Chapter 10: Renewal | The Midmire | 010 | 26x18 | 13 (12) |
| `011` | Chapter 11: Mad King Gangrel | Border Wastes | 011 | 22x28 | 13 (12) |
| `012` | Chapter 12: The Seacomers | Port Ferox | 012 | 22x22 | 12 (11) |
| `013` | Chapter 13: Of Sacred Blood | Carrion Isle | 013 | 18x28 | 12 (11) |
| `014` | Chapter 14: Flames on the Blue | The Searoad | 014 | 22x22 | 13 (12) |
| `015` | Chapter 15: Smoldering Resistance | Valm Harbor | 015 | 22x18 | 13 (12) |
| `016` | Chapter 16: Naga's Voice | The Mila Tree | 016 | 22x30 | 14 (13) |
| `017` | Chapter 17: Inexorable Death | Fort Steiger | 017 | 27x27 | 14 (13) |
| `018` | Chapter 18: Sibling Blades | The Demon's Ingle | 018 | 17x32 | 13 (12) |
| `019` | Chapter 19: The Conqueror | Valm Castle Approach | 019 | 31x22 | 15 (14) |
| `020` | Chapter 20: The Sword or the Knee | Valm Castle | 020 | 23x32 | 15 (14) |
| `021` | Chapter 21: Five Gemstones | Plegia Castle | 021 | 23x30 | 14 (13) |
| `022` | Chapter 22: An Ill Presage | Table Approach | 022 | 27x25 | 13 (12) |
| `023` | Chapter 23: Invisible Ties | The Dragon's Table | 023 | 27x27 | 15 (13) |
| `024` | Chapter 24: Awakening | Mount Prism | 024 | 28x23 | 15 (14) |
| `025` | Chapter 25: To Slay a God | Origin Peak | 025 | 31x29 | 15 (14) |
| `026` | Endgame: Grima | Grima | 026 | 27x28 | 16 (15) |
| `X001` | Paralogue 1: Sickle to Sword | The Farfort | X001 | 20x18 | 8 (7) |
| `X002` | Paralogue 2: The Secret Seller | The Twins' Turf | X002 | 24x24 | 10 (9) |
| `X003` | Paralogue 3: A Strangled Peace | Peaceful Village | X003 | 24x18 | 10 (9) |
| `X004` | Paralogue 4: Anna the Merchant | The Twins' Hideout | X004 | 18x22 | 12 (11) |
| `X005` | Paralogue 5: Scion of Legend | Sage's Hamlet | X005 | 22x24 | 13 (12) |
| `X006` | Paralogue 6: A Man for Flowers | Great Gate | X006 | 32x28 | 13 (12) |
| `X007` | Paralogue 7: Noble Lineage | Mila Shrine Ruins | X007 | 24x24 | 13 (12) |
| `X008` | Paralogue 8: A Duel Disgraced | Dueling Grounds | X008 | 22x24 | 13 (12) |
| `X009` | Paralogue 9: Wings of Justice | Verdant Forest | X009 | 22x26 | 13 (12) |
| `X010` | Paralogue 10: Ambivalence | Mercenary Fortress | X010 | 26x27 | 13 (12) |
| `X011` | Paralogue 11: Twin Wyverns | Wyvern Valley | X011 | 32x29 | 13 (12) |
| `X012` | Paralogue 12: Disowned by Time | The Ruins of Time | X012 | 18x26 | 13 (12) |
| `X013` | Paralogue 13: Rival Bands | Law's End | X013 | 26x22 | 13 (12) |
| `X014` | Paralogue 14: Shadow in the Sands | Desert Oasis | X014 | 22x22 | 13 (12) |
| `X015` | Paralogue 15: A Shot from the Dark | Kidnapper's Keep | X015 | 27x32 | 13 (12) |
| `X016` | Paralogue 16: Daughter to Dragons | Manor of Lost Souls | X016 | 28x27 | 13 (12) |
| `X017` | Paralogue 17: The Threat of Silence | Divine Dragon Grounds | X017 | 31x23 | 13 (12) |
| `X018` | Paralogue 18: The Dead King's Lament | Sea-King's Throne | X018 | 32x32 | 15 (14) |
| `X019` | Paralogue 19: Irreconcilable Paths | Conqueror's Whetstone | X019 | 32x32 | 15 (14) |
| `X020` | Paralogue 20: A Hard Miracle | Mountain Village | X020 | 28x28 | 15 (14) |
| `X021` | Paralogue 21: Ghost of a Blade | Warriors' Tomb | X021 | 19x30 | 15 (14) |
| `X022` | Paralogue 22: The Wellspring of Truth | Wellspring of Truth | X022 | 20x27 | 15 (14) |
| `X023` | Paralogue 23: The Radiant Hero | Garden of Giants | X023 | 32x32 | 30 (29) |

The "Player records" column is the total number of `Player`-faction records, and the number in brackets carries the 0x10 slot flag.
That second number is not necessarily the deployment cap, which may come from `ChapterData`. This was not confirmed.

## Extractor recipe (read-only)

1. Run `ctrtool -p --ncch=0 --romfsdir=<scratch>` on the CCI.
2. For each chapter id, take the terrain id (the chapter id, except `P001` → `023`) and LZ13-decode
   `data/terrain/<id>.bin.lz`. Read `w,h` at 0x20, then `grid[y*32+x]` from 0x28.
3. LZ13-decode `data/GameData.bin.lz` and `m/E/GameData.bin.lz`. Walk `TerrainData` (71 x 28 B) to get each
   index's English name and category, then `TerrainCategoryData` for Def/Avo/Heal and `TerrainCostData` for costs.
   Emit a legend of index → char, name, def, avo, heal, and cost per row.
4. LZ13-decode `data/dispos/<chapter>.bin.lz`. Player start tiles are the `Player` faction's `coord_2`.
   Enemies are filtered by difficulty flags.
5. Commit only the char grid, the legend and the spawn tiles.

## Open points

- The 0x10 flags and byte 3 of the 0x0C field in `TerrainData` are not decoded. The planner does not need them.
- The deployment cap may come from `ChapterData` bytes 0x10+ rather than the count of slot-flagged records. This is not verified.
- Whether any in-bounds edge rows or columns are hidden by the camera was not checked on screen. The terrain grid is
  authoritative for movement either way.

## Sources

- SciresM, FEAT: LZ13 detection and the message archive parser. `FEAT/Form1.cs` @ `66ba34b`.
- thane98, Paragon (FE13 data definitions): `Data/FE13/Types/{Grid,Terrain,Dispo,Job,GameData,MapConfig}.yml`,
  `UI/Modules/Spawn.yml` @ `d11d601`.
- RainThunder, fefates-tools wiki: "BIN (File Format)" (shared by Awakening and Fates).
- Eebit, fe11-us decompilation: `src/database.cpp` @ `83f8abc`, for the terrain-cost stride and index formula (FE11, same engine lineage).
- Fire Emblem Wiki, "Terrain/Nintendo 3DS games": used only to confirm the byte meanings of the category values.
- Local dump: every number above was read from the user's own decrypted US v0.0.0 CCI.
