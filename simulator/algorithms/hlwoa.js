/**
 * @module hlwoa
 * @description Algoritma Hybrid HEFT + Whale Optimization Algorithm (WOA) + Lévy Flight.
 * 
 * Prinsip Hybrid:
 * 1. Warm-Start: Dimulai dari heuristik HEFT (solusi awal berkualitas tinggi).
 * 2. Encircling Prey: Intensifikasi di sekitar leader (solusi terbaik).
 * 3. Bubble-net Spiral Attack: Eksploitasi pertukaran (swap) task antar-VM untuk meratakan beban.
 * 4. Lévy Flight Exploration: Lonjakan langkah Lévy (Mantegna) untuk melepaskan task dari bottleneck VM
 *    menuju VM dengan load rendah agar keluar dari local optima.
 * 
 * Kontrak:
 * runHLWOA(tasks, vms, params, seed) -> { schedule, history, evaluations, timeMs }
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

export function runHLWOA(tasks, vms, params = {}, seed = 42) {
  const start = performance.now();
  const rng = makeRng(seed);

  const nTasks = tasks.length;
  const nVms = vms.length;

  const popSize = params.popSize || 20;
  const maxIter = params.maxIter || 80;
  const maxEvals = params.maxEvals || 1500;
  const beta = params.beta || 1.5;
  const spiralB = params.b || 1.0;

  const counter = createCounter(maxEvals);
  const history = [];

  // 1. Solusi Awal dari HEFT (Warm-Start)
  const heftSol = heft(tasks, vms);
  let bestAssignment = [...heftSol.assignment];
  let bestMakespan = fitness(bestAssignment, tasks, vms, counter);
  history.push(bestMakespan);

  // 2. Inisialisasi Populasi Paus
  const population = [];
  const popFitness = new Float64Array(popSize);

  // Paus 0: HEFT
  population.push([...bestAssignment]);
  popFitness[0] = bestMakespan;

  for (let i = 1; i < popSize; i++) {
    const whale = [...bestAssignment];
    // Variasi perturbasi awal dari HEFT
    const numMutate = rng.int(1, Math.max(2, Math.floor(nTasks * 0.15)));
    for (let k = 0; k < numMutate; k++) {
      const tIdx = rng.int(0, nTasks - 1);
      whale[tIdx] = rng.int(0, nVms - 1);
    }
    population.push(whale);

    if (counter.canEvaluate()) {
      const fit = fitness(whale, tasks, vms, counter);
      popFitness[i] = fit;
      if (fit < bestMakespan) {
        bestMakespan = fit;
        bestAssignment = [...whale];
      }
    } else {
      popFitness[i] = Infinity;
    }
  }

  // 3. Iterasi WOA + Lévy Flight
  for (let iter = 1; iter <= maxIter; iter++) {
    if (counter.isExceeded()) break;

    const a = 2.0 - iter * (2.0 / maxIter);

    for (let i = 0; i < popSize; i++) {
      if (counter.isExceeded()) break;

      const currentWhale = population[i];
      const newWhale = [...currentWhale];
      const vmLoads = getVmLoads(currentWhale, tasks, vms);

      // Cari bottleneck VM dan lightest VM
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
        if (currentWhale[t] === bottleneckVm) {
          bottleneckTasks.push(t);
        }
      }

      const r1 = rng();
      const A = 2.0 * a * r1 - a;
      const p = rng();

      if (p < 0.5) {
        if (Math.abs(A) < 1.0) {
          // ==========================================
          // ENCIRCLING PREY (Intensifikasi Menuju Leader)
          // ==========================================
          for (let j = 0; j < nTasks; j++) {
            if (rng() < 0.25) {
              newWhale[j] = bestAssignment[j];
            }
          }
          // Kurangi beban bottleneck
          if (bottleneckTasks.length > 0 && rng() < 0.6) {
            const taskToShift = rng.choice(bottleneckTasks);
            newWhale[taskToShift] = lightestVm;
          }
        } else {
          // ==========================================
          // SEARCH FOR PREY + LÉVY FLIGHT (Eksplorasi)
          // ==========================================
          const randWhaleIdx = rng.int(0, popSize - 1);
          const randWhale = population[randWhaleIdx];

          const L = Math.abs(levyStep(beta, rng));
          const numLevyShift = Math.min(bottleneckTasks.length, Math.max(1, Math.round(L)));

          for (let k = 0; k < numLevyShift; k++) {
            if (bottleneckTasks.length > 0) {
              const taskToShift = rng.choice(bottleneckTasks);
              // Pindahkan ke VM acak yang bukan bottleneck
              let targetVm = rng.int(0, nVms - 1);
              if (targetVm === bottleneckVm && nVms > 1) {
                targetVm = (targetVm + 1) % nVms;
              }
              newWhale[taskToShift] = targetVm;
            }
          }

          // Crossover dengan random whale
          for (let j = 0; j < nTasks; j++) {
            if (rng() < 0.15) {
              newWhale[j] = randWhale[j];
            }
          }
        }
      } else {
        // ==========================================
        // BUBBLE-NET ATTACK (Spiral Swap Eksploitasi)
        // ==========================================
        // Tukar task di bottleneck VM dengan task di VM lain yang lebih ringan
        if (bottleneckTasks.length > 0) {
          const t1 = rng.choice(bottleneckTasks);
          let t2 = rng.int(0, nTasks - 1);
          while (currentWhale[t2] === bottleneckVm && nTasks > 1) {
            t2 = rng.int(0, nTasks - 1);
          }
          const tmp = newWhale[t1];
          newWhale[t1] = newWhale[t2];
          newWhale[t2] = tmp;
        }

        // Align sebagian ke best whale secara spiral
        const l = (rng() - 0.5) * 2.0;
        const spiralProb = Math.exp(spiralB * l) * Math.cos(2.0 * Math.PI * l);
        if (Math.abs(spiralProb) > 0.5) {
          for (let j = 0; j < nTasks; j++) {
            if (rng() < 0.20) {
              newWhale[j] = bestAssignment[j];
            }
          }
        }
      }

      // Evaluasi solusi baru
      if (counter.canEvaluate()) {
        const fit = fitness(newWhale, tasks, vms, counter);
        if (fit < popFitness[i]) {
          population[i] = newWhale;
          popFitness[i] = fit;
          if (fit < bestMakespan) {
            bestMakespan = fit;
            bestAssignment = [...newWhale];
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
