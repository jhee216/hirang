// HIRANG GUESTBOOK 3D — 렌더러·빛·카메라·상호작용.
// 원래 비밀독서구역(experience/js/main.js)과 같은 톤 매핑·노출·환경광. 백엔드는 기존 guestbook/lib 그대로.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildLounge, buildPage, buildTraces, buildPageGlow, LAYOUT, ROOM } from './world.js';
import { makePageTexture } from './pages.js';
import { getBackend } from '../lib/backend.js';
import { visitorKey } from '../lib/visitor-key.js';
import { buildVisitors } from './visitors.js';
import { startPresence } from '../../experience/js/live/presence.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPortrait = () => innerWidth / innerHeight < 0.8;
const narrow = () => innerWidth <= 900;

/* ---------- 렌더러 · 씬 ---------- */
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.94;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#FFF9EA');
scene.fog = new THREE.Fog('#F6F1E6', 9, 34);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.32;

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.03, 60);
scene.add(camera);

/* ---------- 빛: 원래 방처럼 하늘빛은 낮게, 비스듬한 낮빛과 천장 스포트로 형태를 만든다 ---------- */
scene.add(new THREE.HemisphereLight('#FFFDF6', '#EFE6D4', 0.4));
const key = new THREE.DirectionalLight('#FFF4E2', 2.1);
key.position.set(-4.5, 6.0, 1.8);
key.target.position.set(0.3, 0.4, -3.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -4, near: 1, far: 18 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
scene.add(key, key.target);
const deskSpot = new THREE.SpotLight('#FFF4DE', 16, 7, 0.6, 0.85, 1.4);
deskSpot.position.set(LAYOUT.table.x - 0.3, ROOM.h - 0.05, LAYOUT.table.z + 0.9);
deskSpot.target.position.set(LAYOUT.table.x, LAYOUT.table.h, LAYOUT.table.z);
deskSpot.castShadow = true; deskSpot.shadow.mapSize.set(1024, 1024); deskSpot.shadow.radius = 5; deskSpot.shadow.bias = -0.0006;
scene.add(deskSpot, deskSpot.target);
const ledgeLight = new THREE.PointLight('#FFF3C2', 2.0, 3.5, 1.6);
ledgeLight.position.set(ROOM.x - 0.6, 1.9, LAYOUT.ledge.z);
scene.add(ledgeLight);
const oldSpot = new THREE.SpotLight('#FFF4DE', 22, 8, 0.75, 0.9, 1.3);
oldSpot.position.set(LAYOUT.door.x + 0.6, ROOM.h + 0.4, ROOM.z1 - 1.2);
oldSpot.target.position.set(LAYOUT.door.x + 1.15, 1.0, ROOM.z1 - 3.6);
scene.add(oldSpot, oldSpot.target);
const fill = new THREE.PointLight('#FFF6E6', 3.0, 9, 1.4);
fill.position.set(-1.2, 2.6, -1.4);
scene.add(fill);

/* ---------- 자원 · 장면 ---------- */
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
try { await Promise.race([document.fonts.load('400 40px Pretendard'), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* 시스템 서체 */ }
const [sym, logoImg] = await Promise.all([
  fetch('assets/symbol-shape.json').then((r) => r.json()).catch(() => null),
  loadImg('assets/hirang-logo.png'),
]);
const world = buildLounge({ sym, logoImg });
scene.add(world.group);
const { book, tray, writeChair, readChair } = world;
const traces = buildTraces();
scene.add(traces.group);
// 지금 함께 접속한 다른 방문자(최대 5명) — 3D 독서구역과 같은 익명 신호·같은 캐릭터
const visitors = buildVisitors(scene);
const presence = startPresence((f) => visitors.setFigures(f));
const BU = book.userData;

// 쓰는 종이: 트레이 맨 위 한 장. 글이 실시간으로 적힌다(앞면 좌우를 뒤집어 앉은 사람 쪽에서 바로 읽히게)
const writeTex = makePageTexture(297 / 210);
// 종이 앞면 위쪽(캔버스 위)은 종이의 −z — 책상 위에서 +x를 향하게 돌려, 왼쪽 끝에 앉은 사람에게 바로 읽힌다
const page = buildPage(writeTex);
scene.add(page);
const T = LAYOUT.table;
const PAGE_TRAY = () => { const p = tray.localToWorld(new THREE.Vector3(0, 0.0195, 0.008)); return { pos: p, ry: tray.rotation.y }; };
const PAGE_DESK = { pos: new THREE.Vector3(T.x - 0.45, T.h + 0.0007, T.z + 0.02), ry: -Math.PI / 2 + 0.05 };   // 쓰는 의자 앞(위쪽이 +x)
function placePage(p) { page.position.copy(p.pos); page.rotation.set(0, p.ry, 0); }
const pageGlow = buildPageGlow();   // 트레이 위 빈 페이지가 은은하게 빛난다
scene.add(pageGlow.group);
placePage(PAGE_TRAY());

// 방명록 자리: 받침 위(평소) / 책상 위 읽는 자리(펼쳐 읽을 때)
const BOOK_LEDGE = { pos: book.position.clone(), ry: book.rotation.y };
const BOOK_DESK = { pos: new THREE.Vector3(T.x + 0.4, T.h + 0.0035, T.z + 0.02), ry: Math.PI / 2 + 0.22 };
const BOOK_ASPECT = (BU.D - 0.03) / (BU.W - 0.03);
const rightTex = makePageTexture(BOOK_ASPECT), leftTex = makePageTexture(BOOK_ASPECT), leafTex = makePageTexture(BOOK_ASPECT), leafBackTex = makePageTexture(BOOK_ASPECT);
BU.rightMat.map = rightTex; BU.leftMat.map = leftTex; BU.leafFront.map = leafTex; BU.leafBack.map = leafBackTex;
// 왼쪽 면은 표지와 함께 뒤집히므로 좌우·위아래를 바로잡는다
leftTex.center.set(0.5, 0.5); leftTex.rotation = Math.PI;
leafBackTex.center.set(0.5, 0.5); leafBackTex.rotation = Math.PI;
for (const t of [leftTex, leafBackTex]) t.draw({ ruled: false });

/* ---------- 카메라: 걷는 관람객(원래 3D 독서구역과 같은 방식) ---------- */
// 걷기·앉기는 눈 위치 + 시선(yaw·pitch). 쓰기·읽기는 종이/책을 중심으로 도는 궤도(패키지 보기처럼 끌어 돌리고 휠로 다가가기).
const RC = LAYOUT.readChair, WC = LAYOUT.writeChair;
const EYE = 1.5, SIT_EYE = 1.12;
const clamp = THREE.MathUtils.clamp;
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);   // 카메라가 (dx,dz) 쪽을 보는 yaw
const START = { pos: [-1.8, EYE + 0.2, -0.3], look: [0.35, 0.7, -3.6], fov: 44, p: { pos: [-2.2, EYE, -1.9], look: [1.27, 0.42, -3.55], fov: 68 } };
const S0 = () => (isPortrait() ? START.p : START);
const rig = {
  pos: new THREE.Vector3(), yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, fov: 42, tFov: 42, eye: EYE,
  target: null, bob: 0, moving: 0,
  // 궤도(쓰기·읽기)
  orbit: null,   // { center, r, theta, phi, tr, ttheta, tphi, min, max, phiMin, phiMax, thMin, thMax }
};
function aimAt(look) {
  const d = new THREE.Vector3().subVectors(look, rig.pos);
  rig.yaw = rig.tYaw = Math.atan2(-d.x, -d.z);
  rig.pitch = rig.tPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
}
function placeStart() {
  const s = S0(); rig.pos.set(...s.pos); rig.eye = s.pos[1]; aimAt(new THREE.Vector3(...s.look)); rig.fov = rig.tFov = s.fov;
}

// 걷는 범위: 방 안 + 뒷벽 통로(통로 끝까지 가면 원래 비밀독서구역으로). 책상·의자는 피해 간다
const R = 0.26;
const OBST = [
  // [x0, z0, x1, z1] 책상
  [T.x - T.w / 2, T.z - T.d / 2, T.x + T.w / 2, T.z + T.d / 2],
];
const CHAIRS = [[WC.x, WC.z, 0.46], [RC.x, RC.z, 0.46]];
const D = LAYOUT.door;
function limit(p) {
  const inDoor = p.x > D.x - D.R + 0.3 && p.x < D.x + D.R - 0.3;
  p.x = clamp(p.x, -ROOM.x + 0.3, ROOM.x - 0.3);
  p.z = clamp(p.z, inDoor ? ROOM.z1 - ROOM.wt - 0.5 : ROOM.z1 + 0.35, ROOM.z0 - 0.35);
  if (p.z < ROOM.z1 + 0.3) p.x = clamp(p.x, D.x - D.R + 0.3, D.x + D.R - 0.3);   // 통로 안에서는 통로 폭 안으로
  for (const [x0, z0, x1, z1] of OBST) {
    if (p.x > x0 - R && p.x < x1 + R && p.z > z0 - R && p.z < z1 + R) {
      const d = [p.x - (x0 - R), (x1 + R) - p.x, p.z - (z0 - R), (z1 + R) - p.z];
      const k = d.indexOf(Math.min(...d));
      if (k === 0) p.x = x0 - R; else if (k === 1) p.x = x1 + R; else if (k === 2) p.z = z0 - R; else p.z = z1 + R;
    }
  }
  for (const [cx, cz, cr] of CHAIRS) {
    const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz), m = cr + R * 0.6;
    if (d < m) { const k = m / Math.max(d, 1e-4); p.x = cx + dx * k; p.z = cz + dz * k; }
  }
  return p;
}
const fwd = () => new THREE.Vector3(-Math.sin(rig.yaw), 0, -Math.cos(rig.yaw));
function nudge(dist) {
  const f = fwd();
  let lead = 0;
  if (rig.target) lead = (rig.target.x - rig.pos.x) * f.x + (rig.target.z - rig.pos.z) * f.z;
  if (Math.sign(lead) !== Math.sign(dist)) lead = 0;
  lead = clamp(lead + dist, -1.3, 1.3);
  rig.target = limit(new THREE.Vector3(rig.pos.x + f.x * lead, 0, rig.pos.z + f.z * lead));
  rig.tPitch = clamp(rig.tPitch, -0.32, 0.2);
}
function walkTo(x, z) { rig.target = limit(new THREE.Vector3(x, 0, z)); }

/* ---------- 움직임(부드럽게: 사인 곡선, 넉넉한 시간) ---------- */
const easeIO = (k) => -(Math.cos(Math.PI * k) - 1) / 2;
const easeOut = (k) => Math.sin((k * Math.PI) / 2);
const tweens = new Set();
function tween(sec, fn, ease = easeIO) {
  return new Promise((res) => {
    const dur = (reduced ? Math.min(sec, 0.15) : sec) * 1000;
    tweens.add({ t0: performance.now(), dur, fn, ease, res });
  });
}
// 카메라를 지금 모습에서 목표 모습(위치·바라볼 곳·렌즈)으로. 그동안 조작은 막는다
let camFly = null;
function flyCam(pos, look, fov, sec, ease = easeIO, path) {
  const p0 = camera.position.clone(), q0 = camera.quaternion.clone(), f0 = camera.fov;
  const tmpCam = new THREE.Object3D(); tmpCam.position.copy(pos); tmpCam.lookAt(look);
  // Object3D.lookAt은 +z를 향하게 하므로 카메라처럼 −z를 향하도록 뒤집는다
  tmpCam.rotateY(Math.PI);
  const q1 = tmpCam.quaternion.clone();
  camFly = { k: 0 };
  return tween(sec, (k) => {
    camFly.k = k;
    camera.position.lerpVectors(p0, pos, k);
    if (path) path(k, camera.position);
    camera.quaternion.slerpQuaternions(q0, q1, k);
    camera.fov = f0 + (fov - f0) * k; camera.updateProjectionMatrix();
  }, ease).then(() => { camFly = null; });
}
// 물체를 a → b로(포물선 높이 arc). 회전은 y축만
function fly(obj, from, to, sec, arc = 0, extra, ease = easeIO) {
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, from.ry, 0));
  const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, to.ry, 0));
  return tween(sec, (k) => {
    obj.position.lerpVectors(from.pos, to.pos, k);
    obj.position.y += Math.sin(Math.PI * k) * arc;
    obj.quaternion.slerpQuaternions(q0, q1, k);
    extra?.(k);
  }, ease);
}

/* ---------- 상태 ---------- */
// walk(걷기) · seat(앉음: seatWrite/seatRead) · writing · sending · reading
let mode = 'walk', busy = false, seat = null;
function setMode(m) {
  mode = m; app.dataset.mode = m === 'walk' ? 'overview' : m;
  $('stand').hidden = m === 'walk';
  $('writer').hidden = m !== 'writing';
  $('reader').hidden = m !== 'reading';
  $('spots').setAttribute('aria-hidden', m === 'walk' ? 'false' : 'true');
}
const chairOf = (which) => (which === 'write' ? WC : RC);
const chairFwd = (c) => new THREE.Vector2(Math.sin(c.ry), Math.cos(c.ry));
function seatPose(which) {
  const c = chairOf(which), f = chairFwd(c);
  const pos = new THREE.Vector3(c.x + f.x * 0.04, SIT_EYE, c.z + f.y * 0.04);
  // 앉은 눈으로 책상을 내려다보는 자연스러운 각도(약 −20°)
  // 쓰는 자리: 책상 너머 벽감까지 보이게 살짝만 내려다본다 · 읽는 자리: 책상 끝을 더 내려다본다
  const drop = which === 'write' ? 0.24 : 0.34;
  const look = new THREE.Vector3(pos.x + f.x, pos.y - drop, pos.z + f.y);
  return { pos, look, yaw: yawTo(f.x, f.y), pitch: -Math.atan(drop), fov: isPortrait() ? 68 : 56 };
}

// 앉기: 의자 등 뒤로 걸어가 몸을 돌리고(1.1 s) → 천천히 내려앉는다(1.0 s, 끝에 살짝 가라앉음)
async function sit(which) {
  if (busy) return;
  if (mode === 'writing') closeWriting();
  if (mode === 'reading') await closeBook(true);
  if (mode === 'seat' && seat === which) return;
  busy = true; rig.target = null;
  const c = chairOf(which), f = chairFwd(c), sp = seatPose(which);
  const above = new THREE.Vector3(c.x - f.x * 0.12, EYE - 0.06, c.z - f.y * 0.12);
  const lookAhead = new THREE.Vector3(above.x + f.x * 2, 0.95, above.z + f.y * 2);
  setMode('seat'); seat = which;
  await flyCam(above, lookAhead, sp.fov, 1.15);
  await flyCam(sp.pos, sp.look, sp.fov, 1.0, easeIO, (k, p) => { p.y -= Math.sin(Math.PI * k) * 0.035; });
  rig.pos.copy(sp.pos); rig.eye = SIT_EYE; aimAt(sp.look); rig.fov = rig.tFov = sp.fov;
  busy = false;
  if (which === 'read') openBook();
}
// 일어나기: 앉은 자리에서 그대로 일어나 의자 뒤로 반 걸음(같은 방향을 본 채로) → 다시 걷기
async function stand() {
  if (busy || mode === 'walk' || mode === 'sending') return;
  if (mode === 'writing') closeWriting();
  if (mode === 'reading') await closeBook(true);
  busy = true;
  const c = chairOf(seat), f = chairFwd(c);
  const p = limit(new THREE.Vector3(c.x - f.x * 0.62, 0, c.z - f.y * 0.62)); p.y = EYE;
  const look = new THREE.Vector3(p.x + f.x * 2.2, 0.85, p.z + f.y * 2.2);
  await flyCam(p, look, isPortrait() ? 68 : 46, 1.1, easeIO, (k, q) => { q.y += Math.sin(Math.PI * k) * 0.03; });
  rig.pos.copy(p); rig.eye = EYE; aimAt(look); rig.fov = rig.tFov = camera.fov;
  setMode('walk'); seat = null;
  busy = false;
}

/* ---------- 쓰기 ---------- */
const form = $('writer'), bodyIn = $('body'), nameIn = $('name');
const ERR = {
  too_fast: '조금 더 천천히 적어 주세요.',
  too_short: '두 글자 이상 적어 주세요.',
  too_long: '300자까지 남길 수 있습니다.',
  links: '링크나 주소는 남길 수 없습니다.',
  rate: '페이지를 여러 번 남기셨습니다. 잠시 후 다시 남겨 주세요.',
  duplicate: '같은 글이 이미 보관함에 있습니다.',
  name_too_long: '이름은 20자까지 적을 수 있습니다.',
};
const val = (n) => form.querySelector(`input[name="${n}"]:checked`)?.value;
function drawWritePage() {
  const identity = val('identity');
  const name = identity !== 'anonymous' && nameIn.value.trim() ? nameIn.value.trim() : '';
  writeTex.draw({ eyebrow: 'ONE PAGE', body: bodyIn.value, placeholder: '당신의 한 페이지를 남겨주세요.', name: name || (identity === 'anonymous' ? '익명' : ''), size: 44 });
}
function syncForm() {
  const identity = val('identity');
  nameIn.hidden = identity === 'anonymous';
  nameIn.placeholder = identity === 'realname' ? '실명' : identity === 'nickname' ? '닉네임' : '';
  $('showNameRow').hidden = identity === 'anonymous' || !$('isPublic').checked;
  if ($('showNameRow').hidden) $('showName').checked = false;
  $('count').textContent = bodyIn.value.length;
  drawWritePage();
}
form.addEventListener('input', syncForm);
form.addEventListener('change', syncForm);

// 쓰기·읽기 궤도: 가운데 물체를 위에서 내려다보는 각도에서 시작. 끌면 돌려 보고, 휠로 다가가고 멀어진다
function orbitPose(o) {
  const st = Math.sin(o.theta);
  const pos = new THREE.Vector3(o.center.x + st * Math.sin(o.phi) * o.r, o.center.y + Math.cos(o.theta) * o.r, o.center.z + st * Math.cos(o.phi) * o.r);
  return pos;
}
function startOrbit(o) {
  o.tr = o.r; o.ttheta = o.theta; o.tphi = o.phi;
  rig.orbit = o;
  return flyCam(orbitPose(o), o.center, o.fov, o.sec ?? 1.4);
}
function writeOrbit() {
  // 쓰는 사람 쪽(−x)에서 거의 위로 내려다본다. 넓은 화면은 입력 카드를 피해 종이를 왼쪽으로, 세로 화면은 위쪽으로
  const c = PAGE_DESK.pos.clone();
  if (narrow()) c.x -= 0.1; else c.z += 0.13;
  return { kind: 'write', center: c, r: narrow() ? 0.62 : 0.56, theta: 0.32, phi: -Math.PI / 2, fov: narrow() ? 60 : 42,
    min: 0.3, max: 0.9, thMin: 0.08, thMax: 0.75, phiMin: -Math.PI / 2 - 0.6, phiMax: -Math.PI / 2 + 0.6 };
}

let pageAtDesk = false;
async function openWriting() {
  if (busy) return;
  if (mode === 'reading') await closeBook(true);
  if (!(mode === 'seat' && seat === 'write')) await sit('write');
  busy = true;
  setMode('writing');
  syncForm();
  // 종이가 트레이에서 쓰는 자리로 천천히 미끄러져 오고, 시선도 함께 종이 위로(1.4 s)
  const camGo = startOrbit({ ...writeOrbit(), sec: 1.5 });
  if (!pageAtDesk) { await fly(page, PAGE_TRAY(), PAGE_DESK, 1.3, 0.05); pageAtDesk = true; }
  await camGo;
  busy = false;
  if (!narrow()) bodyIn.focus({ preventScroll: true });
}
// 입력은 지우지 않는다(실패하거나 잠시 고개를 들어도 글이 남는다). 종이는 책상 위에 그대로
function closeWriting() { $('err').textContent = ''; rig.orbit = null; setMode('seat'); }
async function backToSeat() {
  if (busy) return;
  busy = true;
  if (mode === 'writing') closeWriting();
  const sp = seatPose(seat);
  await flyCam(sp.pos, sp.look, sp.fov, 1.2);
  rig.pos.copy(sp.pos); aimAt(sp.look); rig.fov = rig.tFov = sp.fov;
  busy = false;
}

let backend = null, pages = [], level = 0;
const openedAt = Date.now();
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy) return;
  $('err').textContent = '';
  const text = bodyIn.value.trim();
  if (text.length < 2) { $('err').textContent = ERR.too_short; bodyIn.focus(); return; }
  const identity = val('identity');
  const name = identity === 'anonymous' ? '' : nameIn.value.trim();
  if (identity !== 'anonymous' && !name) { $('err').textContent = identity === 'realname' ? '실명을 적거나 익명을 골라 주세요.' : '닉네임을 적거나 익명을 골라 주세요.'; nameIn.focus(); return; }
  const visibility = $('isPublic').checked ? 'public' : 'private';
  busy = true; $('submit').disabled = true;
  try {
    let res = null;
    if (backend) {
      // 서버가 저장을 확인한 뒤에만 종이가 책으로 간다(실패하면 글과 종이를 그대로 둔다)
      res = await backend.submit({ vk: visitorKey(), body: text, identity, name, showName: $('showName').checked, visibility, website: $('website').value, elapsed: Date.now() - openedAt });
    }
    $('writer').hidden = true;
    await sendPage();
    if (res?.page) pages = [res.page, ...pages.filter((p) => p.id !== res.page.id)];
    bodyIn.value = ''; nameIn.value = ''; $('isPublic').checked = false; $('showName').checked = false;
    form.querySelector('input[name="identity"][value="anonymous"]').checked = true;
    syncForm();
    toast(!backend ? '미리보기라 이 페이지는 저장되지 않았습니다' : visibility === 'public' ? '방명록에 담겼습니다 · 다른 방문객도 펼쳐 읽을 수 있습니다' : '방명록에 담겼습니다 · 관리자만 읽을 수 있습니다');
    if (backend) refreshTrace();
  } catch (ex) {
    $('err').textContent = ERR[ex.code] || '지금은 페이지를 담지 못했습니다. 잠시 후 다시 시도해 주세요.';
  } finally {
    busy = false; $('submit').disabled = false;
  }
});

// 저장이 확인된 종이: 책상에서 들려 → 받침의 방명록으로 날아가 → 표지가 열리고 → 끼워지고 → 닫힌다(약 3초)
async function sendPage() {
  mode = 'sending'; app.dataset.mode = 'sending'; rig.orbit = null;
  const vp = isPortrait() ? { pos: [0.2, 1.75, -1.0], look: [1.6, 0.72, -3.0], fov: 64 } : { pos: [-0.75, 1.8, -0.85], look: [1.4, 0.72, -3.05], fov: 50 };
  const camGo = flyCam(new THREE.Vector3(...vp.pos), new THREE.Vector3(...vp.look), vp.fov, 1.2);
  const up = { pos: PAGE_DESK.pos.clone().add(new THREE.Vector3(0, 0.22, -0.05)), ry: PAGE_DESK.ry };
  await fly(page, PAGE_DESK, up, 0.6, 0, (k) => { page.rotation.x = -0.35 * k; });
  const top = book.localToWorld(new THREE.Vector3(0.02, BU.top + 0.003, 0));
  const above = { pos: top.clone().add(new THREE.Vector3(0, 0.16, 0)), ry: book.rotation.y };   // 종이 위쪽 = 책 페이지 위쪽
  const coverOpen = tween(0.8, (k) => { BU.hinge.rotation.z = Math.PI * 0.94 * k; }, easeOut);
  await fly(page, up, above, 1.0, 0.28, (k) => { page.rotation.x = -0.35 * (1 - k) + Math.sin(Math.PI * k) * 0.25; page.rotation.z = Math.sin(Math.PI * k) * -0.18; });
  await coverOpen;
  await camGo;
  await fly(page, above, { pos: top, ry: above.ry }, 0.5, 0, (k) => { page.rotation.x = 0; page.rotation.z = 0; });
  page.visible = false;
  setLevel(level + 1, true);
  const mine = traces.addMine();   // 벽감에 스티커 하나 조용히
  if (mine) { const s = mine.userData.s; tween(0.8, (k) => mine.scale.set(s * k, s * k, 0.12), easeOut); }
  await tween(0.7, (k) => { BU.hinge.rotation.z = Math.PI * 0.94 * (1 - k); });
  pageAtDesk = false; placePage(PAGE_TRAY());
  writeTex.draw({ eyebrow: 'ONE PAGE', placeholder: '당신의 한 페이지를 남겨주세요.', name: '익명', size: 44 });
  page.visible = true;
  setMode('seat'); seat = 'write';
  const sp = seatPose('write');
  await flyCam(sp.pos, sp.look, sp.fov, 1.3);
  rig.pos.copy(sp.pos); aimAt(sp.look); rig.fov = rig.tFov = sp.fov;
}
function setLevel(lv, bump = false) {
  level = Math.max(0, Math.min(12, lv | 0));
  BU.setLevel(level);
  if (bump) { const s = book.scale.y; tween(0.5, (k) => { book.scale.y = s * (1 + Math.sin(Math.PI * k) * 0.06); }); }
}

/* ---------- 읽기 ---------- */
let idx = 0, bookOut = false;
function drawSpread() {
  if (!pages.length) {
    rightTex.draw({ eyebrow: 'GUESTBOOK', placeholder: '아직 펼쳐 볼 수 있는 페이지가 없습니다.', ruled: false, size: 50 });
    $('rpos').textContent = '0 / 0';
    $('readText').textContent = '아직 펼쳐 볼 수 있는 페이지가 없습니다.';
  } else {
    const p = pages[idx];
    rightTex.draw({ eyebrow: 'ONE PAGE', body: p.body, name: p.name || '익명', foot: `${idx + 1} / ${pages.length}`, size: 66 });
    $('rpos').textContent = `${idx + 1} / ${pages.length}`;
    $('readText').textContent = `${p.name || '익명'}: ${p.body}`;
  }
  $('prev').disabled = idx <= 0;
  $('next').disabled = idx >= pages.length - 1;
}
function readOrbit() {
  // 읽는 의자 쪽(+x)에서 펼친 책을 거의 바로 위에서 내려다본다
  // 가운데 = 펼친 두 면의 한가운데(책등). 책의 로컬 −x(책등) 방향으로 반 폭만큼
  const spine = new THREE.Vector3(-BU.W / 2, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), BOOK_DESK.ry);
  // 세로 화면: 펼친 두 면이 화면보다 넓으므로 글이 있는 오른쪽 면을 화면 가득(두 손가락으로 벌리거나 모아 조절)
  const P = isPortrait();
  // 앉은 채 상체를 조금 숙여 내려다보는 높이·각도(서서 내려다보는 느낌이 들지 않게)
  return { kind: 'read', center: (P ? BOOK_DESK.pos.clone() : BOOK_DESK.pos.clone().add(spine)).add(new THREE.Vector3(0, 0.02, 0)), r: P ? 0.6 : 0.62, theta: P ? 0.3 : 0.55, phi: Math.PI / 2 + 0.22, fov: P ? 58 : 44,
    min: 0.28, max: 1.1, thMin: 0.05, thMax: 1.0, phiMin: Math.PI / 2 + 0.22 - 0.7, phiMax: Math.PI / 2 + 0.22 + 0.7 };
}
async function openBook() {
  if (busy) return;
  if (mode === 'writing') closeWriting();
  if (!(mode === 'seat' && seat === 'read')) { await sit('read'); return; }   // 앉은 뒤 sit()이 다시 부른다
  busy = true;
  setMode('reading');
  idx = 0; drawSpread();
  // 방명록이 받침에서 읽는 자리 앞 책상으로 천천히 날아와(1.6 s) 표지가 열린다(1.2 s)
  const camGo = startOrbit({ ...readOrbit(), sec: 1.8 });
  await fly(book, BOOK_LEDGE, BOOK_DESK, 1.6, 0.3);
  bookOut = true;
  await tween(1.2, (k) => { BU.hinge.rotation.z = Math.PI * 0.985 * k; });
  await camGo;
  busy = false;
  $('next').focus({ preventScroll: true });
}
async function closeBook(quiet) {
  if (!bookOut) return;
  busy = true;
  rig.orbit = null;
  const sp = seatPose('read');
  const camGo = quiet ? null : flyCam(sp.pos, sp.look, sp.fov, 1.6);
  await tween(0.9, (k) => { BU.hinge.rotation.z = Math.PI * 0.985 * (1 - k); });
  await fly(book, { pos: book.position.clone(), ry: book.rotation.y }, BOOK_LEDGE, 1.3, 0.28);
  await camGo;
  if (!quiet) { rig.pos.copy(sp.pos); aimAt(sp.look); rig.fov = rig.tFov = sp.fov; }
  bookOut = false;
  setMode('seat');
  busy = false;
}
async function turn(dir) {
  if (busy || mode !== 'reading') return;
  const j = idx + dir;
  if (j < 0 || j >= pages.length) return;
  busy = true;
  const lh = BU.leafHinge;
  const cur = pages[idx], nxt = pages[j];
  const drawP = (tex, p, i) => tex.draw({ eyebrow: 'ONE PAGE', body: p.body, name: p.name || '익명', foot: `${i + 1} / ${pages.length}`, size: 66 });
  lh.visible = true;
  if (dir > 0) { drawP(leafTex, cur, idx); idx = j; drawSpread(); await tween(0.95, (k) => { lh.rotation.z = Math.PI * 0.985 * k; }); }
  else { drawP(leafTex, nxt, j); lh.rotation.z = Math.PI * 0.985; await tween(0.95, (k) => { lh.rotation.z = Math.PI * 0.985 * (1 - k); }); idx = j; drawSpread(); }
  lh.visible = false; lh.rotation.z = 0;
  busy = false;
}
$('prev').addEventListener('click', () => turn(-1));
$('next').addEventListener('click', () => turn(1));
$('closeBook').addEventListener('click', () => { if (!busy) closeBook(); });

/* ---------- 원래 비밀독서구역으로(뒷벽 통로) ---------- */
let leaving = false;
function leaveToRoom() {
  if (leaving) return;
  leaving = true;
  $('fade').classList.add('on');
  setTimeout(() => { location.href = '../experience/index.html?return=room'; }, reduced ? 50 : 700);
}

/* ---------- 고르기·걷기(마우스·터치·키보드) ---------- */
const PICK = new Map();
const tag = (obj, key) => obj.traverse((o) => { if (o.isMesh) PICK.set(o, key); });
tag(writeChair, 'writeChair'); tag(readChair, 'readChair'); tag(tray, 'tray'); tag(page, 'page'); tag(book, 'book');
const LABEL = { writeChair: '쓰는 자리', readChair: '읽는 자리', tray: '빈 페이지', page: '빈 페이지', book: '방명록' };
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function hitAt(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObjects([world.group, page], true).find((h) => h.object.visible && h.object.material?.visible !== false && !(h.object.material?.transparent && !h.object.material?.alphaTest)) || null;
}
const pickKey = (h) => (h ? PICK.get(h.object) ?? null : null);
function act(key) {
  if (busy) return;
  if (key === 'writeChair') return mode === 'seat' && seat === 'write' ? openWriting() : sit('write');
  if (key === 'readChair') return sit('read');
  if (key === 'tray' || key === 'page') return mode === 'writing' ? null : openWriting();
  if (key === 'book') return mode === 'reading' ? null : openBook();
}
// 바닥을 가리키면 걸어갈 자리를 보여 주는 고리(원래 방과 같은 표시)
const ringMark = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 48), new THREE.MeshBasicMaterial({ color: '#4F5F4C', transparent: true, opacity: 0, depthWrite: false }));
ringMark.rotation.x = -Math.PI / 2; scene.add(ringMark);
function floorTarget(h) {
  const d = new THREE.Vector3(h.point.x - rig.pos.x, 0, h.point.z - rig.pos.z);
  if (d.length() > 1.4) d.setLength(1.4);
  return limit(new THREE.Vector3(rig.pos.x + d.x, 0, rig.pos.z + d.z));
}
let down = null;
const touches = new Map();
let pinch = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; if (down) down.moved = true; return; }
  down = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 끝난 포인터 */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && touches.size === 2) {   // 두 손가락: 걷기(앞뒤) · 읽기·쓰기에서는 다가가기
    const [a, b] = [...touches.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    zoomStep((pinch.d - d) * 0.01);
    pinch.d = d; return;
  }
  if (down && e.pointerId === down.id) {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
    const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
    down.lx = e.clientX; down.ly = e.clientY;
    if (!down.moved || busy || camFly) return;
    if (rig.orbit) {   // 쓰기·읽기: 패키지 보기처럼 돌려 본다
      const o = rig.orbit;
      o.tphi = clamp(o.tphi - dx * 0.005, o.phiMin, o.phiMax);
      o.ttheta = clamp(o.ttheta - dy * 0.004, o.thMin, o.thMax);
    } else if (mode === 'walk' || mode === 'seat') {   // 둘러보기(앉아 있을 때는 몸을 돌리지 않는 범위 안에서)
      rig.tYaw -= dx * 0.0035;   // 원래 3D 독서구역처럼: 오른쪽으로 끌면 오른쪽을, 아래로 끌면 아래를 본다
      rig.tPitch = clamp(rig.tPitch - dy * 0.0028, -0.75, 0.45);
      if (mode === 'seat') { const sp = seatPose(seat); rig.tYaw = sp.yaw + clamp(wrapPi(rig.tYaw - sp.yaw), -1.1, 1.1); }
    }
    ringMark.material.opacity = 0;
    return;
  }
  if (e.pointerType !== 'mouse') return;
  const h = mode === 'sending' || busy ? null : hitAt(e.clientX, e.clientY);
  const k = mode === 'writing' ? null : pickKey(h);
  app.dataset.hover = k ? '1' : '';
  const hint = $('hint');
  if (k) { hint.textContent = LABEL[k]; hint.style.left = e.clientX + 'px'; hint.style.top = e.clientY + 'px'; hint.classList.add('on'); } else hint.classList.remove('on');
  if (!k && h?.object.userData.floor && (mode === 'walk' || mode === 'seat')) { const t = floorTarget(h); ringMark.position.set(t.x, 0.006, t.z); ringMark.material.opacity = 0.5; canvas.style.cursor = 'pointer'; }
  else { ringMark.material.opacity = 0; canvas.style.cursor = k ? 'pointer' : 'grab'; }
});
function endPointer(e) {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = null;
  const d = down;
  if (!d || d.id !== e.pointerId) return;
  down = null;
  if (e.type === 'pointercancel' || d.moved || busy) return;
  const h = hitAt(e.clientX, e.clientY), k = pickKey(h);
  $('hint').classList.remove('on');
  if (k) { act(k); return; }
  if (mode === 'reading' && h && h.object.parent && book.children.includes(h.object.parent) === false) { /* 책 밖을 눌러도 그대로 */ }
  // 바닥: 걷기(앉아 있으면 일어나서 걸어간다)
  if (h?.object.userData.floor && (mode === 'walk' || mode === 'seat')) {
    const t = floorTarget(h);
    if (mode === 'seat') stand().then(() => walkTo(t.x, t.z)); else walkTo(t.x, t.z);
    ringMark.material.opacity = 0;
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { ringMark.material.opacity = 0; $('hint').classList.remove('on'); });

// 휠: 걷기(앞뒤 한 걸음) · 앉아서 뒤로 굴리면 일어나기 · 읽기·쓰기에서는 다가가고 멀어지기(가장 멀리서 더 굴리면 의자로 돌아온다)
let wheelAcc = 0;
function zoomStep(dir) {   // dir > 0 = 멀어지기/뒤로
  if (busy || camFly) return;
  if (rig.orbit) {
    const o = rig.orbit;
    if (dir > 0 && o.tr >= o.max - 1e-3) { if (mode === 'reading') closeBook(); else backToSeat(); return; }
    o.tr = clamp(o.tr * (dir > 0 ? 1.14 : 1 / 1.14), o.min, o.max);
    return;
  }
  if (mode === 'seat') { if (dir > 0) stand(); return; }
  if (mode === 'walk') nudge(-Math.sign(dir) * 0.6);
}
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const unit = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
  if (Math.sign(unit) !== Math.sign(wheelAcc)) wheelAcc = 0;
  wheelAcc += unit;
  if (Math.abs(wheelAcc) < 60 && Math.abs(unit) < 40) return;
  const dir = Math.sign(wheelAcc); wheelAcc = 0;
  zoomStep(dir);
}, { passive: false });
$('spots').addEventListener('click', (e) => { const b = e.target.closest('button[data-go]'); if (b) (b.dataset.go === 'read' ? openBook() : sit('write')); });
$('stand').addEventListener('click', stand);
const keys = { f: 0, t: 0 };
addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea')) return;
  if (e.key === 'Escape') { if (mode === 'reading') closeBook(); else if (mode === 'writing') backToSeat(); else if (mode === 'seat') stand(); }
  if (mode === 'reading' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { turn(e.key === 'ArrowRight' ? 1 : -1); return; }
  if (mode === 'walk') {
    if (e.key === 'ArrowUp' || e.key === 'w') keys.f = 1;
    if (e.key === 'ArrowDown' || e.key === 's') keys.f = -1;
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.t = 1;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.t = -1;
  }
});
addEventListener('keyup', (e) => {
  if (['ArrowUp', 'ArrowDown', 'w', 's'].includes(e.key)) keys.f = 0;
  if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) keys.t = 0;
});

let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 4200);
}

/* ---------- 화면 크기 · 루프 ---------- */
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// 처음: 짧게(약 1초) 자리 잡는 움직임만 — 긴 입장 연출 없이 바로 라운지
placeStart();
const q = new URLSearchParams(location.search).get('cam');
if (q) { const v = q.split(',').map(Number); rig.pos.set(v[0], v[1], v[2]); rig.eye = v[1]; aimAt(new THREE.Vector3(v[3], v[4], v[5])); rig.fov = rig.tFov = v[6] || 42; }
else if (new URLSearchParams(location.search).get('from') === 'room') {
  // 원래 방의 노란 아치 문으로 건너왔다: 뒷벽 통로 안에서 라운지 쪽을 보며 한 걸음 들어선다
  rig.pos.set(D.x, EYE, ROOM.z1 + 0.05); rig.eye = EYE; aimAt(new THREE.Vector3(T.x, 0.8, T.z + 0.6)); rig.fov = rig.tFov = isPortrait() ? 68 : 50;
  rig.target = limit(new THREE.Vector3(D.x - 0.1, 0, ROOM.z1 + 0.9));
}
else if (!reduced) { rig.pos.x -= 0.25; rig.pos.z += 0.3; rig.target = limit(new THREE.Vector3(rig.pos.x + 0.25, 0, rig.pos.z - 0.3)); }
const hintEl = $('exploreHint');
if (hintEl) { setTimeout(() => hintEl.classList.add('show'), 900); setTimeout(() => hintEl.classList.remove('show'), 7500); }

const euler = new THREE.Euler(0, 0, 0, 'YXZ');
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  for (const t of tweens) {
    const k = Math.min(1, (now - t.t0) / t.dur);
    t.fn(t.ease(Math.max(0, k)));
    if (k >= 1) { tweens.delete(t); t.res(); }
  }
  if (!camFly) {
    if (rig.orbit) {
      const o = rig.orbit, a = 1 - Math.exp(-5 * dt);
      o.r += (o.tr - o.r) * a; o.theta += (o.ttheta - o.theta) * a; o.phi += (o.tphi - o.phi) * a;
      camera.position.copy(orbitPose(o)); camera.lookAt(o.center);
      if (Math.abs(camera.fov - o.fov) > 1e-3) { camera.fov = o.fov; camera.updateProjectionMatrix(); }
    } else {
      if (mode === 'walk') {
        if (keys.t) rig.tYaw += keys.t * 0.9 * dt;
        if (keys.f) nudge(keys.f * 1.25 * dt * 1.8);
        if (rig.target) {
          const dx = rig.target.x - rig.pos.x, dz = rig.target.z - rig.pos.z, dist = Math.hypot(dx, dz);
          if (dist < 0.004) { rig.target = null; rig.moving = 0; }
          else { const v = Math.min(1.25, dist * 2.4 + 0.05), step = Math.min(dist, v * dt); rig.pos.x += (dx / dist) * step; rig.pos.z += (dz / dist) * step; rig.moving = v; rig.bob += step * 7.5; }
        } else rig.moving *= 0.9;
        // 통로 끝까지 걸어가면 원래 비밀독서구역으로
        if (rig.pos.z < ROOM.z1 - ROOM.wt * 0.5) leaveToRoom();
      }
      const k = 1 - Math.exp(-2.6 * dt);
      rig.yaw += (rig.tYaw - rig.yaw) * k; rig.pitch += (rig.tPitch - rig.pitch) * k;
      rig.fov += (rig.tFov - rig.fov) * (1 - Math.exp(-1.8 * dt));
      const bobAmt = Math.min(1, rig.moving / 1.25) * 0.01;
      camera.position.set(rig.pos.x, rig.eye + Math.sin(rig.bob) * bobAmt, rig.pos.z);
      euler.set(rig.pitch, rig.yaw, 0); camera.quaternion.setFromEuler(euler);
      if (Math.abs(camera.fov - rig.fov) > 1e-3) { camera.fov = rig.fov; camera.updateProjectionMatrix(); }
    }
  }
  visitors.update(now / 1000, dt, reduced);
  pageGlow.update(now / 1000, page, page.visible && !pageAtDesk && (mode === 'walk' || mode === 'seat'));
  renderer.render(scene, camera);
});

/* ---------- 데이터 ---------- */
async function refreshTrace() {
  try {
    const d = await backend.publicPages(); pages = d.pages || [];
    if (d.trace) { setLevel(d.trace.leaves || 0); traces.setLevel(Math.max(d.trace.visits || 0, d.trace.leaves || 0)); }
  } catch (e) { /* 그대로 */ }
}
setMode('walk');
getBackend().then(async (b) => {
  backend = b;
  if (!b) { $('previewNote').hidden = false; return; }
  await refreshTrace();
});
if (new URLSearchParams(location.search).get('from') === 'room') $('toRoom').href = '../experience/index.html?return=room';

// 브라우저 확인용
window.__lounge = { traces, visitors, presence, THREE, scene, camera, world, rig, act, sit, stand, openBook, openWriting, setLevel, get mode() { return mode; }, get seat() { return seat; }, get pages() { return pages; }, set pages(v) { pages = v; }, page, book, tweens };
