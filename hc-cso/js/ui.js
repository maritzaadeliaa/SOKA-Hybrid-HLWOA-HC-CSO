/**
 * @module ui — HC-CSO (Kucing) — Satu Layar Terpadu
 * @description Prototipe tampilan 3D satu layar: Antrean Kasir HEFT (zona depan)
 *              menyatu dengan Ruangan Kucing CSO (zona belakang).
 *              Semua data dan pergerakan adalah DATA TIRUAN.
 */

/* ============================================================
   DATA TIRUAN — TODO: ganti dengan data dari simulator
   ============================================================ */

// 8 Troli Task (T1 s/d T8) diurutkan dari cost terbesar
const HEFT_TASKS = [
  { id: 'T1', cost: 20, color: '#e76f51', w: 1.2 }, // TODO: ganti dengan data dari simulator
  { id: 'T2', cost: 16, color: '#f4a261', w: 1.0 }, // TODO: ganti dengan data dari simulator
  { id: 'T3', cost: 14, color: '#e9c46a', w: 0.9 }, // TODO: ganti dengan data dari simulator
  { id: 'T4', cost: 12, color: '#2a9d8f', w: 0.8 }, // TODO: ganti dengan data dari simulator
  { id: 'T5', cost: 10, color: '#264653', w: 0.7 }, // TODO: ganti dengan data dari simulator
  { id: 'T6', cost: 8,  color: '#d4a373', w: 0.6 }, // TODO: ganti dengan data dari simulator
  { id: 'T7', cost: 6,  color: '#bc6c25', w: 0.5 }, // TODO: ganti dengan data dari simulator
  { id: 'T8', cost: 4,  color: '#606c38', w: 0.4 }, // TODO: ganti dengan data dari simulator
];

// 3 Kasir / VM heterogen
const CASHIERS = [
  { id: 'VM1', name: 'Kasir Senior', speed: 1.0, color: '#e76f51', x: -3.5 }, // TODO: ganti dengan data dari simulator
  { id: 'VM2', name: 'Kasir Reguler', speed: 0.7, color: '#f4a261', x: 0 },    // TODO: ganti dengan data dari simulator
  { id: 'VM3', name: 'Kasir Magang', speed: 0.35, color: '#e9c46a', x: 3.5 }, // TODO: ganti dengan data dari simulator
];

// Keputusan penempatan HEFT terurut [taskIdx, cashierIdx, finishTime]
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
const MAKESPAN_HYBRID = 54.2;  // TODO: ganti dengan data dari simulator
const MAKESPAN_META_ONLY = 64.1; // TODO: ganti dengan data dari simulator

// Titik kurva konvergensi (50 iterasi)
const CONV_CURVES = {
  heft: Array(51).fill(MAKESPAN_HEFT), // TODO: ganti dengan data dari simulator
  hybrid: [],                          // TODO: ganti dengan data dari simulator
  metaOnly: []                         // TODO: ganti dengan data dari simulator
};

// Bangun kurva konvergensi tiruan
{
  let h = MAKESPAN_HEFT;
  let m = 105.0;
  for (let i = 0; i <= 50; i++) {
    CONV_CURVES.hybrid.push(Math.round(h * 10) / 10);
    CONV_CURVES.metaOnly.push(Math.round(m * 10) / 10);
    h -= (h - MAKESPAN_HYBRID) * 0.10 + Math.sin(i * 0.65) * 0.35;
    if (h < MAKESPAN_HYBRID) h = MAKESPAN_HYBRID;
    m -= (m - MAKESPAN_META_ONLY) * 0.08 + Math.cos(i * 0.55) * 0.4;
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
let inertiaWeight = 0.50;  // 0.0 s/d 1.0 (Khas HC-CSO)

const TOTAL_DURATION_SEC = 12.0;
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ============================================================
   THREE.JS: SCENE MENYATU (KASIR DEPAN + RUANGAN KUCING BELAKANG)
   ============================================================ */
let scene, camera, renderer, clock;
let cashierMeshes = [], trolleyMeshes = [];
let cats = [], yarnBallTargetMesh, ghostMeshes = [];

function initThree() {
  const mount = $('#meta-demo');
  if (!mount || typeof THREE === 'undefined') return;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x140804, 0.026);

  camera = new THREE.PerspectiveCamera(48, mount.clientWidth / mount.clientHeight, 0.1, 150);
  camera.position.set(0, 11, 20);
  camera.lookAt(0, 1, -2);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  mount.appendChild(renderer.domElement);

  // Pencahayaan hangat
  scene.add(new THREE.AmbientLight(0x775544, 0.7));
  const warmSun = new THREE.DirectionalLight(0xffddaa, 0.95);
  warmSun.position.set(10, 20, 15);
  scene.add(warmSun);
  const backLight = new THREE.DirectionalLight(0xe76f51, 0.5);
  backLight.position.set(-10, 10, -15);
  scene.add(backLight);

  // --- ZONA DEPAN: ANTREAN KASIR (Z = 2 s/d 8) ---
  buildCashierZone();

  // --- ZONA BELAKANG: RUANGAN KUCING & BOLA BENANG (Z = -4 s/d -24) ---
  buildCatRoomZone();

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
  // Lantai kasir (platform kayu gelap)
  const floorGeo = new THREE.BoxGeometry(14, 0.3, 8);
  const floorMat = new THREE.MeshPhongMaterial({ color: 0x2b150c, flatShading: true });
  const cashierPlatform = new THREE.Mesh(floorGeo, floorMat);
  cashierPlatform.position.set(0, -0.15, 5);
  scene.add(cashierPlatform);

  // 3 Meja Kasir
  CASHIERS.forEach((c) => {
    const group = new THREE.Group();
    // Meja kasir
    const deskGeo = new THREE.BoxGeometry(2.2, 1.0, 1.4);
    const deskMat = new THREE.MeshPhongMaterial({ color: 0x8a381f, flatShading: true });
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.position.set(0, 0.5, 0);
    group.add(desk);

    // Kasir (figur sederhana)
    const cashierHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshPhongMaterial({ color: 0xf4a261 })
    );
    cashierHead.position.set(0, 1.3, -0.4);
    group.add(cashierHead);

    // Komputer kasir
    const monitor = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.35, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xe9c46a })
    );
    monitor.position.set(0, 1.1, 0.3);
    group.add(monitor);

    group.position.set(c.x, 0, 3.5);
    scene.add(group);
    cashierMeshes.push(group);
  });

  // 8 Troli Task
  HEFT_TASKS.forEach((t, i) => {
    const trolley = new THREE.Group();
    const boxGeo = new THREE.BoxGeometry(t.w, 0.5, 0.7);
    const boxMat = new THREE.MeshPhongMaterial({ color: t.color, flatShading: true });
    const basket = new THREE.Mesh(boxGeo, boxMat);
    basket.position.set(0, 0.35, 0);
    trolley.add(basket);

    const wheelGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 6);
    const wheelMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    [[-0.35, 0.1, 0.3], [0.35, 0.1, 0.3], [-0.35, 0.1, -0.3], [0.35, 0.1, -0.3]].forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      trolley.add(wheel);
    });

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

/* ==================== ZONA BELAKANG: RUANGAN KUCING ==================== */
function buildCatRoomZone() {
  // Lantai ruangan bergelombang (lembah di tengah belakang)
  const floorGeo = new THREE.PlaneGeometry(45, 30, 40, 30);
  const pos = floorGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const distValley = Math.hypot(x - (-2.5), y - (-4));
    const valleyDepth = Math.max(0, 3.8 - distValley * 0.38);
    pos.setZ(i, Math.sin(x * 0.35) * Math.cos(y * 0.35) * 1.2 - valleyDepth);
  }
  pos.needsUpdate = true;
  floorGeo.computeVertexNormals();

  const floor = new THREE.Mesh(floorGeo, new THREE.MeshPhongMaterial({
    color: 0x4a2411, flatShading: true, side: THREE.DoubleSide
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -2.5, -12);
  scene.add(floor);

  // Bola Benang Target Terbaik (Lembah Terdalam)
  yarnBallTargetMesh = new THREE.Group();
  const ballCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 12),
    new THREE.MeshPhongMaterial({ color: 0xe9c46a, emissive: 0xf4a261, emissiveIntensity: 0.85 })
  );
  yarnBallTargetMesh.add(ballCore);
  for (let k = 0; k < 3; k++) {
    const thread = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.04, 6, 12),
      new THREE.MeshPhongMaterial({ color: 0xe76f51 })
    );
    thread.rotation.set(k * 0.8, k * 1.1, 0);
    yarnBallTargetMesh.add(thread);
  }
  yarnBallTargetMesh.position.set(-2.5, -1.0, -14);
  scene.add(yarnBallTargetMesh);

  // 12 Kucing Low-Poly
  cats = [];
  for (let i = 0; i < 12; i++) {
    const isHeftSeed = (i === 0);
    const cat = createCatMesh(isHeftSeed);

    const angle = (i / 12) * Math.PI * 2;
    const r = 5.5 + (i % 3) * 1.5;
    const cx = yarnBallTargetMesh.position.x + Math.cos(angle) * r;
    const cz = yarnBallTargetMesh.position.z + Math.sin(angle) * r;
    const cy = -0.5;

    cat.position.set(cx, cy, cz);
    cat.lookAt(yarnBallTargetMesh.position.x, cy, yarnBallTargetMesh.position.z);

    cat.userData = {
      index: i,
      isHeft: isHeftSeed,
      basePos: new THREE.Vector3(cx, cy, cz),
      angle: angle,
      radius: r,
      bobOffset: Math.random() * Math.PI * 2,
      mode: i % 2 === 0 ? 'seeking' : 'tracing', // CSO mode
      seekStepTimer: 0,
    };

    scene.add(cat);
    cats.push(cat);
  }

  // Siapkan elemen mini-Gantt overlay DOM
  initMiniGanttDom();
}

function createCatMesh(isHeftSeed) {
  const g = new THREE.Group();
  const baseColor = isHeftSeed ? 0xf4a261 : 0xe76f51;
  const mat = new THREE.MeshPhongMaterial({ color: baseColor, flatShading: true });

  // Badan
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.45), mat);
  body.position.set(0, 0.25, 0);
  g.add(body);

  // Kepala
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), mat);
  head.position.set(0.48, 0.45, 0);
  g.add(head);

  // Telinga
  const earMat = new THREE.MeshPhongMaterial({ color: 0xffcad4, flatShading: true });
  const earGeo = new THREE.ConeGeometry(0.09, 0.2, 4);
  const ear1 = new THREE.Mesh(earGeo, earMat);
  ear1.position.set(0.45, 0.72, 0.12);
  g.add(ear1);
  const ear2 = new THREE.Mesh(earGeo, earMat);
  ear2.position.set(0.45, 0.72, -0.12);
  g.add(ear2);

  // Ekor
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.6, 4), mat);
  tail.position.set(-0.5, 0.5, 0);
  tail.rotation.z = Math.PI / 3.5;
  g.add(tail);

  // 4 Kaki
  const legGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.25, 4);
  [[-0.2, 0.1, 0.15], [-0.2, 0.1, -0.15], [0.2, 0.1, 0.15], [0.2, 0.1, -0.15]].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.set(lx, ly, lz);
    g.add(leg);
  });

  // Mata
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const eyeGeo = new THREE.SphereGeometry(0.04, 4, 4);
  const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
  eye1.position.set(0.68, 0.52, 0.09);
  g.add(eye1);
  const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
  eye2.position.set(0.68, 0.52, -0.09);
  g.add(eye2);

  // Kalung bercahaya untuk Kucing HEFT
  if (isHeftSeed) {
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.035, 6, 12),
      new THREE.MeshPhongMaterial({ color: 0xffd166, emissive: 0xf4a261, emissiveIntensity: 0.8 })
    );
    collar.position.set(0.38, 0.32, 0);
    collar.rotation.y = Math.PI / 2;
    g.add(collar);

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
        <span>${i === 0 ? 'HEFT' : `Kucing #${i+1}`}</span>
      </div>
      <div class="mini-gantt-lanes">
        <div class="mini-lane"><span class="mini-segment s1" style="background:#e76f51; width:70%"></span></div>
        <div class="mini-lane"><span class="mini-segment s2" style="background:#f4a261; width:55%"></span></div>
        <div class="mini-lane"><span class="mini-segment s3" style="background:#e9c46a; width:80%"></span></div>
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
    $('#zone-status-text').textContent = 'Suntik: Solusi HEFT Ditransfer ke Kucing #1 (Kalung Emas)';
    trapIndicator.style.opacity = '0';
    liveMakespan = MAKESPAN_HEFT;
  } else {
    // TAHAP 3: PERBAIKAN METAHEURISTIK (0.55 s/d 1.0)
    pillMeta?.classList.add('active');
    $('#zone-status-text').textContent = 'Zona Belakang: CSO (Seeking & Tracing) Memperbaiki Jadwal';
    trapIndicator.style.opacity = '0';

    const pMeta = (timelineTime - 0.55) / 0.45;
    const targetEnd = isHeftSeedMode ? MAKESPAN_HYBRID : MAKESPAN_META_ONLY;
    const startVal = isHeftSeedMode ? MAKESPAN_HEFT : 105.0;
    liveMakespan = startVal - (startVal - targetEnd) * Math.pow(pMeta, 0.7);
  }

  $('#hud-makespan').textContent = liveMakespan.toFixed(1);

  // Update troli HEFT
  updateTrolleys(timelineTime);

  // Update hologram terbang
  updateFlyingGantt(timelineTime);

  // Update pergerakan kucing & mini-gantt
  updateCatsAndMiniGantts(timelineTime, liveMakespan);

  // Update grafik konvergensi
  renderConvergence();
}

function updateTrolleys(t) {
  const heftNorm = Math.min(1, t / 0.33);

  trolleyMeshes.forEach((mesh, idx) => {
    const decision = HEFT_DECISIONS[idx];
    const taskTreshold = idx / 8;
    const cashier = CASHIERS[decision.vm];

    const targetZ = 4.8 + (idx % 3) * 0.9;
    const targetX = cashier.x;

    if (heftNorm <= taskTreshold) {
      mesh.position.copy(mesh.userData.initialPos);
    } else {
      const subProg = Math.min(1, (heftNorm - taskTreshold) * 7);
      mesh.position.x = THREE.MathUtils.lerp(mesh.userData.initialPos.x, targetX, subProg);
      mesh.position.z = THREE.MathUtils.lerp(mesh.userData.initialPos.z, targetZ, subProg);
      mesh.position.y = Math.sin(subProg * Math.PI) * 0.4;
    }
  });
}

function updateFlyingGantt(t) {
  const flyingEl = $('#flying-gantt');
  if (!flyingEl || cats.length === 0) return;

  if (t >= 0.35 && t <= 0.55) {
    flyingEl.style.display = 'flex';
    const p = (t - 0.35) / 0.20;

    const startPos = new THREE.Vector3(0, 1.8, 4.5);
    const endPos = cats[0].position.clone().add(new THREE.Vector3(0, 1.2, 0));

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

function updateCatsAndMiniGantts(t, liveMakespan) {
  const mount = $('#meta-demo');
  if (!mount) return;

  const inMetaPhase = t >= 0.55;
  const pMeta = inMetaPhase ? (t - 0.55) / 0.45 : 0;
  const elapsed = clock.getElapsedTime();

  cats.forEach((cat, i) => {
    const isHeft = cat.userData.isHeft;

    if (inMetaPhase) {
      // CSO Modes: Bergantian Seeking & Tracing
      // Ganti mode tiap 3 detik
      const currentMode = ((Math.floor(elapsed / 3.0) + i) % 2 === 0) ? 'seeking' : 'tracing';

      if (currentMode === 'seeking') {
        // Seeking Mode: Kucing duduk, menoleh kiri-kanan, mengamati sekitar
        cat.rotation.y = Math.sin(elapsed * 3 + i) * 0.35;
        cat.position.y = -0.5 + Math.sin(elapsed * 2 + cat.userData.bobOffset) * 0.05;
      } else {
        // Tracing Mode: Berlari mengejar target terbaik dengan pengaruh inertiaWeight
        // Rendah (0.0): lurus cepat ke target. Tinggi (1.0): banyak meliuk / inersia sendiri
        const targetPos = isHeftSeedMode ? cats[0].position : yarnBallTargetMesh.position;
        const speed = 0.03 + (1 - inertiaWeight) * 0.04;
        const wanderAngle = cat.userData.angle + elapsed * (inertiaWeight * 2.5);

        const desireX = targetPos.x + Math.cos(wanderAngle) * (1.5 + inertiaWeight * 2.0);
        const desireZ = targetPos.z + Math.sin(wanderAngle) * (1.5 + inertiaWeight * 2.0);

        cat.position.x += (desireX - cat.position.x) * speed;
        cat.position.z += (desireZ - cat.position.z) * speed;
        cat.position.y = -0.5 + Math.abs(Math.sin(elapsed * 6 + i)) * 0.12; // Animasi langkah
        cat.lookAt(targetPos.x, cat.position.y, targetPos.z);
      }
    } else {
      cat.position.y = -0.5 + Math.sin(elapsed * 1.5 + cat.userData.bobOffset) * 0.05;
    }

    // Proyeksikan posisi 3D ke layer HTML Mini-Gantt
    const tagPos = cat.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    tagPos.project(camera);

    const el = miniGanttEls[i];
    if (el) {
      const sx = (tagPos.x * 0.5 + 0.5) * mount.clientWidth;
      const sy = (-tagPos.y * 0.5 + 0.5) * mount.clientHeight;

      el.style.left = `${sx}px`;
      el.style.top = `${sy}px`;

      if (tagPos.z > 1.0) {
        el.style.display = 'none';
      } else {
        el.style.display = 'flex';
      }

      let mVal;
      if (isHeft && isHeftSeedMode) {
        mVal = liveMakespan;
      } else {
        const startOther = 99.0 + (i * 2.3);
        const endOther = liveMakespan + (i * 1.2);
        mVal = inMetaPhase ? THREE.MathUtils.lerp(startOther, endOther, pMeta) : startOther;
      }

      const msTag = el.querySelector(`#ms-tag-${i}`);
      if (msTag) msTag.textContent = `M: ${mVal.toFixed(1)}`;

      const b1 = el.querySelector('.s1');
      const b2 = el.querySelector('.s2');
      const b3 = el.querySelector('.s3');
      if (b1 && b2 && b3) {
        const factor = inMetaPhase ? (1 - pMeta * 0.3) : 1;
        b1.style.width = `${Math.min(95, 62 * factor + (i % 18))}%`;
        b2.style.width = `${Math.min(95, 72 * factor - (i % 14))}%`;
        b3.style.width = `${Math.min(95, 68 * factor + (i % 22))}%`;
      }
    }
  });
}

/* ==================== LOOP ANIMASI THREE.JS ==================== */
function animateScene() {
  requestAnimationFrame(animateScene);
  const dt = clock.getDelta();

  if (isPlaying) {
    timelineTime += (dt / TOTAL_DURATION_SEC) * speedMultiplier;
    if (timelineTime > 1.0) timelineTime = 0.0;
    updateTimeline(timelineTime);
  }

  // Bola benang berputar perlahan
  if (yarnBallTargetMesh) {
    yarnBallTargetMesh.rotation.y += dt * 0.8;
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

  let currentIter = 0;
  if (timelineTime >= 0.55) {
    currentIter = Math.floor(((timelineTime - 0.55) / 0.45) * 50);
  }

  let pathHybrid = '';
  for (let i = 0; i <= currentIter; i++) {
    const x = getX(i);
    const y = getY(CONV_CURVES.hybrid[i]);
    pathHybrid += (i === 0 ? 'M' : 'L') + `${x.toFixed(1)},${y.toFixed(1)}`;
  }

  let pathMeta = '';
  for (let i = 0; i <= currentIter; i++) {
    const x = getX(i);
    const y = getY(CONV_CURVES.metaOnly[i]);
    pathMeta += (i === 0 ? 'M' : 'L') + `${x.toFixed(1)},${y.toFixed(1)}`;
  }

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

      <!-- Kurva CSO Saja -->
      ${pathMeta ? `<path d="${pathMeta}" fill="none" stroke="#e76f51" stroke-width="2" stroke-linecap="round"/>` : ''}

      <!-- Kurva Hybrid (HC-CSO) -->
      ${pathHybrid ? `<path d="${pathHybrid}" fill="none" stroke="#f4a261" stroke-width="2.6" stroke-linecap="round"/>` : ''}

      <!-- Sumbu Y -->
      <text x="${PAD_L - 4}" y="${getY(100) + 3}" fill="#bda395" font-size="8" text-anchor="end">100</text>
      <text x="${PAD_L - 4}" y="${getY(72) + 3}" fill="#ef476f" font-size="8" text-anchor="end">72</text>
      <text x="${PAD_L - 4}" y="${getY(54.2) + 3}" fill="#f4a261" font-size="8" text-anchor="end">54</text>

      <!-- Sumbu X -->
      <text x="${PAD_L}" y="${H - 5}" fill="#bda395" font-size="8">Iter 0</text>
      <text x="${W - PAD_R}" y="${H - 5}" fill="#bda395" font-size="8" text-anchor="end">Iter 50</text>
    </svg>
  `;
}

/* ============================================================
   STUB EXPORT RENDERGANTT UNTUK KOMPATIBILITAS
   ============================================================ */
export function renderGantt(tab = 'heft') {
  return tab;
}

/* ============================================================
   KONTROL & EVENT LISTENERS
   ============================================================ */
export function initControls() {
  initThree();

  const playBtn = $('#btn-play-pause');
  playBtn?.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playBtn.textContent = isPlaying ? 'Jeda' : 'Putar';
  });

  $('#btn-restart')?.addEventListener('click', () => {
    timelineTime = 0.0;
    updateTimeline(0.0);
  });

  const timeSlider = $('#time-slider');
  timeSlider?.addEventListener('input', () => {
    isPlaying = false;
    playBtn.textContent = 'Putar';
    updateTimeline(timeSlider.value / 1000);
  });

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

  const toggleHeft = $('#toggle-mode-heft');
  const toggleRandom = $('#toggle-mode-random');

  toggleHeft?.addEventListener('click', () => {
    isHeftSeedMode = true;
    toggleHeft.classList.add('active');
    toggleRandom.classList.remove('active');
    cats[0]?.traverse(child => {
      if (child.isPointLight) child.intensity = 1.2;
    });
    $('#val-hybrid').textContent = MAKESPAN_HYBRID.toFixed(1);
    updateTimeline(timelineTime);
  });

  toggleRandom?.addEventListener('click', () => {
    isHeftSeedMode = false;
    toggleRandom.classList.add('active');
    toggleHeft.classList.remove('active');
    cats[0]?.traverse(child => {
      if (child.isPointLight) child.intensity = 0.1;
    });
    $('#val-hybrid').textContent = MAKESPAN_META_ONLY.toFixed(1);
    updateTimeline(timelineTime);
  });

  // Slider Inertia Weight (Khas HC-CSO)
  const inertiaSlider = $('#slider-inertia');
  const inertiaValLabel = $('#inertia-weight-val');
  inertiaSlider?.addEventListener('input', () => {
    inertiaWeight = parseFloat(inertiaSlider.value) / 100;
    if (inertiaValLabel) inertiaValLabel.textContent = inertiaWeight.toFixed(2);
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

  updateTimeline(0.0);
}

// Inisialisasi otomatis saat dokumen siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initControls);
} else {
  initControls();
}
