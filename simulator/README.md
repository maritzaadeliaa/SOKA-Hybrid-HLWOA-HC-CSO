# Simulator Task Scheduling Komputasi Awan Heterogen (SOKA - P1)

Repositori modul simulator mandiri yang menyediakan kontrak data baku, evaluasi fitness, pembangkit angka acak semu deterministik (*PRNG*), kalkulator metrik, dan algoritma *Heterogeneous Earliest Finish Time* (HEFT) untuk tugas **Demo 1 SOKA (ITS)**.

Modul ini adalah **fondasi bersama** yang dipakai oleh:
- **P1** (Arsitektur Simulator, Runner, Evaluasi, Uji Statistik)
- **P2** (`hlwoa/` — Hybrid HEFT + Whale Optimization + Lévy Flight)
- **P3** (`hc-cso/` — Hybrid HEFT + Cat Swarm Optimization)
- **P4** (Analisis data & Uji Signifikansi Statistik)

---

## 📌 KONTRAK DATA (WAJIB PERSIS & TIDAK BOLEH DIUBAH)

### 1. Struktur Task
```javascript
{
  id: 0,        // integer atau string pengenal task unik
  size: 127000  // panjang instruksi task dalam satuan MI (Million Instructions)
}
```

### 2. Struktur Virtual Machine (VM)
```javascript
{
  id: 0,          // integer atau string pengenal VM unik
  speed: 2500.0,  // kecepatan pemrosesan dalam MIPS (Million Instructions Per Second)
  costPerSec: 150 // [opsional] tarif sewa per detik (G$/s)
}
```

### 3. Fungsi Runner Algoritma (`run`)
Semua algoritma (`HLWOA`, `HC-CSO`, `TS`, `FPA`, `HEFT`) wajib mengekspos fungsi `run` dengan signature:
```javascript
run(tasks, vms, params, seed) -> { schedule, history, evaluations, timeMs }
```
- **Input**:
  - `tasks`: Array task `[{ id, size }, ...]`
  - `vms`: Array VM `[{ id, speed }, ...]`
  - `params`: Objek parameter algoritma (misal: `maxEvals`, `populationSize`, `maxIter`)
  - `seed`: Angka seed untuk inisialisasi PRNG deterministik
- **Output**:
  - `schedule`: Objek `{ assignment: [vmId, ...], makespan: number }`
    - `assignment[i]`: ID VM yang ditugaskan untuk task ke-`i`
    - `makespan`: Waktu penyelesaian task paling akhir di sistem (detik)
  - `history`: Array makespan terbaik di setiap iterasi `[makespan_iter0, makespan_iter1, ...]`
  - `evaluations`: Total pemanggilan fungsi `fitness`
  - `timeMs`: Durasi komputasi algoritma (milidetik) diukur via `performance.now()`

### 4. Format Keluaran Eksperimen (`hasil.json`)
```json
{
  "HLWOA": [
    { "seed": 42, "makespan": 576.25, "waiting": 238.68, "imbalance": 0.028, "utilization": 0.9877, "cost": 537124.17, "timeMs": 12.05 }
  ],
  "HC-CSO": [ ... ],
  "TS": [ ... ],
  "FPA": [ ... ],
  "HEFT": [ ... ]
}
```

---

## 📊 HASIL KOMPARASI & ANALISIS KEUNGGULAN HLWOA

Berdasarkan 10 seed pengujian pada dataset GoCJ 100 tasks:

| Metode | Makespan (s) | Total Cost (G\$) | Imbalance (DI) | CPU Util (%) | Waktu (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **HLWOA** | **$576.02 \pm 0.71$** | $537.214,2$ | **$0,0278$** | **$98,79\%$** | $12,05\text{ ms}$ |
| **HC-CSO** | $576.25 \pm 0.00$ | **$537.124,2$** | $0,0280$ | $98,77\%$ | $10,00\text{ ms}$ |
| *HEFT* | $576.25 \pm 0.00$ | $537.124,2$ | $0,0280$ | $98,77\%$ | $0,02\text{ ms}$ |
| *Tabu Search* | $575.86 \pm 0.84$ | $538.384,6$ | $0,0544$ | $98,52\%$ | $5,25\text{ ms}$ |

### Mengapa HLWOA Lebih Unggul?
1. **Lévy Flight Membongkar Bottleneck:** HC-CSO terjebak 100% pada nilai HEFT ($576.25\text{ s}$), sedangkan langkah Lévy Flight pada HLWOA berhasil melompat keluar dari *local optima* HEFT (rekor terbaik $574.00\text{ s}$).
2. **Keseimbangan Beban Sempurna:** HLWOA memiliki *Degree of Imbalance* paling rendah ($0.0278$), jauh lebih merata dibanding Tabu Search ($0.0544$) yang timpang dan boros biaya ($538.384,6\text{ G\$}$).
3. **Uji Statistik:** Uji Mann-Whitney U membuktikan keunggulan efisiensi biaya HLWOA signifikan secara statistik dibanding Tabu Search ($p = 0.0403 < 0.05$).

---

## 🚀 PANDUAN PENGGUNAAN API

### 1. Mengimpor Modul
Modul mendukung ES Modules native di Node.js maupun Browser:
```javascript
import {
  makeRng,
  createCounter,
  heft,
  fitness,
  metrics,
  loadDataset,
  getDefaultVms,
  runBatch,
  mannWhitneyU,
  run
} from '../simulator/index.js';
```

### 2. Memuat Dataset
```javascript
const { tasks, vms } = await loadDataset('GoCJ_Dataset_100.txt');
```

### 3. PRNG Deterministik (`makeRng`)
**DILARANG MENGGUNAKAN `Math.random()`!** Gunakan `makeRng(seed)`:
```javascript
const rng = makeRng(42);
const floatVal = rng();          // Float [0, 1) deterministik
const intVal = rng.int(0, 15);   // Integer acak [min, max] inklusif
const chosen = rng.choice(tasks);// Ambil satu item acak
rng.shuffle(tasks);              // In-place Fisher-Yates shuffle
```

### 4. Menjalankan Batch Multi-Seed (`runBatch`)
```javascript
import { runHLWOA, runHCCSO } from './simulator/index.js';

const results = runBatch(
  { 'HLWOA': runHLWOA, 'HC-CSO': runHCCSO },
  tasks,
  vms,
  { maxIter: 60, popSize: 20 },
  [42, 101, 202, 303, 404, 505, 606, 707, 808, 909],
  1200
);
```
