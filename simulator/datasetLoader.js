/**
 * @module datasetLoader
 * @description Pemuat dataset task dan definisi infrastruktur VM heterogen.
 * Bekerja fleksibel baik di lingkungan Node.js (membaca file lokal via fs)
 * maupun di lingkungan browser (via fetch HTTP).
 */

/**
 * Spesifikasi default 16 Virtual Machine heterogen sesuai lingkungan CloudSim 3-tier:
 * - 4 VM Compute-Intensive (id: 0..3)  : speed 2500 MIPS, tarif sewa 150 G$/s
 * - 6 VM Standard (id: 4..9)           : speed 1500 MIPS, tarif sewa 40 G$/s
 * - 6 VM Light-weight (id: 10..15)     : speed 800 MIPS,  tarif sewa 18 G$/s
 * 
 * @returns {Array<{ id: number, speed: number, type: string, costPerSec: number }>}
 */
export function getDefaultVms() {
  const vms = [];
  // 4 Compute-Intensive
  for (let i = 0; i < 4; i++) {
    vms.push({ id: i, speed: 2500.0, type: 'Compute-Intensive', costPerSec: 150.0 });
  }
  // 6 Standard
  for (let i = 4; i < 10; i++) {
    vms.push({ id: i, speed: 1500.0, type: 'Standard', costPerSec: 40.0 });
  }
  // 6 Light-weight
  for (let i = 10; i < 16; i++) {
    vms.push({ id: i, speed: 800.0, type: 'Light-weight', costPerSec: 18.0 });
  }
  return vms;
}

/**
 * Melakukan parsing teks dataset di mana setiap baris berisi angka ukuran task (MI).
 * 
 * @param {string} textContent 
 * @returns {Array<{ id: number, size: number }>}
 */
export function parseDatasetText(textContent) {
  if (!textContent || typeof textContent !== 'string') {
    return [];
  }

  const lines = textContent.split(/\r?\n/);
  const tasks = [];
  let taskId = 0;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const size = Number(trimmed);
    if (!Number.isNaN(size) && size > 0) {
      tasks.push({
        id: taskId++,
        size: Math.round(size)
      });
    }
  }

  return tasks;
}

/**
 * Memuat dataset task dan VM.
 * 
 * @param {string|{ name?: string, text?: string, url?: string, path?: string, count?: number }} options
 * @returns {Promise<{ tasks: Array<{ id: number, size: number }>, vms: Array<{ id: number, speed: number }> }>}
 */
export async function loadDataset(options = {}) {
  const vms = getDefaultVms();

  // Jika input berupa string nama file / dataset
  let target = typeof options === 'string' ? { name: options } : { ...options };

  // 1. Jika teks mentah langsung disediakan
  if (target.text) {
    const tasks = parseDatasetText(target.text);
    return { tasks, vms };
  }

  const datasetName = target.name || target.path || 'GoCJ_Dataset_100.txt';

  // 2. Deteksi lingkungan Node.js
  const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

  if (isNode) {
    const fs = await import('node:fs');
    const path = await import('node:path');

    // Coba beberapa kandidat path file (relatif ke workspace atau folder data)
    const candidates = [
      datasetName,
      path.resolve(process.cwd(), datasetName),
      path.resolve(process.cwd(), 'data', datasetName),
      path.resolve(process.cwd(), 'Hybrid', 'SOKA-Hybrid-HLWOA-HC-CSO', 'data', datasetName),
      path.resolve(process.cwd(), 'Metaheuristic', 'SOKA-metaheurictic', 'data', datasetName),
      path.resolve(process.cwd(), 'Metaheuristic', 'SOKA-metaheurictic', 'data', 'synthetic', datasetName)
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        const content = fs.readFileSync(cand, 'utf-8');
        const tasks = parseDatasetText(content);
        return { tasks, vms };
      }
    }
  }

  // 3. Deteksi lingkungan Browser (Fetch)
  if (typeof fetch === 'function') {
    const url = target.url || target.path || `data/${datasetName}`;
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const text = await resp.text();
        const tasks = parseDatasetText(text);
        return { tasks, vms };
      }
    } catch {
      // fetch gagal / CORS / offline, fallback ke fallback tasks
    }
  }

  // Fallback default: dataset 100 task deterministik berbasis distribusi GoCJ jika file tidak terakses
  const fallbackTasks = [];
  let seed = 42;
  function pseudoRng() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  const count = target.count || 100;
  for (let i = 0; i < count; i++) {
    // Ukuran acak antara 15.000 s/d 150.000 MI
    const size = Math.floor(15000 + pseudoRng() * 135000);
    fallbackTasks.push({ id: i, size });
  }

  return { tasks: fallbackTasks, vms };
}
