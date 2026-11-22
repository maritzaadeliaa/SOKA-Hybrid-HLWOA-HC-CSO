/**
 * @module batchRunner
 * @description Modul pengujian batch multi-seed deterministik untuk evaluasi adil (Fair Benchmark).
 * 
 * Signature:
 * runBatch(methods, tasks, vms, params, seeds, maxEvals) -> hasilObj
 * 
 * Format Keluaran:
 * {
 *   "HLWOA": [ { seed, makespan, waiting, imbalance, utilization, cost, timeMs }, ... ],
 *   "HC-CSO": [ ... ],
 *   ...
 * }
 */

import { metrics } from './metrics.js';

/**
 * Menjalankan evaluasi batch untuk beberapa metode penjadwalan dengan beberapa seed acak.
 * 
 * @param {Record<string, Function>} methods - Map nama algoritma ke fungsi runner run(tasks, vms, params, seed).
 * @param {Array<{ id: number|string, size: number }>} tasks - Array task.
 * @param {Array<{ id: number|string, speed: number }>} vms - Array VM.
 * @param {Object} [params={}] - Parameter bersama algoritma.
 * @param {number[]} [seeds=[42, 101, 202, 303, 404, 505, 606, 707, 808, 909]] - Daftar seed (minimal 10).
 * @param {number} [maxEvals=1500] - Batas evaluasi fitness yang setara untuk tiap run.
 * @returns {Record<string, Array<{ seed: number, makespan: number, waiting: number, imbalance: number, utilization: number, cost: number, timeMs: number }>>}
 */
export function runBatch(methods, tasks, vms, params = {}, seeds = null, maxEvals = 1500) {
  const activeSeeds = (seeds && seeds.length >= 1)
    ? seeds
    : [42, 101, 202, 303, 404, 505, 606, 707, 808, 909];

  const results = {};
  const runParams = { ...params, maxEvals };

  for (const [methodName, runnerFn] of Object.entries(methods)) {
    if (typeof runnerFn !== 'function') continue;

    results[methodName] = [];

    for (const seed of activeSeeds) {
      // Jalankan algoritma dengan seed tertentu
      const output = runnerFn(tasks, vms, runParams, seed);

      // Hitung 5 metrik performa sesuai kontrak
      const m = metrics(output.schedule.assignment, tasks, vms);

      results[methodName].push({
        seed: seed,
        makespan: Number(m.makespan.toFixed(4)),
        waiting: Number(m.waiting.toFixed(4)),
        imbalance: Number(m.imbalance.toFixed(4)),
        utilization: Number(m.utilization.toFixed(4)),
        cost: Number(m.cost.toFixed(4)),
        timeMs: Number(output.timeMs.toFixed(3))
      });
    }
  }

  return results;
}
