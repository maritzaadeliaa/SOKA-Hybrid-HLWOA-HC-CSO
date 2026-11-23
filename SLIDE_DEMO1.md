# Panduan Slide Presentasi Demo 1 SOKA
## Hybrid Cloud Task Scheduling: HLWOA vs HC-CSO vs TS vs FPA vs HEFT

> Dokumen panduan dan materi presentasi untuk kelompok (P1, P2, P3, P4, P5).  
> **Penanggung Jawab Slide & Pembicara Pembuka/Penutup:** P5.

---

### Alur Pembagian Bicara Saat Demo (Sesuai Ketentuan Tugas):
1. **Slide 1 - 3 (Pembuka, Masalah, & Ketentuan):** Pembicara **P5**
2. **Slide 4 - 6 (Simulator, Dataset Minggu 3, & Kontrak Metrik):** Pembicara **P1**
3. **Slide 7 - 9 (Cara Kerja Hybrid Pemenang / Demo Web):** Pembicara **P3** *(HC-CSO menang makespan & speed)* atau **P2** *(HLWOA menang load balance & cost)*
4. **Slide 10 - 11 (Varian Ablasi & Analisis Kegagalan Hybrid Pembanding):** Pembicara **P2** atau **P3**
5. **Slide 12 - 14 (Hasil Eksperimen Komparasi vs TS, FPA, HEFT & Uji Signifikansi):** Pembicara **P4**
6. **Slide 15 - 16 (Kesimpulan Operasional & Sesi Q&A):** Pembicara **P5 + Seluruh Tim**

---

### Rincian Konten Per Slide

#### SLIDE 1: Judul & Identitas Kelompok
* **Judul:** Analisis Kinerja Algoritma Penjadwalan Tugas Cloud Heterogen: Hybrid HLWOA (HEFT + Whale Optimization + Lévy Flight) vs HC-CSO (HEFT + Cat Swarm Optimization)
* **Mata Kuliah:** Sistem Optimasi Komputasi Awan (SOKA) - Demo 1
* **Anggota Kelompok:**
  * P1: Engine Simulator, Dataset Minggu 3, PRNG Mulberry32, & Metrik Evaluasi
  * P2: Visualisasi Interaktif & Algoritma HLWOA (Whale + Lévy Flight)
  * P3: Visualisasi Interaktif & Algoritma HC-CSO (Cat Swarm Seeking/Tracing)
  * P4: Runner Eksperimen (1.000 Runs, 20 Dataset), Statistik Inferensial & Uji Signifikansi
  * P5: Web Hub Architecture, 3D Component System, Integrasi & Deployment

#### SLIDE 2: Latar Belakang & Permasalahan
* **Masalah:** Heterogeneous Cloud Task Scheduling tergolong NP-hard. VM memiliki kecepatan komputasi ($MIPS$) dan tarif sewa ($G\$/s$) yang beragam.
* **Tantangan Heuristik Murni (HEFT):** Cepat ($<1\text{ ms}$), namun rentan terjebak di *local optimum* karena keputusan greedy urutan tugas.
* **Tantangan Metaheuristik Murni (WOA / CSO acak):** Membutuhkan iterasi banyak hanya untuk merapikan jadwal acak yang buruk di awal.
* **Solusi Hibrida (Pola B-E):** *Warm-start* menggunakan HEFT untuk menyumbang 1 individu terbaik ke populasi awal, dilanjutkan eksplorasi metaheuristik.

#### SLIDE 3: Ketentuan Tugas & Batasan Eksperimen
* **Adil & Terkontrol:**
  * Budget evaluasi fungsi fitness identik (**1.200 evaluasi** untuk semua metode metaheuristik).
  * 10 Seed PRNG deterministik per dataset (auditabel).
  * 20 Varian dataset: 10 GoCJ (Real-world 100–1.000 task) + 10 Sintetik (100–1.000 task).
  * Metrik komprehensif: Makespan, Total Cost, Waiting Time, Degree of Imbalance (DI), CPU Utilization, dan Runtime Scheduler.

#### SLIDE 4: Arsitektur Simulator & Kontrak Data (P1)
* PRNG Mulberry32: Determinisme 100% pada semua seed.
* Evaluasi independen tanpa bias urutan.
* Kontrak keluaran: JSON terstruktur (`hasil.json`, `hasil_by_dataset.json`, `ringkasan_statistik.json`).

#### SLIDE 5: Algoritma HLWOA (HEFT + Whale Optimization + Lévy Flight) (P2)
* **Mekanisme Paus:** *Encircling prey*, *Bubble-net attacking* (spiral logaritmik), dan *Search for prey*.
* **Peran Lévy Flight:** Menggunakan distribusi Mantegna berkekuatan *heavy-tailed* untuk lompatan eksplorasi jauh saat populasi mulai mengelompok.

#### SLIDE 6: Algoritma HC-CSO (HEFT + Cat Swarm Optimization) (P3)
* **Seeking Mode (Eksplorasi Lokal):** Menghasilkan salinan posisi bayangan di memori kucing (*SMP*), mengubah assignment task di VM paling padat ke VM paling lengang.
* **Tracing Mode (Eksploitasi Cepat):** Kucing bergerak mengejar jadwal terbaik global ($X_{best}$) dengan *Self-Motivated Inertia Weight*.

#### SLIDE 7: Demo Web Interaktif (P2 / P3)
* *Tunjukkan demo interaktif langsung melalui website GitHub Pages:*
  * Fase 1: Penjadwalan Greedy Troli HEFT di Zona Depan Kasir.
  * Fase 2: Suntikan Solusi HEFT ke individu berkalung emas / paus pemimpin.
  * Fase 3: Animasi pencarian solusi optimal pada Zona Belakang 3D.
  * Fitur Live Convergence Chart & Mini-Gantt per VM.

#### SLIDE 8: Hasil Komparasi Global (20 Dataset x 5 Metode x 10 Seeds = 1.000 Runs) (P4)
* **Tabel Rangkuman Statistik:**
  * **Makespan:** HC-CSO ($1.759,80\text{ s}$) mengungguli HLWOA ($1.760,03\text{ s}$) dan menang di 18 dari 20 dataset.
  * **Waktu Solver:** HC-CSO ($16,98\text{ ms}$) майже 2× lebih kencang dibanding HLWOA ($30,90\text{ ms}$).
  * **Degree of Imbalance (Pemerataan Beban):** HLWOA ($0,0064$) lebih merata dibanding HC-CSO ($0,0070$).
  * **Total Cost:** HLWOA ($1.666.306\text{ G\$}$) sedikit lebih hemat dibanding HC-CSO ($1.666.314\text{ G\$}$).
* **Uji Signifikansi Statistik:** Uji Mann-Whitney U membuktikan keunggulan reduksi makespan signifikan secara statistik dibanding HEFT murni ($p < 0,05$).

#### SLIDE 9: Analisis Ablasi (Varian Komponen Algoritma)
* Membuktikan kontribusi masing-masing komponen:
  * HEFT saja vs Metaheuristik acak saja vs Hybrid lengkap.
  * Dampak Lévy flight pada HLWOA & dampak Inertia Weight pada HC-CSO.

#### SLIDE 10: Kesimpulan & Rekomendasi Operasional (P5)
* **No-Free-Lunch Theorem:**
  1. **Skenario Time-Critical / Deadline Ketat:** Gunakan **HC-CSO** (Makespan terendah & waktu solver kilat $16\text{ ms}$).
  2. **Skenario Datacenter Skala Besar / Efisiensi Biaya:** Gunakan **HLWOA** (Beban VM paling merata $DI=0,0064$, biaya sewa lebih rendah).
* Sesi Tanya Jawab (Q&A).

---

### Daftar Referensi Paper
1. **HLWOA:** Cui, Z., & Wang, Y. (2025). *A Hybrid Whale Optimization Algorithm with HEFT and Lévy Flight for Heterogeneous Cloud Task Scheduling*.
2. **HC-CSO:** Bhagwan, J., & Kumar, S. (2021). *An HC-CSO Algorithm for Workflow Scheduling in Heterogeneous Cloud Computing System*. International Journal of Advanced Computer Science and Applications (IJACSA), 12(6), 484-492.
3. **HEFT:** Topcuoglu, H., Hariri, S., & Wu, M. Y. (2002). *Performance-effective and low-complexity task scheduling for heterogeneous computing*. IEEE Transactions on Parallel and Distributed Systems, 13(3), 260-274.
