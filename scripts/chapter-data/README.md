# Chapter data generator (#109)

Regenerates `src/game-data/chapters/*.ts` from Fire Emblem Wiki chapter pages at fixed revisions.

1. Fetch each page's raw wikitext at the oldid in `<group>-maps.json`:
   `curl -sL "https://fireemblemwiki.org/w/index.php?oldid=<oldid>&action=raw" -o <file>`
2. Parse: `uv run python fewparse.py "$(cat <group>-maps.json)" <group>.json`
3. Name bosses and cross-check their stats against Serenes Forest's boss data (save
   `https://serenesforest.net/awakening/characters/boss-data/<difficulty>/chapters/` as `sf-boss-<difficulty>.html`):
   `uv run python bosscheck.py <group>.json`. Every differing stat is printed; record real ones in `CHAPTER_DISAGREEMENTS`.
4. Emit: `uv run python gents.py <group>.json ../../src/game-data/chapters/<group>.ts <CONST> "$(cat <group>-extra.json)"`

`<group>-extra.json` holds what the pages don't: each map's kind, list order, label and unlocks.
