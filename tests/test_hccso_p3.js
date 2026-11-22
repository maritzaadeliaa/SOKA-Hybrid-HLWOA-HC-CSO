/**
 * @module test_hccso_p3
 * @description Unit & Integration Test Suite untuk Algoritma HC-CSO (Peran P3).
 *
 * Menguji:
 *   1. Kontrak struktur output { schedule: { assignment, makespan }, history, evaluations, timeMs }
 *   2. Akurasi nilai makespan terhadap evaluator resmi simulator (fitness.js)
 *   3. Kepatuhan ketat terhadap batas evaluasi (evaluations <= maxEvals) pada berbagai skala budget
 *   4. Determinisme & reproduksibilitas penuh untuk seed yang identik
 *   5. Monotonisitas kurva konvergensi (history tidak pernah memburuk antar-iterasi)
 *   6. Validitas 4 mode ablation (HEFT, CSO, HC-CSO-no-IW, HC-CSO) & non-degradasi terhadap HEFT
 *   7. Kompatibilitas parameter kustom UI (inertiaWeight, mr, smp)
 *   8. Edge cases (1 VM, 1 task, serta workload GoCJ asli jika tersedia di folder data/)
 *
 * Cara menjalankan:
 *   node tests/test_hccso_p3.js
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runHCCSO } from "../simulator/algorithms/hccso.js";
import { heft } from "../simulator/heft.js";
import { fitness } from "../simulator/fitness.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

// ============================================================================
// HELPER FIXTURES
// ============================================================================

function createHeterogeneousVms() {
  const vms = [];
  let id = 0;
  // 4 Compute VMs (2500 MIPS)
  for (let i = 0; i < 4; i++)
    vms.push({ id: id++, tier: "Compute", speed: 2500, costPerSec: 150 });
  // 6 Standard VMs (1500 MIPS)
  for (let i = 0; i < 6; i++)
    vms.push({ id: id++, tier: "Standard", speed: 1500, costPerSec: 40 });
  // 6 Light VMs (800 MIPS)
  for (let i = 0; i < 6; i++)
    vms.push({ id: id++, tier: "Light", speed: 800, costPerSec: 18 });
  return vms;
}

function createSyntheticTasks(count = 60) {
  const tasks = [];
  for (let i = 0; i < count; i++) {
    // Variasi ukuran task (kecil, sedang, besar) secara deterministik
    const bucket = i % 3;
    const baseMi = bucket === 0 ? 4000 : bucket === 1 ? 18000 : 42000;
    const size = baseMi + ((i * 733) % 5000);
    tasks.push({ id: i, size });
  }
  return tasks;
}

function loadGoCJ100IfExists() {
  const gocjPath = path.join(ROOT_DIR, "data", "GoCJ_Dataset_100.txt");
  if (!fs.existsSync(gocjPath)) return null;

  const lines = fs
    .readFileSync(gocjPath, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  return lines.map((line, idx) => ({
    id: idx,
    size: Number(line.split(/[\s,;]+/)[0]),
  }));
}

function assertValidAssignment(assignment, nTasks, nVms) {
  assert.ok(
    Array.isArray(assignment),
    "schedule.assignment harus berupa Array",
  );
  assert.equal(
    assignment.length,
    nTasks,
    `Panjang assignment (${assignment.length}) harus sama dengan jumlah task (${nTasks})`,
  );

  for (let i = 0; i < nTasks; i++) {
    const vmIdx = assignment[i];
    assert.ok(
      Number.isInteger(vmIdx) && vmIdx >= 0 && vmIdx < nVms,
      `Task ${i} dialokasikan ke VM ID tidak valid: ${vmIdx} (rentang sah: 0..${nVms - 1})`,
    );
  }
}

// ============================================================================
// TEST RUNNER SEDERHANA
// ============================================================================

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// ----------------------------------------------------------------------------
// TEST 1: Kontrak Output Dasar runHCCSO
// ----------------------------------------------------------------------------
test("1. Kontrak struktur output runHCCSO sesuai spesifikasi simulator", () => {
  const vms = createHeterogeneousVms();
  const tasks = createSyntheticTasks(50);
  const res = runHCCSO(
    tasks,
    vms,
    { popSize: 12, maxIter: 20, maxEvals: 300 },
    42,
  );

  assert.ok(res && typeof res === "object", "Return value harus berupa objek");
  assert.ok(
    res.schedule && typeof res.schedule === "object",
    "Properti schedule harus ada",
  );

  assertValidAssignment(res.schedule.assignment, tasks.length, vms.length);

  assert.equal(
    typeof res.schedule.makespan,
    "number",
    "schedule.makespan harus bertipe number",
  );
  assert.ok(
    Number.isFinite(res.schedule.makespan) && res.schedule.makespan > 0,
    `schedule.makespan harus positif dan finite, didapat: ${res.schedule.makespan}`,
  );

  assert.ok(
    Array.isArray(res.history) && res.history.length >= 1,
    "history harus Array non-kosong",
  );
  assert.ok(
    Number.isInteger(res.evaluations) && res.evaluations >= 1,
    `evaluations harus integer >= 1, didapat: ${res.evaluations}`,
  );
  assert.ok(
    typeof res.timeMs === "number" &&
      Number.isFinite(res.timeMs) &&
      res.timeMs >= 0,
    `timeMs harus angka non-negatif, didapat: ${res.timeMs}`,
  );
});

// ----------------------------------------------------------------------------
// TEST 2: Konsistensi Makespan dengan Evaluator Resmi (fitness.js)
// ----------------------------------------------------------------------------
test("2. Nilai makespan yang dikembalikan identik dengan kalkulasi fitness.js", () => {
  const vms = createHeterogeneousVms();
  const tasks = createSyntheticTasks(60);
  const res = runHCCSO(
    tasks,
    vms,
    { popSize: 15, maxIter: 30, maxEvals: 500 },
    101,
  );

  const recomputedMakespan = fitness(res.schedule.assignment, tasks, vms);
  assert.ok(
    Math.abs(res.schedule.makespan - recomputedMakespan) < 1e-6,
    `Makespan output (${res.schedule.makespan}) berbeda dengan fitness.js (${recomputedMakespan})`,
  );
});

// ----------------------------------------------------------------------------
// TEST 3: Kepatuhan Ketat terhadap Budget Evaluasi (evaluations <= maxEvals)
// ----------------------------------------------------------------------------
test("3. Jumlah evaluasi tidak pernah melampaui maxEvals (budget ketat, sedang, penuh)", () => {
  const vms = createHeterogeneousVms();
  const tasks = createSyntheticTasks(80);
  const budgets = [1, 10, 50, 250, 1500];

  for (const maxEvals of budgets) {
    const res = runHCCSO(
      tasks,
      vms,
      { popSize: 20, maxIter: 80, maxEvals },
      42,
    );

    assert.ok(
      res.evaluations <= maxEvals,
      `Budget maxEvals=${maxEvals} terlampaui! evaluations tercatat=${res.evaluations}`,
    );
    assertValidAssignment(res.schedule.assignment, tasks.length, vms.length);
  }
});

// ----------------------------------------------------------------------------
// TEST 4: Determinisme & Reproduksibilitas Seed
// ----------------------------------------------------------------------------
test("4. Eksekusi dengan seed yang sama menghasilkan output 100% deterministik", () => {
  const vms = createHeterogeneousVms();
  const tasks = createSyntheticTasks(70);
  const params = { popSize: 16, maxIter: 40, maxEvals: 600 };

  const runA = runHCCSO(tasks, vms, params, 2026);
  const runB = runHCCSO(tasks, vms, params, 2026);

  assert.deepEqual(
    runA.schedule.assignment,
    runB.schedule.assignment,
    "Vektor assignment harus identik untuk seed yang sama",
  );
  assert.equal(
    runA.schedule.makespan,
    runB.schedule.makespan,
    "Makespan akhir harus identik untuk seed yang sama",
  );
  assert.deepEqual(
    runA.history,
    runB.history,
    "Riwayat konvergensi (history) harus identik untuk seed yang sama",
  );
  assert.equal(
    runA.evaluations,
    runB.evaluations,
    "Jumlah evaluasi harus identik untuk seed yang sama",
  );
});

// ----------------------------------------------------------------------------
// TEST 5: Monotonisitas Kurva Konvergensi (Elitism)
// ----------------------------------------------------------------------------
test("5. Kurva konvergensi (history) bersifat monotonik non-increasing", () => {
  const vms = createHeterogeneousVms();
  const tasks = createSyntheticTasks(60);
  const res = runHCCSO(
    tasks,
    vms,
    { popSize: 20, maxIter: 50, maxEvals: 1000 },
    77,
  );

  for (let i = 1; i < res.history.length; i++) {
    assert.ok(
      res.history[i] <= res.history[i - 1] + 1e-9,
      `Konvergensi memburuk pada iterasi ${i}: ${res.history[i]} > ${res.history[i - 1]}`,
    );
  }
  assert.equal(
    res.history[res.history.length - 1],
    res.schedule.makespan,
    "Elemen terakhir history harus sama dengan schedule.makespan",
  );
});

// ----------------------------------------------------------------------------
// TEST 6: Validasi 4 Varian Ablation (HEFT, CSO, HC-CSO-no-IW, HC-CSO)
// ----------------------------------------------------------------------------
test("6. Keempat varian ablation berjalan valid dan HC-CSO <= HEFT", () => {
  const vms = createHeterogeneousVms();
  const tasks = createSyntheticTasks(90);
  const baseParams = { popSize: 20, maxIter: 60, maxEvals: 1200 };
  const seed = 303;

  const heftSol = heft(tasks, vms);
  const heftMakespan = fitness(heftSol.assignment, tasks, vms);

  const csoRes = runHCCSO(
    tasks,
    vms,
    { ...baseParams, useHeft: false, useInertia: true },
    seed,
  );
  const noIwRes = runHCCSO(
    tasks,
    vms,
    { ...baseParams, useHeft: true, useInertia: false },
    seed,
  );
  const fullRes = runHCCSO(
    tasks,
    vms,
    { ...baseParams, useHeft: true, useInertia: true },
    seed,
  );

  for (const [label, out] of [
    ["CSO", csoRes],
    ["HC-CSO-no-IW", noIwRes],
    ["HC-CSO", fullRes],
  ]) {
    assertValidAssignment(out.schedule.assignment, tasks.length, vms.length);
    assert.ok(
      out.evaluations <= baseParams.maxEvals,
      `${label} melampaui maxEvals`,
    );
    assert.ok(
      Number.isFinite(out.schedule.makespan) && out.schedule.makespan > 0,
    );
  }

  // Karena HC-CSO dan HC-CSO-no-IW diawali warm-start HEFT + elitism, makespan tidak boleh memburuk dari HEFT
  assert.ok(
    noIwRes.schedule.makespan <= heftMakespan + 1e-6,
    `HC-CSO-no-IW (${noIwRes.schedule.makespan}) tidak boleh lebih buruk dari HEFT (${heftMakespan})`,
  );
  assert.ok(
    fullRes.schedule.makespan <= heftMakespan + 1e-6,
    `HC-CSO (${fullRes.schedule.makespan}) tidak boleh lebih buruk dari HEFT (${heftMakespan})`,
  );
});

// ----------------------------------------------------------------------------
// TEST 7: Kompatibilitas Parameter Override dari Slider UI
// ----------------------------------------------------------------------------
test("7. Override parameter interaktif UI (inertiaWeight, mr, smp) bekerja normal", () => {
  const vms = createHeterogeneousVms();
  const tasks = createSyntheticTasks(40);
  const res = runHCCSO(
    tasks,
    vms,
    {
      popSize: 10,
      maxIter: 25,
      maxEvals: 300,
      inertiaWeight: 0.65,
      mr: 0.4,
      smp: 3,
    },
    555,
  );

  assertValidAssignment(res.schedule.assignment, tasks.length, vms.length);
  assert.ok(res.evaluations <= 300);
});

// ----------------------------------------------------------------------------
// TEST 8: Edge Cases (1 VM, 1 Task, & Dataset GoCJ Asli)
// ----------------------------------------------------------------------------
test("8. Edge cases (1 VM, 1 Task, dan dataset GoCJ_Dataset_100.txt jika ada)", () => {
  // Edge case A: 1 VM saja
  const singleVm = [{ id: 0, tier: "Standard", speed: 1500, costPerSec: 40 }];
  const tasks = createSyntheticTasks(15);
  const resSingleVm = runHCCSO(
    tasks,
    singleVm,
    { popSize: 8, maxIter: 10, maxEvals: 100 },
    11,
  );
  assertValidAssignment(resSingleVm.schedule.assignment, tasks.length, 1);
  assert.ok(resSingleVm.schedule.assignment.every((v) => v === 0));

  // Edge case B: 1 Task saja
  const vms = createHeterogeneousVms();
  const singleTask = [{ id: 0, size: 10000 }];
  const resSingleTask = runHCCSO(
    singleTask,
    vms,
    { popSize: 8, maxIter: 10, maxEvals: 100 },
    12,
  );
  assertValidAssignment(resSingleTask.schedule.assignment, 1, vms.length);
  // 10000 MI pada VM tercepat 2500 MIPS = 4.0 detik
  assert.ok(Math.abs(resSingleTask.schedule.makespan - 4.0) < 1e-6);

  // Edge case C: Dataset asli GoCJ_Dataset_100.txt jika tersedia
  const gocjTasks = loadGoCJ100IfExists();
  if (gocjTasks) {
    const resGoCJ = runHCCSO(
      gocjTasks,
      vms,
      { popSize: 20, maxIter: 50, maxEvals: 1000 },
      42,
    );
    assertValidAssignment(
      resGoCJ.schedule.assignment,
      gocjTasks.length,
      vms.length,
    );
    assert.ok(resGoCJ.evaluations <= 1000);
  }
});

// ============================================================================
// EKSEKUSI SELURUH TEST
// ============================================================================

console.log(
  "====================================================================",
);
console.log(" MENJALANKAN UNIT TEST P3: simulator/algorithms/hccso.js");
console.log(
  "====================================================================",
);

let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    t.fn();
    passed++;
    console.log(`[PASS] ${t.name}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] ${t.name}`);
    console.error(`       -> ${err.message}`);
  }
}

console.log(
  "--------------------------------------------------------------------",
);
console.log(`Total: ${tests.length} | Lulus: ${passed} | Gagal: ${failed}`);
console.log(
  "====================================================================",
);

if (failed > 0) {
  process.exitCode = 1;
}
