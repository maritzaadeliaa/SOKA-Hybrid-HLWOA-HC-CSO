/**
 * @module hlwoa
 * @description HLWOA = HEFT + Whale Optimization Algorithm + Lévy flight (P2).
 *
 * Sumber: Cui, M. & Wang, Y. (2025). An Effective QoS-Aware Hybrid Optimization Approach for Workflow
 * Scheduling in Cloud Computing. Sensors 25(15):4705. https://doi.org/10.3390/s25154705
 *
 * Alur (paper, Alg. 2):
 *   1. Populasi awal P individu: P-1 acak + 1 solusi HEFT.
 *   2. Tiap iterasi, tiap paus memilih satu gerakan:
 *        p < 0,5                 -> mengepung mangsa          (Pers. 24-28)
 *        p >= 0,5 dan phi < 0,5  -> jaring gelembung / spiral (Pers. 29-30)
 *        selain itu              -> gangguan Lévy flight      (Pers. 31-34)
 *   3. Solusi terbaik global diganti hanya bila lebih baik (elitisme), sehingga hasil tidak pernah
 *      lebih buruk dari HEFT.
 *
 * Representasi: paus = vektor riil panjang N (satu dimensi per task) di [-0,5 ; M-0,5].
 * Dekode: dibulatkan lalu dijepit ke [0, M-1] = INDEKS VM, lalu dipetakan ke vm.id untuk fitness().
 *
 * Adaptasi yang harus disebut di slide (paper untuk workflow DAG di WorkflowSim):
 *   - Task independen: HEFT = ukuran terbesar dulu + earliest finish time (heft.js milik P1).
 *   - Lévy: paper memakai alpha = 0,01 dan faktor rand (Pers. 34); di sini alpha = 1,0 (satuan indeks VM)
 *     tanpa rand. Sapuan alpha 0,01 / 0,1 / 1 memberi selisih makespan di dalam derau.
 *   - Fitness = makespan murni (w1 = 1, w2 = 0) supaya sama dengan metode lain; paper memakai 0,5 / 0,5.
 *   - Pseudocode Alg. 2 paper tidak konsisten dengan teksnya; kode mengikuti pseudocode (spiral bila phi < 0,5).
 *
 * Kontrak:  runHLWOA(tasks, vms, params, seed) -> { schedule, history, evaluations, timeMs }
 *   params.popSize | params.populationSize (default 50), params.maxIter (default 200),
 *   params.maxEvals (anggaran fitness-evaluation; iterasi = floor((maxEvals - P) / P)),
 *   params.variant: 'HLWOA' | 'HLWOA-noLevy' | 'WOA' | 'WOA-Levy'
 *   params.trace = { n }  -> merekam beban VM n paus per iterasi (hanya untuk animasi web)
 */

import { makeRng } from '../rng.js';
import { createCounter } from '../counter.js';
import { heft } from '../heft.js';
import { fitness } from '../fitness.js';

export const VARIANTS = {
  'HLWOA':        { useHeft: true,  useLevy: true  }, // hybrid penuh
  'HLWOA-noLevy': { useHeft: true,  useLevy: false }, // ablation: tanpa Lévy flight
  'WOA':          { useHeft: false, useLevy: false }, // ablation: WOA saja (acak, tanpa Lévy)
  'WOA-Levy':     { useHeft: false, useLevy: true  }, // pelengkap 2x2 untuk web
};

/* ---------- Bilangan normal (Box-Muller) dan Lévy (Mantegna) ---------- */
function gauss(rand) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

function gammaFn(z) { // aproksimasi Lanczos
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFn(1 - z));
  z -= 1;
  let x = c[0];
  for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

const sigmaCache = new Map(); // sigma_u hanya bergantung pada beta; hitung sekali (waktu scheduler dicatat)
/** Satu langkah Lévy: s = u / |v|^(1/beta), u ~ N(0, sigma_u^2), v ~ N(0,1)  (Pers. 31-33). */
export function levyFlight(beta = 1.5, rand = Math.random) {
  let sigma = sigmaCache.get(beta);
  if (sigma === undefined) {
    sigma = Math.pow(
      (gammaFn(1 + beta) * Math.sin(Math.PI * beta / 2)) /
      (gammaFn((1 + beta) / 2) * beta * Math.pow(2, (beta - 1) / 2)), 1 / beta);
    sigmaCache.set(beta, sigma);
  }
  return (gauss(rand) * sigma) / Math.pow(Math.abs(gauss(rand)), 1 / beta);
}

/**
 * @param {Array<{id:number|string,size:number}>} tasks
 * @param {Array<{id:number|string,speed:number}>} vms
 * @param {object} params
 * @param {number} seed
 */
export function runHLWOA(tasks, vms, params = {}, seed = 42) {
  const start = performance.now();
  const p = {
    populationSize: 50, maxIter: 200, maxEvals: null, beta: 1.5, alpha: 1.0, b: 1,
    ...(VARIANTS[params.variant] ?? VARIANTS['HLWOA']), ...params,
  };
  const P = Math.max(2, Math.floor(params.popSize ?? params.populationSize ?? p.populationSize));
  const rand = makeRng(seed);
  const N = tasks.length, M = vms.length;
  const lb = -0.5, ub = M - 0.5;
  const counter = createCounter(p.maxEvals ?? Infinity);

  const vmIndex = new Map(vms.map((v, k) => [v.id, k]));
  const decode = x => { const a = new Array(N); for (let j = 0; j < N; j++) a[j] = Math.min(M - 1, Math.max(0, Math.round(x[j]))); return a; };
  const toIds = idx => idx.map(k => vms[k].id);
  const evalX = x => fitness(toIds(decode(x)), tasks, vms, counter); // satu panggilan = satu evaluasi
  const clamp = v => (v < lb ? lb : v > ub ? ub : v);

  // ---- 1. populasi awal: P-1 acak + 1 HEFT ----
  const pop = [];
  if (p.useHeft) pop.push(Float64Array.from(heft(tasks, vms).assignment, id => vmIndex.get(id)));
  while (pop.length < P) {
    const x = new Float64Array(N);
    for (let j = 0; j < N; j++) x[j] = lb + (ub - lb) * rand();
    pop.push(x);
  }
  let bestVal = Infinity, bestPos = null;
 for (const x of pop) { const f = evalX(x); if (f < bestVal) { bestVal = f; bestPos = Float64Array.from(x); } }
  const initialMakespan = bestVal;

  const iters = p.maxEvals ? Math.max(0, Math.min(p.maxIter, Math.floor((p.maxEvals - P) / P))) : p.maxIter;
  const history = [bestVal]; // indeks 0 = populasi awal
  const loadsOf = x => { const L = new Array(M).fill(0); for (let j = 0; j < N; j++) { const k = Math.min(M - 1, Math.max(0, Math.round(x[j]))); L[k] += tasks[j].size / vms[k].speed; } return L; };
  const tr = p.trace ? { n: Math.min(p.trace.n, P), loads0: null, loads: [], levy: [] } : null;
  const snap = () => pop.slice(0, tr.n).map(loadsOf);
  if (tr) tr.loads0 = snap();

  // ---- 2-3. iterasi ----
  for (let t = 1; t <= iters; t++) {
    const a = 2 - (2 * t) / iters;                         // Pers. (24)
    let levyIdx = -1, levyMag = 0;
    for (let i = 0; i < P; i++) {
      const X = pop[i], Xn = new Float64Array(N);
      const pr = rand();
      if (pr < 0.5) {                                       // mengepung mangsa: Pers. (25)-(28)
        for (let j = 0; j < N; j++) {
          const A = 2 * a * rand() - a, C = 2 * rand();
          Xn[j] = clamp(bestPos[j] - A * Math.abs(C * bestPos[j] - X[j]));
        }
      } else if (!p.useLevy || rand() < 0.5) {              // jaring gelembung: Pers. (29)-(30)
        const l = 2 * rand() - 1;
        const g = Math.exp(p.b * l) * Math.cos(2 * Math.PI * l);
        for (let j = 0; j < N; j++) Xn[j] = clamp(Math.abs(bestPos[j] - X[j]) * g + bestPos[j]);
      } else {                                              // gangguan Lévy: Pers. (31)-(34)
        let big = 0;
        for (let j = 0; j < N; j++) {
          const s = levyFlight(p.beta, rand);
          big = Math.max(big, Math.abs(s));
          Xn[j] = clamp(X[j] + p.alpha * s);
        }
        if (big > levyMag) { levyMag = big; levyIdx = i; }
      }
      pop[i] = Xn;
      const f = evalX(Xn);
      if (f < bestVal) { bestVal = f; bestPos = Float64Array.from(Xn); }
    }
    history.push(bestVal);
    if (tr) { tr.loads.push(snap()); tr.levy.push(levyIdx >= 0 && levyIdx < tr.n ? levyIdx : -1); }
  }

  const assignment = toIds(decode(bestPos));
  const out = {
    schedule: { assignment, makespan: bestVal },
    history, evaluations: counter.count, timeMs: performance.now() - start, initialMakespan,
  };
  if (tr) out.trace = tr;
  return out;
}

/** Pembungkus varian ablation dengan tanda tangan kontrak yang sama. */
export const runHLWOANoLevy = (tasks, vms, params = {}, seed = 42) => runHLWOA(tasks, vms, { ...params, variant: 'HLWOA-noLevy' }, seed);
export const runWOA = (tasks, vms, params = {}, seed = 42) => runHLWOA(tasks, vms, { ...params, variant: 'WOA' }, seed);
