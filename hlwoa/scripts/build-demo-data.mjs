// Membangun hlwoa/js/demo-data.js dari DATA ASLI P1 + algoritma di simulator/ (bukan angka karangan).
// Jalankan dari akar repo:  node hlwoa/scripts/build-demo-data.mjs
// Instance demo: 8 task diambil acak (seed tetap) dari GoCJ_Dataset_100.txt dan 3 VM (satu per tipe dari
// getDefaultVms: 2500 / 1500 / 800 MIPS), supaya muat di satu layar. Dipilih yang HEFT-nya TIDAK optimal
// (celah terhadap optimum brute force) agar ada sesuatu yang bisa diperbaiki WOA.
// Ini bahan ilustrasi untuk web; angka eksperimen resmi ada di results/hasil.json.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseDatasetText, getDefaultVms } from '../../simulator/datasetLoader.js';
import { heft } from '../../simulator/heft.js';
import { fitness } from '../../simulator/fitness.js';
import { runHLWOA } from '../../simulator/algorithms/hlwoa.js';
import { makeRng } from '../../simulator/rng.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const all = parseDatasetText(fs.readFileSync(path.join(root, 'data', 'GoCJ_Dataset_100.txt'), 'utf-8'));
const defaultVms = getDefaultVms();
const vms = [defaultVms[0], defaultVms[4], defaultVms[10]].map(v => ({ id: v.id, speed: v.speed })); // ids 0, 4, 10
const POP = 12, ITER = 50, BUDGET = POP * (ITER + 1), N = 8;
const round = x => Math.round(x * 100) / 100;

function optimum(tasks) { // brute force 3^8
  let opt = Infinity; const a = new Array(N);
  (function rec(i) {
    if (i === N) { opt = Math.min(opt, fitness(a.map(k => vms[k].id), tasks, vms)); return; }
    for (let k = 0; k < 3; k++) { a[i] = k; rec(i + 1); }
  })(0);
  return opt;
}

// cari instance: sample 8 task (ukuran < 200.000 MI agar skala wajar), HEFT celah >= 3% dari optimum
let found = null;
for (let instSeed = 1; instSeed < 500 && !found; instSeed++) {
  const r = makeRng(instSeed), pool = all.filter(t => t.size < 200000);
  const tasks = Array.from({ length: N }, (_, i) => ({ id: i, size: pool[Math.floor(r() * pool.length)].size }));
  const H = heft(tasks, vms), opt = optimum(tasks);
  if (H.makespan > opt * 1.03) {
    const hits = [];
    for (let s = 1; s <= 20; s++) if (runHLWOA(tasks, vms, { variant: 'HLWOA', populationSize: POP, maxEvals: BUDGET }, s).schedule.makespan <= opt + 1e-9) hits.push(s);
    if (hits.length >= 6) found = { instSeed, tasks, H, opt, hits };
  }
}
if (!found) throw new Error('instance demo tidak ditemukan');
const { instSeed, tasks, H, opt, hits } = found;
const RUN_SEED = hits[0];

// keputusan HEFT per langkah (urutan ukuran menurun, earliest finish time) + "kasus jebakan"
const idxOf = new Map(vms.map((v, k) => [v.id, k]));
const order = tasks.map((_, i) => i).sort((a, b) => tasks[b].size - tasks[a].size || a - b);
const ready = new Array(3).fill(0), decisions = [];
for (const i of order) {
  const eft = vms.map((v, k) => ready[k] + tasks[i].size / v.speed);
  let best = 0; for (let k = 1; k < 3; k++) if (eft[k] < eft[best]) best = k;
  let free = 0; for (let k = 1; k < 3; k++) if (ready[k] < ready[free]) free = k;
  decisions.push({ task: i, vm: best, start: ready[best], eft: eft[best], candidates: eft.slice(), freeFirstVm: free });
  ready[best] = eft[best];
}
const assignIdx = new Array(N); decisions.forEach(d => { assignIdx[d.task] = d.vm; });
if (JSON.stringify(assignIdx.map(k => vms[k].id)) !== JSON.stringify(H.assignment)) throw new Error('HEFT lokal tidak sama dengan simulator/heft.js');

const combos = { hL: 'HLWOA', hN: 'HLWOA-noLevy', rL: 'WOA-Levy', rN: 'WOA' }; // h = seed HEFT, r = acak; L = Levy, N = tanpa
const traces = {};
for (const [key, variant] of Object.entries(combos)) {
  const x = runHLWOA(tasks, vms, { variant, populationSize: POP, maxEvals: BUDGET, trace: { n: POP } }, RUN_SEED);
  traces[key] = {
    variant, final: round(x.schedule.makespan),
    history: x.history.map(round),                                          // indeks 0 = populasi awal
    frames: [x.trace.loads0, ...x.trace.loads].map(f => f.map(l => l.map(round))),
    levy: x.trace.levy,
  };
}
const td = decisions.find(d => d.vm !== d.freeFirstVm);
const trap = td && { task: td.task, size: tasks[td.task].size, chosenVm: td.vm, chosenEft: round(td.eft), freeVm: td.freeFirstVm, freeEft: round(td.candidates[td.freeFirstVm]) };

const DEMO = {
  meta: { sumber: 'GoCJ_Dataset_100.txt (data P1) + simulator/algorithms/hlwoa.js', instanceSeed: instSeed, runSeed: RUN_SEED,
    populasi: POP, iterasi: ITER, hitOptimum: `${hits.length}/20 run`, optimum: round(opt),
    catatan: 'Instance demo 8 task x 3 VM, bukan eksperimen penuh. Angka resmi: results/hasil.json.' },
  tasks, vms,
  heft: { assignment: assignIdx, makespan: round(H.makespan), order,
    decisions: decisions.map(d => ({ task: d.task, vm: d.vm, start: round(d.start), eft: round(d.eft) })), trap },
  traces,
};
fs.writeFileSync(path.join(root, 'hlwoa', 'js', 'demo-data.js'),
  `// DIHASILKAN OTOMATIS oleh hlwoa/scripts/build-demo-data.mjs - jangan diedit tangan.\nexport const DEMO = ${JSON.stringify(DEMO)};\n`);
console.log('instanceSeed', instSeed, '| HEFT', DEMO.heft.makespan, '| optimum', DEMO.meta.optimum, '| hit', DEMO.meta.hitOptimum, '| runSeed', RUN_SEED);
for (const [k, t] of Object.entries(traces)) console.log(k, t.variant.padEnd(13), 'awal', t.history[0], '-> akhir', t.final, '| event Levy:', t.levy.filter(i => i >= 0).length);
console.log('trap:', trap);
