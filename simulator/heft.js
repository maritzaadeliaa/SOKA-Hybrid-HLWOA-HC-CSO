/**
 * @module heft
 * @description Algoritma Heuristik Heterogeneous Earliest Finish Time (HEFT)
 * yang diadaptasi untuk task independen (tanpa graf dependensi DAG).
 * 
 * Prinsip:
 * 1. Urutkan task dari ukuran terbesar (size descending).
 * 2. Tempatkan tiap task ke VM yang menghasilkan Earliest Finish Time (EFT).
 *    Waktu eksekusi task pada suatu VM = task.size / vm.speed.
 */

/**
 * Menjalankan penjadwalan deterministik HEFT untuk task independen.
 * 
 * @param {Array<{ id: number|string, size: number }>} tasks - Daftar task dengan ukuran instruksi (MI).
 * @param {Array<{ id: number|string, speed: number, [key: string]: any }>} vms - Daftar VM heterogen.
 * @returns {{ assignment: number[], makespan: number }}
 *          assignment[i] = id VM untuk tasks[i]; makespan = waktu selesai komputasi sistem.
 */
export function heft(tasks, vms) {
  if (!tasks || tasks.length === 0) {
    return { assignment: [], makespan: 0 };
  }
  if (!vms || vms.length === 0) {
    throw new Error("Daftar VM tidak boleh kosong pada penjadwalan HEFT.");
  }

  const numTasks = tasks.length;
  const numVms = vms.length;

  // Lacak akumulasi waktu selesai untuk tiap VM (indeks 0..numVms - 1)
  const vmFinishTimes = new Float64Array(numVms);

  // Buat array index task yang diurutkan menurun berdasarkan ukuran (size terbesar dahulu)
  const taskIndices = new Int32Array(numTasks);
  for (let i = 0; i < numTasks; i++) {
    taskIndices[i] = i;
  }

  // Stable descending sort berdasarkan task.size
  taskIndices.sort((a, b) => {
    const diff = tasks[b].size - tasks[a].size;
    return diff !== 0 ? diff : a - b;
  });

  const assignment = new Array(numTasks);

  // Alokasi greedy Earliest Finish Time
  for (let k = 0; k < numTasks; k++) {
    const taskIdx = taskIndices[k];
    const taskSize = tasks[taskIdx].size;

    let bestVmIndex = 0;
    let earliestFinish = Infinity;

    for (let j = 0; j < numVms; j++) {
      const execTime = taskSize / vms[j].speed;
      const finishTime = vmFinishTimes[j] + execTime;

      if (finishTime < earliestFinish) {
        earliestFinish = finishTime;
        bestVmIndex = j;
      }
    }

    // Tempatkan task ke VM terbaik
    assignment[taskIdx] = vms[bestVmIndex].id;
    vmFinishTimes[bestVmIndex] = earliestFinish;
  }

  // Hitung makespan akhir (waktu selesai maksimum di antara seluruh VM)
  let makespan = 0;
  for (let j = 0; j < numVms; j++) {
    if (vmFinishTimes[j] > makespan) {
      makespan = vmFinishTimes[j];
    }
  }

  return {
    assignment,
    makespan
  };
}
