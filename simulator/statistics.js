/**
 * @module statistics
 * @description Modul analisis statistik inferensial dan deskriptif untuk P1 dan P4.
 * 
 * Menyediakan:
 * 1. summarizeMetrics(runs): Mean, Std, Median, Min, Max, IQR untuk tiap metrik.
 * 2. mannWhitneyU(sampleA, sampleB, options): Uji signifikansi non-parametrik Wilcoxon Rank-Sum / Mann-Whitney U.
 * 3. compareAlgorithms(runsA, runsB, metricName, options): Analisis komparasi statistik lengkap 2 algoritma.
 */

/**
 * Menghitung Aproksimasi Fungsi Error (Error Function - erf) untuk distribusi normal standar.
 * Menggunakan pendekatan numerik Chebyshev (akurat hingga presisi 1.2e-7).
 * @param {number} x
 * @returns {number}
 */
function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

/**
 * Fungsi Distribusi Kumulatif (CDF) dari Distribusi Normal Standar N(0, 1).
 * @param {number} z - Z-score
 * @returns {number} probabilitas P(Z <= z)
 */
export function normalCdf(z) {
  return 0.5 * (1.0 + erf(z / Math.SQRT2));
}

/**
 * Menghitung ringkasan statistik deskriptif untuk array nilai numerik.
 * @param {number[]} values
 * @returns {{ mean: number, std: number, median: number, min: number, max: number, iqr: number, count: number }}
 */
export function describeArray(values) {
  if (!values || values.length === 0) {
    return { mean: 0, std: 0, median: 0, min: 0, max: 0, iqr: 0, count: 0 };
  }

  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  const variance = n > 1
    ? sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1)
    : 0;
  const std = Math.sqrt(variance);

  const getPercentile = p => {
    const idx = (n - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };

  const median = getPercentile(0.5);
  const q1 = getPercentile(0.25);
  const q3 = getPercentile(0.75);

  return {
    mean: Number(mean.toFixed(4)),
    std: Number(std.toFixed(4)),
    median: Number(median.toFixed(4)),
    min: Number(sorted[0].toFixed(4)),
    max: Number(sorted[n - 1].toFixed(4)),
    iqr: Number((q3 - q1).toFixed(4)),
    count: n
  };
}

/**
 * Menghitung ringkasan mean +- std dan statistik deskriptif untuk seluruh metrik dalam suatu metode.
 * 
 * @param {Array<{ makespan: number, waiting: number, imbalance: number, utilization: number, cost: number, timeMs: number }>} runs
 * @returns {Record<string, ReturnType<typeof describeArray>>}
 */
export function summarizeMetrics(runs) {
  if (!runs || runs.length === 0) return {};

  const keys = ['makespan', 'waiting', 'imbalance', 'utilization', 'cost', 'timeMs'];
  const summary = {};

  for (const k of keys) {
    const vals = runs.map(r => r[k]).filter(v => typeof v === 'number' && !Number.isNaN(v));
    summary[k] = describeArray(vals);
  }

  return summary;
}

/**
 * Uji Signifikansi Non-Parametrik Mann-Whitney U / Wilcoxon Rank-Sum Test.
 * 
 * Menguji apakah ada perbedaan signifikan secara statistik antara dua kelompok independen
 * tanpa mengasumsikan distribusi data berdistribusi normal.
 * 
 * @param {number[]} sampleA - Nilai sampel kelompok A (misal runs HLWOA)
 * @param {number[]} sampleB - Nilai sampel kelompok B (misal runs HC-CSO)
 * @param {Object} [options={}]
 * @param {string} [options.alternative='two-sided'] - 'two-sided' | 'less' | 'greater'
 * @param {number} [options.alpha=0.05] - Tingkat signifikansi (default: 0.05)
 * @returns {{
 *   n1: number,
 *   n2: number,
 *   u1: number,
 *   u2: number,
 *   uStat: number,
 *   rSum1: number,
 *   rSum2: number,
 *   zScore: number,
 *   pValue: number,
 *   significant: boolean,
 *   effectSizeR: number,
 *   rankBiserialCorr: number
 * }}
 */
export function mannWhitneyU(sampleA, sampleB, options = {}) {
  const n1 = sampleA ? sampleA.length : 0;
  const n2 = sampleB ? sampleB.length : 0;

  if (n1 === 0 || n2 === 0) {
    throw new Error('Kedua sampel harus memiliki setidaknya satu nilai.');
  }

  const alpha = options.alpha !== undefined ? options.alpha : 0.05;
  const alternative = options.alternative || 'two-sided';

  // Gabungkan semua item dan tandai asalnya (0 = sampleA, 1 = sampleB)
  const combined = [];
  for (let i = 0; i < n1; i++) combined.push({ val: sampleA[i], group: 0 });
  for (let j = 0; j < n2; j++) combined.push({ val: sampleB[j], group: 1 });

  // Urutkan nilai dari terkecil ke terbesar
  combined.sort((a, b) => a.val - b.val);

  // Penanganan nilai kembar (Ties) dengan Average Ranks
  const totalN = n1 + n2;
  const ranks = new Float64Array(totalN);
  const tieCounts = [];

  let idx = 0;
  while (idx < totalN) {
    let endIdx = idx;
    while (endIdx + 1 < totalN && combined[endIdx + 1].val === combined[idx].val) {
      endIdx++;
    }

    const tieLen = endIdx - idx + 1;
    if (tieLen > 1) {
      tieCounts.push(tieLen);
    }

    // Rata-rata rank untuk ties: ranks dimulai dari 1
    const avgRank = (idx + 1 + endIdx + 1) / 2.0;
    for (let k = idx; k <= endIdx; k++) {
      ranks[k] = avgRank;
    }

    idx = endIdx + 1;
  }

  // Hitung jumlah rank untuk tiap kelompok
  let rSum1 = 0;
  let rSum2 = 0;
  for (let i = 0; i < totalN; i++) {
    if (combined[i].group === 0) {
      rSum1 += ranks[i];
    } else {
      rSum2 += ranks[i];
    }
  }

  // Hitung U-statistic
  const u1 = rSum1 - (n1 * (n1 + 1)) / 2.0;
  const u2 = rSum2 - (n2 * (n2 + 1)) / 2.0;
  const uStat = Math.min(u1, u2);

  // Ekspektasi mean dan variansi U dengan koreksi ties
  const meanU = (n1 * n2) / 2.0;

  let tieCorrection = 0;
  for (const t of tieCounts) {
    tieCorrection += (t * t * t - t);
  }

  const varU = (n1 * n2 / 12.0) * (
    (totalN + 1) - (totalN > 1 ? tieCorrection / (totalN * (totalN - 1)) : 0)
  );
  const stdU = Math.sqrt(Math.max(1e-12, varU));

  // Kontinuitas Z-score
  let zScore = 0;
  if (stdU > 0) {
    // Koreksi kontinuitas 0.5 menuju mean
    const diff = (u1 - meanU);
    const continuity = diff > 0 ? -0.5 : (diff < 0 ? 0.5 : 0);
    zScore = (diff + continuity) / stdU;
  }

  // Hitung p-value berdasarkan Z-score
  let pValue = 1.0;
  if (alternative === 'two-sided') {
    pValue = 2.0 * (1.0 - normalCdf(Math.abs(zScore)));
  } else if (alternative === 'less') {
    pValue = normalCdf(zScore);
  } else if (alternative === 'greater') {
    pValue = 1.0 - normalCdf(zScore);
  }

  // Batasi pValue ke [0, 1]
  pValue = Math.max(0, Math.min(1.0, pValue));

  // Effect Size: r = |Z| / sqrt(N)
  const effectSizeR = Math.abs(zScore) / Math.sqrt(totalN);

  // Rank-Biserial Correlation: r_rb = 1 - (2 * U1) / (n1 * n2)
  const rankBiserialCorr = 1.0 - (2.0 * u1) / (n1 * n2);

  return {
    n1,
    n2,
    u1: Number(u1.toFixed(4)),
    u2: Number(u2.toFixed(4)),
    uStat: Number(uStat.toFixed(4)),
    rSum1: Number(rSum1.toFixed(4)),
    rSum2: Number(rSum2.toFixed(4)),
    zScore: Number(zScore.toFixed(4)),
    pValue: Number(pValue.toFixed(6)),
    significant: pValue < alpha,
    effectSizeR: Number(effectSizeR.toFixed(4)),
    rankBiserialCorr: Number(rankBiserialCorr.toFixed(4))
  };
}

/**
 * Membandingkan performa dua algoritma secara komparatif inferensial untuk metrik tertentu.
 * 
 * @param {Array<Object>} runsA - Hasil runs metode A
 * @param {Array<Object>} runsB - Hasil runs metode B
 * @param {string} [metricName='makespan'] - Metrik yang diuji ('makespan', 'cost', 'waiting', dll)
 * @param {string} [labelA='Algoritma A']
 * @param {string} [labelB='Algoritma B']
 * @returns {Object} Hasil perbandingan lengkap dan kesimpulan uji hipotesis
 */
export function compareAlgorithms(runsA, runsB, metricName = 'makespan', labelA = 'Method A', labelB = 'Method B') {
  const valsA = runsA.map(r => r[metricName]);
  const valsB = runsB.map(r => r[metricName]);

  const statsA = describeArray(valsA);
  const statsB = describeArray(valsB);

  const test = mannWhitneyU(valsA, valsB, { alternative: 'two-sided', alpha: 0.05 });

  let winner = 'Equal / Tied';
  if (test.significant) {
    // Pada penjadwalan, nilai makespan/cost/waiting/imbalance yang lebih kecil lebih baik
    if (statsA.mean < statsB.mean) {
      winner = labelA;
    } else {
      winner = labelB;
    }
  }

  return {
    metric: metricName,
    methodA: { label: labelA, ...statsA },
    methodB: { label: labelB, ...statsB },
    test,
    winner,
    conclusion: test.significant
      ? `Terdapat perbedaan signifikan secara statistik antara ${labelA} dan ${labelB} pada metrik ${metricName} (p = ${test.pValue} < 0.05, effect size r = ${test.effectSizeR}). ${winner} terbukti lebih unggul.`
      : `Tidak terdapat perbedaan signifikan secara statistik antara ${labelA} dan ${labelB} pada metrik ${metricName} (p = ${test.pValue} >= 0.05).`
  };
}
