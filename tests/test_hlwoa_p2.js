/**
 * @file test_hlwoa_p2.js  (P2)
 * Uji HLWOA di simulator: kontrak, anggaran evaluasi, determinisme, elitisme (tidak lebih buruk dari HEFT),
 * varian ablation, dan ekor berat Levy.   Jalankan: node tests/test_hlwoa_p2.js
 */
import assert from 'node:assert';
import { loadDataset, heft, fitness, makeRng, runHLWOA, runHLWOANoLevy, runWOA } from '../simulator/index.js';
import { levyFlight } from '../simulator/algorithms/hlwoa.js';

const ok = m => console.log('   [OK]', m);
const { tasks, vms } = await loadDataset('GoCJ_Dataset_100.txt');
const ids = new Set(vms.map(v => v.id));
const H = heft(tasks, vms);
const P = { popSize: 20, maxIter: 60 }, B = 1200;

console.log('=== UJI HLWOA (P2) ===');
const runs = { HLWOA: runHLWOA, 'HLWOA-noLevy': runHLWOANoLevy, WOA: runWOA };
for (const [n, fn] of Object.entries(runs)) {
  const r = fn(tasks, vms, { ...P, maxEvals: B }, 42);
  assert.strictEqual(r.schedule.assignment.length, tasks.length);
  assert(r.schedule.assignment.every(id => ids.has(id)), `${n}: VM id tidak valid`);
  assert.strictEqual(r.evaluations, B, `${n}: anggaran evaluasi harus tepat ${B}, dapat ${r.evaluations}`);
  assert(Math.abs(r.schedule.makespan - fitness(r.schedule.assignment, tasks, vms)) < 1e-9, `${n}: makespan tidak cocok`);
  assert(r.history.every((x, i, a) => i === 0 || x <= a[i - 1] + 1e-12), `${n}: history harus tidak naik`);
  assert(r.timeMs >= 0);
  ok(`${n}: valid, ${r.evaluations} evaluasi, makespan ${r.schedule.makespan.toFixed(2)} (HEFT ${H.makespan.toFixed(2)})`);
}
for (const s of [1, 2, 3, 42]) {
  assert(runHLWOA(tasks, vms, { ...P, maxEvals: B }, s).schedule.makespan <= H.makespan + 1e-9);
}
ok('HLWOA tidak pernah lebih buruk dari HEFT (elitisme)');
const a = runHLWOA(tasks, vms, { ...P, maxEvals: B }, 7), b = runHLWOA(tasks, vms, { ...P, maxEvals: B }, 7);
assert.deepStrictEqual(a.schedule, b.schedule); assert.deepStrictEqual(a.history, b.history);
ok('Seed sama -> hasil identik');
const w1 = runWOA(tasks, vms, { ...P, maxEvals: B }, 1), w2 = runWOA(tasks, vms, { ...P, maxEvals: B }, 2);
assert.notDeepStrictEqual(w1.history, w2.history); ok('Seed beda -> lintasan beda');
const small = runHLWOA(tasks, vms, { maxEvals: 80, popSize: 10 }, 5);
assert(small.evaluations <= 80); ok('maxEvals kecil dipatuhi');
const rng = makeRng(1);
const s = Array.from({ length: 20000 }, () => Math.abs(levyFlight(1.5, rng))).sort((x, y) => x - y);
assert(s[19800] > 10 * s[10000]); ok(`Levy ekor berat (median ${s[10000].toFixed(2)}, p99 ${s[19800].toFixed(2)})`);
console.log('\nSEMUA UJI HLWOA LOLOS');
