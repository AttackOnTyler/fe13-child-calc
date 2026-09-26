# Plans are ranked by their flawless chance, not by weighted stats

Endpoint-first planning needs one objective that ranks whole armies, treats children, first-gen units and Robin alike, and stays comparable across edits. The existing Σ (priority × a 0–100 score, min-max scaled per preset) did none of that: it moved with every priority change and re-scaling. We rank a plan (a wishlist and its roadmap) by its **flawless chance**, the chance of reaching and clearing the endpoint with no unit dying, simulated forward map by map from the latest recorded map with the army the recruitment gates allow at each. Each map is played through the map solver's combat math, with stats and foes as chances. It is the question an ironman player actually asks, it doesn't saturate the way a count of foes cleared does once an army is strong, and every edit (a marriage, a build, a lineup, a paralogue date) costs points of the same chance.

## Considered options

- **Curated preset weights, made stable** by dropping the min-max scaling: still opinion, and a Battery point, a Lead point and a Rallybot (no weights) aren't the same unit.
- **Expected foes cleared at the endpoint:** combat-based, but many armies clear everything, so it stops ranking exactly where min/maxing matters.
- **The endpoint only:** chosen first to avoid mixing value across maps, then dropped. A chance composes over time (per-map chances multiply), so the whole run costs no second currency, and it catches a comp that can't hold the mid-game.
- **A per-unit priority or fondness term:** it breaks comparability. A preference is an edit with a visible cost instead.

## Consequences

- The score is a simulation, not a formula: the lineup per map, the EXP forecast and support growth feed it and depend on each other, so the solve likely needs Monte Carlo with a stated margin of error. The **ceiling** (the endpoint at effective caps) bounds it and prunes the search.
- Stated assumptions stand in for movement until a map editor supplies positions: an equal share of actions per turn, one enemy-phase attack per pair from the worst foe left, Rally reaching every pair.
- Presets, standing, army fit, priorities and Σ stop ranking plans; how they migrate is open.
- Decided on [What makes one wishlist better than another?](https://github.com/AttackOnTyler/fe13-child-calc/issues/137).
