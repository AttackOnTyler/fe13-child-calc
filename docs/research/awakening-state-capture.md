# Reading Awakening unit state from Azahar (issue #226)

Question: after each map of an FE13 (US, title `00040000000A0500`) Lunatic+ Classic run in Azahar, can we capture class, level, EXP, stats, items, skills, supports and gold without reading screenshots?

**Answer: yes, from the save file.** Azahar writes Awakening's `Chapter` saves as plain files on the host. Their only obfuscation is a documented Huffman compression. Two open-source editors document the unit format. We decompressed the live `Chapter0` on this machine with a 25-line Python port and read Robin's unit record out of it. The RPC memory server also exists, but it is off by default and nobody has published a unit-struct RAM layout. Treat it as a fallback for gold only.

Research date: 2026-09-27. Azahar latest release at that date: `2126.1.2`.

---

## 1. Azahar's scripting / RPC interface

| Fact | Source |
|---|---|
| The RPC server is still in Azahar. It lives in `src/core/rpc/` (`rpc_server.cpp`, `udp_server.cpp`, `packet.cpp`). | [azahar-emu/azahar `src/core/rpc`](https://github.com/azahar-emu/azahar/tree/master/src/core/rpc) |
| It is compiled in by default: `option(ENABLE_SCRIPTING "Enable RPC server for scripting" ON)`. | [`CMakeLists.txt` L132](https://github.com/azahar-emu/azahar/blob/master/CMakeLists.txt) |
| It is **off at runtime by default**: `Setting<bool> enable_rpc_server{false, ...}`. It only starts when that setting is true (`core.cpp`, inside `#ifdef ENABLE_SCRIPTING`). | [`src/common/settings.h`](https://github.com/azahar-emu/azahar/blob/master/src/common/settings.h), [`src/core/core.cpp`](https://github.com/azahar-emu/azahar/blob/master/src/core/core.cpp) |
| Port **45987/UDP** is hard-coded. It binds `udp::v4()`, which means all IPv4 interfaces, not just loopback. | [`src/core/rpc/udp_server.cpp`](https://github.com/azahar-emu/azahar/blob/master/src/core/rpc/udp_server.cpp) |
| To turn it on: *Emulation > Configure > Debug > "Enable RPC server"*. The checkbox is greyed out while a game is running. The tooltip says: "Enables the RPC server on port 45987 … remotely reading/writing guest memory". | [`configure_debug.ui`](https://github.com/azahar-emu/azahar/blob/master/src/citra_qt/configuration/configure_debug.ui), [`configure_debug.cpp`](https://github.com/azahar-emu/azahar/blob/master/src/citra_qt/configuration/configure_debug.cpp) |
| Requests: `ReadMemory`, `WriteMemory`, `ProcessList`, `SetGetProcess`. Reads are capped at 1024 bytes per packet. Reads are "asynchronous from the state of the emulator", so a read can tear mid-frame. Writes are limited to the process image and heap regions. | [`rpc_server.cpp`](https://github.com/azahar-emu/azahar/blob/master/src/core/rpc/rpc_server.cpp) |

**Local install check (read-only):**
- `%LOCALAPPDATA%\Programs\Azahar\scripting\citra.py` ships with the install. Its header reads "Citra Emulator Project / Azahar Emulator Project", `CITRA_PORT = 45987`, and it provides `read_memory`, `write_memory`, `process_list` and `set_process`.
- The `azahar.exe` strings include the "Enable RPC server" UI text, so this build has scripting compiled in.
- `%APPDATA%\Azahar\config\qt-config.ini`, section `[Debugging]`: `enable_rpc_server=false`, which is the default. The user would have to tick the box with no game running.

## 2. RAM layout for unit structs

- **No public unit-struct RAM map was found.** The main US code list, [JourneyOver/CTRPF-AR-CHEAT-CODES `00040000000A0500.txt`](https://github.com/JourneyOver/CTRPF-AR-CHEAT-CODES/blob/master/Cheats/Fire%20Emblem%20-%20Awakening%20(USA)/00040000000A0500.txt), gives fixed addresses only for:
  - **Gold**: `D3000000 14000000` / `009997D0 …`, so the address is `0x149997D0` (u32). Renown is at `0x149997D4`.
  - **Convoy stat-booster/seal counts**: base `0x15000000`, entries at `0x15287E80…` (u16 each).
  - Pointer codes through `0x004D0C7C` for the convoy table, plus ASM patches in `.text` (EXP multiplier at `0x00277A5C`, growth check at `0x002CF024`).
- The per-character stat codes that circulate (GameFAQs and similar) only apply to "slot 1" after a skirmish/bookmark dance. That means units live in dynamically allocated heap objects with no stable address. Using RAM for units would require us to reverse-engineer the pointer chain ourselves.
- These addresses come from real hardware. Azahar emulates the same virtual address space (`0x14000000` linear heap), so they should carry over, but we have **not verified** them live because we did not launch the emulator.

## 3. Save files

**Location (verified on disk):**
```
%APPDATA%\Azahar\sdmc\Nintendo 3DS\00000000000000000000000000000000\00000000000000000000000000000000\
  title\00040000\000a0500\data\00000001\
    Chapter0   (1892 B, written 2026-09-27 19:10)
    Global     (380 B)
```
Chapter1/2 are the other save slots. Map0/1 are the in-battle suspend files ([FEAST `Form1.cs`](https://github.com/SciresM/FEAST/blob/master/Fire%20Emblem%20Awakening%20Save%20Tool/Form1.cs) file list: `Global, Chapter0-2, Map0-1`).

**Encryption: none on the host.** Azahar stores the SD save archive as plain files. The first 0xC0 bytes of `Chapter0` are readable UTF-16 text: `Robin`, `Prologue`, `The Verge of History`.

**Compression:** after the 0xC0 header (0x80 on JP saves) comes a 0x10-byte `PMOC` header, then a Nintendo-style 8-bit Huffman stream.
- The `PMOC` header holds: magic `PMOC`, version `2`, decompressed length, and a CRC32 of the decompressed data. See [FEAST `Form1.cs` `GetHeader`](https://github.com/SciresM/FEAST/blob/master/Fire%20Emblem%20Awakening%20Save%20Tool/Form1.cs).
- The decompressor is [FEAST `Huffman8.cs`](https://github.com/SciresM/FEAST/blob/master/Fire%20Emblem%20Awakening%20Save%20Tool/Huffman8.cs) (GPL-2.0, by SciresM). A Java port is [fire-editor-awakening `compression/Huffman.java`](https://github.com/Dani88alv/fire-editor-awakening/blob/master/src/main/java/com/danius/fireeditor/compression/Huffman.java). The same scheme is in [RainThunder/FEST](https://github.com/RainThunder/FEST) and a JS port in [GaryCXJk/feast-js](https://github.com/GaryCXJk/feast-js).
- `Global` is fully compressed from byte 0. It has no text header.

**Verified locally.** A Python port of `Huffman8.Decompress` was run against a copy of the live `Chapter0`:
- The output is 7595 bytes, and the decompressed body starts with `EDNI`, the index block.
- The index gives these block offsets: user `0x104`, map (`PAMG`) `0x202`, units (`TINU`) `0x807`–`0xA52`, then the forge/convoy blocks, and so on.
- Robin's record decoded to unit id 0, class id 4, Lv 1, EXP 0, current HP 19, all stat gains 0. That matches the Prologue start.

**Unit format.** Documented in [Dani88alv/fire-editor-awakening](https://github.com/Dani88alv/fire-editor-awakening) (GPL-3.0, last push 2023-12), under `savefile/`:
- `Chapter13.java`: the block index at `region + 0x00..0x44`, and the order of blocks: user, gmap, units, refi (forges), tran (convoy), du26, evst.
- `UnitBlock.java`: the `TINU` header (5 bytes), then groups. Each group is `groupId, count, units...`. Group 3 is the army, 4 is the dead, and 0/1/2/5 are map-side (blue/red/green/other).
- `Unit.java` / `mainblock/*`: each unit is a sequence of variable-length sub-blocks:
  - `RawBlock1` (0x1A): unit id u16 @1, class @3, **stat gains** @0x0A–0x11 (HP, Str, Mag, Skl, Spd, Lck, Def, Res), **level @0x12, EXP @0x13**, current HP @0x14, movement bonus @0x15, map coordinates @0x16–0x19.
  - `RawInventory` (5 × 5 bytes): each item is id u16 @1, uses @3, flags @4 (forged/equipped bits).
  - `RawBlock2` (0x10): 5 **equipped skills** (u16 each) and weapon ranks.
  - `RawSupport` (length-prefixed): **support points**, one per valid partner in the unit's partner table.
  - `RawFlags` (0x2A), `RawSkill` (0xD, a bitfield of **learned skills**), and `RawBlockEnd` (0x3F, AI/misc).
  - Optional logbook block (Robin/avatars: asset/flaw, 0x188 bytes US) and optional child/parent block (children's inherited data).
- `UserBlock.java`: **gold** = u32 at `rawBlock2 + 0x69`, renown at `+0x6D`. It also holds chapter progress and the play-time counter.

**Fidelity caveat (important).** The save stores stat *gains*, not final stats. Final stat = character base modifier + class base + gain, capped at class max + character modifier. The Robin/avatar asset/flaw adds ±2 per the logbook. `Stats.calcCurrentStats` in fire-editor shows the exact formula. This repo already has `src/game-data/class-bases.ts` and `units.ts`, so we can compute final stats from our own tables. As a bonus, the stored gains equal the level-up results we want to calibrate against.

We would also need id→name tables for units, classes, items and skills. fire-editor ships them as resources (see `data/UnitDb.java`, `ChapterDb.java`, and the resource files).

## 4. Recommendation

| Source | Viable? | Fidelity | Cost |
|---|---|---|---|
| **Chapter save file** | **Yes. Verified on this machine.** | Exact for class, level, EXP, gains, inventory (with uses and forges), equipped and learned skills, support points, gold, renown and dead units. Final stats are derived from gains plus our base tables. | About 1 day. See below. |
| RPC memory read (port 45987) | Partly. It needs the user to enable it with no game running, and it exposes UDP on all interfaces. | Gold and convoy counts at fixed AR addresses. Units have no known layout, so they would need original reverse-engineering. | Gold is trivial. Units are open-ended and not recommended. |
| Screenshots | Works today | Error-prone | Baseline |

**Wire-up plan for a per-map snapshot:**
1. The player saves to a chapter slot at the end of each map. Classic prompts for this after every chapter.
2. A `scripts/` tool (TS, runnable with the existing toolchain) reads `Chapter<N>`. It must only read, and ideally copy the file first; it must never write the save.
3. The tool Huffman-decodes from offset 0xD0, walks the `EDNI` index, and parses `TINU` group 3 plus `UserBlock` gold.
4. It maps ids to names and emits JSON that matches the planner's unit shape.

Estimated size:
- About 60 lines for the decoder, which is already prototyped in Python and proven.
- About 250 lines for the block and unit parser.
- An id table from fire-editor's resources.
- A fixture test using a copied save.

**License note:** FEAST is GPL-2.0 and fire-editor-awakening is GPL-3.0. This repo has no LICENSE file. Re-implement from the format description rather than copying code.

**Timing note:** the file only changes when the game writes a save. Snapshot after the post-chapter save prompt, not mid-map. The `Map0/1` suspend files use the same container and could give mid-map snapshots, but we have not verified this.
