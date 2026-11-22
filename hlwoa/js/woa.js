/**
 * @module woa
 * @description Implementasi Whale Optimization Algorithm (WOA) dengan Lévy Flight
 *              untuk memperbaiki jadwal awal dari HEFT.
 */

/**
 * Jalankan WOA.
 *
 * @param {{
 *   populationSize: number,
 *   maxIter: number,
 *   tasks: Array,
 *   vms: Array,
 *   initialSchedule: number[]
 * }} params — parameter algoritma.
 * @returns {{ schedule: number[], history: number[] }}
 *   `schedule` = alokasi terbaik;
 *   `history`  = array makespan terbaik per iterasi (untuk kurva konvergensi).
 */
export function woa(params) {
  // TODO: implementasi
  throw new Error("belum diimplementasi");
}

/**
 * Hitung langkah Lévy Flight.
 *
 * @param {number} beta — parameter distribusi Lévy (biasanya 1.5).
 * @returns {number} nilai langkah acak.
 */
export function levyFlight(beta) {
  // TODO: implementasi
  throw new Error("belum diimplementasi");
}
