/**
 * @module ui — HLWOA (Paus) — Satu Layar Terpadu
 * @description Prototipe tampilan 3D satu layar: Antrean Kasir HEFT (zona depan)
 *              menyatu dengan Lautan Paus WOA + Lévy (zona belakang).
 *              Semua data dan pergerakan adalah DATA TIRUAN.
 */

/* ============================================================
   DATA TIRUAN — TODO: ganti dengan data dari simulator
   ============================================================ */

// 8 Troli Task (T1 s/d T8) diurutkan dari cost terbesar
const HEFT_TASKS = [
  { id: 'T1', cost: 20, color: '#0077b6', w: 1.2 }, // TODO: ganti dengan data dari simulator
  { id: 'T2', cost: 16, color: '#0096c7', w: 1.0 }, // TODO: ganti dengan data dari simulator
  { id: 'T3', cost: 14, color: '#00b4d8', w: 0.9 }, // TODO: ganti dengan data dari simulator
  { id: 'T4', cost: 12, color: '#48cae4', w: 0.8 }, // TODO: ganti dengan data dari simulator
  { id: 'T5', cost: 10, color: '#90e0ef', w: 0.7 }, // TODO: ganti dengan data dari simulator
  { id: 'T6', cost: 8,  color: '#ade8f4', w: 0.6 }, // TODO: ganti dengan data dari simulator
  { id: 'T7', cost: 6,  color: '#caf0f8', w: 0.5 }, // TODO: ganti dengan data dari simulator
  { id: 'T8', cost: 4,  color: '#023e8a', w: 0.4 }, // TODO: ganti dengan data dari simulator
];

// 3 Kasir / VM heterogen
const CASHIERS = [
  { id: 'VM1', name: 'Kasir Senior', speed: 1.0, color: '#0077b6', x: -3.5 }, // TODO: ganti dengan data dari simulator
  { id: 'VM2', name: 'Kasir Reguler', speed: 0.7, color: '#0096c7', x: 0 },    // TODO: ganti dengan data dari simulator
  { id: 'VM3', name: 'Kasir Magang', speed: 0.35, color: '#48cae4', x: 3.5 }, // TODO: ganti dengan data dari simulator
];

// Keputusan penempatan HEFT terurut [taskIdx, cashierIdx, finishTime]
// Catatan kasus jebakan pada T4: VM3 kosong (0 + 12/0.35 = 34.2s), tapi VM1 (10 + 12/1.0 = 22.0s) selesai lebih cepat!
const HEFT_DECISIONS = [
  { taskIdx: 0, vm: 0, eft: 20.0 }, // T1 -> VM1 (0+20/1.0 = 20)
  { taskIdx: 1, vm: 1, eft: 22.8 }, // T2 -> VM2 (0+16/0.7 = 22.8)
  { taskIdx: 2, vm: 0, eft: 34.0 }, // T3 -> VM1 (20+14/1.0 = 34.0)
  { taskIdx: 3, vm: 1, eft: 40.0 }, // T4 -> VM2 jebakan Magang (22.8+12/0.7=40 < 0+12/0.35=34.3 tapi VM2 menang di step berikutnya)
  { taskIdx: 4, vm: 2, eft: 28.5 }, // T5 -> VM3 (0+10/0.35 = 28.5)
  { taskIdx: 5, vm: 0, eft: 42.0 }, // T6 -> VM1
  { taskIdx: 6, vm: 2, eft: 45.7 }, // T7 -> VM3
  { taskIdx: 7, vm: 1, eft: 45.7 }, // T8 -> VM2
];

// Nilai makespan target
const MAKESPAN_HEFT = 72.0;    // TODO: ganti dengan data dari simulator
const MAKESPAN_HYBRID = 52.8;  // TODO: ganti dengan data dari simulator
const MAKESPAN_META_ONLY = 63.4; // TODO: ganti dengan data dari simulator

// Titik kurva konvergensi (50 iterasi)
const CONV_CURVES = {
  heft: Array(51).fill(MAKESPAN_HEFT), // TODO: ganti dengan data dari simulator
  hybrid: [],                          // TODO: ganti dengan data dari simulator
  metaOnly: []                         // TODO: ganti dengan data dari simulator
};

// Bangun kurva konvergensi tiruan
{
  let h = MAKESPAN_HEFT;
  let m = 104.0;
  for (let i = 0; i <= 50; i++) {
    CONV_CURVES.hybrid.push(Math.round(h * 10) / 10);
    CONV_CURVES.metaOnly.push(Math.round(m * 10) / 10);
    h -= (h - MAKESPAN_HYBRID) * 0.11 + Math.sin(i * 0.7) * 0.3;
    if (h < MAKESPAN_HYBRID) h = MAKESPAN_HYBRID;
    m -= (m - MAKESPAN_META_ONLY) * 0.08 + Math.cos(i * 0.6) * 0.4;
    if (m < MAKESPAN_META_ONLY) m = MAKESPAN_META_ONLY;
  }
}

/* ============================================================
   STATUS STATE & CONTROLS
   ============================================================ */
let timelineTime = 0.0; // 0.0 s/d 1.0 (0s s/d 12s)
let isPlaying = true;
let speedMultiplier = 1.0;
let isHeftSeedMode = true; // true = Hybrid (seed HEFT), false = Acak (Meta saja)
let isLevyEnabled = true;

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
    $('#zone-status-text').textContent = 'Zona Belakang: WOA + Lévy Memperbaiki Jadwal Bersama';
    trapIndicator.style.opacity = '0';

    const pMeta = (timelineTime - 0.55) / 0.45; // 0 s/d 1
    const targetEnd = isHeftSeedMode ? MAKESPAN_HYBRID : MAKESPAN_META_ONLY;
    const startVal = isHeftSeedMode ? MAKESPAN_HEFT : 104.0;
    liveMakespan = startVal - (startVal - targetEnd) * Math.pow(pMeta, 0.7);
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

      // Hitung angka makespan di atas paus
      let mVal;
      if (isHeft && isHeftSeedMode) {
        mVal = liveMakespan;
      } else {
        // Paus lain mulai dari nilai tinggi (95-110) lalu turun
        const startOther = 98.0 + (i * 2.5);
        const endOther = liveMakespan + (i * 1.1);
        mVal = inMetaPhase ? THREE.MathUtils.lerp(startOther, endOther, pMeta) : startOther;
      }

      const msTag = el.querySelector(`#ms-tag-${i}`);
      if (msTag) msTag.textContent = `M: ${mVal.toFixed(1)}`;

      // Update lebar bar mini-gantt proporsional
      const b1 = el.querySelector('.s1');
      const b2 = el.querySelector('.s2');
      const b3 = el.querySelector('.s3');
      if (b1 && b2 && b3) {
        const factor = inMetaPhase ? (1 - pMeta * 0.3) : 1;
        b1.style.width = `${Math.min(95, 60 * factor + (i % 20))}%`;
        b2.style.width = `${Math.min(95, 75 * factor - (i % 15))}%`;
        b3.style.width = `${Math.min(95, 65 * factor + (i % 25))}%`;
      }
    }
  });

  // Picu lompatan Lévy acak saat fase metaheuristik
  if (inMetaPhase && isLevyEnabled && levyProgress >= 1 && Math.random() < 0.02) {
    triggerRandomLevy();
  }
}

function triggerRandomLevy() {
  levyWhaleIdx = Math.floor(Math.random() * 11) + 1; // Paus selain #0
  levyProgress = 0;
  levyStart = whales[levyWhaleIdx].position.clone();
  levyEnd = new THREE.Vector3(
    bestTargetMesh.position.x + (Math.random() - 0.5) * 14,
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

  const yMin = 45, yMax = 110;
  const getY = val => innerH - ((val - yMin) / (yMax - yMin)) * innerH + PAD_T;
  const getX = iter => PAD_L + (iter / 50) * innerW;

  // Hitung jumlah iterasi yang sudah dilewati sesuai timeline
  // Fase HEFT: iterasi 0. Fase Suntik: iterasi 0. Fase Meta: iterasi 0 s/d 50
  let currentIter = 0;
  if (timelineTime >= 0.55) {
    currentIter = Math.floor(((timelineTime - 0.55) / 0.45) * 50);
  }

  // Buat path SVG Hybrid
  let pathHybrid = '';
  for (let i = 0; i <= currentIter; i++) {
    const x = getX(i);
    const y = getY(CONV_CURVES.hybrid[i]);
    pathHybrid += (i === 0 ? 'M' : 'L') + `${x.toFixed(1)},${y.toFixed(1)}`;
  }

  // Buat path SVG Meta Saja
  let pathMeta = '';
  for (let i = 0; i <= currentIter; i++) {
    const x = getX(i);
    const y = getY(CONV_CURVES.metaOnly[i]);
    pathMeta += (i === 0 ? 'M' : 'L') + `${x.toFixed(1)},${y.toFixed(1)}`;
  }

  // Garis HEFT Saja (putus-putus datar pada 72.0)
  const heftY = getY(MAKESPAN_HEFT);

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <!-- Grid & Latar -->
      <line x1="${PAD_L}" y1="${getY(50)}" x2="${W - PAD_R}" y2="${getY(50)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <line x1="${PAD_L}" y1="${getY(70)}" x2="${W - PAD_R}" y2="${getY(70)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <line x1="${PAD_L}" y1="${getY(90)}" x2="${W - PAD_R}" y2="${getY(90)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

      <!-- Garis HEFT Saja -->
      <line x1="${PAD_L}" y1="${heftY}" x2="${W - PAD_R}" y2="${heftY}"
            stroke="#ef476f" stroke-width="1.5" stroke-dasharray="4,3"/>

      <!-- Kurva Meta Saja -->
      ${pathMeta ? `<path d="${pathMeta}" fill="none" stroke="#b5179e" stroke-width="2" stroke-linecap="round"/>` : ''}

      <!-- Kurva Hybrid (HLWOA) -->
      ${pathHybrid ? `<path d="${pathHybrid}" fill="none" stroke="#48cae4" stroke-width="2.6" stroke-linecap="round"/>` : ''}

      <!-- Sumbu Y -->
      <text x="${PAD_L - 4}" y="${getY(100) + 3}" fill="#8aaabe" font-size="8" text-anchor="end">100</text>
      <text x="${PAD_L - 4}" y="${getY(72) + 3}" fill="#ef476f" font-size="8" text-anchor="end">72</text>
      <text x="${PAD_L - 4}" y="${getY(52.8) + 3}" fill="#48cae4" font-size="8" text-anchor="end">53</text>

      <!-- Sumbu X -->
      <text x="${PAD_L}" y="${H - 5}" fill="#8aaabe" font-size="8">Iter 0</text>
      <text x="${W - PAD_R}" y="${H - 5}" fill="#8aaabe" font-size="8" text-anchor="end">Iter 50</text>
    </svg>
  `;
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
    $('#val-hybrid').textContent = MAKESPAN_HYBRID.toFixed(1);
    updateTimeline(timelineTime);
  });

  toggleRandom?.addEventListener('click', () => {
    isHeftSeedMode = false;
    toggleRandom.classList.add('active');
    toggleHeft.classList.remove('active');
    whales[0]?.traverse(child => {
      if (child.isPointLight) child.intensity = 0.1;
    });
    $('#val-hybrid').textContent = MAKESPAN_META_ONLY.toFixed(1);
    updateTimeline(timelineTime);
  });

  // Toggle Lévy Flight
  const levyToggle = $('#toggle-levy');
  const levyLabel = $('#levy-status-label');
  levyToggle?.addEventListener('change', () => {
    isLevyEnabled = levyToggle.checked;
    if (levyLabel) levyLabel.textContent = isLevyEnabled ? 'ON' : 'OFF';
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
  updateTimeline(0.0);
}

// Inisialisasi otomatis saat dokumen siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initControls);
} else {
  initControls();
}
