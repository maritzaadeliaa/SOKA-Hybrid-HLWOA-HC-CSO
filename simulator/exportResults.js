/**
 * @file exportResults.js
 * @description Skrip eksekusi eksperimen komparasi komprehensif pada SELURUH DATASET
 * (GoCJ 100 s/d 1000 task dan Synthetic 100 s/d 1000 task) untuk 10 seed berbeda.
 * 
 * Menulis hasil ke:
 * 1. results/hasil.json (Sesuai KONTRAK DATA WAJIB: { "HLWOA": [...], "HC-CSO": [...], "TS": [...], "FPA": [...], "HEFT": [...] })
 * 2. results/hasil_by_dataset.json (Pengelompokan hierarkis per dataset untuk kemudahan visualisasi P2, P3, P4)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadDataset, parseDatasetText, getDefaultVms } from './datasetLoader.js';
import { runBatch } from './batchRunner.js';
import { runHLWOA } from './algorithms/hlwoa.js';
import { runHCCSO } from './algorithms/hccso.js';
import { runHeft } from './algorithms/heftRunner.js';
import { runTS } from './algorithms/tabuSearch.js';
import { runFPA } from './algorithms/flowerPollination.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resultsDir = path.resolve(__dirname, '..', 'results');
const dataDir = path.resolve(__dirname, '..', 'data');

async function main() {
  console.log('========================================================================');
  console.log(' EKSPERIMEN SKALA PENUH: SELURUH DATASET GOCJ & SINTETIK (100 - 1000)');
  console.log('========================================================================\n');

  // Daftar dataset yang diuji (GoCJ 100 s/d 1000 & Synthetic 100 s/d 1000)
  const datasetsToRun = [
    // 1. Dataset Nyata GoCJ
    { name: 'GoCJ_100', file: 'GoCJ_Dataset_100.txt', type: 'GoCJ', tasks: 100 },
    { name: 'GoCJ_200', file: 'GoCJ_Dataset_200.txt', type: 'GoCJ', tasks: 200 },
    { name: 'GoCJ_300', file: 'GoCJ_Dataset_300.txt', type: 'GoCJ', tasks: 300 },
    { name: 'GoCJ_400', file: 'GoCJ_Dataset_400.txt', type: 'GoCJ', tasks: 400 },
    { name: 'GoCJ_500', file: 'GoCJ_Dataset_500.txt', type: 'GoCJ', tasks: 500 },
    { name: 'GoCJ_600', file: 'GoCJ_Dataset_600.txt', type: 'GoCJ', tasks: 600 },
    { name: 'GoCJ_700', file: 'GoCJ_Dataset_700.txt', type: 'GoCJ', tasks: 700 },
    { name: 'GoCJ_800', file: 'GoCJ_Dataset_800.txt', type: 'GoCJ', tasks: 800 },
    { name: 'GoCJ_900', file: 'GoCJ_Dataset_900.txt', type: 'GoCJ', tasks: 900 },
    { name: 'GoCJ_1000', file: 'GoCJ_Dataset_1000.txt', type: 'GoCJ', tasks: 1000 },

    // 2. Dataset Sintetik Terkontrol (30/40/30)
    { name: 'Synthetic_100', file: 'synthetic/Synthetic_100.txt', type: 'Synthetic', tasks: 100 },
    { name: 'Synthetic_200', file: 'synthetic/Synthetic_200.txt', type: 'Synthetic', tasks: 200 },
    { name: 'Synthetic_300', file: 'synthetic/Synthetic_300.txt', type: 'Synthetic', tasks: 300 },
    { name: 'Synthetic_400', file: 'synthetic/Synthetic_400.txt', type: 'Synthetic', tasks: 400 },
    { name: 'Synthetic_500', file: 'synthetic/Synthetic_500.txt', type: 'Synthetic', tasks: 500 },
    { name: 'Synthetic_600', file: 'synthetic/Synthetic_600.txt', type: 'Synthetic', tasks: 600 },
    { name: 'Synthetic_700', file: 'synthetic/Synthetic_700.txt', type: 'Synthetic', tasks: 700 },
    { name: 'Synthetic_800', file: 'synthetic/Synthetic_800.txt', type: 'Synthetic', tasks: 800 },
    { name: 'Synthetic_900', file: 'synthetic/Synthetic_900.txt', type: 'Synthetic', tasks: 900 },
    { name: 'Synthetic_1000', file: 'synthetic/Synthetic_1000.txt', type: 'Synthetic', tasks: 1000 }
  ];

  const seeds = [42, 101, 202, 303, 404, 505, 606, 707, 808, 909];
  const maxEvals = 1200; // Budget evaluasi setara

  const methods = {
    'HLWOA': runHLWOA,
    'HC-CSO': runHCCSO,
    'HEFT': runHeft,
    'TS': runTS,
    'FPA': runFPA
  };

  // Struktur kontrak data utama hasil.json
  const aggregatedResults = {
    'HLWOA': [],
    'HC-CSO': [],
    'TS': [],
    'FPA': [],
    'HEFT': []
  };

  const resultsByDataset = {};
  const vms = getDefaultVms();

  console.log(`Menjalankan benchmark pada ${datasetsToRun.length} dataset x 5 metode x 10 seeds = ${datasetsToRun.length * 5 * seeds.length} total runs...`);
  const globalStart = performance.now();

  for (let dIdx = 0; dIdx < datasetsToRun.length; dIdx++) {
    const ds = datasetsToRun[dIdx];
    const filePath = path.resolve(dataDir, ds.file);

    if (!fs.existsSync(filePath)) {
      console.warn(`File dataset ${filePath} tidak ditemukan, dilewati.`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const tasks = parseDatasetText(content);

    const dsStart = performance.now();
    const batchOutput = runBatch(methods, tasks, vms, { maxIter: 60, popSize: 20 }, seeds, maxEvals);
    const dsDuration = (performance.now() - dsStart).toFixed(0);

    resultsByDataset[ds.name] = {
      dataset: ds.name,
      file: ds.file,
      type: ds.type,
      taskCount: tasks.length,
      methods: batchOutput
    };

    // Gabungkan ke kontrak aggregatedResults
    for (const methodName of Object.keys(methods)) {
      const runs = batchOutput[methodName];
      for (const runItem of runs) {
        aggregatedResults[methodName].push({
          dataset: ds.name,
          taskCount: tasks.length,
          ...runItem
        });
      }
    }

    const progress = `[${dIdx + 1}/${datasetsToRun.length}]`.padEnd(9);
    console.log(`${progress} Selesai: ${ds.name.padEnd(16)} (${tasks.length} tasks) dalam ${dsDuration} ms`);
  }

  const totalTime = ((performance.now() - globalStart) / 1000).toFixed(2);
  console.log(`\nSeluruh simulasi selesai dalam ${totalTime} detik!\n`);

  // Pastikan folder results ada
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // 1. Tulis hasil.json utama sesuai KONTRAK DATA PERSIS
  const hasilJsonPath = path.resolve(resultsDir, 'hasil.json');
  fs.writeFileSync(hasilJsonPath, JSON.stringify(aggregatedResults, null, 2), 'utf-8');
  console.log(`-> Berkas kontrak utama berhasil disimpan: ${hasilJsonPath}`);

  // 2. Tulis hasil_by_dataset.json untuk kemudahan analitik P4
  const byDatasetPath = path.resolve(resultsDir, 'hasil_by_dataset.json');
  fs.writeFileSync(byDatasetPath, JSON.stringify(resultsByDataset, null, 2), 'utf-8');
  console.log(`-> Berkas rincian per-dataset berhasil disimpan: ${byDatasetPath}\n`);

  // Cetak Tabel Ringkasan Komparasi Lintas Ukuran Task (100, 200, 500, 1000)
  console.log('-----------------------------------------------------------------------------------------------------------------');
  console.log(' TABEL KOMPARASI MAKESPAN (DETIK) HLWOA VS HC-CSO PADA BERBAGAI SKALA DATASET');
  console.log('-----------------------------------------------------------------------------------------------------------------');
  console.log(
    'Dataset'.padEnd(16) +
    'Tasks'.padStart(8) +
    'HEFT'.padStart(14) +
    'HLWOA'.padStart(16) +
    'HC-CSO'.padStart(16) +
    'TS'.padStart(16) +
    'FPA'.padStart(16)
  );
  console.log('-'.repeat(102));

  for (const ds of datasetsToRun) {
    const dsRes = resultsByDataset[ds.name];
    if (!dsRes) continue;

    const getMean = mName => {
      const arr = dsRes.methods[mName];
      return arr.reduce((acc, r) => acc + r.makespan, 0) / arr.length;
    };

    const mHeft = getMean('HEFT');
    const mHlwoa = getMean('HLWOA');
    const mHccso = getMean('HC-CSO');
    const mTs = getMean('TS');
    const mFpa = getMean('FPA');

    console.log(
      ds.name.padEnd(16) +
      ds.tasks.toString().padStart(8) +
      mHeft.toFixed(2).padStart(14) +
      mHlwoa.toFixed(2).padStart(16) +
      mHccso.toFixed(2).padStart(16) +
      mTs.toFixed(2).padStart(16) +
      mFpa.toFixed(2).padStart(16)
    );
  }
  console.log('-----------------------------------------------------------------------------------------------------------------\n');
}

main().catch(err => {
  console.error('Terjadi kesalahan:', err);
  process.exit(1);
});
