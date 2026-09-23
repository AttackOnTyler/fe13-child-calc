# FE Awakening child unit optimizer

Compares every possible parentage of Fire Emblem Awakening's child units side by side, so a player can plan marriages for the best children.

## Language

### Units

**First-gen unit**:
A recruitable unit whose growths and max-stat modifiers are fixed game data, and who can marry to produce a child.
_Avoid_: Parent (a role, not a kind of unit), gen-1

**Child unit**:
A unit whose final growths, modifiers, classes and skills are derived from its two parents; its own data holds only personal growths, its fixed parent, and its possible variable parents.
_Avoid_: Kid, second-gen (except when speaking of a child acting as Morgan's parent)

**Parent profile**:
Everything one parent passes to a child — growths, max-stat modifiers, gender, class set and inheritable skills — resolved to concrete values. Built from a first-gen unit, from Robin with an asset/flaw applied, or from a child unit plus a chosen other parent.
_Avoid_: Parent stats, parent data

**Fixed parent**:
The parent a child unit always has (e.g. Chrom for Lucina, Robin for Morgan).

**Variable parent**:
The parent chosen by the player's marriage; the axis the pairing table compares.
_Avoid_: Other parent, spouse

**Pairing**:
One fully specified parentage of a child unit: the variable parent, plus Robin's asset/flaw wherever Robin is involved, plus a second-gen parent's own variable parent. One pairing is one table row.
_Avoid_: Combo, couple, marriage (a marriage is between two units; a pairing is about the child)

**Galedad**:
A father whose male-only classes turn into Pegasus Knight for a daughter (Donnel, Gaius, Robin (M)), giving her access to Dark Flier and Galeforce.

### Data

**Game data**:
Cited facts about the game: units, classes, skills, and the inheritance rules that connect them.
_Avoid_: Static data, constants

**Curated data**:
Opinions layered over game data: skill ranks, builds and synergies, which may differ by context. Game data never depends on it.
_Avoid_: Tier list, meta

### Builds

**Play context**:
What the player is building for: Apotheosis, Main story (Lunatic/Lunatic+), Full route, or All. Filters which build templates apply; one global selection.
_Avoid_: Mode, difficulty

**Full route**:
A single playthrough that weaves the non-grind DLC xenologues into the main campaign and paralogues, with Apotheosis as the capstone. No grind maps; DLC skills are reachable. Its build templates are curated from the user's own play, not community sources.
_Avoid_: Hybrid run, DLC run

**Build template**:
A curated 5-slot skill loadout for one role, tagged with the play contexts it suits. Each slot is a fixed skill or an ordered preference group. Matched against a pairing's reachable skills to produce a coverage tier (5/5, 4/5, 3/5).
_Avoid_: Build (alone, when the template is meant), preset (a preset weights stats)

**Reclass cost**:
The number of distinct classes a unit must pass through, beyond its starting class line, to learn every class skill in a build.

### Scoring

**Effective cap**:
A child's maximum for a stat in a given class: the class's max stat plus the child's max-stat modifier, plus 10 (not HP) if Limit Breaker is assumed.
_Avoid_: Max stat (ambiguous between class max and the child's cap), cap (alone)

**Preset**:
A named set of per-stat weights used to score pairings, optionally flagged Mixed. Each build template role maps to one.
_Avoid_: Profile, build (a build is skills)

**Mixed**:
A preset flag meaning the unit attacks with whichever of Str or Mag is stronger; that one is scored, and the other is ignored as the off-stat.

**Score basis**:
What a score measures per stat: effective caps with Limit Breaker, effective caps without it, or total growth rates (the no-grind proxy).
_Avoid_: Mode

**Scoring role**:
Whether a unit is scored as the Lead (its own stats) or the Support (the pair-up bonus it gives a lead).
_Avoid_: Position, front/back

**Pair-up bonus**:
The stats a support unit adds to its lead: a tier from the support's raw stat, plus its class's pair-up bonus, plus a support-rank bonus where the class bonus is non-zero.
_Avoid_: Dual bonus (Dual Support gives hit/avoid, not stats)

**Target breakpoint**:
The Speed total a unit should reach to be "fast enough": one global value picked from the breakpoint list, defaulted by play context. Spd points up to it (plus the speed margin) score at the preset's steep to-target weight; points beyond score at its small beyond weight.
_Avoid_: Speed tier, threshold (alone)

**Speed margin**:
Extra Speed above the target breakpoint that still scores at the to-target weight, as a buffer against debuffs and faster enemies.
_Avoid_: Buffer, overhead

**Auto class**:
The class chosen per row as the one that scores highest under the current preset, role and basis, from the child's final-tier reachable classes.
_Avoid_: Best class (alone), default class (the child's starting class)

### Planning

**Run facts**:
Facts fixed at the start of a playthrough — Robin's gender and asset/flaw. They remove pairings from the run entirely rather than blocking them.
_Avoid_: Settings, run config

**Unit state**:
Where a unit stands in the current run: Available, Not yet recruited (prunes nothing), Benched (soft), Missed or Dead (hard).
_Avoid_: Status (alone), availability

**Pin**:
A planned marriage the player has locked. Soft: it can be broken, and it breaks by itself when either unit is benched, missed or dead, freeing the partner.
_Avoid_: Lock (alone), reservation

**Marriage plan**:
One spouse per unit for the whole roster, chosen by the solver to maximise the sum of each child's priority × score (each child scored with its own preset), with marriages and pins fixed. Re-solved around losses and compared with the saved plan.
_Avoid_: Backup (alone), optimal pairing

**Plan preset**:
The preset a child is scored with in the marriage plan: a curated default per child (may differ by play context) unless the user sets one, which then holds in every context. Only the preset name is per child; its role comes with it, everything else is global. The pairing tables ignore it and use the global preset.
_Avoid_: Child preset, default preset (ambiguous with the global one)

**Deployment role**:
The job a deployed unit does in the army: Lead, Battery, Staff/Rally or Dancer. A child's comes from its plan preset (a preset's scoring role, or Rallybot/Dancer for no preset); a first-gen unit's is a tag the user sets, defaulted from a curated table. No child can be a Dancer.
_Avoid_: Role (alone — ambiguous with scoring role and build template role), job, position

**Composition quotas**:
Per play context, a min–max range of deployed units for each deployment role plus a deploy cap, curated and editable. Counted over deployed first-gen units and all children; out-of-range is a warning, never a block.
_Avoid_: Slots, army limits

**Suggest roles**:
A one-shot action that rewrites the plan preset of every child still on its default so the army meets the composition quotas, valuing each child at priority × score in the pairing the marriage plan gives it, then re-plans. Its picks are ordinary overrides marked "suggested"; the solver itself always scores each child in one role.
_Avoid_: Auto-roles, role solver

**Blocked pairing**:
A pairing that contradicts the roster: hard when it can no longer happen (a unit is dead or missed, or married to someone else), soft when it only contradicts a pin or a bench.
_Avoid_: Invalid, disabled

### Verification

**Assumption**:
A game value or rule the sources couldn't verify. It has a default and known alternatives, and the user can override it.
_Avoid_: Guess, setting, config
