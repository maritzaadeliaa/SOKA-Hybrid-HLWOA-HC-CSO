/**
 * @file test_tahap1.js
 * @description Unit test dan validasi kontrak data Tahap 1.
 * Menjamin kesiapan fondasi simulator sebelum diserahkan ke P2, P3, dan P4.
 */

import assert from 'node:assert';
import {
  makeRng,
  createCounter,
  heft,
  fitness,
  metrics,
  loadDataset,
  getDefaultVms,
  run
} from '../simulator/index.js';

console.log('=== MENJALANKAN UJI VALIDASI TAHAP 1 ===\n');

// 1. Tes Determinisme PRNG Mulberry32
console.log('1. Uji Determinisme PRNG (mulberry32)...');
const rngA = makeRng(12345);
const rngB = makeRng(12345);
const seqA = [rngA(), rngA(), rngA(), rngA.int(1, 100)];
const seqB = [rngB(), rngB(), rngB(), rngB.int(1, 100)];

assert.deepStrictEqual(seqA, seqB, 'Seed yang sama harus menghasilkan sekuens acak yang persis identik!');

const rngC = makeRng(99999);
const seqC = [rngC(), rngC(), rngC(), rngC.int(1, 100)];
assert.notDeepStrictEqual(seqA, seqC, 'Seed berbeda harus menghasilkan sekuens yang berbeda!');
console.log('   [OK] PRNG terbukti 100% deterministik dan dapat diaudit.');

// 2. Tes Evaluation Counter
console.log('2. Uji Evaluation Budget Counter...');
const counter = createCounter(5);
assert.strictEqual(counter.count, 0);
assert.strictEqual(counter.canEvaluate(), true);
counter.increment(3);
assert.strictEqual(counter.count, 3);
assert.strictEqual(counter.canEvaluate(2), true);
assert.strictEqual(counter.canEvaluate(3), false);
counter.increment(2);
assert.strictEqual(counter.isExceeded(), true);
assert.strictEqual(counter.count, 5);
console.log('   [OK] Counter berfungsi membatasi budget evaluasi komputasi.');

// 3. Tes Load Dataset & VM Heterogen
console.log('3. Uji Pemanggilan Dataset & Format Data...');
const { tasks, vms } = await loadDataset('GoCJ_Dataset_100.txt');
assert.strictEqual(tasks.length, 100, 'Dataset GoCJ 100 harus berisi 100 task');
assert.strictEqual(vms.length, 16, 'Jumlah VM default harus 16');

// Periksa Kontrak Data Task & VM
for (let i = 0; i < 5; i++) {
  assert(typeof tasks[i].id !== 'undefined', 'Task wajib memiliki field id');
  assert(typeof tasks[i].size === 'number' && tasks[i].size > 0, 'Task wajib memiliki field size numerik');
}
for (let j = 0; j < vms.length; j++) {
  assert(typeof vms[j].id !== 'undefined', 'VM wajib memiliki field id');
  assert(typeof vms[j].speed === 'number' && vms[j].speed > 0, 'VM wajib memiliki field speed numerik');
}
console.log(`   [OK] Dataset berhasil dimuat: ${tasks.length} tasks, ${vms.length} VMs.`);

// 4. Tes Heuristik HEFT
console.log('4. Uji Algoritma HEFT (Independent Tasks)...');
const heftResult = heft(tasks, vms);
assert(Array.isArray(heftResult.assignment), 'HEFT harus mengembalikan array assignment');
assert.strictEqual(heftResult.assignment.length, tasks.length, 'Setiap task harus memiliki penugasan VM');

// Periksa bahwa semua ID VM valid (0 s/d 15)
const validVmIds = new Set(vms.map(v => v.id));
for (const vmId of heftResult.assignment) {
  assert(validVmIds.has(vmId), `VM id ${vmId} harus berada dalam daftar VM valid`);
}
assert(heftResult.makespan > 0, 'Makespan HEFT harus bernilai positif');
console.log(`   [OK] HEFT sukses: Makespan = ${heftResult.makespan.toFixed(2)} detik.`);

// 5. Tes Fitness Function
console.log('5. Uji Fungsi Fitness & Integrasi Counter...');
const testCounter = createCounter(10);
const makespanCheck = fitness(heftResult.assignment, tasks, vms, testCounter);
assert.strictEqual(testCounter.count, 1, 'Counter evaluasi harus bertambah 1');
assert(Math.abs(makespanCheck - heftResult.makespan) < 1e-6, 'Nilai fitness harus sama persis dengan makespan HEFT');
console.log('   [OK] Fungsi fitness tervalidasi dan counter tersinkronisasi.');

// 6. Tes Metrics Performa Lengkap
console.log('6. Uji Perhitungan 5 Metrik Kinerja...');
const m = metrics(heftResult.assignment, tasks, vms);

// Kontrak field metrik: { makespan, waiting, imbalance, utilization, cost }
assert(typeof m.makespan === 'number' && m.makespan > 0, 'Field makespan harus bernilai number > 0');
assert(typeof m.waiting === 'number' && m.waiting >= 0, 'Field waiting harus bernilai number >= 0');
assert(typeof m.imbalance === 'number' && m.imbalance >= 0, 'Field imbalance harus bernilai number >= 0');
assert(typeof m.utilization === 'number' && m.utilization > 0 && m.utilization <= 1.0, 'Utilization harus di rentang (0, 1]');
assert(typeof m.cost === 'number' && m.cost > 0, 'Total cost harus bernilai number > 0');

console.log('   Metrik Terhitung:');
console.log(`   - Makespan   : ${m.makespan.toFixed(2)} s`);
console.log(`   - Waiting    : ${m.waiting.toFixed(2)} s`);
console.log(`   - Imbalance  : ${m.imbalance.toFixed(4)}`);
console.log(`   - Utilization: ${(m.utilization * 100).toFixed(2)}%`);
console.log(`   - Cost       : ${m.cost.toFixed(2)} G$`);
console.log('   [OK] Kontrak metrik lengkap 100% tervalidasi.');

// 7. Tes Runner Stub Sesuai Kontrak
console.log('7. Uji Runner run() Stub...');
const runOutput = run(tasks, vms, { maxEvals: 50 }, 42);

assert(runOutput.schedule, 'runOutput wajib memiliki properti schedule');
assert(Array.isArray(runOutput.schedule.assignment), 'schedule.assignment harus berupa array');
assert(typeof runOutput.schedule.makespan === 'number', 'schedule.makespan harus berupa number');
assert(Array.isArray(runOutput.history) && runOutput.history.length > 0, 'runOutput.history harus berupa array non-kosong');
assert(typeof runOutput.evaluations === 'number' && runOutput.evaluations > 0, 'runOutput.evaluations harus berupa number');
assert(typeof runOutput.timeMs === 'number' && runOutput.timeMs >= 0, 'runOutput.timeMs harus berupa number');

console.log(`   [OK] Runner stub siap digunakan oleh P2, P3, P4! (Durasi eksekusi: ${runOutput.timeMs.toFixed(3)} ms).`);

console.log('\n======================================================');
console.log('SEMUA UJI VALIDASI TAHAP 1 BERHASIL DILALUI DENGAN SUKSES!');
console.log('======================================================\n');
