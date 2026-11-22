/**
 * @module rng
 * @description Pembangkit bilangan acak semu deterministik (PRNG) menggunakan algoritma Mulberry32.
 * Wajib dipakai oleh semua algoritma metaheuristik dan hybrid (HLWOA, HC-CSO, TS, FPA)
 * agar hasil pengujian dapat diaudit, direproduksi, dan adil (fair).
 * 
 * JANGAN memakai Math.random() di mana pun dalam kode optimasi.
 */

/**
 * Membuat generator PRNG deterministik berbasis seed integer 32-bit.
 * 
 * @param {number} seed - Angka seed awal (integer atau floating point yang akan difloored).
 * @returns {Function & { int: Function, choice: Function, shuffle: Function, fork: Function }}
 *          Fungsi rng() yang mengembalikan floating point dalam interval [0, 1).
 */
export function makeRng(seed = 42) {
  // Pastikan seed berupa uint32 non-nol
  let s = (Math.floor(Number(seed) || 0) >>> 0) || 0x12345678;

  function rng() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Menghasilkan integer acak dalam rentang inklusif [min, max].
   * @param {number} min 
   * @param {number} max 
   * @returns {number}
   */
  rng.int = function(min, max) {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return low + Math.floor(rng() * (high - low + 1));
  };

  /**
   * Memilih satu elemen acak dari sebuah array.
   * @template T
   * @param {T[]} array 
   * @returns {T}
   */
  rng.choice = function(array) {
    if (!array || array.length === 0) return undefined;
    const idx = Math.floor(rng() * array.length);
    return array[idx];
  };

  /**
   * Mengacak urutan array di tempat (in-place Fisher-Yates shuffle).
   * @template T
   * @param {T[]} array 
   * @returns {T[]}
   */
  rng.shuffle = function(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  };

  /**
   * Menghasilkan turunan child RNG dari seed saat ini (berguna untuk sub-proses deterministik).
   * @param {number} [offset=1]
   * @returns {ReturnType<typeof makeRng>}
   */
  rng.fork = function(offset = 1) {
    const nextSeed = (s + offset * 0x9e3779b9) >>> 0;
    return makeRng(nextSeed);
  };

  return rng;
}
