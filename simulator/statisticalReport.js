/**
 * @file statisticalReport.js
 * @description Generator analisis statistik inferensial dan deskriptif untuk P4.
 * Membaca results/hasil.json (yang kini memuat seluruh dataset 100 - 1000 tasks),
 * menghitung ringkasan mean +- std, dan menjalankan Uji Signifikansi Mann-Whitney U.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { summarizeMetrics, mannWhitneyU, compareAlgorithms } from './statistics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resultsDir = path.resolve(__dirname, '..', 'results');
const hasilJsonPath = path.resolve(resultsDir, 'hasil.json');

async function main() {
  console.log('========================================================================');
  console.log(' ANALISIS STATISTIK MENYELURUH (SELURUH DATASET GOCJ & SINTETIK)');
  console.log('========================================================================\n');

  if (!fs.existsSync(hasilJsonPath)) {
    console.error(`Error: File ${hasilJsonPath} tidak ditemukan. Silakan jalankan 'npm run export' terlebih dahulu.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(hasilJsonPath, 'utf-8');
  const hasil = JSON.parse(raw);

  // 1. Ringkasan Deskriptif Global per Metode (Across all datasets)
  const summaryPerMethod = {};
  for (const [methodName, runs] of Object.entries(hasil)) {
    summaryPerMethod[methodName] = summarizeMetrics(runs);
  }

  // 2. Uji Signifikansi Non-Parametrik: Pasangan Komparasi Global
  const comparisons = [];
  const pairs = [
    { a: 'HLWOA', b: 'HC-CSO' },
    { a: 'HLWOA', b: 'HEFT' },
    { a: 'HC-CSO', b: 'HEFT' },
    { a: 'HLWOA', b: 'TS' },
    { a: 'HC-CSO', b: 'TS' },
    { a: 'HLWOA', b: 'FPA' },
    { a: 'HC-CSO', b: 'FPA' }
  ];

  for (const pair of pairs) {
    if (hasil[pair.a] && hasil[pair.b]) {
      const cmpMakespan = compareAlgorithms(hasil[pair.a], hasil[pair.b], 'makespan', pair.a, pair.b);
      const cmpCost = compareAlgorithms(hasil[pair.a], hasil[pair.b], 'cost', pair.a, pair.b);
      const cmpImbalance = compareAlgorithms(hasil[pair.a], hasil[pair.b], 'imbalance', pair.a, pair.b);

      comparisons.push({
        pair: `${pair.a} vs ${pair.b}`,
        makespan: cmpMakespan,
        cost: cmpCost,
        imbalance: cmpImbalance
      });
    }
  }

  const finalReport = {
    generatedAt: new Date().toISOString(),
    description: "Laporan Statistik Komprehensif Seluruh Dataset (GoCJ & Sintetik 100-1000 tasks) untuk Demo 1 SOKA",
    totalRunsPerMethod: hasil['HLWOA'] ? hasil['HLWOA'].length : 0,
    summaryGlobal: summaryPerMethod,
    comparisons
  };

  const outputPath = path.resolve(resultsDir, 'ringkasan_statistik.json');
  fs.writeFileSync(outputPath, JSON.stringify(finalReport, null, 2), 'utf-8');

  // Cetak Tabel Ringkasan Global
  console.log(`1. TABEL RINGKASAN DESKRIPTIF GLOBAL (${finalReport.totalRunsPerMethod} RUNS PER METODE)`);
  console.log('-'.repeat(110));
  console.log(
    'Metode'.padEnd(10) +
    'Makespan (s)'.padStart(20) +
    'Cost (G$)'.padStart(20) +
    'Waiting (s)'.padStart(16) +
    'Imbalance'.padStart(14) +
    'Util (%)'.padStart(14) +
    'Time (ms)'.padStart(16)
  );
  console.log('-'.repeat(110));

  for (const [name, s] of Object.entries(summaryPerMethod)) {
    const mk = `${s.makespan.mean.toFixed(2)} +/- ${s.makespan.std.toFixed(2)}`;
    const cs = `${s.cost.mean.toFixed(1)} +/- ${s.cost.std.toFixed(1)}`;
    const wt = `${s.waiting.mean.toFixed(2)} +/- ${s.waiting.std.toFixed(2)}`;
    const imb = `${s.imbalance.mean.toFixed(4)}`;
    const ut = `${(s.utilization.mean * 100).toFixed(2)}%`;
    const tm = `${s.timeMs.mean.toFixed(2)} ms`;

    console.log(
      name.padEnd(10) +
      mk.padStart(20) +
      cs.padStart(20) +
      wt.padStart(16) +
      imb.padStart(14) +
      ut.padStart(14) +
      tm.padStart(16)
    );
  }
  console.log('-'.repeat(110) + '\n');

  // Cetak Uji Signifikansi
  console.log('2. UJI SIGNIFIKANSI MANN-WHITNEY U / WILCOXON RANK-SUM GLOBAL (ALPHA = 0.05)');
  console.log('-'.repeat(110));
  console.log(
    'Pasangan Komparasi'.padEnd(22) +
    'Metrik'.padEnd(12) +
    'U-Stat'.padStart(10) +
    'Z-Score'.padStart(10) +
    'P-Value'.padStart(14) +
    'Signifikan?'.padStart(16) +
    'Effect Size (r)'.padStart(18) +
    'Winner'.padStart(16)
  );
  console.log('-'.repeat(110));

  for (const c of comparisons) {
    const printCmpRow = (metricLabel, obj) => {
      const sigText = obj.test.significant ? 'YA (p < 0.05)' : 'TIDAK (p >= 0.05)';
      console.log(
        c.pair.padEnd(22) +
        metricLabel.padEnd(12) +
        obj.test.uStat.toFixed(1).padStart(10) +
        obj.test.zScore.toFixed(3).padStart(10) +
        obj.test.pValue.toFixed(6).padStart(14) +
        sigText.padStart(16) +
        obj.test.effectSizeR.toFixed(4).padStart(18) +
        obj.winner.padStart(16)
      );
    };

    printCmpRow('Makespan', c.makespan);
    printCmpRow('Cost', c.cost);
  }
  console.log('-'.repeat(110) + '\n');

  console.log(`Laporan statistik lengkap berhasil disimpan di:\n-> ${outputPath}\n`);
}

main().catch(err => {
  console.error('Terjadi kesalahan:', err);
  process.exit(1);
});
