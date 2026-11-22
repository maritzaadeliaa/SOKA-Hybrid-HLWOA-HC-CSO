/**
 * @module heftRunner
 * @description Runner HEFT yang memenuhi kontrak:
 * runHeft(tasks, vms, params, seed) -> { schedule, history, evaluations, timeMs }
 */

import { heft } from '../heft.js';
import { fitness } from '../fitness.js';
import { createCounter } from '../counter.js';

/**
 * Menjalankan algoritma HEFT sesuai kontrak data.
 * 
 * @param {Array<{ id: number|string, size: number }>} tasks 
 * @param {Array<{ id: number|string, speed: number }>} vms 
 * @param {Object} [params={}] 
 * @param {number} [seed=42] 
 * @returns {{
 *   schedule: { assignment: Array<number|string>, makespan: number },
 *   history: number[],
 *   evaluations: number,
 *   timeMs: number
 * }}
 */
export function runHeft(tasks, vms, params = {}, seed = 42) {
  const start = performance.now();
  const counter = createCounter(params.maxEvals || Infinity);

  const initial = heft(tasks, vms);
  const makespan = fitness(initial.assignment, tasks, vms, counter);
  const timeMs = performance.now() - start;

  return {
    schedule: {
      assignment: initial.assignment,
      makespan: makespan
    },
    history: [makespan],
    evaluations: counter.count,
    timeMs
  };
}
