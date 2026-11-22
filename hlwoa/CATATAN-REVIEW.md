# Catatan P2 untuk kelompok

## Temuan ablation (20 dataset P1 x 10 seed x 1200 evaluasi; `results/ablation_hlwoa.json`)
| Metode | makespan / HEFT (mean ± std) | waktu scheduler |
|---|---|---|
| HEFT | 1,000000 ± 0 | 0,17 ms |
| WOA saja | 1,437 ± 0,188 | 48 ms |
| HLWOA tanpa Lévy | 1,000000 ± 0 | 44 ms |
| HLWOA | 1,000000 ± 0 | 79 ms |

- HLWOA >> WOA saja (peran HEFT besar). HLWOA = HLWOA tanpa Lévy = HEFT: pada 16 VM dan 1200 evaluasi,
  WOA kontinu per-task tidak menemukan jadwal lebih baik dari HEFT, dan Lévy tidak membantu.
- Dengan anggaran 10.050 evaluasi (paper) hasilnya sama pada GoCJ_100, GoCJ_500, Synthetic_100.
- Celah HEFT ke batas bawah pada dataset ini sangat kecil (metode lain hanya menang ~0,01–0,05%).

## Untuk P1 / P4
1. `simulator/algorithms/hlwoa.js` diganti dengan HLWOA mengikuti paper (versi sebelumnya heuristik pindah-task
   sendiri, bukan rumus WOA/Lévy paper). `hasil.json` dan `ringkasan_statistik.json` perlu dijalankan ulang
   (`npm run export && npm run stats`), lalu README root yang memuat angka HLWOA perlu diperbarui.
2. Setelah dijalankan ulang, HLWOA vs HC-CSO makespan: p = 0,47 (tidak signifikan). Penentuan "pemenang"
   harus berdasarkan uji ini, bukan peringkat mean.
3. Varian ablation (WOA, HLWOA-noLevy) bisa ditambahkan ke runner P4 dengan `runWOA`, `runHLWOANoLevy`.
4. Konfirmasi ke dosen: HEFT untuk task independen (paper untuk workflow).

## Review silang `hc-cso/` (untuk P3)
- `hc-cso/js/cso.js` dan `hc-cso/js/heft.js` masih stub; `hc-cso/js/ui.js` masih data tiruan dan banner "PROTOTIPE".
- `simulator/algorithms/hccso.js` perlu dicocokkan ke paper Bhagwan & Kumar 2021 (termasuk inertia weight).
