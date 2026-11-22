/**
 * @file ablationHLWOA.js  (P2)
 * @description Ablation HLWOA pada 20 dataset asli P1: HEFT saja, WOA saja, HLWOA tanpa Levy, HLWOA penuh.
 * Syarat adil: dataset sama, seed sama (10 seed P1), anggaran evaluasi sama (1200), waktu scheduler dicatat.
 * Keluaran: results/ablation_hlwoa.json  (format kontrak hasil.json + ringkasan + uji Mann-Whitney)
 * Jalankan: node simulator/ablationHLWOA.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDatasetText, getDefaultVms } from './datasetLoader.js';
import { runBatch } from './batchRunner.js';
import { runHeft } from './algorithms/heftRunner.js';
import { runHLWOA, runHLWOANoLevy, runWOA } from './algorithms/hlwoa.js';
import { summarizeMetrics, mannWhitneyU } from './statistics.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seeds = [42, 101, 202, 303, 404, 505, 606, 707, 808, 909];
const MAX_EVALS = 1200, PARAMS = { maxIter: 60, popSize: 20 }; // sama dengan exportResults.js P1
const sizes = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
const sets = [
  ...sizes.map(n => ({ name: `GoCJ_${n}`, file: `GoCJ_Dataset_${n}.txt` })),
  ...sizes.map(n => ({ name: `Synthetic_${n}`, file: `synthetic/Synthetic_${n}.txt` })),
];
const methods = { 'HEFT': runHeft, 'WOA': runWOA, 'HLWOA-noLevy': runHLWOANoLevy, 'HLWOA': runHLWOA };
const vms = getDefaultVms();
const all = Object.fromEntries(Object.keys(methods).map(k => [k, []]));

for (const ds of sets) {
  const tasks = parseDatasetText(fs.readFileSync(path.join(dir, 'data', ds.file), 'utf-8'));
  const out = runBatch(methods, tasks, vms, PARAMS, seeds, MAX_EVALS);
  for (const k of Object.keys(methods)) for (const r of out[k]) all[k].push({ dataset: ds.name, taskCount: tasks.length, ...r });
}

// Mann-Whitney pada makespan ter-normalisasi terhadap HEFT per dataset (supaya skala dataset tidak mendominasi)
const heftMean = {};
for (const ds of sets) heftMean[ds.name] = all.HEFT.filter(r => r.dataset === ds.name).reduce((s, r) => s + r.makespan, 0) / seeds.length;
const norm = k => all[k].map(r => r.makespan / heftMean[r.dataset]);
const summary = {}, perDataset = {};
for (const k of Object.keys(methods)) {
  summary[k] = summarizeMetrics(all[k]);
  const nm = norm(k); const m = nm.reduce((s, x) => s + x, 0) / nm.length;
  summary[k].makespanRelHEFT = { mean: m, std: Math.sqrt(nm.reduce((s, x) => s + (x - m) ** 2, 0) / (nm.length - 1)) };
}
for (const ds of sets) {
  perDataset[ds.name] = {};
  for (const k of Object.keys(methods)) {
    const v = all[k].filter(r => r.dataset === ds.name).map(r => r.makespan);
    const m = v.reduce((s, x) => s + x, 0) / v.length;
    perDataset[ds.name][k] = { mean: m, std: Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)) };
  }
}
const tests = {};
for (const [a, b] of [['HLWOA', 'HLWOA-noLevy'], ['HLWOA', 'WOA'], ['HLWOA', 'HEFT'], ['HLWOA-noLevy', 'WOA']]) {
  const r = mannWhitneyU(norm(a), norm(b));
  tests[`${a} vs ${b}`] = { pValue: r.pValue ?? r.p, raw: r };
}
// berapa dataset HLWOA lebih baik / sama / lebih buruk dibanding variannya (mean per dataset)
const wins = (a, b) => sets.filter(d => perDataset[d.name][a].mean < perDataset[d.name][b].mean - 1e-9).length;

fs.writeFileSync(path.join(dir, 'results', 'ablation_hlwoa.json'),
  JSON.stringify({ meta: { maxEvals: MAX_EVALS, params: PARAMS, seeds, datasets: sets.length }, hasil: all, summary, perDataset, tests }, null, 1));

console.log(`Ablation HLWOA: ${sets.length} dataset x ${Object.keys(methods).length} metode x ${seeds.length} seed | budget ${MAX_EVALS} evaluasi\n`);
console.log('metode'.padEnd(14), 'makespan/HEFT (mean ± std)'.padEnd(28), 'waktu (ms)'.padEnd(10), 'DI'.padEnd(8), 'cost');
for (const k of Object.keys(methods)) {
  const s = summary[k];
  console.log(k.padEnd(14), `${s.makespanRelHEFT.mean.toFixed(6)} ± ${s.makespanRelHEFT.std.toFixed(6)}`.padEnd(28),
    s.timeMs.mean.toFixed(2).padEnd(10), s.imbalance.mean.toFixed(4).padEnd(8), s.cost.mean.toFixed(0));
}
console.log('\nMann-Whitney (makespan ter-normalisasi HEFT, n=200 vs 200):');
for (const [k, v] of Object.entries(tests)) console.log(' ', k.padEnd(26), 'p =', Number(v.pValue).toExponential(2));
console.log(`\nDataset (dari 20) HLWOA mean < HEFT: ${wins('HLWOA', 'HEFT')} | < noLevy: ${wins('HLWOA', 'HLWOA-noLevy')} | < WOA: ${wins('HLWOA', 'WOA')}`);
console.log(`Dataset HLWOA-noLevy mean < HLWOA: ${wins('HLWOA-noLevy', 'HLWOA')}`);
