/**
 * @module tabuSearch
 * @description Adapter Tabu Search (TS) dari folder sumber (Metaheuristic/SOKA-metaheurictic/src/tabu_search.py).
 * 
 * Karakteristik:
 * 1. Warm-Start: Dimulai dari heuristik HEFT/LPT.
 * 2. 3 Operator Lingkungan (Neighborhood Moves):
 *    - Critical VM Move (50%): Memindahkan task dari bottleneck VM ke VM lain.
 *    - Cost Reduction Move (25%): Memindahkan task dari Compute VM ke Standard/Light VM.
 *    - Swap Move (25%): Menukar 2 task antar-VM.
 * 3. Tabu Matrix: Menghindari cycling selama tabu_tenure = 15 iterasi.
 * 4. Aspiration Criterion: Mengizinkan langkah tabu jika menghasilkan rekor fitness terbaik baru.
 * 
 * Kontrak:
 * runTS(tasks, vms, params, seed) -> { schedule, history, evaluations, timeMs }
 */

import { makeRng } from '../rng.js';
import { createCounter } from '../counter.js';
import { heft } from '../heft.js';
import { fitness } from '../fitness.js';

export function runTS(tasks, vms, params = {}, seed = 42) {
  const start = performance.now();
  const rng = makeRng(seed);

  const n = tasks.length;
  const m = vms.length;

  const maxIterations = params.maxIter || 150;
  const neighborhoodSize = params.neighborhoodSize || 40;
  const tabuTenure = params.tabuTenure || 15;
  const maxEvals = params.maxEvals || 1500;

  const counter = createCounter(maxEvals);
  const history = [];

  // Inisialisasi dari HEFT
  const initSol = heft(tasks, vms);
  let current = [...initSol.assignment];
  let best = [...current];

  let currentMakespan = fitness(current, tasks, vms, counter);
  let bestMakespan = currentMakespan;
  history.push(bestMakespan);

  // Tabu Matrix: tabuUntil[taskIdx][origVmId]
  const tabuUntil = Array.from({ length: n }, () => new Int32Array(m));

  // Hitung beban VM untuk mendeteksi bottleneck VM
  function getBottleneckVm(assignment) {
    const vmFinish = new Float64Array(m);
    for (let i = 0; i < n; i++) {
      vmFinish[assignment[i]] += tasks[i].size / vms[assignment[i]].speed;
    }
    let maxT = -1;
    let bVm = 0;
    for (let j = 0; j < m; j++) {
      if (vmFinish[j] > maxT) {
        maxT = vmFinish[j];
        bVm = j;
      }
    }
    return bVm;
  }

  for (let it = 1; it <= maxIterations; it++) {
    if (counter.isExceeded()) break;

    const bottleneckVm = getBottleneckVm(current);
    const bottleneckTasks = [];
    const computeTasks = [];

    for (let i = 0; i < n; i++) {
      if (current[i] === bottleneckVm) bottleneckTasks.push(i);
      // VM compute: 4 VM pertama (id 0..3)
      if (current[i] < 4) computeTasks.push(i);
    }

    let bestCandidateFit = Infinity;
    let bestCandidateAssignment = null;
    let bestMoveTask = -1;
    let bestMoveOrigVm = -1;

    for (let c = 0; c < neighborhoodSize; c++) {
      if (counter.isExceeded()) break;

      const roll = rng();
      let moveType = 'CRITICAL';
      if (roll < 0.50) moveType = 'CRITICAL';
      else if (roll < 0.75) moveType = 'COST';
      else moveType = 'SWAP';

      const candidate = [...current];
      let taskIdx = -1;
      let origVm = -1;
      let targetVm = -1;

      if (moveType === 'CRITICAL' && bottleneckTasks.length > 0) {
        taskIdx = rng.choice(bottleneckTasks);
        origVm = candidate[taskIdx];
        do {
          targetVm = rng.int(0, m - 1);
        } while (targetVm === origVm && m > 1);
        candidate[taskIdx] = targetVm;
      } else if (moveType === 'COST' && computeTasks.length > 0) {
        taskIdx = rng.choice(computeTasks);
        origVm = candidate[taskIdx];
        // Pindah ke standard (4..9) atau light (10..15)
        targetVm = rng.int(4, m - 1);
        candidate[taskIdx] = targetVm;
      } else {
        // SWAP MOVE
        const t1 = rng.int(0, n - 1);
        let t2 = rng.int(0, n - 1);
        while (t2 === t1 && n > 1) t2 = rng.int(0, n - 1);
        origVm = candidate[t1];
        targetVm = candidate[t2];
        candidate[t1] = targetVm;
        candidate[t2] = origVm;
        taskIdx = t1;
      }

      if (taskIdx >= 0 && counter.canEvaluate()) {
        const candFit = fitness(candidate, tasks, vms, counter);
        const isTabu = tabuUntil[taskIdx][origVm] > it;
        const aspiration = candFit < bestMakespan;

        if (!isTabu || aspiration) {
          if (candFit < bestCandidateFit) {
            bestCandidateFit = candFit;
            bestCandidateAssignment = candidate;
            bestMoveTask = taskIdx;
            bestMoveOrigVm = origVm;
          }
        }
      }
    }

    if (bestCandidateAssignment) {
      current = bestCandidateAssignment;
      currentMakespan = bestCandidateFit;
      if (bestMoveTask >= 0 && bestMoveOrigVm >= 0) {
        tabuUntil[bestMoveTask][bestMoveOrigVm] = it + tabuTenure;
      }
      if (currentMakespan < bestMakespan) {
        bestMakespan = currentMakespan;
        best = [...current];
      }
    }

    history.push(bestMakespan);
  }

  const timeMs = performance.now() - start;

  return {
    schedule: {
      assignment: best,
      makespan: bestMakespan
    },
    history,
    evaluations: counter.count,
    timeMs
  };
}
