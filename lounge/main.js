// HIRANG GUESTBOOK 3D — 렌더러·빛·카메라·상호작용.
// 원래 비밀독서구역(experience/js/main.js)과 같은 톤 매핑·노출·환경광. 백엔드는 기존 guestbook/lib 그대로.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildLounge, buildPage, buildTraces, LAYOUT, ROOM } from './world.js';
import { makePageTexture } from './pages.js';
import { getBackend } from '../lib/backend.js';
import { visitorKey } from '../lib/visitor-key.js';

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
const traces = buildTraces(sym);
scene.add(traces.group);
const BU = book.userData;

// 쓰는 종이: 트레이 맨 위 한 장. 글이 실시간으로 적힌다(앞면 좌우를 뒤집어 앉은 사람 쪽에서 바로 읽히게)
const writeTex = makePageTexture(297 / 210);
writeTex.center.set(0.5, 0.5); writeTex.rotation = Math.PI;   // 앉은 사람 쪽에서 바로 읽히게(위쪽이 책상 안쪽)
const page = buildPage(writeTex);
scene.add(page);
const T = LAYOUT.table;
const PAGE_TRAY = () => { const p = tray.localToWorld(new THREE.Vector3(0, 0.0195, 0.008)); return { pos: p, ry: tray.rotation.y }; };
const PAGE_DESK = { pos: new THREE.Vector3(T.x - 0.08, T.h + 0.0007, T.z - 0.13), ry: 0.04 };
function placePage(p) { page.position.copy(p.pos); page.rotation.set(0, p.ry, 0); }
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

/* ---------- 카메라 ---------- */
// 시점: [위치, 바라볼 곳, 렌즈]. 세로 화면은 p 값을 쓴다
const RC = LAYOUT.readChair, WC = LAYOUT.writeChair;
const VIEWS = {
  // 세로 화면: 왼쪽 벽 쪽에서 방을 가로질러 — 책상·두 의자·받침의 방명록이 한 화면에(방명록을 숨기지 않는다)
  overview: { pos: [-2.05, 1.5, -0.3], look: [0.35, 0.85, -3.7], fov: 42, p: { pos: [-2.2, 1.8, -1.9], look: [1.27, 0.42, -3.55], fov: 74 } },
  // 쓰는 의자에 앉은 눈높이(좌면 0.44 m + 앉은키): 책상 위 종이를 내려다본다
  seatWrite: { pos: [WC.x, 1.17, WC.z - 0.06], look: [WC.x + 0.18, 0.72, T.z + 1.3], fov: 60, p: { pos: [WC.x, 1.16, WC.z + 0.02], look: [WC.x, 0.7, T.z + 0.15], fov: 70 } },
  // 쓰는 중: 종이에 조금 더 가까이. 오른쪽 입력 카드를 피해 종이가 화면 왼쪽에 오게
  // (앉은 사람의 왼쪽이 +x — 종이를 화면 왼쪽에 두려면 종이보다 −x 쪽을 본다)
  writing: { pos: [WC.x - 0.1, 1.12, WC.z + 0.02], look: [T.x - 0.28, 0.74, T.z - 0.1], fov: 46, p: { pos: [WC.x - 0.08, 1.42, WC.z - 0.05], look: [WC.x - 0.08, 0.5, WC.z + 0.38], fov: 60 } },
  // 읽는 의자에 앉은 눈높이: 책상 오른쪽 끝(방명록이 놓일 자리)과 받침을 함께
  seatRead: { pos: [RC.x + 0.12, 1.17, RC.z - 0.03], look: [T.x - 0.6, 0.74, T.z + 0.25], fov: 60, p: { pos: [RC.x + 0.1, 1.16, RC.z], look: [T.x + 0.3, 0.7, T.z + 0.03], fov: 70 } },
  // 펼친 방명록을 읽는 의자에서 내려다본다(좌면에서 상체를 숙인 높이)
  reading: { pos: [BOOK_DESK.pos.x + 0.5, 1.26, BOOK_DESK.pos.z + 0.02], look: [BOOK_DESK.pos.x - 0.06, 0.745, BOOK_DESK.pos.z], fov: 44, p: { pos: [BOOK_DESK.pos.x + 0.42, 1.38, BOOK_DESK.pos.z + 0.02], look: [BOOK_DESK.pos.x - 0.05, 0.74, BOOK_DESK.pos.z], fov: 62 } },
  // 보내는 중: 책상과 받침의 방명록을 함께
  sending: { pos: [-0.75, 1.8, -0.85], look: [1.4, 0.72, -3.05], fov: 50, p: { pos: [0.2, 1.7, -1.0], look: [1.6, 0.72, -3.0], fov: 66 } },
};
const V = (name) => { const v = VIEWS[name]; return isPortrait() && v.p ? v.p : v; };
const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 42, yaw: 0, pitch: 0, tyaw: 0, tpitch: 0 };
let viewName = 'overview';
function snapView(name) { const v = V(name); viewName = name; cam.pos.set(...v.pos); cam.look.set(...v.look); cam.fov = v.fov; }

/* ---------- 움직임 ---------- */
const easeIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const tweens = new Set();
function tween(sec, fn, ease = easeIO) {
  return new Promise((res) => {
    const dur = (reduced ? Math.min(sec, 0.12) : sec) * 1000;
    tweens.add({ t0: performance.now(), dur, fn, ease, res });
  });
}
const wait = (sec) => tween(sec, () => {});
function moveCam(name, sec = 0.6) {
  const v = V(name); viewName = name;
  const p0 = cam.pos.clone(), l0 = cam.look.clone(), f0 = cam.fov;
  const p1 = new THREE.Vector3(...v.pos), l1 = new THREE.Vector3(...v.look);
  cam.tyaw = 0; cam.tpitch = 0;
  return tween(sec, (k) => { cam.pos.lerpVectors(p0, p1, k); cam.look.lerpVectors(l0, l1, k); cam.fov = f0 + (v.fov - f0) * k; });
}
// 물체를 a → b로(포물선 높이 arc). 회전은 y축만
function fly(obj, from, to, sec, arc = 0, extra) {
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, from.ry, 0));
  const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, to.ry, 0));
  return tween(sec, (k) => {
    obj.position.lerpVectors(from.pos, to.pos, k);
    obj.position.y += Math.sin(Math.PI * k) * arc;
    obj.quaternion.slerpQuaternions(q0, q1, k);
    extra?.(k);
  });
}

/* ---------- 상태 ---------- */
// overview · seatWrite · writing · sending · seatRead · reading
let mode = 'overview', busy = false;
function setMode(m) {
  mode = m; app.dataset.mode = m;
  $('stand').hidden = m === 'overview';
  $('writer').hidden = m !== 'writing';
  $('reader').hidden = m !== 'reading';
  $('spots').setAttribute('aria-hidden', m === 'overview' ? 'false' : 'true');
}

async function sit(which) {
  if (busy) return;
  // 읽는 자리에 앉는다 = 읽고 싶다: 방명록이 받침에서 책상으로 와서 바로 펼쳐진다(방을 가로지르지 않는다)
  if (which === 'read') return openBook();
  if (mode === 'writing') closeWriting(true);
  if (mode === 'reading') await closeBook();
  busy = true;
  setMode(which === 'write' ? 'seatWrite' : 'seatRead');
  await moveCam(which === 'write' ? 'seatWrite' : 'seatRead', 0.85);
  busy = false;
  $('stand').focus({ preventScroll: true });
}
async function stand() {
  if (busy) return;
  if (mode === 'writing') closeWriting(true);
  if (mode === 'reading') await closeBook();
  busy = true;
  setMode('overview');
  await moveCam('overview', 0.85);
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

let pageAtDesk = false;
async function openWriting() {
  if (busy) return;
  if (mode === 'reading') await closeBook();
  busy = true;
  const fromSeat = mode === 'seatWrite';
  setMode('writing');
  syncForm();
  // 종이를 트레이에서 쓰는 자리로(짧게) — 카메라도 동시에 쓰는 자리로 다가간다(0.55 s)
  const camGo = moveCam('writing', fromSeat ? 0.55 : 0.9);
  if (!pageAtDesk) { await fly(page, PAGE_TRAY(), PAGE_DESK, 0.55, 0.06); pageAtDesk = true; }
  await camGo;
  busy = false;
  if (!narrow()) bodyIn.focus({ preventScroll: true });
}
function closeWriting(keepText) {
  // 입력은 지우지 않는다(실패하거나 잠시 일어나도 글이 남는다). 종이는 책상 위에 그대로 둔다
  $('err').textContent = '';
  setMode('seatWrite');
  if (!keepText) bodyIn.value = '';
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
  mode = 'sending'; app.dataset.mode = 'sending';
  const camGo = moveCam('sending', 0.8);
  const up = { pos: PAGE_DESK.pos.clone().add(new THREE.Vector3(0, 0.22, 0.05)), ry: PAGE_DESK.ry };
  await fly(page, PAGE_DESK, up, 0.45, 0, (k) => { page.rotation.x = -0.35 * k; });
  // 책 위 도착 지점: 종이 덩어리 윗면 바로 위, 책과 같은 방향(종이 위쪽 = 책 페이지 위쪽)
  const top = book.localToWorld(new THREE.Vector3(0.02, BU.top + 0.003, 0));
  const above = { pos: top.clone().add(new THREE.Vector3(0, 0.16, 0)), ry: book.rotation.y + Math.PI };
  const coverOpen = tween(0.55, (k) => { BU.hinge.rotation.z = Math.PI * 0.94 * k; }, easeOut);
  await fly(page, up, above, 0.85, 0.28, (k) => { page.rotation.x = -0.35 * (1 - k) + Math.sin(Math.PI * k) * 0.25; page.rotation.z = Math.sin(Math.PI * k) * -0.18; });
  await coverOpen;
  await camGo;
  await fly(page, above, { pos: top, ry: above.ry }, 0.4, 0, (k) => { page.rotation.x = 0; page.rotation.z = 0; });
  page.visible = false;
  setLevel(level + 1, true);
  const mine = traces.addMine();   // 벽감에 조용히 한 조각
  if (mine) { const s = mine.userData.s; tween(0.6, (k) => mine.scale.setScalar(s * k), easeOut); }
  await tween(0.5, (k) => { BU.hinge.rotation.z = Math.PI * 0.94 * (1 - k); });
  // 다음 방문자를 위한 새 종이가 트레이에
  pageAtDesk = false; placePage(PAGE_TRAY());
  writeTex.draw({ eyebrow: 'ONE PAGE', placeholder: '당신의 한 페이지를 남겨주세요.', name: '익명', size: 44 });
  page.visible = true;
  setMode('seatWrite');
  await moveCam('seatWrite', 0.7);
}
function setLevel(lv, bump = false) {
  level = Math.max(0, Math.min(12, lv | 0));
  BU.setLevel(level);
  if (bump) { const s = book.scale.y; tween(0.35, (k) => { book.scale.y = s * (1 + Math.sin(Math.PI * k) * 0.06); }); }
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
    rightTex.draw({ eyebrow: 'ONE PAGE', body: p.body, name: p.name || '익명', foot: `${idx + 1} / ${pages.length}`, size: 50 });
    $('rpos').textContent = `${idx + 1} / ${pages.length}`;
    $('readText').textContent = `${p.name || '익명'}: ${p.body}`;
  }
  $('prev').disabled = idx <= 0;
  $('next').disabled = idx >= pages.length - 1;
}
async function openBook() {
  if (busy) return;
  if (mode === 'writing') closeWriting(true);
  busy = true;
  setMode('reading');
  idx = 0; drawSpread();
  // 방명록이 받침에서 읽는 자리 앞 책상으로 온다(방문객이 방을 가로지르지 않는다)
  const camGo = moveCam('reading', 0.9);
  await fly(book, BOOK_LEDGE, BOOK_DESK, 0.9, 0.32);
  bookOut = true;
  await tween(0.6, (k) => { BU.hinge.rotation.z = Math.PI * 0.985 * k; }, easeOut);
  await camGo;
  busy = false;
  $('next').focus({ preventScroll: true });
}
async function closeBook() {
  if (!bookOut) return;
  busy = true;
  await tween(0.45, (k) => { BU.hinge.rotation.z = Math.PI * 0.985 * (1 - k); });
  await fly(book, { pos: book.position.clone(), ry: book.rotation.y }, BOOK_LEDGE, 0.8, 0.3);
  bookOut = false;
  setMode('seatRead');
  busy = false;
}
async function turn(dir) {
  if (busy || mode !== 'reading') return;
  const j = idx + dir;
  if (j < 0 || j >= pages.length) return;
  busy = true;
  const lh = BU.leafHinge;
  const cur = pages[idx], nxt = pages[j];
  const drawP = (tex, p, i) => tex.draw({ eyebrow: 'ONE PAGE', body: p.body, name: p.name || '익명', foot: `${i + 1} / ${pages.length}`, size: 50 });
  lh.visible = true;
  if (dir > 0) {   // 지금 장이 왼쪽으로 넘어가고, 아래에서 다음 장이 드러난다
    drawP(leafTex, cur, idx); idx = j; drawSpread();
    await tween(0.65, (k) => { lh.rotation.z = Math.PI * 0.985 * k; });
  } else {         // 앞 장이 왼쪽에서 넘어와 덮는다
    drawP(leafTex, nxt, j); lh.rotation.z = Math.PI * 0.985;
    await tween(0.65, (k) => { lh.rotation.z = Math.PI * 0.985 * (1 - k); });
    idx = j; drawSpread();
  }
  lh.visible = false; lh.rotation.z = 0;
  busy = false;
}
$('prev').addEventListener('click', () => turn(-1));
$('next').addEventListener('click', () => turn(1));
$('closeBook').addEventListener('click', () => { if (!busy) closeBook(); });

/* ---------- 고르기(마우스·터치·키보드) ---------- */
const PICK = new Map();
const tag = (obj, key) => obj.traverse((o) => { if (o.isMesh) PICK.set(o, key); });
tag(writeChair, 'writeChair'); tag(readChair, 'readChair'); tag(tray, 'tray'); tag(page, 'page'); tag(book, 'book');
const LABEL = { writeChair: '쓰는 자리', readChair: '읽는 자리', tray: '빈 페이지', page: '빈 페이지', book: '방명록' };
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();

function pickAt(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  // 벽·가구에 가려진 물체는 고르지 않는다: 가장 가까이 맞은 것이 고를 수 있는 물체일 때만
  const first = ray.intersectObjects([world.group, page], true).find((h) => h.object.visible && h.object.material?.visible !== false);
  return first ? PICK.get(first.object) ?? null : null;
}
function act(key) {
  if (busy) return;
  if (key === 'writeChair') return mode === 'seatWrite' ? openWriting() : sit('write');
  if (key === 'readChair') return mode === 'seatRead' ? openBook() : sit('read');
  if (key === 'tray' || key === 'page') return mode === 'writing' ? null : openWriting();
  if (key === 'book') return mode === 'reading' ? null : openBook();
}
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, yaw: cam.tyaw, pitch: cam.tpitch, moved: false }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (down) {
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) > 6) down.moved = true;
    // 둘러보기: 좌우 ±0.32 rad, 위아래 ±0.14 rad만(장면의 구도를 잃지 않게)
    if (down.moved && (mode === 'overview' || mode === 'seatWrite' || mode === 'seatRead')) {
      cam.tyaw = THREE.MathUtils.clamp(down.yaw - dx * 0.0022, -0.32, 0.32);
      cam.tpitch = THREE.MathUtils.clamp(down.pitch - dy * 0.0016, -0.14, 0.14);
    }
    return;
  }
  if (e.pointerType !== 'mouse') return;
  const k = mode === 'writing' || mode === 'sending' ? null : pickAt(e.clientX, e.clientY);
  app.dataset.hover = k ? '1' : '';
  const h = $('hint');
  if (k) { h.textContent = LABEL[k]; h.style.left = e.clientX + 'px'; h.style.top = e.clientY + 'px'; h.classList.add('on'); } else h.classList.remove('on');
});
canvas.addEventListener('pointerup', (e) => {
  const d = down; down = null;
  if (!d || d.moved) return;
  const k = pickAt(e.clientX, e.clientY);
  $('hint').classList.remove('on');
  if (k) act(k);
});
canvas.addEventListener('pointercancel', () => { down = null; });
$('spots').addEventListener('click', (e) => { const b = e.target.closest('button[data-go]'); if (b) sit(b.dataset.go); });
$('stand').addEventListener('click', stand);
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (mode === 'reading') closeBook(); else if (mode === 'writing') closeWriting(true); else if (mode !== 'overview') stand(); }
  if (mode === 'reading' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) turn(e.key === 'ArrowRight' ? 1 : -1);
});

let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 4200);
}

/* ---------- 화면 크기 · 루프 ---------- */
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  if (!busy) snapView(viewName);
}
addEventListener('resize', resize);

// 처음: 짧게(약 1초) 자리 잡는 움직임만 — 긴 입장 연출 없이 바로 라운지
snapView('overview');
const q = new URLSearchParams(location.search).get('cam');
if (q) { const v = q.split(',').map(Number); VIEWS.debug = { pos: v.slice(0, 3), look: v.slice(3, 6), fov: v[6] || 42 }; snapView('debug'); }
else if (!reduced) { const v = V('overview'); cam.pos.set(v.pos[0] - 0.25, v.pos[1] + 0.12, v.pos[2] + 0.35); moveCam('overview', 1.0); }
resize();

const dir = new THREE.Vector3(), tmp = new THREE.Vector3();
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  for (const t of tweens) {
    const k = Math.min(1, (now - t.t0) / t.dur);
    t.fn(t.ease(Math.max(0, k)));
    if (k >= 1) { tweens.delete(t); t.res(); }
  }
  // 둘러보기 각도는 부드럽게 따라온다
  cam.yaw += (cam.tyaw - cam.yaw) * Math.min(1, dt * 8);
  cam.pitch += (cam.tpitch - cam.pitch) * Math.min(1, dt * 8);
  camera.position.copy(cam.pos);
  dir.subVectors(cam.look, cam.pos);
  const dist = dir.length();
  dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), cam.yaw);
  const side = tmp.crossVectors(dir, camera.up).normalize();
  dir.applyAxisAngle(side, cam.pitch);
  camera.lookAt(tmp.copy(cam.pos).addScaledVector(dir, dist));
  if (camera.fov !== cam.fov) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  renderer.render(scene, camera);
});

/* ---------- 데이터 ---------- */
async function refreshTrace() {
  try {
    const d = await backend.publicPages(); pages = d.pages || [];
    if (d.trace) { setLevel(d.trace.leaves || 0); traces.setLevel(Math.max(d.trace.visits || 0, d.trace.leaves || 0)); }
  } catch (e) { /* 그대로 */ }
}
setMode('overview');
getBackend().then(async (b) => {
  backend = b;
  if (!b) { $('previewNote').hidden = false; return; }
  await refreshTrace();
});
if (new URLSearchParams(location.search).get('from') === 'room') $('toRoom').href = '../experience/index.html?return=room';

// 브라우저 확인용
window.__lounge = { traces, THREE, scene, camera, world, cam, VIEWS, moveCam, snapView, act, setLevel, get mode() { return mode; }, get pages() { return pages; }, set pages(v) { pages = v; }, page, book, tweens };
