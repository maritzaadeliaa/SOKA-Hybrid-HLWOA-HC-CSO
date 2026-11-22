/**
 * @module ui
 * @description Pengendali Antarmuka Web Interaktif untuk Modul Pembelajaran & Eksperimen HC-CSO (Peran P3).
 *
 * Fitur Utama:
 *   1. Hidrasi angka riil pada kartu "Bukti Dampak Makespan" & pembaruan status prototipe.
 *   2. Pemilih skenario dataset asli (GoCJ 32 Preview, GoCJ 100, GoCJ 500).
 *   3. Visualisasi Gantt Chart interaktif (HC-CSO vs HEFT + deteksi VM bottleneck + tooltip).
 *   4. Visualisasi Kurva Konvergensi 4 varian (HEFT, CSO, HC-CSO-no-IW, HC-CSO).
 *   5. Sandbox eksperimen parameter (Mixing Ratio, SMP, Inertia Weight SMIW) langsung di browser.
 *   6. Ilustrasi animasi perilaku kucing (Seeking Mode & Tracing Mode).
 *   7. Tabel ringkasan eksperimen Ablation dari `results/ablation_hccso.json`.
 *   8. Kuis konseptual interaktif 3 pertanyaan beserta pembahasan.
 *
 * Catatan Batas Modul:
 * - Tidak mengimpor berkas apa pun dari folder `hlwoa/`.
 */

import { DEMO_DATA as IMPORTED_DEMO_DATA } from "./demo-data.js";
import { QUIZ_DATA as IMPORTED_QUIZ_DATA } from "./quiz-data.js";

const DEMO_DATA =
  IMPORTED_DEMO_DATA ||
  (typeof window !== "undefined" ? window.DEMO_DATA : null);
const QUIZ_DATA =
  IMPORTED_QUIZ_DATA ||
  (typeof window !== "undefined" ? window.QUIZ_DATA : null);

// Modul simulator opsional untuk simulasi live pada slider parameter
let liveSimModules = {
  loaded: false,
  runHCCSO: null,
  heft: null,
  fitness: null,
};

async function loadSimulatorModules() {
  if (liveSimModules.loaded) return liveSimModules;
  try {
    const [hccsoMod, heftMod, fitMod] = await Promise.all([
      import("../../simulator/algorithms/hccso.js"),
      import("../../simulator/heft.js"),
      import("../../simulator/fitness.js"),
    ]);
    liveSimModules = {
      loaded: true,
      runHCCSO: hccsoMod.runHCCSO,
      heft: heftMod.heft,
      fitness: fitMod.fitness,
    };
  } catch (err) {
    console.info(
      "[HC-CSO UI] Mode data precomputed aktif (simulator live tidak dimuat):",
      err.message,
    );
  }
  return liveSimModules;
}

// ============================================================================
// 1. STATE APLIKASI & HELPER DOM
// ============================================================================

const appState = {
  selectedScenarioKey: null,
  ganttAlgorithm: "hccso", // 'hccso' | 'heft'
  liveOverride: null, // Menyimpan hasil run ulang dari slider interaktif
  quizAnswers: {}, // { [questionId]: optionIndex }
  quizSubmitted: false,
  swarmAnimFrameId: null,
};

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function setText(selector, value) {
  qsa(selector).forEach((el) => {
    el.textContent = value;
  });
}

function fmt(num, digits = 2) {
  if (num === null || num === undefined || Number.isNaN(Number(num)))
    return "-";
  return Number(num).toFixed(digits);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============================================================================
// 2. HIDRASI KARTU DAMPAK MAKESPAN & BANNER DATA ASLI
// ============================================================================

function hydrateImpactCardAndBanner() {
  if (!DEMO_DATA) return;

  const impact = DEMO_DATA.impactCard;
  if (impact) {
    // Mendukung ID eksplisit maupun atribut data-impact pada hc-cso/index.html
    setText(
      '#impact-heft, [data-impact="heft"]',
      `${fmt(impact.heftMakespan, 2)} s`,
    );
    setText(
      '#impact-cso, [data-impact="cso"]',
      `${fmt(impact.csoMakespan, 2)} s`,
    );
    setText(
      '#impact-hccso-no-iw, [data-impact="hccso-no-iw"]',
      `${fmt(impact.hccsoNoIwMakespan, 2)} s`,
    );
    setText(
      '#impact-hccso, [data-impact="hccso"]',
      `${fmt(impact.hccsoMakespan, 2)} s`,
    );

    const redHeft = Number(impact.reductionVsHeftPct || 0);
    const signHeft = redHeft >= 0 ? "-" : "+";
    setText(
      '#impact-reduction-heft, [data-impact="reduction-heft"]',
      `${signHeft}${fmt(Math.abs(redHeft), 2)}% vs HEFT`,
    );

    const redCso = Number(impact.reductionVsCsoPct || 0);
    const signCso = redCso >= 0 ? "-" : "+";
    setText(
      '#impact-reduction-cso, [data-impact="reduction-cso"]',
      `${signCso}${fmt(Math.abs(redCso), 2)}% vs CSO`,
    );

    setText(
      '#impact-source, [data-impact="source"]',
      `Sumber data terverifikasi: ${impact.source}`,
    );
  }

  // Ganti banner prototipe tiruan dengan informasi data asli & catatan ilustrasi visual
  const bannerSelectors = [
    "#prototype-banner",
    ".prototype-warning",
    '[data-role="prototype-footer"]',
  ];
  for (const sel of bannerSelectors) {
    const bannerEl = qs(sel);
    if (bannerEl) {
      bannerEl.classList.remove("is-prototype-dummy");
      bannerEl.classList.add("is-verified-data");
      bannerEl.innerHTML = `
        <strong>DATA EKSPERIMEN TERVERIFIKASI:</strong> Menampilkan hasil aktual simulator HC-CSO pada dataset GoCJ &amp; hasil <em>ablation study</em>.
        <span class="illustration-note">Catatan: Animasi pergerakan kucing pada halaman ini merupakan ilustrasi visual mekanisme <em>Seeking Mode</em> dan <em>Tracing Mode</em>.</span>
      `;
    }
  }

  // Pastikan catatan ilustrasi animasi kucing juga muncul pada wadah animasi jika tersedia
  const animNoteEl = qs(
    '#cat-illustration-note, [data-role="cat-illustration-note"]',
  );
  if (animNoteEl) {
    animNoteEl.textContent =
      "Catatan: Animasi swarm kucing di atas adalah ilustrasi visual konseptual dari Seeking Mode (eksplorasi lokal) dan Tracing Mode (pergerakan kecepatan SMIW).";
  }
}

// ============================================================================
// 3. PEMILIH SKENARIO & RINGKASAN METRIK AKTIF
// ============================================================================

function getActiveScenario() {
  if (appState.liveOverride) return appState.liveOverride;
  if (!DEMO_DATA || !DEMO_DATA.scenarios) return null;
  const keys = Object.keys(DEMO_DATA.scenarios);
  if (keys.length === 0) return null;

  const activeKey =
    appState.selectedScenarioKey &&
    DEMO_DATA.scenarios[appState.selectedScenarioKey]
      ? appState.selectedScenarioKey
      : keys[0];

  appState.selectedScenarioKey = activeKey;
  return DEMO_DATA.scenarios[activeKey];
}

function initScenarioControls() {
  const selectEl = qs("#scenario-select");
  if (!selectEl || !DEMO_DATA?.scenarios) return;

  const scenarios = Object.values(DEMO_DATA.scenarios);
  selectEl.innerHTML = scenarios
    .map(
      (sc) =>
        `<option value="${escapeHtml(sc.key)}">${escapeHtml(sc.title)} (${sc.taskCount} tasks, ${sc.vmCount} VMs)</option>`,
    )
    .join("");

  if (scenarios.length > 0) {
    appState.selectedScenarioKey = scenarios[0].key;
    selectEl.value = appState.selectedScenarioKey;
  }

  selectEl.addEventListener("change", (e) => {
    appState.selectedScenarioKey = e.target.value;
    appState.liveOverride = null; // Reset override saat ganti dataset
    renderAllVisualizations();
  });
}

function renderScenarioMetrics() {
  const scenario = getActiveScenario();
  if (!scenario) return;

  const m = scenario.metrics;
  setText("#metric-heft-makespan", `${fmt(m.heftMakespan, 2)} s`);
  setText("#metric-cso-makespan", `${fmt(m.csoMakespan, 2)} s`);
  setText("#metric-noiw-makespan", `${fmt(m.hccsoNoIwMakespan, 2)} s`);
  setText("#metric-hccso-makespan", `${fmt(m.hccsoMakespan, 2)} s`);

  const redHeft = Number(m.reductionVsHeftPct || 0);
  setText(
    "#metric-reduction-heft",
    `${redHeft >= 0 ? "-" : "+"}${fmt(Math.abs(redHeft), 2)}% vs HEFT`,
  );
  setText("#metric-evals", `${m.evaluations ?? "-"} evals`);
  setText("#metric-time-ms", `${fmt(m.timeMs, 2)} ms`);

  // Detail metrik jadwal aktif (Gantt terpilih: HC-CSO atau HEFT)
  const ganttData = scenario.gantt?.[appState.ganttAlgorithm];
  if (ganttData) {
    setText("#gantt-stat-makespan", `${fmt(ganttData.makespan, 2)} s`);
    setText("#gantt-stat-utilization", `${fmt(ganttData.utilization, 2)}%`);
    setText("#gantt-stat-imbalance", fmt(ganttData.imbalance, 4));
    setText("#gantt-stat-cost", `G$ ${fmt(ganttData.cost, 2)}`);
  }
}

// ============================================================================
// 4. VISUALISASI GANTT CHART (KOMPATIBEL KOMPONEN P1 + CANVAS MANDIRI)
// ============================================================================

const TIER_COLORS = {
  Compute: ["#2563eb", "#3b82f6", "#1d4ed8"],
  Standard: ["#0d9488", "#14b8a6", "#0f766e"],
  Light: ["#d97706", "#f59e0b", "#b45309"],
};

function initGanttToggleControls() {
  const toggleButtons = qsa("[data-gantt-algo]");
  toggleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const algo = btn.getAttribute("data-gantt-algo");
      if (algo !== "hccso" && algo !== "heft") return;

      appState.ganttAlgorithm = algo;
      toggleButtons.forEach((b) =>
        b.classList.toggle(
          "active",
          b.getAttribute("data-gantt-algo") === algo,
        ),
      );
      renderScenarioMetrics();
      renderGanttSection();
    });
  });
}

function renderGanttSection() {
  const scenario = getActiveScenario();
  if (!scenario || !scenario.gantt) return;

  const ganttData = scenario.gantt[appState.ganttAlgorithm];
  if (!ganttData) return;

  // Delegasi jika komponen eksternal P1 (window.GanttChart) terpasang
  const externalContainer = qs("#gantt-chart-container");
  if (
    typeof window !== "undefined" &&
    window.GanttChart?.render &&
    externalContainer
  ) {
    window.GanttChart.render(externalContainer, {
      algorithm: appState.ganttAlgorithm.toUpperCase(),
      vms: ganttData.vmSummaries,
      blocks: ganttData.blocks,
      makespan: ganttData.makespan,
    });
  }

  // Render Canvas HTML5 interaktif pada #gantt-canvas
  const canvas = qs("#gantt-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const logicalWidth = canvas.clientWidth || 860;
  const rowHeight = 26;
  const padTop = 36;
  const padBottom = 34;
  const padLeft = 148;
  const padRight = 28;
  const vmCount = ganttData.vmSummaries.length;
  const logicalHeight = padTop + vmCount * rowHeight + padBottom;

  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;
  canvas.style.height = `${logicalHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, logicalWidth, logicalHeight);

  const plotWidth = Math.max(120, logicalWidth - padLeft - padRight);
  const maxTime = Math.max(ganttData.makespan, 0.001) * 1.05;

  // Header & Legenda Tier
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textAlign = "left";
  const titleAlgo =
    appState.ganttAlgorithm === "hccso"
      ? "HC-CSO (Hybrid HEFT + SMIW)"
      : "HEFT (Baseline)";
  ctx.fillText(`Gantt Chart Alokasi Task — ${titleAlgo}`, padLeft, 20);

  // Grid vertikal sumbu waktu
  const ticks = 6;
  for (let i = 0; i <= ticks; i++) {
    const tVal = (maxTime / ticks) * i;
    const x = padLeft + (tVal / maxTime) * plotWidth;

    ctx.beginPath();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.moveTo(x, padTop - 6);
    ctx.lineTo(x, padTop + vmCount * rowHeight);
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${tVal.toFixed(1)}s`, x, padTop + vmCount * rowHeight + 16);
  }

  // Gambar baris tiap VM
  ganttData.vmSummaries.forEach((vm, idx) => {
    const y = padTop + idx * rowHeight;

    // Latar baris bergantian & sorotan VM bottleneck
    if (vm.isBottleneck) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.10)";
    } else {
      ctx.fillStyle = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
    }
    ctx.fillRect(padLeft, y + 1, plotWidth, rowHeight - 2);

    // Label VM di sisi kiri
    ctx.fillStyle = vm.isBottleneck ? "#b91c1c" : "#1e293b";
    ctx.font = vm.isBottleneck
      ? "bold 11px system-ui, sans-serif"
      : "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    const badge = vm.isBottleneck ? " [MAX]" : "";
    ctx.fillText(`VM-${vm.vmId} (${vm.tier[0]})${badge}`, padLeft - 10, y + 17);
  });

  // Simpan bounding box tiap blok untuk interaksi hover tooltip
  const renderedRects = [];

  ganttData.blocks.forEach((blk, idx) => {
    const x = padLeft + (blk.start / maxTime) * plotWidth;
    const w = Math.max(
      1.5,
      ((blk.end - blk.start) / maxTime) * plotWidth - 0.8,
    );
    const y = padTop + blk.vmId * rowHeight + 4;
    const h = rowHeight - 8;

    const palette = TIER_COLORS[blk.vmTier] || TIER_COLORS.Standard;
    ctx.fillStyle = palette[idx % palette.length];
    ctx.fillRect(x, y, w, h);

    if (w >= 26) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(blk.label, x + w / 2, y + h / 2 + 3);
    }

    renderedRects.push({ x, y, w, h, block: blk });
  });

  // Garis vertikal Makespan (C_max)
  const xMakespan = padLeft + (ganttData.makespan / maxTime) * plotWidth;
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 1.8;
  ctx.moveTo(xMakespan, padTop - 8);
  ctx.lineTo(xMakespan, padTop + vmCount * rowHeight + 4);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#dc2626";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    `C_max = ${ganttData.makespan.toFixed(2)}s`,
    Math.min(xMakespan + 4, logicalWidth - 95),
    padTop - 10,
  );

  // Pasang interaksi hover tooltip pada canvas
  const tooltipEl = qs("#gantt-tooltip");
  if (tooltipEl) {
    canvas.onmousemove = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;

      const hit = renderedRects.find(
        (r) => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h,
      );

      if (hit) {
        const b = hit.block;
        tooltipEl.style.display = "block";
        tooltipEl.style.left = `${ev.pageX + 12}px`;
        tooltipEl.style.top = `${ev.pageY - 12}px`;
        tooltipEl.innerHTML = `
          <strong>${escapeHtml(b.label)}</strong> (${b.size.toLocaleString()} MI)<br>
          VM-${b.vmId} (${escapeHtml(b.vmTier)})<br>
          Mulai: ${b.start.toFixed(2)}s &rarr; Selesai: ${b.end.toFixed(2)}s (${b.duration.toFixed(2)}s)
        `;
      } else {
        tooltipEl.style.display = "none";
      }
    };

    canvas.onmouseleave = () => {
      tooltipEl.style.display = "none";
    };
  }
}

// ============================================================================
// 5. VISUALISASI KURVA KONVERGENSI (4 VARIAN ABLATION)
// ============================================================================

function renderConvergenceSection() {
  const scenario = getActiveScenario();
  if (!scenario || !scenario.convergence) return;

  const conv = scenario.convergence;

  // Delegasi jika komponen eksternal P1 (window.ConvergenceChart) terpasang
  const externalContainer = qs("#convergence-chart-container");
  if (
    typeof window !== "undefined" &&
    window.ConvergenceChart?.render &&
    externalContainer
  ) {
    window.ConvergenceChart.render(externalContainer, {
      iterations: conv.iterations,
      series: [
        { name: "HEFT (Baseline)", values: conv.heftBaseline },
        { name: "CSO (Tanpa HEFT)", values: conv.cso },
        { name: "HC-CSO tanpa IW", values: conv.hccsoNoIw },
        { name: "HC-CSO Penuh (SMIW)", values: conv.hccso },
      ],
    });
  }

  const canvas = qs("#convergence-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const logicalWidth = canvas.clientWidth || 860;
  const logicalHeight = 300;

  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;
  canvas.style.height = `${logicalHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, logicalWidth, logicalHeight);

  const padLeft = 68;
  const padRight = 28;
  const padTop = 42;
  const padBottom = 42;
  const plotW = Math.max(120, logicalWidth - padLeft - padRight);
  const plotH = logicalHeight - padTop - padBottom;

  const seriesList = [
    {
      label: "HEFT (Baseline)",
      data: conv.heftBaseline,
      color: "#64748b",
      dash: [6, 4],
      width: 1.8,
    },
    {
      label: "CSO (Tanpa HEFT)",
      data: conv.cso,
      color: "#f59e0b",
      dash: [],
      width: 2.0,
    },
    {
      label: "HC-CSO tanpa IW",
      data: conv.hccsoNoIw,
      color: "#0ea5e9",
      dash: [3, 3],
      width: 2.0,
    },
    {
      label: "HC-CSO Penuh (SMIW)",
      data: conv.hccso,
      color: "#16a34a",
      dash: [],
      width: 2.6,
    },
  ].filter((s) => Array.isArray(s.data) && s.data.length > 0);

  const allVals = seriesList.flatMap((s) => s.data);
  if (allVals.length === 0) return;

  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const span = Math.max(rawMax - rawMin, rawMax * 0.02, 0.1);
  const yMin = Math.max(0, rawMin - span * 0.15);
  const yMax = rawMax + span * 0.15;

  // Grid & label sumbu Y
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const val = yMin + ((yMax - yMin) / yTicks) * i;
    const y = padTop + plotH - ((val - yMin) / (yMax - yMin)) * plotH;

    ctx.beginPath();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + plotW, y);
    ctx.stroke();

    ctx.fillStyle = "#475569";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${val.toFixed(1)}s`, padLeft - 8, y + 3);
  }

  // Sumbu X (Iterasi)
  const maxIterIdx = Math.max(1, conv.iterations.length - 1);
  const xTicks = Math.min(8, maxIterIdx);
  for (let i = 0; i <= xTicks; i++) {
    const iterIdx = Math.round((maxIterIdx / xTicks) * i);
    const x = padLeft + (iterIdx / maxIterIdx) * plotW;

    ctx.fillStyle = "#475569";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Iter ${iterIdx}`, x, padTop + plotH + 18);
  }

  // Garis sumbu utama
  ctx.beginPath();
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1.4;
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, padTop + plotH);
  ctx.lineTo(padLeft + plotW, padTop + plotH);
  ctx.stroke();

  // Gambar setiap kurva
  for (const s of seriesList) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.setLineDash(s.dash);

    const n = s.data.length;
    for (let i = 0; i < n; i++) {
      const x = padLeft + (i / Math.max(1, n - 1)) * plotW;
      const y = padTop + plotH - ((s.data[i] - yMin) / (yMax - yMin)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Legend horizontal di bagian atas
  let legendX = padLeft;
  const legendY = 18;
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "left";

  for (const s of seriesList) {
    ctx.fillStyle = s.color;
    ctx.fillRect(legendX, legendY - 8, 14, 4);
    ctx.fillStyle = "#0f172a";
    ctx.fillText(s.label, legendX + 18, legendY - 3);
    legendX += ctx.measureText(s.label).width + 34;
  }
}

// ============================================================================
// 6. SANDBOX SLIDER PARAMETER INTERAKTIF (LIVE RUN DI BROWSER)
// ============================================================================

function reconstructTasksFromScenario(scenario) {
  const blocks = scenario?.gantt?.hccso?.blocks || [];
  const sorted = [...blocks].sort((a, b) => a.taskId - b.taskId);
  return sorted.map((b) => ({ id: b.taskId, size: b.size }));
}

function buildBrowserGantt(assignment, tasks, vms) {
  const nVms = vms.length;
  const buckets = Array.from({ length: nVms }, () => []);
  for (let t = 0; t < tasks.length; t++) {
    buckets[assignment[t]].push(tasks[t]);
  }

  const blocks = [];
  const vmSummaries = [];
  let makespan = 0;
  let totalCost = 0;
  let sumLoad = 0;

  for (let v = 0; v < nVms; v++) {
    const queue = [...buckets[v]].sort((a, b) => b.size - a.size);
    let cursor = 0;
    for (const task of queue) {
      const dur = task.size / vms[v].speed;
      blocks.push({
        taskId: task.id,
        label: `T${task.id}`,
        size: task.size,
        vmId: v,
        vmTier: vms[v].tier,
        start: Number(cursor.toFixed(4)),
        end: Number((cursor + dur).toFixed(4)),
        duration: Number(dur.toFixed(4)),
      });
      cursor += dur;
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

function initParameterSandbox() {
  const mrSlider = qs("#slider-mr");
  const smpSlider = qs("#slider-smp");
  const iwModeSelect = qs("#select-iw-mode");
  const iwSlider = qs("#slider-iw");
  const seedInput = qs("#input-seed");
  const runBtn = qs("#btn-run-sim");
  const resetBtn = qs("#btn-reset-sim");
  const statusEl = qs("#sandbox-status");

  // Sinkronkan tampilan angka slider
  if (mrSlider) {
    mrSlider.addEventListener("input", () =>
      setText("#val-mr", Number(mrSlider.value).toFixed(2)),
    );
  }
  if (smpSlider) {
    smpSlider.addEventListener("input", () =>
      setText("#val-smp", String(smpSlider.value)),
    );
  }
  if (iwSlider) {
    iwSlider.addEventListener("input", () =>
      setText("#val-iw", Number(iwSlider.value).toFixed(2)),
    );
  }
  if (iwModeSelect && iwSlider) {
    iwModeSelect.addEventListener("change", () => {
      iwSlider.disabled = iwModeSelect.value !== "fixed";
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      appState.liveOverride = null;
      if (statusEl)
        statusEl.textContent = "Menampilkan hasil benchmark default tersimpan.";
      renderAllVisualizations();
    });
  }

  if (!runBtn) return;

  runBtn.addEventListener("click", async () => {
    const baseScenario = getActiveScenario();
    if (!baseScenario || !DEMO_DATA?.vms) return;

    const mods = await loadSimulatorModules();
    if (!mods.runHCCSO || !mods.heft || !mods.fitness) {
      if (statusEl) {
        statusEl.textContent =
          "Simulator live tidak tersedia pada mode file statis; gunakan `npx serve` atau `python -m http.server` dari root repositori.";
      }
      return;
    }

    const tasks = reconstructTasksFromScenario(baseScenario);
    const vms = DEMO_DATA.vms;
    const seed = seedInput ? Number(seedInput.value) || 42 : 42;
    const mr = mrSlider ? Number(mrSlider.value) : 0.3;
    const smp = smpSlider ? Number(smpSlider.value) : 4;
    const iwMode = iwModeSelect ? iwModeSelect.value : "smiw";

    const params = {
      popSize: 20,
      maxIter: 60,
      maxEvals: 1200,
      mr,
      smp,
      useHeft: true,
      useInertia: iwMode !== "none",
    };

    if (iwMode === "fixed" && iwSlider) {
      params.inertiaWeight = Number(iwSlider.value);
    }

    if (statusEl) statusEl.textContent = "Menjalankan simulasi HC-CSO...";

    const heftSol = mods.heft(tasks, vms);
    const heftMakespan = mods.fitness(heftSol.assignment, tasks, vms);
    const hccsoRes = mods.runHCCSO(tasks, vms, params, seed);
    const csoRes = mods.runHCCSO(
      tasks,
      vms,
      { ...params, useHeft: false },
      seed,
    );
    const noIwRes = mods.runHCCSO(
      tasks,
      vms,
      { ...params, useInertia: false },
      seed,
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

    appState.liveOverride = {
      ...baseScenario,
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
        heft: buildBrowserGantt(heftSol.assignment, tasks, vms),
        hccso: buildBrowserGantt(hccsoRes.schedule.assignment, tasks, vms),
      },
    };

    if (statusEl) {
      statusEl.textContent = `Selesai dalam ${fmt(hccsoRes.timeMs, 2)} ms (${hccsoRes.evaluations} evaluasi) | MR=${mr}, SMP=${smp}, IW=${iwMode.toUpperCase()}`;
    }
    renderAllVisualizations();
  });
}

// ============================================================================
// 7. ILUSTRASI ANIMASI SWARM KUCING (SEEKING VS TRACING MODE)
// ============================================================================

function initCatSwarmAnimation() {
  const canvas = qs("#cat-swarm-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const width = canvas.clientWidth || 540;
  const height = 220;
  canvas.width = width;
  canvas.height = height;

  const target = { x: width * 0.72, y: height * 0.45 };
  const cats = Array.from({ length: 12 }, (_, idx) => {
    const isTracing = idx < 4; // MR ~ 0.33
    return {
      id: idx,
      isTracing,
      baseX: 60 + (idx % 4) * 55,
      baseY: 45 + Math.floor(idx / 4) * 60,
      phase: idx * 0.7,
    };
  });

  let tick = 0;

  function drawFrame() {
    tick += 0.025;
    ctx.clearRect(0, 0, width, height);

    // Latar kontur ruang pencarian
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    // Lingkaran kontur sekitar X_best
    for (let r = 90; r >= 25; r -= 32) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(22, 163, 74, 0.16)";
      ctx.lineWidth = 1.2;
      ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Titik target X_best (Solusi Terbaik Global)
    ctx.beginPath();
    ctx.fillStyle = "#16a34a";
    ctx.arc(target.x, target.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("X_best (Jadwal Terbaik)", target.x, target.y - 14);

    // Gambar agen kucing
    for (const cat of cats) {
      let cx;
      let cy;

      if (cat.isTracing) {
        // Tracing Mode: bergerak mendekati X_best dengan kecepatan yang meluruh (SMIW)
        const progress = (Math.sin(tick + cat.phase) + 1) * 0.42;
        cx = cat.baseX + (target.x - cat.baseX) * progress;
        cy = cat.baseY + (target.y - cat.baseY) * progress;

        // Vektor kecepatan menuju X_best
        ctx.beginPath();
        ctx.strokeStyle = "rgba(37, 99, 235, 0.45)";
        ctx.lineWidth = 1.3;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + (target.x - cx) * 0.22, cy + (target.y - cy) * 0.22);
        ctx.stroke();

        ctx.fillStyle = "#2563eb";
      } else {
        // Seeking Mode: eksplorasi lokal melingkar (SMP neighborhood)
        cx = cat.baseX + Math.cos(tick * 1.6 + cat.phase) * 14;
        cy = cat.baseY + Math.sin(tick * 1.6 + cat.phase) * 14;

        ctx.beginPath();
        ctx.strokeStyle = "rgba(217, 119, 6, 0.25)";
        ctx.arc(cat.baseX, cat.baseY, 15, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#d97706";
      }

      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Legenda ilustrasi
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#d97706";
    ctx.fillRect(14, height - 22, 10, 10);
    ctx.fillStyle = "#334155";
    ctx.fillText("Seeking Mode (Eksplorasi Lokal SMP)", 28, height - 13);

    ctx.fillStyle = "#2563eb";
    ctx.fillRect(235, height - 22, 10, 10);
    ctx.fillStyle = "#334155";
    ctx.fillText("Tracing Mode (Velocity + SMIW)", 249, height - 13);

    appState.swarmAnimFrameId = requestAnimationFrame(drawFrame);
  }

  if (appState.swarmAnimFrameId)
    cancelAnimationFrame(appState.swarmAnimFrameId);
  drawFrame();
}

// ============================================================================
// 8. TABEL RINGKASAN EXPERIMEN ABLATION
// ============================================================================

function renderAblationTable() {
  const tbody = qs("#ablation-table-body");
  if (!tbody) return;

  if (!DEMO_DATA?.ablation || !Array.isArray(DEMO_DATA.ablation.datasets)) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-muted">
          Data ablation belum dimuat. Jalankan <code>node simulator/ablationHCCSO.js</code> lalu <code>node hc-cso/scripts/build-demo-data.mjs</code>.
        </td>
      </tr>
    `;
    return;
  }

  const rowsHtml = DEMO_DATA.ablation.datasets
    .map((ds) => {
      const s = ds.summary;
      const heftStr = s.HEFT?.makespan?.formatted || "-";
      const csoStr = s.CSO?.makespan?.formatted || "-";
      const noIwStr = s["HC-CSO-no-IW"]?.makespan?.formatted || "-";
      const hccsoStr = s["HC-CSO"]?.makespan?.formatted || "-";
      const redPct = Number(s["HC-CSO"]?.makespanReductionVsHeftPct || 0);
      const badgeClass = redPct > 0 ? "badge-positive" : "badge-neutral";

      return `
        <tr>
          <td><strong>${escapeHtml(ds.dataset)}</strong><br><small>${ds.taskCount} tasks</small></td>
          <td>${escapeHtml(heftStr)}</td>
          <td>${escapeHtml(csoStr)}</td>
          <td>${escapeHtml(noIwStr)}</td>
          <td><strong>${escapeHtml(hccsoStr)}</strong></td>
          <td><span class="${badgeClass}">${redPct >= 0 ? "-" : "+"}${fmt(Math.abs(redPct), 2)}%</span></td>
        </tr>
      `;
    })
    .join("");

  tbody.innerHTML = rowsHtml;
}

// ============================================================================
// 9. MODUL KUIS KONSEPTUAL INTERAKTIF (3 SOAL)
// ============================================================================

function initQuizModule() {
  const container = qs("#quiz-container");
  if (!container || !QUIZ_DATA?.questions) return;

  function renderQuiz() {
    const questionsHtml = QUIZ_DATA.questions
      .map((q) => {
        const selectedIdx = appState.quizAnswers[q.id];
        const optionsHtml = q.options
          .map((opt, idx) => {
            const isChecked = selectedIdx === idx;
            let stateClass = "";
            if (appState.quizSubmitted) {
              if (idx === q.correctIndex) stateClass = "is-correct";
              else if (isChecked && idx !== q.correctIndex)
                stateClass = "is-wrong";
            }

            return `
              <label class="quiz-option ${stateClass}">
                <input
                  type="radio"
                  name="${escapeHtml(q.id)}"
                  value="${idx}"
                  ${isChecked ? "checked" : ""}
                  ${appState.quizSubmitted ? "disabled" : ""}
                />
                <span class="opt-key">${escapeHtml(opt.key)}.</span>
                <span class="opt-text">${escapeHtml(opt.text)}</span>
              </label>
            `;
          })
          .join("");

        const feedbackHtml = appState.quizSubmitted
          ? `<div class="quiz-explanation ${
              selectedIdx === q.correctIndex ? "feedback-ok" : "feedback-warn"
            }">
              <strong>${
                selectedIdx === q.correctIndex
                  ? "Jawaban Benar!"
                  : `Kurang Tepat (Kunci: ${escapeHtml(q.correctKey)}).`
              }</strong>
              <p>${escapeHtml(q.explanation)}</p>
            </div>`
          : "";

        return `
          <div class="quiz-card" data-question-id="${escapeHtml(q.id)}">
            <div class="quiz-topic">Soal ${q.number} &bull; ${escapeHtml(q.topic)}</div>
            <p class="quiz-question">${escapeHtml(q.question)}</p>
            <div class="quiz-options">${optionsHtml}</div>
            ${feedbackHtml}
          </div>
        `;
      })
      .join("");

    container.innerHTML = questionsHtml;

    // Dengarkan perubahan pilihan radio
    qsa('input[type="radio"]', container).forEach((radio) => {
      radio.addEventListener("change", (e) => {
        appState.quizAnswers[e.target.name] = Number(e.target.value);
      });
    });
  }

  const submitBtn = qs("#btn-submit-quiz");
  const resetBtn = qs("#btn-reset-quiz");
  const scoreBanner = qs("#quiz-score-banner");

  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      const total = QUIZ_DATA.questions.length;
      const answeredCount = Object.keys(appState.quizAnswers).length;

      if (answeredCount < total) {
        if (scoreBanner) {
          scoreBanner.style.display = "block";
          scoreBanner.textContent = `Silakan jawab seluruh ${total} pertanyaan terlebih dahulu (${answeredCount}/${total} terjawab).`;
        }
        return;
      }

      appState.quizSubmitted = true;
      let score = 0;
      for (const q of QUIZ_DATA.questions) {
        if (appState.quizAnswers[q.id] === q.correctIndex) score++;
      }

      if (scoreBanner) {
        scoreBanner.style.display = "block";
        const passed = score >= (QUIZ_DATA.meta?.passingScore || 2);
        scoreBanner.innerHTML = `<strong>Skor Akhir: ${score} / ${total}</strong> — ${
          passed
            ? "Pemahaman konsep HC-CSO (HEFT warm-start, Seeking/Tracing, dan SMIW) sangat baik!"
            : "Tinjau kembali pembahasan di bawah tiap soal untuk memperkuat pemahaman."
        }`;
      }

      renderQuiz();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      appState.quizAnswers = {};
      appState.quizSubmitted = false;
      if (scoreBanner) {
        scoreBanner.style.display = "none";
        scoreBanner.textContent = "";
      }
      renderQuiz();
    });
  }

  renderQuiz();
}

// ============================================================================
// 10. ORKESTRASI INISIALISASI HALAMAN
// ============================================================================

function renderAllVisualizations() {
  renderScenarioMetrics();
  renderGanttSection();
  renderConvergenceSection();
}

function initHcCsoPage() {
  hydrateImpactCardAndBanner();
  initScenarioControls();
  initGanttToggleControls();
  initParameterSandbox();
  renderAblationTable();
  initQuizModule();
  renderAllVisualizations();
  initCatSwarmAnimation();

  // Responsif saat ukuran jendela berubah
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderGanttSection();
      renderConvergenceSection();
    }, 150);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHcCsoPage);
} else {
  initHcCsoPage();
}
