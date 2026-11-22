# Modul Pembelajaran & Eksperimen HC-CSO (Hybrid HEFT + Cat Swarm Optimization)

Direktori `hc-cso/` merupakan antarmuka web interaktif dan dokumentasi teknis untuk algoritma **Hybrid HEFT + Cat Swarm Optimization (HC-CSO)** yang dikembangkan pada **Peran P3** dalam proyek optimasi penjadwalan _cloud_ heterogen.

---

## 1. Referensi Paper Landasan

Implementasi algoritma dan formulasi matematis pada modul ini merujuk pada publikasi ilmiah berikut:

> **Jai Bhagwan & Sanjeev Kumar (2021).** _"An HC-CSO Algorithm for Workflow Scheduling in Heterogeneous Cloud Computing System."_ International Journal of Advanced Computer Science and Applications (IJACSA), Vol. 12, No. 6, pp. 484–492.

---

## 2. Adaptasi Metodologis & Formulasi Matematis

Agar selaras dengan arsitektur simulator kelompok dan karakteristik beban kerja _Bag-of-Tasks_ (GoCJ dan Sintetik), dilakukan penyesuaian ilmiah dari paper asli sebagai berikut:

### A. Reduksi _Workflow_ DAG ke _Independent Tasks_

- Pada paper Bhagwan & Kumar (2021), _upward rank_ pada tahap **HEFT (Heterogeneous Earliest Finish Time)** didefinisikan untuk _Directed Acyclic Graph_ (DAG) sebagai:
  $$\text{rank}_u(t_i) = \overline{w_i} + \max_{t_j \in \text{succ}(t_i)} \left( \overline{c_{i,j}} + \text{rank}_u(t_j) \right)$$
- Karena beban kerja pada simulator ini berupa **task independen** (_non-preemptive_, tanpa ketergantungan antar-task sehingga biaya transfer komunikasi $\overline{c_{i,j}} = 0$ dan himpunan suksesor kosong), persamaan di atas tereduksi secara eksak menjadi $\text{rank}_u(t_i) = \overline{w_i}$.
- Oleh karena itu, tahap HEFT mengurutkan seluruh task secara _descending_ berdasarkan panjang instruksi (MI) dan memetakannya ke Virtual Machine (VM) dengan waktu selesai paling awal (_Earliest Finish Time_) untuk membentuk solusi awal (_warm-start_) bagi populasi kucing.

### B. Diskritisasi Ruang Pencarian & Mekanisme HC-CSO

Setiap agen kucing $k$ merepresentasikan vektor penugasan diskrit $X_k = [X_{k,0}, X_{k,1}, \dots, X_{k,D-1}]$, dengan $X_{k,d} \in \{0, 1, \dots, n_{\text{VMs}} - 1\}$ menyatakan indeks VM tujuan untuk task ke-$d$.

1. **Inisialisasi Populasi (_Warm-Start_ HEFT vs. Acak):**
   - Pada mode penuh (`useHeft: true`), Kucing ke-$0$ diisi langsung oleh solusi HEFT, sedangkan Kucing ke-$1 \dots (N-1)$ dibangkitkan melalui mutasi _swap_ mikro terhadap solusi HEFT agar populasi awal memiliki keragaman tanpa kehilangan kualitas jadwal awal.
   - Pada varian pembanding CSO murni (`useHeft: false`), seluruh populasi diinisialisasi secara acak seragam.
2. **Pembagian Mode via _Mixing Ratio_ ($MR$):**
   - Pada setiap iterasi, agen kucing dibagi menggunakan parameter $MR \in [0, 1]$ (default $MR = 0.3$): proporsi $MR$ masuk ke _Tracing Mode_, sedangkan proporsi $(1 - MR)$ masuk ke _Seeking Mode_.
3. **_Seeking Mode_ (Eksplorasi Lokal Terarah & Memori Pribadi):**
   - Setiap agen membangkitkan sebanyak $SMP$ kandidat (default $SMP = 4$) menggunakan kombinasi:
     - Pemindahan task dari _VM bottleneck_ (waktu selesai terbesar) ke VM dengan beban paling ringan.
     - Pertukaran (_swap_) task antara _VM bottleneck_ dan VM lain.
     - Langkah pencarian lokal menuju memori posisi terbaik pribadi agen $M_{k,d}$ (adaptasi fase Crow Search Algorithm dengan _flight length_ $fl = 0.5$):
       $$X_{k,d}^{\text{cand}} = \text{clamp}\Big(\text{round}\big(X_{k,d} + r \cdot fl \cdot (M_{k,d} - X_{k,d})\big),\; 0,\; n_{\text{VMs}} - 1\Big)$$
4. **_Tracing Mode_ & _Self-Motivated Inertia Weight_ (SMIW):**
   - Untuk menyeimbangkan eksplorasi awal dan eksploitasi akhir serta mencegah lonjakan kecepatan berlebih (_velocity outrange_), bobot inersia $\gamma$ dihitung berdasarkan Persamaan (27) Bhagwan & Kumar (2021):
     $$\gamma(\text{iter}) = \gamma_{\max} \cdot \exp\left(-c \cdot \left(\frac{\text{iter}}{\text{maxIter}}\right)^c\right), \quad \gamma_{\max} = 2.0,\; c = 2.0$$
   - Pembaruan kecepatan dan posisi diskrit (Persamaan 28 dan 30) dirumuskan sebagai:
     $$V_{k,d} = \text{clamp}\Big(\gamma \cdot V_{k,d} + c_1 \cdot r_1 \cdot (X_{\text{best},d} - X_{k,d}),\; -V_{\max},\; V_{\max}\Big)$$
     $$X_{k,d}^{\text{baru}} = \text{clamp}\Big(\text{round}(X_{k,d} + V_{k,d}),\; 0,\; n_{\text{VMs}} - 1\Big)$$

---

## 3. Struktur Berkas & Batas Kepemilikan (Peran P3)

Seluruh artefak milik **Peran P3** terisolasi pada berkas-berkas berikut dan **tidak mengimpor kode apa pun dari direktori `hlwoa/`**:

```text
├── simulator/
│   ├── algorithms/
│   │   └── hccso.js                  # Implementasi inti HC-CSO + flag ablation (useHeft, useInertia)
│   └── ablationHCCSO.js              # Runner eksperimen ablation 4 varian (>= 10 run/dataset)
├── tests/
│   └── test_hccso_p3.js              # Unit & integration test suite (8 skenario verifikasi)
├── results/
│   └── ablation_hccso.json           # Luaran statistik ablation (mean +- std, reduksi vs HEFT)
└── hc-cso/
    ├── index.html                    # Halaman web interaktif pembelajaran & eksperimen HC-CSO
    ├── README.md                     # Dokumentasi teknis & panduan eksekusi modul ini
    ├── js/
    │   ├── ui.js                     # Pengendali UI, Gantt Chart, Konvergensi, Sandbox, & Kuis
    │   ├── demo-data.js              # Data eksperimen riil (auto-generated oleh build-demo-data.mjs)
    │   └── quiz-data.js              # Bank soal kuis konseptual (3 pertanyaan pilihan ganda)
    └── scripts/
        └── build-demo-data.mjs       # Skrip pembangkit demo-data.js dari data/ & results/
```

---

## 4. Panduan Menjalankan Pengujian, Ablation, & Web Demo

Pastikan **Node.js (v18 atau lebih baru)** sudah terpasang dan jalankan seluruh perintah berikut dari **direktori root repositori**.

### Langkah 1: Jalankan Unit Test (`tests/test_hccso_p3.js`)

Memverifikasi kontrak struktur output, akurasi kalkulasi `fitness.js`, kepatuhan ketat terhadap batas evaluasi ($\text{evaluations} \le \text{maxEvals}$), determinisme `seed`, monotonisitas kurva konvergensi, dan keempat varian _ablation_:

```bash
node tests/test_hccso_p3.js
```

### Langkah 2: Jalankan Studi Ablation (`simulator/ablationHCCSO.js`)

Mengevaluasi 4 konfigurasi algoritma dengan `seed` deterministik dan anggaran evaluasi yang identik (`maxEvals = 1500`, minimal $10$ _run_ per dataset) lalu menyimpan hasilnya ke `results/ablation_hccso.json`:

| ID Varian      | Konfigurasi Flag                   | Tujuan Pengujian                                             |
| :------------- | :--------------------------------- | :----------------------------------------------------------- |
| `HEFT`         | Heuristik deterministik            | Mengukur _baseline_ jadwal awal tanpa optimasi metaheuristik |
| `CSO`          | `useHeft: false, useInertia: true` | Mengukur performa CSO murni tanpa _warm-start_ HEFT          |
| `HC-CSO-no-IW` | `useHeft: true, useInertia: false` | Mengukur kontribusi SMIW dengan menetapkan $\gamma = 0$      |
| `HC-CSO`       | `useHeft: true, useInertia: true`  | Mengukur performa sinergi penuh HEFT + CSO + SMIW            |

Perintah eksekusi standar ($15$ _run_ per dataset):

```bash
node simulator/ablationHCCSO.js
```

Opsi parameter CLI tambahan jika ingin menguji dataset atau jumlah _run_ tertentu:

```bash
node simulator/ablationHCCSO.js --dataset=GoCJ_Dataset_500.txt --runs=15 --maxEvals=1500
```

### Langkah 3: Bangkitkan Data Web Interaktif (`hc-cso/js/demo-data.js`)

Menggabungkan dataset asli dari `data/`, statistik dari `results/ablation_hccso.json`, serta jejak jadwal _Gantt Chart_ dan konvergensi menjadi modul ES `hc-cso/js/demo-data.js`:

```bash
node hc-cso/scripts/build-demo-data.mjs
```

### Langkah 4: Jalankan Server Web Lokal & Buka di Browser

Jalankan server HTTP statis dari **root repositori** (diperlukan agar browser dapat memuat ES Module dan menjalankan simulasi ulang pada _sandbox_ parameter):

```bash
python -m http.server 8000
```

Kemudian buka alamat berikut pada browser:

```text
http://localhost:8000/hc-cso/
```

---

## 5. Fitur Antarmuka Web (`hc-cso/index.html`)

1. **Bukti Dampak _Makespan_:** Menampilkan perbandingan _makespan_ rata-rata aktual (`HEFT`, `CSO`, `HC-CSO tanpa IW`, dan `HC-CSO Penuh`) beserta persentase reduksi _makespan_ langsung dari `results/ablation_hccso.json`.
2. **Ilustrasi Perilaku Agen Kucing:** Visualisasi konseptual animasi pergerakan agen pada _Seeking Mode_ (eksplorasi lokal di sekitar posisi agen) dan _Tracing Mode_ (pergerakan vektor kecepatan menuju $X_{\text{best}}$).
3. **Visualisasi _Gantt Chart_ & _Tooltip_:** Membandingkan penempatan task pada $16$ VM heterogen (`4 Compute`, `6 Standard`, `6 Light`) antara `HC-CSO` dan `HEFT Baseline`, lengkap dengan penanda `[MAX]` untuk _VM bottleneck_ dan garis batas $C_{\max}$.
4. **Kurva Konvergensi & _Sandbox_ Parameter:** Grafik penurunan _makespan_ per iterasi untuk keempat varian, dilengkapi _slider_ interaktif untuk menguji perubahan $MR$, $SMP$, mode _Inertia Weight_ (SMIW Adaptif, Konstan Manual, atau $\gamma = 0$), dan `seed` secara langsung di browser.
5. **Tabel Hasil _Ablation_ & Kuis Interaktif:** Menyajikan ringkasan statistik $\text{Mean} \pm \text{Std}$ lintas dataset serta $3$ soal kuis konseptual pilihan ganda lengkap dengan skor otomatis dan pembahasan.
