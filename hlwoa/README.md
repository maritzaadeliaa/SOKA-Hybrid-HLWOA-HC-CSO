# HLWOA — HEFT + Whale Optimization Algorithm + Lévy Flight

Hybrid task scheduling untuk SOKA Demo 1 (P2). Halaman web mandiri (tidak berbagi kode dengan `hc-cso/`);
algoritmanya ada di simulator bersama: `simulator/algorithms/hlwoa.js`.

**Sumber:** Cui, M. & Wang, Y. (2025). An Effective QoS-Aware Hybrid Optimization Approach for Workflow
Scheduling in Cloud Computing. *Sensors*, 25(15), 4705. https://doi.org/10.3390/s25154705

## Cara kerja singkat
1. **HEFT** (`simulator/heft.js`) mengurutkan task (terbesar dulu untuk task independen) dan memasang tiap task
   ke VM dengan *earliest finish time*.
2. **Populasi WOA**: P-1 individu acak + 1 individu HEFT.
3. Tiap iterasi tiap paus memilih satu gerakan: mengepung mangsa (p < 0,5), jaring gelembung/spiral
   (p ≥ 0,5 dan φ < 0,5), atau gangguan **Lévy flight** (selebihnya). Pers. 24–34 paper.
4. Solusi terbaik global diganti hanya bila lebih baik, jadi hasil tidak pernah lebih buruk dari HEFT.

## Varian (ablation)
`runHLWOA` (hybrid penuh), `runHLWOANoLevy` (tanpa Lévy), `runWOA` (WOA saja), plus `HEFT` dari `runHeft`.
Semua memakai anggaran evaluasi sama (`maxEvals`, 1200 di eksperimen P1) dan 10 seed yang sama.

## Menjalankan (dari akar repo)
```bash
node tests/test_hlwoa_p2.js             # uji HLWOA
node simulator/ablationHLWOA.js         # ablation 20 dataset -> results/ablation_hlwoa.json (~35 detik)
node hlwoa/scripts/build-demo-data.mjs  # bangun ulang hlwoa/js/demo-data.js untuk web
python3 -m http.server                  # buka http://localhost:8000/hlwoa/index.html
```

## Adaptasi dari paper (sebut di slide)
| Hal | Paper | Di sini |
|---|---|---|
| Masalah | workflow DAG (WorkflowSim) | task independen, HEFT = urut ukuran menurun + EFT |
| Langkah Lévy (Pers. 34) | α = 0,01 dan faktor `rand` | α = 1,0 (satuan indeks VM), tanpa `rand`; sapuan α tidak mengubah kesimpulan |
| Fitness | 0,5·makespan + 0,5·biaya | makespan murni agar sama dengan metode lain |
| Populasi / iterasi | 50 / 200 | populasi 20, iterasi dari anggaran 1200 evaluasi (59 iterasi) |

## Yang masih sementara
- Banner "Hasil sementara" tetap tampil sampai `results/hasil.json` final dari P4 dijalankan ulang dengan HLWOA versi ini.
- Web memakai instance demo 8 task x 3 VM dari GoCJ_100 (bukan eksperimen penuh). Animasi hewan 3D hanyalah ilustrasi.
