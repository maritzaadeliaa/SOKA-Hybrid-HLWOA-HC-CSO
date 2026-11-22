/**
 * @module heft
 * @description Implementasi algoritma HEFT (Heterogeneous Earliest Finish Time).
 *              Menghasilkan jadwal awal yang akan dijadikan seed populasi metaheuristik.
 */

/**
 * Jalankan penjadwalan HEFT.
 *
 * @param {Array<{id: number, cost: number[]}>} tasks
 *   Daftar task; `cost[j]` = waktu eksekusi task di VM ke-j.
 * @param {Array<{id: number, speed: number}>} vms
 *   Daftar VM heterogen.
 * @returns {{ assignment: number[], makespan: number }}
 *   `assignment[i]` = indeks VM untuk task ke-i; `makespan` = waktu selesai terakhir.
 */
export function heft(tasks, vms) {
  // TODO: implementasi
  throw new Error("belum diimplementasi");
}
