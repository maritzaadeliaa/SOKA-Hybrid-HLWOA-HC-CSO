# SOKA — Hybrid Task Scheduling: HLWOA vs HC-CSO

Proyek komparasi performa algoritma penjadwalan tugas komputasi awan heterogen (_Heterogeneous Cloud Task Scheduling_) untuk tugas **Demo 1 SOKA (Teknik Informatika / Sistem Informasi ITS)**.

Proyek ini membandingkan dua pendekatan metaheuristik hibrida mutakhir:

1. **HLWOA**: _Hybrid HEFT + Whale Optimization Algorithm + Lévy Flight_
2. **HC-CSO**: _Hybrid HEFT + Cat Swarm Optimization (Seeking & Tracing Modes)_

terhadap algoritma heuristik dasar **HEFT** (_Heterogeneous Earliest Finish Time_) dan metaheuristik klasik **Tabu Search (TS)** serta **Flower Pollination Algorithm (FPA)**.

---

## 👥 Anggota Kelompok & Pembagian Peran

- **P1 (Arsitektur & Simulator)**: Kontrak data baku, engine simulasi, PRNG Mulberry32, metrik evaluasi, runner batch skala penuh, uji statistik Mann-Whitney U, dan komponen visualisasi web.
- **P2 (HLWOA)**: Visualisasi interaktif dan pengembangan hybrid Whale Optimization + Lévy Flight (`hlwoa/`).
- **P3 (HC-CSO)**: Visualisasi interaktif dan pengembangan hybrid Cat Swarm Optimization (`hc-cso/`).
- **P4 (Analisis & Evaluasi)**: Pengujian statistik inferensial, analisis data komparatif, ablation pada runner, halaman perbandingan (`perbandingan/`), dan penyusunan laporan.

---

## 📊 Hasil Komparasi Lintas Seluruh Dataset (20 Dataset x 5 Metode x 10 Seeds = 1.000 Runs)

Pengujian komparasi skala penuh dijalankan pada **seluruh 20 dataset** (10 variasi GoCJ nyata 100 s/d 1000 task dan 10 variasi Sintetik 100 s/d 1000 task) dengan **10 seed deterministik** di bawah batasan komputasi setara (**1.200 evaluasi fitness**).

### 1. Tabel Rata-rata Makespan (Detik) pada Seluruh Dataset

| Kategori     | Dataset        | Jumlah Task |  HEFT (s)  | HLWOA (s)  |  HC-CSO (s)  | Tabu Search (s) |    FPA (s)     |
| :----------- | :------------- | :---------: | :--------: | :--------: | :----------: | :-------------: | :------------: |
| **GoCJ**     | GoCJ_100       |     100     |  $576,25$  |  $576,25$  | **$574,87$** |    $575,86$     |    $575,36$    |
| **GoCJ**     | GoCJ_200       |     200     | $1.151,00$ | $1.151,00$ |  $1.148,14$  |   $1.148,94$    | **$1.147,12$** |
| **GoCJ**     | GoCJ_300       |     300     | $1.750,00$ | $1.750,00$ |  $1.749,56$  |   $1.749,56$    | **$1.748,70$** |
| **GoCJ**     | GoCJ_400       |     400     | $2.186,20$ | $2.186,20$ |  $2.185,68$  | **$2.185,30$**  |   $2.185,48$   |
| **GoCJ**     | GoCJ_500       |     500     | $2.734,80$ | $2.734,80$ |  $2.734,62$  |   $2.734,74$    | **$2.733,54$** |
| **GoCJ**     | GoCJ_600       |     600     | $3.465,00$ | $3.465,00$ |  $3.464,31$  |   $3.464,57$    | **$3.462,97$** |
| **GoCJ**     | GoCJ_700       |     700     | $3.680,40$ | $3.680,40$ |  $3.679,88$  |   $3.680,13$    | **$3.678,75$** |
| **GoCJ**     | GoCJ_800       |     800     | $4.163,00$ | $4.163,00$ |  $4.162,54$  |   $4.162,81$    | **$4.162,47$** |
| **GoCJ**     | GoCJ_900       |     900     | $5.048,33$ | $5.048,33$ |  $5.047,58$  |   $5.048,05$    | **$5.047,50$** |
| **GoCJ**     | GoCJ_1000      |    1000     | $5.452,40$ | $5.452,40$ |  $5.452,03$  |   $5.452,31$    | **$5.450,41$** |
| **Sintetik** | Synthetic_100  |     100     |  $93,80$   |  $93,80$   |   $93,70$    |     $93,78$     |  **$93,49$**   |
| **Sintetik** | Synthetic_200  |     200     |  $185,69$  |  $185,69$  |   $185,68$   |    $185,69$     |  **$185,60$**  |
| **Sintetik** | Synthetic_300  |     300     |  $272,69$  |  $272,69$  |   $272,65$   |    $272,68$     |  **$272,60$**  |
| **Sintetik** | Synthetic_400  |     400     |  $359,26$  |  $359,26$  |   $359,20$   |    $359,22$     |  **$359,15$**  |
| **Sintetik** | Synthetic_500  |     500     |  $456,59$  |  $456,59$  |   $456,58$   |    $456,59$     |  **$456,55$**  |
| **Sintetik** | Synthetic_600  |     600     |  $549,42$  |  $549,42$  |   $549,42$   |    $549,42$     |  **$549,39$**  |
| **Sintetik** | Synthetic_700  |     700     |  $635,36$  |  $635,36$  |   $635,36$   |    $635,36$     |  **$635,32$**  |
| **Sintetik** | Synthetic_800  |     800     |  $724,83$  |  $724,83$  |   $724,82$   |    $724,83$     |  **$724,79$**  |
| **Sintetik** | Synthetic_900  |     900     |  $806,97$  |  $806,97$  |   $806,96$   |    $806,97$     |  **$806,94$**  |
| **Sintetik** | Synthetic_1000 |    1000     |  $912,99$  |  $912,99$  |   $912,96$   |    $912,97$     |  **$912,77$**  |

### 2. Tabel Ringkasan Deskriptif Global (200 Runs per Metode)

| Metode                     | Makespan (s) $\mu \pm \sigma$ | Total Cost (G\$) $\mu \pm \sigma$ |   Waiting Time (s)    | Degree of Imbalance (DI) | CPU Utilization (%) | Waktu Komputasi (ms) |
| :------------------------- | :---------------------------: | :-------------------------------: | :-------------------: | :----------------------: | :-----------------: | :------------------: |
| **HLWOA**                  |    $1.760,25 \pm 1.681,64$    |   $1.666.318,8 \pm 1.593.151,5$   |   $853,48\text{ s}$   |         $0,0064$         |      $99,73\%$      |  $151,01\text{ ms}$  |
| **HC-CSO**                 |    $1.759,83 \pm 1.681,53$    |   $1.666.310,0 \pm 1.593.113,3$   |   $853,38\text{ s}$   |         $0,0071$         |      $99,76\%$      |  $27,57\text{ ms}$   |
| _Tabu Search (TS)_         |    $1.759,99 \pm 1.681,60$    |   $1.666.305,1 \pm 1.593.103,8$   |   $853,46\text{ s}$   |         $0,0081$         |      $99,74\%$      |  $23,29\text{ ms}$   |
| _Flower Pollination (FPA)_ |  **$1.759,45 \pm 1.681,20$**  | **$1.666.243,3 \pm 1.593.115,5$** | **$853,34\text{ s}$** |       **$0,0062$**       |    **$99,80\%$**    |  $43,08\text{ ms}$   |
| _HEFT (Baseline)_          |    $1.760,25 \pm 1.681,64$    |   $1.666.318,8 \pm 1.593.151,5$   |   $853,48\text{ s}$   |         $0,0064$         |      $99,73\%$      | **$0,24\text{ ms}$** |

### 3. Ablation (20 Dataset x 10 Seeds, Makespan Relatif terhadap HEFT)

| Varian                          | Makespan / HEFT ($\mu \pm \sigma$) | Keterangan                |
| :------------------------------ | :--------------------------------: | :------------------------ |
| **WOA saja**                    |      $1,437084 \pm 0,187897$       | Tanpa HEFT dan tanpa Lévy |
| **HLWOA tanpa Lévy**            |      $1,000000 \pm 0,000000$       | Sama dengan HEFT          |
| **HLWOA**                       |      $1,000000 \pm 0,000000$       | Sama dengan HEFT          |
| **CSO saja**                    |      $1,468528 \pm 0,175373$       | Tanpa warm-start HEFT     |
| **HC-CSO tanpa inertia weight** |      $0,999641 \pm 0,000772$       | Sedikit di bawah HEFT     |
| **HC-CSO**                      |      $0,999616 \pm 0,000832$       | Sedikit di bawah HEFT     |

---

## 🏆 KESIMPULAN EVALUASI & ANALISIS PERBANDINGAN

### Bagian 1: Perbandingan Kedua Hybrid (HLWOA vs HC-CSO)

1. **Makespan:**
   - HC-CSO lebih baik dari HLWOA pada **20 dari 20 dataset** (rata-rata global $1.759,83\text{ s}$ vs $1.760,25\text{ s}$)
   - Diuji per dataset (Mann-Whitney U, 10 seed), selisihnya **signifikan di 18 dari 20 dataset** ($p < 0,05$), pengecualian Synthetic_700 ($p = 0,167$) dan Synthetic_900 ($p = 0,078$)
   - Uji agregat global tidak signifikan ($p = 0,542$) karena skala dataset (100 sampai 1.000 task) bercampur dalam satu sampel, jadi uji per dataset yang dipakai sebagai dasar keputusan
2. **HLWOA identik dengan HEFT:**
   - Pada anggaran 1.200 evaluasi, makespan HLWOA sama persis dengan HEFT di semua dataset ($p = 1,0$)
   - Ablation: WOA saja rata-rata $43,7\%$ lebih lambat dari HEFT, sedangkan HLWOA dan HLWOA tanpa Lévy sama dengan HEFT, jadi kontribusi terbesar berasal dari solusi awal HEFT dan Lévy flight tidak memberi perbaikan pada konfigurasi ini
3. **HC-CSO memperbaiki HEFT, tetapi tipis:**
   - Rata-rata $0,038\%$ lebih cepat dari HEFT, signifikan di 18 dari 20 dataset
   - Ablation: CSO saja $46,9\%$ lebih lambat dari HEFT, jadi warm-start HEFT sangat menentukan
   - Inertia weight tidak berpengaruh terukur: HC-CSO penuh vs tanpa inertia weight, $p = 0,970$ dan tidak ada dataset yang signifikan
4. **Waktu komputasi:**
   - HC-CSO $27,57\text{ ms}$, HLWOA $151,01\text{ ms}$, sekitar 5 kali lebih lambat
5. **Imbalance dan cost:**
   - Imbalance HLWOA $0,0064$ vs HC-CSO $0,0071$, tetapi nilai HLWOA sama dengan HEFT karena solusinya identik
   - Cost HC-CSO $1.666.310,0\text{ G\$}$ sedikit lebih rendah dari HLWOA $1.666.318,8\text{ G\$}$, selisih sangat kecil

---

### Bagian 2: Kesimpulan

- Di antara dua hybrid, **HC-CSO unggul** pada makespan (signifikan di 18 dari 20 dataset) dan waktu komputasi
- HLWOA pada konfigurasi ini tidak memperbaiki HEFT, sehingga hanya menambah waktu komputasi
- Kontribusi komponen HC-CSO hampir seluruhnya dari warm-start HEFT, sedangkan inertia weight tidak memberi perbedaan terukur
- Selisih seluruh metode terhadap HEFT sangat kecil (di bawah $0,07\%$ pada makespan), karena HEFT sudah mendekati batas bawah pada dataset ini
- Hasil bergantung pada konfigurasi (16 VM, 1.200 evaluasi, task independen), sehingga perlu dikonfirmasi ke dosen sebelum dijadikan kesimpulan umum

---

### Bagian 3: Perbandingan Seluruh Algoritma (HLWOA, HC-CSO, TS, FPA, HEFT)

| Algoritma            |  Peringkat Makespan   |    Peringkat Cost     |  Peringkat Imbalance  |   Peringkat Waktu    | Catatan                                                                     |
| :------------------- | :-------------------: | :-------------------: | :-------------------: | :------------------: | :-------------------------------------------------------------------------- |
| **FPA**              |           1           |           1           |           1           |          4           | Terbaik di 18 dari 20 dataset, signifikan atas HC-CSO di 15 dari 20 dataset |
| **HC-CSO**           |           2           |           3           |           4           |          3           | Hybrid terbaik, signifikan atas HLWOA dan HEFT di 18 dari 20 dataset        |
| **Tabu Search (TS)** |           3           |           2           |           5           |          2           | Cepat, tetapi imbalance paling tinggi ($0,0081$)                            |
| **HLWOA**            | 4 (sama dengan HEFT)  | 4 (sama dengan HEFT)  | 2 (sama dengan HEFT)  |          5           | Identik dengan HEFT pada konfigurasi ini, paling lambat                     |
| **HEFT**             | 4 (sama dengan HLWOA) | 4 (sama dengan HLWOA) | 2 (sama dengan HLWOA) | 1 ($0,24\text{ ms}$) | Baseline instan dan titik awal semua metaheuristik                          |

---

## 📈 Uji Signifikansi Statistik: Mann-Whitney U ($\alpha = 0.05$)

- **Uji global (200 run per metode):** `results/ringkasan_statistik.json`, dijalankan dengan `npm run stats`. Tidak ada pasangan yang signifikan karena skala dataset bercampur
- **Uji per dataset (10 seed per sampel):** `results/uji_per_dataset.json`, dijalankan dengan `npm run stats:dataset`, dan ini yang dijadikan dasar keputusan
- **Alasan non-parametrik:** data hasil metaheuristik memiliki batas bawah dan tidak memenuhi asumsi normalitas (Derrac et al., 2011)

| Pasangan (A vs B) | Dataset signifikan | A lebih kecil | B lebih kecil |
| :---------------- | :----------------: | :-----------: | :-----------: |
| HC-CSO vs HLWOA   |      18 / 20       |      18       |       0       |
| HC-CSO vs HEFT    |      18 / 20       |      18       |       0       |
| HC-CSO vs TS      |       9 / 20       |       9       |       0       |
| FPA vs HC-CSO     |      15 / 20       |      15       |       0       |
| FPA vs HLWOA      |      20 / 20       |      20       |       0       |
| FPA vs TS         |      17 / 20       |      17       |       0       |

---

## 🗂️ Struktur Direktori Proyek

```plaintext
Hybrid/SOKA-Hybrid-HLWOA-HC-CSO/
├── package.json              # Konfigurasi ES Module & scripts runner
├── index.html                # Portal navigasi utama demo kelompok
├── data/                     # Salinan lengkap 19 file GoCJ & 19 file Synthetic
├── results/
│   ├── hasil.json                # Berkas kontrak data utama (1.000 runs)
│   ├── hasil_ablation.json       # Ablation: WOA, HLWOA-noLevy, CSO, HC-CSO-noIW (+ HLWOA, HC-CSO)
│   ├── hasil_by_dataset.json     # Rincian terkelompok per dataset
│   ├── ringkasan_statistik.json  # Statistik deskriptif & uji global
│   ├── uji_per_dataset.json      # Uji Mann-Whitney per dataset
│   ├── ablation_hlwoa.json       # Ablation HLWOA dari skrip P2
│   └── ablation_hccso.json       # Ablation HC-CSO dari skrip P3
├── simulator/                # Modul inti simulator (P1), ablation P2 dan P3
├── web-components/           # Komponen visualisasi mandiri untuk P2 & P3
├── perbandingan/             # Halaman perbandingan seluruh metode (P4)
└── tests/                    # Rangkaian pengujian otomatis
```

---

## 🚀 Panduan Menjalankan

1. **Jalankan seluruh suite pengujian otomatis:**
   ```bash
   npm test
   ```
2. **Jalankan ulang benchmark seluruh dataset (termasuk ablation) dan ekspor hasil:**
   ```bash
   npm run export
   ```
3. **Jalankan statistik global dan statistik per dataset:**
   ```bash
   npm run stats
   npm run stats:dataset
   ```
4. **Buka halaman visualisasi lewat server lokal (jangan klik dua kali file HTML):**
   ```bash
   npx serve .
   ```
   Lalu buka `/perbandingan/` untuk halaman perbandingan dan `/web-components/demo.html` untuk Gantt dan grafik konvergensi.
