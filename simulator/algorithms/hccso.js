/**
 * @module hccso
 * @description Algoritma Hybrid HEFT + Cat Swarm Optimization (CSO) untuk Penjadwalan Task Cloud.
 * 
 * Perbaikan Masalah Stagnansi:
 * 1. Seeking Mode: Menggunakan mutasi CDC mikro terarah (1-2 task di VM bottleneck)
 *    dan swap beban antar-VM, bukan mengacak 25 task sekaligus yang merusak jadwal HEFT.
 * 2. Tracing Mode: Kucing mengejar bestAssignment secara terarah pada dimensi yang berbeda,
 *    dan kucing terbaik (leader) melakukan penyesuaian beban aktif pada task bottleneck.
 * 
 * Kontrak:
 * runHCCSO(tasks, vms, params, seed) -> { schedule, history, evaluations, timeMs }
 */

import { makeRng } from '../rng.js';
import { createCounter } from '../counter.js';
import { heft } from '../heft.js';
import { fitness } from '../fitness.js';

function getVmLoads(assignment, tasks, vms) {
  const loads = new Float64Array(vms.length);
  for (let i = 0; i < tasks.length; i++) {
    loads[assignment[i]] += tasks[i].size / vms[assignment[i]].speed;
  }
  return loads;
}

export function runHCCSO(tasks, vms, params = {}, seed = 42) {
  const start = performance.now();
  const rng = makeRng(seed);

  const nTasks = tasks.length;
  const nVms = vms.length;

  const popSize = params.popSize || 20;
  const maxIter = params.maxIter || 80;
  const maxEvals = params.maxEvals || 1500;
  const mr = params.mr !== undefined ? params.mr : 0.3; // Mixture Ratio: 30% Tracing, 70% Seeking
  const smp = params.smp || 4;  // Seeking Memory Pool (jumlah salinan kandidat)

  const counter = createCounter(maxEvals);
  const history = [];

  // 1. Solusi Awal HEFT (Warm-Start)
  const heftSol = heft(tasks, vms);
  let bestAssignment = [...heftSol.assignment];
  let bestMakespan = fitness(bestAssignment, tasks, vms, counter);
  history.push(bestMakespan);

  // 2. Inisialisasi Populasi Kucing
  const cats = [];
  const catFitness = new Float64Array(popSize);

  // Kucing 0: HEFT
  cats.push([...bestAssignment]);
  catFitness[0] = bestMakespan;

  // Kucing 1 s/d popSize - 1: Variasi terarah dari HEFT (swap 1-3 task)
  for (let i = 1; i < popSize; i++) {
    const cat = [...bestAssignment];
    const numSwaps = rng.int(1, 3);
    for (let k = 0; k < numSwaps; k++) {
      const t1 = rng.int(0, nTasks - 1);
      const t2 = rng.int(0, nTasks - 1);
      const tmp = cat[t1];
      cat[t1] = cat[t2];
      cat[t2] = tmp;
    }
    cats.push(cat);

    if (counter.canEvaluate()) {
      const fit = fitness(cat, tasks, vms, counter);
      catFitness[i] = fit;
      if (fit < bestMakespan) {
        bestMakespan = fit;
        bestAssignment = [...cat];
      }
    } else {
      catFitness[i] = Infinity;
    }
  }

  // 3. Iterasi Cat Swarm Optimization
  for (let iter = 1; iter <= maxIter; iter++) {
    if (counter.isExceeded()) break;

    for (let i = 0; i < popSize; i++) {
      if (counter.isExceeded()) break;

      const currentCat = cats[i];
      const isTracing = rng() < mr;

      // Hitung beban tiap VM untuk mendeteksi bottleneck & lightest VM
      const vmLoads = getVmLoads(currentCat, tasks, vms);
      let bottleneckVm = 0;
      let maxLoad = -1;
      let lightestVm = 0;
      let minLoad = Infinity;

      for (let v = 0; v < nVms; v++) {
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
      for (let t = 0; t < nTasks; t++) {
        if (currentCat[t] === bottleneckVm) {
          bottleneckTasks.push(t);
        }
      }

      if (!isTracing) {
        // ==========================================
        // MODE SEEKING (Observasi & Eksplorasi Lokal Cerdas)
        // ==========================================
        let bestCandidate = null;
        let bestCandidateFit = Infinity;

        // Buat sejumlah SMP kandidat
        for (let s = 0; s < smp; s++) {
          if (counter.isExceeded()) break;

          const candidate = [...currentCat];
          const roll = rng();

          if (roll < 0.50 && bottleneckTasks.length > 0) {
            // Operator 1: Pindahkan 1 task dari bottleneck ke VM teringan
            const taskToShift = rng.choice(bottleneckTasks);
            candidate[taskToShift] = lightestVm;
          } else if (roll < 0.80 && bottleneckTasks.length > 0) {
            // Operator 2: Tukar (Swap) 1 task di bottleneck dengan task di VM lain yang lebih kecil
            const t1 = rng.choice(bottleneckTasks);
            let t2 = rng.int(0, nTasks - 1);
            while (candidate[t2] === bottleneckVm && nTasks > 1) {
              t2 = rng.int(0, nTasks - 1);
            }
            const tmp = candidate[t1];
            candidate[t1] = candidate[t2];
            candidate[t2] = tmp;
          } else {
            // Operator 3: Mutasi mikro 1 task acak ke VM acak
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

        // Seleksi: terima kandidat terbaik jika lebih baik dari posisi kucing saat ini
        if (bestCandidate && bestCandidateFit < catFitness[i]) {
          cats[i] = bestCandidate;
          catFitness[i] = bestCandidateFit;
          if (bestCandidateFit < bestMakespan) {
            bestMakespan = bestCandidateFit;
            bestAssignment = [...bestCandidate];
          }
        }

      } else {
        // ==========================================
        // MODE TRACING (Mengejar Posisi Kucing Terbaik)
        // ==========================================
        const newCat = [...currentCat];

        // Jika kucing saat ini adalah kucing terbaik, lakukan intensifikasi pencarian
        if (catFitness[i] === bestMakespan && bottleneckTasks.length > 0) {
          const tIdx = rng.choice(bottleneckTasks);
          newCat[tIdx] = lightestVm;
        } else {
          // Kucing lain bergerak mendekati bestAssignment pada sejumlah dimensi
          const traceRate = 0.40 + rng() * 0.30; // Adopsi 40% - 70% gen terbaik
          for (let j = 0; j < nTasks; j++) {
            if (currentCat[j] !== bestAssignment[j] && rng() < traceRate) {
              newCat[j] = bestAssignment[j];
            }
          }
        }

        if (counter.canEvaluate()) {
          const fit = fitness(newCat, tasks, vms, counter);
          if (fit < catFitness[i]) {
            cats[i] = newCat;
            catFitness[i] = fit;
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
      makespan: bestMakespan
    },
    history,
    evaluations: counter.count,
    timeMs
  };
}
