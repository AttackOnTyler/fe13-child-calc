// PROTOTYPE — throwaway (#258). Search T1 for a forward Frederick: he kills the (4,10) Myrmidon, the rest of the south can
// @ts-nocheck
// reach only him (or nobody), and Robin and Lissa end out of every awake foe's reach. Stub damage math (model.ts).
// Run: npx vite-node src/prototype/prep-positions/search-t1.ts
import { ALLIES, ENEMIES, byId, dangerFor, reach, type Pos } from './model';

const fre = byId('fre'), rob = byId('rob'), lis = byId('lis');
const south = ['m2', 'b1', 'b2', 'w']; // m1 dies to Frederick's attack
const foes: Pos = Object.fromEntries(ENEMIES.filter((e) => south.includes(e.id) || e.id === 'g').map((e) => [e.id, [e.x, e.y]]));
const awake = new Set([...south, 'g']);
const enemyTiles = new Set(Object.values(foes).map((p) => `${p[0]},${p[1]}`).concat('4,10'));
const k = (p: [number, number]) => `${p[0]},${p[1]}`;
const tiles = (m: Map<string, number>) => [...m.keys()].map((s) => s.split(',').map(Number) as [number, number]);

const out: { f: string; r: string; l: string; fTotal: number; drawn: number }[] = [];
const fStart: [number, number] = [2, 14]; // Chrom pairs onto Frederick first
for (const f of tiles(reach(fre, fStart, enemyTiles))) {
  if (Math.abs(f[0] - 4) + Math.abs(f[1] - 10) !== 1) continue; // must attack the (4,10) Myrmidon
  for (const r of tiles(reach(rob, [4, 14], new Set([...enemyTiles, k(f)])))) {
    for (const l of tiles(reach(lis, [1, 13], new Set([...enemyTiles, k(f), k(r)])))) {
      if (k(r) === k(l) || k(r) === k(f) || k(l) === k(f)) continue;
      const allies: Pos = { fre: f, chr: f, rob: r, lis: l };
      const dr = dangerFor(rob, foes, allies, awake, (e) => e.skills).get(k(r));
      const dl = dangerFor(lis, foes, allies, awake, (e) => e.skills).get(k(l));
      if (dr || dl) continue;
      const df = dangerFor(fre, foes, allies, awake, (e) => e.skills).get(k(f));
      if ((df?.total ?? 0) >= fre.hp) continue;
      out.push({ f: k(f), r: k(r), l: k(l), fTotal: df?.total ?? 0, drawn: df?.foes.length ?? 0 });
    }
  }
}
out.sort((a, b) => b.drawn - a.drawn || a.fTotal - b.fTotal);
console.log(`${out.length} safe forward T1 formations; best by foes drawn onto Frederick:`);
for (const o of out.slice(0, 12)) console.log(`Frederick+Chrom ${o.f} (kills Myrmidon)  Robin ${o.r}  Lissa ${o.l}  → Frederick worst ${o.fTotal}/28 from ${o.drawn} foes`);
void ALLIES;
