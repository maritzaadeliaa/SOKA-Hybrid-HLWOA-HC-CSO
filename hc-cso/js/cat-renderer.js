/**
 * @module cat-renderer
 * @description Modul ilustrasi & animasi interaktif Cat Swarm Optimization (HC-CSO)
 * yang terhubung langsung dengan papan balok jadwal Virtual Machine (Gantt Block Board).
 *
 * Fitur Utama:
 * 1. Anatomi kucing realistis berbasis kurva Bézier (telinga ber-pinna, pipi berbulu,
 *    mata almond dengan pupil vertikal dinamis, hidung segitiga terbalik, mulut "ω",
 *    kumis bergetar, corak tabby "M" di dahi, bayangan kontak tanah, serta ekor animasi).
 * 2. Dua postur tubuh kontras:
 *    - Seeking Mode: Kucing oranye tabby duduk waspada menghadap VM bottleneck,
 *      memancarkan radar pemindai dan memproyeksikan balok bayangan (ghost preview).
 *    - Tracing Mode: Kucing abu-abu slate berlari horizontal mengikuti vektor kecepatan
 *      berskala Inertia Weight (γ) menuju Pemimpin X_best sambil menarik balok task
 *      berpindah VM dan menggeser garis Makespan ke kiri.
 * 3. Kompatibel sebagai ES Module (`import { CatSwarmRenderer }`) maupun global (`window.CatSwarmRenderer`).
 */

const PHASE_ORDER = ["heft", "seeking", "tracing"];

const PHASE_META = {
  heft: {
    index: 1,
    badge: "FASE 1 · HEFT WARM-START",
    subtitle:
      "Menyusun antrean task terbesar lebih dulu ke VM tercepat sebagai titik awal populasi.",
    accent: "#2563eb",
    bgTint: "rgba(37, 99, 235, 0.12)",
  },
  seeking: {
    index: 2,
    badge: "FASE 2 · SEEKING MODE (EKSPLORASI LOKAL)",
    subtitle:
      "Kucing duduk mengamati VM bottleneck & memproyeksikan kandidat pemindahan balok (SMP).",
    accent: "#ea580c",
    bgTint: "rgba(234, 88, 12, 0.12)",
  },
  tracing: {
    index: 3,
    badge: "FASE 3 · TRACING MODE (MENGEJAR X_best)",
    subtitle:
      "Kucing berlari mengikuti vektor kecepatan γ menuju X_best & memindahkan balok jadwal VM.",
    accent: "#0d9488",
    bgTint: "rgba(13, 148, 136, 0.12)",
  },
};

const TIER_COLORS = {
  Compute: { fill: "#3b82f6", stroke: "#1d4ed8", text: "#ffffff" },
  Standard: { fill: "#10b981", stroke: "#047857", text: "#ffffff" },
  Light: { fill: "#f59e0b", stroke: "#b45309", text: "#1e293b" },
  default: { fill: "#6366f1", stroke: "#4338ca", text: "#ffffff" },
};

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export class CatSwarmRenderer {
  /**
   * @param {HTMLCanvasElement|string} canvasOrId - Elemen <canvas> atau ID-nya
   * @param {Object} [options] - Konfigurasi opsional
   */
  constructor(canvasOrId, options = {}) {
    this.canvas =
      typeof canvasOrId === "string"
        ? document.getElementById(canvasOrId)
        : canvasOrId;
    if (!this.canvas) {
      throw new Error("[CatSwarmRenderer] Elemen canvas tidak ditemukan.");
    }

    this.ctx = this.canvas.getContext("2d");
    this.onPhaseChange =
      typeof options.onPhaseChange === "function"
        ? options.onPhaseChange
        : null;
    this.onHoverBlock =
      typeof options.onHoverBlock === "function" ? options.onHoverBlock : null;

    // Parameter algoritma yang memengaruhi visual
    this.params = {
      mr: 0.3, // Mixing Ratio (proporsi kucing Tracing, misal 0.3 = 30% Tracing, 70% Seeking)
      smp: 5, // Seeking Memory Pool (jumlah kandidat radar Seeking)
      useInertia: true, // Aktif/nonaktif Self-Motivated Inertia Weight
      gammaMax: 2.0,
      gammaMin: 0.4,
    };

    // State jadwal & transisi balok VM
    this.vms = [];
    this.heftGantt = null;
    this.hccsoGantt = null;
    this.migrations = []; // Daftar perpindahan balok dari HEFT -> HC-CSO
    this.renderedBlocks = []; // Cache hitbox balok untuk tooltip hover
    this.hoveredBlock = null;

    // State siklus animasi
    this.phase = "heft";
    this.phaseProgress = 0; // 0.0 -> 1.0 dalam satu fase
    this.iterationRatio = 0; // 0.0 -> 1.0 untuk peluruhan gamma
    this.isPlaying = true;
    this.autoAdvancePhases = true;
    this.phaseDurationMs = options.phaseDurationMs || 4400;

    // Agen kucing visual
    this.cats = [];
    this.leaderCat = { x: 0, y: 0, bobPhase: 0 };

    // Loop & interaksi
    this._rafId = null;
    this._lastTimestamp = 0;
    this._clockSec = 0;

    this._handleMouseMove = this._onMouseMove.bind(this);
    this._handleMouseLeave = this._onMouseLeave.bind(this);
    this.canvas.addEventListener("mousemove", this._handleMouseMove);
    this.canvas.addEventListener("mouseleave", this._handleMouseLeave);

    this._syncCanvasResolution();
    this._rebuildCats();
  }

  /**
   * Mengatur skala DPI layar agar garis dan anatomi kucing tetap tajam.
   */
  _syncCanvasResolution() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(
      720,
      Math.round(rect.width || this.canvas.width || 960),
    );
    const cssHeight = Math.max(
      430,
      Math.round(rect.height || this.canvas.height || 470),
    );

    if (
      this.canvas.width !== cssWidth * dpr ||
      this.canvas.height !== cssHeight * dpr
    ) {
      this.canvas.width = cssWidth * dpr;
      this.canvas.height = cssHeight * dpr;
    }

    this.width = cssWidth;
    this.height = cssHeight;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * Memperbarui data jadwal VM (dari DEMO_DATA atau hasil simulasi Sandbox).
   * @param {Object} payload
   * @param {Array} payload.vms - Daftar VM
   * @param {Object} payload.heftGantt - Objek Gantt jadwal awal HEFT
   * @param {Object} payload.hccsoGantt - Objek Gantt jadwal hasil HC-CSO
   * @param {Object} [payload.params] - Parameter MR, SMP, useInertia
   */
  setScheduleData({ vms, heftGantt, hccsoGantt, params }) {
    if (Array.isArray(vms)) this.vms = vms;
    if (heftGantt) this.heftGantt = heftGantt;
    if (hccsoGantt) this.hccsoGantt = hccsoGantt;
    if (params) this.setParameters(params, false);

    this.migrations = this._computeTaskMigrations(
      this.heftGantt,
      this.hccsoGantt,
    );
    this.phase = "heft";
    this.phaseProgress = 0;
    this.iterationRatio = 0;
    this._rebuildCats();
    this._emitPhaseChange();
  }

  /**
   * Memperbarui parameter MR, SMP, dan Inertia Weight secara real-time.
   */
  setParameters(newParams = {}, rebuild = true) {
    if (typeof newParams.mr === "number") {
      this.params.mr = clamp(newParams.mr, 0.1, 0.9);
    }
    if (typeof newParams.smp === "number") {
      this.params.smp = clamp(Math.round(newParams.smp), 1, 10);
    }
    if (typeof newParams.useInertia === "boolean") {
      this.params.useInertia = newParams.useInertia;
    }
    if (rebuild) {
      this._rebuildCats();
    }
  }

  /**
   * Mengatur fase aktif secara manual ('heft' | 'seeking' | 'tracing').
   */
  setPhase(phaseName, resetProgress = true) {
    if (!PHASE_ORDER.includes(phaseName)) return;
    this.phase = phaseName;
    if (resetProgress) {
      this.phaseProgress = 0;
    }
    this._emitPhaseChange();
  }

  /**
   * Melompat ke fase berikutnya dalam siklus HEFT -> Seeking -> Tracing.
   */
  stepPhase() {
    const idx = PHASE_ORDER.indexOf(this.phase);
    const nextPhase = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
    this.setPhase(nextPhase, true);
  }

  play() {
    this.isPlaying = true;
    if (!this._rafId) {
      this._lastTimestamp = performance.now();
      this._rafId = requestAnimationFrame((ts) => this._loop(ts));
    }
  }

  pause() {
    this.isPlaying = false;
  }

  start() {
    this.play();
  }

  destroy() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.canvas.removeEventListener("mousemove", this._handleMouseMove);
    this.canvas.removeEventListener("mouseleave", this._handleMouseLeave);
  }

  _emitPhaseChange() {
    if (this.onPhaseChange) {
      this.onPhaseChange({
        phase: this.phase,
        meta: PHASE_META[this.phase],
        gamma: this.getCurrentGamma(),
        progress: this.phaseProgress,
      });
    }
  }

  /**
   * Menghitung nilai Self-Motivated Inertia Weight (γ) saat ini.
   */
  getCurrentGamma() {
    if (!this.params.useInertia) return 0.0;
    // Peluruhan eksponensial terinspirasi SMIW Bhagwan & Kumar (2021)
    const r = clamp(this.iterationRatio, 0, 1);
    const gamma = this.params.gammaMax * Math.exp(-1.6 * Math.pow(r, 1.5));
    return Number(
      clamp(gamma, this.params.gammaMin, this.params.gammaMax).toFixed(2),
    );
  }

  /**
   * Mendeteksi balok task mana yang berpindah VM antara jadwal HEFT dan HC-CSO
   * agar kucing Seeking & Tracing menunjuk balok yang benar-benar pindah.
   */
  _computeTaskMigrations(heftGantt, hccsoGantt) {
    if (!heftGantt?.blocks?.length || !hccsoGantt?.blocks?.length) {
      return [];
    }

    const heftMap = new Map();
    for (const b of heftGantt.blocks) {
      heftMap.set(b.taskId, b);
    }

    const bottleneckVm =
      heftGantt.vmSummaries?.find((v) => v.isBottleneck)?.vmId ?? 0;

    const moves = [];
    for (const targetBlock of hccsoGantt.blocks) {
      const srcBlock = heftMap.get(targetBlock.taskId);
      if (srcBlock && srcBlock.vmId !== targetBlock.vmId) {
        moves.push({
          taskId: targetBlock.taskId,
          label: targetBlock.label || `T${targetBlock.taskId}`,
          size: targetBlock.size,
          fromVmId: srcBlock.vmId,
          toVmId: targetBlock.vmId,
          srcBlock,
          targetBlock,
          fromBottleneck: srcBlock.vmId === bottleneckVm,
        });
      }
    }

    // Prioritaskan perpindahan yang berasal dari VM bottleneck terlebih dahulu
    moves.sort((a, b) => {
      if (a.fromBottleneck !== b.fromBottleneck)
        return a.fromBottleneck ? -1 : 1;
      return b.size - a.size;
    });

    // Fallback: jika jadwal identik, buat 1 kandidat simulasi dari VM terpadat ke VM teringan
    if (moves.length === 0 && heftGantt.vmSummaries?.length >= 2) {
      const sortedVms = [...heftGantt.vmSummaries].sort(
        (a, b) => b.finishTime - a.finishTime,
      );
      const busiestVm = sortedVms[0];
      const lightestVm = sortedVms[sortedVms.length - 1];
      const candidateBlock = heftGantt.blocks
        .filter((b) => b.vmId === busiestVm.vmId)
        .sort((a, b) => b.end - a.end)[0];

      if (candidateBlock && lightestVm && busiestVm.vmId !== lightestVm.vmId) {
        const estDur = candidateBlock.size / (lightestVm.speed || 1500);
        moves.push({
          taskId: candidateBlock.taskId,
          label: candidateBlock.label || `T${candidateBlock.taskId}`,
          size: candidateBlock.size,
          fromVmId: busiestVm.vmId,
          toVmId: lightestVm.vmId,
          srcBlock: candidateBlock,
          targetBlock: {
            ...candidateBlock,
            vmId: lightestVm.vmId,
            vmTier: lightestVm.tier,
            start: lightestVm.finishTime,
            end: lightestVm.finishTime + estDur,
            duration: estDur,
          },
          fromBottleneck: true,
        });
      }
    }

    return moves.slice(0, 4);
  }

  /**
   * Membangun kawanan kucing visual (proporsional dengan Mixing Ratio)
   * tanpa saling bertumpuk di arena kanan.
   */
  _rebuildCats() {
    const totalSwarmCats = 7; // 7 anggota kawanan + 1 pemimpin X_best = 8 kucing
    const tracingCount = clamp(
      Math.round(totalSwarmCats * this.params.mr),
      1,
      totalSwarmCats - 1,
    );
    const seekingCount = totalSwarmCats - tracingCount;

    const cats = [];

    // 1. Kelompok Seeking Cats (Oranye Tabby - Duduk Waspada)
    for (let i = 0; i < seekingCount; i++) {
      cats.push({
        id: `seek-${i}`,
        role: "seeking",
        slotIndex: i,
        totalInRole: seekingCount,
        furPalette:
          i % 2 === 0
            ? {
                primary: "#f97316",
                secondary: "#fed7aa",
                stripe: "#9a3412",
                eye: "#15803d",
              }
            : {
                primary: "#fb923c",
                secondary: "#ffedd5",
                stripe: "#7c2d12",
                eye: "#ca8a04",
              },
        phaseOffset: i * 1.15,
        stridePhase: i * 0.8,
      });
    }

    // 2. Kelompok Tracing Cats (Slate Biru / Arang - Berlari Mengejar X_best)
    for (let i = 0; i < tracingCount; i++) {
      cats.push({
        id: `trace-${i}`,
        role: "tracing",
        slotIndex: i,
        totalInRole: tracingCount,
        furPalette:
          i % 2 === 0
            ? {
                primary: "#475569",
                secondary: "#cbd5e1",
                stripe: "#1e293b",
                eye: "#eab308",
              }
            : {
                primary: "#334155",
                secondary: "#94a3b8",
                stripe: "#0f172a",
                eye: "#38bdf8",
              },
        phaseOffset: i * 1.4,
        stridePhase: i * 1.7,
      });
    }

    this.cats = cats;
  }

  _loop(timestamp) {
    if (!this._lastTimestamp) this._lastTimestamp = timestamp;
    const dtMs = Math.min(timestamp - this._lastTimestamp, 80);
    this._lastTimestamp = timestamp;
    this._clockSec += dtMs / 1000;

    if (this.isPlaying) {
      this.phaseProgress += dtMs / this.phaseDurationMs;
      if (this.phase === "tracing") {
        this.iterationRatio = clamp(
          this.iterationRatio + (dtMs / this.phaseDurationMs) * 0.35,
          0,
          1,
        );
      }

      if (this.phaseProgress >= 1) {
        if (this.autoAdvancePhases) {
          const nextIdx =
            (PHASE_ORDER.indexOf(this.phase) + 1) % PHASE_ORDER.length;
          if (nextIdx === 0) {
            // Reset siklus iterasi saat kembali ke HEFT
            this.iterationRatio = 0;
          }
          this.phase = PHASE_ORDER[nextIdx];
          this.phaseProgress = 0;
          this._emitPhaseChange();
        } else {
          this.phaseProgress = 1;
        }
      }
    }

    this.render();

    if (this.isPlaying) {
      this._rafId = requestAnimationFrame((ts) => this._loop(ts));
    } else {
      this._rafId = null;
    }
  }

  /**
   * Merender keseluruhan panggung terpadu:
   * - Header Fase & Indikator Inertia Weight (γ)
   * - Zona Kiri: Papan Balok Jadwal VM (Gantt Block Board)
   * - Zona Kanan: Arena Perilaku Kucing (Seeking vs Tracing + Pemimpin X_best)
   * - Jembatan Interaksi: Radar Seeking, Ghost Block, Vektor Kecepatan, & Balok Terbang
   */
  render() {
    this._syncCanvasResolution();
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;

    ctx.clearRect(0, 0, W, H);

    // Latar panggung bersih
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, W, H);

    // Tata letak koordinat panggung
    const headerH = 44;
    const footerH = 30;
    const pad = 12;
    const bodyY = headerH + 6;
    const bodyH = H - headerH - footerH - 12;

    const leftW = Math.floor((W - pad * 3) * 0.58);
    const rightX = pad * 2 + leftW;
    const rightW = W - rightX - pad;

    const boardRect = { x: pad, y: bodyY, w: leftW, h: bodyH };
    const arenaRect = { x: rightX, y: bodyY, w: rightW, h: bodyH };

    // 1. Render Header Panggung
    this._renderStageHeader(ctx, W, headerH);

    // 2. Render Zona Kiri (Papan Balok Jadwal VM) & Zona Kanan (Arena Kucing)
    const boardAnchors = this._renderVmBlockBoard(ctx, boardRect);
    this._renderCatSwarmArena(ctx, arenaRect, boardAnchors);

    // 3. Render Jembatan Interaksi Langsung (Kucing <-> Balok VM)
    this._renderBridgeInteractions(ctx, boardRect, arenaRect, boardAnchors);

    // 4. Render Footer Legenda Ringkas
    this._renderStageFooter(ctx, W, H - footerH, footerH);
  }

  _renderStageHeader(ctx, W, H) {
    const meta = PHASE_META[this.phase];

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(W, H);
    ctx.stroke();

    // Pill Fase Aktif
    drawRoundedRect(ctx, 12, 8, 285, 28, 14);
    ctx.fillStyle = meta.bgTint;
    ctx.fill();
    ctx.strokeStyle = meta.accent;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = meta.accent;
    ctx.font = "bold 11.5px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(meta.badge, 24, 22);

    // Progress bar tipis di bagian bawah header
    ctx.fillStyle = meta.accent;
    ctx.fillRect(0, H - 2.5, W * clamp(this.phaseProgress, 0, 1), 2.5);

    // Indikator Inertia Weight (γ) di kanan header
    const gamma = this.getCurrentGamma();
    const gammaBoxW = 215;
    const gammaX = W - gammaBoxW - 12;

    drawRoundedRect(ctx, gammaX, 8, gammaBoxW, 28, 8);
    ctx.fillStyle = "#f1f5f9";
    ctx.fill();

    ctx.fillStyle = "#334155";
    ctx.font = "600 11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      this.params.useInertia
        ? `Inertia (γ): ${gamma.toFixed(2)}`
        : "Inertia (γ): OFF (0.00)",
      gammaX + 10,
      22,
    );

    // Mini bar skala gamma
    const barX = gammaX + 124;
    const barW = 78;
    const barRatio = this.params.useInertia
      ? clamp(gamma / this.params.gammaMax, 0, 1)
      : 0;
    drawRoundedRect(ctx, barX, 17, barW, 10, 5);
    ctx.fillStyle = "#cbd5e1";
    ctx.fill();

    if (barRatio > 0) {
      drawRoundedRect(ctx, barX, 17, Math.max(8, barW * barRatio), 10, 5);
      ctx.fillStyle = "#0d9488";
      ctx.fill();
    }
  }

  /**
   * Merender Papan Balok Jadwal VM di sisi kiri panggung dan mengembalikan
   * koordinat jangkar balok bottleneck / target untuk dihubungkan ke kucing.
   */
  _renderVmBlockBoard(ctx, rect) {
    // Bingkai kartu papan VM
    drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Judul sub-panel
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      "Papan Balok Jadwal VM (HEFT → HC-CSO)",
      rect.x + 12,
      rect.y + 10,
    );

    const activeGantt = this.heftGantt || this.hccsoGantt;
    if (!activeGantt || !activeGantt.vmSummaries?.length) {
      ctx.fillStyle = "#64748b";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText("Memuat data jadwal VM...", rect.x + 12, rect.y + 40);
      return {};
    }

    const vmList = activeGantt.vmSummaries;
    const nVms = vmList.length;
    const labelColW = 86;
    const plotX = rect.x + labelColW + 8;
    const plotY = rect.y + 34;
    const plotW = rect.w - labelColW - 24;
    const plotH = rect.h - 46;

    const heftMakespan = this.heftGantt?.makespan || activeGantt.makespan || 1;
    const hccsoMakespan = this.hccsoGantt?.makespan || heftMakespan;
    const maxScaleTime = Math.max(heftMakespan, hccsoMakespan) * 1.12;

    // Faktor interpolasi transisi balok (0 = posisi HEFT, 1 = posisi HC-CSO)
    let transitionT = 0;
    if (this.phase === "tracing") {
      transitionT = easeInOutCubic(
        clamp((this.phaseProgress - 0.15) / 0.7, 0, 1),
      );
    }

    const currentMakespan = lerp(heftMakespan, hccsoMakespan, transitionT);
    const rowGap = nVms > 10 ? 3 : 5;
    const rowH = Math.max(14, Math.floor((plotH - rowGap * (nVms - 1)) / nVms));

    const rowCoords = new Map();
    this.renderedBlocks = [];

    // Gambar baris lintasan VM
    vmList.forEach((vm, idx) => {
      const y = plotY + idx * (rowH + rowGap);
      rowCoords.set(vm.vmId, { y, h: rowH, vm });

      // Latar baris VM (sorot merah muda lembut jika VM bottleneck pada fase awal)
      const isBottle = vm.isBottleneck && transitionT < 0.75;
      drawRoundedRect(ctx, rect.x + 8, y, rect.w - 16, rowH, 5);
      ctx.fillStyle = isBottle
        ? "rgba(254, 226, 226, 0.55)"
        : idx % 2 === 0
          ? "#f8fafc"
          : "#f1f5f9";
      ctx.fill();

      // Label nama VM di sisi kiri
      ctx.fillStyle = isBottle ? "#b91c1c" : "#334155";
      ctx.font = `${isBottle ? "bold " : ""}10px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const shortName = `VM-${vm.vmId} (${vm.tier[0]})`;
      ctx.fillText(shortName, rect.x + 13, y + rowH / 2);

      if (isBottle && rowH >= 16) {
        ctx.fillStyle = "#dc2626";
        ctx.font = "bold 8.5px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("MAX", plotX - 4, y + rowH / 2);
      }
    });

    // Petakan balok HEFT dan HC-CSO untuk interpolasi posisi yang mulus
    const heftBlocks = this.heftGantt?.blocks || [];
    const hccsoBlocksById = new Map(
      (this.hccsoGantt?.blocks || []).map((b) => [b.taskId, b]),
    );

    const primaryMove = this.migrations[0] || null;
    let bottleneckAnchor = null;
    let targetGhostAnchor = null;
    let flyingBlockState = null;

    for (const hBlock of heftBlocks) {
      const cBlock = hccsoBlocksById.get(hBlock.taskId) || hBlock;
      const isMigrating = primaryMove && hBlock.taskId === primaryMove.taskId;

      const srcRow = rowCoords.get(hBlock.vmId);
      const dstRow = rowCoords.get(cBlock.vmId);
      if (!srcRow || !dstRow) continue;

      const srcX = plotX + (hBlock.start / maxScaleTime) * plotW;
      const srcW = Math.max(4, (hBlock.duration / maxScaleTime) * plotW - 1.5);
      const dstX = plotX + (cBlock.start / maxScaleTime) * plotW;
      const dstW = Math.max(4, (cBlock.duration / maxScaleTime) * plotW - 1.5);

      const palette = TIER_COLORS[hBlock.vmTier] || TIER_COLORS.default;

      if (isMigrating) {
        // Simpan koordinat sumber untuk radar kucing Seeking
        bottleneckAnchor = {
          x: srcX + srcW / 2,
          y: srcRow.y + srcRow.h / 2,
          rightX: srcX + srcW,
          w: srcW,
          h: srcRow.h,
          block: hBlock,
        };

        // Simpan koordinat tujuan untuk Ghost Preview & pendaratan balok
        targetGhostAnchor = {
          x: dstX + dstW / 2,
          y: dstRow.y + dstRow.h / 2,
          leftX: dstX,
          w: dstW,
          h: dstRow.h,
          block: cBlock,
        };

        if (this.phase === "tracing" && transitionT > 0 && transitionT < 1) {
          // Balok sedang terbang ditarik kucing Tracing!
          const curX = lerp(srcX, dstX, transitionT);
          const arcLift = Math.sin(transitionT * Math.PI) * 18;
          const curY = lerp(srcRow.y, dstRow.y, transitionT) - arcLift;
          const curW = lerp(srcW, dstW, transitionT);

          flyingBlockState = {
            x: curX,
            y: curY,
            w: curW,
            h: srcRow.h,
            centerX: curX + curW / 2,
            centerY: curY + srcRow.h / 2,
            label: hBlock.label || `T${hBlock.taskId}`,
            palette,
          };
          continue; // Digambar di layer paling atas agar menonjol
        }
      }

      // Posisi balok reguler (atau balok migrasi sebelum/sesudah terbang)
      const drawX =
        this.phase === "tracing" ? lerp(srcX, dstX, transitionT) : srcX;
      const drawY =
        this.phase === "tracing"
          ? lerp(srcRow.y, dstRow.y, transitionT)
          : srcRow.y;
      const drawW =
        this.phase === "tracing" ? lerp(srcW, dstW, transitionT) : srcW;
      const drawH = srcRow.h - 2;

      const isHovered =
        this.hoveredBlock && this.hoveredBlock.taskId === hBlock.taskId;

      drawRoundedRect(ctx, drawX, drawY + 1, drawW, drawH, 3.5);
      ctx.fillStyle = palette.fill;
      ctx.fill();

      if (isMigrating || isHovered) {
        ctx.strokeStyle = isHovered ? "#0f172a" : "#f97316";
        ctx.lineWidth = isHovered ? 2 : 1.6;
        ctx.stroke();
      }

      if (drawW >= 22 && drawH >= 12) {
        ctx.fillStyle = palette.text;
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          hBlock.label || `T${hBlock.taskId}`,
          drawX + drawW / 2,
          drawY + 1 + drawH / 2,
        );
      }

      this.renderedBlocks.push({
        x: drawX,
        y: drawY + 1,
        w: drawW,
        h: drawH,
        block: this.phase === "tracing" && transitionT > 0.5 ? cBlock : hBlock,
        isMigrated: Boolean(isMigrating),
      });
    }

    // Jika tidak ada migrasi spesifik, ambil balok ujung VM bottleneck sebagai anchor
    if (!bottleneckAnchor) {
      const bottleVm = vmList.find((v) => v.isBottleneck) || vmList[0];
      const bRow = rowCoords.get(bottleVm.vmId);
      const endX = plotX + (bottleVm.finishTime / maxScaleTime) * plotW;
      if (bRow) {
        bottleneckAnchor = {
          x: endX - 10,
          y: bRow.y + bRow.h / 2,
          rightX: endX,
          w: 20,
          h: bRow.h,
          block: null,
        };
      }
    }

    // Gambar Ghost Preview block saat fase Seeking Mode
    if (this.phase === "seeking" && targetGhostAnchor) {
      const pulse = 0.45 + 0.35 * Math.sin(this._clockSec * 5);
      ctx.save();
      ctx.setLineDash([4, 3]);
      drawRoundedRect(
        ctx,
        targetGhostAnchor.leftX,
        targetGhostAnchor.y - targetGhostAnchor.h / 2 + 1,
        targetGhostAnchor.w,
        targetGhostAnchor.h - 2,
        4,
      );
      ctx.fillStyle = `rgba(249, 115, 22, ${0.15 + pulse * 0.15})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(234, 88, 12, ${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    // Gambar Garis Vertikal Makespan (C_max)
    const makespanX = plotX + (currentMakespan / maxScaleTime) * plotW;
    ctx.save();
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(makespanX, plotY - 4);
    ctx.lineTo(makespanX, plotY + plotH + 2);
    ctx.stroke();
    ctx.restore();

    // Label angka Makespan di puncak garis merah
    const tagText = `C_max: ${currentMakespan.toFixed(1)}s`;
    ctx.font = "bold 10px system-ui, sans-serif";
    const tagW = ctx.measureText(tagText).width + 10;
    const tagX = clamp(makespanX - tagW / 2, plotX, plotX + plotW - tagW);
    drawRoundedRect(ctx, tagX, rect.y + 10, tagW, 18, 4);
    ctx.fillStyle = "#dc2626";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tagText, tagX + tagW / 2, rect.y + 19);

    return {
      plotX,
      plotY,
      plotW,
      plotH,
      makespanX,
      makespanY: rect.y + 19,
      bottleneckAnchor,
      targetGhostAnchor,
      flyingBlockState,
    };
  }

  /**
   * Merender Arena Kawanan Kucing di sisi kanan panggung:
   * - Pemimpin X_best di puncak arena
   * - Kelompok Seeking Cats (duduk menghadap papan VM)
   * - Kelompok Tracing Cats (berlari mengikuti vektor menuju X_best)
   */
  _renderCatSwarmArena(ctx, rect, boardAnchors) {
    // Bingkai Arena Kucing
    drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fillStyle = "#fffbeb"; // Latar krem hangat lembut agar siluet kucing kontras
    ctx.fill();
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Garis kisi arena halus
    ctx.strokeStyle = "rgba(217, 119, 6, 0.08)";
    ctx.lineWidth = 1;
    for (let gx = rect.x + 28; gx < rect.x + rect.w; gx += 28) {
      ctx.beginPath();
      ctx.moveTo(gx, rect.y + 30);
      ctx.lineTo(gx, rect.y + rect.h - 8);
      ctx.stroke();
    }

    // Judul Sub-Panel Arena
    ctx.fillStyle = "#78350f";
    ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const seekPct = Math.round((1 - this.params.mr) * 100);
    const tracePct = Math.round(this.params.mr * 100);
    ctx.fillText(
      `Arena Kucing (Seek ${seekPct}% · Trace ${tracePct}%)`,
      rect.x + 12,
      rect.y + 10,
    );

    // 1. Posisi Pemimpin X_best (Target Mangsa / Solusi Terbaik Global)
    const leaderX = rect.x + rect.w - 58;
    const leaderY = rect.y + 68 + Math.sin(this._clockSec * 2.6) * 2.5;
    this.leaderCat = { x: leaderX, y: leaderY };

    // Aura target di sekitar Pemimpin X_best
    const auraR = 26 + Math.sin(this._clockSec * 4) * 3;
    ctx.beginPath();
    ctx.arc(leaderX, leaderY - 4, auraR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(245, 158, 11, 0.16)";
    ctx.fill();

    // Gambar Kucing Pemimpin X_best dengan mahkota emas
    this._drawRealisticCat(ctx, {
      x: leaderX,
      y: leaderY,
      scale: 0.92,
      pose: "sitting",
      facing: -1, // Menghadap kiri ke papan VM
      palette: {
        primary: "#d97706",
        secondary: "#fef3c7",
        stripe: "#78350f",
        eye: "#0284c7",
      },
      isLeader: true,
      isActiveRole: true,
      timeSec: this._clockSec,
    });

    // Label Pemimpin X_best
    drawRoundedRect(ctx, leaderX - 30, leaderY + 22, 60, 16, 8);
    ctx.fillStyle = "#b45309";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9.5px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("X_best ★", leaderX, leaderY + 30);

    // 2. Hitung posisi dan gambar seluruh anggota kawanan kucing
    const seekingCats = this.cats.filter((c) => c.role === "seeking");
    const tracingCats = this.cats.filter((c) => c.role === "tracing");

    const seekZoneTop = rect.y + 92;
    const seekZoneH = Math.max(95, (rect.h - 120) * 0.52);

    const traceZoneTop = seekZoneTop + seekZoneH + 14;
    const traceZoneH = Math.max(85, rect.y + rect.h - traceZoneTop - 16);

    // Pembatas tipis zona Seeking vs Tracing di arena
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(180, 83, 9, 0.25)";
    ctx.beginPath();
    ctx.moveTo(rect.x + 12, traceZoneTop - 8);
    ctx.lineTo(rect.x + rect.w - 12, traceZoneTop - 8);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#9a3412";
    ctx.font = "bold 9.5px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      `SEEKING GROUP (SMP=${this.params.smp})`,
      rect.x + 12,
      seekZoneTop - 14,
    );

    ctx.fillStyle = "#1e3a8a";
    ctx.fillText(
      "TRACING GROUP (VELOCITIES → X_best)",
      rect.x + 12,
      traceZoneTop - 4,
    );

    // Render Seeking Cats (Duduk menghadap kiri ke Papan Jadwal VM)
    seekingCats.forEach((cat, idx) => {
      const cols = Math.min(3, seekingCats.length);
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const spacingX = (rect.w - 110) / Math.max(1, cols);
      const spacingY =
        seekZoneH / Math.max(1, Math.ceil(seekingCats.length / cols));

      const cx = rect.x + 44 + col * spacingX + (row % 2) * 14;
      const cy = seekZoneTop + 26 + row * spacingY;
      cat.currentX = cx;
      cat.currentY = cy;

      const isSeekingPhase = this.phase === "seeking";
      const headLook = isSeekingPhase
        ? Math.sin(this._clockSec * 3.5 + cat.phaseOffset) * 0.22
        : 0;

      // Gelombang radar di sekitar kucing Seeking saat fase Seeking aktif
      if (isSeekingPhase) {
        const waveR = 16 + ((this._clockSec * 22 + idx * 9) % 22);
        const alpha = 1 - (waveR - 16) / 22;
        ctx.beginPath();
        ctx.arc(cx - 10, cy - 10, waveR, Math.PI * 0.65, Math.PI * 1.35);
        ctx.strokeStyle = `rgba(234, 88, 12, ${alpha * 0.65})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      this._drawRealisticCat(ctx, {
        x: cx,
        y: cy,
        scale: 0.84,
        pose: "sitting",
        facing: -1, // Menghadap kiri (mengamati balok VM)
        headTilt: headLook,
        palette: cat.furPalette,
        isActiveRole: isSeekingPhase || this.phase === "heft",
        timeSec: this._clockSec + cat.phaseOffset,
      });
    });

    // Render Tracing Cats (Berlari dinamis menuju X_best & mengantar balok)
    const gamma = this.getCurrentGamma();
    const gammaScale = this.params.useInertia
      ? clamp(gamma / this.params.gammaMax, 0.25, 1)
      : 0.15;

    tracingCats.forEach((cat, idx) => {
      const baseRowY =
        traceZoneTop +
        34 +
        (idx / Math.max(1, tracingCats.length)) * (traceZoneH - 42);

      // Saat fase Tracing, kucing berlari maju-mundur secara dinamis menuju sisi target
      let sprintOffset = 0;
      if (this.phase === "tracing") {
        sprintOffset =
          Math.sin(this.phaseProgress * Math.PI) * (55 * gammaScale + 18);
      } else {
        sprintOffset = Math.sin(this._clockSec * 2 + cat.phaseOffset) * 6;
      }

      const cx = rect.x + 56 + idx * 44 + sprintOffset;
      const cy = baseRowY;
      cat.currentX = cx;
      cat.currentY = cy;

      const isTracingPhase = this.phase === "tracing";

      // Gambar Panah Vektor Kecepatan menuju X_best (panjang sebanding dengan γ)
      const arrowLen = (24 + 54 * gammaScale) * (isTracingPhase ? 1.15 : 0.65);
      const angleToLeader = Math.atan2(leaderY - cy, leaderX - cx);
      this._drawVelocityArrow(
        ctx,
        cx + 16,
        cy - 8,
        angleToLeader,
        arrowLen,
        isTracingPhase ? "#0d9488" : "rgba(13, 148, 136, 0.45)",
      );

      this._drawRealisticCat(ctx, {
        x: cx,
        y: cy,
        scale: 0.86,
        pose: isTracingPhase ? "running" : "crouching",
        facing: 1, // Menghadap kanan / mengejar X_best
        palette: cat.furPalette,
        isActiveRole: isTracingPhase,
        strideSpeed: isTracingPhase ? 12 : 3,
        timeSec: this._clockSec + cat.stridePhase,
      });
    });
  }

  /**
   * Merender elemen jembatan visual yang menghubungkan langsung perilaku kucing
   * di Arena Kanan dengan balok jadwal VM di Papan Kiri.
   */
  _renderBridgeInteractions(ctx, boardRect, arenaRect, boardAnchors) {
    const { bottleneckAnchor, targetGhostAnchor, flyingBlockState } =
      boardAnchors;

    // 1. Garis Pemindai Seeking (Dari Kucing Seeking #0 -> Balok Bottleneck -> Ghost Block)
    if (this.phase === "seeking" && bottleneckAnchor) {
      const leadSeeker = this.cats.find((c) => c.role === "seeking");
      if (leadSeeker && leadSeeker.currentX) {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = "rgba(234, 88, 12, 0.75)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(leadSeeker.currentX - 14, leadSeeker.currentY - 12);
        ctx.quadraticCurveTo(
          (leadSeeker.currentX + bottleneckAnchor.rightX) / 2,
          bottleneckAnchor.y - 24,
          bottleneckAnchor.rightX,
          bottleneckAnchor.y,
        );
        ctx.stroke();

        // Titik kunci target di balok bottleneck
        ctx.fillStyle = "#ea580c";
        ctx.beginPath();
        ctx.arc(bottleneckAnchor.rightX, bottleneckAnchor.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Panah melengkung di papan VM dari balok bottleneck ke Ghost Preview
        if (targetGhostAnchor) {
          ctx.strokeStyle = "#f97316";
          ctx.beginPath();
          ctx.moveTo(bottleneckAnchor.x, bottleneckAnchor.y);
          ctx.quadraticCurveTo(
            Math.max(bottleneckAnchor.x, targetGhostAnchor.x) + 24,
            (bottleneckAnchor.y + targetGhostAnchor.y) / 2,
            targetGhostAnchor.x,
            targetGhostAnchor.y,
          );
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 2. Balok Terbang & Tali Tarikan Kucing Tracing saat memindahkan task antar-VM
    if (this.phase === "tracing" && flyingBlockState) {
      const leadTracer = this.cats.find((c) => c.role === "tracing");

      // Garis energi tarikan dari kucing Tracing ke balok yang sedang dipindah
      if (leadTracer && leadTracer.currentX) {
        ctx.save();
        ctx.strokeStyle = "rgba(13, 148, 136, 0.75)";
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(leadTracer.currentX - 10, leadTracer.currentY - 8);
        ctx.quadraticCurveTo(
          (leadTracer.currentX + flyingBlockState.centerX) / 2,
          flyingBlockState.centerY - 26,
          flyingBlockState.centerX + flyingBlockState.w / 2,
          flyingBlockState.centerY,
        );
        ctx.stroke();
        ctx.restore();
      }

      // Render Balok Terbang dengan efek elevasi bayangan
      ctx.save();
      ctx.shadowColor = "rgba(13, 148, 136, 0.45)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      drawRoundedRect(
        ctx,
        flyingBlockState.x,
        flyingBlockState.y,
        flyingBlockState.w,
        flyingBlockState.h,
        4,
      );
      ctx.fillStyle = flyingBlockState.palette.fill;
      ctx.fill();
      ctx.strokeStyle = "#0f766e";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.shadowColor = "transparent";
      if (flyingBlockState.w >= 18) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9.5px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          flyingBlockState.label,
          flyingBlockState.centerX,
          flyingBlockState.centerY,
        );
      }
      ctx.restore();
    }
  }

  _renderStageFooter(ctx, W, y, H) {
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, y, W, H);

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();

    const items = [
      { color: "#f97316", label: "Kucing Seeking (Duduk Mengamati)" },
      { color: "#475569", label: "Kucing Tracing (Berlari Mengejar X_best)" },
      { color: "#d97706", label: "Pemimpin X_best ★" },
      { color: "#dc2626", label: "Batas Makespan (C_max)" },
    ];

    let cursorX = 14;
    const centerY = y + H / 2;
    ctx.font = "10.5px system-ui, -apple-system, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    for (const item of items) {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(cursorX + 5, centerY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#334155";
      ctx.fillText(item.label, cursorX + 14, centerY);
      cursorX += ctx.measureText(item.label).width + 28;
    }

    // Keterangan eksplisit metafora visual
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    ctx.fillText("Ilustrasi perilaku agen CSO", W - 12, centerY);
  }

  /**
   * Menggambar panah vektor kecepatan untuk kucing Tracing.
   */
  _drawVelocityArrow(ctx, x, y, angle, length, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, 0);
    ctx.stroke();

    // Kepala panah
    ctx.beginPath();
    ctx.moveTo(length + 5, 0);
    ctx.lineTo(length - 3, -3.5);
    ctx.lineTo(length - 3, 3.5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Menggambar anatomi kucing secara detail & ekspresif pada HTML5 Canvas:
   * - Pose 'sitting' (Seeking / Leader): Punggung melengkung, kaki depan rapat,
   *   ekor melingkar dengan ujung bergerak pelan.
   * - Pose 'running' / 'crouching' (Tracing): Badan memanjang dinamis,
   *   4 kaki bergerak dalam siklus langkah lari, ekor terentang lurus ke belakang.
   */
  _drawRealisticCat(ctx, opts) {
    const {
      x,
      y,
      scale = 1,
      pose = "sitting",
      facing = -1,
      headTilt = 0,
      palette,
      isLeader = false,
      isActiveRole = true,
      strideSpeed = 10,
      timeSec = 0,
    } = opts;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * facing, scale); // facing: 1 = kanan, -1 = kiri

    if (!isActiveRole) {
      ctx.globalAlpha = 0.62;
    }

    // 1. Bayangan Kontak Tanah (Ground Contact Shadow)
    const jumpLift =
      pose === "running" ? Math.abs(Math.sin(timeSec * strideSpeed)) * 4.5 : 0;
    ctx.fillStyle = "rgba(15, 23, 42, 0.14)";
    ctx.beginPath();
    ctx.ellipse(
      0,
      18,
      (pose === "running" ? 22 : 16) - jumpLift * 0.6,
      4.5,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.translate(0, -jumpLift);

    if (pose === "running" || pose === "crouching") {
      this._drawRunningCatBody(
        ctx,
        palette,
        timeSec,
        pose === "running" ? strideSpeed : 2.5,
      );
    } else {
      this._drawSittingCatBody(ctx, palette, timeSec);
    }

    // 2. Kepala Kucing Organik (Pipi Berbulu + Telinga Bézier + Wajah Detail)
    const headX = pose === "running" || pose === "crouching" ? 14 : 3;
    const headY = pose === "running" || pose === "crouching" ? -7 : -14;

    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(headTilt);
    this._drawCatHead(ctx, palette, pose === "running", isLeader, timeSec);
    ctx.restore();

    ctx.restore();
  }

  /**
   * Menggambar tubuh kucing dalam postur duduk waspada (Seeking Mode & Leader).
   */
  _drawSittingCatBody(ctx, palette, timeSec) {
    // Ekor melingkar di belakang dengan ujung bergerak pelan (tail-tip twitch)
    const tailWag = Math.sin(timeSec * 3.2) * 4;
    ctx.save();
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = 4.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-9, 12);
    ctx.bezierCurveTo(-22, 12, -25, -2, -18 + tailWag * 0.4, -9 + tailWag);
    ctx.stroke();

    // Ujung ekor berwarna cerah
    ctx.strokeStyle = palette.secondary;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-20 + tailWag * 0.25, -5 + tailWag * 0.6);
    ctx.lineTo(-18 + tailWag * 0.4, -9 + tailWag);
    ctx.stroke();
    ctx.restore();

    // Siluet punggung & pinggul melengkung duduk
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.moveTo(-11, 16);
    ctx.bezierCurveTo(-14, 4, -8, -8, 1, -8);
    ctx.bezierCurveTo(9, -8, 12, 4, 10, 16);
    ctx.closePath();
    ctx.fill();

    // Corak belang tabby halus di punggung
    ctx.strokeStyle = palette.stripe;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-9, 1);
    ctx.quadraticCurveTo(-5, 0, -3, 2);
    ctx.moveTo(-10, 6);
    ctx.quadraticCurveTo(-5, 5, -3, 7);
    ctx.stroke();

    // Dada berbulu cerah (chest ruff)
    ctx.fillStyle = palette.secondary;
    ctx.beginPath();
    ctx.ellipse(5, 2, 5.2, 8.5, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Dua kaki depan tegak & cakar membulat di depan
    ctx.fillStyle = palette.primary;
    drawRoundedRect(ctx, 1, 5, 4.5, 12, 2.2);
    ctx.fill();
    drawRoundedRect(ctx, 6.2, 5, 4.5, 12, 2.2);
    ctx.fill();

    // Telapak cakar putih/krem (paws)
    ctx.fillStyle = palette.secondary;
    ctx.beginPath();
    ctx.ellipse(3.3, 16.5, 3, 2, 0, 0, Math.PI * 2);
    ctx.ellipse(8.5, 16.5, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Menggambar tubuh kucing dalam postur berlari/menerkam dinamis (Tracing Mode).
   */
  _drawRunningCatBody(ctx, palette, timeSec, speed) {
    const stride = Math.sin(timeSec * speed);
    const counterStride = Math.sin(timeSec * speed + Math.PI);

    // Ekor terentang lurus ke belakang sebagai penyeimbang gerak lari
    const tailWave = Math.sin(timeSec * speed * 0.8) * 3.5;
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = 4.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-14, -2);
    ctx.quadraticCurveTo(-24, -7 + tailWave, -31, -4 - tailWave);
    ctx.stroke();

    // Kaki belakang & depan sisi jauh (bayangan lebih gelap)
    ctx.strokeStyle = palette.stripe;
    ctx.lineWidth = 3.8;
    ctx.lineCap = "round";
    // Kaki belakang jauh
    ctx.beginPath();
    ctx.moveTo(-10, 3);
    ctx.lineTo(-14 - counterStride * 6, 15);
    ctx.stroke();
    // Kaki depan jauh
    ctx.beginPath();
    ctx.moveTo(9, 2);
    ctx.lineTo(13 + counterStride * 6, 15);
    ctx.stroke();

    // Badan memanjang horizontal atletis
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.ellipse(0, -1, 15.5, 7.2, -0.08, 0, Math.PI * 2);
    ctx.fill();

    // Syal aksen kecepatan pada leher kucing Tracing
    ctx.fillStyle = "#0d9488";
    ctx.beginPath();
    ctx.ellipse(10, -4, 4.2, 6.2, 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Kaki belakang & depan sisi dekat (langkah lari aktif)
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = 4.2;
    // Kaki belakang dekat
    ctx.beginPath();
    ctx.moveTo(-10, 3);
    ctx.lineTo(-13 + stride * 7, 16);
    ctx.stroke();
    // Kaki depan dekat
    ctx.beginPath();
    ctx.moveTo(9, 2);
    ctx.lineTo(14 - stride * 7, 16);
    ctx.stroke();
  }

  /**
   * Menggambar kepala kucing dengan anatomi presisi:
   * daun telinga Bézier + pinna merah muda, pipi melebar, mata almond dengan pupil slit,
   * hidung segitiga terbalik, mulut "ω", tanda dahi "M", dan 3 pasang kumis.
   */
  _drawCatHead(ctx, palette, isFocusedSprint, isLeader, timeSec) {
    // 1. Daun Telinga Kiri & Kanan (Kurva Bézier organik, bukan segitiga kaku)
    const drawEar = (offsetX, tiltAngle) => {
      ctx.save();
      ctx.translate(offsetX, -8);
      ctx.rotate(tiltAngle);

      // Telinga luar
      ctx.fillStyle = palette.primary;
      ctx.beginPath();
      ctx.moveTo(-5, 3);
      ctx.bezierCurveTo(-5.5, -4, -2, -10, 0, -11);
      ctx.bezierCurveTo(2.5, -10, 5.5, -4, 5, 3);
      ctx.closePath();
      ctx.fill();

      // Bagian dalam telinga (pinna) merah muda lembut
      ctx.fillStyle = "#f4a6b8";
      ctx.beginPath();
      ctx.moveTo(-2.6, 1.5);
      ctx.bezierCurveTo(-2.8, -3, -1, -7, 0, -7.8);
      ctx.bezierCurveTo(1.2, -7, 2.8, -3, 2.6, 1.5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    drawEar(-5.5, isFocusedSprint ? -0.35 : -0.2);
    drawEar(5.5, isFocusedSprint ? 0.15 : 0.22);

    // 2. Kontur Kepala dengan Pipi Kucing yang Melebar (Cheek Fluff)
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.bezierCurveTo(8, -10, 12.5, -4, 12, 2);
    ctx.bezierCurveTo(11.5, 7.5, 6.5, 10, 0, 10);
    ctx.bezierCurveTo(-6.5, 10, -11.5, 7.5, -12, 2);
    ctx.bezierCurveTo(-12.5, -4, -8, -10, 0, -10);
    ctx.closePath();
    ctx.fill();

    // Area moncong & pipi bawah berwarna cerah
    ctx.fillStyle = palette.secondary;
    ctx.beginPath();
    ctx.ellipse(2.5, 4.5, 6.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Tanda Bulu Tabby Berbentuk Huruf "M" di Dahi
    ctx.strokeStyle = palette.stripe;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(-3.5, -5.5);
    ctx.lineTo(-2, -7.8);
    ctx.lineTo(0, -6);
    ctx.lineTo(2, -7.8);
    ctx.lineTo(3.5, -5.5);
    ctx.stroke();

    // 4. Mata Almond Khas Kucing + Pupil Vertikal (Slit Pupil) + Kilau Cahaya
    const drawCatEye = (ex, ey) => {
      ctx.save();
      ctx.translate(ex, ey);

      // Iris berbentuk almond miring
      ctx.fillStyle = palette.eye;
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.1, 2.3, -0.12, 0, Math.PI * 2);
      ctx.fill();

      // Pupil vertikal (menyempit tajam saat Tracing, sedikit melebar saat Seeking)
      const pupilW = isFocusedSprint ? 0.85 : 1.35;
      ctx.fillStyle = "#090d16";
      ctx.beginPath();
      ctx.ellipse(0.3, 0, pupilW, 2.0, 0, 0, Math.PI * 2);
      ctx.fill();

      // Titik kilau cahaya mata (specular highlight)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-0.8, -0.7, 0.75, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    drawCatEye(-1.5, -1.2);
    drawCatEye(6.2, -1.2);

    // 5. Hidung Segitiga Terbalik & Mulut Melengkung "ω"
    const noseX = 3.2;
    const noseY = 2.8;
    ctx.fillStyle = "#fb7185";
    ctx.beginPath();
    ctx.moveTo(noseX - 1.8, noseY - 1);
    ctx.lineTo(noseX + 1.8, noseY - 1);
    ctx.lineTo(noseX, noseY + 1.2);
    ctx.closePath();
    ctx.fill();

    // Garis mulut ganda "ω"
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(noseX, noseY + 1.2);
    ctx.quadraticCurveTo(noseX - 1.8, noseY + 3.4, noseX - 3.4, noseY + 2.2);
    ctx.moveTo(noseX, noseY + 1.2);
    ctx.quadraticCurveTo(noseX + 1.8, noseY + 3.4, noseX + 3.4, noseY + 2.2);
    ctx.stroke();

    // 6. Kumis (3 helai melengkung halus di sisi depan & belakang pipi)
    const whiskerTwitch = Math.sin(timeSec * 4.5) * 0.6;
    ctx.strokeStyle = "rgba(71, 85, 105, 0.65)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    // Kumis depan (kanan)
    ctx.moveTo(7.5, 3.0);
    ctx.quadraticCurveTo(13, 2.0 + whiskerTwitch, 16.5, 2.8 + whiskerTwitch);
    ctx.moveTo(7.5, 4.4);
    ctx.quadraticCurveTo(13, 4.5, 16.5, 5.5);
    // Kumis belakang (kiri)
    ctx.moveTo(-2.5, 3.2);
    ctx.quadraticCurveTo(-8.5, 2.2 - whiskerTwitch, -12.5, 3.0 - whiskerTwitch);
    ctx.moveTo(-2.5, 4.6);
    ctx.quadraticCurveTo(-8.5, 4.8, -12.5, 5.8);
    ctx.stroke();

    // 7. Mahkota Emas Kecil Khusus Kucing Pemimpin X_best
    if (isLeader) {
      ctx.fillStyle = "#facc15";
      ctx.strokeStyle = "#a16207";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-4, -10.5);
      ctx.lineTo(-5, -16);
      ctx.lineTo(-1.5, -13);
      ctx.lineTo(0, -17);
      ctx.lineTo(1.5, -13);
      ctx.lineTo(5, -16);
      ctx.lineTo(4, -10.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * this.width;
    const my = ((e.clientY - rect.top) / rect.height) * this.height;

    let hit = null;
    for (const item of this.renderedBlocks) {
      if (
        mx >= item.x &&
        mx <= item.x + item.w &&
        my >= item.y &&
        my <= item.y + item.h
      ) {
        hit = item;
        break;
      }
    }

    if (hit !== this.hoveredBlock) {
      this.hoveredBlock = hit;
      this.canvas.style.cursor = hit ? "pointer" : "default";
      if (this.onHoverBlock) {
        this.onHoverBlock(hit, e);
      }
      if (!this.isPlaying) {
        this.render();
      }
    }
  }

  _onMouseLeave() {
    if (this.hoveredBlock) {
      this.hoveredBlock = null;
      this.canvas.style.cursor = "default";
      if (this.onHoverBlock) {
        this.onHoverBlock(null, null);
      }
      if (!this.isPlaying) {
        this.render();
      }
    }
  }
}

if (typeof window !== "undefined") {
  window.CatSwarmRenderer = CatSwarmRenderer;
}

export default CatSwarmRenderer;
