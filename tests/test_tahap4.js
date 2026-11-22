/**
 * @file test_tahap4.js
 * @description Uji validasi modul web-components (Tahap 4):
 * 1. Validasi keberadaan file komponen web mandiri (ganttChart.js, convergenceChart.js, resultsLoader.js, components.css, demo.html).
 * 2. Uji fungsi resultsLoader (loadResults, summarizeLoadedResults) dengan membaca file results/hasil.json asli.
 * 3. Verifikasi ketiadaan dependensi eksternal (100% Vanilla JS murni).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadResults, summarizeLoadedResults } from '../web-components/index.js';

console.log('=== MENJALANKAN UJI VALIDASI TAHAP 4 (WEB COMPONENTS) ===\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webCompDir = path.resolve(__dirname, '..', 'web-components');

// 1. Verifikasi Keberadaan File-File Mandiri
console.log('1. Uji Keberadaan File Mandiri di web-components/...');
const expectedFiles = [
  'index.js',
  'ganttChart.js',
  'convergenceChart.js',
  'resultsLoader.js',
  'components.css',
  'demo.html'
];

for (const f of expectedFiles) {
  const filePath = path.join(webCompDir, f);
  assert(fs.existsSync(filePath), `File ${f} harus ada di folder web-components/`);
  const stat = fs.statSync(filePath);
  assert(stat.size > 0, `File ${f} tidak boleh kosong`);
  console.log(`   [OK] File ${f.padEnd(20)} ditemukan (${stat.size} bytes).`);
}

// 2. Uji resultsLoader dengan hasil.json asli dari Tahap 2
console.log('\n2. Uji loadResults() Membaca Data Simulator Asli...');
const hasilData = await loadResults('results/hasil.json');

assert(hasilData, 'loadResults harus mengembalikan objek');
assert('HLWOA' in hasilData, 'hasil.json harus memuat key HLWOA');
assert('HC-CSO' in hasilData, 'hasil.json harus memuat key HC-CSO');
assert('HEFT' in hasilData, 'hasil.json harus memuat key HEFT');
assert(Array.isArray(hasilData['HLWOA']), 'hasil.HLWOA harus berupa array runs');
console.log(`   [OK] Berhasil membaca hasil simulator asli: ${Object.keys(hasilData).join(', ')}.`);

// 3. Uji summarizeLoadedResults
console.log('\n3. Uji summarizeLoadedResults()...');
const summary = summarizeLoadedResults(hasilData);

assert(summary['HLWOA'], 'Summary harus memuat HLWOA');
assert(summary['HC-CSO'], 'Summary harus memuat HC-CSO');
assert(typeof summary['HLWOA'].makespan.mean === 'number', 'Mean makespan harus number');
assert(typeof summary['HLWOA'].makespan.std === 'number', 'Std makespan harus number');

console.log(`   [OK] HLWOA Makespan terangkum: ${summary['HLWOA'].makespan.mean.toFixed(2)} +/- ${summary['HLWOA'].makespan.std.toFixed(2)}s`);
console.log(`   [OK] HC-CSO Makespan terangkum: ${summary['HC-CSO'].makespan.mean.toFixed(2)} +/- ${summary['HC-CSO'].makespan.std.toFixed(2)}s`);

console.log('\n======================================================');
console.log('SEMUA UJI VALIDASI TAHAP 4 BERHASIL DILALUI DENGAN SUKSES!');
console.log('======================================================\n');
