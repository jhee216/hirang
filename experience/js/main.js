// HIRANG — The Secret Reading Zone
// 문 · 문틀 · 내부 공간 · 카메라가 하나의 3D 좌표계에 있고, 상태 머신이 입력을 조율한다.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { COLORS, CAMERA, DOOR, TIMING, PACKAGES, STATIONS, GUESTBOOK_DOOR } from './config.js';
import { mountLounge } from '../../guestbook/lounge/room-lounge.js';
import { S, createState } from './state.js';
import { CameraRig } from './camera-rig.js';
import { loadLogos, setAnisotropy, logoImage } from './textures.js';
import { loadPackages } from './packages/package-model.js';
import { buildDoor } from './world/door.js';
import { buildRoom } from './world/room.js';
import { buildPeople } from './world/people.js';
// 2026-11-11 라이브: 실제 접속한 익명 방문자 · 벽의 작은 익명 흔적(방명록은 3D가 아니라 /guestbook/ 페이지)
import { getBackend } from './live/backend.js';
import { startPresence } from './live/presence.js';
import { buildTraces } from './live/traces.js';
import { mergeStatic, compactMaterialGroups } from './merge-static.js';
import { createPost } from './post.js';
import { createAudio } from './audio.js';
import { daylight, hourOverride } from './daylight.js';

const $ = (id) => document.getElementById(id);
const ui = {
  app: $('app'), canvas: $('scene'), loader: $('loader'),
  doorHint: $('doorHint'), exploreHint: $('exploreHint'), hover: $('hoverHint'),
  reader: $('reader'), rTitle: $('rTitle'), rSub: $('rSub'), rPage: $('rPage'),
  rPrev: $('rPrev'), rNext: $('rNext'), rMore: $('rMore'), rClose: $('rClose'), rOpen: $('rOpen'), rBack: $('rBack'),
  rText: $('rText'), rLarge: $('rLarge'), rRange: $('rRange'), stations: $('stations'), stationList: $('stationList'), stPrev: $('stPrev'), stNext: $('stNext'), objects: $('objects'), skip: $('skipIntro'), fade: $('fade'), exitAsk: $('exitAsk'), exitGo: $('exitGo'), exitStay: $('exitStay'), toast: $('toast'), bgmBtn: $('bgmBtn'), live: $('live'),
};

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
// 휴대폰·태블릿은 후처리 없이 화면에 바로 그리는 가벼운 경로(post.js LITE). ?full 을 붙이면 데스크톱 경로로 확인할 수 있다
const lite = coarse && !new URLSearchParams(location.search).has('full');

/* ---------- WebGL 지원 확인 → 미지원이면 대체 UI ---------- */
function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
// ?fallback 을 붙이면 대체 UI를 강제로 확인할 수 있다(QA용)
if (!webglOK() || !window.gsap || new URLSearchParams(location.search).has('fallback')) {
  document.documentElement.classList.add('no-webgl');
  throw new Error('WebGL unavailable — fallback UI shown');
}
if (reduced) gsap.globalTimeline.timeScale(2.4);

/* ---------- 렌더러 · 씬 ---------- */
const renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;   // 브랜드 색이 바래지 않는 톤 매핑
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;   // 후처리가 장면을 여러 번 그리므로 그림자는 프레임마다 한 번만 갱신
setAnisotropy(renderer);
ui.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); document.documentElement.classList.add('no-webgl'); });

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.ivory);
scene.fog = new THREE.Fog('#F6F1E6', 9, 34);   // rev5: 4.5 → 9 m부터 — 문 앞(문까지 ~4.5 m, 책장까지 ~10 m)에서 방 안이 뿌옇게 바래던 안개를 걷었다. 깊이는 실제 형상·그림자로   // 따뜻한 공기층. rev4: 8 → 4.5 m부터 — 뒤쪽 벽·아치가 조금씩 공기 속으로 물러나 앞뒤 층이 갈린다
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.38;

const camera = new THREE.PerspectiveCamera(CAMERA.fov, innerWidth / innerHeight, 0.03, 60);
const isPortrait = () => innerWidth / innerHeight < 0.8;
scene.add(camera);
const rig = new CameraRig(camera);
// 2.0: 렌즈(시야)는 카메라 리그가 갖고, 세로 화면은 배율만 곱한다(문 앞 50° → 방 안 44° → 관람 지점별)
function applyFov() {
  camera.aspect = innerWidth / innerHeight;
  rig.fovScale = isPortrait() ? CAMERA.portrait.fovScale : 1;
  rig.fovScaleIn = isPortrait() ? CAMERA.portrait.fovScaleIn : 1;
  camera.fov = rig.fov * rig.fovScale;
  camera.updateProjectionMatrix();
}
applyFov();
// 문 앞 시작 거리: 세로 화면은 시야가 넓어 문이 작아 보이므로 더 가까이 선다(문이 화면에 같은 크기로)
// 문 앞 시작 거리: 기본 거리에 서되, 화면이 좁아 문 양옆 벽등까지 다 안 들어오면 그만큼 물러선다
// (휴대폰 세로·아이패드에서 벽등이 화면 끝에 반쯤 잘려 깨져 보이지 않게)
function startZ() {
  const base = isPortrait() ? CAMERA.portrait.startZ : CAMERA.start[2];
  const need = DOOR.width / 2 + 0.74 + 0.22;   // rev4: 문 반폭 + 벽등(문 가운데에서 1.94 m) + 여유(m)
  const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 0.9;
  return THREE.MathUtils.clamp(need / halfTan + DOOR.wallThickness / 2 + DOOR.facade, base, 7.5);
}
function placeStart() {
  if (!state?.is(S.INITIAL, S.DOOR_HOVER)) return;
  rig.pos.set(CAMERA.start[0], CAMERA.start[1], startZ());
}

/* ---------- 조명 ---------- */
// 하늘빛은 낮추고 해·스포트를 올려 면마다 밝기가 달라지게(평평한 그래픽 느낌을 줄이고 그림자로 형태를 만든다)
const HEMI = 0.4, SUN = 2.0;
const hemi = new THREE.HemisphereLight('#FFFDF6', '#EFE6D4', HEMI);
scene.add(hemi);

// 실내 햇빛: 왼쪽 벽 아치 창 밖 높은 곳에서 비스듬히 들어와 바닥·셸프에 아치 모양 빛과 긴 그림자를 남긴다
const roomSun = new THREE.SpotLight('#FFF0D6', 6.2, 0, 0.55, 0.35, 0);
roomSun.position.set(-10.2, 7.4, 0.8);
roomSun.target.position.set(1.6, 0.2, -5.2);
roomSun.castShadow = true;
roomSun.shadow.mapSize.set(2048, 2048);   // 휴대폰·아이패드도 그림자 가장자리가 깨지지 않게
roomSun.shadow.camera.near = 4; roomSun.shadow.camera.far = 22;
roomSun.shadow.bias = -0.0005; roomSun.shadow.normalBias = 0.02; roomSun.shadow.radius = 3;
scene.add(roomSun, roomSun.target);

// 바깥 키 라이트: 벽·천장이 그림자를 드리워 내부는 문이 열린 만큼만 빛을 받는다
const sun = new THREE.DirectionalLight('#FFFAF0', SUN);
sun.position.set(-7.5, 6.2, 3.4);   // 벽을 비스듬히 스치는 해: 벽에 명암 기울기와 문틀 그림자가 생긴다
sun.target.position.set(0, 0.8, -1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -6, near: 1, far: 24 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
scene.add(sun, sun.target);

// 문 위 조명(호버 시 은은하게 밝아진다)
const doorLight = new THREE.SpotLight('#FFF2D8', 6, 7, 0.55, 0.9, 1.6);
doorLight.position.set(0, 3.7, 1.9);
doorLight.target.position.set(0, 1.1, 0);
scene.add(doorLight, doorLight.target);

// rev6-5: 창살 햇빛 무늬(sunPatch)는 문에 낯선 그림자를 만들어 뺐다

// 내부: 셸프를 비추는 천장 스포트(그림자) + 패키지 쪽 보조광 + 노란 창의 따뜻한 빛
const shelfSpot = new THREE.SpotLight('#FFF4DE', 24, 9, 0.62, 0.85, 1.4);
shelfSpot.position.set(0, 4.05, -2.4);
shelfSpot.target.position.set(0, 1.0, -5.15);
shelfSpot.castShadow = true;
shelfSpot.shadow.mapSize.set(1024, 1024);
shelfSpot.shadow.bias = -0.0006; shelfSpot.shadow.radius = 5;
scene.add(shelfSpot, shelfSpot.target);
const lamps = [shelfSpot];   // 실내 인공 조명: 해가 지면 더 밝고 따뜻해진다
for (const [x, z, c] of [[-2.3, -3.7, '#FFF6E2'], [2.3, -3.8, '#F6EEFF']]) {
  const s = new THREE.SpotLight(c, 14, 6, 0.42, 0.9, 1.5);
  lamps.push(s);
  s.position.set(x * 0.7, 4.0, z + 1.2);
  s.target.position.set(x, 1.0, z);
  scene.add(s, s.target);
}
// 입구 벽을 비추는 천장 조명: 방 안에서 뒤돌아봐도 벽이 어둡게 죽지 않는다
const entrySpot = new THREE.SpotLight('#FFF3DC', 16, 7, 0.95, 0.9, 1.3);
entrySpot.position.set(0, 4.0, -3.6);
entrySpot.target.position.set(0, 1.1, -0.1);
scene.add(entrySpot, entrySpot.target);
lamps.push(entrySpot);
for (const [x, z] of [[-3.7, -3.4], [3.7, -5.4]]) {
  const p = new THREE.PointLight('#FFF3C2', 2.2, 4.2, 1.6);
  lamps.push(p);
  p.position.set(x, 1.9, z);
  scene.add(p);
}
// 선택한 오브젝트를 볼 때만 켜지는 시선 쪽 보조광(원본 뷰어처럼 보는 쪽 면이 밝게)
const inspectLight = new THREE.DirectionalLight('#FFF8EE', 0);
inspectLight.position.set(-0.5, 0.9, 0.4);
inspectLight.target.position.set(0, 0, -1);
camera.add(inspectLight, inspectLight.target);
// 호버한 오브젝트 위로 다가가는 작은 빛
const hoverLight = new THREE.PointLight('#FFF6E6', 0, 1.6, 1.4);
// 터치 기기에는 마우스를 올려 두는 동작이 없어 이 빛이 거의 켜지지 않는다. 꺼진 조명도 모든 픽셀에서 계산되므로 휴대폰 경로에서는 빼 둔다
if (!lite) scene.add(hoverLight);

// 고른 책·패키지는 별도 층(overlay)에 그린다: 늘 앞에 보이고(선반 뒤로 숨지 않음) 심도 흐림도 받지 않는다
const overlay = new THREE.Scene();
overlay.environment = scene.environment;
overlay.environmentIntensity = 0.35;
overlay.add(new THREE.HemisphereLight('#FFFFFF', '#E9E0CF', 1.05));
const ovKey = new THREE.DirectionalLight('#FFF7EA', 1.25);
overlay.add(ovKey, ovKey.target);
const _ov = new THREE.Vector3();
function updateOverlayLight() {
  ovKey.position.copy(camera.position).add(_ov.set(-0.7, 1.1, 0.5).applyQuaternion(camera.quaternion));
  ovKey.target.position.copy(camera.position).add(_ov.set(0, 0, -1).applyQuaternion(camera.quaternion));
}

/* ---------- 월드 ---------- */
await loadLogos();
const door = buildDoor();
// 화면 비율이 바뀌면 문 앞 구성도 그 비율에 맞게 다시 잡는다(명판 위치·크기)
function fitPlaque() {
  const d = startZ() - DOOR.wallThickness / 2 - DOOR.facade;
  door.placePlaque(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d * camera.aspect);
}
fitPlaque();
scene.add(door.group);
const sym = await fetch('assets/symbol-shape.json').then((r) => r.json());
const packages = await loadPackages(PACKAGES, { sym, wordImg: logoImage('word') });
const room = buildRoom({ sym, packages, sideDoor: GUESTBOOK_DOOR });
// 2026-11-13: 방명록 라운지 — 오른쪽 벽 아치 입구 너머의 옆방(같은 장면). 앉기·쓰기·읽기 동안만 라운지가 카메라를 맡는다
const lounge = await mountLounge({ scene, camera, rig, door: GUESTBOOK_DOOR, sym, root: ui.app, coarse });
window.__lounge = lounge;   // 브라우저 확인용
{ const i = STATIONS.findIndex((s) => s[0] === '방명록'); if (i >= 0) { const st = lounge.station; STATIONS[i][1] = [st.pos.x, st.pos.z]; STATIONS[i][2] = [st.look.x, st.look.y, st.look.z]; STATIONS[i][3] = st.lens; } }
// 공간을 둘러보는 관람객들
const people = buildPeople(room.group);
room.obstacles.push(...people.obstacles);
// 2026-11-11 라이브: 방문자 캐릭터는 서버가 알려 준 '지금 접속한 다른 방문자'만(최대 5명, 아무도 없으면 없음)
// 2026-11-13: 방이 비어 보이지 않게 — 실제 접속자가 적어도 처음 한 명, 7초 안에 세 명이 둘러본다(실제 접속자가 오면 그 자리를 대신한다, 최대 5명)
let realFigures = [], ambientN = 1;
const AMBIENT = ['ambient-a', 'ambient-b', 'ambient-c'];
function syncFigures() {
  const want = Math.max(ambientN, 0);
  const fill = AMBIENT.slice(0, Math.max(0, want - realFigures.length));
  people.setFigures([...realFigures, ...fill].slice(0, 5));
}
setTimeout(() => { ambientN = 2; syncFigures(); }, 3000);
setTimeout(() => { ambientN = 3; syncFigures(); }, 6000);
const presence = startPresence((figures) => { realFigures = figures || []; syncFigures(); });
syncFigures();
// 익명 흔적(벽의 작은 종이 조각, 누를 수 없음). 백엔드가 없으면 공간에서 뺀다(가짜 흔적을 만들지 않는다)
const traces = buildTraces({ sym });
room.group.add(traces.group);
// 패키지마다 위에서 비추는 작은 조명(멀리서도 눈에 띄게)
for (const p of room.packageSpots) {
  const sp = new THREE.SpotLight('#FFF4DF', 9, 5.2, 0.3, 0.65, 1.3);
  lamps.push(sp);
  // rev6-5: 패키지가 받침 위에 실제 그림자를 드리워 바닥에 '놓인' 물건으로 보이게(데스크톱만, 512px)
  if (!lite) { sp.castShadow = true; sp.shadow.mapSize.set(512, 512); sp.shadow.bias = -0.0004; sp.shadow.normalBias = 0.01; sp.shadow.radius = 3; sp.shadow.camera.near = 1.5; sp.shadow.camera.far = 5.5; }
  sp.position.set(p.x * 0.8, 3.95, p.z + 0.9);
  sp.target.position.copy(p);
  scene.add(sp, sp.target);
}
// 2026-11-11: 큐레이션 테이블 오른쪽(오른쪽 벽·초록 징두리)이 너무 어두웠다 → 천장에서 벽을 쓸어 비추는 조명 하나(그림자 없음, 밤일수록 밝게는 lamps 규칙 그대로)
{
  const wash = new THREE.SpotLight('#FFF3DE', 10, 6.5, 0.75, 0.95, 1.2);
  wash.position.set(1.6, 3.95, -2.7);
  wash.target.position.set(3.4, 1.0, -2.7);
  scene.add(wash, wash.target);
  lamps.push(wash);
}
scene.add(room.group);

/* ---------- 2.0 성능: 움직이지 않는 같은 재질 메쉬 합치기(그리기 호출 절감, 보이는 모습은 같다) ---------- */
// 2026-11-13: 바닥·받침 위에 얹은 얇은 그림자·빛 판(투명, 깊이 쓰지 않음)이 휴대폰의 낮은 깊이 정밀도에서
// 바로 아래 면과 겹쳐 깜빡였다(책장 아래 검은 그림자·문 앞 흰 빛) → 깊이를 살짝 앞당겨 항상 위에 그린다
scene.traverse((o) => {
  if (!o.isMesh) return;
  for (const mt of [].concat(o.material)) if (mt && mt.transparent && mt.depthWrite === false) { mt.polygonOffset = true; mt.polygonOffsetFactor = -2; mt.polygonOffsetUnits = -4; }
});
const mergeInfo = mergeStatic(room.group, {
  skipRoots: [...room.openables.map((o) => o.group), ...room.group.children.filter((c) => c.userData.noPick), traces.group],
  skipMeshes: [room.floor, ...room.tiles],
});
mergeInfo.faceGroups = compactMaterialGroups(scene);
/* ---------- 2.0 성능: 휴대폰·태블릿(LITE)에서는 1536px보다 큰 원화를 1536px로 줄여 올린다 ---------- */
// (2.0 최종: 데스크톱도 2560px 상한 — 아래). 휴대폰 화면(약 650px 폭)에서는 패키지를 가까이 열어도
// 1536px이면 두 배 이상의 해상도라 차이가 보이지 않는다. 측정: 텍스처 59 → 약 32MP
// 2.0 최종: 데스크톱도 2560px 상한(ch2-art 4096² 하나가 그래픽 메모리 약 89MB). 2560px은 4K 화면에서 패키지를 가까이 열어도 화면보다 크다
const TEX_CAP = lite ? 1536 : 2560;
const texCap = { scaled: 0, savedMP: 0 };
{
  const seen = new Set();
  scene.traverse((o) => {
    for (const m of [].concat(o.material || [])) for (const k of ['map', 'emissiveMap', 'bumpMap', 'normalMap', 'roughnessMap', 'alphaMap']) {
      const t = m[k]; const img = t && t.image;
      if (!img || seen.has(t) || !img.width || Math.max(img.width, img.height) <= TEX_CAP) continue;
      seen.add(t);
      const sc = TEX_CAP / Math.max(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      texCap.savedMP += (img.width * img.height - c.width * c.height) / 1e6;
      t.image = c; t.needsUpdate = true; texCap.scaled++;
    }
  });
}
/* ---------- 2.0 룩: 프리미엄 스타일라이즈드 에디토리얼(Higgsfield 셸프 참고안 R2 기준) ---------- */
// 원래 디자인·색은 그대로 두고 '어떻게 비추나'만 다듬는다. 되돌리려면 이 블록을 지우면 된다.
//  - 스포트 조명의 가장자리를 부드럽게(바닥·벽의 딱딱한 원형 하이라이트 제거)
//  - 패키지 위 조명은 조금 낮춰 셸프보다 튀지 않게
//  - 문 앞 벽등의 빛 원뿔을 부드럽게
(function applyLook2() {
  scene.traverse((o) => { if (o.isSpotLight) o.penumbra = Math.max(o.penumbra, 0.95); });
  for (const l of lamps) if (l.isSpotLight && room.packageSpots.some((p) => p.distanceTo(l.target.position) < 0.01)) l.intensity *= 0.55;   // 2026-11-11: 0.7 → 0.55 — 패키지 윗면이 위에서 평평하게 하얗게 뜨던 것
  shelfSpot.intensity *= 0.85;
})();
/* ---------- 2.0 최종 룩: Higgsfield F2 셸프 참고안(redesign-2.0/renders/round2/F2.png)에 맞춘 빛 ---------- */
// F2: 고르고 따뜻한 확산광, 창살 무늬 없는 크림 바닥, 브랜드 모스 그린이 제 색(#4F5F4C) 그대로 보이는 정면.
//  - 셸프 정면 스포트를 낮춰 초록이 밝은 세이지로 뜨지 않게(측면은 자연스럽게 한 톤 어둡다)
//  - 왼쪽 창 햇빛 무늬(바닥의 사선 줄무늬)를 은은하게
//  - 바닥에서 올라오는 반사광을 따뜻한 크림으로
(function applyLookF2() {
  shelfSpot.intensity *= 0.62;
  // rev4(낮 공간감): 왼쪽 아치 창 햇빛을 주광(키 라이트)으로 — 0.42 → 0.85. 셸프 왼쪽 면·바닥·다이스에 방향 있는 명암과 긴 그림자가 생긴다
  roomSun.intensity *= 0.85;
  roomSun.shadow.radius = 5;
  // 셸프 천장 스포트를 정면 한가운데(평평한 정면광)에서 왼쪽 위로 비켜 — 아치 안쪽·선반 아래에 그늘이 진다
  shelfSpot.position.set(-1.35, 4.05, -2.7);
  hemi.groundColor.set('#EADFC9');
})();

// 읽는 동안 공간을 은은하게 덮는 막(카메라에 붙어 있어 공간과의 연결감은 유지)
const veilMat = new THREE.MeshBasicMaterial({ color: COLORS.ivory, transparent: true, opacity: 0, depthWrite: false });
const veil = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), veilMat);
veil.renderOrder = 1;
veil.visible = false;
camera.add(veil);

/* ---------- BGM ---------- */
const audio = createAudio();
function syncBgmBtn() {
  ui.bgmBtn.textContent = audio.isOn() ? '♪ BGM 켜짐' : '♪ BGM 꺼짐';
  ui.bgmBtn.setAttribute('aria-pressed', String(audio.isOn()));
}
ui.bgmBtn.addEventListener('click', () => { audio.toggle(); syncBgmBtn(); });
const bgmVol = $('bgmVol');
bgmVol.value = String(Math.round(audio.getVolume() * 100));
bgmVol.addEventListener('input', () => { audio.start(); audio.setVolume(bgmVol.value / 100); });
// 바로 안으로 돌아온 경우(문 클릭이 없음)에는 첫 터치·클릭 때 시작한다
addEventListener('pointerdown', function first() { if (state.get() !== S.INITIAL && state.get() !== S.DOOR_HOVER) { audio.start(); removeEventListener('pointerdown', first); } });

/* ---------- 상태 ---------- */
const state = createState((cur) => {
  ui.app.dataset.state = cur;
  const exploring = cur === S.ROOM_EXPLORATION || cur === S.OBJECT_HOVER;
  ui.objects.hidden = !exploring;
  ui.stations.hidden = !exploring;
  ui.bgmBtn.hidden = cur === S.INITIAL || cur === S.DOOR_HOVER || cur === S.LEAVING;
  const vol = document.getElementById('bgmVol'); if (vol) vol.hidden = ui.bgmBtn.hidden;
  syncBgmBtn();
  // 관람객 드나들기는 안에 있는 동안만(문이 열려 있을 때)
  // 2.0: 새 관람객은 입장·첫 구도 동안 들어오지 않는다. 방 안에서 직접 둘러보기 시작한 뒤부터(렌더 루프에서 켠다)
  if (cur === S.INITIAL || cur === S.DOOR_HOVER || cur === S.DOOR_OPENING || cur === S.CAMERA_ENTERING || cur === S.LEAVING) people.setActive(false);
  if (!exploring) { rig.keys.f = rig.keys.t = 0; rig.turnRate = 0; showRing(null); }
  if (!exploring) hideHover();
});
placeStart();
ui.app.dataset.state = S.INITIAL;

/* ---------- 포인터: 호버 · 클릭/드래그 구분 ---------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const ptr = { down: false, id: null, x: 0, y: 0, sx: 0, sy: 0, dragged: false, type: 'mouse' };
let hovered = null;
let hoveredTile = null;
let doorHovered = false;

const doorHits = door.hit;

function pick(list, x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObjects(list, false)[0] || null;
}
// 공간 전체에서 가장 앞에 걸린 불투명 물체(벽·셸프 뒤의 물건은 눌리지 않는다)
function pickWorld(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  for (const h of ray.intersectObjects([room.group, lounge.group], true)) {
    const o = h.object;
    if (!o.isMesh || !o.visible) continue;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if ((m.transparent && !m.alphaTest) || o.userData.noPick) continue;
    return h;
  }
  return null;
}

function setCursor(c) { ui.canvas.style.cursor = c; }

// 걷기 경계: 방 안 + 전시물(셸프·테이블·받침·계단) 바닥 영역을 피한다
const R = 0.26;   // 2.0 최종(3차): 0.38 → 0.26 (사람 어깨 반폭). 0.38에서는 셸프·패키지·아치 기둥 사이 통로가 모두 막혀 방 뒤쪽에 갈 수 없었다
const DOOR_EXIT = { hw: DOOR.width / 2 + 0.1, z: -0.4 };   // 문 폭의 반, 문턱 위치(m)
const roomLimit = (p) => {
  p.x = THREE.MathUtils.clamp(p.x, -3.75, 3.75);
  // 문 앞(문 폭 안)은 문턱까지 걸어갈 수 있다 — 거기까지 가면 나가기(exitAtDoor)
  // 2.0 최종(3차): 문턱 자동 나가기 제거. 걸어서는 도착 지점(z −0.5)까지만 — 나가기는 '출구' 지점·홈 버튼으로만 묻는다
  p.z = THREE.MathUtils.clamp(p.z, -7.25, -0.5);
  for (const [x0, z0, x1, z1] of room.obstacles) {
    if (p.x > x0 - R && p.x < x1 + R && p.z > z0 - R && p.z < z1 + R) {
      const d = [p.x - (x0 - R), (x1 + R) - p.x, p.z - (z0 - R), (z1 + R) - p.z];
      const k = d.indexOf(Math.min(...d));
      if (k === 0) p.x = x0 - R; else if (k === 1) p.x = x1 + R; else if (k === 2) p.z = z0 - R; else p.z = z1 + R;
    }
  }
  return p;
};// 라운지 쪽(입구 띠·옆방)이면 라운지의 걷기 범위를, 아니면 원래 방의 범위를 쓴다
rig.limit = (p) => (lounge.inLounge(p) ? lounge.limitW(p) : roomLimit(p));


// 바닥을 가리키면 걸어갈 자리를 보여 주는 고리
const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 48), new THREE.MeshBasicMaterial({ color: COLORS.moss, transparent: true, opacity: 0, depthWrite: false }));
ring.rotation.x = -Math.PI / 2;
scene.add(ring);
function showRing(p) {
  if (p) { ring.position.set(p.x, 0.006, p.z); ring.material.opacity = 0.55; }
  else ring.material.opacity = 0;
}

// 두 손가락 핀치 = 앞뒤로 걷기
const touches = new Map();
let pinch = null;
ui.canvas.addEventListener('pointerdown', (e) => {
  if (lounge.owns) { lounge.pointerDown(e); try { ui.canvas.setPointerCapture(e.pointerId); } catch (err) { /* 끝난 포인터 */ } return; }
  // rev4: 가운데 버튼(휠 누르기) = 지금 이동을 즉시 멈춤(자동 스크롤 막음)
  if (e.pointerType === 'mouse' && e.button === 1) { e.preventDefault(); if (rig.explore) stopMove('middle'); return; }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  ptr.stopOnTap = rig.explore && state.allows('objectClick') && rig.isMoving();   // 움직이는 중의 클릭은 '멈춤'으로만 쓴다
  if (touches.size === 2) {
    const [a, b] = [...touches.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
    ptr.dragged = true;            // 핀치 중에는 클릭으로 처리하지 않는다
    return;
  }
  ptr.down = true; ptr.id = e.pointerId; ptr.type = e.pointerType;
  ptr.x = ptr.sx = e.clientX; ptr.y = ptr.sy = e.clientY; ptr.dragged = false;
  try { ui.canvas.setPointerCapture(e.pointerId); } catch (err) { /* 이미 끝난 포인터 */ }
});

ui.canvas.addEventListener('pointermove', (e) => {
  if (lounge.owns) { lounge.pointerMove(e); return; }
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && touches.size === 2) {
    const [a, b] = [...touches.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (state.allows('look')) rig.walk((d - pinch.d) * 0.008);
    pinch.d = d;
    return;
  }
  if (ptr.down && e.pointerId === ptr.id) {
    const moved = Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy);
    if (!ptr.dragged && moved > CAMERA.dragThreshold) {
      ptr.dragged = true;
      if (state.allows('drag')) { ui.app.classList.add('dragging'); unhoverObject(); showRing(null); ui.exploreHint.classList.add('done'); }
    }
    // 드래그 = 둘러보기. 가로는 조이스틱처럼: 누른 곳에서 오른쪽으로 멀수록 오른쪽으로 계속 돈다.
    // 화면 끝에 닿아 마우스를 왼쪽으로 되돌려도 시선이 되돌아가지 않고(속도만 줄어듦) 그 방향을 유지한다. 세로는 드래그한 만큼.
    if (ptr.dragged && state.allows('drag')) {
      const off = e.clientX - ptr.sx, dead = 10;
      const k = Math.max(0, Math.abs(off) - dead) / CAMERA.look.joyRange;
      rig.turnRate = -Math.sign(off) * Math.min(1, k) * CAMERA.look.joy;
      rig.addLook(0, e.clientY - ptr.y);
    }
    // 패키지 보기 각도는 고정(드래그로 돌리지 않음)
    ptr.x = e.clientX; ptr.y = e.clientY;
    return;
  }
  if (e.pointerType === 'mouse') updateHover(e.clientX, e.clientY);
});

function endPointer(e) {
  if (lounge.owns) {
    if (lounge.pointerUp(e) && e.type !== 'pointercancel') {   // 끌기가 아닌 누름: 라운지 물건이면 그 동작, 바닥이면 일어나기
      const h = pickWorld(e.clientX, e.clientY), k = lounge.pickKey(h?.object);
      if (k) lounge.act(k); else if (h && (lounge.isFloor(h.object) || h.object === room.floor) && lounge.mode === 'seat') lounge.stand();
    }
    return;
  }
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = null;
  if (!ptr.down || e.pointerId !== ptr.id) return;
  ptr.down = false;
  rig.turnRate = 0;
  ui.app.classList.remove('dragging');
  if (e.type === 'pointercancel' || ptr.dragged) return; // 드래그는 클릭으로 처리하지 않는다
  handleTap(e.clientX, e.clientY);
}
ui.canvas.addEventListener('pointerup', endPointer);
ui.canvas.addEventListener('pointercancel', endPointer);
// 휠 = 보는 방향으로 걷기
let wheelAcc = 0;
ui.canvas.addEventListener('wheel', (e) => {
  if (lounge.owns) { e.preventDefault(); wheelAcc += e.deltaY; if (Math.abs(wheelAcc) >= 60 || Math.abs(e.deltaY) >= 40) { lounge.wheel(Math.sign(wheelAcc)); wheelAcc = 0; } return; }
  if (!state.allows('look')) return;
  e.preventDefault();
  // rev5: 휠 한 칸 = 한 걸음(CAMERA.walk.step). 트랙패드처럼 잘게 오는 입력은 한 칸(약 60px)만큼 모이면 한 걸음.
  // 앞서 쌓이는 거리는 lead(두 걸음 남짓)까지만 — 마구 굴려도 끝까지 미끄러지지 않고, 빈 곳 클릭·가운데 버튼으로 바로 멈춘다
  const unit = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
  if (Math.sign(unit) !== Math.sign(wheelAcc)) wheelAcc = 0;
  wheelAcc += unit;
  if (Math.abs(wheelAcc) < 60 && Math.abs(unit) < 40) return;
  const dir = -Math.sign(wheelAcc); wheelAcc = 0;
  rig.nudge(dir * CAMERA.walk.step);
  ui.exploreHint.classList.add('done');
}, { passive: false });
ui.canvas.addEventListener('pointerleave', () => { if (!ptr.down) { setDoorHover(false); unhoverObject(); unhoverTile(); showRing(null); } });

function updateHover(x, y) {
  if (state.allows('doorHover')) {
    setDoorHover(!!pick(doorHits, x, y));
    return;
  }
  if (state.allows('objectHover')) {
    const h = pickWorld(x, y);
    const o = h?.object.userData.openable || null;
    const tile = h?.object.userData.tileOf ? h.object : null;
    if (o !== hovered) { unhoverObject(); if (o) hoverObject(o); }
    if (tile !== hoveredTile) { unhoverTile(); if (tile) hoverTile(tile); }
    if (o || tile) { placeHover(x, y); showRing(null); return; }
    if (h?.object.userData.toGuestbook || lounge.pickKey(h?.object)) { showRing(null); setCursor('pointer'); return; }
    const onFloor = h && (h.object === room.floor || lounge.isFloor(h.object));
    if (onFloor) {
      const from = rig.target || rig.pos;
      const d = new THREE.Vector3(h.point.x - from.x, 0, h.point.z - from.z);
      if (d.length() > CAMERA.walk.click) d.setLength(CAMERA.walk.click);
      showRing(rig.limit(new THREE.Vector3(from.x + d.x, 0, from.z + d.z)));
    } else showRing(null);
    setCursor(onFloor ? 'pointer' : 'grab');
    return;
  }
  if (state.is(S.BOOK_READING)) {
    const h = pick(activeHits(), x, y);
    setCursor(h ? 'pointer' : 'default');
    return;
  }
  if (state.is(S.OBJECT_SELECTED)) setCursor(pick(active?.hit || [], x, y) ? 'pointer' : 'default');
}

// rev4: 이동 멈춤(왼쪽 클릭·가운데 버튼). 같은 클릭으로 책·바닥이 눌리지 않게 handleTap에서 걸러진다
let lastStop = null;
function stopMove(how) {
  rig.stop();
  showRing(null);
  lastStop = { how, t: performance.now(), x: rig.pos.x, z: rig.pos.z };
}
ui.canvas.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
ui.canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });

function handleTap(x, y) {
  // rev5: 걷는 중 '바닥'을 누르면 멈추지 않고 그쪽으로 한 걸음 더 간다(누를 때마다 한 번씩 이동).
  // 바닥이 아닌 빈 곳(벽·하늘 등)을 누르면 그 자리에서 멈춘다
  if (ptr.stopOnTap) {
    ptr.stopOnTap = false;
    const hh = pickWorld(x, y);
    if (!(hh && (hh.object === room.floor || lounge.isFloor(hh.object) || hh.object.userData.openable || hh.object.userData.tileOf))) { stopMove('click'); return; }
  }
  if (state.allows('doorClick')) {
    if (pick(doorHits, x, y)) openDoor();
    return;
  }
  if (state.is(S.BOOK_READING)) {
    if (isPkg(active)) { if (pick(active.hit, x, y)) pkgStep(1); return; }
    const h = pick(activeHits(), x, y);
    if (h?.object.userData.page === 'right') turn(1);
    else if (h?.object.userData.page === 'left') turn(-1);
    return;
  }
  if (state.is(S.OBJECT_SELECTED)) {
    if (pick(active.hit, x, y)) openBook();
    return;
  }
  if (state.allows('objectClick')) {
    const h = pickWorld(x, y);
    const o = h?.object.userData.openable;
    if (o) { select(o); return; }
    const tileOf = h?.object.userData.tileOf;
    if (tileOf) { unhoverTile(); select(tileOf); return; }
    // 2026-11-13: 오른쪽 계단 위 노란 아치 문 = 방명록 라운지(옆방)로
    const lk = lounge.pickKey(h?.object);
    if (lk) { rig.stop?.(); lounge.act(lk); return; }
    // 오른쪽 계단 위 노란 아치 문: 옆방(방명록 라운지)으로 걸어간다
    if (h?.object.userData.toGuestbook) { const i = STATIONS.findIndex((x) => x[0] === '방명록'); if (i >= 0) goStation(i); return; }
    // 바닥을 누르면 그 자리까지 걸어간다
    // 바닥을 누르면 그쪽으로 한두 걸음만 걸어간다(멀리 눌러도 벽까지 가지 않는다)
    if (h && (h.object === room.floor || lounge.isFloor(h.object))) {
      const from = rig.target || rig.pos;
      const d = new THREE.Vector3(h.point.x - from.x, 0, h.point.z - from.z);
      const len = d.length();
      if (len > CAMERA.walk.click) d.multiplyScalar(CAMERA.walk.click / len);
      rig.walkTo(new THREE.Vector3(from.x + d.x, 0, from.z + d.z));
      showRing(null); ui.exploreHint.classList.add('done');
    }
  }
}

// '9개 취향' 보드 칸: 살짝 튀어나오며 이름을 보여 준다
function hoverTile(t) {
  hoveredTile = t;
  setCursor('pointer');
  gsap.to(t.position, { z: t.userData.base.z + 0.03, duration: TIMING.hover, ease: 'power2.out', overwrite: 'auto' });
  ui.hover.querySelector('b').textContent = 'OPEN THIS CURATION';
  ui.hover.querySelector('span').textContent = t.userData.tileOf.label;
  ui.hover.classList.add('show');
}
function unhoverTile() {
  if (!hoveredTile) return;
  const t = hoveredTile; hoveredTile = null;
  gsap.to(t.position, { z: t.userData.base.z, duration: TIMING.hover, ease: 'power2.out', overwrite: 'auto' });
  if (!hovered) hideHover();
}

/* ---------- 2026-11-11 익명 흔적: 서버가 주는 단계(0~12)만으로 벽 조각을 놓는다 ---------- */
getBackend().then(async (b) => {
  if (!b) { room.group.remove(traces.group); return; }
  try { traces.setTrace(await b.trace()); } catch (e) { /* 흔적 없이 그대로 */ }
});

/* ---------- 관람 지점(전시장 동선) ---------- */
let stationIdx = 0;
// 여러 지점을 차례로 걷는 길(방 ↔ 라운지): 앞 지점에 닿으면 다음으로
let route = null;
function stepRoute(start) {
  if (!route || lounge.owns) return;
  if (!start && (rig.target || rig.isMoving?.())) return;
  const [p, lookAt, lens] = route.shift();
  rig.walkTo(p.clone(), lookAt || new THREE.Vector3(route[0] ? route[0][0].x : p.x, 1.2, route[0] ? route[0][0].z : p.z), lens);
  if (!route.length) route = null;
}
function goStation(i) {
  if (!state.allows('look') || asking) return;
  stationIdx = (i + STATIONS.length) % STATIONS.length;
  const [, xz, look] = STATIONS[stationIdx];
  if (!xz) { askExit(); return; }               // '출구': 나갈지 먼저 묻는다
  const [x, z] = xz;
  const dest = new THREE.Vector3(x, 0, z), here = rig.pos;
  // 방과 라운지 사이는 벽을 지나지 않게 입구를 거쳐 걷는다
  const toL = lounge.insideRoom(dest), fromL = lounge.insideRoom(here);
  if (toL !== fromL) {
    const st = lounge.station;
    route = [[fromL ? st.doorIn : st.doorOut, null], [fromL ? st.doorOut : st.doorIn, null], [dest, new THREE.Vector3(...look), STATIONS[stationIdx][3]]];
    stepRoute(true);
  } else { route = null; rig.walkTo(dest, new THREE.Vector3(...look), STATIONS[stationIdx][3]); }
  [...ui.stationList.children].forEach((b, k) => b.classList.toggle('on', k === stationIdx));
  announce(`${STATIONS[stationIdx][0]}(으)로 걸어갑니다`);
}
STATIONS.forEach(([name], i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = name;
  if (!i) b.classList.add('on');
  b.addEventListener('click', () => goStation(i));
  ui.stationList.appendChild(b);
});
ui.stPrev.addEventListener('click', () => goStation(stationIdx - 1));
ui.stNext.addEventListener('click', () => goStation(stationIdx + 1));

/* ---------- 나가기: 문 쪽으로 걸어가면 그대로 문을 지나 나가고, 돌아서면 문이 닫히며 하이랑 웹페이지로 이어진다 ---------- */
// 문 앞에서 문을 바라보면 안내를 띄우고, 문턱(z > DOOR_EXIT.z)을 넘으면 나간다
let doorNear = false, asking = false, leaveAfterReturn = false;
// 나가기 전에 묻는다: '나가기'면 문을 지나 웹페이지로, '더 둘러보기'면 한 걸음 물러나 방 안을 다시 본다
function askExit() {
  if (asking || !state.is(S.ROOM_EXPLORATION, S.OBJECT_HOVER)) return;
  asking = true;
  rig.target = null; rig.keys.f = rig.keys.t = 0; rig.turnRate = 0;
  ui.toast.classList.remove('on');
  ui.exitAsk.hidden = false;
  ui.canvas.style.pointerEvents = 'none';   // 고르는 동안은 걷기·둘러보기 멈춤
  requestAnimationFrame(() => ui.exitAsk.classList.add('on'));
  ui.exitGo.focus({ preventScroll: true });
}
function closeAsk() {
  asking = false;
  ui.canvas.style.pointerEvents = '';
  ui.exitAsk.classList.remove('on');
  setTimeout(() => { if (!asking) ui.exitAsk.hidden = true; }, 400);
}
ui.exitGo.addEventListener('click', () => { closeAsk(); exitRoom(); });
// '홈으로 돌아가기': 공간 안에 있으면 바로 넘어가지 않고 문을 지나 나가는 같은 과정을 거친다
$('homeBtn').addEventListener('click', (e) => {
  if (state.is(S.INITIAL, S.DOOR_HOVER)) return;               // 문 앞: 그대로 이동
  e.preventDefault();
  // 2026-11-11: 상단 '홈으로 돌아가기'는 누르면 바로 간다(문까지 걸어 나가는 연출이 최대 8초 걸려 버튼이 안 되는 것처럼 보였다).
  // 걸어 나가는 연출은 '출구' 관람 지점·나가기 창에서만 쓴다
  if (asking) closeAsk();
  audio.fadeOut(0.5);
  ui.fade.classList.add('on');
  setTimeout(() => { location.href = '../index.html?view=website'; }, 450);
  return;
  if (asking) closeAsk();
  if (state.is(S.ROOM_EXPLORATION, S.OBJECT_HOVER)) { exitRoom(); return; }
  if (state.is(S.LEAVING)) return;
  // 책·패키지를 보는 중이면 먼저 방으로 돌아온 뒤 나간다
  leaveAfterReturn = true;
  // 펼치는 중이면 다 펼쳐진 뒤에 되돌린다
  const t0 = performance.now();
  const tick = () => {
    if (state.is(S.BOOK_READING, S.OBJECT_SELECTED) && !active?.flipping) { backToRoom(); return; }
    if (performance.now() - t0 < 4000 && !state.is(S.ROOM_EXPLORATION)) setTimeout(tick, 120);
  };
  tick();
});
ui.exitStay.addEventListener('click', () => {
  closeAsk();
  const back = new THREE.Vector3(rig.pos.x, 0, Math.min(rig.pos.z, -0.5) - 0.9);
  rig.walkTo(back, new THREE.Vector3(back.x, 1.2, -5.2));
  announce('비밀독서구역에 머무릅니다');
});
addEventListener('keydown', (e) => {
  if (!asking) return;
  if (e.key === 'Escape') { e.preventDefault(); ui.exitStay.click(); }
}, true);
function exitAtDoor() {
  if (asking) return;
  if (!state.is(S.ROOM_EXPLORATION, S.OBJECT_HOVER)) { if (doorNear) { doorNear = false; ui.toast.classList.remove('on'); } return; }
  const p = rig.pos, inDoor = Math.abs(p.x) < DOOR_EXIT.hw;
  const facing = rig.forward().z > 0.55;
  const near = inDoor && p.z > -0.9 && facing;
  if (near !== doorNear) {
    doorNear = near;
    if (near) ui.toast.textContent = '나가려면 아래 관람 지점에서 ‘출구’를 누르세요';
    ui.toast.classList.toggle('on', near);
  }
}
async function exitRoom() {
  if (!state.is(S.ROOM_EXPLORATION, S.OBJECT_HOVER)) return;
  unhoverObject(); unhoverTile(); showRing(null);
  state.set(S.LEAVING);
  announce('비밀독서구역을 나가 하이랑 웹페이지로 이동합니다');
  ui.toast.textContent = '문을 나서면 하이랑 웹페이지로 이동합니다';
  ui.toast.classList.add('on');
  audio.fadeOut(4);
  // 1) 문 앞으로 걸어가며 문 쪽으로 돌아선다
  rig.walkTo(new THREE.Vector3(0, 0, Math.max(rig.pos.z, -0.6)), new THREE.Vector3(0, CAMERA.eye, 6));
  const t0 = performance.now();
  while ((rig.target || Math.abs(rig.tYaw - rig.yaw) > 0.04) && performance.now() - t0 < 6000) await new Promise((r) => setTimeout(r, 50));
  // 2) 문틀을 지나 그대로 걸어 나가며, 문밖의 빛 속으로 하이랑 웹페이지가 드러난다
  ui.toast.textContent = '하이랑 웹페이지로 이동합니다';
  gsap.to(rig.pos, { x: 0, z: 2.2, duration: 2.4, ease: 'power1.in' });
  setTimeout(() => ui.fade.classList.add('on'), 1300);
  setTimeout(() => { location.href = '../index.html?view=website'; }, 2300);
}

// 키보드: ↑/W 앞으로, ↓/S 뒤로, ←/A·→/D 고개 돌리기
const KEYMAP = { ArrowUp: ['f', 1], KeyW: ['f', 1], ArrowDown: ['f', -1], KeyS: ['f', -1], ArrowLeft: ['t', 1], KeyA: ['t', 1], ArrowRight: ['t', -1], KeyD: ['t', -1] };
addEventListener('keydown', (e) => {
  const k = KEYMAP[e.code];
  if (!k || !state.allows('look') || asking || e.target.closest?.('input,textarea')) return;
  e.preventDefault();
  rig.keys[k[0]] = k[1];
  ui.exploreHint.classList.add('done');
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k && rig.keys[k[0]] === k[1]) rig.keys[k[0]] = 0; });
addEventListener('blur', () => { rig.keys.f = rig.keys.t = 0; rig.turnRate = 0; });

/* ---------- SCENE 01: 문 호버 ---------- */
function setDoorHover(on) {
  if (on === doorHovered) return;
  doorHovered = on;
  state.set(on ? S.DOOR_HOVER : S.INITIAL);
  setCursor(on ? 'pointer' : 'default');
  ui.doorHint.classList.toggle('near', on);
  gsap.to(doorFx, { handle: on ? -0.14 : 0, ajar: on ? DOOR.hoverAjar : 0, light: on ? 1 : 0, duration: on ? 0.5 : 0.45, ease: 'power2.out', overwrite: 'auto' });
}
const doorFx = { handle: 0, ajar: 0, light: 0, open: 0, twist: 0 };

/* ---------- SCENE 01→02: 문 열기 + 원테이크 카메라 진입 ---------- */
// 2.0: 화면 비율에 따라 문 앞 시작 거리가 달라지므로(startZ) 걷는 속도가 같도록 이동 시간을 거리에 맞춘다
function entryScale() {
  const d = rig.pos.z - (isPortrait() ? CAMERA.portrait.arriveZ : CAMERA.arrive[2]);
  return THREE.MathUtils.clamp(d / (CAMERA.start[2] - CAMERA.arrive[2]), 0.75, 1.5);
}
let entryTl = null;
function openDoor() {
  if (!state.set(S.DOOR_OPENING)) return;
  perf.graceUntil = performance.now() + (CAMERA.entry.duration / (CAMERA.entry.speed || 1) + 3) * 1000;   // 2026-11-11: 입장 연출 중(셰이더 준비·조명 전환)의 일시적 끊김으로 화질을 내리지 않는다
  audio.start();   // 문을 여는 순간 안쪽의 음악이 천천히 들려온다
  doorHovered = false;
  setCursor('default');
  ui.doorHint.classList.add('gone');
  ui.skip.hidden = true;
  gsap.killTweensOf(doorFx);
  const T = TIMING;
  const look = rig.look, pos = rig.pos;
  const tl = gsap.timeline({ onComplete: arrive });
  entryTl = tl;
  tl.timeScale(CAMERA.entry.speed || 1);   // rev4: 입장 연출만 1.2배속(문·손잡이·카메라·렌즈·빛 모두 같은 비율 — 관계 유지)
  tl.addLabel('anticipation')
    // PHASE A: 아주 짧은 긴장 — 손잡이를 쥐는 순간
    .to(doorFx, { handle: -0.06, duration: 0.18, ease: 'sine.out' })
    .to(doorFx, { handle: -0.62, duration: T.handle, ease: 'power2.out' })
    // PHASE B: 손잡이가 다 돌아간 뒤 문이 경첩을 중심으로 열린다(카메라는 정지)
    .addLabel('opening')
    .to(doorFx, { open: DOOR.revealAngle, ajar: 0, duration: T.door, ease: 'power3.inOut' }, 'opening')   // rev5: 먼저 68°까지만 — 문틈으로 책장 일부만 보인다
    .to(doorFx, { open: DOOR.openAngle, duration: CAMERA.entry.duration * entryScale() * 0.5, ease: 'sine.inOut' }, `opening+=${T.door * 0.98}`)   // 다가가는 동안 나머지가 열려 방이 차츰 드러난다   // 2.0 최종: 천천히 떨어져 → 가속 → 부드럽게 감속해 멈춤
    .to(doorFx, { handle: 0, duration: 0.5, ease: 'power2.out' }, 'opening+=0.35')
    .to(doorFx, { light: 0, duration: T.door * 0.6, ease: 'sine.out' }, 'opening')   // 2026-11-11: 열릴 때 문 앞 바닥 금빛이 커지며 노랗게 튀던 것 — 호버 빛도 부드럽게 끈다   // 2.0: 1.6 → 0.85 (열릴 때 벽이 하얗게 번지던 빛 줄임)
    // PHASE C~D (2.0): 문이 반쯤 열리면 사람 걸음으로 천천히 걸어 들어간다.
    // sine.inOut: 부드럽게 출발 → 문턱에서 최고 약 1.3 m/s → 첫 구도에서 천천히 멈춘다. 눈높이 1.58 → 1.52, 렌즈 50° → 44°
    .addLabel('dolly', `opening+=${T.door * CAMERA.entry.startAt}`)
    .call(() => state.set(S.CAMERA_ENTERING), null, 'dolly')
    .to(pos, { x: CAMERA.arrive[0], y: CAMERA.arrive[1], z: isPortrait() ? CAMERA.portrait.arriveZ : CAMERA.arrive[2], duration: CAMERA.entry.duration * entryScale(), ease: 'sine.inOut' }, 'dolly')
    .to(look, { x: CAMERA.arriveLook[0], y: isPortrait() ? CAMERA.portrait.lookY : CAMERA.arriveLook[1], z: CAMERA.arriveLook[2], duration: CAMERA.entry.duration * entryScale() * 0.92, ease: 'sine.inOut' }, 'dolly')
    // 2026-11-13: 세로 화면은 도착 렌즈(관람 지점 pfov)까지 한 번에, 렌즈 배율도 걷는 동안 고르게 바뀐다
    // (전에는 문턱 0.7 m 구간에서 배율이 바뀌고 도착 순간 렌즈가 다시 튀어 줌 인·아웃이 두 번 반복되었다)
    .call(() => { rig.entryZ = [pos.z, isPortrait() ? CAMERA.portrait.arriveZ : CAMERA.arrive[2]]; }, null, 'dolly')
    .to(rig, { fov: (rig.fovScaleIn !== 1 && STATIONS[CAMERA.arriveStation ?? 0]?.[3]?.pfov) || CAMERA.arriveFov || CAMERA.fovIn, duration: CAMERA.entry.duration * entryScale(), ease: 'sine.inOut' }, 'dolly')
    .to(doorFx, { light: 0, duration: 1.8, ease: 'sine.in' }, `dolly+=${CAMERA.entry.duration * entryScale() * 0.55}`);
  announce('문이 열립니다');
}

// PHASE E: 도착 → 탐색 가능 상태
let arrivedAt = Infinity;
function arrive() {
  rig.syncBase();
  // rev5: 도착 = '시크릿 책장' 관람 지점(눈높이·렌즈도 그 지점 값)
  const st = STATIONS[CAMERA.arriveStation ?? 0], lens = st?.[3] || {};
  rig.pos.y = lens.eye ?? CAMERA.eye;
  rig.eye = rig.tEye = lens.eye ?? CAMERA.eye;
  rig.fov = rig.tFov = (rig.fovScaleIn !== 1 && lens.pfov) || lens.fov || CAMERA.fovIn;
  stationIdx = CAMERA.arriveStation ?? 0;
  [...ui.stationList.children].forEach((b, k) => b.classList.toggle('on', k === stationIdx));
  arrivedAt = performance.now();
  rig.explore = true;
  rig.target = null;
  state.set(S.ROOM_EXPLORATION);
  ui.exploreHint.classList.add('show');
  setTimeout(() => ui.exploreHint.classList.add('done'), 6500);
  announce('비밀독서구역에 들어왔습니다. 드래그해서 둘러보고, 책이나 패키지를 선택하세요.');
}

// 사이트의 '시크릿 룸으로'에서 돌아온 경우(?return=room): 문 앞을 건너뛰고 독서구역 안에서 바로 시작한다
const returning = new URLSearchParams(location.search).get('return') === 'room';
function enterRoomDirect() {
  doorFx.open = DOOR.openAngle;
  rig.pos.set(CAMERA.arrive[0], CAMERA.arrive[1], isPortrait() ? CAMERA.portrait.arriveZ : CAMERA.arrive[2]);
  rig.look.set(...CAMERA.arriveLook);
  if (isPortrait()) rig.look.y = CAMERA.portrait.lookY;
  state.set(S.DOOR_OPENING);
  state.set(S.CAMERA_ENTERING);
  ui.doorHint.classList.add('gone');
  ui.skip.hidden = true;
  entK = 0; inK = 1;   // 바로 방 안에서 시작할 때는 페이드 없이 실내 조명 상태로
  arrive();
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* 주소 정리는 선택 사항 */ }
}

function skipIntro() {
  if (!state.is(S.INITIAL, S.DOOR_HOVER)) return;
  openDoor();
}

/* ---------- SCENE 05: 오브젝트 호버 ---------- */
function hoverObject(o) {
  hovered = o;
  state.set(S.OBJECT_HOVER);
  setCursor('pointer');
  const g = o.group, b = g.userData.base;
  gsap.killTweensOf([g.position, g.rotation]);
  if (o.hover === 'book') {
    // 책: 선반에서 살짝 빠져나오며 앞으로 기운다
    gsap.to(g.position, { y: b.p.y + 0.022, z: b.p.z + 0.045, duration: TIMING.hover, ease: 'power2.out' });
    gsap.to(g.rotation, { x: b.r.x + 0.09, z: b.r.z - 0.025, duration: TIMING.hover + 0.1, ease: 'power2.out' });
  } else {
    // 패키지: 떠오르며 시선 쪽으로 몸을 튼다
    // 패키지: 받침에서 살짝 떠올라 앞으로 나오며 기운다(세워 둔 것은 앞으로, 눕혀 둔 것은 위로)
    gsap.to(g.position, { y: b.p.y + 0.04, duration: TIMING.hover + 0.1, ease: 'power2.out' });
    gsap.to(g.rotation, { z: b.r.z + 0.06, duration: TIMING.hover + 0.15, ease: 'power2.out' });
  }
  const wp = g.getWorldPosition(new THREE.Vector3());
  hoverLight.position.set(wp.x, wp.y + 0.45, wp.z + 0.4);
  gsap.to(hoverLight, { intensity: 0.7, duration: TIMING.hover, overwrite: 'auto' });
  ui.hover.querySelector('b').textContent = o.kind === 'package' ? 'DISCOVER THIS CHAPTER' : 'DISCOVER THIS BOOK';
  ui.hover.querySelector('span').textContent = o.label;
  ui.hover.classList.add('show');
}

function unhoverObject() {
  if (!hovered) return;
  const o = hovered; hovered = null;
  if (state.is(S.OBJECT_HOVER)) state.set(S.ROOM_EXPLORATION);
  resetObject(o, TIMING.hover + 0.1);
  gsap.to(hoverLight, { intensity: 0, duration: 0.3, overwrite: 'auto' });
  setCursor(state.allows('drag') ? 'grab' : 'default');
  hideHover();
}

function resetObject(o, d) {
  const g = o.group, b = g.userData.base;
  gsap.killTweensOf([g.position, g.rotation]);
  gsap.to(g.position, { x: b.p.x, y: b.p.y, z: b.p.z, duration: d, ease: 'power2.out' });
  gsap.to(g.rotation, { x: b.r.x, y: b.r.y, z: b.r.z, duration: d, ease: 'power2.out' });
}

function placeHover(x, y) {
  ui.hover.style.transform = `translate(${Math.min(x + 18, innerWidth - 230)}px, ${y + 18}px)`;
}
function hideHover() { ui.hover.classList.remove('show'); }

/* ---------- SCENE 05~06: 선택 · 펼치기 · 읽기 ---------- */
let active = null;
let saved = null;
const activeHits = () => (!active ? [] : isPkg(active) ? active.hit : [active.leftPage, active.rightPage]);
const isPkg = (o) => o?.kind === 'package';

/* 패키지 보기: 원본 '직접 열어보기'와 같은 시점(비스듬히 위)에서 눈앞에 두고, 열리는 만큼 중심·거리를 맞춘다 */
const insp = { live: false, yaw: 0, pitch: 0, yawS: 0, pitchS: 0, dist: 1 };
const _v = new THREE.Vector3();
function presentQuat(o, yawOff = 0, pitchOff = 0) {
  const v = o.view;
  const lo = v.standing ? -0.25 : 0.18, hi = v.standing ? 1.1 : 1.45;
  const pitch = THREE.MathUtils.clamp(v.pitch + pitchOff, lo, hi);
  const yaw = v.yaw + yawOff;
  const zL = new THREE.Vector3(Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), -Math.cos(pitch) * Math.sin(yaw));
  const xL = new THREE.Vector3(0, 1, 0).cross(zL).normalize();
  const yL = zL.clone().cross(xL);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xL, yL, zL)).invert();
  return camera.quaternion.clone().multiply(q);
}
// 패키지 보기 거리: 처음(닫힌 상태) 크기를 그대로 유지하고, 펼쳐서 화면을 벗어날 때만 그 비율에 맞춰 물러난다
function pkgDistance(o) {
  const vf = THREE.MathUtils.degToRad(camera.fov);
  const tY = Math.tan(vf / 2), tX = tY * camera.aspect;
  const cb = o.closedBox || o.box;
  const r = cb.getSize(_v).length() / 2;
  const base = (r / Math.sin(Math.min(vf * 0.78, 2 * Math.atan(tX)) / 2)) * 1.42;   // 처음 보이는 크기(닫힌 상태)
  // 지금(펼친) 상자의 여덟 모서리를 화면 방향으로 돌려, 위·아래·좌우 여백 안에 다 들어오는 최소 거리
  const q = presentQuat(o, insp.yawS, insp.pitchS).premultiply(camera.quaternion.clone().invert());
  const h = o.box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const mx = tX * 0.86, my = tY * 0.74;   // 좌우 7%, 위·아래(제목·버튼 자리) 13% 여백
  let fit = 0;
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Vector3(i & 1 ? h.x : -h.x, i & 2 ? h.y : -h.y, i & 4 ? h.z : -h.z).applyQuaternion(q);
    fit = Math.max(fit, Math.abs(c.x) / mx + c.z, Math.abs(c.y) / my + c.z);
  }
  return Math.max(base, fit);
}
function pkgPose(o, dist, out = { p: new THREE.Vector3(), q: null }) {
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  out.p.copy(camera.position).addScaledVector(fwd, dist).addScaledVector(up, dist * 0.05);
  out.q = presentQuat(o, insp.yawS, insp.pitchS);
  return out;
}
function placeVeil(d) {
  veil.position.set(0, 0, -d);
  const vs = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 2 * d * 1.2;
  veil.scale.set(vs * camera.aspect, vs, 1);
}
function updateInspect(dt) {
  const o = active, g = o.group;
  const k = 1 - Math.exp(-6 * dt);
  o.center.position.lerp(o.presentOffset(), k);
  insp.yawS += (insp.yaw - insp.yawS) * k;
  insp.pitchS += (insp.pitch - insp.pitchS) * k;
  insp.dist += (pkgDistance(o) - insp.dist) * (1 - Math.exp(-3 * dt));
  const pose = pkgPose(o, insp.dist);
  g.position.copy(pose.p);
  g.quaternion.copy(pose.q);
  placeVeil(insp.dist + o.box.getSize(_v).length() / 2 + 0.15);
}

let pkgTween = null;
function pkgGo(to) {
  const o = active;
  if (!isPkg(o)) return Promise.resolve();
  pkgTween?.kill();
  const pr = { v: o.open };
  const duration = Math.max(0.45, Math.abs(to - o.open) * 3.4);
  o.busy = true;
  return new Promise((resolve) => {
    pkgTween = gsap.to(pr, {
      v: to, duration, ease: 'sine.inOut',
      onUpdate: () => { o.setOpen(pr.v); syncReader(); },
      onComplete: () => { o.busy = false; syncReader(); resolve(); },
    });
  });
}
function pkgStep(dir) {
  const o = active;
  if (!isPkg(o) || !state.is(S.BOOK_READING)) return;
  const k = o.stepAt(o.open);
  const n = THREE.MathUtils.clamp(k + dir, 0, o.steps.length - 1);
  pkgGo(o.steps[n][1]);
  announce(o.steps[n][0]);
}

function fitDistance(o) {
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 2;
  const portrait = innerWidth < 720;
  const dh = o.h / ((portrait ? 0.5 : 0.7) * t);
  const dw = (o.w * 2) / ((portrait ? 0.96 : 0.84) * t * camera.aspect);
  return Math.max(dh, dw);
}

function select(o) {
  if (!state.allows('objectClick') || active) return;
  hovered = null;
  hideHover();
  gsap.to(hoverLight, { intensity: 0, duration: 0.3 });
  state.set(S.OBJECT_SELECTED);
  active = o;
  const g = o.group;
  gsap.killTweensOf([g.position, g.rotation]);
  // 원래 자리(부모 기준)와 카메라 시선 상태 저장
  saved = { parent: g.parent, base: g.userData.base, rig: rig.snapshot() };
  if (!isPkg(o)) { selectInPlace(o); return; }   // 2.0 최종(3차): 책은 선반에서 꺼내지 않는다
  overlay.attach(g);
  g.updateMatrixWorld();

  if (isPkg(o)) { selectPackage(o); return; }
  const d = fitDistance(o);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const target = camera.position.clone().addScaledVector(fwd, d).addScaledVector(up, innerWidth < 720 ? 0.02 * d : 0.035 * d);
  const fromQ = g.quaternion.clone(), toQ = camera.quaternion.clone();
  const fromP = g.position.clone();
  // 들어 올린 뒤 정면으로 돌며 다가온다(살짝 위로 휘는 경로)
  const mid = fromP.clone().lerp(target, 0.5).add(new THREE.Vector3(0, 0.12, 0));
  const curve = new THREE.QuadraticBezierCurve3(fromP, mid, target);
  const p = { k: 0 };
  veil.visible = true;
  veil.position.set(0, 0, -(d + 0.25));
  const vs = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 2 * (d + 0.25) * 1.2;
  veil.scale.set(vs * camera.aspect, vs, 1);
  ui.canvas.style.cursor = 'default';
  gsap.to(veilMat, { opacity: 0.16, duration: TIMING.select, ease: 'sine.inOut' });
  gsap.to(inspectLight, { intensity: 0.55, duration: TIMING.select });
  gsap.to(p, {
    k: 1, duration: TIMING.select + 0.2, ease: 'power2.inOut',
    onUpdate: () => {
      curve.getPoint(p.k, g.position);
      g.quaternion.slerpQuaternions(fromQ, toQ, p.k);
    },
    onComplete: openBook,
  });
  fillReader(o);
  announce(`${o.label} 선택됨`);
}

/* 2.0 최종(3차): 큐레이션 책은 선반 그 자리에서 펼친다 — 꺼내거나 카메라 앞으로 날아오지 않는다(영상의 집어 드는 연출과 구분).
   ① 고른 책에 작은 빛 ② 고개만 그 책 쪽으로 천천히(서 있는 자리는 그대로) ③ 앞의 페이지 카드가 앞으로 살짝 비켜나고
   ④ 표지가 책등을 축으로 열림 ⑤ 실제 원문은 화면 옆 읽기 패널(크게 읽기)로. 닫으면 표지·카드가 제자리로, 시선은 고르기 전으로 */
const _bp = new THREE.Vector3();
function selectInPlace(o) {
  saved.inPlace = true;
  o.inPlace = true;
  setCursor('default');
  o.group.getWorldPosition(_bp);
  if (hoverLight.parent) { hoverLight.position.copy(_bp).add(new THREE.Vector3(0, 0.35, 0.55)); gsap.to(hoverLight, { intensity: 0.8, duration: 0.6, overwrite: true }); }   // 2026-11-11: 2.2 → 0.8(펼친 책이 하얗게 뜨던 것)
  // 고개만 돌린다(위치·렌즈 그대로). 이미 화면 가운데 근처면 거의 움직이지 않는다
  const d = _bp.clone().sub(rig.pos);
  rig.tYaw = rig.yaw + Math.atan2(Math.sin(Math.atan2(-d.x, -d.z) - rig.yaw), Math.cos(Math.atan2(-d.x, -d.z) - rig.yaw)) * 0.85;
  rig.tPitch = THREE.MathUtils.clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -CAMERA.look.pitch, CAMERA.look.pitch * 0.8);
  const card = o.pageCard;
  if (card) gsap.to(card.position, { x: card.userData.rest.x + 0.02, z: card.userData.rest.z + 0.19, duration: 0.55, ease: 'sine.inOut' });
  gsap.delayedCall(card ? 0.45 : 0.1, openBook);
  fillReader(o);
  // 원문은 옆 읽기 패널로 바로 보여 준다(책은 제자리에 펼쳐진 채 보인다)
  ui.reader.classList.add('large');
  ui.rLarge.setAttribute('aria-pressed', 'true');
  announce(`${o.label}을(를) 제자리에서 펼칩니다`);
  return true;
}

function selectPackage(o) {
  const g = o.group;
  insp.yaw = insp.pitch = insp.yawS = insp.pitchS = 0;
  insp.dist = pkgDistance(o);
  const to = pkgPose(o, insp.dist);
  const fromP = g.position.clone(), fromQ = g.quaternion.clone();
  const fromC = o.center.position.clone(), toC = o.presentOffset();
  const mid = fromP.clone().lerp(to.p, 0.5).add(new THREE.Vector3(0, 0.12, 0));
  const curve = new THREE.QuadraticBezierCurve3(fromP, mid, to.p);
  const p = { k: 0 };
  veil.visible = true;
  placeVeil(insp.dist + 0.4);
  setCursor('default');
  gsap.to(veilMat, { opacity: 0.16, duration: TIMING.select, ease: 'sine.inOut' });
  gsap.to(inspectLight, { intensity: 1.0, duration: TIMING.select });
  gsap.to(p, {
    k: 1, duration: TIMING.select + 0.3, ease: 'power2.inOut',
    onUpdate: () => {
      curve.getPoint(p.k, g.position);
      g.quaternion.slerpQuaternions(fromQ, to.q, p.k);
      o.center.position.lerpVectors(fromC, toC, p.k);
    },
    onComplete: () => {
      state.set(S.BOOK_OPENING);
      state.set(S.BOOK_READING);
      insp.live = true;
      syncReader();
      if (usingKeyboard) ui.rNext.focus({ preventScroll: true });
    },
  });
  fillReader(o);
  announce(`${o.label} 선택됨. 패키지를 눌러 한 단계씩 열어보세요.`);
}

function fillReader(o) {
  ui.rTitle.textContent = o.label;
  ui.rSub.textContent = isPkg(o) ? `${o.sub} · 눌러서 한 단계씩 열기` : (o.sub || '');
  ui.rMore.href = o.detailUrl;
  // rev4: 펼친 책의 큐레이션 색을 읽기 패널에도(웹사이트 한 페이지 시트의 왼쪽 색 띠와 같은 규칙)
  const bc = o.curation?.color || '';
  ui.reader.style.setProperty('--bk', bc || 'transparent');
  ui.reader.nextElementSibling?.style.setProperty('--bk', bc || 'transparent');
  ui.reader.hidden = false;
  requestAnimationFrame(() => ui.reader.classList.add('show'));
}

function openBook() {
  if (!active || !state.set(S.BOOK_OPENING)) return;
  active.ensurePages();
  const p = { v: active.openP };
  gsap.to(p, {
    v: 1, duration: TIMING.bookOpen, ease: 'sine.inOut',
    onUpdate: () => active.setOpen(p.v),
    onComplete: () => {
      state.set(S.BOOK_READING);
      syncReader();
      if (usingKeyboard) (ui.rNext.disabled ? ui.rBack : ui.rNext).focus({ preventScroll: true });
    },
  });
}

function closeBook(then) {
  if (!active || !state.set(S.BOOK_CLOSING)) return;
  const p = { v: active.openP };
  gsap.to(p, {
    v: 0, duration: TIMING.bookOpen * 0.8, ease: 'sine.inOut',
    onUpdate: () => active.setOpen(p.v),
    onComplete: () => {
      if (then) then();
      else { state.set(S.OBJECT_SELECTED); syncReader(); }
    },
  });
}

function backToRoom() {
  if (!active) return;
  if (isPkg(active)) {
    if (!state.is(S.BOOK_READING)) return;
    state.set(S.BOOK_CLOSING);
    pkgGo(0).then(() => { insp.live = false; returnObject(); });
    return;
  }
  if (state.is(S.BOOK_READING)) { if (!active.flipping) closeBook(returnObject); return; }
  if (state.is(S.OBJECT_SELECTED)) returnObject();
}

function returnObject() {
  if (!state.set(S.RETURN_TO_ROOM)) return;
  const o = active, g = o.group;
  if (saved?.inPlace) {
    ui.reader.classList.remove('show', 'large');
    ui.rLarge.setAttribute('aria-pressed', 'false');
    gsap.to(hoverLight, { intensity: 0, duration: 0.5, overwrite: true });
    const card = o.pageCard;
    if (card) gsap.to(card.position, { x: card.userData.rest.x, z: card.userData.rest.z, duration: 0.55, ease: 'sine.inOut' });
    rig.restore(saved.rig);   // 고르기 전 시선 그대로(서 있던 자리는 처음부터 바뀌지 않았다)
    setTimeout(() => {
      o.disposePages(); o.showSpread(0); o.setOpen(0); o.inPlace = false;
      ui.reader.hidden = true;
      active = null; saved = null;
      state.set(S.ROOM_EXPLORATION);
      if (leaveAfterReturn) { leaveAfterReturn = false; setTimeout(exitRoom, 250); }
      if (usingKeyboard) objButtons.get(o)?.focus({ preventScroll: true });
      setCursor('grab');
      announce('책을 덮었습니다');
    }, 600);
    return;
  }
  ui.reader.classList.remove('show', 'large');
  ui.rLarge.setAttribute('aria-pressed', 'false');
  // 원래 자리의 월드 변환 계산
  const parent = saved.parent;
  parent.updateMatrixWorld();
  const local = new THREE.Matrix4().compose(saved.base.p, new THREE.Quaternion().setFromEuler(saved.base.r), new THREE.Vector3(1, 1, 1));
  const world = new THREE.Matrix4().multiplyMatrices(parent.matrixWorld, local);
  const toP = new THREE.Vector3(), toQ = new THREE.Quaternion();
  world.decompose(toP, toQ, new THREE.Vector3());
  const fromP = g.position.clone(), fromQ = g.quaternion.clone();
  const fromC = isPkg(o) ? o.center.position.clone() : null;
  const mid = fromP.clone().lerp(toP, 0.5).add(new THREE.Vector3(0, 0.1, 0));
  const curve = new THREE.QuadraticBezierCurve3(fromP, mid, toP);
  const p = { k: 0 };
  gsap.to(veilMat, { opacity: 0, duration: TIMING.returnRoom, ease: 'sine.inOut' });
  gsap.to(inspectLight, { intensity: 0, duration: TIMING.returnRoom });
  gsap.to(p, {
    k: 1, duration: TIMING.returnRoom + 0.2, ease: 'power2.inOut',
    onUpdate: () => {
      curve.getPoint(p.k, g.position);
      g.quaternion.slerpQuaternions(fromQ, toQ, p.k);
      if (fromC) o.center.position.lerpVectors(fromC, o.restCenter, p.k);
    },
    onComplete: () => {
      parent.attach(g);
      g.position.copy(saved.base.p); g.rotation.copy(saved.base.r);
      if (!isPkg(o)) { o.disposePages(); o.showSpread(0); }
      veil.visible = false;
      ui.reader.hidden = true;
      // 선택 전 시선 그대로 복귀
      rig.restore(saved.rig);
      active = null; saved = null;
      state.set(S.ROOM_EXPLORATION);
      if (leaveAfterReturn) { leaveAfterReturn = false; setTimeout(exitRoom, 250); }
      if (usingKeyboard) objButtons.get(o)?.focus({ preventScroll: true });
      setCursor('grab');
      announce('독서구역으로 돌아왔습니다');
    },
  });
}

async function turn(dir) {
  if (isPkg(active)) { pkgStep(dir); return; }
  if (!active || !state.is(S.BOOK_READING) || active.flipping) return;
  if (active.inPlace) {   // 제자리 펼침: 페이지를 옆 책 쪽으로 크게 넘기지 않고 펼친 면만 바꾼다
    const n = active.spread + dir;
    if (n < 0 || n >= active.spreadCount) return;
    active.showSpread(n); syncReader(n);
    return;
  }
  const ok = active.flip(dir, TIMING.pageFlip);
  syncReader(active.spread + dir);
  await ok;
  syncReader();
}

function syncReader(spread = active?.spread ?? 0) {
  if (!active) return;
  const o = active;
  const reading = state.is(S.BOOK_READING);
  ui.rRange.hidden = !isPkg(o);
  // 패키지: 다 닫혀 있으면 같은 자리 버튼이 '열기'가 된다
  ui.rClose.textContent = isPkg(o) ? (o.open <= 0.001 ? '열기' : '다시 닫기') : '책 닫기';
  if (isPkg(o)) {
    const k = o.stepAt(o.open);
    ui.rPage.textContent = `${o.steps[k][0]} · ${k + 1}/${o.steps.length}`;
    ui.rPrev.disabled = !reading || o.open <= 0.001;
    ui.rNext.disabled = !reading || o.open >= 0.999;
    ui.rClose.hidden = false; ui.rOpen.hidden = true; ui.rLarge.hidden = true;
    ui.rRange.value = Math.round(o.open * 1000);
    ui.rRange.style.setProperty('--p', `${(o.open * 100).toFixed(1)}%`);
    ui.rText.textContent = `${o.label} — ${o.steps[k][0]}. ${o.desc}`;
    return;
  }
  const sc = Math.max(0, Math.min(o.spreadCount - 1, spread));
  const a = sc * 2 + 1, b = Math.min(o.pageCount, sc * 2 + 2);
  ui.rPage.textContent = reading ? `${String(a).padStart(2, '0')}–${String(b).padStart(2, '0')} / ${String(o.pageCount).padStart(2, '0')}` : '닫힘';
  ui.rPrev.disabled = !reading || sc <= 0;
  ui.rNext.disabled = !reading || sc >= o.spreadCount - 1;
  ui.rClose.hidden = !reading;
  ui.rOpen.hidden = reading;
  ui.rLarge.hidden = !reading;
  if (!reading) ui.reader.classList.remove('large');
  ui.reader.dataset.mode = reading ? 'reading' : 'closed';
  // 스크린리더용: 현재 펼침의 실제 텍스트
  ui.rText.textContent = reading ? [o.pageDefs[sc * 2], o.pageDefs[sc * 2 + 1]].map(defText).filter(Boolean).join('\n\n') : '';
  // 2026-11-11: '크게 읽기'는 원래대로 원문 글 패널(클라이언트 요청으로 페이지 그림 표시는 되돌림 — 페이지 원본은 셸프 카드에만)
}

function defText(d) {
  if (!d) return '';
  if (d.type === 'introquote') return [d.eyebrow, d.title, ...d.meta, d.quote].join(' · ');
  if (d.type === 'onepage') return d.text;
  if (d.type === 'end') return `${d.title} — ${d.text}`;
  return '';
}

/* ---------- 리더 UI ---------- */
ui.rPrev.addEventListener('click', () => turn(-1));
ui.rNext.addEventListener('click', () => turn(1));
ui.rClose.addEventListener('click', () => {
  if (!state.is(S.BOOK_READING)) return;
  if (isPkg(active)) pkgGo(active.open <= 0.001 ? 1 : 0);
  else if (!active.flipping) closeBook();
});
// 패키지 열림 정도를 직접 끌어 본다(원본 슬라이더와 같은 0~1000)
ui.rRange.addEventListener('input', () => {
  if (!isPkg(active) || !state.is(S.BOOK_READING)) return;
  pkgTween?.kill();
  active.busy = false;
  active.setOpen(ui.rRange.value / 1000);
  syncReader();
});
ui.rOpen.addEventListener('click', () => { if (state.is(S.OBJECT_SELECTED)) openBook(); });
ui.rBack.addEventListener('click', backToRoom);
// rev6-6: 크게 읽기 창 오른쪽 위 X — 아래 버튼까지 내려가지 않고 바로 닫는다(책 화면으로 돌아감)
$('rX').addEventListener('click', () => { ui.reader.classList.remove('large'); ui.rLarge.setAttribute('aria-pressed', 'false'); });
// X는 크게 읽기 창의 실제 위치(화면 폭마다 다름)를 읽어 창 안쪽 오른쪽 위 모서리에 붙인다
const placeX = () => {
  if (!ui.reader.classList.contains('large')) return;
  const r = ui.rText.getBoundingClientRect(), x = $('rX');
  x.style.top = `${Math.round(r.top + 12)}px`;
  x.style.right = `${Math.round(innerWidth - r.right + 12 + (ui.rText.offsetWidth - ui.rText.clientWidth))}px`;
};
new MutationObserver(() => requestAnimationFrame(placeX)).observe(ui.reader, { attributes: true, attributeFilter: ['class'] });
addEventListener('resize', placeX);
ui.rLarge.addEventListener('click', () => {
  const on = ui.reader.classList.toggle('large');
  ui.rLarge.setAttribute('aria-pressed', on);
});
ui.skip.addEventListener('click', skipIntro);
ui.doorHint.addEventListener('click', skipIntro);

addEventListener('keydown', (e) => {
  if (lounge.keydown(e)) return;
  if (state.is(S.BOOK_READING)) {
    if (e.key === 'ArrowRight') { e.preventDefault(); turn(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-1); }
  }
  if (e.key === 'Escape') backToRoom();
});

// 키보드용 오브젝트 목록(탐색 상태에서만 노출)
const objButtons = new Map();
for (const o of room.openables) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = o.label;
  b.addEventListener('click', () => { if (state.allows('objectClick')) select(o); });
  b.addEventListener('focus', () => { if (state.allows('objectHover')) { unhoverObject(); hoverObject(o); ui.hover.classList.remove('show'); } });
  b.addEventListener('blur', () => unhoverObject());
  ui.objects.appendChild(b);
  objButtons.set(o, b);
}

function announce(t) { ui.live.textContent = t; }

// 키보드로 조작 중일 때만 포커스를 리더 ↔ 오브젝트 목록으로 옮긴다
let usingKeyboard = false;
addEventListener('keydown', (e) => { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') usingKeyboard = true; }, true);
addEventListener('pointerdown', () => { usingKeyboard = false; }, true);

/* ---------- 리사이즈 · 루프 ---------- */
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  applyFov();
  fitPlaque();
  placeStart();
  post.resize();
});

/* ---------- 후처리 · 초점 ---------- */
// 2026-11-13: 화면 후처리(빛 번짐·심도 흐림·색 보정·그레인·비네트)를 모두 쓰지 않는다 — 장면을 그대로 그린다(가벼운 경로)
const post = createPost(renderer, scene, camera, { high: !coarse, overlay, lite: true });
ui.app.classList.toggle('lite', lite);
const focusRay = new THREE.Raycaster();
const _fp = new THREE.Vector3();
let focusTick = 0, focusDist = 5.4;
const DOOR_FOCUS = new THREE.Vector3(0, 1.2, 0);
// 보는 대상에 초점: 문 앞 = 문, 탐색 중 = 화면 가운데에 걸린 물체(또는 호버한 물체), 읽는 중 = 펼친 책·패키지
function updateFocus(dt) {
  let target = focusDist;
  if (state.is(S.INITIAL, S.DOOR_HOVER, S.DOOR_OPENING)) target = camera.position.distanceTo(DOOR_FOCUS);
  else if (active) target = camera.position.distanceTo(active.group.getWorldPosition(_fp));
  else if (hovered) target = camera.position.distanceTo(hovered.group.getWorldPosition(_fp));
  else if ((focusTick++ % 6) === 0) {
    focusRay.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hit = focusRay.intersectObject(room.group, true).find((h) => h.object.isMesh && !h.object.userData.noPick && !(h.object.material.transparent));
    if (hit) focusDist = THREE.MathUtils.clamp(hit.distance, 0.8, 9);
    target = focusDist;
  } else target = focusDist;
  post.setFocus(target, dt);
  post.setAperture(active && !active.inPlace ? 0.0012 : 0);   // 2.0 최종(3차): 제자리 펼침은 흐림 없이   // 둘러볼 때는 흐림 없이, 읽을 때만 배경을 살짝 흐린다
  post.setReading(!!active);
  audio.setReading(!!active && state.is(S.BOOK_OPENING, S.BOOK_READING, S.OBJECT_SELECTED));
}

// 문 앞 유혹 효과: 마지막 입력 후 10초
/* ---------- 실제 해의 흐름: 아침엔 햇빛이 잔뜩, 해 질 녘엔 노을빛, 밤엔 해 대신 조명 ---------- */
for (const l of lamps) { l.userData.base = l.intensity; l.userData.color = l.color.clone(); }
const LAMP_NIGHT = new THREE.Color('#FFD9A0');
const SUN_DAY = new THREE.Color('#FFFAF0'), SUN_WARM = new THREE.Color('#FFC89A');   // 노을빛은 아이보리를 해치지 않을 만큼만
const SKY_DAY = new THREE.Color('#FFFDF6'), SKY_NIGHT = new THREE.Color('#AEB8D6');
const GND_DAY = new THREE.Color('#EADFC9'), GND_NIGHT = new THREE.Color('#857D72');
const BG_DAY = new THREE.Color(COLORS.ivory), BG_NIGHT = new THREE.Color('#2F3442');
const FOG_DAY = new THREE.Color('#F6F1E6'), FOG_NIGHT = new THREE.Color('#5A5E6A');
const HOUR = hourOverride();
// 조명 모드: 실시간(기기 시각) / 낮 / 밤 — 휴대폰의 라이트·다크처럼 언제든 고를 수 있고, 고른 것은 기억한다
const MODE_HOUR = { day: 10.5, night: 21.5 };
let dayMode = 'auto';
try { dayMode = localStorage.getItem('hirang-daymode') || 'auto'; } catch (e) { /* 저장소 없음 */ }
if (!['auto', 'day', 'night'].includes(dayMode)) dayMode = 'auto';
const modeBtns = [...document.querySelectorAll('.daymode [data-mode]')];
const PART = { morning: '아침', day: '낮', dusk: '해 질 녘', dawn: '해 뜰 녘', night: '밤' };
const sky = { hemi: HEMI, sun: SUN, roomSun: roomSun.intensity, door: 1, exposure: 0.94, day: 0, environment: scene.environmentIntensity };
const ROOM_SUN = roomSun.intensity;
// 2026-11-11: 밤에 셸프 책 표지·진열 페이지가 어둡게 가라앉던 것 — 그림(emissiveMap)이 있는 표지·페이지 재질은 밤일수록 스스로 조금 더 밝힌다(글자 대비는 그림 그대로)
const nightDisplayMats = [];
{
  const seen = new Set();
  const take = (root) => root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && m.emissiveMap && !seen.has(m)) { seen.add(m); m.userData.emBase = m.emissiveIntensity; nightDisplayMats.push(m); } });
  for (const o of room.openables) { if (o.kind !== 'package') take(o.group); if (o.pageCard) take(o.pageCard); }
  // rev6-6: 패키지 인쇄면도 밤에만 조금 스스로 밝게(밤에 Ch2가 너무 어두웠다). 낮 값은 그대로
  for (const o of room.openables) if (o.kind === 'package') o.group.traverse((m) => { if (m.isMesh) for (const mt of [].concat(m.material)) if (mt && !seen.has(mt) && (mt.emissiveMap || mt.emissiveIntensity > 0)) { seen.add(mt); mt.userData.emBase = mt.emissiveIntensity; mt.userData.emNight = 0.2; nightDisplayMats.push(mt); } });
}
function applyDaylight() {
  const now = new Date();
  const d = daylight(now, dayMode === 'auto' ? HOUR : MODE_HOUR[dayMode]);
  const n = d.night;
  sky.day = d.day;
  // 바깥 해: 방위각에 따라 동쪽(아침)은 왼쪽, 서쪽(오후)은 오른쪽에서, 고도만큼 높이
  const side = Math.sin((d.az - 180) * Math.PI / 180);
  const h = Math.max(0.05, Math.sin(Math.max(2, d.elev) * Math.PI / 180));
  sun.position.set(side * 7.5, 1.4 + h * 8, 3.4 + (1 - Math.abs(side)) * 2);
  sun.color.copy(SUN_DAY).lerp(SUN_WARM, d.warm);
  // 낮: 남향 매장처럼 햇빛이 가득(해·하늘빛·반사광 모두 크게), 밤: 해 대신 조명
  sky.sun = SUN * (0.04 + 1.25 * d.day);
  // 실내 햇빛(왼쪽 아치 창): 아침에 가장 많이, 해 질 녘엔 붉게, 밤엔 꺼짐
  roomSun.color.copy(SUN_DAY).lerp(SUN_WARM, d.warm);
  roomSun.position.y = 2.6 + h * 7;
  // 2026-11-10 노출 수정: 아침 창 햇빛이 9.5(거리 감쇠 없음)까지 올라 셸프 오른쪽 페이지 카드의 글자가 흰색으로 날아가고 초록이 세이지로 바랬다.
  // 다른 실내 조명과 균형 맞는 값으로(한낮 ≈2.6, 아침 ≈3.1). 방향 있는 햇빛과 그림자는 그대로 남는다
  sky.roomSun = ROOM_SUN * d.day * (0.5 + 0.09 * d.morning * d.day);
  roomSun.intensity = sky.roomSun;
  // rev4: 낮에 모든 면을 고르게 채우던 하늘빛·반사광을 줄인다(0.55+0.8d → 0.5+0.3d). 그늘이 그늘로 남아 앞뒤가 갈린다. 밤 값은 그대로
  // 2026-11-11: 낮이 밤처럼 어둡다는 피드백 — 하늘빛·반사광(그늘을 채우는 빛)을 올려 밝고 산뜻하게. 직접 빛(햇빛·스포트)은 그대로라 흰 종이는 다시 날아가지 않는다
  sky.hemi = HEMI * (0.5 + 0.85 * d.day);   // 2026-11-11(3): 고르게 채우는 빛을 줄이고 노출을 올려 깊이감(그늘)은 살리고 전체는 밝게 — 클라이언트 참고(rev4 깊이 + 더 밝게)   // 2026-11-11(2): 클라이언트 낮 참고(밝은 아이보리 하이키) — 하늘빛 ×1.8. 빛 받은 초록 #506246·라벤더 #b8a5c6(브랜드 #4F5F4C·#C1B1D1)
  hemi.color.copy(SKY_DAY).lerp(SKY_NIGHT, n);
  hemi.groundColor.copy(GND_DAY).lerp(GND_NIGHT, n);
  sky.environment = 0.38 * (0.35 + 0.68 * d.day);   // 2026-11-11: 낮 반사광은 하늘빛보다 덜 올린다(위에서 고르게 비춰 패키지 윗면이 평평하게 떴다)   // rev4: 0.9 → 0.4 (낮 환경광이 그림자를 지우던 것)
  scene.environmentIntensity = sky.environment;
  scene.background.copy(BG_DAY).lerp(BG_NIGHT, n);
  scene.fog.color.copy(FOG_DAY).lerp(FOG_NIGHT, n * 0.7);
  // 인공 조명: 밤일수록 더 밝고 따뜻하게
  for (const l of lamps) { l.userData.cur = l.userData.base * (1 + 0.7 * n); l.color.copy(l.userData.color).lerp(LAMP_NIGHT, n * 0.6); }   // 실제 세기는 루프에서 실내 조명 페이드(inK)를 곱해 넣는다
  door.setNight(n);
  for (const m of nightDisplayMats) m.emissiveIntensity = m.userData.emBase + (m.userData.emNight ?? 0.26) * n;
  room.setNight(n);
  sky.door = 1 + 0.8 * n;
  // 2026-11-10 노출 수정: 실내 1.02 → 0.92. 1.02에서는 흰 종이·아이보리가 톤 매핑 어깨에 걸려 글자 대비가 사라졌다.
  // 입구와 실내가 같은 노출 하나를 쓰고, 입구 쪽 보정은 아래 루프에서 작게·부드럽게만 더한다
  sky.exposure = 1.17 - 0.19 * n;   // rev6-5b: 낮 1.06 → 1.17(회색빛 제거, 참고 이미지 밝기), 밤 0.98 그대로   // 낮 1.06(밝게, 그늘은 그대로 그늘) / 밤 0.98(그대로)   // 밤은 원래 밝기(≈0.98) 유지 — 넘치던 것은 낮의 햇빛 쪽이었다
  const part = d.day > 0.75 ? (d.morning ? 'morning' : 'day') : d.day > 0.15 ? (d.morning ? 'dawn' : 'dusk') : 'night';
  ui.app.dataset.daypart = part;
  // 지금 시각 + 조명 상태(실시간이 아니면 고른 모드)
  const hh = now.getHours(), mm = String(now.getMinutes()).padStart(2, '0');
  const clock = `${hh < 12 ? '오전' : '오후'} ${hh % 12 || 12}:${mm}`;
  // 2026-11-11: '오후 1:07 · 밤'이 네 번째 선택지처럼 보였다 → 시계는 시각만, 지금 시간대는 '실시간' 버튼 안에 함께
  $('dmClock').textContent = clock;
  const autoBtn = modeBtns.find((b) => b.dataset.mode === 'auto');
  if (autoBtn) autoBtn.textContent = dayMode === 'auto' ? `실시간 · ${PART[part]}` : '실시간';
  modeBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === dayMode)));
}
modeBtns.forEach((b) => b.addEventListener('click', () => {
  dayMode = b.dataset.mode;
  try { localStorage.setItem('hirang-daymode', dayMode); } catch (e) { /* 저장소 없음 */ }
  applyDaylight();
  announce(`${b.dataset.mode === 'auto' ? '실시간' : b.textContent} 조명으로 바꿨습니다`);
}));
applyDaylight();
setInterval(applyDaylight, 30 * 1000);   // 30초마다 해 위치·시계를 다시 계산

const IDLE_RETURN_MS = 60000;
const LURE_DELAY = 7000;   // 문 앞에서 7초 동안 움직임이 없으면 빛이 새어 나온다
let lastInput = performance.now(), lure = 0, frameNo = 0;
// 2026-11-10 노출 수정: 문 앞 보정(entK)과 실내 조명(inK)을 한 프레임에 바꾸지 않고 천천히 넘긴다.
// 전에는 문을 누르는 순간 노출 0.85→1.02, 햇빛 +39%, 하늘빛 +18%, 실내 조명 11개가 같은 프레임에 켜져 화면 밝기가 한 번에 12% 뛰었다
let entK = 1, inK = 0;
['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true }));

const clock = new THREE.Clock();
/* ---------- 성능 조절: 실제 FPS를 1초마다 재서, 모자라면 품질을 한 단계 내리고 여유가 있으면 되돌린다 ---------- */
// 데스크톱은 60FPS 가까이(55 미만이 2초 이어지면 한 단계 ↓), 휴대폰·아이패드는 30FPS 이상(30 미만이 2초면 ↓).
// 되돌린 뒤 곧바로 다시 느려지면 그 단계를 상한으로 삼아 오르내림을 반복하지 않는다.
let revealed = false;   // 로더가 걷힌 뒤부터 FPS를 판단한다
// up: 이만큼 여유가 있으면 한 단계 선명하게. 휴대폰은 60Hz에서 52fps를 5초 넘기기 어려워 한번 흐려지면 돌아오지 않던 문제가 있어 45로 낮춘다
// graceUntil: 처음 화면이 뜬 직후·조명 구역이 바뀐 직후는 원래 잠깐 느리므로 그동안은 품질을 판단하지 않는다(괜히 흐려지지 않게)
const perf = { target: coarse ? 30 : 45, up: coarse ? 45 : 56,   // 2026-11-11: 데스크톱 55 → 45(60Hz 화면의 순간 흔들림에 화질을 내리지 않게)
  graceUntil: 0, acc: 0, n: 0, slow: 0, fast: 0, last: performance.now(), fps: 0, ceiling: 0, raisedAt: -1e9, log: [] };
function govern(now) {
  const ms = now - perf.last; perf.last = now;
  // 탭 전환·멈춤(1초 이상)만 계산에서 뺀다. 느린 기기의 긴 프레임(0.25초 등)은 그대로 세야 품질을 내릴 수 있다
  if (ms > 1000 || document.hidden) { perf.acc = perf.n = 0; return; }
  perf.acc += ms; perf.n++;
  if (perf.acc < 1000) return;
  const fps = (1000 * perf.n) / perf.acc;
  perf.fps = Math.round(fps); perf.acc = perf.n = 0;
  if (!revealed) return;
  if (now < perf.graceUntil) { perf.slow = perf.fast = 0; return; }
  if (fps < perf.target) {
    perf.fast = 0;
    // 목표의 절반도 안 되면 기다리지 않고 바로 두 단계를 내린다(휴대폰에서 몇 초씩 버벅이지 않게)
    const severe = fps < perf.target * 0.5;
    if (severe || ++perf.slow >= 2) {
      perf.slow = 0;
      if (now - perf.raisedAt < 8000) perf.ceiling = post.level + 1;     // 올렸더니 곧 느려짐 → 그 아래가 이 기기의 한계
      if (post.setLevel(post.level + (severe ? 2 : 1))) perf.log.push(`↓${post.level} @${perf.fps}fps`);
    }
  } else if (fps > perf.up) {
    perf.slow = 0;
    if (++perf.fast >= 4 && post.level > perf.ceiling) {
      perf.fast = 0;
      if (post.setLevel(post.level - 1)) { perf.raisedAt = now; perf.log.push(`↑${post.level} @${perf.fps}fps`); }
    }
  } else perf.slow = perf.fast = 0;
}

const loop = () => {
  govern(performance.now());
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  // 문 앞에서는 대기하고 내부에서 1분간 입력이 없으면 문 앞부터 다시 시작한다.
  // 2.0 최종: 책·패키지를 펼쳐 읽는 동안에는 입력이 없어도 문 앞으로 되돌리지 않는다(천천히 읽는 사람을 쫓아내지 않게)
  const readingNow = state.is(S.OBJECT_SELECTED, S.BOOK_OPENING, S.BOOK_READING, S.BOOK_CLOSING);
  if (readingNow) lastInput = Math.max(lastInput, performance.now() - IDLE_RETURN_MS * 0.5);
  // rev5: 입력이 없어도 문 앞으로 되돌리지(새로고침하지) 않는다. 방을 나가는 것은 관람객이 직접 나갈 때뿐
  // 2.0 최종: 문을 지나 들어오는 동안에는 관람객을 숨긴다(화면 가장자리에 머리가 불쑥 보이던 문제). 도착 시점엔 화면 밖에 있다
  people.setVisible(!state.is(S.INITIAL, S.DOOR_HOVER, S.DOOR_OPENING, S.CAMERA_ENTERING, S.LEAVING));
  // 2026-11-11 라이브: 바로 입장(문 연출 없음)은 arrivedAt이 없어 실제 방문자 캐릭터가 계속 멈춰 있었다 → 그 경우는 방 안이면 바로 움직인다
  if (state.is(S.ROOM_EXPLORATION, S.OBJECT_HOVER, S.OBJECT_SELECTED, S.BOOK_OPENING, S.BOOK_READING, S.BOOK_CLOSING, S.RETURN_TO_ROOM)) people.setActive(true);
  if (!lounge.owns) rig.update(dt, !state.allows('look') || asking);
  lounge.update(dt, t, performance.now());
  stepRoute();
  // 문: 열림 각도 + 호버 시 살짝 벌어짐 + 손잡이
  // 문 앞에서 7초 넘게 머뭇거리면 방 안의 빛이 문틈을 뚫고 새어 나온다(움직이면 잦아든다)
  const atDoor = state.is(S.INITIAL, S.DOOR_HOVER);
  // 2026-11-13: 휴대폰은 화면을 만질 때마다 머뭇거림 빛이 켜졌다 꺼져 깜빡이는 것처럼 보였다 → 터치 기기에서는 쓰지 않는다
  const lureT = atDoor && !reduced && !coarse && performance.now() - lastInput > LURE_DELAY ? 1 : 0;
  // 2026-11-11: 문을 누르면 머뭇거림 빛은 0.15초 안에 사라진다(문 뒤 밝은 판·바닥 금빛이 열리는 틈으로 노랗게 튀던 것)
  lure += (lureT - lure) * (1 - Math.exp(-(lureT ? 1.2 : atDoor ? 4 : 18) * dt));
  // 깜빡임 대신 숨 쉬듯 천천히 밝아졌다 잦아드는 빛(사이렌처럼 번쩍이지 않게)
  const flick = coarse ? 0.5 : 0.5 + 0.35 * Math.sin(t * 1.1) + 0.15 * Math.sin(t * 2.7 + 1.3);
  const lureAjar = lure * (0.07 + 0.03 * Math.sin(t * 0.8));   // 2026-11-11: 틈을 조금 더 벌려 안쪽 빛이 분명히 새어 나오게
  // 유혹하는 동안 바깥은 살짝 어두워져 문틈의 빛이 도드라진다
  // 낮의 입구만 주변광을 눌러 초록 문·몰딩·벽등의 명암을 확보한다.
  // 실내에 들어가면 원래의 낮 조명으로 돌아온다. 밤 조명 계수는 그대로다.
  const dampK = 1 - Math.exp(-1.6 * dt);   // 약 1.5초에 걸쳐 넘어간다(문이 열리는 시간과 같은 길이)
  // 문 앞 보정은 카메라가 문턱(z≈0)을 지나 방 안에 들어선 뒤에야 풀린다 → 문이 열리는 동안 바깥 벽·문 밝기가 그대로다(바깥은 그때 화면 밖)
  entK += ((camera.position.z > 0 ? 1 : 0) - entK) * dampK;
  inK += ((atDoor ? 0 : 1) - inK) * dampK;
  for (const l of lamps) l.intensity = (l.userData.cur ?? l.userData.base) * inK;
  const entranceDay = sky.day * entK;
  const entranceGlow = Math.max(lure, entranceDay * 0.22);
  hemi.intensity = sky.hemi * (1 - (0.3 + 0.22 * sky.day) * lure) * (1 - 0.15 * entranceDay);   // 2026-11-11: 머뭇거림 빛 동안 주변을 조금 더 눌러 빛이 분명히 보이게(0.18 → 0.3)
  sun.intensity = sky.sun * (1 - (0.35 + 0.25 * sky.day) * lure) * (1 - 0.28 * entranceDay);
  scene.environmentIntensity = sky.environment * (1 - 0.18 * entranceDay) * (1 - (0.3 + 0.22 * sky.day) * lure);
  renderer.toneMappingExposure = 1.0;   // 2026-11-13: 노출 보정을 쓰지 않는다(시간·머뭇거림에 따라 화면 밝기를 바꾸지 않음)   // rev6-6: 낮 머뭇거림 때 주변을 밤처럼 한 단계 더 눌러 문 빛이 대비로 보이게   // rev6-5: 벽 자체 발광을 줄인 만큼 낮 입구 노출을 내리지 않는다(−0.06 → 0)   // 낮 입구 보정 0.12 → 0.06(실내와의 차이를 줄임), entK로 부드럽게
  post.setGlow(lure * 0.3);   // 2.0 최종: 문틈 빛 번짐 절제
  door.setAngle(doorFx.open + doorFx.ajar + lureAjar);
  // 초록 문짝은 밖에서 볼 때만: 방 안(벽 안쪽)에 들어서면 열린 문짝이 화면을 덮지 않게 숨긴다
  door.setLeafVisible(camera.position.z > -0.05);
  door.setHandle(doorFx.handle);
  door.updateLure(entranceGlow, t, flick, lure);
  ui.doorHint.classList.toggle('lure', lure > 0.3);
  const breathe = reduced ? 0 : Math.sin(t * 0.8) * 0.06;
  door.spillMat.opacity = Math.min(1, doorFx.light * 0.3 + (doorFx.ajar / DOOR.hoverAjar) * 0.08 + 0.04 + breathe * 0.15 + lure * (0.75 + flick * 0.1));
  doorLight.intensity = (2.6 + doorFx.light * 4 + breathe * 2) * sky.door * (1 - 0.6 * lure);
  // 햇빛 무늬: 낮일수록(해가 있을 때) 보이고, 아주 천천히 옆으로 흐른다(약 90초 주기)
  room.update(t, dt, reduced);
  people.update(t, dt, reduced);
  exitAtDoor();
  if (insp.live && active) updateInspect(dt);
  updateOverlayLight();
  updateFocus(dt);
  updateZone();
  // 그림자는 몇 프레임에 한 번만 갱신(움직이는 건 관람객뿐이라 눈에 띄지 않는다). 간격은 품질 단계가 정한다
  renderer.shadowMap.needsUpdate = frameNo++ % post.shadowEvery === 0;
  post.render(t);
};
renderer.setAnimationLoop(loop);
// 2.0 최종 성능: 탭이 보이지 않으면 렌더 루프를 완전히 멈추고, 돌아오면 시계를 이어 붙인다(긴 dt로 튀지 않게)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) renderer.setAnimationLoop(null);
  else { clock.getDelta(); perf.last = performance.now(); renderer.setAnimationLoop(loop); }
});

if (returning) enterRoomDirect();

// 첫 프레임 이후 로더 제거 → 문 등장(돌아온 경우에는 바로 독서구역)
/* ---------- 조명 구역: 지금 보이는 곳의 조명만 켠다(조명 수가 곧 모든 픽셀의 계산량이라 버벅임의 주원인) ---------- */
// 문 앞(바깥): 문 위 조명·벽등·문틈 빛 / 방 안: 천장 스포트·램프·패키지 조명·안뜰 문 조명
const lightsIn = (root) => { const a = []; root.traverse((o) => { if (o.isLight) a.push(o); }); return a; };
const outsideLights = [doorLight, ...lightsIn(door.group)];
const insideLights = [...new Set([...lamps, hoverLight, ...lightsIn(room.group), ...lounge.lights])];
let zoneKey = '';
function setZone(out, inn) {
  const key = `${+out}${+inn}`;
  if (key === zoneKey) return;
  zoneKey = key;
  perf.graceUntil = performance.now() + 2500;
  for (const l of outsideLights) l.visible = out;
  for (const l of insideLights) l.visible = inn;
}
function updateZone() {
  const atDoorSide = state.is(S.INITIAL, S.DOOR_HOVER);
  const crossing = state.is(S.DOOR_OPENING, S.CAMERA_ENTERING, S.LEAVING);
  setZone(atDoorSide || crossing || camera.position.z > -0.6, !atDoorSide);
}
// 구역이 바뀔 때 셰이더를 새로 만드느라 멈추지 않도록, 세 가지 조명 조합을 로딩 중에 미리 준비해 둔다
// 준비는 '보이는 물체'만 대상으로 하므로, 그동안만 숨겨 둔 물체(관람객·책 페이지·빛 판 등)도 모두 보이게 한다.
// 조명은 구역 설정을 따라야 하므로 그대로 둔다. (가능하면 병렬 컴파일로 — 로딩 중 화면이 멈추지 않게)
// 실제 화면은 후처리 버퍼(선형 색·톤매핑 없음)에 그리므로, 같은 버퍼를 대상으로 준비해야 같은 프로그램이 만들어진다.
const hiddenForWarm = [];
scene.traverse((o) => { if (!o.visible && !o.isLight) { hiddenForWarm.push(o); o.visible = true; } });
const toBuffer = () => renderer.setRenderTarget(post.lite ? null : post.composer.renderTarget1);   // 기다리는 사이 다른 프레임이 바꿔 놓을 수 있어 매번 지정
for (const [o, i] of [[true, true], [false, true], [true, false]]) {
  setZone(o, i);
  toBuffer();
  try { await renderer.compileAsync(scene, camera); } catch (e) { renderer.compile(scene, camera); }
  toBuffer();
  renderer.shadowMap.needsUpdate = true;      // 그림자용 프로그램도 이 조합으로 한 번 만들어 둔다
  renderer.render(scene, camera);
}
toBuffer();
try { await renderer.compileAsync(overlay, camera); } catch (e) { renderer.compile(overlay, camera); }
toBuffer();
// 방 안의 이미지(책 표지·패키지·보드 등)도 미리 그래픽 메모리에 올리고, 그림자도 한 번 그려 둔다
// → 문을 열고 방이 처음 보이는 순간 0.2초쯤 멈칫하던 것을 없앤다
{
  const seen = new Set();
  const upload = (root) => root.traverse((o) => {
    for (const mat of [].concat(o.material || [])) {
      for (const k of ['map', 'emissiveMap', 'bumpMap', 'normalMap', 'roughnessMap', 'alphaMap', 'aoMap']) {
        const t = mat[k];
        if (t && !seen.has(t)) { seen.add(t); renderer.initTexture(t); }
      }
    }
  });
  upload(scene); upload(overlay);
}
renderer.setRenderTarget(null);
for (const o of hiddenForWarm) o.visible = false;
zoneKey = '';
updateZone();

function reveal() {
  if (revealed) return; revealed = true;
  perf.graceUntil = performance.now() + 3000;
  ui.loader.classList.add('done');
  if (!returning) setTimeout(() => ui.doorHint.classList.add('show'), reduced ? 200 : 1400);
}
requestAnimationFrame(reveal);
setTimeout(reveal, 3000);   // 화면 갱신이 멈춘 환경에서도 로더가 남지 않게

// 브라우저 자동화 테스트용 훅
window.__hirang = {
  state: () => state.get(), openDoor, select: (i) => select(room.openables[i]), turn, backToRoom,
  closeBook: () => ui.rClose.click(), openables: room.openables.map((o) => o.label),
  spread: () => active?.spread, camera, door: doorFx, rig,
  project(o3d) { const v = o3d.getWorldPosition(new THREE.Vector3()).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
  renderer, post, scene, perf, mergeInfo, texCap, audio,
  presence, traces,
  objects: room.openables, doorMesh: door.hit[0], entryTl: () => entryTl, lastStop: () => lastStop, stopMove, insp, pkgGo, pkgStep, exitRoom, people, setIdle: (ms) => { lastInput = performance.now() - ms; },
};
