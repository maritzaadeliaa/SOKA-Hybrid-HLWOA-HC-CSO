/**
 * 3 soal kuis HLWOA (tugas pendukung P2). Format sederhana supaya mudah dipasang ke komponen
 * modal kuis buatan P5: { q, options, answer (indeks 0-based), explanation }.
 */
export const QUIZ_HLWOA = [
  {
    q: 'Apa peran HEFT di dalam HLWOA?',
    options: [
      'Menggantikan seluruh gerakan paus pada setiap iterasi',
      'Menyumbang satu individu awal berkualitas ke populasi, sisanya diacak',
      'Menghitung biaya VM setelah WOA selesai',
      'Mengurutkan ulang populasi di akhir setiap iterasi',
    ],
    answer: 1,
    explanation: 'Populasi awal berisi P-1 individu acak ditambah 1 solusi HEFT. Solusi HEFT memberi titik awal yang bagus sehingga konvergensi lebih cepat.',
  },
  {
    q: 'Mengapa Lévy flight ditambahkan ke WOA?',
    options: [
      'Karena langkahnya selalu besar sehingga algoritma lebih cepat selesai',
      'Karena langkahnya berdistribusi ekor berat: kebanyakan kecil, sesekali sangat jauh, sehingga bisa melompat keluar dari optimum lokal',
      'Karena Lévy flight menggantikan fungsi fitness',
      'Karena Lévy flight menjamin menemukan optimum global',
    ],
    answer: 1,
    explanation: 'Saat populasi menumpuk di satu daerah, langkah WOA biasa mengecil. Lompatan jauh sesekali dari distribusi Lévy mengembalikan keragaman pencarian. Tidak ada jaminan optimum global.',
  },
  {
    q: 'Mengapa makespan terbaik HLWOA tidak pernah lebih buruk daripada HEFT saja?',
    options: [
      'Karena WOA selalu menemukan solusi yang lebih baik dari HEFT',
      'Karena solusi HEFT ada di populasi awal dan solusi terbaik global hanya diganti bila ditemukan yang lebih baik',
      'Karena HEFT dijalankan ulang setiap iterasi',
      'Karena Lévy flight membuang semua solusi yang lebih buruk',
    ],
    answer: 1,
    explanation: 'Solusi terbaik global dimulai dari yang terbaik di populasi awal (paling buruk, HEFT sendiri) dan hanya diperbarui bila ada yang lebih baik. Jadi hasilnya sama dengan HEFT atau lebih baik, tetapi tidak harus lebih baik.',
  },
];
