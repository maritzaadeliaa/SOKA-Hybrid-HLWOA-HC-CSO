/**
 * @module convergenceChart
 * @description Komponen visualisasi Grafik Konvergensi Optimasi Multi-Seri.
 * 
 * Fitur:
 * - Menampilkan banyak kurva seri sekaligus (HLWOA, HC-CSO, HEFT, TS, FPA).
 * - Toggle sumbu Linear atau Logaritmik (Log-Scale).
 * - Legend interaktif (klik untuk show/hide seri).
 * - Tooltip crosshair saat hover melintasi titik iterasi.
 * - Vanilla JS + SVG responsif dan dark-mode native.
 */

// Warna resmi tiap algoritma
const ALGO_COLORS = {
  'HLWOA': '#48cae4',    // Cyan terang (Paus)
  'HC-CSO': '#ffd166',   // Kuning keemasan (Kucing)
  'HEFT': '#8aaabe',     // Abu-abu terang (Baseline heuristik)
  'TS': '#06d6a0',       // Hijau emerald
  'FPA': '#ef476f'       // Merah magenta
};

/**
 * Merender grafik konvergensi multi-seri ke dalam kontainer elemen HTML.
 * 
 * @param {HTMLElement|string} container - Elemen pembungkus atau selector ID/class
 * @param {Record<string, number[]>} seriesMap - Kamus nama algoritma ke array history makespan
 * @param {Object} [options={}] - { scale?: 'linear'|'log', title?: string, height?: number }
 */
export function renderConvergenceChart(container, seriesMap, options = {}) {
  const root = typeof container === 'string' ? document.querySelector(container) : container;
  if (!root) {
    console.error('Container Convergence Chart tidak ditemukan:', container);
    return;
  }

  root.innerHTML = '';
  root.classList.add('soka-conv-container');

  let currentScale = options.scale || 'linear'; // 'linear' | 'log'
  const activeSeries = new Set(Object.keys(seriesMap));

  // Bangun Header dan Kontrol Toggle
  const header = document.createElement('div');
  header.className = 'soka-conv-header';
  header.innerHTML = `
    <div class="soka-conv-title">
      <span>📈 ${options.title || 'Kurva Konvergensi Makespan (Iterasi)'}</span>
    </div>
    <div class="soka-conv-controls">
      <span style="font-size:0.8rem;color:var(--gantt-text-muted,#8aaabe)">Skala Sumbu Y:</span>
      <button class="soka-btn-toggle ${currentScale === 'linear' ? 'active' : ''}" data-scale="linear">Linear</button>
      <button class="soka-btn-toggle ${currentScale === 'log' ? 'active' : ''}" data-scale="log">Log10</button>
    </div>
  `;
  root.appendChild(header);

  // SVG Chart Wrapper
  const chartWrapper = document.createElement('div');
  chartWrapper.className = 'soka-conv-svg-wrapper';
  root.appendChild(chartWrapper);

  // Legend Wrapper
  const legendWrapper = document.createElement('div');
  legendWrapper.className = 'soka-legend';
  root.appendChild(legendWrapper);

  // Tooltip Element
  let tooltip = document.querySelector('.soka-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'soka-tooltip';
    document.body.appendChild(tooltip);
  }

  // Event listener tombol skala
  const toggleBtns = header.querySelectorAll('.soka-btn-toggle');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentScale = btn.getAttribute('data-scale');
      drawChart();
    });
  });

  // Fungsi Gambar Grafik SVG
  function drawChart() {
    chartWrapper.innerHTML = '';
    legendWrapper.innerHTML = '';

    // Hitung panjang iterasi maksimum di antara seri yang aktif
    let maxIters = 0;
    let globalMinVal = Infinity;
    let globalMaxVal = -Infinity;

    for (const [name, hist] of Object.entries(seriesMap)) {
      if (!activeSeries.has(name) || !Array.isArray(hist) || hist.length === 0) continue;
      if (hist.length > maxIters) maxIters = hist.length;

      for (const v of hist) {
        if (v < globalMinVal) globalMinVal = v;
        if (v > globalMaxVal) globalMaxVal = v;
      }
    }

    if (maxIters <= 1) maxIters = 2;
    if (globalMinVal === Infinity) {
      globalMinVal = 100;
      globalMaxVal = 1000;
    }

    // Beri margin padding nilai sumbu Y
    const yMargin = (globalMaxVal - globalMinVal) * 0.08 || 10;
    const yMin = Math.max(0.1, globalMinVal - yMargin);
    const yMax = globalMaxVal + yMargin;

    const width = 850;
    const height = options.height || 320;
    const padding = { top: 25, right: 30, bottom: 40, left: 65 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', 'auto');
    svg.style.display = 'block';

    // Fungsi Proyeksi Koordinat
    function projectX(iterIdx) {
      return padding.left + (iterIdx / (maxIters - 1)) * chartW;
    }

    function projectY(val) {
      if (currentScale === 'log') {
        const logMin = Math.log10(yMin);
        const logMax = Math.log10(yMax);
        const logVal = Math.log10(Math.max(yMin, val));
        const ratio = (logVal - logMin) / (logMax - logMin || 1);
        return padding.top + (1 - ratio) * chartH;
      } else {
        const ratio = (val - yMin) / (yMax - yMin || 1);
        return padding.top + (1 - ratio) * chartH;
      }
    }

    // Grid Horizontal Sumbu Y
    const yTicks = 6;
    for (let t = 0; t <= yTicks; t++) {
      let tickVal;
      let yPos;

      if (currentScale === 'log') {
        const logMin = Math.log10(yMin);
        const logMax = Math.log10(yMax);
        const logVal = logMin + (t / yTicks) * (logMax - logMin);
        tickVal = Math.pow(10, logVal);
        yPos = padding.top + (1 - (t / yTicks)) * chartH;
      } else {
        tickVal = yMin + (t / yTicks) * (yMax - yMin);
        yPos = padding.top + (1 - (t / yTicks)) * chartH;
      }

      // Garis grid horizontal
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', padding.left);
      line.setAttribute('y1', yPos);
      line.setAttribute('x2', padding.left + chartW);
      line.setAttribute('y2', yPos);
      line.setAttribute('stroke', 'rgba(72, 202, 228, 0.12)');
      line.setAttribute('stroke-dasharray', '3,3');
      svg.appendChild(line);

      // Label teks sumbu Y
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', padding.left - 8);
      label.setAttribute('y', yPos + 3);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('fill', 'var(--gantt-text-muted, #8aaabe)');
      label.setAttribute('font-size', '10px');
      label.textContent = tickVal.toFixed(1);
      svg.appendChild(label);
    }

    // Grid Vertikal Sumbu X (Iterasi)
    const xTicks = Math.min(10, maxIters);
    for (let i = 0; i < xTicks; i++) {
      const iterIdx = Math.round((i / (xTicks - 1)) * (maxIters - 1));
      const xPos = projectX(iterIdx);

      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', xPos);
      label.setAttribute('y', height - padding.bottom + 18);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', 'var(--gantt-text-muted, #8aaabe)');
      label.setAttribute('font-size', '10px');
      label.textContent = `Iter ${iterIdx}`;
      svg.appendChild(label);
    }

    // Gambar Garis Kurva untuk Tiap Seri
    for (const [name, hist] of Object.entries(seriesMap)) {
      if (!activeSeries.has(name) || !Array.isArray(hist) || hist.length === 0) continue;

      const color = ALGO_COLORS[name] || '#ffffff';
      let pathData = '';

      for (let i = 0; i < hist.length; i++) {
        const x = projectX(i);
        const y = projectY(hist[i]);
        pathData += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
      }

      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', name === 'HLWOA' || name === 'HC-CSO' ? '2.8' : '1.8');
      if (name === 'HEFT') {
        path.setAttribute('stroke-dasharray', '5,3');
      }
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);

      // Titik akhir (dot)
      const lastIdx = hist.length - 1;
      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', projectX(lastIdx));
      dot.setAttribute('cy', projectY(hist[lastIdx]));
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', color);
      svg.appendChild(dot);
    }

    // Interaktivitas Crosshair Hover
    const crosshair = document.createElementNS(svgNS, 'line');
    crosshair.setAttribute('stroke', 'rgba(255, 255, 255, 0.4)');
    crosshair.setAttribute('stroke-width', '1');
    crosshair.setAttribute('stroke-dasharray', '3,3');
    crosshair.style.display = 'none';
    svg.appendChild(crosshair);

    const overlay = document.createElementNS(svgNS, 'rect');
    overlay.setAttribute('x', padding.left);
    overlay.setAttribute('y', padding.top);
    overlay.setAttribute('width', chartW);
    overlay.setAttribute('height', chartH);
    overlay.setAttribute('fill', 'transparent');
    overlay.style.cursor = 'crosshair';

    overlay.addEventListener('mousemove', e => {
      const rect = svg.getBoundingClientRect();
      const scaleX = width / rect.width;
      const mouseX = (e.clientX - rect.left) * scaleX;

      const boundedX = Math.max(padding.left, Math.min(padding.left + chartW, mouseX));
      const ratio = (boundedX - padding.left) / chartW;
      const targetIter = Math.round(ratio * (maxIters - 1));

      const lineX = projectX(targetIter);
      crosshair.setAttribute('x1', lineX);
      crosshair.setAttribute('y1', padding.top);
      crosshair.setAttribute('x2', lineX);
      crosshair.setAttribute('y2', padding.top + chartH);
      crosshair.style.display = 'block';

      // Buat isi tooltip
      let ttContent = `<div class="soka-tooltip-title">Iterasi ke-${targetIter}</div>`;
      for (const [name, hist] of Object.entries(seriesMap)) {
        if (!activeSeries.has(name)) continue;
        const val = hist[Math.min(targetIter, hist.length - 1)];
        const color = ALGO_COLORS[name] || '#fff';
        ttContent += `<div style="display:flex;justify-content:space-between;gap:12px">
          <span style="color:${color}">■ ${name}:</span>
          <b>${val ? val.toFixed(2) : '-'}s</b>
        </div>`;
      }

      tooltip.innerHTML = ttContent;
      tooltip.style.left = `${e.clientX + 14}px`;
      tooltip.style.top = `${e.clientY + 14}px`;
      tooltip.style.display = 'block';
    });

    overlay.addEventListener('mouseleave', () => {
      crosshair.style.display = 'none';
      tooltip.style.display = 'none';
    });

    svg.appendChild(overlay);
    chartWrapper.appendChild(svg);

    // Bangun Legend Interaktif
    for (const [name, hist] of Object.entries(seriesMap)) {
      const item = document.createElement('div');
      item.className = `soka-legend-item ${activeSeries.has(name) ? '' : 'hidden'}`;
      const color = ALGO_COLORS[name] || '#ffffff';
      item.innerHTML = `
        <span class="soka-legend-color" style="background:${color}"></span>
        <span>${name}</span>
      `;

      item.addEventListener('click', () => {
        if (activeSeries.has(name)) {
          if (activeSeries.size > 1) activeSeries.delete(name);
        } else {
          activeSeries.add(name);
        }
        drawChart();
      });

      legendWrapper.appendChild(item);
    }
  }

  // Gambar pertama kali
  drawChart();
}
