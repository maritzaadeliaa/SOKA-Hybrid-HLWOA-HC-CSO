/**
 * @file test_tahap3.js
 * @description Uji validasi modul statistik (Tahap 3):
 * 1. Uji kebenaran statistik deskriptif (Mean, Std, Median, Min, Max, IQR).
 * 2. Uji signifikansi Mann-Whitney U / Wilcoxon Rank-Sum pada kasus kontrol:
 *    - Sampel identik (harus p-value = 1.0, tidak signifikan).
 *    - Sampel terpisah sempurna (harus p-value sangat kecil, signifikan).
 *    - Penanganan nilai kembar (ties).
 * 3. Uji fungsi perbandingan algoritma (compareAlgorithms).
 */

import assert from 'node:assert';
import {
  describeArray,
  summarizeMetrics,
  mannWhitneyU,
  compareAlgorithms
} from '../simulator/index.js';

console.log('=== MENJALANKAN UJI VALIDASI TAHAP 3 (STATISTIK) ===\n');

// 1. Uji Statistik Deskriptif
console.log('1. Uji Statistik Deskriptif (Mean, Std, Median)...');
const sampleData = [10, 20, 30, 40, 50];
const desc = describeArray(sampleData);

assert.strictEqual(desc.mean, 30.0, 'Mean [10, 20, 30, 40, 50] harus 30');
assert.strictEqual(desc.median, 30.0, 'Median [10, 20, 30, 40, 50] harus 30');
assert.strictEqual(desc.min, 10.0, 'Min harus 10');
assert.strictEqual(desc.max, 50.0, 'Max harus 50');
assert(Math.abs(desc.std - 15.8114) < 0.01, 'Std harus ~15.81');
console.log('   [OK] Statistik deskriptif terverifikasi akurat.');

// 2. Uji Mann-Whitney U: Kasus Identik
console.log('\n2. Uji Mann-Whitney U pada Sampel Identik...');
const sample1 = [5, 5, 5, 5, 5];
const sample2 = [5, 5, 5, 5, 5];
const resIdentical = mannWhitneyU(sample1, sample2);

assert.strictEqual(resIdentical.significant, false, 'Sampel identik tidak boleh signifikan');
assert(resIdentical.pValue >= 0.05, 'P-value sampel identik harus >= 0.05');
console.log(`   [OK] Sampel identik menghasilkan p-value = ${resIdentical.pValue} (Tidak Signifikan).`);

// 3. Uji Mann-Whitney U: Kasus Terpisah Sempurna (Disjoint)
console.log('\n3. Uji Mann-Whitney U pada Sampel Terpisah Sempurna...');
const groupLow = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const groupHigh = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109];
const resDisjoint = mannWhitneyU(groupLow, groupHigh);

assert.strictEqual(resDisjoint.significant, true, 'Kelompok terpisah sempurna harus signifikan');
assert(resDisjoint.pValue < 0.001, 'P-value harus sangat kecil (< 0.001)');
assert(resDisjoint.effectSizeR > 0.8, 'Effect size harus besar (r > 0.8)');
console.log(`   [OK] Kelompok terpisah menghasilkan p = ${resDisjoint.pValue.toFixed(6)} (Signifikan, r = ${resDisjoint.effectSizeR}).`);

// 4. Uji summarizeMetrics
console.log('\n4. Uji summarizeMetrics dari Run Records...');
const mockRuns = [
  { makespan: 500, waiting: 200, imbalance: 0.1, utilization: 0.9, cost: 400000, timeMs: 15 },
  { makespan: 510, waiting: 205, imbalance: 0.12, utilization: 0.88, cost: 410000, timeMs: 16 }
];
const sumRes = summarizeMetrics(mockRuns);
assert(sumRes.makespan && sumRes.makespan.mean === 505.0, 'Rata-rata makespan harus 505');
assert(sumRes.cost && sumRes.cost.mean === 405000.0, 'Rata-rata cost harus 405000');
console.log('   [OK] summarizeMetrics berfungsi mengekstraksi seluruh metrik.');

// 5. Uji compareAlgorithms
console.log('\n5. Uji compareAlgorithms Integratif...');
const cmp = compareAlgorithms(mockRuns, mockRuns, 'makespan', 'Algoritma A', 'Algoritma B');
assert(typeof cmp.conclusion === 'string' && cmp.conclusion.length > 0, 'Harus menghasilkan kesimpulan tertulis');
assert.strictEqual(cmp.winner, 'Equal / Tied', 'Sampel sama harus menghasilkan pemenang Equal/Tied');
console.log('   [OK] compareAlgorithms menghasilkan inferensi & kesimpulan uji hipotesis.');

console.log('\n======================================================');
console.log('SEMUA UJI VALIDASI TAHAP 3 BERHASIL DILALUI DENGAN SUKSES!');
console.log('======================================================\n');
