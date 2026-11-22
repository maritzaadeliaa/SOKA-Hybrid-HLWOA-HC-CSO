/**
 * @module counter
 * @description Pelacak dan pembatas jumlah evaluasi fungsi fitness (Evaluation Budget Counter).
 * Menjamin bahwa semua algoritma yang dibandingkan (HLWOA, HC-CSO, TS, FPA) beroperasi
 * di bawah batasan komputasi yang setara (Fair Evaluation Budget).
 */

/**
 * Membuat objek counter evaluasi dengan batas maksimum.
 * 
 * @param {number} [maxEvals=Infinity] - Batas maksimal pemanggilan fungsi fitness.
 * @returns {{
 *   count: number,
 *   maxEvals: number,
 *   increment: (delta?: number) => number,
 *   canEvaluate: (delta?: number) => boolean,
 *   isExceeded: () => boolean,
 *   remaining: () => number,
 *   reset: () => void
 * }}
 */
export function createCounter(maxEvals = Infinity) {
  let count = 0;
  const limit = Math.max(0, Number(maxEvals) || Infinity);

  return {
    get count() {
      return count;
    },
    get maxEvals() {
      return limit;
    },
    /**
     * Menambah jumlah evaluasi sebanyak delta (default: 1).
     * @param {number} [delta=1]
     * @returns {number} nilai count saat ini setelah ditambah.
     */
    increment(delta = 1) {
      count += delta;
      return count;
    },
    /**
     * Memeriksa apakah masih diperbolehkan mengevaluasi sebanyak delta ke depan.
     * @param {number} [delta=1]
     * @returns {boolean}
     */
    canEvaluate(delta = 1) {
      return (count + delta) <= limit;
    },
    /**
     * Memeriksa apakah kuota evaluasi sudah tercapai atau terlampaui.
     * @returns {boolean}
     */
    isExceeded() {
      return count >= limit;
    },
    /**
     * Menghitung sisa kuota evaluasi yang tersedia.
     * @returns {number}
     */
    remaining() {
      return Math.max(0, limit - count);
    },
    /**
     * Mengatur ulang counter kembali ke 0.
     */
    reset() {
      count = 0;
    }
  };
}
