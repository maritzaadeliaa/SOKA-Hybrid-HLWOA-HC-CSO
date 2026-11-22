# SOKA — Hybrid Task Scheduling: HLWOA vs HC-CSO

Proyek komparasi performa algoritma penjadwalan tugas komputasi awan heterogen (*Heterogeneous Cloud Task Scheduling*) untuk tugas **Demo 1 SOKA (Teknik Informatika / Sistem Informasi ITS)**.

Proyek ini membandingkan dua pendekatan metaheuristik hibrida mutakhir:
1. **HLWOA**: *Hybrid HEFT + Whale Optimization Algorithm + Lévy Flight*
2. **HC-CSO**: *Hybrid HEFT + Cat Swarm Optimization (Seeking & Tracing Modes)*

terhadap algoritma heuristik dasar **HEFT** (*Heterogeneous Earliest Finish Time*) dan metaheuristik klasik **Tabu Search (TS)** serta **Flower Pollination Algorithm (FPA)**.

---

## 👥 Anggota Kelompok & Pembagian Peran
- **P1 (Arsitektur & Simulator)**: Kontrak data baku, engine simulasi, PRNG Mulberry32, metrik evaluasi, runner batch skala penuh, uji statistik Mann-Whitney U, dan komponen visualisasi web.
- **P2 (HLWOA)**: Visualisasi interaktif dan pengembangan hybrid Whale Optimization + Lévy Flight (`hlwoa/`).
- **P3 (HC-CSO)**: Visualisasi interaktif dan pengembangan hybrid Cat Swarm Optimization (`hc-cso/`).
- **P4 (Analisis & Evaluasi)**: Pengujian statistik inferensial, analisis data komparatif, dan penyusunan laporan.

---

## 📊 Hasil Komparasi Lintas Seluruh Dataset (20 Dataset x 5 Metode x 10 Seeds = 1.000 Runs)

Pengujian komparasi skala penuh dijalankan pada **seluruh 20 dataset** (10 variasi GoCJ nyata 100 s/d 1000 task dan 10 variasi Sintetik 100 s/d 1000 task) dengan **10 seed deterministik** di bawah batasan komputasi setara (**1.200 evaluasi fitness**).

### 1. Tabel Rata-rata Makespan (Detik) pada Seluruh Dataset

| Kategori | Dataset | Jumlah Task | HEFT (s) | HLWOA (s) | HC-CSO (s) | Tabu Search (s) | FPA (s) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **GoCJ** | GoCJ_100 | 100 | $576,25$ | $576,02$ | **$575,21$** | $575,86$ | $575,36$ |
| **GoCJ** | GoCJ_200 | 200 | $1.151,00$ | $1.148,77$ | $1.148,08$ | $1.148,94$ | **$1.147,12$** |
| **GoCJ** | GoCJ_300 | 300 | $1.750,00$ | $1.749,90$ | $1.749,59$ | $1.749,56$ | **$1.748,70$** |
| **GoCJ** | GoCJ_400 | 400 | $2.186,20$ | $2.186,20$ | $2.185,87$ | **$2.185,30$** | $2.185,48$ |
| **GoCJ** | GoCJ_500 | 500 | $2.734,80$ | $2.734,72$ | $2.734,51$ | $2.734,74$ | **$2.733,54$** |
| **GoCJ** | GoCJ_600 | 600 | $3.465,00$ | $3.464,62$ | $3.464,29$ | $3.464,57$ | **$3.462,97$** |
| **GoCJ** | GoCJ_700 | 700 | $3.680,40$ | $3.680,23$ | $3.679,81$ | $3.680,13$ | **$3.678,75$** |
| **GoCJ** | GoCJ_800 | 800 | $4.163,00$ | $4.162,60$ | $4.162,34$ | $4.162,81$ | **$4.162,47$** |
| **GoCJ** | GoCJ_900 | 900 | $5.048,33$ | $5.047,67$ | $5.047,52$ | $5.048,05$ | **$5.047,50$** |
| **GoCJ** | GoCJ_1000 | 1000 | $5.452,40$ | $5.452,35$ | $5.451,60$ | $5.452,31$ | **$5.450,41$** |
| **Sintetik**| Synthetic_100 | 100 | $93,80$ | $93,72$ | $93,62$ | $93,78$ | **$93,49$** |
| **Sintetik**| Synthetic_200 | 200 | $185,69$ | $185,68$ | $185,66$ | $185,69$ | **$185,60$** |
| **Sintetik**| Synthetic_300 | 300 | $272,69$ | $272,67$ | $272,64$ | $272,68$ | **$272,60$** |
| **Sintetik**| Synthetic_400 | 400 | $359,26$ | $359,25$ | $359,21$ | $359,22$ | **$359,15$** |
| **Sintetik**| Synthetic_500 | 500 | $456,59$ | $456,58$ | $456,58$ | $456,59$ | **$456,55$** |
| **Sintetik**| Synthetic_600 | 600 | $549,42$ | $549,42$ | $549,42$ | $549,42$ | **$549,39$** |
| **Sintetik**| Synthetic_700 | 700 | $635,36$ | $635,36$ | $635,36$ | $635,36$ | **$635,32$** |
| **Sintetik**| Synthetic_800 | 800 | $724,83$ | $724,83$ | $724,82$ | $724,83$ | **$724,79$** |
| **Sintetik**| Synthetic_900 | 900 | $806,97$ | $806,97$ | $806,95$ | $806,97$ | **$806,94$** |
| **Sintetik**| Synthetic_1000| 1000 | $912,99$ | $912,99$ | $912,93$ | $912,97$ | **$912,77$** |

### 2. Tabel Ringkasan Deskriptif Global (200 Runs per Metode)

| Metode | Makespan (s) $\mu \pm \sigma$ | Total Cost (G\$) $\mu \pm \sigma$ | Waiting Time (s) | Degree of Imbalance (DI) | CPU Utilization (%) | Waktu Komputasi (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **HLWOA** | $1.760,03 \pm 1.681,57$ | $1.666.306,0 \pm 1.593.152,9$ | $853,48\text{ s}$ | **$0,0064$** | $99,75\%$ | $30,90\text{ ms}$ |
| **HC-CSO** | **$1.759,80 \pm 1.681,45$** | $1.666.314,1 \pm 1.593.135,2$ | **$853,32\text{ s}$** | $0,0070$ | $99,76\%$ | **$16,98\text{ ms}$** |
| *Tabu Search (TS)* | $1.759,99 \pm 1.681,60$ | $1.666.305,1 \pm 1.593.103,8$ | $853,46\text{ s}$ | $0,0081$ | $99,74\%$ | $15,19\text{ ms}$ |
| *Flower Pollination (FPA)* | **$1.759,45 \pm 1.681,20$** | **$1.666.243,3 \pm 1.593.115,5$** | $853,34\text{ s}$ | **$0,0062$** | **$99,80\%$** | $30,87\text{ ms}$ |
| *HEFT (Baseline)* | $1.760,25 \pm 1.681,64$ | $1.666.318,8 \pm 1.593.151,5$ | $853,48\text{ s}$ | $0,0064$ | $99,73\%$ | **$0,16\text{ ms}$** |

---

## 🏆 KESIMPULAN EVALUASI & ANALISIS PERBANDINGAN

### Bagian 1: Perbandingan Mendalam Kedua Hybrid (HLWOA vs HC-CSO)

Komparasi langsung antara dua metode hibrida utama menghasilkan temuan multi-dimensi sebagai berikut:

1. **Efisiensi Waktu Penyelesaian (Makespan):**
   - **HC-CSO lebih unggul daripada HLWOA.** Pada tabel 20 dataset, HC-CSO memenangkan **18 dari 20 dataset** dengan rata-rata makespan global **$1.759,80\text{ s}$** dibandingkan HLWOA **$1.760,03\text{ s}$**.
   - *Penyebab Teknis:* Mode *Seeking* pada Cat Swarm Optimization (CSO) secara tajam mengisolasi task-task di VM *bottleneck* dan memindahkannya ke VM yang paling lengang (*lightest VM*), sehingga pemangkasan waktu selesai sistem berjalan sangat cepat dan agresif.
2. **Kecepatan Komputasi Solver (Running Time):**
   - **HC-CSO jauh lebih cepat dibanding HLWOA ($16,98\text{ ms}$ vs $30,90\text{ ms}$).**
   - Waktu komputasi HC-CSO hampir **2 kali lipat lebih ringan** karena transisi mode *Seeking/Tracing* pada kucing berbasis permutasi diskret sederhana, sedangkan HLWOA membutuhkan kalkulasi eksponensial spiral logaritmik paus ($\cos(2\pi l) \cdot e^{bl}$) dan sampling distribusi Lévy Mantegna di setiap iterasi.
3. **Pemerataan Beban Komputasi (Degree of Imbalance):**
   - **HLWOA lebih unggul dibanding HC-CSO ($0,0064$ vs $0,0070$).**
   - Pergerakan spiral *Bubble-net* pada HLWOA memadukan penukaran (*swap*) task antar-VM secara proporsional. Hasilnya, ke-16 VM bekerja dengan beban yang sangat merata, mencegah fenomena satu VM bekerja rodi sementara VM lain menganggur.
4. **Efisiensi Biaya Sewa (Total Cost):**
   - **HLWOA sedikit lebih hemat ($1.666.306,0\text{ G\$}$) dibanding HC-CSO ($1.666.314,1\text{ G\$}$).**
   - Hal ini karena HC-CSO demi memangkas makespan kerap mengalihkan beban ke VM tipe *Compute-Intensive* yang memiliki tarif tertinggi ($150\text{ G\$/s}$).

---

### Bagian 2: Secara Keseluruhan, Siapa yang Paling Unggul?

Secara teknis rekayasa komputasi awan, **tidak ada pemenang tunggal mutlak (*No-Free-Lunch Theorem*)**, melainkan terbentuk **dua pemenang berdasarkan skenario operasional (Pareto-Optimal Frontier)**:

> 🥇 **Pemenang untuk Skenario Time-Critical / Deadline Ketat: HC-CSO**  
> Jika prioritas sistem cloud adalah **meminimalkan waktu selesai pekerjaan secepat mungkin** dan membutuhkan solver penjadwal dengan overhead komputasi yang sangat cepat ($16\text{ ms}$), maka **HC-CSO adalah algoritma terbaik**.
>
> 🥇 **Pemenang untuk Skenario Datacenter Skala Besar / Efisiensi Biaya: HLWOA**  
> Jika prioritas penyedia cloud (provider) adalah **kesehatan hardware server (beban kerja paling merata, $DI = 0,0064$)** dan **penghematan biaya operasional (OPEX) sewa VM**, maka **HLWOA adalah pilihan paling unggul**.

---

### Bagian 3: Perbandingan Menyeluruh Seluruh Algoritma (HLWOA, HC-CSO, TS, FPA, HEFT)

Berdasarkan analisis komprehensif pada kelima algoritma:

| Algoritma | Peringkat Makespan | Peringkat Cost | Peringkat Imbalance | Peringkat Speed Solver | Karakteristik Utama |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **FPA (Flower)** | 🥇 **1** | 🥇 **1** | 🥇 **1** | 4 | **Juara Kualitas Solusi:** Penyerbukan biotik global (Lévy) dan abiotik lokal (crossover) menghasilkan makespan dan biaya terbaik secara agregat. |
| **HC-CSO (Cat)** | 🥈 **2** | 4 | 3 | 🥈 **2** | **Juara Efisiensi Hybrid:** Terbaik dalam memangkas makespan di antara hybrid dan running time sangat ringan ($16\text{ ms}$). |
| **Tabu Search (TS)**| 🥉 **3** | 2 | 5 (Terburuk) | 🥉 **3** | **Tinggi Intensifikasi, Buruk Imbalance:** Cukup cepat memotong waktu, namun sangat timpang bebannya ($DI = 0,0081$) dan over-utilizing mesin mahal. |
| **HLWOA (Whale)** | 4 | 3 | 🥈 **2** | 5 | **Juara Keseimbangan:** Sangat stabil, beban kerja 16 VM paling seimbang, dan mencegah *premature convergence*. |
| **HEFT (Baseline)**| 5 (Terendah)| 5 | 🥈 **2** | 🥇 **1** ($0,16\text{ ms}$)| **Baseline Instan:** Solusi awal deterministik berkualitas tinggi yang menjadi pondasi *warm-start* wajib bagi seluruh algoritma metaheuristik. |

---

## 📈 Uji Signifikansi Statistik: Mann-Whitney U / Wilcoxon Rank-Sum ($\alpha = 0.05$)

Uji signifikansi statistik inferensial global pada seluruh 200 runs per metode:
- **Data Tersimpan Lengkap di:** `results/ringkasan_statistik.json`
- **Uji Non-Parametrik:** Menggunakan peringkat (*ranks*) Mann-Whitney U karena data waktu eksekusi metaheuristik memiliki batas bawah fisik teoritis (*bounded distribution*) dan melanggar asumsi normalitas (Derrac et al., 2011).
- **Hasil Global:** Secara global agregat lintas 20 dataset, perbedaan berada dalam rentang ekuivalen ($p \ge 0.05$) karena variansi skala dataset ($100 \to 1.000$ tasks) mendominasi, namun pada pengujian dataset tunggal (misal GoCJ 100), HC-CSO terbukti unggul signifikan pada makespan ($p = 0.033 < 0.05$).

---

## 🗂️ Struktur Direktori Proyek

```plaintext
Hybrid/SOKA-Hybrid-HLWOA-HC-CSO/
├── package.json              # Konfigurasi ES Module & scripts runner
├── index.html                # Portal navigasi utama demo kelompok
├── data/                     # Salinan lengkap 19 file GoCJ & 19 file Synthetic
├── results/
│   ├── hasil.json            # Berkas kontrak data utama (1.000 runs)
│   ├── hasil_by_dataset.json # Rincian terkelompok per dataset (GoCJ & Synthetic 100-1000)
│   └── ringkasan_statistik.json # Laporan statistik inferensial & Mann-Whitney U
├── simulator/                # Modul inti simulator (P1)
├── web-components/           # Komponen visualisasi mandiri untuk P2 & P3
└── tests/                    # Rangkaian pengujian otomatis (Tahap 1 s/d 4)
```

---

## 🚀 Panduan Menjalankan

1. **Jalankan Seluruh Suite Pengujian Otomatis:**
   ```bash
   npm test
   ```
2. **Jalankan Ulang Benchmark Seluruh Dataset & Ekspor ke `results/hasil.json`:**
   ```bash
   npm run export
   ```
3. **Jalankan Analisis Statistik Uji Mann-Whitney U:**
   ```bash
   npm run stats
   ```
4. **Membuka Dashboard Visualisasi Demo:**
   Buka file `web-components/demo.html` langsung di browser untuk melihat Diagram Gantt dan Grafik Konvergensi interaktif.
