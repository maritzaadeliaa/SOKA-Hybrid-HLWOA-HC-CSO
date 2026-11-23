import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mannWhitneyU } from "./statistics.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hasil = JSON.parse(
  fs.readFileSync(path.join(root, "results", "hasil.json"), "utf-8"),
);
const datasets = [...new Set(hasil.HEFT.map((r) => r.dataset))];
const pairs = [
  ["HC-CSO", "HLWOA"],
  ["HC-CSO", "HEFT"],
  ["HC-CSO", "TS"],
  ["FPA", "HC-CSO"],
  ["FPA", "HLWOA"],
  ["FPA", "TS"],
];
const alpha = 0.05;

const mk = (m, d) =>
  hasil[m].filter((r) => r.dataset === d).map((r) => r.makespan);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

const hasilUji = {};
console.log(
  "UJI MANN-WHITNEY U PER DATASET (makespan, 10 seed vs 10 seed, alpha = 0.05)\n",
);
console.log(
  "Pasangan".padEnd(18) +
    "Signifikan".padStart(12) +
    "A lebih kecil".padStart(16) +
    "B lebih kecil".padStart(16),
);

for (const [a, b] of pairs) {
  const rows = datasets.map((d) => {
    const x = mk(a, d),
      y = mk(b, d);
    const r = mannWhitneyU(x, y);
    const p = r.pValue ?? r.p;
    return {
      dataset: d,
      meanA: mean(x),
      meanB: mean(y),
      p,
      signifikan: p < alpha,
    };
  });
  const sig = rows.filter((r) => r.signifikan);
  const aMenang = sig.filter((r) => r.meanA < r.meanB).length;
  const bMenang = sig.filter((r) => r.meanB < r.meanA).length;
  hasilUji[`${a} vs ${b}`] = {
    signifikan: sig.length,
    totalDataset: rows.length,
    aLebihKecil: aMenang,
    bLebihKecil: bMenang,
    rows,
  };
  console.log(
    `${a} vs ${b}`.padEnd(18) +
      `${sig.length}/${rows.length}`.padStart(12) +
      String(aMenang).padStart(16) +
      String(bMenang).padStart(16),
  );
}

fs.writeFileSync(
  path.join(root, "results", "uji_per_dataset.json"),
  JSON.stringify({ alpha, metrik: "makespan", hasil: hasilUji }, null, 2),
  "utf-8",
);
console.log("\nTersimpan di results/uji_per_dataset.json");
