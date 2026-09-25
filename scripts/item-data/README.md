# Weapon and item data generator (#115)

1. Save Serenes Forest's inventory pages into a cache directory as `<page>.html` for
   swords, lances, axes, bows, tomes, staves, stones-miscellaneous and items
   (`https://serenesforest.net/awakening/inventory/<page>/`).
2. Save Fire Emblem Wiki's lists as raw wikitext: `few-weapons.wiki` (List of weapons in Fire Emblem Awakening,
   revid 747869) and `few-items.wiki` (List of items in Fire Emblem Awakening, revid 748095).
3. `uv run python build.py <cache dir>` prints every disagreement and writes `src/game-data/items/list.ts`.
   Record real disagreements in `ITEM_DISAGREEMENTS` (src/game-data/items.ts).
