/**
 * @module ui
 * @description Modul antarmuka untuk halaman HC-CSO.
 *              Menghubungkan kontrol pengguna dengan fungsi algoritma
 *              dan merender visualisasi (Gantt chart, kurva konvergensi).
 */

import { heft } from "./heft.js";
import { cso, seeking, tracing } from "./cso.js";

/**
 * Render Gantt chart hasil penjadwalan ke elemen #gantt.
 *
 * @param {number[]} schedule — alokasi task ke VM.
 * @param {Array} tasks
 * @param {Array} vms
 */
export function renderGantt(schedule, tasks, vms) {
  // TODO: implementasi
  throw new Error("belum diimplementasi");
}

/**
 * Render kurva konvergensi (makespan vs iterasi) ke elemen #convergence.
 *
 * @param {number[]} history — makespan terbaik per iterasi.
 */
export function renderConvergence(history) {
  // TODO: implementasi
  throw new Error("belum diimplementasi");
}

/**
 * Inisialisasi kontrol parameter (slider, tombol) di elemen #controls.
 * Menghubungkan event listener ke fungsi algoritma.
 */
export function initControls() {
  // TODO: implementasi
  throw new Error("belum diimplementasi");
}
