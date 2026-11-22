/**
 * @file index.js
 * @description Modul utama Simulator Task Scheduling Heterogen SOKA.
 * Mengekspor seluruh fungsi fondasi yang wajib digunakan oleh:
 * - P1: Evaluasi metrik, batch runner, dan uji statistik
 * - P2: Hybrid HLWOA (Heft + Whale Optimization + Levy Flight)
 * - P3: Hybrid HC-CSO (Heft + Cat Swarm Optimization)
 * - P4: Analisis data dan komparasi hasil eksperimen
 */

export { makeRng } from './rng.js';
export { createCounter } from './counter.js';
export { heft } from './heft.js';
export { fitness } from './fitness.js';
export { metrics } from './metrics.js';
export { getDefaultVms, parseDatasetText, loadDataset } from './datasetLoader.js';
export { run } from './runner.js';

// Tahap 2: Algoritma & Batch Runner
export { runHeft } from './algorithms/heftRunner.js';
export { runHLWOA, runHLWOANoLevy, runWOA } from './algorithms/hlwoa.js';
export { runHCCSO } from './algorithms/hccso.js';
export { runTS } from './algorithms/tabuSearch.js';
export { runFPA } from './algorithms/flowerPollination.js';
export { runBatch } from './batchRunner.js';

// Tahap 3: Statistik Deskriptif & Uji Signifikansi Non-Parametrik (P4)
export {
  normalCdf,
  describeArray,
  summarizeMetrics,
  mannWhitneyU,
  compareAlgorithms
} from './statistics.js';
