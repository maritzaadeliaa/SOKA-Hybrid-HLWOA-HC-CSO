/**
 * @module quiz-data
 * @description Bank soal kuis konseptual (3 pertanyaan pilihan ganda) untuk modul pembelajaran
 * interaktif Hybrid HEFT + Cat Swarm Optimization (HC-CSO) — Peran P3.
 *
 * Referensi Konseptual:
 * Jai Bhagwan & Sanjeev Kumar (2021), "An HC-CSO Algorithm for Workflow Scheduling
 * in Heterogeneous Cloud Computing System", IJACSA Vol. 12, No. 6, pp. 484-492.
 *
 * Catatan:
 * - Mendukung impor ES Module (`import { QUIZ_DATA } from './quiz-data.js'`)
 *   maupun akses global (`window.QUIZ_DATA`).
 */

export const QUIZ_META = {
  title: "Kuis Konseptual: Hybrid HEFT + Cat Swarm Optimization (HC-CSO)",
  subtitle:
    "Uji pemahaman mengenai inisialisasi HEFT, perilaku Seeking/Tracing CSO, dan Self-Motivated Inertia Weight.",
  totalQuestions: 3,
  passingScore: 2,
  reference: "Bhagwan & Kumar (2021) — IJACSA Vol. 12, No. 6",
};

export const QUIZ_QUESTIONS = [
  {
    id: "q1-heft-warmstart",
    number: 1,
    topic: "Inisialisasi Populasi (Warm-Start HEFT)",
    question:
      "Mengapa pada algoritma hibrida HC-CSO, populasi awal kucing tidak seluruhnya dibangkitkan secara acak melainkan diinisialisasi menggunakan solusi dari heuristik HEFT (Heterogeneous Earliest Finish Time)?",
    options: [
      {
        key: "A",
        text: "Untuk menghapus kebutuhan evaluasi fungsi fitness selama seluruh iterasi Cat Swarm Optimization.",
      },
      {
        key: "B",
        text: "Untuk memberikan titik awal (warm-start) jadwal yang sudah mempertimbangkan prioritas ukuran task dan kecepatan VM sehingga mempercepat konvergensi serta menghindari stagnansi awal.",
      },
      {
        key: "C",
        text: "Karena HEFT secara matematis selalu menjamin solusi optimal global untuk semua variasi beban kerja cloud.",
      },
      {
        key: "D",
        text: "Untuk memaksa seluruh agen kucing tetap berada pada Seeking Mode dari iterasi pertama hingga terakhir.",
      },
    ],
    correctIndex: 1,
    correctKey: "B",
    explanation:
      "Inisialisasi acak murni (seperti pada CSO standar) sering menghasilkan pemetaan awal yang tidak seimbang pada lingkungan VM heterogen sehingga menghabiskan banyak iterasi hanya untuk memperbaiki jadwal yang buruk. Dengan menyuntikkan solusi HEFT ke populasi awal (warm-start), HC-CSO langsung memulai pencarian dari jadwal yang terstruktur rapi dan memanfaatkan operator CSO untuk menekan makespan lebih jauh.",
  },
  {
    id: "q2-seeking-vs-tracing",
    number: 2,
    topic: "Mekanisme Seeking Mode & Tracing Mode",
    question:
      "Dalam mekanisme Cat Swarm Optimization (CSO), bagaimana Mixing Ratio (MR) membagi perilaku agen kucing antara Seeking Mode dan Tracing Mode pada setiap iterasi?",
    options: [
      {
        key: "A",
        text: "Seeking Mode menggerakkan seluruh kucing secara agresif menuju solusi terbaik global (X_best), sedangkan Tracing Mode menahan posisi kucing agar tidak berubah.",
      },
      {
        key: "B",
        text: "Seeking Mode hanya dijalankan satu kali di awal program, sedangkan Tracing Mode dijalankan pada sisa iterasi berikutnya.",
      },
      {
        key: "C",
        text: "Seeking Mode melakukan eksplorasi lokal di sekitar posisi kucing menggunakan Seeking Memory Pool (SMP) dan mutasi terarah, sedangkan Tracing Mode memperbarui kecepatan kucing menuju posisi terbaik global (X_best).",
      },
      {
        key: "D",
        text: "Seeking Mode bertugas menghitung tarif biaya VM, sedangkan Tracing Mode bertugas mengurutkan panjang instruksi (MI) task.",
      },
    ],
    correctIndex: 2,
    correctKey: "C",
    explanation:
      "Parameter Mixing Ratio (MR, umumnya bernilai kecil seperti 0.2–0.3) menentukan proporsi kucing yang masuk ke Tracing Mode untuk bergerak cepat mengikuti vektor kecepatan menuju solusi terbaik global (X_best). Mayoritas kucing lainnya berada pada Seeking Mode untuk mengevaluasi beberapa kandidat mutasi lokal di Seeking Memory Pool (SMP), sehingga keseimbangan antara pencarian lokal (eksploitasi) dan pergerakan terarah (eksplorasi) tetap terjaga.",
  },
  {
    id: "q3-smiw-inertia",
    number: 3,
    topic: "Self-Motivated Inertia Weight (SMIW)",
    question:
      "Berdasarkan formulasi Bhagwan & Kumar (2021), apa fungsi utama penerapan Self-Motivated Inertia Weight (γ = γ_max · exp(-c · (iter / maxIter)^c)) pada persamaan pembaruan kecepatan di Tracing Mode?",
    options: [
      {
        key: "A",
        text: "Menjaga nilai kecepatan kucing tetap konstan maksimal hingga iterasi terakhir agar perpindahan VM selalu acak.",
      },
      {
        key: "B",
        text: "Mengatur peluruhan bobot inersia secara adaptif seiring bertambahnya iterasi untuk menyeimbangkan eksplorasi awal dengan eksploitasi akhir serta mencegah lonjakan kecepatan berlebih (velocity outrange).",
      },
      {
        key: "C",
        text: "Menggantikan metrik objektif makespan menjadi fungsi minimasi jumlah Virtual Machine yang dinyalakan.",
      },
      {
        key: "D",
        text: "Menghapus memori solusi terbaik pribadi (pBest) setiap kali terjadi pergantian iterasi.",
      },
    ],
    correctIndex: 1,
    correctKey: "B",
    explanation:
      "Self-Motivated Inertia Weight (γ) meluruh secara eksponensial non-linear dari iterasi awal menuju iterasi akhir. Pada iterasi awal, nilai γ yang lebih besar memberi ruang eksplorasi luas agar kucing tidak terjebak di optimum lokal; menjelang akhir iterasi, γ mengecil untuk meredam kecepatan sehingga kucing melakukan pencarian halus di sekitar solusi terbaik tanpa mengalami velocity outrange.",
  },
];

export const QUIZ_DATA = {
  meta: QUIZ_META,
  questions: QUIZ_QUESTIONS,
};

if (typeof window !== "undefined") {
  window.QUIZ_DATA = QUIZ_DATA;
}

export default QUIZ_DATA;
