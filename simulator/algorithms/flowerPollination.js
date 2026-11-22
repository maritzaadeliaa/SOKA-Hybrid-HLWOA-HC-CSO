/**
 * @module flowerPollination
 * @description Discrete Flower Pollination Algorithm (DFPA) untuk Penjadwalan Task Cloud.
 * 
 * Karakteristik:
 * 1. Global Pollination (Biotik): Dipandu oleh Lévy Flight (Mantegna, beta = 1.5).
 *    - Untuk bunga terbaik (g*): Melakukan swap dan relokasi task bottleneck ke VM berkapasitas tinggi.
 *    - Untuk bunga lain: Lévy Crossover mengadopsi gen g* sesuai probabilitas Lévy.
 * 2. Local Pollination (Abiotik):
 *    - Uniform Crossover antara 2 bunga acak + mutasi swap mikro untuk diversitas.
 * 
 * Kontrak:
 * runFPA(tasks, vms, params, seed) -> { schedule, history, evaluations, timeMs }
 */

import { makeRng } from '../rng.js';
import { createCounter } from '../counter.js';
import { heft } from '../heft.js';
import { fitness } from '../fitness.js';

function levyStep(beta, rng) {
  const sigmaU = 0.6965745;
  let u1 = rng();
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);

  const u = z0 * sigmaU;
  const v = z1;
  return u / Math.pow(Math.abs(v) + 1e-9, 1.0 / beta);
}

function getVmLoads(assignment, tasks, vms) {
  const loads = new Float64Array(vms.length);
  for (let i = 0; i < tasks.length; i++) {
    loads[assignment[i]] += tasks[i].size / vms[assignment[i]].speed;
  }
  return loads;
}

export function runFPA(tasks, vms, params = {}, seed = 42) {
  const start = performance.now();
  const rng = makeRng(seed);

  const n = tasks.length;
  const m = vms.length;

  const popSize = params.popSize || 20;
  const maxIterations = params.maxIter || 80;
  const maxEvals = params.maxEvals || 1500;
  const switchProb = params.switchProbability !== undefined ? params.switchProbability : 0.8;
  const beta = params.beta || 1.5;

  const counter = createCounter(maxEvals);
  const history = [];

  // Inisialisasi dari HEFT (Warm-Start)
  const initSol = heft(tasks, vms);
  let bestFlower = [...initSol.assignment];
  let bestMakespan = fitness(bestFlower, tasks, vms, counter);
  history.push(bestMakespan);

  // Populasi Bunga
  const population = [];
  const flowerFitness = new Float64Array(popSize);

  // Bunga 0: HEFT
  population.push([...bestFlower]);
  flowerFitness[0] = bestMakespan;

  // Bunga 1 s/d popSize - 1: Variasi swap dari HEFT
  for (let i = 1; i < popSize; i++) {
    const flower = [...bestFlower];
    const numSwaps = rng.int(1, 3);
    for (let k = 0; k < numSwaps; k++) {
      const t1 = rng.int(0, n - 1);
      const t2 = rng.int(0, n - 1);
      const tmp = flower[t1];
      flower[t1] = flower[t2];
      flower[t2] = tmp;
    }
    population.push(flower);

    if (counter.canEvaluate()) {
      const fit = fitness(flower, tasks, vms, counter);
      flowerFitness[i] = fit;
      if (fit < bestMakespan) {
        bestMakespan = fit;
        bestFlower = [...flower];
      }
    } else {
      flowerFitness[i] = Infinity;
    }
  }

  for (let it = 1; it <= maxIterations; it++) {
    if (counter.isExceeded()) break;

    for (let i = 0; i < popSize; i++) {
      if (counter.isExceeded()) break;

      const currentFlower = population[i];
      const newFlower = [...currentFlower];

      // Deteksi bottleneck VM dan VM dengan load terendah
      const vmLoads = getVmLoads(currentFlower, tasks, vms);
      let bottleneckVm = 0;
      let maxLoad = -1;
      let lightestVm = 0;
      let minLoad = Infinity;

      for (let v = 0; v < m; v++) {
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
      for (let t = 0; t < n; t++) {
        if (currentFlower[t] === bottleneckVm) {
          bottleneckTasks.push(t);
        }
      }

      const isGlobal = rng() < switchProb;

      if (isGlobal) {
        // ==========================================
        // GLOBAL POLLINATION (Biotik — Lévy Flight)
        // ==========================================
        const L = Math.abs(levyStep(beta, rng));

        // Jika bunga adalah bestFlower atau fitness sama dengan best:
        // Lakukan eksplorasi cerdas untuk memecahkan bottleneck
        if (flowerFitness[i] === bestMakespan && bottleneckTasks.length > 0) {
          const roll = rng();
          if (roll < 0.60) {
            // Swap task bottleneck dengan task di VM lain
            const t1 = rng.choice(bottleneckTasks);
            let t2 = rng.int(0, n - 1);
            while (newFlower[t2] === bottleneckVm && n > 1) {
              t2 = rng.int(0, n - 1);
            }
            const tmp = newFlower[t1];
            newFlower[t1] = newFlower[t2];
            newFlower[t2] = tmp;
          } else {
            // Pindahkan ke VM acak
            const t1 = rng.choice(bottleneckTasks);
            newFlower[t1] = rng.int(0, m - 1);
          }
        } else {
          // Bunga lain: Lévy-guided Crossover ke bestFlower
          const crossoverProb = Math.min(0.85, 0.35 + 0.15 * L);
          for (let j = 0; j < n; j++) {
            if (rng() < crossoverProb) {
              newFlower[j] = bestFlower[j];
            }
          }
          if (bottleneckTasks.length > 0 && rng() < 0.5) {
            const t1 = rng.choice(bottleneckTasks);
            newFlower[t1] = lightestVm;
          }
        }
      } else {
        // ==========================================
        // LOCAL POLLINATION (Abiotik — Crossover & Swap)
        // ==========================================
        let j = rng.int(0, popSize - 1);
        let k = rng.int(0, popSize - 1);
        while (k === j && popSize > 1) k = rng.int(0, popSize - 1);

        for (let d = 0; d < n; d++) {
          if (rng() < 0.5) {
            newFlower[d] = population[j][d];
          } else {
            newFlower[d] = population[k][d];
          }
        }

        // Swap mikro
        const t1 = rng.int(0, n - 1);
        const t2 = rng.int(0, n - 1);
        const tmp = newFlower[t1];
        newFlower[t1] = newFlower[t2];
        newFlower[t2] = tmp;
      }

      if (counter.canEvaluate()) {
        const fit = fitness(newFlower, tasks, vms, counter);
        if (fit < flowerFitness[i]) {
          population[i] = newFlower;
          flowerFitness[i] = fit;
          if (fit < bestMakespan) {
            bestMakespan = fit;
            bestFlower = [...newFlower];
          }
        }
      }
    }

    history.push(bestMakespan);
  }

  const timeMs = performance.now() - start;

  return {
    schedule: {
      assignment: bestFlower,
      makespan: bestMakespan
    },
    history,
    evaluations: counter.count,
    timeMs
  };
}
