/**
 * @module ablationHCCSO
 * @description Skrip Eksperimen Ablation untuk Algoritma Hybrid HEFT + Cat Swarm Optimization (HC-CSO).
 *
 * Membandingkan 4 varian algoritma dengan seed dan budget evaluasi (maxEvals) yang sama persis:
 *   1. HEFT          : Heuristik deterministik murni (baseline)
 *   2. CSO           : Cat Swarm Optimization tanpa warm-start HEFT (useHeft: false, useInertia: true)
 *   3. HC-CSO-no-IW  : Hybrid HEFT + CSO tanpa Self-Motivated Inertia Weight (useHeft: true, useInertia: false)
 *   4. HC-CSO        : Hybrid HEFT + CSO + Self-Motivated Inertia Weight penuh (useHeft: true, useInertia: true)
 *
 * Penggunaan CLI:
 *   node simulator/ablationHCCSO.js
 *   node simulator/ablationHCCSO.js --runs=15 --maxEvals=1500
 *   node simulator/ablationHCCSO.js --dataset=GoCJ_Dataset_500.txt --runs=10
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

import { runHCCSO } from "./algorithms/hccso.js";
import { heft } from "./heft.js";
import { fitness } from "./fitness.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

// Daftar seed deterministik untuk reproduktibilitas eksperimen (>= 10 run)
const DEFAULT_SEEDS = [
  42, 101, 202, 303, 404, 505, 606, 707, 808, 909, 1009, 1103, 1201, 1301, 1409,
];

// Konfigurasi 4 varian ablation sesuai pembagian tugas P3
const ABLATION_VARIANTS = [
  {
    id: "HEFT",
    label: "HEFT (Heuristik Saja)",
    type: "heuristic",
    params: {},
  },
  {
    id: "CSO",
    label: "CSO (Tanpa HEFT Warm-Start)",
    type: "metaheuristic",
    params: { useHeft: false, useInertia: true },
  },
  {
    id: "HC-CSO-no-IW",
    label: "HC-CSO tanpa Inertia Weight",
    type: "metaheuristic",
    params: { useHeft: true, useInertia: false },
  },
  {
    id: "HC-CSO",
    label: "HC-CSO Penuh (HEFT + SMIW)",
    type: "metaheuristic",
    params: { useHeft: true, useInertia: true },
  },
];

/**
 * Memuat konfigurasi VM heterogen dari data/vms.json jika ada,
 * atau menggunakan profil 16 VM heterogen standar simulator.
 */
function loadHeterogeneousVms() {
  const vmJsonPath = path.join(ROOT_DIR, "data", "vms.json");
  if (fs.existsSync(vmJsonPath)) {
    const raw = JSON.parse(fs.readFileSync(vmJsonPath, "utf-8"));
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((vm, idx) => ({
        id: vm.id !== undefined ? vm.id : idx,
        tier: vm.tier || "Standard",
        speed: Number(vm.speed || vm.mips || 1500),
        costPerSec: Number(vm.costPerSec || vm.cost || 40),
      }));
    }
  }

  // Fallback standar 16 VM heterogen (4 Compute, 6 Standard, 6 Light)
  const vms = [];
  let id = 0;
  for (let i = 0; i < 4; i++)
    vms.push({ id: id++, tier: "Compute", speed: 2500, costPerSec: 150 });
  for (let i = 0; i < 6; i++)
    vms.push({ id: id++, tier: "Standard", speed: 1500, costPerSec: 40 });
  for (let i = 0; i < 6; i++)
    vms.push({ id: id++, tier: "Light", speed: 800, costPerSec: 18 });
  return vms;
}

/**
 * Membaca file workload (.txt berisi daftar panjang MI per baris atau .json) menjadi array tasks.
 */
function parseWorkloadFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const content = fs.readFileSync(filePath, "utf-8").trim();

  if (ext === ".json") {
    const parsed = JSON.parse(content);
    const list = Array.isArray(parsed) ? parsed : parsed.tasks || [];
    return list.map((item, idx) => ({
      id: item.id !== undefined ? item.id : idx,
      size: Number(
        typeof item === "number" ? item : item.size || item.length || item.mi,
      ),
    }));
  }

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  return lines.map((line, idx) => ({
    id: idx,
    size: Number(line.split(/[\s,;]+/)[0]),
  }));
}

/**
 * Menemukan dataset uji pada folder data/ (prioritas dataset representatif minggu 3 jika tidak difilter).
 */
function discoverDatasets(datasetFilter = null) {
  const candidateDirs = [
    path.join(ROOT_DIR, "data"),
    path.join(ROOT_DIR, "data", "synthetic"),
  ];

  const allFiles = [];
  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      if (!fs.statSync(fullPath).isFile()) continue;
      if (!/\.(txt|json)$/i.test(entry)) continue;
      if (entry.toLowerCase() === "vms.json") continue;
      allFiles.push({
        name: entry,
        relPath: path.relative(ROOT_DIR, fullPath),
        fullPath,
      });
    }
  }

  if (datasetFilter) {
    const matched = allFiles.filter((f) =>
      f.name.toLowerCase().includes(datasetFilter.toLowerCase()),
    );
    if (matched.length === 0) {
      throw new Error(
        `Dataset dengan filter "${datasetFilter}" tidak ditemukan di folder data/.`,
      );
    }
    return matched;
  }

  // Pilih set representatif lintas ukuran (kecil, menengah, besar) dari GoCJ & Synthetic
  const preferredNames = [
    "GoCJ_Dataset_100.txt",
    "GoCJ_Dataset_300.txt",
    "GoCJ_Dataset_500.txt",
    "GoCJ_Dataset_1000.txt",
    "Synthetic_200.txt",
    "Synthetic_500.txt",
  ];

  const selected = preferredNames
    .map((target) => allFiles.find((f) => f.name === target))
    .filter(Boolean);

  return selected.length > 0 ? selected : allFiles.slice(0, 6);
}

/**
 * Menghitung seluruh metrik penjadwalan dari vektor assignment diskrit.
 */
function evaluateScheduleMetrics(assignment, tasks, vms, timeMs, evaluations) {
  const nVms = vms.length;
  const nTasks = tasks.length;
  const vmLoads = new Float64Array(nVms);
  const vmReadyTime = new Float64Array(nVms);

  let totalWaitingTime = 0;

  // Hitung waktu tunggu dan total beban eksekusi per VM
  for (let i = 0; i < nTasks; i++) {
    const vmIdx = assignment[i];
    const execTime = tasks[i].size / vms[vmIdx].speed;
    totalWaitingTime += vmReadyTime[vmIdx];
    vmReadyTime[vmIdx] += execTime;
    vmLoads[vmIdx] += execTime;
  }

  let makespan = 0;
  let minLoad = Infinity;
  let sumLoad = 0;
  let totalCost = 0;

  for (let v = 0; v < nVms; v++) {
    const load = vmLoads[v];
    if (load > makespan) makespan = load;
    if (load < minLoad) minLoad = load;
    sumLoad += load;
    totalCost += load * (vms[v].costPerSec || 0);
  }

  const avgLoad = nVms > 0 ? sumLoad / nVms : 0;
  const imbalance = avgLoad > 0 ? (makespan - minLoad) / avgLoad : 0;
  const utilization =
    makespan > 0 && nVms > 0 ? (sumLoad / (nVms * makespan)) * 100 : 0;
  const waiting = nTasks > 0 ? totalWaitingTime / nTasks : 0;

  return {
    makespan,
    waiting,
    imbalance,
    utilization,
    cost: totalCost,
    timeMs,
    evaluations,
  };
}

/**
 * Menghitung statistik deskriptif (mean, std, min, max, median) dari array angka.
 */
function summarizeSeries(values) {
  const n = values.length;
  if (n === 0) {
    return {
      mean: 0,
      std: 0,
      min: 0,
      max: 0,
      median: 0,
      formatted: "0.00 ± 0.00",
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((acc, v) => acc + v, 0) / n;
  const variance =
    n > 1
      ? values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1)
      : 0;
  const std = Math.sqrt(variance);
  const mid = Math.floor(n / 2);
  const median =
    n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  return {
    mean: Number(mean.toFixed(4)),
    std: Number(std.toFixed(4)),
    min: Number(sorted[0].toFixed(4)),
    max: Number(sorted[n - 1].toFixed(4)),
    median: Number(median.toFixed(4)),
    formatted: `${mean.toFixed(2)} ± ${std.toFixed(2)}`,
  };
}

/**
 * Menjalankan eksperimen ablation lengkap dan menyimpan hasilnya ke results/ablation_hccso.json.
 */
export function runAblationStudy(options = {}) {
  const numRuns = Math.max(10, options.runs || 10);
  const seeds = Array.from({ length: numRuns }, (_, idx) =>
    idx < DEFAULT_SEEDS.length ? DEFAULT_SEEDS[idx] : 42 + idx * 97,
  );

  const sharedHyperparams = {
    popSize: options.popSize || 20,
    maxIter: options.maxIter || 80,
    maxEvals: options.maxEvals || 1500,
    mr: options.mr !== undefined ? options.mr : 0.3,
    smp: options.smp || 4,
    c1: options.c1 !== undefined ? options.c1 : 1.5,
    fl: options.fl !== undefined ? options.fl : 0.5,
    gammaMax: options.gammaMax !== undefined ? options.gammaMax : 2.0,
    cFactor: options.cFactor !== undefined ? options.cFactor : 2.0,
  };

  const vms = loadHeterogeneousVms();
  const datasets = discoverDatasets(options.dataset || null);
  const datasetReports = [];

  console.log(
    "====================================================================",
  );
  console.log(" EKSPERIMEN ABLATION HC-CSO (Bhagwan & Kumar, 2021)");
  console.log(
    ` Jumlah Run/Dataset : ${numRuns} run (seed deterministik identik)`,
  );
  console.log(` Budget Evaluasi    : maxEvals = ${sharedHyperparams.maxEvals}`);
  console.log(` Jumlah VM          : ${vms.length} VM heterogen`);
  console.log(
    "====================================================================\n",
  );

  for (const ds of datasets) {
    const tasks = parseWorkloadFile(ds.fullPath);
    console.log(`>>> Dataset: ${ds.name} (${tasks.length} tasks)`);

    const variantResults = {};
    const rawRunsByVariant = {};

    for (const variant of ABLATION_VARIANTS) {
      const runs = [];

      for (let r = 0; r < numRuns; r++) {
        const seed = seeds[r];

        if (variant.type === "heuristic") {
          const t0 = performance.now();
          const sol = heft(tasks, vms);
          const timeMs = performance.now() - t0;
          // Validasi fitness lewat evaluator resmi simulator
          const checkedMakespan = fitness(sol.assignment, tasks, vms);
          const metrics = evaluateScheduleMetrics(
            sol.assignment,
            tasks,
            vms,
            timeMs,
            1,
          );
          metrics.makespan = checkedMakespan;

          runs.push({ run: r + 1, seed, ...metrics });
        } else {
          const runParams = { ...sharedHyperparams, ...variant.params };
          const res = runHCCSO(tasks, vms, runParams, seed);

          if (res.evaluations > sharedHyperparams.maxEvals) {
            throw new Error(
              `Budget maxEvals terlampaui pada ${variant.id} (${res.evaluations} > ${sharedHyperparams.maxEvals})`,
            );
          }

          const metrics = evaluateScheduleMetrics(
            res.schedule.assignment,
            tasks,
            vms,
            res.timeMs,
            res.evaluations,
          );
          metrics.makespan = res.schedule.makespan;

          runs.push({
            run: r + 1,
            seed,
            ...metrics,
            convergenceHistory: res.history,
          });
        }
      }

      rawRunsByVariant[variant.id] = runs;

      variantResults[variant.id] = {
        id: variant.id,
        label: variant.label,
        params: variant.params,
        makespan: summarizeSeries(runs.map((x) => x.makespan)),
        waiting: summarizeSeries(runs.map((x) => x.waiting)),
        imbalance: summarizeSeries(runs.map((x) => x.imbalance)),
        utilization: summarizeSeries(runs.map((x) => x.utilization)),
        cost: summarizeSeries(runs.map((x) => x.cost)),
        timeMs: summarizeSeries(runs.map((x) => x.timeMs)),
        evaluations: summarizeSeries(runs.map((x) => x.evaluations)),
      };
    }

    // Hitung persentase perbaikan (reduksi makespan) tiap varian terhadap baseline HEFT
    const heftMeanMakespan = variantResults["HEFT"].makespan.mean;
    for (const variant of ABLATION_VARIANTS) {
      const vStat = variantResults[variant.id];
      const reductionPct =
        heftMeanMakespan > 0
          ? ((heftMeanMakespan - vStat.makespan.mean) / heftMeanMakespan) * 100
          : 0;
      vStat.makespanReductionVsHeftPct = Number(reductionPct.toFixed(4));
    }

    // Cetak ringkasan tabel ke konsol
    const tableRows = ABLATION_VARIANTS.map((v) => {
      const s = variantResults[v.id];
      return {
        Varian: v.id,
        "Makespan (Mean ± Std)": s.makespan.formatted,
        "vs HEFT (%)": `${s.makespanReductionVsHeftPct >= 0 ? "-" : "+"}${Math.abs(
          s.makespanReductionVsHeftPct,
        ).toFixed(2)}%`,
        Imbalance: s.imbalance.mean.toFixed(4),
        "Util (%)": s.utilization.mean.toFixed(2),
        "Time (ms)": s.timeMs.mean.toFixed(2),
        Evals: Math.round(s.evaluations.mean),
      };
    });
    console.table(tableRows);

    datasetReports.push({
      dataset: ds.name,
      path: ds.relPath,
      taskCount: tasks.length,
      vmCount: vms.length,
      numRuns,
      seeds,
      summary: variantResults,
      runs: rawRunsByVariant,
    });
  }

  // Agregasi global lintas semua dataset uji
  const globalSummary = {};
  for (const variant of ABLATION_VARIANTS) {
    const allMakespans = datasetReports.map(
      (d) => d.summary[variant.id].makespan.mean,
    );
    const allTimes = datasetReports.map(
      (d) => d.summary[variant.id].timeMs.mean,
    );
    const allReductions = datasetReports.map(
      (d) => d.summary[variant.id].makespanReductionVsHeftPct,
    );

    globalSummary[variant.id] = {
      id: variant.id,
      label: variant.label,
      avgMakespanAcrossDatasets: summarizeSeries(allMakespans),
      avgTimeMsAcrossDatasets: summarizeSeries(allTimes),
      avgReductionVsHeftPct: Number(
        (
          allReductions.reduce((a, b) => a + b, 0) /
          Math.max(1, allReductions.length)
        ).toFixed(4),
      ),
    };
  }

  const outputPayload = {
    metadata: {
      generatedAt: new Date().toISOString(),
      referencePaper:
        "Jai Bhagwan & Sanjeev Kumar (2021), An HC-CSO Algorithm for Workflow Scheduling in Heterogeneous Cloud Computing System, IJACSA Vol. 12 No. 6",
      numRunsPerDataset: numRuns,
      seeds,
      hyperparameters: sharedHyperparams,
      variants: ABLATION_VARIANTS,
    },
    globalSummary,
    datasets: datasetReports,
  };

  const resultsDir = path.join(ROOT_DIR, "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const outputPath = path.join(resultsDir, "ablation_hccso.json");
  fs.writeFileSync(outputPath, JSON.stringify(outputPayload, null, 2), "utf-8");

  console.log(
    `\nHasil ablation tersimpan di: ${path.relative(ROOT_DIR, outputPath)}`,
  );
  return outputPayload;
}

// Parse argumen CLI sederhana (--runs=10 --maxEvals=1500 --dataset=GoCJ_Dataset_500.txt)
function parseCliArgs(argv) {
  const opts = {};
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--runs=")) opts.runs = Number(arg.split("=")[1]);
    if (arg.startsWith("--maxEvals="))
      opts.maxEvals = Number(arg.split("=")[1]);
    if (arg.startsWith("--popSize=")) opts.popSize = Number(arg.split("=")[1]);
    if (arg.startsWith("--maxIter=")) opts.maxIter = Number(arg.split("=")[1]);
    if (arg.startsWith("--dataset=")) opts.dataset = arg.split("=")[1];
  }
  return opts;
}

// Eksekusi langsung jika dipanggil via CLI: node simulator/ablationHCCSO.js
const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectExecution) {
  const cliOptions = parseCliArgs(process.argv);
  runAblationStudy(cliOptions);
}
