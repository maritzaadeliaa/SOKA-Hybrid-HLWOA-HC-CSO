/**
 * @module ganttChart
 * @description Komponen visualisasi Diagram Gantt alokasi Task ke Virtual Machine (VM).
 * 
 * Fitur:
 * - 1 baris per VM dengan indikasi tipe & kecepatan.
 * - Blok task interaktif proporsional dengan durasi eksekusinya.
 * - Garis vertikal penanda batas akhir Makespan sistem.
 * - Tooltip mengapung (Task ID, Size MI, Start Time, Finish Time, Duration, VM ID).
 * - Vanilla JS + SVG murni, responsif, dark mode native.
 */

// Palet warna estetik untuk task blocks
const TASK_COLORS = [
  '#0077b6', '#0096c7', '#00b4d8', '#48cae4',
  '#06d6a0', '#118ab2', '#ffd166', '#f77f00',
  '#ef476f', '#e63946', '#7209b7', '#3a0ca3',
  '#4cc9f0', '#2a9d8f', '#e76f51', '#8338ec'
];

/**
 * Merender diagram Gantt ke dalam kontainer elemen HTML.
 * 
 * @param {HTMLElement|string} container - Elemen pembungkus atau selector ID/class
 * @param {Object} props
 * @param {Object} props.schedule - { assignment: number[], makespan: number }
 * @param {Array<{ id: number|string, size: number }>} props.tasks - Daftar task
 * @param {Array<{ id: number|string, speed: number, type?: string }>} props.vms - Daftar VM
 * @param {Object} [props.options={}] - { title?: string, rowHeight?: number, labelWidth?: number }
 */
export function renderGanttChart(container, { schedule, tasks, vms, options = {} }) {
  const root = typeof container === 'string' ? document.querySelector(container) : container;
  if (!root) {
    console.error('Container Gantt Chart tidak ditemukan:', container);
    return;
  }

  root.innerHTML = '';
  root.classList.add('soka-gantt-container');

  const assignment = schedule.assignment;
  const makespan = schedule.makespan || 1;
  const numVms = vms.length;

  const rowHeight = options.rowHeight || 28;
  const rowGap = 6;
  const labelWidth = options.labelWidth || 130;
  const topPadding = 36;
  const bottomPadding = 30;
  const rightPadding = 40;

  // Siapkan data alokasi per VM
  const vmMap = new Map();
  for (let j = 0; j < numVms; j++) {
    vmMap.set(vms[j].id, {
      vm: vms[j],
      index: j,
      tasks: [],
      currentFinish: 0
    });
  }

  // Hitung waktu mulai dan selesai per task
  for (let i = 0; i < tasks.length; i++) {
    const vmId = assignment[i];
    const vmEntry = vmMap.get(vmId);
    if (!vmEntry) continue;

    const task = tasks[i];
    const execTime = task.size / vmEntry.vm.speed;
    const startTime = vmEntry.currentFinish;
    const finishTime = startTime + execTime;
    vmEntry.currentFinish = finishTime;

    vmEntry.tasks.push({
      task,
      startTime,
      finishTime,
      execTime,
      color: TASK_COLORS[task.id % TASK_COLORS.length]
    });
  }

  // Header dan Metadata
  const header = document.createElement('div');
  header.className = 'soka-gantt-header';
  header.innerHTML = `
    <div class="soka-gantt-title">
      <span>📊 ${options.title || 'Gantt Chart Penjadwalan Task ke VM'}</span>
    </div>
    <div class="soka-gantt-stats">
      Total Task: <b>${tasks.length}</b> | VM: <b>${numVms}</b> | Makespan: <b style="color:var(--gantt-primary-light,#48cae4)">${makespan.toFixed(2)}s</b>
    </div>
  `;
  root.appendChild(header);

  // SVG Wrapper
  const svgWrapper = document.createElement('div');
  svgWrapper.className = 'soka-gantt-svg-wrapper';
  root.appendChild(svgWrapper);

  // Tooltip Element
  let tooltip = document.querySelector('.soka-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'soka-tooltip';
    document.body.appendChild(tooltip);
  }

  // Dimensi SVG
  const contentWidth = 950;
  const chartWidth = contentWidth - labelWidth - rightPadding;
  const totalHeight = topPadding + numVms * (rowHeight + rowGap) + bottomPadding;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${contentWidth} ${totalHeight}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', 'auto');
  svg.style.display = 'block';

  // Grid Vertikal Waktu (Sumbu Waktu X)
  const numTicks = 8;
  for (let t = 0; t <= numTicks; t++) {
    const timeVal = (makespan / numTicks) * t;
    const xPos = labelWidth + (timeVal / makespan) * chartWidth;

    // Garis grid putus-putus
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', xPos);
    line.setAttribute('y1', topPadding - 10);
    line.setAttribute('x2', xPos);
    line.setAttribute('y2', totalHeight - bottomPadding);
    line.setAttribute('stroke', 'rgba(72, 202, 228, 0.12)');
    line.setAttribute('stroke-dasharray', '3,3');
    svg.appendChild(line);

    // Label detik
    const txt = document.createElementNS(svgNS, 'text');
    txt.setAttribute('x', xPos);
    txt.setAttribute('y', topPadding - 16);
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('fill', 'var(--gantt-text-muted, #8aaabe)');
    txt.setAttribute('font-size', '10px');
    txt.textContent = `${Math.round(timeVal)}s`;
    svg.appendChild(txt);
  }

  // Render Baris per VM
  for (let j = 0; j < numVms; j++) {
    const vm = vms[j];
    const vmEntry = vmMap.get(vm.id);
    const yPos = topPadding + j * (rowHeight + rowGap);

    // Background lintasan VM
    const rowBg = document.createElementNS(svgNS, 'rect');
    rowBg.setAttribute('x', labelWidth);
    rowBg.setAttribute('y', yPos);
    rowBg.setAttribute('width', chartWidth);
    rowBg.setAttribute('height', rowHeight);
    rowBg.setAttribute('rx', 4);
    rowBg.setAttribute('fill', j % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.15)');
    svg.appendChild(rowBg);

    // Label VM di sebelah kiri
    const vmLabel = document.createElementNS(svgNS, 'text');
    vmLabel.setAttribute('x', 6);
    vmLabel.setAttribute('y', yPos + rowHeight / 2 + 4);
    vmLabel.setAttribute('fill', 'var(--gantt-text, #e6f1f8)');
    vmLabel.setAttribute('font-size', '11px');
    vmLabel.setAttribute('font-weight', '600');
    const vmTypeShort = vm.type ? ` (${vm.type.split('-')[0]})` : '';
    vmLabel.textContent = `VM ${vm.id}${vmTypeShort} @${vm.speed}M`;
    svg.appendChild(vmLabel);

    // Render Balok-balok Task
    for (const item of vmEntry.tasks) {
      const blockX = labelWidth + (item.startTime / makespan) * chartWidth;
      const blockWidth = Math.max(2, (item.execTime / makespan) * chartWidth);

      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', blockX);
      rect.setAttribute('y', yPos + 2);
      rect.setAttribute('width', Math.max(1, blockWidth - 1)); // beri gap 1px
      rect.setAttribute('height', rowHeight - 4);
      rect.setAttribute('rx', 3);
      rect.setAttribute('fill', item.color);
      rect.setAttribute('opacity', '0.88');
      rect.style.cursor = 'pointer';
      rect.style.transition = 'opacity 0.15s, transform 0.15s';

      // Event Mouseover untuk Tooltip
      rect.addEventListener('mouseenter', e => {
        rect.setAttribute('opacity', '1.0');
        tooltip.innerHTML = `
          <div class="soka-tooltip-title">Task T${item.task.id}</div>
          <div>Ukuran: <b>${item.task.size.toLocaleString()} MI</b></div>
          <div>Mulai: <b>${item.startTime.toFixed(2)}s</b> | Selesai: <b>${item.finishTime.toFixed(2)}s</b></div>
          <div>Durasi Eksekusi: <b>${item.execTime.toFixed(2)}s</b></div>
          <div>Alokasi: <b>VM ${vm.id}</b> (${vm.speed} MIPS)</div>
        `;
        tooltip.style.display = 'block';
      });

      rect.addEventListener('mousemove', e => {
        tooltip.style.left = `${e.clientX + 14}px`;
        tooltip.style.top = `${e.clientY + 14}px`;
      });

      rect.addEventListener('mouseleave', () => {
        rect.setAttribute('opacity', '0.88');
        tooltip.style.display = 'none';
      });

      svg.appendChild(rect);

      // Label teks Task ID jika balok cukup lebar
      if (blockWidth > 26) {
        const tText = document.createElementNS(svgNS, 'text');
        tText.setAttribute('x', blockX + blockWidth / 2);
        tText.setAttribute('y', yPos + rowHeight / 2 + 3);
        tText.setAttribute('text-anchor', 'middle');
        tText.setAttribute('fill', '#ffffff');
        tText.setAttribute('font-size', '9px');
        tText.setAttribute('font-weight', 'bold');
        tText.setAttribute('pointer-events', 'none');
        tText.textContent = `T${item.task.id}`;
        svg.appendChild(tText);
      }
    }
  }

  // Garis Makespan Vertikal (Garis Merah Penanda Waktu Selesai Sistem)
  const makespanX = labelWidth + chartWidth;
  const makespanLine = document.createElementNS(svgNS, 'line');
  makespanLine.setAttribute('x1', makespanX);
  makespanLine.setAttribute('y1', topPadding - 8);
  makespanLine.setAttribute('x2', makespanX);
  makespanLine.setAttribute('y2', totalHeight - bottomPadding + 4);
  makespanLine.setAttribute('stroke', 'var(--gantt-danger, #ef476f)');
  makespanLine.setAttribute('stroke-width', '2');
  makespanLine.setAttribute('stroke-dasharray', '4,2');
  svg.appendChild(makespanLine);

  const makespanBadge = document.createElementNS(svgNS, 'text');
  makespanBadge.setAttribute('x', makespanX);
  makespanBadge.setAttribute('y', totalHeight - bottomPadding + 18);
  makespanBadge.setAttribute('text-anchor', 'middle');
  makespanBadge.setAttribute('fill', 'var(--gantt-danger, #ef476f)');
  makespanBadge.setAttribute('font-size', '10px');
  makespanBadge.setAttribute('font-weight', 'bold');
  makespanBadge.textContent = `Makespan: ${makespan.toFixed(2)}s`;
  svg.appendChild(makespanBadge);

  svgWrapper.appendChild(svg);
}
