/**
 * @module ui — HLWOA (Paus) — Satu Layar Terpadu
 * @description Prototipe tampilan 3D satu layar: Antrean Kasir HEFT (zona depan)
 *              menyatu dengan Lautan Paus WOA + Lévy (zona belakang).
 *              Data (makespan, beban VM, kurva) berasal dari algoritma sungguhan lewat js/demo-data.js;
 *              posisi dan gerak hewan 3D hanyalah ILUSTRASI.
 */

/* ============================================================
   DATA NYATA dari algoritma (js/demo-data.js, dibuat scripts/build-demo-data.mjs)
   Instance demo 8 task x 3 VM. BUKAN dataset minggu 3.
   TODO: ganti ke keluaran simulator P1 + hasil.json final dari P4 setelah tersedia.
   ============================================================ */
import { DEMO } from './demo-data.js';
import { QUIZ_HLWOA } from './quiz-data.js';
import { initQuiz } from '../../web-components/quiz-modal.js';

const PALETTE = ['#0077b6', '#0096c7', '#00b4d8', '#48cae4', '#90e0ef', '#ade8f4', '#caf0f8', '#023e8a'];
const VM_NAMES = ['Kasir Senior', 'Kasir Reguler', 'Kasir Magang'];
const VM_X = [-3.5, 0, 3.5];
const MAX_SIZE = Math.max(...DEMO.tasks.map(t => t.size));

// Troli = task, urut ranku menurun (ukuran terbesar dulu); cost = ukuran task
const HEFT_TASKS = DEMO.heft.order.map((ti, rank) => ({
  id: `T${rank + 1}`, cost: DEMO.tasks[ti].size, color: PALETTE[rank % PALETTE.length],
  w: 0.4 + 0.8 * DEMO.tasks[ti].size / MAX_SIZE,
}));
const CASHIERS = DEMO.vms.map((v, i) => ({ id: `VM${i + 1}`, name: VM_NAMES[i], speed: v.speed, color: PALETTE[i * 2], x: VM_X[i] }));
// keputusan HEFT sesuai urutan penjadwalan: troli ke-i -> VM
const HEFT_DECISIONS = DEMO.heft.decisions.map((d, rank) => ({ taskIdx: rank, vm: d.vm, eft: d.eft }));

const MAKESPAN_HEFT = DEMO.heft.makespan;
const MAKESPAN_OPT = DEMO.meta.optimum;
const N_ITER = DEMO.meta.iterasi;
const TRACES = DEMO.traces; // kunci: h/r (awal HEFT/acak) + L/N (dengan/tanpa Levy)
const LOAD_SCALE = Math.max(...Object.values(TRACES).flatMap(t => t.frames.flat(2)));

/* ============================================================
   STATUS STATE & CONTROLS
   ============================================================ */
let timelineTime = 0.0; // 0.0 s/d 1.0 (0s s/d 12s)
let isPlaying = true;
let speedMultiplier = 1.0;
let isHeftSeedMode = true; // true = Hybrid (seed HEFT), false = Acak (Meta saja)
let isLevyEnabled = true;
let lastIter = 0;

const traceKey = () => (isHeftSeedMode ? 'h' : 'r') + (isLevyEnabled ? 'L' : 'N');
const activeTrace = () => TRACES[traceKey()];
const currentIter = () => (timelineTime >= 0.55 ? Math.min(N_ITER, Math.floor(((timelineTime - 0.55) / 0.45) * N_ITER)) : 0);
const TRACE_LABEL = { hL: 'Hybrid HLWOA', hN: 'HEFT + WOA (tanpa Lévy)', rL: 'WOA + Lévy (acak)', rN: 'WOA saja (acak)' };

const TOTAL_DURATION_SEC = 12.0;
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ============================================================
   THREE.JS: SCENE MENYATU (KASIR DEPAN + LAUTAN BELAKANG)
   ============================================================ */
let scene, camera, renderer, clock;
let cashierMeshes = [], trolleyMeshes = [];
let whales = [], bestTargetMesh, bubbleParticles = [];
let levyWhaleIdx = -1, levyProgress = 0, levyStart = null, levyEnd = null;

function initThree() {
  const mount = $('#meta-demo');
  if (!mount || typeof THREE === 'undefined') return;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020b17, 0.028);

  camera = new THREE.PerspectiveCamera(48, mount.clientWidth / mount.clientHeight, 0.1, 150);
  camera.position.set(0, 11, 20);
  camera.lookAt(0, 1, -2);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  mount.appendChild(renderer.domElement);

  // Pencahayaan
  scene.add(new THREE.AmbientLight(0x446688, 0.7));
  const sun = new THREE.DirectionalLight(0xaadfff, 0.9);
  sun.position.set(10, 20, 15);
  scene.add(sun);
  const backLight = new THREE.DirectionalLight(0x0077b6, 0.5);
  backLight.position.set(-10, 10, -15);
  scene.add(backLight);

  // --- ZONA DEPAN: ANTREAN KASIR (Z = 2 s/d 8) ---
  buildCashierZone();

  // --- ZONA BELAKANG: LAUTAN BERLEMBAH & PAUS (Z = -4 s/d -24) ---
  buildOceanZone();

  // Resize listener
  window.addEventListener('resize', onWindowResize);

  clock = new THREE.Clock();
  animateScene();
}

function onWindowResize() {
  const mount = $('#meta-demo');
  if (!mount || !camera || !renderer) return;
  camera.aspect = mount.clientWidth / mount.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(mount.clientWidth, mount.clientHeight);
}

/* ==================== ZONA DEPAN: KASIR & TROLI ==================== */
function buildCashierZone() {
  // Lantai kasir (platform ubin)
  const floorGeo = new THREE.BoxGeometry(14, 0.3, 8);
  const floorMat = new THREE.MeshPhongMaterial({ color: 0x0d2137, flatShading: true });
  const cashierPlatform = new THREE.Mesh(floorGeo, floorMat);
  cashierPlatform.position.set(0, -0.15, 5);
  scene.add(cashierPlatform);

  // 3 Meja Kasir
  CASHIERS.forEach((c, idx) => {
    const group = new THREE.Group();
    // Meja kasir
    const deskGeo = new THREE.BoxGeometry(2.2, 1.0, 1.4);
    const deskMat = new THREE.MeshPhongMaterial({ color: 0x005f73, flatShading: true });
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.position.set(0, 0.5, 0);
    group.add(desk);

    // Kasir kasir (figur sederhana)
    const cashierHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshPhongMaterial({ color: 0x90e0ef })
    );
    cashierHead.position.set(0, 1.3, -0.4);
    group.add(cashierHead);

    // Komputer kasir
    const monitor = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.35, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x0a9396 })
    );
    monitor.position.set(0, 1.1, 0.3);
    group.add(monitor);

    // Posisi grup
    group.position.set(c.x, 0, 3.5);
    scene.add(group);
    cashierMeshes.push(group);
  });

  // 8 Troli Task
  HEFT_TASKS.forEach((t, i) => {
    const trolley = new THREE.Group();
    // Keranjang belanjaan
    const boxGeo = new THREE.BoxGeometry(t.w, 0.5, 0.7);
    const boxMat = new THREE.MeshPhongMaterial({ color: t.color, flatShading: true });
    const basket = new THREE.Mesh(boxGeo, boxMat);
    basket.position.set(0, 0.35, 0);
    trolley.add(basket);

    // Roda troli
    const wheelGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 6);
    const wheelMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    [[-0.35, 0.1, 0.3], [0.35, 0.1, 0.3], [-0.35, 0.1, -0.3], [0.35, 0.1, -0.3]].forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      trolley.add(wheel);
    });

    // Posisi awal antrean troli (berjajar sebelum kasir, Z = 8)
    const startX = -4.5 + i * 1.3;
    trolley.position.set(startX, 0, 7.8);
    trolley.userData = {
      initialPos: new THREE.Vector3(startX, 0, 7.8),
      taskIndex: i,
    };

    scene.add(trolley);
    trolleyMeshes.push(trolley);
  });
}

/* ==================== ZONA BELAKANG: LAUTAN & PAUS ==================== */
function buildOceanZone() {
  // Dasar laut berlembah (mesh bergelombang, lembah di tengah belakang)
  const floorGeo = new THREE.PlaneGeometry(45, 30, 40, 30);
  const pos = floorGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    // Buat lembah terdalam di (x: -3, y: -4)
    const distValley = Math.hypot(x - (-3), y - (-4));
    const valleyDepth = Math.max(0, 4 - distValley * 0.4);
    pos.setZ(i, Math.sin(x * 0.4) * Math.cos(y * 0.4) * 1.5 - valleyDepth);
  }
  pos.needsUpdate = true;
  floorGeo.computeVertexNormals();

  const floor = new THREE.Mesh(floorGeo, new THREE.MeshPhongMaterial({
    color: 0x052a42, flatShading: true, side: THREE.DoubleSide
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -2.5, -12);
  scene.add(floor);

  // Bola Ikan Terbaik (Target Optimum di lembah)
  bestTargetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 12),
    new THREE.MeshPhongMaterial({ color: 0xffd166, emissive: 0xf4a261, emissiveIntensity: 0.9 })
  );
  bestTargetMesh.position.set(-3, -1.0, -14);
  scene.add(bestTargetMesh);

  // 12 Paus Low-Poly
  whales = [];
  for (let i = 0; i < 12; i++) {
    const isHeftSeed = (i === 0);
    const whale = createWhaleMesh(isHeftSeed);

    // Sebar melingkar di zona belakang
    const angle = (i / 12) * Math.PI * 2;
    const r = 5.5 + (i % 3) * 1.5;
    const wx = bestTargetMesh.position.x + Math.cos(angle) * r;
    const wz = bestTargetMesh.position.z + Math.sin(angle) * r;
    const wy = 0.5 + Math.sin(i * 1.3) * 1.2;

    whale.position.set(wx, wy, wz);
    whale.lookAt(bestTargetMesh.position);

    whale.userData = {
      index: i,
      isHeft: isHeftSeed,
      basePos: new THREE.Vector3(wx, wy, wz),
      spiralAngle: angle,
      spiralRadius: r,
      bobOffset: Math.random() * Math.PI * 2,
    };

    scene.add(whale);
    whales.push(whale);
  }

  // Partikel gelembung mengambang
  bubbleParticles = [];
  for (let b = 0; b < 60; b++) {
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0x90e0ef, transparent: true, opacity: 0.4 })
    );
    bubble.position.set(
      (Math.random() - 0.5) * 35,
      Math.random() * 10 - 2,
      -5 - Math.random() * 20
    );
    bubble.userData = { vy: 0.01 + Math.random() * 0.02 };
    scene.add(bubble);
    bubbleParticles.push(bubble);
  }

  // Siapkan elemen mini-Gantt overlay DOM
  initMiniGanttDom();
}

function createWhaleMesh(isHeftSeed) {
  const g = new THREE.Group();
  const baseColor = isHeftSeed ? 0x48cae4 : 0x0077b6;
  const mat = new THREE.MeshPhongMaterial({ color: baseColor, flatShading: true });

  // Badan
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), mat);
  body.scale.set(1.9, 0.95, 1.0);
  g.add(body);

  // Kepala
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), mat);
  head.position.set(0.85, 0.1, 0);
  g.add(head);

  // Ekor
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.7, 4), mat);
  tail.position.set(-1.15, 0.1, 0);
  tail.rotation.z = Math.PI / 2;
  g.add(tail);

  // Sirip punggung
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 4), mat);
  fin.position.set(0, 0.55, 0);
  g.add(fin);

  // Aura bercahaya khusus untuk Paus HEFT
  if (isHeftSeed) {
    const glowLight = new THREE.PointLight(0xffd166, 1.2, 6);
    glowLight.position.set(0, 0.8, 0);
    g.add(glowLight);
  }

  return g;
}

/* ==================== MINI-GANTT DOM OVERLAYS ==================== */
let miniGanttEls = [];

function initMiniGanttDom() {
  const container = $('#gantt');
  if (!container) return;
  container.innerHTML = '';
  miniGanttEls = [];

  for (let i = 0; i < 12; i++) {
    const card = document.createElement('div');
    card.className = `animal-gantt-card ${i === 0 ? 'is-heft-seed' : ''}`;
    card.id = `mini-gantt-${i}`;
    card.innerHTML = `
      <div class="animal-gantt-header ${i === 0 ? 'heft-label' : ''}">
        <span>${i === 0 ? 'HEFT' : `Paus #${i+1}`}</span>
      </div>
      <div class="mini-gantt-lanes">
        <div class="mini-lane"><span class="mini-segment s1" style="background:#0077b6; width:70%"></span></div>
        <div class="mini-lane"><span class="mini-segment s2" style="background:#00b4d8; width:55%"></span></div>
        <div class="mini-lane"><span class="mini-segment s3" style="background:#90e0ef; width:80%"></span></div>
      </div>
      <div class="animal-makespan-tag" id="ms-tag-${i}">M: 95.0</div>
    `;
    container.appendChild(card);
    miniGanttEls.push(card);
  }
}

/* ============================================================
   LOGIKA TIMELINE KONTINU (0.0 s/d 1.0)
   ============================================================ */

function updateTimeline(progress) {
  timelineTime = Math.max(0, Math.min(1, progress));
  $('#time-slider').value = Math.round(timelineTime * 1000);
  const currentSec = (timelineTime * TOTAL_DURATION_SEC).toFixed(1);
  $('#timeline-time-label').textContent = `${currentSec}s`;

  // Update strip alur HUD
  const pillHeft = $('#pill-heft');
  const pillInject = $('#pill-inject');
  const pillMeta = $('#pill-meta');
  const trapIndicator = $('#trap-indicator');

  pillHeft?.classList.remove('active');
  pillInject?.classList.remove('active');
  pillMeta?.classList.remove('active');

  // Interpolasi Makespan Live HUD
  let liveMakespan = MAKESPAN_HEFT;

  if (timelineTime < 0.35) {
    // TAHAP 1: HEFT (0.0 s/d 0.35)
    pillHeft?.classList.add('active');
    $('#zone-status-text').textContent = 'Zona Depan: Antrean Troli ke Kasir (HEFT)';
    trapIndicator.style.opacity = (timelineTime > 0.12 && timelineTime < 0.28) ? '1' : '0.15';
    liveMakespan = MAKESPAN_HEFT;
  } else if (timelineTime < 0.55) {
    // TAHAP 2: SUNTIK (0.35 s/d 0.55)
    pillInject?.classList.add('active');
    $('#zone-status-text').textContent = 'Suntik: Solusi HEFT Ditransfer ke Paus #1 (Aura Emas)';
    trapIndicator.style.opacity = '0';
    liveMakespan = MAKESPAN_HEFT;
  } else {
    // TAHAP 3: PERBAIKAN METAHEURISTIK (0.55 s/d 1.0)
    pillMeta?.classList.add('active');
    $('#zone-status-text').textContent = isLevyEnabled ? 'Zona Belakang: WOA + Lévy Memperbaiki Jadwal Bersama' : 'Zona Belakang: WOA (tanpa Lévy) Memperbaiki Jadwal';
    trapIndicator.style.opacity = '0';

    liveMakespan = activeTrace().history[currentIter()]; // terbaik-sejauh-ini pada iterasi ini (data nyata)
  }

  $('#hud-makespan').textContent = liveMakespan.toFixed(1);

  // Update posisi troli HEFT di 3D
  updateTrolleys(timelineTime);

  // Update terbang hologram mini-Gantt
  updateFlyingGantt(timelineTime);

  // Update pergerakan paus & mini-gantt
  updateWhalesAndMiniGantts(timelineTime, liveMakespan);

  // Update grafik konvergensi langsung
  renderConvergence();
}

/* Update posisi troli di kasir */
function updateTrolleys(t) {
  // Fase HEFT berlangsung pada t: 0.0 s/d 0.35
  const heftNorm = Math.min(1, t / 0.33);

  trolleyMeshes.forEach((mesh, idx) => {
    const decision = HEFT_DECISIONS[idx];
    const taskTreshold = idx / 8; // Kapan troli ini mulai jalan
    const cashier = CASHIERS[decision.vm];

    // Posisi target di jalur kasir
    const targetZ = 4.8 + (idx % 3) * 0.9;
    const targetX = cashier.x;

    if (heftNorm <= taskTreshold) {
      // Masih di antrean awal
      mesh.position.copy(mesh.userData.initialPos);
    } else {
      // Sedang atau sudah meluncur ke kasir
      const subProg = Math.min(1, (heftNorm - taskTreshold) * 7);
      mesh.position.x = THREE.MathUtils.lerp(mesh.userData.initialPos.x, targetX, subProg);
      mesh.position.z = THREE.MathUtils.lerp(mesh.userData.initialPos.z, targetZ, subProg);
      mesh.position.y = Math.sin(subProg * Math.PI) * 0.4;
    }
  });
}

/* Update hologram mini-Gantt yang terbang dari kasir ke Paus #0 */
function updateFlyingGantt(t) {
  const flyingEl = $('#flying-gantt');
  if (!flyingEl || whales.length === 0) return;

  if (t >= 0.35 && t <= 0.55) {
    flyingEl.style.display = 'flex';
    const p = (t - 0.35) / 0.20; // 0 s/d 1

    // Proyeksikan posisi 3D dari kasir (0, 1.5, 4.5) ke Paus #0
    const startPos = new THREE.Vector3(0, 1.8, 4.5);
    const endPos = whales[0].position.clone().add(new THREE.Vector3(0, 1.2, 0));

    // Kurva melengkung terbang di udara
    const curPos = new THREE.Vector3().lerpVectors(startPos, endPos, p);
    curPos.y += Math.sin(p * Math.PI) * 4.5;

    const screenPos = curPos.project(camera);
    const mount = $('#meta-demo');
    const x = (screenPos.x * 0.5 + 0.5) * mount.clientWidth;
    const y = (-screenPos.y * 0.5 + 0.5) * mount.clientHeight;

    flyingEl.style.left = `${x}px`;
    flyingEl.style.top = `${y}px`;
    flyingEl.style.transform = `translate(-50%, -50%) scale(${1.2 - p * 0.3})`;
  } else {
    flyingEl.style.display = 'none';
  }
}

/* Update Paus 3D & Mini-Gantt di atas kepala */
function updateWhalesAndMiniGantts(t, liveMakespan) {
  const mount = $('#meta-demo');
  if (!mount) return;

  const inMetaPhase = t >= 0.55;
  const pMeta = inMetaPhase ? (t - 0.55) / 0.45 : 0;

  whales.forEach((w, i) => {
    const isHeft = w.userData.isHeft;

    // Gerakan renang
    if (inMetaPhase) {
      // Spiral bubble-net & mengepung ke target
      w.userData.spiralAngle += 0.015 * (1 + (i % 3) * 0.2);
      const curRadius = THREE.MathUtils.lerp(w.userData.spiralRadius, 2.5 + (i % 2) * 1.5, pMeta);
      w.position.x = bestTargetMesh.position.x + Math.cos(w.userData.spiralAngle) * curRadius;
      w.position.z = bestTargetMesh.position.z + Math.sin(w.userData.spiralAngle) * curRadius;
      w.position.y = bestTargetMesh.position.y + 0.8 + Math.sin(clock.getElapsedTime() * 2 + w.userData.bobOffset) * 0.3;
      w.lookAt(bestTargetMesh.position);

      // Lévy Flight sesekali jika diaktifkan
      if (isLevyEnabled && i === levyWhaleIdx && levyProgress < 1) {
        levyProgress += 0.03;
        const arc = Math.sin(levyProgress * Math.PI) * 6;
        w.position.lerpVectors(levyStart, levyEnd, levyProgress);
        w.position.y += arc;
      }
    } else {
      // Posisi standby
      w.position.y = w.userData.basePos.y + Math.sin(clock.getElapsedTime() * 1.5 + w.userData.bobOffset) * 0.2;
    }

    // Proyeksikan posisi 3D hewan ke layer HTML Mini-Gantt
    const tagPos = w.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    tagPos.project(camera);

    const el = miniGanttEls[i];
    if (el) {
      const sx = (tagPos.x * 0.5 + 0.5) * mount.clientWidth;
      const sy = (-tagPos.y * 0.5 + 0.5) * mount.clientHeight;

      el.style.left = `${sx}px`;
      el.style.top = `${sy}px`;

      // Visibilitas mini-Gantt
      if (tagPos.z > 1.0) {
        el.style.display = 'none'; // Di belakang kamera
      } else {
        el.style.display = 'flex';
      }

      // Beban per VM paus ini pada iterasi sekarang (data nyata dari run algoritma)
      const loadsNow = activeTrace().frames[currentIter()][i];
      const mVal = Math.max(...loadsNow);

      const hdr = el.querySelector('.animal-gantt-header');
      const isSeedCard = (i === 0 && isHeftSeedMode);
      el.classList.toggle('is-heft-seed', isSeedCard);
      if (hdr) { hdr.classList.toggle('heft-label', isSeedCard); hdr.firstElementChild.textContent = isSeedCard ? 'HEFT' : `Paus #${i + 1}`; }

      const msTag = el.querySelector(`#ms-tag-${i}`);
      if (msTag) msTag.textContent = `M: ${mVal.toFixed(1)}`;

      ['.s1', '.s2', '.s3'].forEach((sel, k) => {
        const bar = el.querySelector(sel);
        if (bar) bar.style.width = `${Math.max(3, (loadsNow[k] / LOAD_SCALE) * 100).toFixed(1)}%`;
      });
    }
  });

  // Lompatan Lévy dipicu oleh kejadian nyata: paus dengan langkah Lévy terbesar pada iterasi itu
  if (inMetaPhase) {
    const it = currentIter();
    if (it !== lastIter) {
      const li = it > 0 ? activeTrace().levy[it - 1] : -1;
      if (isLevyEnabled && li >= 0 && levyProgress >= 1) triggerLevy(li);
      lastIter = it;
    }
  } else {
    lastIter = 0;
  }
}

function triggerLevy(idx) {
  levyWhaleIdx = idx;
  levyProgress = 0;
  levyStart = whales[idx].position.clone();
  levyEnd = new THREE.Vector3(
    bestTargetMesh.position.x + (Math.random() - 0.5) * 14, // arah lompatan hanya ilustrasi
    bestTargetMesh.position.y + 0.5,
    bestTargetMesh.position.z + (Math.random() - 0.5) * 14
  );
}

/* ==================== LOOP ANIMASI THREE.JS ==================== */
function animateScene() {
  requestAnimationFrame(animateScene);
  const dt = clock.getDelta();

  // Kemajuan otomatis timeline jika playing
  if (isPlaying) {
    timelineTime += (dt / TOTAL_DURATION_SEC) * speedMultiplier;
    if (timelineTime > 1.0) timelineTime = 0.0; // Loop kembali
    updateTimeline(timelineTime);
  }

  // Animasi gelembung naik
  bubbleParticles.forEach(b => {
    b.position.y += b.userData.vy;
    if (b.position.y > 8) b.position.y = -2;
  });

  // Target bersinar berdenyut
  if (bestTargetMesh) {
    bestTargetMesh.rotation.y += dt * 0.8;
  }

  renderer.render(scene, camera);
}

/* ============================================================
   GRAFIK KONVERGENSI LIVE (SVG 3 GARIS)
   ============================================================ */
export function renderConvergence() {
  const container = $('#conv-chart-svg');
  if (!container) return;

  const W = 360, H = 135, PAD_L = 34, PAD_R = 12, PAD_T = 10, PAD_B = 22;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const main = activeTrace().history;
  const base = TRACES.rN.history; // pembanding: WOA saja
  const all = [...main, ...base, MAKESPAN_HEFT, MAKESPAN_OPT];
  const yMin = Math.floor(Math.min(...all) - 1), yMax = Math.ceil(Math.max(...all) + 1);
  const getY = val => innerH - ((val - yMin) / (yMax - yMin)) * innerH + PAD_T;
  const getX = iter => PAD_L + (iter / N_ITER) * innerW;

  const currentIterNow = currentIter();
  const mkPath = arr => {
    let d = '';
    for (let i = 0; i <= currentIterNow; i++) d += (i === 0 ? 'M' : 'L') + `${getX(i).toFixed(1)},${getY(arr[i]).toFixed(1)}`;
    return d;
  };
  const inMeta = timelineTime >= 0.55;
  const grid = [0.25, 0.5, 0.75].map(f => getY(yMin + (yMax - yMin) * f));

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      ${grid.map(y => `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`).join('')}

      <!-- HEFT saja (datar) dan optimum brute force -->
      <line x1="${PAD_L}" y1="${getY(MAKESPAN_HEFT)}" x2="${W - PAD_R}" y2="${getY(MAKESPAN_HEFT)}" stroke="#ef476f" stroke-width="1.5" stroke-dasharray="4,3"/>
      <line x1="${PAD_L}" y1="${getY(MAKESPAN_OPT)}" x2="${W - PAD_R}" y2="${getY(MAKESPAN_OPT)}" stroke="#06d6a0" stroke-width="1" stroke-dasharray="2,3"/>

      ${inMeta ? `<path d="${mkPath(base)}" fill="none" stroke="#b5179e" stroke-width="2" stroke-linecap="round"/>` : ''}
      ${inMeta ? `<path d="${mkPath(main)}" fill="none" stroke="#48cae4" stroke-width="2.6" stroke-linecap="round"/>` : ''}

      <text x="${PAD_L - 4}" y="${getY(MAKESPAN_HEFT) + 3}" fill="#ef476f" font-size="8" text-anchor="end">${MAKESPAN_HEFT.toFixed(1)}</text>
      <text x="${PAD_L - 4}" y="${getY(MAKESPAN_OPT) + 3}" fill="#06d6a0" font-size="8" text-anchor="end">${MAKESPAN_OPT.toFixed(1)}</text>
      <text x="${W - PAD_R}" y="${getY(MAKESPAN_OPT) + 10}" fill="#06d6a0" font-size="7" text-anchor="end">optimum (brute force)</text>

      <text x="${PAD_L}" y="${H - 5}" fill="#8aaabe" font-size="8">Iter 0</text>
      <text x="${W - PAD_R}" y="${H - 5}" fill="#8aaabe" font-size="8" text-anchor="end">Iter ${N_ITER}</text>
    </svg>
  `;
}

/* Teks statis & kartu dampak diisi dari data nyata (menggantikan angka tiruan di HTML) */
function refreshImpact() {
  const t = activeTrace(), key = traceKey();
  const pct = ((t.final - MAKESPAN_HEFT) / MAKESPAN_HEFT) * 100;
  $('#val-heft-only').textContent = MAKESPAN_HEFT.toFixed(1);
  $('#val-woa-only').textContent = TRACES.rN.final.toFixed(1);
  $('#val-hybrid').textContent = t.final.toFixed(1);
  const badge = $('#imp-badge-hybrid');
  if (badge) badge.textContent = Math.abs(pct) < 0.05 ? 'setara HEFT (tidak membaik)' : `${pct.toFixed(1)}% vs HEFT`;
  const ttl = $('#imp-title-hybrid'); if (ttl) ttl.textContent = TRACE_LABEL[key];
  const leg = $('#leg-hybrid-text'); if (leg) leg.textContent = TRACE_LABEL[key];
  const foot = $('#impact-foot');
  if (foot) foot.textContent = `Optimum (brute force) = ${MAKESPAN_OPT.toFixed(1)}. HLWOA penuh menemukannya pada ${DEMO.meta.hitOptimum} dengan 12 paus x ${N_ITER} iterasi; ini satu run seed ${DEMO.meta.runSeed}, bukan rata-rata.`;
}

function applyStaticTexts() {
  $('#hud-makespan').textContent = MAKESPAN_HEFT.toFixed(1);
  const legHeft = $('#leg-heft-text'); if (legHeft) legHeft.textContent = `HEFT Saja (${MAKESPAN_HEFT.toFixed(1)})`;
  const fly = $('#flying-gantt .fly-ms'); if (fly) fly.textContent = MAKESPAN_HEFT.toFixed(1);
  const trap = DEMO.heft.trap, trapEl = $('#trap-indicator');
  if (trapEl) {
    trapEl.textContent = trap
      ? `Troli ukuran ${trap.size}: ${CASHIERS[trap.freeVm].name} (VM${trap.freeVm + 1}) paling cepat kosong, tapi selesai ${trap.freeEft.toFixed(1)}s. ${CASHIERS[trap.chosenVm].name} (VM${trap.chosenVm + 1}) selesai ${trap.chosenEft.toFixed(1)}s → pilih yang selesai paling awal!`
      : 'HEFT memilih kasir dengan waktu selesai paling awal (EFT), bukan yang sekadar kosong.';
  }
  const banner = document.querySelector('.proto-banner');
  if (banner) banner.textContent = 'HASIL SEMENTARA: data nyata dari algoritma pada instance demo 8 task x 3 VM, bukan dataset minggu 3. Animasi hewan hanyalah ilustrasi.';
  refreshImpact();
}

/* ============================================================
   STUB EXPORT RENDERGANTT UNTUK KOMPATIBILITAS
   ============================================================ */
export function renderGantt(tab = 'heft') {
  // Mini-gantt dirender terintegrasi di atas hewan pada 3D canvas
  return tab;
}

/* ============================================================
   KONTROL & EVENT LISTENERS
   ============================================================ */
export function initControls() {
  initThree();

  // Play / Pause
  const playBtn = $('#btn-play-pause');
  playBtn?.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playBtn.textContent = isPlaying ? 'Jeda' : 'Putar';
  });

  // Ulang
  $('#btn-restart')?.addEventListener('click', () => {
    timelineTime = 0.0;
    updateTimeline(0.0);
  });

  // Slider Timeline
  const timeSlider = $('#time-slider');
  timeSlider?.addEventListener('input', () => {
    isPlaying = false;
    playBtn.textContent = 'Putar';
    updateTimeline(timeSlider.value / 1000);
  });

  // Strip Alur HUD Klik Langsung
  $('#pill-heft')?.addEventListener('click', () => {
    timelineTime = 0.0;
    updateTimeline(0.0);
  });
  $('#pill-inject')?.addEventListener('click', () => {
    timelineTime = 0.36;
    updateTimeline(0.36);
  });
  $('#pill-meta')?.addEventListener('click', () => {
    timelineTime = 0.56;
    updateTimeline(0.56);
  });

  // Mode Awal: HEFT vs Acak
  const toggleHeft = $('#toggle-mode-heft');
  const toggleRandom = $('#toggle-mode-random');

  toggleHeft?.addEventListener('click', () => {
    isHeftSeedMode = true;
    toggleHeft.classList.add('active');
    toggleRandom.classList.remove('active');
    whales[0]?.traverse(child => {
      if (child.isPointLight) child.intensity = 1.2;
    });
    refreshImpact();
    updateTimeline(timelineTime);
  });

  toggleRandom?.addEventListener('click', () => {
    isHeftSeedMode = false;
    toggleRandom.classList.add('active');
    toggleHeft.classList.remove('active');
    whales[0]?.traverse(child => {
      if (child.isPointLight) child.intensity = 0.1;
    });
    refreshImpact();
    updateTimeline(timelineTime);
  });

  // Toggle Lévy Flight
  const levyToggle = $('#toggle-levy');
  const levyLabel = $('#levy-status-label');
  levyToggle?.addEventListener('change', () => {
    isLevyEnabled = levyToggle.checked;
    if (levyLabel) levyLabel.textContent = isLevyEnabled ? 'ON' : 'OFF';
    refreshImpact();
    updateTimeline(timelineTime);
  });

  // Speed Multiplier
  $$('.btn-speed').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.btn-speed').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      speedMultiplier = parseFloat(btn.dataset.spd);
    });
  });

  // Overlay Info / Intro
  const introModal = $('#intro');
  $('#btn-info')?.addEventListener('click', () => introModal?.classList.add('show'));
  $('#btn-close-intro')?.addEventListener('click', () => introModal?.classList.remove('show'));
  $('#btn-start-intro')?.addEventListener('click', () => introModal?.classList.remove('show'));

  // Mulai awal
  applyStaticTexts();
  updateTimeline(0.0);
}

// Inisialisasi otomatis saat dokumen siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { initControls(); initQuiz(QUIZ_HLWOA, { accentColor: '#48cae4' }); });
} else {
  initControls();
  initQuiz(QUIZ_HLWOA, { accentColor: '#48cae4' });
}
