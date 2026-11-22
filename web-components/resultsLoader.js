/**
 * @module resultsLoader
 * @description Pemuat dan pemroses data hasil eksperimen penjadwalan.
 * Menyediakan fungsi loadResults(url) untuk membaca hasil.json final
 * dan mengekstrak data visualisasi untuk komponen web.
 */

/**
 * Memuat file hasil eksperimen JSON dari URL (browser) atau path lokal (Node.js).
 * 
 * @param {string} [url='../results/hasil.json'] - URL atau path file hasil.json
 * @returns {Promise<Record<string, Array<{ seed: number, makespan: number, waiting: number, imbalance: number, utilization: number, cost: number, timeMs: number }>>>}
 */
export async function loadResults(url = '../results/hasil.json') {
  const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

  // 1. Lingkungan Node.js (baca filesystem lokal via fs jika bukan http/https)
  if (isNode && !url.startsWith('http://') && !url.startsWith('https://')) {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const candidates = [
      url,
      path.resolve(process.cwd(), url),
      path.resolve(process.cwd(), 'results', 'hasil.json'),
      path.resolve(process.cwd(), 'Hybrid', 'SOKA-Hybrid-HLWOA-HC-CSO', 'results', 'hasil.json'),
      path.resolve(process.cwd(), '..', 'results', 'hasil.json')
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        const text = fs.readFileSync(cand, 'utf-8');
        return JSON.parse(text);
      }
    }
    throw new Error(`File hasil tidak ditemukan di kandidat path: ${candidates.join(', ')}`);
  }

  // 2. Lingkungan Browser (atau URL http/https di Node.js)
  if (typeof fetch === 'function') {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Gagal memuat hasil (${response.status} ${response.statusText}): ${url}`);
      }
      return await response.json();
    } catch (browserErr) {
      if (url.startsWith('../')) {
        const fallbackUrl = url.replace('../', './');
        const retryResp = await fetch(fallbackUrl);
        if (retryResp.ok) return await retryResp.json();
      }
      throw browserErr;
    }
  }

  throw new Error('Lingkungan eksekusi tidak mendukung fetch atau fs.');
}

/**
 * Menghitung ringkasan rata-rata dan deviasi standar untuk tiap algoritma dalam hasil.
 * @param {Record<string, Array<any>>} resultsData 
 * @returns {Record<string, Object>}
 */
export function summarizeLoadedResults(resultsData) {
  const summary = {};

  for (const [algoName, runs] of Object.entries(resultsData)) {
    if (!Array.isArray(runs) || runs.length === 0) continue;
    const n = runs.length;

    const mean = key => runs.reduce((acc, r) => acc + (r[key] || 0), 0) / n;
    const std = (key, mVal) => Math.sqrt(runs.reduce((acc, r) => acc + Math.pow((r[key] || 0) - mVal, 2), 0) / (n - 1 || 1));

    const avgMakespan = mean('makespan');
    const avgCost = mean('cost');
    const avgWaiting = mean('waiting');
    const avgImbalance = mean('imbalance');
    const avgUtil = mean('utilization');
    const avgTime = mean('timeMs');

    summary[algoName] = {
      runs: n,
      makespan: { mean: avgMakespan, std: std('makespan', avgMakespan) },
      cost: { mean: avgCost, std: std('cost', avgCost) },
      waiting: { mean: avgWaiting, std: std('waiting', avgWaiting) },
      imbalance: { mean: avgImbalance, std: std('imbalance', avgImbalance) },
      utilization: { mean: avgUtil, std: std('utilization', avgUtil) },
      timeMs: { mean: avgTime, std: std('timeMs', avgTime) }
    };
  }

  return summary;
}
