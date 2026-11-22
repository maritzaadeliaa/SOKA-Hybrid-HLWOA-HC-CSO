/**
 * @module runner
 * @description Runner standar dan stub untuk mengeksekusi algoritma penjadwalan
 * sesuai KONTRAK DATA WAJIB:
 * 
 * Signature:
 *   run(tasks, vms, params, seed) -> { schedule, history, evaluations, timeMs }
 * 
 * Format Keluaran:
 *   schedule    : { assignment: [vmId untuk tiap task], makespan: number }
 *   history     : [makespan terbaik tiap iterasi]
 *   evaluations : number (total evaluasi fitness yang dilakukan)
 *   timeMs      : number (durasi waktu komputasi dalam milidetik)
 */

import { heft } from './heft.js';
import { fitness } from './fitness.js';
import { createCounter } from './counter.js';

/**
 * Runner stub default yang memenuhi kontrak data persis.
 * Pada Tahap 1, stub menggunakan HEFT deterministik sebagai baseline siap pakai
 * sehingga anggota lain (P2, P3, P4) dapat langsung menyambung tanpa menunggu implementasi penuh.
 * 
 * @param {Array<{ id: number|string, size: number }>} tasks - Daftar task.
 * @param {Array<{ id: number|string, speed: number }>} vms - Daftar VM.
 * @param {Object} [params={}] - Parameter algoritma (misal maxIter, populationSize, dll).
 * @param {number} [seed=42] - Seed PRNG untuk menjamin determinisme.
 * @returns {{
 *   schedule: { assignment: Array<number|string>, makespan: number },
 *   history: number[],
 *   evaluations: number,
 *   timeMs: number
 * }}
 */
export function run(tasks, vms, params = {}, seed = 42) {
  const start = performance.now();

  const maxEvals = params.maxEvals || Infinity;
  const counter = createCounter(maxEvals);

  // Jalankan heuristik HEFT untuk solusi dasar
  const heftResult = heft(tasks, vms);

  // Evaluasi fitness dan update counter evaluasi
  const makespan = fitness(heftResult.assignment, tasks, vms, counter);

  const durationMs = performance.now() - start;

  return {
    schedule: {
      assignment: heftResult.assignment,
      makespan: makespan
    },
    // Riwayat makespan terbaik per iterasi (untuk HEFT terdapat 1 nilai awal)
    history: [makespan],
    evaluations: counter.count,
    timeMs: durationMs
  };
}
