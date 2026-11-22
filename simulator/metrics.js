/**
 * @module metrics
 * @description Kalkulator metrik evaluasi penjadwalan cloud heterogen standar.
 * Menghitung 5 metrik utama sesuai kontrak:
 * - makespan: waktu penyelesaian task paling akhir di seluruh sistem (detik)
 * - waiting: rata-rata waktu mulai / waktu tunggu task dalam antrean VM (detik)
 * - imbalance: Degree of Imbalance (DI) pemerataan beban kerja antar-VM
 * - utilization: rata-rata pemanfaatan sumber daya komputasi aktif CPU
 * - cost: total biaya sewa VM sesuai tarif waktu sewa CloudSim / harga sewa per detik
 */

/**
 * Menghitung metrik performa penjadwalan untuk suatu assignment task ke VM.
 * 
 * @param {Array<number|string>} assignment - Array penugasan task ke VM id.
 * @param {Array<{ id: number|string, size: number }>} tasks - Array task.
 * @param {Array<{ id: number|string, speed: number, costPerSec?: number }>} vms - Array VM.
 * @returns {{
 *   makespan: number,
 *   waiting: number,
 *   imbalance: number,
 *   utilization: number,
 *   cost: number
 * }}
 */
export function metrics(assignment, tasks, vms) {
  if (!tasks || tasks.length === 0) {
    return { makespan: 0, waiting: 0, imbalance: 0, utilization: 0, cost: 0 };
  }
  if (!vms || vms.length === 0) {
    throw new Error("Daftar VM tidak boleh kosong pada perhitungan metrik.");
  }

  const numTasks = tasks.length;
  const numVms = vms.length;

  const vmIndexMap = new Map();
  for (let j = 0; j < numVms; j++) {
    vmIndexMap.set(vms[j].id, j);
  }

  // Lacak akumulasi waktu selesai per VM
  const vmFinishTimes = new Float64Array(numVms);
  // Lacak waktu mulai tiap task untuk menghitung rata-rata waiting time
  let totalStartTime = 0;
  let totalCpuBusyTime = 0;

  for (let i = 0; i < numTasks; i++) {
    const targetVmId = assignment[i];
    const vmIdx = vmIndexMap.get(targetVmId);

    if (vmIdx === undefined) {
      throw new Error(`Task ${tasks[i]?.id ?? i} dialokasikan ke VM id '${targetVmId}' yang tidak valid.`);
    }

    const currentVmFinish = vmFinishTimes[vmIdx];
    // Task mulai saat task sebelumnya pada VM yang sama selesai
    totalStartTime += currentVmFinish;

    const execTime = tasks[i].size / vms[vmIdx].speed;
    totalCpuBusyTime += execTime;
    vmFinishTimes[vmIdx] = currentVmFinish + execTime;
  }

  // 1. Makespan
  let makespan = 0;
  let tMin = Infinity;
  let sumFinish = 0;

  for (let j = 0; j < numVms; j++) {
    const fin = vmFinishTimes[j];
    sumFinish += fin;
    if (fin > makespan) makespan = fin;
    if (fin < tMin) tMin = fin;
  }

  // 2. Waiting (Rata-rata waktu mulai task)
  const waiting = numTasks > 0 ? totalStartTime / numTasks : 0;

  // 3. Degree of Imbalance (DI) = (Tmax - Tmin) / Tavg
  const tAvg = sumFinish / numVms;
  const imbalance = tAvg > 0 ? (makespan - tMin) / tAvg : 0;

  // 4. Resource Utilization = Total Busy Time / (Makespan * Jumlah VM)
  const theoreticalCapacity = makespan * numVms;
  const utilization = theoreticalCapacity > 0 ? (totalCpuBusyTime / theoreticalCapacity) : 0;

  // 5. Total Cost: Sum(finish_time_j * tarif_j)
  // Tarif default diambil dari vms[j].costPerSec atau model 3-tier CloudSim sumber:
  // - VM Compute (speed >= 2500): 150.0 G$/s
  // - VM Standard (1500 <= speed < 2500): 40.0 G$/s
  // - VM Light-weight (speed < 1500): 18.0 G$/s
  let cost = 0;
  for (let j = 0; j < numVms; j++) {
    let rate = vms[j].costPerSec;
    if (rate === undefined || rate === null) {
      const spd = vms[j].speed;
      if (spd >= 2500) {
        rate = 150.0;
      } else if (spd >= 1500) {
        rate = 40.0;
      } else {
        rate = 18.0;
      }
    }
    cost += vmFinishTimes[j] * rate;
  }

  return {
    makespan,
    waiting,
    imbalance,
    utilization,
    cost
  };
}
