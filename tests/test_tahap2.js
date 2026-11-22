/**
 * @file test_tahap2.js
 * @description Uji validasi otomatis Tahap 2:
 * 1. Validitas assignment (semua task punya VM valid).
 * 2. Determinisme seed (seed sama -> makespan & history sama persis).
 * 3. Batas evaluasi (evaluations <= maxEvals).
 * 4. Kesesuaian kontrak keluaran runBatch & struktur hasil.json.
 */

import assert from 'node:assert';
import {
  loadDataset,
  runHeft,
  runHLWOA,
  runHCCSO,
  runTS,
  runFPA,
  runBatch
} from '../simulator/index.js';

console.log('=== MENJALANKAN UJI VALIDASI TAHAP 2 ===\n');

// Muat dataset pengujian
const { tasks, vms } = await loadDataset('GoCJ_Dataset_100.txt');
const validVmIds = new Set(vms.map(v => v.id));

// 1. Uji Assignment Valid untuk Semua Algoritma
console.log('1. Uji Validitas Assignment Task ke VM...');
const algos = {
  'HLWOA': runHLWOA,
  'HC-CSO': runHCCSO,
  'HEFT': runHeft,
  'TS': runTS,
  'FPA': runFPA
};

for (const [name, fn] of Object.entries(algos)) {
  const res = fn(tasks, vms, { maxEvals: 100, maxIter: 20 }, 42);

  assert.strictEqual(
    res.schedule.assignment.length,
    tasks.length,
    `${name}: Jumlah task yang dialokasikan harus sama persis dengan tasks.length`
  );

  for (const vmId of res.schedule.assignment) {
    assert(validVmIds.has(vmId), `${name}: VM id ${vmId} harus valid.`);
  }

  assert(res.schedule.makespan > 0, `${name}: Makespan harus > 0`);
  assert(Array.isArray(res.history) && res.history.length > 0, `${name}: History harus berupa array`);
  assert(res.evaluations <= 100, `${name}: Evaluasi (${res.evaluations}) tidak boleh melebihi budget maxEvals (100)`);
  console.log(`   [OK] ${name}: Assignment valid, Makespan = ${res.schedule.makespan.toFixed(2)}s, Evals = ${res.evaluations}`);
}

// 2. Uji Determinisme Seed (Auditabilitas Kode)
console.log('\n2. Uji Determinisme Seed (Auditabilitas Reproducibility)...');
const seedTest = 777;
const runA = runHLWOA(tasks, vms, { maxEvals: 80, maxIter: 15 }, seedTest);
const runB = runHLWOA(tasks, vms, { maxEvals: 80, maxIter: 15 }, seedTest);

assert.strictEqual(
  runA.schedule.makespan,
  runB.schedule.makespan,
  'Seed yang sama pada HLWOA wajib menghasilkan makespan yang sama persis!'
);
assert.deepStrictEqual(
  runA.schedule.assignment,
  runB.schedule.assignment,
  'Seed yang sama pada HLWOA wajib menghasilkan penugasan assignment yang identik!'
);
assert.deepStrictEqual(
  runA.history,
  runB.history,
  'Seed yang sama wajib menghasilkan history konvergensi identik!'
);
console.log('   [OK] Determinisme HLWOA terbukti 100% konsisten.');

const runC1 = runHCCSO(tasks, vms, { maxEvals: 80, maxIter: 15 }, seedTest);
const runC2 = runHCCSO(tasks, vms, { maxEvals: 80, maxIter: 15 }, seedTest);
assert.strictEqual(runC1.schedule.makespan, runC2.schedule.makespan, 'HC-CSO deterministik pada seed sama');
console.log('   [OK] Determinisme HC-CSO terbukti 100% konsisten.');

// 3. Uji runBatch Multi-seed (>= 10 seeds)
console.log('\n3. Uji runBatch (10 Seeds Berbeda)...');
const testSeeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const batchResult = runBatch(
  { 'HLWOA': runHLWOA, 'HC-CSO': runHCCSO },
  tasks,
  vms,
  { maxIter: 20, maxEvals: 60 },
  testSeeds,
  60
);

assert(batchResult['HLWOA'], 'batchResult wajib memuat key HLWOA');
assert(batchResult['HC-CSO'], 'batchResult wajib memuat key HC-CSO');
assert.strictEqual(batchResult['HLWOA'].length, 10, 'HLWOA harus berisi 10 run');
assert.strictEqual(batchResult['HC-CSO'].length, 10, 'HC-CSO harus berisi 10 run');

const sampleRun = batchResult['HLWOA'][0];
const expectedKeys = ['seed', 'makespan', 'waiting', 'imbalance', 'utilization', 'cost', 'timeMs'];
for (const k of expectedKeys) {
  assert(k in sampleRun, `Run result wajib memuat key ${k}`);
  assert(typeof sampleRun[k] === 'number', `Nilai ${k} harus berupa number`);
}
console.log('   [OK] Struktur data runBatch memenuhi kontrak data hasil.json persis.');

console.log('\n======================================================');
console.log('SEMUA UJI VALIDASI TAHAP 2 BERHASIL DILALUI DENGAN SUKSES!');
console.log('======================================================\n');
