/**
 * @module fitness
 * @description Evaluasi fitness penjadwalan task komputasi awan heterogen.
 * Sesuai kontrak data, nilai fitness adalah makespan (waktu penyelesaian komputasi terakhir).
 * Setiap pemanggilan fitness akan menambah hitungan pada evaluation counter (jika diberikan).
 */

/**
 * Menghitung nilai fitness (makespan) dari sebuah penugasan (assignment) task ke VM.
 * 
 * @param {Array<number|string>} assignment - Array di mana assignment[i] adalah id VM untuk tasks[i].
 * @param {Array<{ id: number|string, size: number }>} tasks - Daftar task.
 * @param {Array<{ id: number|string, speed: number, [key: string]: any }>} vms - Daftar VM.
 * @param {{ increment: Function, isExceeded?: Function } | null} [counter=null] - Evaluation budget counter opsional.
 * @returns {number} Nilai makespan sistem dalam satuan detik.
 */
export function fitness(assignment, tasks, vms, counter = null) {
  if (counter && typeof counter.increment === 'function') {
    counter.increment(1);
  }

  if (!tasks || tasks.length === 0) {
    return 0;
  }
  if (!vms || vms.length === 0) {
    throw new Error("Daftar VM tidak boleh kosong pada evaluasi fitness.");
  }

  // Petakan vm.id ke indeks array untuk lookup O(1) cepat
  const vmIndexMap = new Map();
  const numVms = vms.length;
  for (let j = 0; j < numVms; j++) {
    vmIndexMap.set(vms[j].id, j);
  }

  const vmFinishTimes = new Float64Array(numVms);
  const numTasks = tasks.length;

  for (let i = 0; i < numTasks; i++) {
    const targetVmId = assignment[i];
    const vmIdx = vmIndexMap.get(targetVmId);

    if (vmIdx === undefined) {
      throw new Error(`Task ${tasks[i]?.id ?? i} dialokasikan ke VM id '${targetVmId}' yang tidak terdaftar.`);
    }

    const execTime = tasks[i].size / vms[vmIdx].speed;
    vmFinishTimes[vmIdx] += execTime;
  }

  // Makespan = max(waktu selesai VM)
  let makespan = 0;
  for (let j = 0; j < numVms; j++) {
    if (vmFinishTimes[j] > makespan) {
      makespan = vmFinishTimes[j];
    }
  }

  return makespan;
}
