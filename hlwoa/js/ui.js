/**
 * @module ui — HLWOA (Paus)
 * @description Scene 3D tiruan, Gantt chart, grafik konvergensi, kontrol, dan kuis.
 *              Semua data TIRUAN. Tidak ada algoritma sungguhan.
 */

// Impor dinonaktifkan selama prototipe — semua data tiruan
// import { heft } from "./heft.js";
// import { woa, levyFlight } from "./woa.js";

/* ============================================================
   DATA TIRUAN — TODO: ganti dengan data dari simulator
   ============================================================ */
// 8 task untuk demo HEFT (lebar proporsional terhadap waktu eksekusi)
const HEFT_TASKS = [
  { id: 'T1', cost: 18, color: '#0077b6' },
  { id: 'T2', cost: 15, color: '#00b4d8' },
  { id: 'T3', cost: 14, color: '#48cae4' },
  { id: 'T4', cost: 12, color: '#90e0ef' },
  { id: 'T5', cost: 10, color: '#ade8f4' },
  { id: 'T6', cost: 9,  color: '#caf0f8' },
  { id: 'T7', cost: 7,  color: '#023e8a' },
  { id: 'T8', cost: 5,  color: '#03045e' },
];

// Urutan hardcode penempatan HEFT: [taskIdx, vmIdx]
const HEFT_STEPS = [[0,0],[1,1],[2,2],[3,1],[4,2],[5,0],[6,0],[7,2]];

// Gantt data: 4 VM × 12 task (TODO: ganti dengan data dari simulator)
const GANTT = {
  heft: {
    makespan: 72,
    rows: [
      { vm:'VM1', tasks:[{id:'T1',s:0,e:12,c:'#0077b6'},{id:'T5',s:12,e:27,c:'#ade8f4'},{id:'T9',s:27,e:45,c:'#219ebc'}] },
      { vm:'VM2', tasks:[{id:'T2',s:0,e:18,c:'#00b4d8'},{id:'T6',s:18,e:33,c:'#caf0f8'},{id:'T10',s:33,e:55,c:'#468faf'}] },
      { vm:'VM3', tasks:[{id:'T3',s:0,e:10,c:'#48cae4'},{id:'T7',s:10,e:30,c:'#023e8a'},{id:'T11',s:30,e:52,c:'#014f86'}] },
      { vm:'VM4', tasks:[{id:'T4',s:0,e:15,c:'#90e0ef'},{id:'T8',s:15,e:38,c:'#03045e'},{id:'T12',s:38,e:72,c:'#0096c7'}] },
    ]
  },
  hybrid: {
    makespan: 53,
    rows: [
      { vm:'VM1', tasks:[{id:'T1',s:0,e:12,c:'#0077b6'},{id:'T8',s:12,e:28,c:'#03045e'},{id:'T12',s:28,e:50,c:'#0096c7'}] },
      { vm:'VM2', tasks:[{id:'T2',s:0,e:14,c:'#00b4d8'},{id:'T5',s:14,e:29,c:'#ade8f4'},{id:'T10',s:29,e:48,c:'#468faf'}] },
      { vm:'VM3', tasks:[{id:'T3',s:0,e:10,c:'#48cae4'},{id:'T6',s:10,e:22,c:'#caf0f8'},{id:'T9',s:22,e:40,c:'#219ebc'}] },
      { vm:'VM4', tasks:[{id:'T4',s:0,e:15,c:'#90e0ef'},{id:'T7',s:15,e:32,c:'#023e8a'},{id:'T11',s:32,e:53,c:'#014f86'}] },
    ]
  }
};

// Kurva konvergensi tiruan (TODO: ganti dengan data dari simulator)
const CONV_DATA = [];
{ let v = 72;
  for (let i = 0; i <= 50; i++) {
    CONV_DATA.push(v);
    v -= (v - 50) * 0.08 + (Math.sin(i * 0.7) * 0.5); // penurunan eksponensial + noise
    if (v < 53) v = 53;
  }
}

/* ============================================================
   UTILITAS
   ============================================================ */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ============================================================
   THREE.JS — SCENE LAUTAN & PAUS
   ============================================================ */
let scene, camera, renderer, whales = [], bestFish, bubbles = [], clock;
let animState = 'idle'; // idle | encircle | spiral | levy
let mouseX = 0, mouseY = 0, camAngle = 0;
let levyWhaleIdx = -1, levyProgress = 0, levyStart = null, levyEnd = null;
let splashParticles = [];

function initThree() {
  const container = $('#three-container');
  if (!container || typeof THREE === 'undefined') return;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020c1b, 0.035);

  camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 200);
  camera.position.set(0, 12, 18);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Cahaya
  scene.add(new THREE.AmbientLight(0x446688, 0.6));
  const sun = new THREE.DirectionalLight(0x88ccff, 0.9);
  sun.position.set(5, 15, 10);
  scene.add(sun);
  const pointLight = new THREE.PointLight(0x48cae4, 1, 30);
  pointLight.position.set(0, 5, 0);
  scene.add(pointLight);

  // Dasar laut bergelombang
  const floorGeo = new THREE.PlaneGeometry(50, 50, 60, 60);
  const pos = floorGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 0.35) * Math.cos(y * 0.35) * 2.5 - 1);
  }
  pos.needsUpdate = true;
  floorGeo.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshPhongMaterial({
    color: 0x0a4d68, flatShading: true, side: THREE.DoubleSide
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4;
  scene.add(floor);

  // Partikel air (debu laut)
  for (let i = 0; i < 80; i++) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0x90e0ef, transparent: true, opacity: 0.3 })
    );
    dot.position.set((Math.random() - 0.5) * 30, Math.random() * 12 - 2, (Math.random() - 0.5) * 30);
    dot.userData = { vy: Math.random() * 0.01 + 0.005 };
    scene.add(dot);
    bubbles.push(dot);
  }

  // Ikan terbaik (bola bersinar di lembah terdalam)
  bestFish = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 12),
    new THREE.MeshPhongMaterial({ color: 0xffd700, emissive: 0xffa500, emissiveIntensity: 0.8 })
  );
  bestFish.position.set(-4, -2.5, 1);
  scene.add(bestFish);
  const fishGlow = new THREE.PointLight(0xffd700, 1.2, 8);
  fishGlow.position.copy(bestFish.position);
  scene.add(fishGlow);

  // 12 paus
  for (let i = 0; i < 12; i++) {
    const w = createWhale(i === 0);
    const angle = (i / 12) * Math.PI * 2;
    const r = 6 + Math.random() * 3;
    w.position.set(Math.cos(angle) * r, Math.random() * 2, Math.sin(angle) * r);
    w.lookAt(bestFish.position);
    w.userData = {
      home: w.position.clone(),
      idx: i,
      spiralAngle: angle,
      spiralR: r,
      bobOffset: Math.random() * Math.PI * 2,
    };
    scene.add(w);
    whales.push(w);
  }

  // Label melayang "Dari HEFT" (HTML overlay)
  const label = document.createElement('div');
  label.textContent = '⭐ Dari HEFT';
  label.style.cssText = 'position:absolute;top:16px;left:16px;background:rgba(0,119,182,.8);color:#fff;padding:4px 10px;border-radius:1rem;font-size:.7rem;font-weight:700;pointer-events:none';
  container.appendChild(label);

  // Mouse follow
  container.addEventListener('mousemove', e => {
    const rect = container.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  });

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  clock = new THREE.Clock();
  animateThree();
}

function createWhale(isHeft) {
  const g = new THREE.Group();
  const c = isHeft ? 0x48cae4 : 0x0077b6;
  const mat = new THREE.MeshPhongMaterial({ color: c, flatShading: true });

  // Badan (elips)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), mat);
  body.scale.set(1.8, 0.9, 1);
  g.add(body);

  // Kepala
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), mat);
  head.position.set(0.75, 0.1, 0);
  g.add(head);

  // Ekor
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 4), mat);
  tail.position.set(-1, 0.1, 0);
  tail.rotation.z = Math.PI / 2;
  g.add(tail);

  // Sirip atas
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 4), mat);
  fin.position.set(0, 0.5, 0);
  g.add(fin);

  if (isHeft) {
    // Cahaya biru di paus HEFT
    const glow = new THREE.PointLight(0x48cae4, 0.8, 5);
    glow.position.set(0, 0.5, 0);
    g.add(glow);
  }

  return g;
}

function animateThree() {
  requestAnimationFrame(animateThree);
  const dt = clock.getDelta();
  const t = clock.getElapsedTime();
  camAngle += dt * 0.15;

  // Kamera berputar + mouse follow
  const camR = 20;
  camera.position.x = Math.cos(camAngle) * camR + mouseX * 3;
  camera.position.z = Math.sin(camAngle) * camR + mouseY * 2;
  camera.position.y = 10 - mouseY * 2;
  camera.lookAt(0, 0, 0);

  // Partikel naik
  bubbles.forEach(b => {
    b.position.y += b.userData.vy;
    if (b.position.y > 10) b.position.y = -3;
  });

  // Ikan bergoyang
  bestFish.position.y = -2.5 + Math.sin(t * 2) * 0.2;

  // Animasi paus berdasarkan state
  whales.forEach((w, i) => {
    const bob = Math.sin(t * 1.5 + w.userData.bobOffset) * 0.15;

    if (animState === 'encircle') {
      // Paus mendekat pelan ke ikan
      const target = bestFish.position;
      w.position.x += (target.x + Math.cos(w.userData.spiralAngle) * 2 - w.position.x) * 0.01;
      w.position.z += (target.z + Math.sin(w.userData.spiralAngle) * 2 - w.position.z) * 0.01;
      w.position.y = target.y + bob + 1;
      w.lookAt(target);
    } else if (animState === 'spiral') {
      // Spiral bubble-net: berputar mendekat
      w.userData.spiralAngle += dt * (1.5 + i * 0.1);
      w.userData.spiralR = Math.max(1.5, w.userData.spiralR - dt * 0.3);
      const sr = w.userData.spiralR;
      const sa = w.userData.spiralAngle;
      w.position.x = bestFish.position.x + Math.cos(sa) * sr;
      w.position.z = bestFish.position.z + Math.sin(sa) * sr;
      w.position.y = bestFish.position.y + 1 + bob;
      w.lookAt(bestFish.position);
    } else if (animState === 'levy' && i === levyWhaleIdx) {
      // Paus terpilih melompat
      levyProgress = Math.min(levyProgress + dt * 0.8, 1);
      const p = levyProgress;
      const arc = Math.sin(p * Math.PI) * 8; // lompatan parabola
      w.position.x = levyStart.x + (levyEnd.x - levyStart.x) * p;
      w.position.z = levyStart.z + (levyEnd.z - levyStart.z) * p;
      w.position.y = levyStart.y + arc;

      // Cipratan saat mendarat
      if (p >= 1 && splashParticles.length === 0) {
        for (let j = 0; j < 15; j++) {
          const sp = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0x90e0ef, transparent: true, opacity: 0.8 })
          );
          sp.position.copy(w.position);
          sp.userData = {
            vx: (Math.random() - 0.5) * 4,
            vy: Math.random() * 4 + 2,
            vz: (Math.random() - 0.5) * 4,
            life: 1
          };
          scene.add(sp);
          splashParticles.push(sp);
        }
        animState = 'idle';
        updateMakespan(53 + Math.random() * 5);
      }
    } else {
      // Idle: mengambang
      w.position.y = w.userData.home.y + bob;
    }
  });

  // Animasi cipratan
  splashParticles.forEach((sp, idx) => {
    sp.position.x += sp.userData.vx * dt;
    sp.position.y += sp.userData.vy * dt;
    sp.position.z += sp.userData.vz * dt;
    sp.userData.vy -= 9.8 * dt;
    sp.userData.life -= dt * 1.5;
    sp.material.opacity = Math.max(0, sp.userData.life);
    if (sp.userData.life <= 0) {
      scene.remove(sp);
      splashParticles.splice(idx, 1);
    }
  });

  renderer.render(scene, camera);
}

/* ============================================================
   DEMO HEFT — LANGKAH DEMI LANGKAH
   ============================================================ */
let heftStep = 0;
const vmLoads = [0, 0, 0]; // akumulasi beban tiap VM

function initHeftDemo() {
  const queue = $('#task-queue');
  queue.innerHTML = '';
  HEFT_TASKS.forEach(t => {
    const el = document.createElement('div');
    el.className = 'task-block';
    el.style.width = t.cost * 5 + 'px';
    el.style.background = t.color;
    el.textContent = t.id;
    el.id = 'tq-' + t.id;
    queue.appendChild(el);
  });
  vmLoads.fill(0);
  $$('.lane-bar').forEach(l => l.innerHTML = '');
  heftStep = 0;
}

function heftNextStep() {
  if (heftStep >= HEFT_STEPS.length) return;
  const [ti, vi] = HEFT_STEPS[heftStep];
  const task = HEFT_TASKS[ti];

  // Hapus dari antrian
  const tqEl = $('#tq-' + task.id);
  if (tqEl) tqEl.style.display = 'none';

  // Tambah ke lane VM
  const lane = $(`.lane-bar[data-vm="${vi}"]`);
  const el = document.createElement('div');
  el.className = 'lane-task';
  el.style.width = task.cost * 5 + 'px';
  el.style.background = task.color;
  el.textContent = task.id;
  lane.appendChild(el);

  vmLoads[vi] += task.cost;
  heftStep++;
}

/* ============================================================
   GANTT CHART
   ============================================================ */
let currentGanttTab = 'heft';

function renderGantt(tab) {
  currentGanttTab = tab;
  const data = GANTT[tab];
  const chart = $('#gantt-chart');
  const legend = $('#gantt-legend');
  const scale = 100 / data.makespan; // persen per unit waktu

  chart.innerHTML = '';
  data.rows.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'gantt-row';
    rowEl.innerHTML = `<span class="gantt-vm">${row.vm}</span><div class="gantt-bar-area"></div>`;
    const area = rowEl.querySelector('.gantt-bar-area');
    row.tasks.forEach(t => {
      const bar = document.createElement('div');
      bar.className = 'gantt-task';
      bar.style.left = (t.s * scale) + '%';
      bar.style.width = ((t.e - t.s) * scale) + '%';
      bar.style.background = t.c;
      bar.textContent = t.id;
      bar.title = `${t.id}: ${t.s}–${t.e}`;
      area.appendChild(bar);
    });
    chart.appendChild(rowEl);
  });

  // Label makespan
  const msEl = document.createElement('div');
  msEl.className = 'gantt-makespan';
  msEl.textContent = `Makespan: ${data.makespan} ${tab === 'hybrid' ? '✅ (lebih kecil!)' : ''}`;
  chart.appendChild(msEl);

  // Legend
  const allTasks = data.rows.flatMap(r => r.tasks);
  legend.innerHTML = '';
  allTasks.forEach(t => {
    const sp = document.createElement('span');
    sp.style.background = t.c;
    sp.textContent = t.id;
    legend.appendChild(sp);
  });
}

/* ============================================================
   KURVA KONVERGENSI (SVG)
   ============================================================ */
function renderConvergence() {
  const container = $('#conv-chart');
  const W = 800, H = 200, PAD = 40;
  const xScale = (W - PAD * 2) / 50;
  const yMin = 50, yMax = 75;
  const yScale = (H - PAD * 2) / (yMax - yMin);

  let pathD = '';
  CONV_DATA.forEach((v, i) => {
    const x = PAD + i * xScale;
    const y = H - PAD - (v - yMin) * yScale;
    pathD += (i === 0 ? 'M' : 'L') + `${x},${y}`;
  });

  // Garis HEFT acuan
  const heftY = H - PAD - (72 - yMin) * yScale;

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <rect x="${PAD}" y="${PAD}" width="${W-PAD*2}" height="${H-PAD*2}" fill="rgba(255,255,255,.03)" rx="4"/>
      <!-- Garis acuan HEFT -->
      <line x1="${PAD}" y1="${heftY}" x2="${W-PAD}" y2="${heftY}"
            stroke="#ef476f" stroke-width="1.5" stroke-dasharray="6,4"/>
      <text x="${W-PAD-4}" y="${heftY-6}" fill="#ef476f" font-size="10" text-anchor="end">HEFT = 72</text>
      <!-- Kurva konvergensi -->
      <path d="${pathD}" fill="none" stroke="#48cae4" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Label akhir -->
      <text x="${PAD + 50 * xScale + 4}" y="${H - PAD - (53 - yMin) * yScale}" fill="#06d6a0" font-size="10">53</text>
      <!-- Sumbu -->
      <text x="${W/2}" y="${H-6}" fill="#8aaabe" font-size="10" text-anchor="middle">Iterasi</text>
      <text x="8" y="${H/2}" fill="#8aaabe" font-size="10" text-anchor="middle"
            transform="rotate(-90,8,${H/2})">Makespan</text>
    </svg>`;
}

/* ============================================================
   HUD UPDATES
   ============================================================ */
// TODO: ganti dengan data dari simulator
let currentMakespan = 57.3;
let iterasi = 0;
let simRunning = false;
let simTimer = null;
let levyProbability = 0.3; // TODO: ganti dengan data dari simulator

function updateMakespan(val) {
  currentMakespan = Math.round(val * 10) / 10;
  $('#makespan-val').textContent = currentMakespan;
}

function updateProgress(iter) {
  iterasi = iter;
  const pct = (iter / 50) * 100;
  $('#progress-bar').style.width = pct + '%';
  $('#iter-label').textContent = `Iterasi: ${iter} / 50`;
}

function triggerLevyJump() {
  if (whales.length === 0) return;
  levyWhaleIdx = Math.floor(Math.random() * whales.length);
  levyProgress = 0;
  levyStart = whales[levyWhaleIdx].position.clone();
  levyEnd = new THREE.Vector3(
    (Math.random() - 0.5) * 16,
    0,
    (Math.random() - 0.5) * 16
  );
  splashParticles.forEach(sp => scene.remove(sp));
  splashParticles = [];
  animState = 'levy';
}

function runSimulation() {
  if (simRunning) return;
  simRunning = true;
  let i = 0;
  simTimer = setInterval(() => {
    if (i > 50 || !simRunning) { clearInterval(simTimer); simRunning = false; return; }
    updateProgress(i);
    updateMakespan(CONV_DATA[Math.min(i, CONV_DATA.length - 1)]);
    // Munculkan lompatan Lévy tiruan sesuai probabilitas slider
    if (Math.random() < levyProbability * 0.35 && animState !== 'levy') {
      triggerLevyJump();
    }
    i++;
  }, 200);
}

function stopSimulation() {
  simRunning = false;
  if (simTimer) clearInterval(simTimer);
}

/* ============================================================
   QUIZ
   ============================================================ */
function initQuiz() {
  const modal = $('#quiz-modal');
  const fb = $('#quiz-fb');
  if (!modal) return;

  $('#btn-quiz')?.addEventListener('click', () => {
    modal.classList.add('show');
    fb.textContent = '';
    $$('.quiz-opt').forEach(o => o.classList.remove('correct', 'wrong'));
  });

  $('#quiz-close')?.addEventListener('click', () => modal.classList.remove('show'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });

  $$('.quiz-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      $$('.quiz-opt').forEach(o => o.classList.remove('correct', 'wrong'));
      if (opt.dataset.correct === 'true') {
        opt.classList.add('correct');
        fb.textContent = '✅ Benar! Lévy Flight membantu paus melompat jauh untuk keluar dari optimum lokal.';
        fb.style.color = '#06d6a0';
      } else {
        opt.classList.add('wrong');
        fb.textContent = '❌ Kurang tepat. Coba lagi!';
        fb.style.color = '#ef476f';
      }
    });
  });
}

/* ============================================================
   STEPPER NAVIGASI
   ============================================================ */
function initStepper() {
  $$('.step.active').forEach(step => {
    step.addEventListener('click', () => {
      const target = step.dataset.target;
      if (target) document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/* ============================================================
   KONTROL & INISIALISASI
   ============================================================ */
export function initControls() {
  // Stepper
  initStepper();

  // HEFT demo
  initHeftDemo();
  $('#heft-step-btn')?.addEventListener('click', heftNextStep);
  $('#heft-reset-btn')?.addEventListener('click', initHeftDemo);

  // Three.js scene
  initThree();

  // Tombol aksi meta-demo 3D
  $('#btn-encircle')?.addEventListener('click', () => {
    animState = 'encircle';
    updateMakespan(68 - Math.random() * 4); // TODO: ganti dengan data dari simulator
  });
  $('#btn-spiral')?.addEventListener('click', () => {
    animState = 'spiral';
    whales.forEach(w => { w.userData.spiralR = 4 + Math.random() * 3; });
    updateMakespan(58 - Math.random() * 3); // TODO: ganti dengan data dari simulator
  });
  $('#btn-levy')?.addEventListener('click', () => {
    triggerLevyJump();
  });

  // Gantt chart
  renderGantt('heft');
  $$('.gantt-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.gantt-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderGantt(tab.dataset.tab);
    });
  });

  // Konvergensi
  renderConvergence();

  // Kontrol slider
  const levySlider = $('#levy-slider');
  if (levySlider) {
    levySlider.addEventListener('input', () => {
      levyProbability = parseFloat(levySlider.value) / 100;
      $('#levy-val').textContent = levySlider.value + '%';
    });
  }
  const popSlider = $('#pop-slider');
  if (popSlider) {
    popSlider.addEventListener('input', () => {
      const n = parseInt(popSlider.value, 10);
      $('#pop-val').textContent = n;
      whales.forEach((w, idx) => {
        w.visible = idx < n;
      });
    });
  }

  // Simulasi tiruan
  $('#btn-run')?.addEventListener('click', runSimulation);
  $('#btn-stop')?.addEventListener('click', stopSimulation);

  // Kuis
  initQuiz();
}

export { renderGantt, renderConvergence };

// Inisialisasi otomatis saat dokumen siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initControls);
} else {
  initControls();
}
