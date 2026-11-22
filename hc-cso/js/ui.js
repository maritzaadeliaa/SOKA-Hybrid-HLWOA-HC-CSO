/**
 * @module ui — HC-CSO (Kucing)
 * @description Scene 3D tiruan, Gantt chart, grafik konvergensi, kontrol, dan kuis.
 *              Semua data TIRUAN. Tidak ada algoritma sungguhan.
 */

// Impor dinonaktifkan selama prototipe — semua data tiruan
// import { heft } from "./heft.js";
// import { cso, seeking, tracing } from "./cso.js";

/* ============================================================
   DATA TIRUAN — TODO: ganti dengan data dari simulator
   ============================================================ */
const HEFT_TASKS = [
  { id: 'T1', cost: 18, color: '#e76f51' },
  { id: 'T2', cost: 15, color: '#f4a261' },
  { id: 'T3', cost: 14, color: '#e9c46a' },
  { id: 'T4', cost: 12, color: '#2a9d8f' },
  { id: 'T5', cost: 10, color: '#264653' },
  { id: 'T6', cost: 9,  color: '#d4a373' },
  { id: 'T7', cost: 7,  color: '#bc6c25' },
  { id: 'T8', cost: 5,  color: '#606c38' },
];

const HEFT_STEPS = [[0,0],[1,1],[2,2],[3,1],[4,2],[5,0],[6,0],[7,2]];

// Gantt data: 4 VM × 12 task (TODO: ganti dengan data dari simulator)
const GANTT = {
  heft: {
    makespan: 72,
    rows: [
      { vm:'VM1', tasks:[{id:'T1',s:0,e:12,c:'#e76f51'},{id:'T5',s:12,e:27,c:'#264653'},{id:'T9',s:27,e:45,c:'#bc6c25'}] },
      { vm:'VM2', tasks:[{id:'T2',s:0,e:18,c:'#f4a261'},{id:'T6',s:18,e:33,c:'#d4a373'},{id:'T10',s:33,e:55,c:'#dda15e'}] },
      { vm:'VM3', tasks:[{id:'T3',s:0,e:10,c:'#e9c46a'},{id:'T7',s:10,e:30,c:'#bc6c25'},{id:'T11',s:30,e:52,c:'#606c38'}] },
      { vm:'VM4', tasks:[{id:'T4',s:0,e:15,c:'#2a9d8f'},{id:'T8',s:15,e:38,c:'#606c38'},{id:'T12',s:38,e:72,c:'#9b2226'}] },
    ]
  },
  hybrid: {
    makespan: 55,
    rows: [
      { vm:'VM1', tasks:[{id:'T1',s:0,e:12,c:'#e76f51'},{id:'T8',s:12,e:28,c:'#606c38'},{id:'T12',s:28,e:52,c:'#9b2226'}] },
      { vm:'VM2', tasks:[{id:'T2',s:0,e:14,c:'#f4a261'},{id:'T5',s:14,e:29,c:'#264653'},{id:'T10',s:29,e:48,c:'#dda15e'}] },
      { vm:'VM3', tasks:[{id:'T3',s:0,e:10,c:'#e9c46a'},{id:'T6',s:10,e:22,c:'#d4a373'},{id:'T9',s:22,e:42,c:'#bc6c25'}] },
      { vm:'VM4', tasks:[{id:'T4',s:0,e:15,c:'#2a9d8f'},{id:'T7',s:15,e:32,c:'#bc6c25'},{id:'T11',s:32,e:55,c:'#606c38'}] },
    ]
  }
};

// Kurva konvergensi tiruan (TODO: ganti dengan data dari simulator)
const CONV_DATA = [];
{ let v = 72;
  for (let i = 0; i <= 50; i++) {
    CONV_DATA.push(v);
    v -= (v - 52) * 0.07 + (Math.cos(i * 0.6) * 0.4);
    if (v < 55) v = 55;
  }
}

/* ============================================================
   UTILITAS
   ============================================================ */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ============================================================
   THREE.JS — RUANGAN LOW-POLY & KUCING
   ============================================================ */
let scene, camera, renderer, cats = [], yarnBall, clock;
let animState = 'idle'; // idle | seeking | tracing | mix
let mouseX = 0, mouseY = 0, camAngle = 0;
let ghostMeshes = [];
let inertiaWeight = 0.5; // TODO: ganti dengan data dari simulator

function initThree() {
  const container = $('#three-container');
  if (!container || typeof THREE === 'undefined') return;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a0a04, 0.03);

  camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 200);
  camera.position.set(0, 12, 18);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Cahaya
  scene.add(new THREE.AmbientLight(0x886644, 0.5));
  const warm = new THREE.DirectionalLight(0xffcc88, 0.8);
  warm.position.set(5, 15, 10);
  scene.add(warm);
  const spotOrange = new THREE.PointLight(0xf4a261, 0.8, 30);
  spotOrange.position.set(0, 8, 0);
  scene.add(spotOrange);

  // Lantai bergelombang (ruangan)
  const floorGeo = new THREE.PlaneGeometry(50, 50, 60, 60);
  const pos = floorGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 0.3) * Math.cos(y * 0.4) * 2 - 0.5);
  }
  pos.needsUpdate = true;
  floorGeo.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshPhongMaterial({
    color: 0x5c3a1e, flatShading: true, side: THREE.DoubleSide
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4;
  scene.add(floor);

  // Dinding belakang
  const wallGeo = new THREE.PlaneGeometry(50, 15);
  const wall = new THREE.Mesh(wallGeo, new THREE.MeshPhongMaterial({ color: 0x3d2b1f, flatShading: true }));
  wall.position.set(0, 3, -25);
  scene.add(wall);

  // Debu mengambang (partikel debu)
  for (let i = 0; i < 50; i++) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0xf4a261, transparent: true, opacity: 0.25 })
    );
    dot.position.set((Math.random() - 0.5) * 25, Math.random() * 8 - 1, (Math.random() - 0.5) * 25);
    dot.userData = { vx: (Math.random() - 0.5) * 0.005, vy: Math.random() * 0.003 + 0.002 };
    scene.add(dot);
  }

  // Bola benang (target terbaik)
  yarnBall = new THREE.Group();
  const ballCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 10, 10),
    new THREE.MeshPhongMaterial({ color: 0xe9c46a, emissive: 0xf4a261, emissiveIntensity: 0.6 })
  );
  yarnBall.add(ballCore);
  // Benang melilit (torus kecil)
  for (let i = 0; i < 3; i++) {
    const thread = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.04, 6, 12),
      new THREE.MeshPhongMaterial({ color: 0xe76f51 })
    );
    thread.rotation.x = i * 0.8;
    thread.rotation.y = i * 1.2;
    yarnBall.add(thread);
  }
  yarnBall.position.set(-3, -2.5, 2);
  scene.add(yarnBall);
  const yarnGlow = new THREE.PointLight(0xe9c46a, 1, 8);
  yarnGlow.position.copy(yarnBall.position);
  scene.add(yarnGlow);

  // 12 kucing
  for (let i = 0; i < 12; i++) {
    const cat = createCat(i === 0);
    const angle = (i / 12) * Math.PI * 2;
    const r = 5 + Math.random() * 4;
    cat.position.set(Math.cos(angle) * r, -3.2, Math.sin(angle) * r);
    cat.lookAt(yarnBall.position.x, cat.position.y, yarnBall.position.z);
    cat.userData = {
      home: cat.position.clone(),
      idx: i,
      angle: angle,
      bobOffset: Math.random() * Math.PI * 2,
      seekTarget: null,
    };
    scene.add(cat);
    cats.push(cat);
  }

  // Label "Dari HEFT" (HTML overlay)
  const label = document.createElement('div');
  label.textContent = '⭐ Dari HEFT';
  label.style.cssText = 'position:absolute;top:16px;left:16px;background:rgba(231,111,81,.8);color:#fff;padding:4px 10px;border-radius:1rem;font-size:.7rem;font-weight:700;pointer-events:none';
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

function createCat(isHeft) {
  const g = new THREE.Group();
  const c = isHeft ? 0xf4a261 : 0xe76f51;
  const mat = new THREE.MeshPhongMaterial({ color: c, flatShading: true });

  // Badan
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.4), mat);
  g.add(body);

  // Kepala
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), mat);
  head.position.set(0.45, 0.2, 0);
  g.add(head);

  // Telinga
  const earMat = new THREE.MeshPhongMaterial({ color: 0xffb4a2, flatShading: true });
  const earGeo = new THREE.ConeGeometry(0.08, 0.18, 4);
  const ear1 = new THREE.Mesh(earGeo, earMat);
  ear1.position.set(0.42, 0.42, 0.1);
  g.add(ear1);
  const ear2 = new THREE.Mesh(earGeo, earMat);
  ear2.position.set(0.42, 0.42, -0.1);
  g.add(ear2);

  // Ekor
  const tail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.025, 0.55, 4),
    mat
  );
  tail.position.set(-0.45, 0.25, 0);
  tail.rotation.z = Math.PI / 3.5;
  g.add(tail);

  // Kaki (4 buah)
  const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.22, 4);
  [[-0.18, -0.3, 0.13], [-0.18, -0.3, -0.13], [0.18, -0.3, 0.13], [0.18, -0.3, -0.13]].forEach(([lx, ly, lz]) => {
    g.add(new THREE.Mesh(legGeo, mat).translateX(lx).translateY(ly).translateZ(lz));
  });

  // Mata
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const eyeGeo = new THREE.SphereGeometry(0.04, 4, 4);
  const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
  eye1.position.set(0.62, 0.25, 0.08);
  g.add(eye1);
  const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
  eye2.position.set(0.62, 0.25, -0.08);
  g.add(eye2);

  if (isHeft) {
    // Kalung bercahaya
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.03, 6, 12),
      new THREE.MeshPhongMaterial({ color: 0xe9c46a, emissive: 0xf4a261, emissiveIntensity: 0.7 })
    );
    collar.position.set(0.35, 0.05, 0);
    collar.rotation.y = Math.PI / 2;
    g.add(collar);
    const glow = new THREE.PointLight(0xf4a261, 0.6, 4);
    glow.position.set(0, 0.3, 0);
    g.add(glow);
  }

  return g;
}

function clearGhosts() {
  ghostMeshes.forEach(gm => scene.remove(gm));
  ghostMeshes = [];
}

function animateThree() {
  requestAnimationFrame(animateThree);
  const dt = clock.getDelta();
  const t = clock.getElapsedTime();
  camAngle += dt * 0.15;

  // Kamera berputar + mouse
  const camR = 20;
  camera.position.x = Math.cos(camAngle) * camR + mouseX * 3;
  camera.position.z = Math.sin(camAngle) * camR + mouseY * 2;
  camera.position.y = 10 - mouseY * 2;
  camera.lookAt(0, -1, 0);

  // Bola benang bergoyang
  yarnBall.rotation.y += dt * 0.5;
  yarnBall.position.y = -2.5 + Math.sin(t * 1.5) * 0.15;

  // Animasi kucing
  cats.forEach((cat, i) => {
    const bob = Math.sin(t * 2 + cat.userData.bobOffset) * 0.05;

    if (animState === 'seeking') {
      // Kucing duduk, menoleh perlahan, lalu pindah sedikit
      cat.rotation.y += Math.sin(t * 3 + i) * dt * 0.3;
      cat.position.y = cat.userData.home.y + bob;

      // Tampilkan 3 bayangan posisi coba (transparan) jika belum ada
      if (ghostMeshes.length === 0) {
        cats.slice(0, 4).forEach(c => {
          for (let j = 0; j < 3; j++) {
            const ghost = createCat(false);
            ghost.traverse(child => {
              if (child.material) {
                child.material = child.material.clone();
                child.material.transparent = true;
                child.material.opacity = 0.25;
              }
            });
            ghost.position.set(
              c.position.x + (Math.random() - 0.5) * 3,
              c.position.y,
              c.position.z + (Math.random() - 0.5) * 3
            );
            ghost.scale.set(0.8, 0.8, 0.8);
            scene.add(ghost);
            ghostMeshes.push(ghost);
          }
        });
      }

      // Bayangan berkedip
      ghostMeshes.forEach(gm => {
        gm.traverse(child => {
          if (child.material && child.material.transparent) {
            child.material.opacity = 0.12 + Math.sin(t * 4) * 0.1;
          }
        });
      });

    } else if (animState === 'tracing') {
      clearGhosts();
      // Kucing berlari mengejar kucing terbaik (kucing 0)
      const best = cats[0].position;
      // Pengaruh inertiaWeight:
      // Kiri (0) = Ikut yang terbaik (lurus dan cepat ke kucing terbaik)
      // Kanan (1) = Keras kepala (banyak bergerak dengan inersia / sudut sendiri)
      const speed = 0.9 + (1 - inertiaWeight) * 1.5;
      const wander = inertiaWeight * 2.8;
      cat.position.x += (best.x + Math.cos(cat.userData.angle + t * wander) * (1.2 + inertiaWeight * 2) - cat.position.x) * dt * speed;
      cat.position.z += (best.z + Math.sin(cat.userData.angle + t * wander) * (1.2 + inertiaWeight * 2) - cat.position.z) * dt * speed;
      cat.position.y = cat.userData.home.y + Math.abs(Math.sin(t * (4 + (1 - inertiaWeight) * 4) + i)) * 0.15;
      cat.lookAt(best.x, cat.position.y, best.z);

    } else if (animState === 'mix') {
      // Separuh seeking, separuh tracing
      if (i % 2 === 0) {
        // seeking
        cat.rotation.y += Math.sin(t * 2 + i) * dt * 0.2;
        cat.position.y = cat.userData.home.y + bob;
      } else {
        // tracing
        const best = cats[0].position;
        cat.position.x += (best.x + Math.cos(cat.userData.angle) * 2 - cat.position.x) * dt * 0.8;
        cat.position.z += (best.z + Math.sin(cat.userData.angle) * 2 - cat.position.z) * dt * 0.8;
        cat.position.y = cat.userData.home.y + Math.abs(Math.sin(t * 5 + i)) * 0.1;
        cat.lookAt(best.x, cat.position.y, best.z);
      }
    } else {
      // Idle
      clearGhosts();
      cat.position.y = cat.userData.home.y + bob;
      cat.rotation.y += Math.sin(t * 0.5 + i * 0.7) * dt * 0.08;
    }
  });

  renderer.render(scene, camera);
}

/* ============================================================
   DEMO HEFT — LANGKAH DEMI LANGKAH
   ============================================================ */
let heftStep = 0;
const vmLoads = [0, 0, 0];

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
  const tqEl = $('#tq-' + task.id);
  if (tqEl) tqEl.style.display = 'none';

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
function renderGantt(tab) {
  const data = GANTT[tab];
  const chart = $('#gantt-chart');
  const legend = $('#gantt-legend');
  const scale = 100 / data.makespan;

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

  const msEl = document.createElement('div');
  msEl.className = 'gantt-makespan';
  msEl.textContent = `Makespan: ${data.makespan} ${tab === 'hybrid' ? '✅ (lebih kecil!)' : ''}`;
  chart.appendChild(msEl);

  legend.innerHTML = '';
  data.rows.flatMap(r => r.tasks).forEach(t => {
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

  const heftY = H - PAD - (72 - yMin) * yScale;

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <rect x="${PAD}" y="${PAD}" width="${W-PAD*2}" height="${H-PAD*2}" fill="rgba(255,255,255,.03)" rx="4"/>
      <line x1="${PAD}" y1="${heftY}" x2="${W-PAD}" y2="${heftY}"
            stroke="#ef476f" stroke-width="1.5" stroke-dasharray="6,4"/>
      <text x="${W-PAD-4}" y="${heftY-6}" fill="#ef476f" font-size="10" text-anchor="end">HEFT = 72</text>
      <path d="${pathD}" fill="none" stroke="#f4a261" stroke-width="2.5" stroke-linecap="round"/>
      <text x="${PAD + 50 * xScale + 4}" y="${H - PAD - (55 - yMin) * yScale}" fill="#06d6a0" font-size="10">55</text>
      <text x="${W/2}" y="${H-6}" fill="#b08968" font-size="10" text-anchor="middle">Iterasi</text>
      <text x="8" y="${H/2}" fill="#b08968" font-size="10" text-anchor="middle"
            transform="rotate(-90,8,${H/2})">Makespan</text>
    </svg>`;
}

/* ============================================================
   HUD UPDATES
   ============================================================ */
// TODO: ganti dengan data dari simulator
let currentMakespan = 57.3;
let simRunning = false;
let simTimer = null;

function updateMakespan(val) {
  currentMakespan = Math.round(val * 10) / 10;
  $('#makespan-val').textContent = currentMakespan;
}

function updateProgress(iter) {
  const pct = (iter / 50) * 100;
  $('#progress-bar').style.width = pct + '%';
  $('#iter-label').textContent = `Iterasi: ${iter} / 50`;
}

function runSimulation() {
  if (simRunning) return;
  simRunning = true;
  let i = 0;
  simTimer = setInterval(() => {
    if (i > 50 || !simRunning) { clearInterval(simTimer); simRunning = false; return; }
    updateProgress(i);
    updateMakespan(CONV_DATA[Math.min(i, CONV_DATA.length - 1)]);
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
        fb.textContent = '✅ Benar! Seeking mengeksplorasi sekitar, Tracing mengejar posisi terbaik.';
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
  initStepper();

  // HEFT demo
  initHeftDemo();
  $('#heft-step-btn')?.addEventListener('click', heftNextStep);
  $('#heft-reset-btn')?.addEventListener('click', initHeftDemo);

  // Three.js scene
  initThree();

  // Tombol aksi meta-demo 3D
  $('#btn-seeking')?.addEventListener('click', () => {
    animState = 'seeking';
    updateMakespan(69 - Math.random() * 3); // TODO: ganti dengan data dari simulator
  });
  $('#btn-tracing')?.addEventListener('click', () => {
    clearGhosts();
    animState = 'tracing';
    updateMakespan(59 - Math.random() * 4); // TODO: ganti dengan data dari simulator
  });
  $('#btn-mix')?.addEventListener('click', () => {
    clearGhosts();
    animState = 'mix';
    updateMakespan(55 + Math.random() * 3); // TODO: ganti dengan data dari simulator
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
  const inertiaSlider = $('#inertia-slider');
  if (inertiaSlider) {
    inertiaSlider.addEventListener('input', () => {
      inertiaWeight = parseFloat(inertiaSlider.value) / 100;
      $('#inertia-val').textContent = inertiaWeight.toFixed(2);
    });
  }
  const popSlider = $('#pop-slider');
  if (popSlider) {
    popSlider.addEventListener('input', () => {
      const n = parseInt(popSlider.value, 10);
      $('#pop-val').textContent = n;
      cats.forEach((c, idx) => {
        c.visible = idx < n;
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
