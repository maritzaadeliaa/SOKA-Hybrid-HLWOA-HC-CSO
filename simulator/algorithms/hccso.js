/**
 * @module hccso
 * @description Algoritma Hybrid HEFT + Cat Swarm Optimization (HC-CSO)
 * untuk Penjadwalan Task Independen pada Cloud Heterogen.
 *
 * Referensi Landasan:
 * Jai Bhagwan & Sanjeev Kumar (2021), "An HC-CSO Algorithm for Workflow Scheduling
 * in Heterogeneous Cloud Computing System", IJACSA Vol. 12, No. 6, pp. 484-492.
 *
 * Komponen Utama (disesuaikan untuk ruang pencarian diskrit VM ID 0..nVms-1):
 * 1. Inisialisasi Warm-Start HEFT (dapat dimatikan via `useHeft: false` untuk varian CSO murni).
 * 2. Seeking Mode (MR): Mutasi mikro terarah pada VM bottleneck, swap beban antar-VM,
 *    serta langkah pencarian lokal berbasis memori pribadi (CSA local step, fl = 0.5).
 * 3. Tracing Mode: Pembaruan vektor kecepatan V_{k,d} dengan Self-Motivated Inertia Weight (SMIW)
 *    persamaan (27)-(30) dari Bhagwan & Kumar (2021) (dapat dimatikan via `useInertia: false`).
 *
 * Kontrak:
 * runHCCSO(tasks, vms, params, seed) -> { schedule: { assignment, makespan }, history, evaluations, timeMs }
 */

import { makeRng } from "../rng.js";
import { createCounter } from "../counter.js";
import { heft } from "../heft.js";
import { fitness } from "../fitness.js";

function clampInt(val, min, max) {
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

function clampFloat(val, min, max) {
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

function getVmLoads(assignment, tasks, vms) {
  const loads = new Float64Array(vms.length);
  for (let i = 0; i < tasks.length; i++) {
    const vmIdx = assignment[i];
    loads[vmIdx] += tasks[i].size / vms[vmIdx].speed;
  }
  return loads;
}

function findBottleneckAndLightest(assignment, tasks, vms) {
  const vmLoads = getVmLoads(assignment, tasks, vms);
  let bottleneckVm = 0;
  let maxLoad = -1;
  let lightestVm = 0;
  let minLoad = Infinity;

  for (let v = 0; v < vms.length; v++) {
    if (vmLoads[v] > maxLoad) {
      maxLoad = vmLoads[v];
      bottleneckVm = v;
    }
    if (vmLoads[v] < minLoad) {
      minLoad = vmLoads[v];
      lightestVm = v;
    }
  }

  const bottleneckTasks = [];
  for (let t = 0; t < tasks.length; t++) {
    if (assignment[t] === bottleneckVm) {
      bottleneckTasks.push(t);
    }
  }

  return { bottleneckVm, lightestVm, bottleneckTasks };
}

/**
 * Menghitung Self-Motivated Inertia Weight (SMIW) sesuai Persamaan (27)
 * Bhagwan & Kumar (2021):
 *   gamma = gammaMax * exp(-c * (iter / maxIter)^c)
 */
function computeSmiw(iter, maxIter, gammaMax = 2.0, c = 2.0) {
  const ratio = maxIter > 0 ? iter / maxIter : 0;
  return gammaMax * Math.exp(-c * Math.pow(ratio, c));
}

export function runHCCSO(tasks, vms, params = {}, seed = 42) {
  const start = performance.now();
  const rng = makeRng(seed);

  const nTasks = tasks.length;
  const nVms = vms.length;

  // Parameter standar & hyperparameter paper Bhagwan & Kumar (2021)
  const popSize = params.popSize || 20;
  const maxIter = params.maxIter || 80;
  const maxEvals = params.maxEvals || 1500;
  const mr = params.mr !== undefined ? params.mr : 0.3; // Mixing Ratio (Table I: 0.2 - 0.3)
  const smp = params.smp || 4; // Seeking Memory Pool
  const c1 = params.c1 !== undefined ? params.c1 : 1.5; // Acceleration coefficient (Table I: 1.5)
  const fl = params.fl !== undefined ? params.fl : 0.5; // Crow Search flight length (Table I: 0.5)
  const gammaMax = params.gammaMax !== undefined ? params.gammaMax : 2.0; // Fig. 2 line 27: 2
  const cFactor = params.cFactor !== undefined ? params.cFactor : 2.0; // Fig. 2 line 27: 2

  // Flag kontrol untuk eksperimen Ablation (P3):
  // - HC-CSO penuh     : { useHeft: true,  useInertia: true }
  // - HC-CSO tanpa IW  : { useHeft: true,  useInertia: false }
  // - CSO saja         : { useHeft: false, useInertia: true }
  const useHeft = params.useHeft !== undefined ? Boolean(params.useHeft) : true;
  const useInertia =
    params.useInertia !== undefined ? Boolean(params.useInertia) : true;

  // Batas kecepatan maksimum untuk mencegah velocity outrange (Section V & VI paper)
  const vMax = Math.max(1.0, (nVms - 1) * 0.5);

  const counter = createCounter(maxEvals);
  const history = [];

  const cats = [];
  const pBestCats = []; // Memori posisi terbaik masing-masing agen (M_{L,D})
  const catFitness = new Float64Array(popSize);
  const pBestFitness = new Float64Array(popSize);
  const velocities = Array.from(
    { length: popSize },
    () => new Float64Array(nTasks),
  );

  let bestAssignment = new Array(nTasks).fill(0);
  let bestMakespan = Infinity;

  // =========================================================================
  // 1. INISIALISASI POPULASI (Warm-Start HEFT vs Acak untuk CSO Murni)
  // =========================================================================
  if (useHeft) {
    const heftSol = heft(tasks, vms);
    const baseHeft = [...heftSol.assignment];

    if (counter.canEvaluate()) {
      bestAssignment = [...baseHeft];
      bestMakespan = fitness(bestAssignment, tasks, vms, counter);
    }

    // Kucing 0: Solusi murni HEFT
    cats.push([...baseHeft]);
    pBestCats.push([...baseHeft]);
    catFitness[0] = bestMakespan;
    pBestFitness[0] = bestMakespan;

    // Kucing 1..popSize-1: Variasi terarah dari HEFT (swap 1-3 task)
    for (let i = 1; i < popSize; i++) {
      const cat = [...baseHeft];
      const numSwaps = rng.int(1, 3);
      for (let k = 0; k < numSwaps; k++) {
        const t1 = rng.int(0, nTasks - 1);
        const t2 = rng.int(0, nTasks - 1);
        const tmp = cat[t1];
        cat[t1] = cat[t2];
        cat[t2] = tmp;
      }

      cats.push(cat);
      pBestCats.push([...cat]);

      if (counter.canEvaluate()) {
        const fit = fitness(cat, tasks, vms, counter);
        catFitness[i] = fit;
        pBestFitness[i] = fit;
        if (fit < bestMakespan) {
          bestMakespan = fit;
          bestAssignment = [...cat];
        }
      } else {
        catFitness[i] = Infinity;
        pBestFitness[i] = Infinity;
      }
    }
  } else {
    // Varian CSO Saja: Seluruh populasi diinisialisasi acak seragam
    for (let i = 0; i < popSize; i++) {
      const cat = new Array(nTasks);
      for (let j = 0; j < nTasks; j++) {
        cat[j] = rng.int(0, nVms - 1);
        velocities[i][j] = (rng() * 2 - 1) * 0.5;
      }

      cats.push(cat);
      pBestCats.push([...cat]);

      if (counter.canEvaluate()) {
        const fit = fitness(cat, tasks, vms, counter);
        catFitness[i] = fit;
        pBestFitness[i] = fit;
        if (fit < bestMakespan) {
          bestMakespan = fit;
          bestAssignment = [...cat];
        }
      } else {
        catFitness[i] = Infinity;
        pBestFitness[i] = Infinity;
      }
    }
  }

  history.push(bestMakespan);

  // =========================================================================
  // 2. ITERASI UTAMA HC-CSO (SEEKING MODE & TRACING MODE + SMIW)
  // =========================================================================
  for (let iter = 1; iter <= maxIter; iter++) {
    if (counter.isExceeded()) break;

    // Hitung bobot inersia iterasi saat ini:
    // - Jika useInertia === false -> gamma = 0 (tanpa inertia weight)
    // - Jika params.inertiaWeight diberikan (mis. dari slider UI) -> gunakan nilai tersebut
    // - Default -> Self-Motivated Inertia Weight (SMIW) Persamaan (27)
    let gamma = 0;
    if (useInertia) {
      gamma =
        params.inertiaWeight !== undefined
          ? params.inertiaWeight
          : computeSmiw(iter, maxIter, gammaMax, cFactor);
    }

    for (let i = 0; i < popSize; i++) {
      if (counter.isExceeded()) break;

      const currentCat = cats[i];
      const isTracing = rng() < mr;

      const { bottleneckVm, lightestVm, bottleneckTasks } =
        findBottleneckAndLightest(currentCat, tasks, vms);

      if (!isTracing) {
        // -------------------------------------------------------------------
        // A. SEEKING MODE (Eksplorasi Lokal Terarah + Memori Lokal CSA)
        // -------------------------------------------------------------------
        let bestCandidate = null;
        let bestCandidateFit = Infinity;

        for (let s = 0; s < smp; s++) {
          if (counter.isExceeded()) break;

          const candidate = [...currentCat];
          const roll = rng();

          if (roll < 0.45 && bottleneckTasks.length > 0) {
            // Operator 1: Pindahkan 1 task dari VM bottleneck ke VM teringan
            const taskToShift = rng.choice(bottleneckTasks);
            candidate[taskToShift] = lightestVm;
          } else if (roll < 0.75 && bottleneckTasks.length > 0) {
            // Operator 2: Tukar (Swap) 1 task di bottleneck dengan task di VM lain
            const t1 = rng.choice(bottleneckTasks);
            let t2 = rng.int(0, nTasks - 1);
            if (nTasks > 1 && candidate[t2] === bottleneckVm) {
              t2 = (t2 + 1) % nTasks;
            }
            const tmp = candidate[t1];
            candidate[t1] = candidate[t2];
            candidate[t2] = tmp;
          } else if (roll < 0.9) {
            // Operator 3: Langkah Pencarian Lokal CSA menuju memori pribadi M_i
            // X_{i,d} = round(X_{i,d} + r * fl * (M_{i,d} - X_{i,d})) (Eq. 4 / Fig. 2 line 17)
            const rStep = rng();
            let moved = false;
            for (let j = 0; j < nTasks; j++) {
              const diff = pBestCats[i][j] - candidate[j];
              if (diff !== 0 && rng() < 0.25) {
                const nextVm = Math.round(candidate[j] + rStep * fl * diff);
                candidate[j] = clampInt(nextVm, 0, nVms - 1);
                moved = true;
              }
            }
            if (!moved && nTasks > 0) {
              const tIdx = rng.int(0, nTasks - 1);
              candidate[tIdx] = rng.int(0, nVms - 1);
            }
          } else {
            // Operator 4: Mutasi mikro 1 task acak ke VM acak
            const tIdx = rng.int(0, nTasks - 1);
            candidate[tIdx] = rng.int(0, nVms - 1);
          }

          if (counter.canEvaluate()) {
            const fit = fitness(candidate, tasks, vms, counter);
            if (fit < bestCandidateFit) {
              bestCandidateFit = fit;
              bestCandidate = candidate;
            }
          }
        }

        // Seleksi greedy untuk memperbarui posisi kucing dan memori pribadi
        if (bestCandidate && bestCandidateFit < catFitness[i]) {
          cats[i] = bestCandidate;
          catFitness[i] = bestCandidateFit;

          if (bestCandidateFit < pBestFitness[i]) {
            pBestFitness[i] = bestCandidateFit;
            pBestCats[i] = [...bestCandidate];
          }

          if (bestCandidateFit < bestMakespan) {
            bestMakespan = bestCandidateFit;
            bestAssignment = [...bestCandidate];
          }
        }
      } else {
        // -------------------------------------------------------------------
        // B. TRACING MODE (Pembaruan Kecepatan dengan SMIW Eq. 27-30)
        // -------------------------------------------------------------------
        const newCat = [...currentCat];
        const vel = velocities[i];

        if (catFitness[i] === bestMakespan && bottleneckTasks.length > 0) {
          // Intensifikasi leader pada task bottleneck agar terus memperbaiki solusi terbaik
          const tIdx = rng.choice(bottleneckTasks);
          const oldVm = newCat[tIdx];
          newCat[tIdx] = lightestVm;
          vel[tIdx] = clampFloat(
            gamma * vel[tIdx] + (lightestVm - oldVm),
            -vMax,
            vMax,
          );
        } else {
          let changed = false;
          for (let j = 0; j < nTasks; j++) {
            const r1 = rng();
            // Persamaan (28): V_{K,D} = gamma * V_{K,D} + c1 * r1 * (X_{BEST,D} - X_{K,D})
            const rawVel =
              gamma * vel[j] + c1 * r1 * (bestAssignment[j] - currentCat[j]);
            const clampedVel = clampFloat(rawVel, -vMax, vMax);
            vel[j] = clampedVel;

            // Persamaan (30) terdiskritisasi: X_{K,D} = clamp(round(X_{K,D} + V_{K,D}), 0, nVms - 1)
            const nextVm = clampInt(
              Math.round(currentCat[j] + clampedVel),
              0,
              nVms - 1,
            );
            if (nextVm !== currentCat[j]) {
              changed = true;
            }
            newCat[j] = nextVm;
          }

          // Penjaga stagnansi diskrit: jika pembulatan tidak mengubah satu pun VM,
          // pindahkan 1 task bottleneck ke VM teringan agar jatah evaluasi tetap produktif
          if (!changed && bottleneckTasks.length > 0) {
            const tIdx = rng.choice(bottleneckTasks);
            newCat[tIdx] = lightestVm;
          }
        }

        if (counter.canEvaluate()) {
          const fit = fitness(newCat, tasks, vms, counter);
          if (fit < catFitness[i]) {
            cats[i] = newCat;
            catFitness[i] = fit;

            if (fit < pBestFitness[i]) {
              pBestFitness[i] = fit;
              pBestCats[i] = [...newCat];
            }

            if (fit < bestMakespan) {
              bestMakespan = fit;
              bestAssignment = [...newCat];
            }
          }
        }
      }
    }

    history.push(bestMakespan);
  }

  const timeMs = performance.now() - start;

  return {
    schedule: {
      assignment: bestAssignment,
      makespan: bestMakespan,
    },
    history,
    evaluations: counter.count,
    timeMs,
  };
}
