/**
 * @module build-demo-data
 * @description Skrip mandiri (P3) untuk membangun data demo & visualisasi web HC-CSO
 * dari dataset asli (`data/`), hasil eksperimen (`results/`), dan simulator (`simulator/`).
 *
 * Catatan Kepatuhan Batas Tim:
 * - Tidak mengimpor berkas apa pun dari folder `hlwoa/`.
 * - Menghasilkan `hc-cso/js/demo-data.js` yang siap dipakai oleh `hc-cso/js/ui.js`,
 *   `ganttChart.js`, dan `convergenceChart.js`.
 *
 * Cara menjalankan dari root repositori:
 *   node hc-cso/scripts/build-demo-data.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runHCCSO } from "../../simulator/algorithms/hccso.js";
import { heft } from "../../simulator/heft.js";
import { fitness } from "../../simulator/fitness.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const HCCSO_DIR = path.resolve(__dirname, "..");

const DATA_DIR = path.join(ROOT_DIR, "data");
const RESULTS_DIR = path.join(ROOT_DIR, "results");
const OUTPUT_JS_PATH = path.join(HCCSO_DIR, "js", "demo-data.js");

// ============================================================================
// 1. HELPER PEMBACA JSON & WORKLOAD ASLI
// ============================================================================

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    console.warn(`[WARN] Gagal mem-parse JSON ${filePath}: ${err.message}`);
    return null;
  }
}

function loadVms() {
  const vmPath = path.join(DATA_DIR, "vms.json");
  const raw = readJsonIfExists(vmPath);

  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((vm, idx) => ({
      id: vm.id !== undefined ? vm.id : idx,
      name: vm.name || `VM-${idx}`,
      tier: vm.tier || "Standard",
      speed: Number(vm.speed || vm.mips || 1500),
      costPerSec: Number(vm.costPerSec || vm.cost || 40),
    }));
  }

  // Fallback standar 16 VM heterogen simulator
  const vms = [];
  let id = 0;
  for (let i = 0; i < 4; i++) {
    vms.push({
      id: id++,
      name: `VM-${id - 1} (Compute)`,
      tier: "Compute",
      speed: 2500,
      costPerSec: 150,
    });
  }
  for (let i = 0; i < 6; i++) {
    vms.push({
      id: id++,
      name: `VM-${id - 1} (Standard)`,
      tier: "Standard",
      speed: 1500,
      costPerSec: 40,
    });
  }
  for (let i = 0; i < 6; i++) {
    vms.push({
      id: id++,
      name: `VM-${id - 1} (Light)`,
      tier: "Light",
      speed: 800,
      costPerSec: 18,
    });
  }
  return vms;
}

function parseWorkloadTasks(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, "utf-8").trim();

  if (ext === ".json") {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : parsed.tasks || [];
    return arr.map((item, idx) => ({
      id: item.id !== undefined ? item.id : idx,
      size: Number(
        typeof item === "number" ? item : item.size || item.length || item.mi,
      ),
    }));
  }

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line, idx) => ({
      id: idx,
      size: Number(line.split(/[\s,;]+/)[0]),
    }));
}

function findDatasetFile(preferredNames) {
  const dirs = [DATA_DIR, path.join(DATA_DIR, "synthetic")];
  for (const name of preferredNames) {
    for (const dir of dirs) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) {
        return {
          name,
          relPath: path.relative(ROOT_DIR, candidate),
          fullPath: candidate,
        };
      }
    }
  }

  // Fallback: ambil file .txt pertama di data/
  if (fs.existsSync(DATA_DIR)) {
    const fallback = fs
      .readdirSync(DATA_DIR)
      .find(
        (f) =>
          f.endsWith(".txt") && fs.statSync(path.join(DATA_DIR, f)).isFile(),
      );
    if (fallback) {
      const fullPath = path.join(DATA_DIR, fallback);
      return {
        name: fallback,
        relPath: path.relative(ROOT_DIR, fullPath),
        fullPath,
      };
    }
  }

  return null;
}

// ============================================================================
// 2. KONSTRUKSI TIMELINE GANTT CHART & METRIK JADWAL
// ============================================================================

/**
 * Mengonversi vektor `assignment` menjadi blok timeline Gantt Chart per VM
 * (berurutan berdasarkan ukuran task terbesar lebih dulu / LPT dispatch order per VM).
 */
function buildGanttTimeline(assignment, tasks, vms) {
  const nVms = vms.length;
  const tasksByVm = Array.from({ length: nVms }, () => []);

  for (let t = 0; t < tasks.length; t++) {
    const vmIdx = assignment[t];
    tasksByVm[vmIdx].push(tasks[t]);
  }

  const blocks = [];
  const vmSummaries = [];
  let makespan = 0;
  let totalCost = 0;
  let sumLoad = 0;

  for (let v = 0; v < nVms; v++) {
    // Urutkan eksekusi pada VM dari task terbesar agar selaras dengan antrean HEFT
    const queue = [...tasksByVm[v]].sort((a, b) => b.size - a.size);
    let cursor = 0;

    for (const task of queue) {
      const duration = task.size / vms[v].speed;
      const start = Number(cursor.toFixed(4));
      const end = Number((cursor + duration).toFixed(4));

      blocks.push({
        taskId: task.id,
        label: `T${task.id}`,
        size: task.size,
        vmId: v,
        vmTier: vms[v].tier,
        start,
        end,
        duration: Number(duration.toFixed(4)),
      });

      cursor += duration;
    }

    const load = Number(cursor.toFixed(4));
    if (load > makespan) makespan = load;
    sumLoad += load;
    totalCost += load * (vms[v].costPerSec || 0);

    vmSummaries.push({
      vmId: v,
      name: vms[v].name || `VM-${v}`,
      tier: vms[v].tier,
      speed: vms[v].speed,
      taskCount: queue.length,
      finishTime: load,
    });
  }

  const minLoad = Math.min(...vmSummaries.map((v) => v.finishTime));
  const avgLoad = nVms > 0 ? sumLoad / nVms : 0;
  const imbalance = avgLoad > 0 ? (makespan - minLoad) / avgLoad : 0;
  const utilization =
    makespan > 0 && nVms > 0 ? (sumLoad / (nVms * makespan)) * 100 : 0;

  // Tandai VM bottleneck
  for (const vs of vmSummaries) {
    vs.isBottleneck = Math.abs(vs.finishTime - makespan) < 1e-6;
  }

  return {
    makespan: Number(makespan.toFixed(4)),
    cost: Number(totalCost.toFixed(2)),
    utilization: Number(utilization.toFixed(2)),
    imbalance: Number(imbalance.toFixed(4)),
    vmSummaries,
    blocks,
  };
}

// ============================================================================
// 3. PEMBANGUNAN SKENARIO DEMO INTERAKTIF (GANTT + KONVERGENSI)
// ============================================================================

function buildInteractiveScenarios(vms) {
  const scenarios = {};

  // Skenario A: Compact Slice 32 Task dari GoCJ_Dataset_100 (optimal untuk Gantt Chart detail)
  // Skenario B: GoCJ_Dataset_100 penuh (100 task)
  // Skenario C: GoCJ_Dataset_500 penuh (500 task)
  const ds100 = findDatasetFile(["GoCJ_Dataset_100.txt", "Synthetic_100.txt"]);
  const ds500 = findDatasetFile(["GoCJ_Dataset_500.txt", "Synthetic_500.txt"]);

  const candidateSpecs = [];
  if (ds100) {
    const full100 = parseWorkloadTasks(ds100.fullPath);
    candidateSpecs.push({
      key: "gocj_32_preview",
      title: `${ds100.name} (32 Task Sampel Gantt)`,
      sourceDataset: ds100.name,
      tasks: full100
        .slice(0, Math.min(32, full100.length))
        .map((t, idx) => ({ id: idx, size: t.size })),
      seed: 42,
      params: { popSize: 20, maxIter: 60, maxEvals: 1200 },
    });
    candidateSpecs.push({
      key: "gocj_100",
      title: `${ds100.name} (${full100.length} Tasks)`,
      sourceDataset: ds100.name,
      tasks: full100,
      seed: 42,
      params: { popSize: 20, maxIter: 80, maxEvals: 1500 },
    });
  }

  if (ds500) {
    const full500 = parseWorkloadTasks(ds500.fullPath);
    candidateSpecs.push({
      key: "gocj_500",
      title: `${ds500.name} (${full500.length} Tasks)`,
      sourceDataset: ds500.name,
      tasks: full500,
      seed: 42,
      params: { popSize: 20, maxIter: 80, maxEvals: 1500 },
    });
  }

  for (const spec of candidateSpecs) {
    // 1. Baseline HEFT
    const heftRes = heft(spec.tasks, vms);
    const heftMakespan = fitness(heftRes.assignment, spec.tasks, vms);
    const heftGantt = buildGanttTimeline(heftRes.assignment, spec.tasks, vms);

    // 2. CSO Murni (tanpa HEFT)
    const csoRes = runHCCSO(
      spec.tasks,
      vms,
      { ...spec.params, useHeft: false, useInertia: true },
      spec.seed,
    );

    // 3. HC-CSO tanpa Inertia Weight
    const noIwRes = runHCCSO(
      spec.tasks,
      vms,
      { ...spec.params, useHeft: true, useInertia: false },
      spec.seed,
    );

    // 4. HC-CSO Penuh (HEFT + SMIW)
    const hccsoRes = runHCCSO(
      spec.tasks,
      vms,
      { ...spec.params, useHeft: true, useInertia: true },
      spec.seed,
    );
    const hccsoGantt = buildGanttTimeline(
      hccsoRes.schedule.assignment,
      spec.tasks,
      vms,
    );

    const reductionVsHeftPct =
      heftMakespan > 0
        ? Number(
            (
              ((heftMakespan - hccsoRes.schedule.makespan) / heftMakespan) *
              100
            ).toFixed(2),
          )
        : 0;
    const reductionVsCsoPct =
      csoRes.schedule.makespan > 0
        ? Number(
            (
              ((csoRes.schedule.makespan - hccsoRes.schedule.makespan) /
                csoRes.schedule.makespan) *
              100
            ).toFixed(2),
          )
        : 0;

    scenarios[spec.key] = {
      key: spec.key,
      title: spec.title,
      sourceDataset: spec.sourceDataset,
      taskCount: spec.tasks.length,
      vmCount: vms.length,
      seed: spec.seed,
      metrics: {
        heftMakespan: Number(heftMakespan.toFixed(4)),
        csoMakespan: Number(csoRes.schedule.makespan.toFixed(4)),
        hccsoNoIwMakespan: Number(noIwRes.schedule.makespan.toFixed(4)),
        hccsoMakespan: Number(hccsoRes.schedule.makespan.toFixed(4)),
        reductionVsHeftPct,
        reductionVsCsoPct,
        evaluations: hccsoRes.evaluations,
        timeMs: Number(hccsoRes.timeMs.toFixed(2)),
      },
      convergence: {
        iterations: hccsoRes.history.map((_, idx) => idx),
        heftBaseline: hccsoRes.history.map(() =>
          Number(heftMakespan.toFixed(4)),
        ),
        cso: csoRes.history.map((v) => Number(v.toFixed(4))),
        hccsoNoIw: noIwRes.history.map((v) => Number(v.toFixed(4))),
        hccso: hccsoRes.history.map((v) => Number(v.toFixed(4))),
      },
      gantt: {
        heft: heftGantt,
        hccso: hccsoGantt,
      },
    };
  }

  return scenarios;
}

// ============================================================================
// 4. AGREGASI STATISTIK DARI results/ (ABLATION & BENCHMARK UTAMA)
// ============================================================================

function extractAblationData(ablationJson) {
  if (!ablationJson || !Array.isArray(ablationJson.datasets)) {
    return null;
  }

  return {
    generatedAt: ablationJson.metadata?.generatedAt || null,
    numRunsPerDataset: ablationJson.metadata?.numRunsPerDataset || 10,
    hyperparameters: ablationJson.metadata?.hyperparameters || {},
    globalSummary: ablationJson.globalSummary || {},
    datasets: ablationJson.datasets.map((ds) => ({
      dataset: ds.dataset,
      taskCount: ds.taskCount,
      vmCount: ds.vmCount,
      summary: {
        HEFT: ds.summary?.HEFT || null,
        CSO: ds.summary?.CSO || null,
        "HC-CSO-no-IW": ds.summary?.["HC-CSO-no-IW"] || null,
        "HC-CSO": ds.summary?.["HC-CSO"] || null,
      },
    })),
  };
}

function extractBenchmarkSummary(ringkasanJson, hasilJson) {
  return {
    ringkasanStatistik: ringkasanJson || null,
    totalRecordedRuns: Array.isArray(hasilJson)
      ? hasilJson.length
      : Array.isArray(hasilJson?.runs)
        ? hasilJson.runs.length
        : null,
  };
}

function buildImpactCardMetrics(ablationData, scenarios) {
  // Prioritas 1: Gunakan angka rata-rata riil dari hasil eksperimen ablation_hccso.json
  if (ablationData && ablationData.globalSummary?.["HC-CSO"]) {
    const g = ablationData.globalSummary;
    const heftVal = g["HEFT"]?.avgMakespanAcrossDatasets?.mean ?? 0;
    const csoVal = g["CSO"]?.avgMakespanAcrossDatasets?.mean ?? 0;
    const noIwVal = g["HC-CSO-no-IW"]?.avgMakespanAcrossDatasets?.mean ?? 0;
    const hccsoVal = g["HC-CSO"]?.avgMakespanAcrossDatasets?.mean ?? 0;

    const vsHeftPct = heftVal > 0 ? ((heftVal - hccsoVal) / heftVal) * 100 : 0;
    const vsCsoPct = csoVal > 0 ? ((csoVal - hccsoVal) / csoVal) * 100 : 0;

    return {
      source: "results/ablation_hccso.json",
      heftMakespan: Number(heftVal.toFixed(2)),
      csoMakespan: Number(csoVal.toFixed(2)),
      hccsoNoIwMakespan: Number(noIwVal.toFixed(2)),
      hccsoMakespan: Number(hccsoVal.toFixed(2)),
      reductionVsHeftPct: Number(vsHeftPct.toFixed(2)),
      reductionVsCsoPct: Number(vsCsoPct.toFixed(2)),
    };
  }

  // Prioritas 2: Gunakan skenario langsung GoCJ_100 atau skenario pertama yang tersedia
  const fallbackScenario =
    scenarios["gocj_100"] ||
    scenarios["gocj_32_preview"] ||
    Object.values(scenarios)[0];

  if (fallbackScenario) {
    const m = fallbackScenario.metrics;
    return {
      source: `live-simulation:${fallbackScenario.sourceDataset}`,
      heftMakespan: Number(m.heftMakespan.toFixed(2)),
      csoMakespan: Number(m.csoMakespan.toFixed(2)),
      hccsoNoIwMakespan: Number(m.hccsoNoIwMakespan.toFixed(2)),
      hccsoMakespan: Number(m.hccsoMakespan.toFixed(2)),
      reductionVsHeftPct: m.reductionVsHeftPct,
      reductionVsCsoPct: m.reductionVsCsoPct,
    };
  }

  return null;
}

// ============================================================================
// 5. EKSEKUSI BUILD & TULIS hc-cso/js/demo-data.js
// ============================================================================

function main() {
  console.log(
    "====================================================================",
  );
  console.log(" BUILD DEMO DATA HC-CSO (P3) -> hc-cso/js/demo-data.js");
  console.log(
    "====================================================================",
  );

  const vms = loadVms();
  const ablationRaw = readJsonIfExists(
    path.join(RESULTS_DIR, "ablation_hccso.json"),
  );
  const ringkasanRaw = readJsonIfExists(
    path.join(RESULTS_DIR, "ringkasan_statistik.json"),
  );
  const hasilRaw = readJsonIfExists(path.join(RESULTS_DIR, "hasil.json"));

  if (!ablationRaw) {
    console.warn(
      "[INFO] results/ablation_hccso.json belum ditemukan. Jalankan `node simulator/ablationHCCSO.js` terlebih dahulu untuk menyertakan data ablation lengkap.",
    );
  }

  console.log(
    "1. Membangun skenario Gantt Chart & Kurva Konvergensi dari dataset asli...",
  );
  const scenarios = buildInteractiveScenarios(vms);

  console.log("2. Mengagregasi tabel Ablation & Statistik Benchmark...");
  const ablationData = extractAblationData(ablationRaw);
  const benchmarkSummary = extractBenchmarkSummary(ringkasanRaw, hasilRaw);
  const impactCard = buildImpactCardMetrics(ablationData, scenarios);

  const demoPayload = {
    meta: {
      generatedAt: new Date().toISOString(),
      algorithm: "HC-CSO (Hybrid HEFT + Cat Swarm Optimization)",
      referencePaper:
        'Jai Bhagwan & Sanjeev Kumar (2021), "An HC-CSO Algorithm for Workflow Scheduling in Heterogeneous Cloud Computing System", IJACSA Vol. 12, No. 6',
      hasAblationResults: Boolean(ablationData),
      hasGlobalBenchmarkResults: Boolean(ringkasanRaw),
    },
    vms,
    impactCard,
    ablation: ablationData,
    benchmarkSummary,
    scenarios,
  };

  const fileBanner = `// AUTO-GENERATED FILE — JANGAN EDIT MANUAL
// Dibangkitkan oleh: node hc-cso/scripts/build-demo-data.mjs
// Timestamp: ${demoPayload.meta.generatedAt}

export const DEMO_DATA = ${JSON.stringify(demoPayload, null, 2)};

if (typeof window !== 'undefined') {
  window.DEMO_DATA = DEMO_DATA;
}

export default DEMO_DATA;
`;

  fs.mkdirSync(path.dirname(OUTPUT_JS_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_JS_PATH, fileBanner, "utf-8");

  console.log(
    `3. Selesai! Berkas tersimpan di: ${path.relative(ROOT_DIR, OUTPUT_JS_PATH)}`,
  );
  console.log(
    `   - Jumlah skenario interaktif : ${Object.keys(scenarios).length}`,
  );
  console.log(
    `   - Sumber angka impact card   : ${impactCard?.source || "N/A"}`,
  );
  console.log(
    "====================================================================",
  );
}

main();
