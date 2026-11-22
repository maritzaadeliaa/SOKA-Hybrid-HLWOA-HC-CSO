/**
 * @module cso
 * @description Implementasi Cat Swarm Optimization (CSO)
 *              untuk memperbaiki jadwal awal dari HEFT.
 */

/**
 * Jalankan CSO.
 *
 * @param {{
 *   populationSize: number,
 *   maxIter: number,
 *   tasks: Array,
 *   vms: Array,
 *   initialSchedule: number[],
 *   mr: number
 * }} params — parameter algoritma; `mr` = mixture ratio (seeking vs tracing).
 * @returns {{ schedule: number[], history: number[] }}
 *   `schedule` = alokasi terbaik;
 *   `history`  = array makespan terbaik per iterasi (untuk kurva konvergensi).
 */
export function cso(params) {
  // TODO: implementasi
  throw new Error("belum diimplementasi");
}

/**
 * Mode Seeking — kucing diam, mengevaluasi posisi sekitar.
 *
 * @param {number[]} position — posisi kucing saat ini.
 * @returns {number[]} posisi baru setelah seeking.
 */
export function seeking(position) {
  // TODO: implementasi
  throw new Error("belum diimplementasi");
}

/**
 * Mode Tracing — kucing bergerak mengejar posisi terbaik.
 *
 * @param {number[]} position — posisi kucing saat ini.
 * @param {number[]} best — posisi global terbaik.
 * @returns {number[]} posisi baru setelah tracing.
 */
export function tracing(position, best) {
  // TODO: implementasi
  throw new Error("belum diimplementasi");
}
