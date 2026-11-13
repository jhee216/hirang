// 비밀독서구역(experience) 안에 붙는 방명록 라운지 — 같은 건물의 옆방.
// 오른쪽 벽 아치 입구로 걸어 들어오면 라운지. 걷기는 원래 방의 카메라 리그가 그대로 맡고,
// 의자에 앉거나·쓰거나·읽는 동안만 이 모듈이 카메라를 맡는다(일어나면 그 자리에서 리그로 돌려준다).
// 라운지 안의 좌표는 모두 라운지 로컬(guestbook/lounge/world.js 기준)로 계산하고, 카메라에 줄 때만 장면 좌표로 바꾼다.
import * as THREE from 'three';
import { buildLounge, buildPage, buildTraces, buildPageGlow, buildFloaters, LAYOUT, ROOM } from './world.js';
import { makePageTexture } from './pages.js';
import { getBackend } from '../lib/backend.js';
import { visitorKey } from '../lib/visitor-key.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPortrait = () => innerWidth / innerHeight < 0.8;
const narrow = () => innerWidth <= 900;
// 2026-11-13: 종이·책이 화면 가운데에 꼭 맞게 들어오는 거리(가로 w·세로 d m, 화면에서 쓸 수 있는 세로·가로 몫)
const fitR = (w, d, fov, hFrac = 1, wFrac = 1) => { const t = Math.tan(THREE.MathUtils.degToRad(fov) / 2), a = innerWidth / innerHeight; return Math.max(d / (2 * t * hFrac), w / (2 * t * a * wFrac)); };
const clamp = THREE.MathUtils.clamp;
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const easeIO = (k) => -(Math.cos(Math.PI * k) - 1) / 2;
const easeOut = (k) => Math.sin((k * Math.PI) / 2);
const EYE = 1.485, SIT_EYE = 1.12;

const ERR = {
  too_fast: '조금 더 천천히 적어 주세요.',
  too_short: '두 글자 이상 적어 주세요.',
  too_long: '300자까지 남길 수 있습니다.',
  links: '링크나 주소는 남길 수 없습니다.',
  rate: '페이지를 여러 번 남기셨습니다. 잠시 후 다시 남겨 주세요.',
  duplicate: '같은 글이 이미 보관함에 있습니다.',
  name_too_long: '이름은 20자까지 적을 수 있습니다.',
};
// 2026-11-13: 쓰는 자리·읽는 자리를 나누지 않는다 — 어느 의자에 앉아도 쓰고 읽을 수 있다
const LABEL = { writeChair: '자리에 앉기', readChair: '자리에 앉기', tray: '빈 페이지', page: '빈 페이지', book: '방명록' };

// 화면 위 조작(입력 카드·읽기 버튼·일어나기·안내)을 만든다. 클래스는 gbr- 로 시작해 원래 방의 스타일과 섞이지 않는다
function buildUI(root) {
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('./room-lounge.css', import.meta.url).href;
  document.head.appendChild(css);
  const wrap = document.createElement('div');
  wrap.className = 'gbr';
  wrap.innerHTML = `
    <div class="gbr-spots" data-k="spots" role="group" aria-label="방명록 라운지" hidden>
      <button type="button" data-go="sit">자리에 앉기</button>
    </div>
    <div class="gbr-spots" data-k="seatActs" role="group" aria-label="자리에서 할 일" hidden>
      <button type="button" data-go="write">한 페이지 쓰기</button>
      <button type="button" data-go="read">공개된 페이지 읽기</button>
    </div>
    <button type="button" class="gbr-stand" data-k="stand" hidden>일어나기</button>
    <form class="gbr-writer" data-k="writer" novalidate hidden>
      <label class="gbr-prompt" for="gbrBody">당신의 한 페이지를 남겨주세요.</label>
      <textarea id="gbrBody" data-k="body" maxlength="300" rows="6" required></textarea>
      <div class="gbr-count" aria-hidden="true"><span data-k="count">0</span> / 300</div>
      <div class="gbr-grp" role="radiogroup" aria-label="이름">
        <label class="gbr-rd"><input type="radio" name="gbrIdentity" value="anonymous" checked><span>익명</span></label>
        <label class="gbr-rd"><input type="radio" name="gbrIdentity" value="nickname"><span>닉네임</span></label>
        <label class="gbr-rd"><input type="radio" name="gbrIdentity" value="realname"><span>실명</span></label>
      </div>
      <input type="text" data-k="name" maxlength="20" autocomplete="off" aria-label="이름" hidden>
      <label class="gbr-ck"><input type="checkbox" data-k="isPublic"><span>다른 방문객에게 글 공개하기</span></label>
      <label class="gbr-ck" data-k="showNameRow" hidden><input type="checkbox" data-k="showName"><span>이름도 함께 공개하기</span></label>
      <input type="text" name="website" data-k="website" class="gbr-trap" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="gbr-err" data-k="err" role="alert"></p>
      <button type="submit" class="gbr-primary" data-k="submit">한 페이지 남기기</button>
    </form>
    <div class="gbr-reader" data-k="reader" hidden>
      <button type="button" class="gbr-turn" data-k="prev" aria-label="앞 페이지">←</button>
      <span class="gbr-rpos" data-k="rpos"></span>
      <button type="button" class="gbr-turn" data-k="next" aria-label="다음 페이지">→</button>
      <button type="button" class="gbr-ghost" data-k="closeBook">닫기</button>
    </div>
    <p class="gbr-sr" data-k="readText" aria-live="polite"></p>
    <p class="gbr-toast" data-k="toast" role="status" aria-live="polite"></p>`;
  root.appendChild(wrap);
  const q = (k) => wrap.querySelector(`[data-k="${k}"]`);
  return { wrap, q };
}

export async function mountLounge({ scene, camera, rig, door, sym, logoImg, root, coarse }) {
  let tunnelFloor = null;
  const pickExtra = [];   // 2026-11-13: 장면에 직접 붙인 통로(벽·발판)도 누를 수 있게
  /* ---------- 장면 ---------- */
  const world = buildLounge({ sym, logoImg, merged: true });
  const G = world.group;
  // 라운지 뒷벽 통로(로컬 x = LAYOUT.door.x, 바깥면 z = z1 − wt)가 원래 방 오른쪽 벽(x 4.4)의 입구와 맞물리도록
  // 두 벽 사이에 짧은 통로(GAP)를 둔다 — 라운지 뒷벽의 라벤더 벽감이 깊이만큼 들어갈 자리
  const GAP = 0.34;
  G.rotation.y = Math.PI / 2;
  G.position.set(4.4 + GAP - (ROOM.z1 - ROOM.wt), 0, door.z + LAYOUT.door.x);
  scene.add(G);
  {
    // 통로 안쪽 면(아치 띠를 GAP 길이만큼) + 바닥
    const R = door.R, leg = door.leg, T = 0.05;   // 옆 벽감과 7 cm 떨어져 있어 얇은 안감만
    const sh = new THREE.Shape();
    sh.moveTo(-R - T, 0); sh.lineTo(-R - T, leg + R + T); sh.lineTo(R + T, leg + R + T); sh.lineTo(R + T, 0); sh.lineTo(R, 0); sh.lineTo(R, leg);
    sh.absarc(0, leg, R, 0, Math.PI, false); sh.lineTo(-R, 0); sh.lineTo(-R - T, 0);
    const wallM = new THREE.MeshStandardMaterial({ color: '#F2E8D3', roughness: 0.95 });
    const tunnel = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: GAP + 0.02, bevelEnabled: false, curveSegments: 48 }), wallM);
    tunnel.rotation.y = Math.PI / 2; tunnel.position.set(4.39, 0, door.z);   // 모양 x → 장면 −z, 두께 → +x
    tunnel.receiveShadow = true;
    // 2026-11-13: 발판이 원래 방 벽 두께(x 4.2~4.4)까지 덮게 — 전에는 그 사이가 비어 바깥(밤하늘색)이 보이고 눌러도 걸어가지 않았다
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(GAP + 0.26, R * 2 + 0.1), new THREE.MeshStandardMaterial({ color: '#F4E9D6', roughness: 0.85 }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(4.18 + (GAP + 0.26) / 2, 0.001, door.z); fl.receiveShadow = true; fl.userData.floor = true;
    scene.add(tunnel, fl);
    tunnelFloor = fl; pickExtra.push(tunnel, fl);
  }
  G.updateMatrixWorld(true);
  const L2W = (v) => G.localToWorld(v.clone());
  const W2L = (v) => G.worldToLocal(v.clone());
  const { book, tray, writeChair, readChair } = world;
  const BU = book.userData;
  const traces = buildTraces();
  G.add(traces.group);
  const floaters = buildFloaters(makePageTexture);   // 2026-11-13: 공중에 떠 있는 페이지·책(공개된 방명록 글)
  G.add(floaters.group);

  // 라운지 조명: 그림자 있는 천장 스포트 하나 + 받침의 방명록 쪽 보조광(장면 전체 조명 수를 늘리지 않게 둘만)
  const T = LAYOUT.table;
  const spot = new THREE.SpotLight('#FFF4DE', 16, 9, 0.95, 0.85, 1.3);
  spot.position.copy(L2W(new THREE.Vector3(T.x - 0.2, ROOM.h - 0.1, T.z + 1.2)));
  spot.target.position.copy(L2W(new THREE.Vector3(T.x + 0.2, 0.2, T.z - 0.4)));
  spot.castShadow = !coarse; spot.shadow.mapSize.set(1024, 1024); spot.shadow.radius = 5; spot.shadow.bias = -0.0006;
  const ledgeLight = new THREE.PointLight('#FFF3C2', 2.4, 4.5, 1.5);
  ledgeLight.position.copy(L2W(new THREE.Vector3(ROOM.x - 0.7, 1.9, LAYOUT.ledge.z)));
  scene.add(spot, spot.target, ledgeLight);

  /* ---------- 입구가 멀리서도 보이게: 빛나는 아치 테두리 + 반짝이는 빛 알갱이 + 문 안쪽의 따뜻한 빛 ---------- */
  const glow = new THREE.Group();
  {
    const R = door.R, leg = door.leg;
    const arc = (r) => { const s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(-r, leg); s.absarc(0, leg, r, Math.PI, 0, true); s.lineTo(r, 0); return s; };
    // 테두리 띠: 입구보다 6 cm 넓은 아치 − 입구 아치
    const band = new THREE.Shape(); band.moveTo(-R - 0.13, 0); band.lineTo(-R - 0.13, leg); band.absarc(0, leg, R + 0.13, Math.PI, 0, true); band.lineTo(R + 0.13, 0); band.lineTo(R + 0.005, 0); band.lineTo(R + 0.005, leg); band.absarc(0, leg, R + 0.005, 0, Math.PI, false); band.lineTo(-R - 0.13, 0);
    const bandMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE7A0').multiplyScalar(2.2), toneMapped: false });
    // 아치 둘레 벽에 번지는 금빛 후광(밝은 낮 벽에서도 보이게 가산이 아닌 보통 합성 · 진한 금빛)
    const hc = document.createElement('canvas'); hc.width = 256; hc.height = 256; const hx = hc.getContext('2d');
    const hg = hx.createRadialGradient(128, 150, 40, 128, 150, 128); hg.addColorStop(0, 'rgba(240,186,80,0.95)'); hg.addColorStop(0.55, 'rgba(240,186,80,0.45)'); hg.addColorStop(1, 'rgba(242,196,103,0)');
    hx.fillStyle = hg; hx.fillRect(0, 0, 256, 256);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry((R + 0.9) * 2, leg + R + 1.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hc), transparent: true, depthWrite: false, opacity: 0.8 }));
    halo.rotation.y = -Math.PI / 2; halo.position.set(4.196, (leg + R + 1.3) / 2 - 0.25, door.z);
    glow.add(halo);
    // 입구 앞 바닥에 쏟아지는 금빛(멀리서 바닥만 보여도 눈에 띄게)
    const fc = document.createElement('canvas'); fc.width = fc.height = 128; const fx = fc.getContext('2d');
    const fg = fx.createRadialGradient(64, 64, 4, 64, 64, 64); fg.addColorStop(0, 'rgba(240,186,80,0.7)'); fg.addColorStop(1, 'rgba(240,186,80,0)');
    fx.fillStyle = fg; fx.fillRect(0, 0, 128, 128);
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fc), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    spill.rotation.x = -Math.PI / 2; spill.position.set(3.55, 0.004, door.z);
    glow.add(spill);
    const rim = new THREE.Mesh(new THREE.ShapeGeometry(band, 48), bandMat);
    // 원래 방 쪽 벽면(x = 4.2)에 붙인다: 모양의 x = 장면 −z 방향이 되도록 −π/2 회전
    rim.rotation.y = -Math.PI / 2; rim.position.set(4.198, 0, door.z);
    glow.add(rim);
    // 문 안쪽 공기에 번지는 부드러운 빛(가산 합성 판 두 겹)
    const haze = new THREE.Mesh(new THREE.ShapeGeometry(arc(R), 48), new THREE.MeshBasicMaterial({ color: '#FFE9B0', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    haze.rotation.y = -Math.PI / 2; haze.position.set(4.3, 0, door.z);
    glow.add(haze);
    // 반짝이는 빛 알갱이(입구 둘레를 천천히 떠다닌다)
    const N = 70, pos = new Float32Array(N * 3), seed = [];
    for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI, r = R + 0.05 + Math.random() * 0.35; seed.push([a, r, Math.random() * 6.28, 0.4 + Math.random() * 0.8]); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,250,225,1)'); gr.addColorStop(0.25, 'rgba(255,230,150,0.8)'); gr.addColorStop(1, 'rgba(255,220,120,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
    const sparkMat = new THREE.PointsMaterial({ size: 0.16, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, color: '#FFD878', toneMapped: false });
    const sparks = new THREE.Points(pg, sparkMat); sparks.frustumCulled = false;
    glow.add(sparks);
    const doorLight = new THREE.PointLight('#FFE3A0', 5, 6, 1.4);
    doorLight.position.set(3.5, 1.6, door.z);
    glow.add(doorLight);
    glow.userData = { bandMat, haze, halo, sparks, seed, pos, doorLight, R, leg };
  }
  glow.traverse((o) => { o.userData.noPick = true; });
  // 2026-11-13: 문이 빛나면 비밀독서구역에 집중하기 어렵다는 의견 → 입구는 빛내지 않고, 라운지 안의 빈 페이지가 빛난다(아래 pageGlow)
  function updateGlow(t) {
    const u = glow.userData;
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
    u.bandMat.color.set('#FFE7A0').multiplyScalar(1.7 + pulse * 0.9);
    u.halo.material.opacity = 0.55 + pulse * 0.35;
    u.haze.material.opacity = 0.16 + pulse * 0.1;
    u.doorLight.intensity = 4 + pulse * 2;
    for (let i = 0; i < u.seed.length; i++) {
      const [a0, r, ph, sp] = u.seed[i];
      const a = a0 + Math.sin(t * 0.25 * sp + ph) * 0.15;
      const zz = Math.cos(a) * r, yy = u.leg + Math.sin(a) * r * 1.0 - (a < 0.25 || a > 2.9 ? Math.random() * 0 : 0);
      u.pos[i * 3] = 4.12 - Math.abs(Math.sin(t * 0.7 * sp + ph)) * 0.12;
      u.pos[i * 3 + 1] = Math.max(0.15, yy + Math.sin(t * sp + ph) * 0.05);
      u.pos[i * 3 + 2] = door.z + zz;
    }
    u.sparks.geometry.attributes.position.needsUpdate = true;
    u.sparks.material.opacity = 0.65 + 0.35 * Math.sin(t * 3.1);
  }

  /* ---------- 종이·책 텍스처 ---------- */
  const writeTex = makePageTexture(297 / 210);
  const page = buildPage(writeTex);
  G.add(page);
  const PAGE_TRAY = () => { const p = tray.localToWorld(new THREE.Vector3(0, 0.0195, 0.008)); return { pos: G.worldToLocal(p), ry: tray.rotation.y }; };
  // 앉은 의자 앞 책상 자리: 종이(0.62 m 앞)·펼친 책(0.82 m 앞). 위쪽이 앉은 사람의 앞(먼 쪽)을 향한다
  const RCc = LAYOUT.readChair, WCc = LAYOUT.writeChair;
  const fwdOf = (c) => new THREE.Vector2(Math.sin(c.ry), Math.cos(c.ry));
  const facing = (f) => Math.atan2(-f.x, -f.y);
  function deskAt(which, dist, dy, dry = 0) {
    const c = which === 'write' ? WCc : RCc, f = fwdOf(c);
    // 2026-11-13: 종이·책은 어느 의자에서든 책상 한가운데에 놓는다(모서리 X). 위쪽은 앉은 사람의 앞을 향한다
    return { pos: new THREE.Vector3(T.x, T.h + dy, T.z), ry: facing(f) + dry, f };
  }
  const PAGE_AT = (w) => deskAt(w, 0.62, 0.0007, 0.05);
  const BOOK_AT = (w) => deskAt(w, 0.84, 0.0035);
  const placePage = (p) => { page.position.copy(p.pos); page.rotation.set(0, p.ry, 0); };
  const pageGlow = buildPageGlow();
  G.add(pageGlow.group);
  placePage(PAGE_TRAY());
  const BOOK_LEDGE = { pos: book.position.clone(), ry: book.rotation.y };

  const BOOK_ASPECT = (BU.D - 0.03) / (BU.W - 0.03);
  const rightTex = makePageTexture(BOOK_ASPECT), leftTex = makePageTexture(BOOK_ASPECT), leafTex = makePageTexture(BOOK_ASPECT), leafBackTex = makePageTexture(BOOK_ASPECT);
  BU.rightMat.map = rightTex; BU.leftMat.map = leftTex; BU.leafFront.map = leafTex; BU.leafBack.map = leafBackTex;
  leftTex.center.set(0.5, 0.5); leftTex.rotation = Math.PI;
  leafBackTex.center.set(0.5, 0.5); leafBackTex.rotation = Math.PI;
  for (const t of [leftTex, leafBackTex]) t.draw({ ruled: false });

  /* ---------- 움직임 ---------- */
  const tweens = new Set();
  const tween = (sec, fn, ease = easeIO) => new Promise((res) => { tweens.add({ t0: performance.now(), dur: (reduced ? Math.min(sec, 0.15) : sec) * 1000, fn, ease, res }); });
  let camFly = null;
  function flyCamW(pos, look, fov, sec, ease = easeIO, path) {
    const p0 = camera.position.clone(), q0 = camera.quaternion.clone(), f0 = camera.fov;
    const m = new THREE.Matrix4().lookAt(pos, look, new THREE.Vector3(0, 1, 0));
    const q1 = new THREE.Quaternion().setFromRotationMatrix(m);
    camFly = true;
    return tween(sec, (k) => {
      camera.position.lerpVectors(p0, pos, k);
      if (path) path(k, camera.position);
      camera.quaternion.slerpQuaternions(q0, q1, k);
      camera.fov = f0 + (fov - f0) * k; camera.updateProjectionMatrix();
    }, ease).then(() => { camFly = null; });
  }
  const flyCam = (posL, lookL, fov, sec, ease, path) => flyCamW(L2W(posL), L2W(lookL), fov, sec, ease, path);
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
  const { wrap, q } = buildUI(root);
  // owns: 이 모듈이 카메라를 맡는 동안(앉음·쓰기·읽기·보내기)
  let mode = 'walk', busy = false, seat = null, owns = false, orbit = null;
  const look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, baseYaw: 0, fov: 56 };
  function setMode(m) {
    mode = m; owns = m !== 'walk';
    q('stand').hidden = m === 'walk';
    q('writer').hidden = m !== 'writing';
    q('reader').hidden = m !== 'reading';
    wrap.dataset.mode = m;
  }
  const RC = LAYOUT.readChair, WC = LAYOUT.writeChair;
  const chairOf = (w) => (w === 'write' ? WC : RC);
  const chairFwd = (c) => new THREE.Vector2(Math.sin(c.ry), Math.cos(c.ry));
  function seatPose(which) {
    const c = chairOf(which), f = chairFwd(c);
    const pos = new THREE.Vector3(c.x + f.x * 0.04, SIT_EYE, c.z + f.y * 0.04);
    const drop = 0.3;
    const lk = new THREE.Vector3(pos.x + f.x, pos.y - drop, pos.z + f.y);
    return { pos, look: lk, fov: isPortrait() ? 68 : 56 };
  }
  // 장면 좌표의 위치·바라볼 곳 → 시선 각
  function aim(posW, lookW) {
    const d = new THREE.Vector3().subVectors(lookW, posW);
    look.yaw = look.tYaw = look.baseYaw = Math.atan2(-d.x, -d.z);
    look.pitch = look.tPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  }

  async function sit(which) {
    if (busy) return;
    if (mode === 'writing') closeWriting();
    if (mode === 'reading') await closeBook(true);
    if (mode === 'seat' && seat === which) return;
    busy = true; rig.target = null;
    const c = chairOf(which), f = chairFwd(c), sp = seatPose(which);
    setMode('seat'); seat = which;
    const above = new THREE.Vector3(c.x - f.x * 0.12, EYE - 0.06, c.z - f.y * 0.12);
    await flyCam(above, new THREE.Vector3(above.x + f.x * 2, 0.95, above.z + f.y * 2), sp.fov, 1.15);
    await flyCam(sp.pos, sp.look, sp.fov, 1.0, easeIO, (k, p) => { p.y -= Math.sin(Math.PI * k) * 0.035; });
    aim(L2W(sp.pos), L2W(sp.look)); look.fov = sp.fov;
    busy = false;
  }
  // 아직 앉지 않았다면 가까운 의자에 먼저 앉는다
  function nearestSeat() {
    const p = W2L(camera.position);
    const d = (c) => Math.hypot(p.x - c.x, p.z - c.z);
    return d(WCc) <= d(RCc) ? 'write' : 'read';
  }
  // 일어나기: 앉은 자리에서 그대로 일어나 의자 뒤로 반 걸음(같은 방향) → 원래 방의 걷기로 돌아간다
  async function stand() {
    if (busy || mode === 'walk' || mode === 'sending') return;
    if (mode === 'writing') closeWriting();
    if (mode === 'reading') await closeBook(true);
    busy = true;
    const c = chairOf(seat), f = chairFwd(c);
    const pL = limitL(new THREE.Vector3(c.x - f.x * 0.62, 0, c.z - f.y * 0.62)); pL.y = rig.eye;
    const lkL = new THREE.Vector3(pL.x + f.x * 2.2, 0.85, pL.z + f.y * 2.2);
    await flyCam(pL, lkL, rig.fov * (rig.fovScaleIn || 1), 1.1, easeIO, (k, p) => { p.y += Math.sin(Math.PI * k) * 0.03; });
    handBack();
    seat = null; busy = false;
  }
  // 카메라를 원래 방의 리그에 지금 모습 그대로 넘긴다(튀지 않게)
  function handBack() {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    rig.pos.set(camera.position.x, rig.eye, camera.position.z);
    rig.yaw = rig.tYaw = Math.atan2(-fwd.x, -fwd.z);
    rig.pitch = rig.tPitch = Math.asin(clamp(fwd.y, -1, 1));
    rig.target = null;
    orbit = null;
    setMode('walk');
  }

  /* ---------- 쓰기 ---------- */
  const form = q('writer'), bodyIn = q('body'), nameIn = q('name');
  const val = () => form.querySelector('input[name="gbrIdentity"]:checked')?.value;
  function drawWritePage() {
    const id = val(), nm = id !== 'anonymous' && nameIn.value.trim() ? nameIn.value.trim() : '';
    writeTex.draw({ eyebrow: 'ONE PAGE', body: bodyIn.value, placeholder: '당신의 한 페이지를 남겨주세요.', name: nm || (id === 'anonymous' ? '익명' : ''), size: 62, minSize: 34 });
  }
  function syncForm() {
    const id = val();
    nameIn.hidden = id === 'anonymous';
    nameIn.placeholder = id === 'realname' ? '실명' : id === 'nickname' ? '닉네임' : '';
    q('showNameRow').hidden = id === 'anonymous' || !q('isPublic').checked;
    if (q('showNameRow').hidden) q('showName').checked = false;
    q('count').textContent = bodyIn.value.length;
    drawWritePage();
  }
  form.addEventListener('input', syncForm);
  form.addEventListener('change', syncForm);
  // 쓰기·읽기 궤도(라운지 로컬): 위에서 내려다보는 각도로 시작, 끌어서 돌려 보고 휠로 다가간다
  const orbitPosL = (o) => { const st = Math.sin(o.theta); return new THREE.Vector3(o.center.x + st * Math.sin(o.phi) * o.r, o.center.y + Math.cos(o.theta) * o.r, o.center.z + st * Math.cos(o.phi) * o.r); };
  function startOrbit(o) { o.tr = o.r; o.ttheta = o.theta; o.tphi = o.phi; orbit = o; return flyCam(orbitPosL(o), o.center, o.fov, o.sec ?? 1.4); }
  function writeOrbit() {
    const pd = PAGE_AT(seat), f = pd.f, c = pd.pos.clone();
    // 넓은 화면: 입력 카드를 피해 종이가 왼쪽에(앉은 사람의 오른쪽으로 중심을 민다) · 세로 화면: 종이가 위쪽에
    const fov = narrow() ? 60 : 42;
    // 2026-11-13: 종이 한가운데 바로 위에서 본다. 넓은 화면은 오른쪽 입력 카드에 가리지 않을 만큼, 좁은 화면은 아래 입력 칸 위쪽에 들어오게
    // 좁은 화면: 위 단추 줄(약 110px)과 아래 입력 칸 사이, 실제로 보이는 빈 곳의 한가운데에 종이를 꽉 차게 둔다
    let r;
    if (narrow()) {
      const sb = q('stand')?.getBoundingClientRect(), H = innerHeight, top = sb && sb.height ? sb.bottom + 10 : 110, fr = q('writer').getBoundingClientRect(), bottom = (fr.height ? fr.top : H * 0.5) - 14;
      const vis = Math.max(0.2, (bottom - top) / H), cy = (top + bottom) / 2 / H;
      r = fitR(0.23, 0.33, fov, vis * 0.94, 0.92);
      const sh = (0.5 - cy) * 2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2) * r; c.add(new THREE.Vector3(-f.x * sh, 0, -f.y * sh));
    } else r = fitR(0.23, 0.33, fov, 0.74, Math.min(1, Math.max(0.36, (innerWidth - 2 * 440) / innerWidth)));
    const ph = Math.atan2(-f.x, -f.y);
    return { center: c, r, theta: 0.1, phi: ph, fov, min: 0.25, max: Math.max(0.9, r * 1.4), thMin: 0.05, thMax: 0.75, phiMin: ph - 0.6, phiMax: ph + 0.6 };
  }
  let pageAtDesk = false, pageSeat = null;
  async function returnPage() {   // 다른 의자에서 쓰거나 책을 펼칠 때: 책상 위 종이를 트레이로 되돌린다(쓰던 글은 입력 칸에 그대로)
    if (!pageAtDesk) return;
    await fly(page, { pos: page.position.clone(), ry: page.rotation.y }, PAGE_TRAY(), 0.9, 0.05);
    pageAtDesk = false; pageSeat = null;
  }
  async function openWriting() {
    if (busy) return;
    if (mode === 'reading') await closeBook(true);
    if (mode !== 'seat') await sit(nearestSeat());
    busy = true;
    if (pageAtDesk && pageSeat !== seat) await returnPage();
    setMode('writing'); syncForm();
    const camGo = startOrbit({ ...writeOrbit(), sec: 1.5 });
    if (!pageAtDesk) { await fly(page, PAGE_TRAY(), PAGE_AT(seat), 1.3, 0.05); pageAtDesk = true; pageSeat = seat; }
    await camGo;
    busy = false;
    if (!narrow()) bodyIn.focus({ preventScroll: true });
  }
  function closeWriting() { q('err').textContent = ''; orbit = null; setMode('seat'); }
  async function backToSeat() {
    if (busy) return;
    busy = true;
    if (mode === 'writing') closeWriting();
    const sp = seatPose(seat);
    await flyCam(sp.pos, sp.look, sp.fov, 1.2);
    aim(L2W(sp.pos), L2W(sp.look)); look.fov = sp.fov;
    busy = false;
  }

  let backend = null, pages = [], level = 0;
  const openedAt = Date.now();
  function setLevel(lv, bump) {
    level = Math.max(0, Math.min(12, lv | 0));
    BU.setLevel(level);
    if (bump) { const s = book.scale.y; tween(0.5, (k) => { book.scale.y = s * (1 + Math.sin(Math.PI * k) * 0.06); }); }
  }
  async function refresh() {
    try {
      const d = await backend.publicPages(); pages = d.pages || []; floaters.setPages(pages);
      if (d.trace) { setLevel(d.trace.leaves || 0); traces.setLevel(Math.max(d.trace.visits || 0, d.trace.leaves || 0)); }
    } catch (e) { /* 그대로 */ }
  }
  getBackend().then((b) => { backend = b; if (b) refresh(); });
  let toastTimer;
  const toast = (msg) => { const t = q('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 4200); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    q('err').textContent = '';
    const text = bodyIn.value.trim();
    if (text.length < 2) { q('err').textContent = ERR.too_short; bodyIn.focus(); return; }
    const identity = val(), name = identity === 'anonymous' ? '' : nameIn.value.trim();
    if (identity !== 'anonymous' && !name) { q('err').textContent = identity === 'realname' ? '실명을 적거나 익명을 골라 주세요.' : '닉네임을 적거나 익명을 골라 주세요.'; nameIn.focus(); return; }
    const visibility = q('isPublic').checked ? 'public' : 'private';
    busy = true; q('submit').disabled = true;
    try {
      let res = null;
      // 서버가 저장을 확인한 뒤에만 종이가 책으로 간다(실패하면 글과 종이를 그대로 둔다)
      if (backend) res = await backend.submit({ vk: visitorKey(), body: text, identity, name, showName: q('showName').checked, visibility, website: q('website').value, elapsed: Date.now() - openedAt });
      q('writer').hidden = true;
      await sendPage();
      if (res?.page) { pages = [res.page, ...pages.filter((p) => p.id !== res.page.id)]; floaters.setPages(pages); }
      bodyIn.value = ''; nameIn.value = ''; q('isPublic').checked = false; q('showName').checked = false;
      form.querySelector('input[name="gbrIdentity"][value="anonymous"]').checked = true;
      syncForm();
      toast(!backend ? '미리보기라 이 페이지는 저장되지 않았습니다' : visibility === 'public' ? '방명록에 담겼습니다 · 다른 방문객도 펼쳐 읽을 수 있습니다' : '방명록에 담겼습니다 · 관리자만 읽을 수 있습니다');
      if (backend) refresh();
    } catch (ex) {
      q('err').textContent = ERR[ex.code] || '지금은 페이지를 담지 못했습니다. 잠시 후 다시 시도해 주세요.';
    } finally { busy = false; q('submit').disabled = false; }
  });

  // 저장이 확인된 종이: 들려 → 받침의 방명록으로 날아가 → 표지가 열리고 → 끼워지고 → 닫힌다
  async function sendPage() {
    setMode('sending'); orbit = null;
    const vp = isPortrait() ? { pos: [0.2, 1.75, -1.0], look: [1.6, 0.72, -3.0], fov: 64 } : { pos: [-0.75, 1.8, -0.85], look: [1.4, 0.72, -3.05], fov: 50 };
    const camGo = flyCam(new THREE.Vector3(...vp.pos), new THREE.Vector3(...vp.look), vp.fov, 1.2);
    const from = { pos: page.position.clone(), ry: page.rotation.y };
    const up = { pos: from.pos.clone().add(new THREE.Vector3(0, 0.22, 0)), ry: from.ry };
    await fly(page, from, up, 0.6, 0, (k) => { page.rotation.x = -0.35 * k; });
    const top = book.localToWorld(new THREE.Vector3(0.02, BU.top + 0.003, 0)); G.worldToLocal(top);
    const above = { pos: top.clone().add(new THREE.Vector3(0, 0.16, 0)), ry: book.rotation.y };
    const coverOpen = tween(0.8, (k) => { BU.hinge.rotation.z = Math.PI * 0.94 * k; }, easeOut);
    await fly(page, up, above, 1.0, 0.28, (k) => { page.rotation.x = -0.35 * (1 - k) + Math.sin(Math.PI * k) * 0.25; page.rotation.z = Math.sin(Math.PI * k) * -0.18; });
    await coverOpen; await camGo;
    await fly(page, above, { pos: top, ry: above.ry }, 0.5, 0, () => { page.rotation.x = 0; page.rotation.z = 0; });
    page.visible = false;
    setLevel(level + 1, true);
    const mine = traces.addMine();
    if (mine) { const s = mine.userData.s; tween(0.8, (k) => mine.scale.set(s * k, s * k, 0.12), easeOut); }
    await tween(0.7, (k) => { BU.hinge.rotation.z = Math.PI * 0.94 * (1 - k); });
    pageAtDesk = false; pageSeat = null; placePage(PAGE_TRAY());
    writeTex.draw({ eyebrow: 'ONE PAGE', placeholder: '당신의 한 페이지를 남겨주세요.', name: '익명', size: 62, minSize: 34 });
    page.visible = true;
    setMode('seat');
    const sp = seatPose(seat);
    await flyCam(sp.pos, sp.look, sp.fov, 1.3);
    aim(L2W(sp.pos), L2W(sp.look)); look.fov = sp.fov;
  }

  /* ---------- 읽기 ---------- */
  let idx = 0, bookOut = false;
  const drawP = (tex, p, i) => tex.draw({ eyebrow: 'ONE PAGE', body: p.body, name: p.name || '익명', foot: `${i + 1} / ${pages.length}`, size: 46 });
  function drawSpread() {
    if (!pages.length) {
      rightTex.draw({ eyebrow: 'GUESTBOOK', placeholder: '아직 펼쳐 볼 수 있는 페이지가 없습니다.', ruled: false, size: 50 });
      q('rpos').textContent = '0 / 0'; q('readText').textContent = '아직 펼쳐 볼 수 있는 페이지가 없습니다.';
    } else {
      const p = pages[idx]; drawP(rightTex, p, idx);
      q('rpos').textContent = `${idx + 1} / ${pages.length}`; q('readText').textContent = `${p.name || '익명'}: ${p.body}`;
    }
    q('prev').disabled = idx <= 0; q('next').disabled = idx >= pages.length - 1;
  }
  function readOrbit() {
    const bd = BOOK_AT(seat);
    const spine = new THREE.Vector3(-BU.W / 2, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), bd.ry);
    const P = isPortrait(), ph = Math.atan2(-bd.f.x, -bd.f.y);
    return { center: (P ? bd.pos.clone() : bd.pos.clone().add(spine)).add(new THREE.Vector3(0, 0.02, 0)), r: P ? fitR(0.29, 0.38, 58, 0.8) : fitR(0.58, 0.38, 44, 0.8), theta: 0.1,   /* 2026-11-13: 펼친 책 한가운데 바로 위, 화면에 꼭 맞게 */ phi: ph, fov: P ? 58 : 44,
      min: 0.28, max: 1.6, thMin: 0.05, thMax: 1.0, phiMin: ph - 0.7, phiMax: ph + 0.7 };
  }
  async function openBook() {
    if (busy) return;
    if (mode === 'writing') closeWriting();
    if (mode !== 'seat') await sit(nearestSeat());
    busy = true;
    if (pageAtDesk) await returnPage();
    setMode('reading');
    idx = 0; drawSpread();
    const camGo = startOrbit({ ...readOrbit(), sec: 1.8 });
    await fly(book, BOOK_LEDGE, BOOK_AT(seat), 1.6, 0.3);
    bookOut = true;
    await tween(1.2, (k) => { BU.hinge.rotation.z = Math.PI * 0.985 * k; });
    await camGo;
    busy = false;
  }
  async function closeBook(quiet) {
    if (!bookOut) return;
    busy = true; orbit = null;
    const sp = seatPose(seat);
    const camGo = quiet ? null : flyCam(sp.pos, sp.look, sp.fov, 1.6);
    await tween(0.9, (k) => { BU.hinge.rotation.z = Math.PI * 0.985 * (1 - k); });
    await fly(book, { pos: book.position.clone(), ry: book.rotation.y }, BOOK_LEDGE, 1.3, 0.28);
    await camGo;
    if (!quiet) { aim(L2W(sp.pos), L2W(sp.look)); look.fov = sp.fov; }
    bookOut = false;
    setMode('seat');
    busy = false;
  }
  async function turn(dir) {
    if (busy || mode !== 'reading') return;
    const j = idx + dir;
    if (j < 0 || j >= pages.length) return;
    busy = true;
    const lh = BU.leafHinge; lh.visible = true;
    if (dir > 0) { drawP(leafTex, pages[idx], idx); idx = j; drawSpread(); await tween(0.95, (k) => { lh.rotation.z = Math.PI * 0.985 * k; }); }
    else { drawP(leafTex, pages[j], j); lh.rotation.z = Math.PI * 0.985; await tween(0.95, (k) => { lh.rotation.z = Math.PI * 0.985 * (1 - k); }); idx = j; drawSpread(); }
    lh.visible = false; lh.rotation.z = 0;
    busy = false;
  }
  q('prev').addEventListener('click', () => turn(-1));
  q('next').addEventListener('click', () => turn(1));
  q('closeBook').addEventListener('click', () => { if (!busy) closeBook(); });
  q('stand').addEventListener('click', () => stand());
  wrap.querySelector('[data-k="spots"]').addEventListener('click', (e) => { if (e.target.closest('button[data-go]')) sit(nearestSeat()); });
  q('seatActs').addEventListener('click', (e) => { const b = e.target.closest('button[data-go]'); if (b) (b.dataset.go === 'read' ? openBook() : openWriting()); });

  /* ---------- 고르기 ---------- */
  const PICK = new Map();
  const tag = (obj, key) => obj.traverse((o) => { if (o.isMesh) PICK.set(o, key); });
  tag(writeChair, 'writeChair'); tag(readChair, 'readChair'); tag(tray, 'tray'); tag(page, 'page'); tag(book, 'book');
  function act(key) {
    if (busy) return;
    if (key === 'writeChair') return sit('write');
    if (key === 'readChair') return sit('read');
    if (key === 'tray' || key === 'page') return mode === 'writing' ? null : openWriting();
    if (key === 'book') return mode === 'reading' ? null : openBook();
  }

  /* ---------- 걷기 범위(라운지 로컬) ---------- */
  const R = 0.26, D = LAYOUT.door;
  const CHAIRS = [[WC.x, WC.z, 0.46], [RC.x, RC.z, 0.46]];
  function limitL(p) {
    const inDoor = p.x > D.x - D.R + 0.3 && p.x < D.x + D.R - 0.3;
    p.x = clamp(p.x, -ROOM.x + 0.3, ROOM.x - 0.3);
    // 통로를 지나 원래 방 쪽까지(로컬 z가 뒷벽 바깥면보다 0.5 m 더) 걸어갈 수 있다
    p.z = clamp(p.z, inDoor ? ROOM.z1 - ROOM.wt - GAP - 0.6 : ROOM.z1 + 0.35, ROOM.z0 - 0.35);
    if (p.z < ROOM.z1 + 0.3) p.x = clamp(p.x, D.x - D.R + 0.3, D.x + D.R - 0.3);
    const x0 = T.x - T.w / 2, x1 = T.x + T.w / 2, z0 = T.z - T.d / 2, z1 = T.z + T.d / 2;
    if (p.x > x0 - R && p.x < x1 + R && p.z > z0 - R && p.z < z1 + R) {
      const d = [p.x - (x0 - R), (x1 + R) - p.x, p.z - (z0 - R), (z1 + R) - p.z];
      const k = d.indexOf(Math.min(...d));
      if (k === 0) p.x = x0 - R; else if (k === 1) p.x = x1 + R; else if (k === 2) p.z = z0 - R; else p.z = z1 + R;
    }
    for (const [cx, cz, cr] of CHAIRS) {
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz), m = cr + R * 0.6;
      if (d < m) { const k = m / Math.max(d, 1e-4); p.x = cx + dx * k; p.z = cz + dz * k; }
    }
    return p;
  }
  // 장면 좌표의 점이 라운지 쪽(입구 띠 또는 방 안)인가
  const inLounge = (pW) => pW.x > 4.2 + 0.001 || (pW.x > 3.55 && Math.abs(pW.z - door.z) < door.R - 0.3);
  const insideRoom = (pW) => pW.x > 4.45;
  function limitW(pW) {
    const l = limitL(W2L(new THREE.Vector3(pW.x, 0, pW.z)));
    const w = L2W(l);
    pW.x = w.x; pW.z = w.z;
    return pW;
  }
  // 방명록 지점(관람 지점 '방명록'): 라운지 안, 입구에서 몇 걸음 들어와 책상과 벽감을 보는 자리
  const STATION = { pos: L2W(new THREE.Vector3(-1.8, 0, -0.45)), look: L2W(new THREE.Vector3(0.35, 0.72, -3.6)), lens: { eye: 1.62, fov: 46, pfov: 60 }, doorIn: L2W(new THREE.Vector3(D.x, 0, ROOM.z1 + 0.6)), doorOut: new THREE.Vector3(3.55, 0, door.z) };

  /* ---------- 원래 방에서 넘겨주는 입력 ---------- */
  let drag = null;
  function pointerDown(e) { drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false }; }
  function pointerMove(e) {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
    const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly; drag.lx = e.clientX; drag.ly = e.clientY;
    if (!drag.moved || busy || camFly) return;
    if (orbit) {
      orbit.tphi = clamp(orbit.tphi - dx * 0.005, orbit.phiMin, orbit.phiMax);
      orbit.ttheta = clamp(orbit.ttheta - dy * 0.004, orbit.thMin, orbit.thMax);
    } else if (mode === 'seat') {
      // 2026-11-14: 앉아서 둘러볼 때도 크게 휙 돌지 않게 — 감도를 낮추고 위아래는 눈높이 근처로만
      look.tYaw = look.baseYaw + clamp(wrapPi(look.tYaw - dx * 0.0015 - look.baseYaw), -1.0, 1.0);
      look.tPitch = clamp(look.tPitch - dy * 0.0012, -0.3, 0.12);
    }
  }
  // 떼었을 때: 끌기가 아니었으면 true(=클릭으로 처리할 것)
  function pointerUp() { const d = drag; drag = null; return !!d && !d.moved; }
  function wheel(dir) {   // dir > 0 = 뒤로/멀어지기
    if (busy || camFly) return;
    if (orbit) {
      if (dir > 0 && orbit.tr >= orbit.max - 1e-3) { if (mode === 'reading') closeBook(); else backToSeat(); return; }
      orbit.tr = clamp(orbit.tr * (dir > 0 ? 1.14 : 1 / 1.14), orbit.min, orbit.max);
      return;
    }
    if (mode === 'seat' && dir > 0) stand();
  }
  function escape() { if (mode === 'reading') closeBook(); else if (mode === 'writing') backToSeat(); else if (mode === 'seat') stand(); }
  function keydown(e) {
    if (e.target.closest?.('input,textarea')) return true;
    if (!owns) return false;
    if (e.key === 'Escape') { escape(); return true; }
    if (mode === 'reading' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { turn(e.key === 'ArrowRight' ? 1 : -1); return true; }
    return true;   // 앉아 있는 동안 방향키로 걷지 않는다
  }

  /* ---------- 매 프레임 ---------- */
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  function update(dt, t, now) {
    for (const tw of tweens) {
      const k = Math.min(1, (now - tw.t0) / tw.dur);
      tw.fn(tw.ease(Math.max(0, k)));
      if (k >= 1) { tweens.delete(tw); tw.res(); }
    }
    if (!reduced) floaters.update(t);
    pageGlow.update(t, page, page.visible && !pageAtDesk && (mode === 'walk' || mode === 'seat'));
    // 라운지 안에 서 있을 때만 '쓰는 자리·읽는 자리' 단추를 보인다
    q('spots').hidden = !(mode === 'walk' && insideRoom(camera.position));
    q('seatActs').hidden = !(mode === 'seat' && !busy);
    if (!owns || camFly) return;
    if (orbit) {
      const a = 1 - Math.exp(-5 * dt);
      const ad = 1 - Math.exp(-18 * dt);   // 2026-11-14: 끄는 각도는 짧게 부드럽게(뚝뚝 끊기지 않고, 멈추면 곧 멈춤)
      orbit.r += (orbit.tr - orbit.r) * a; orbit.theta += (orbit.ttheta - orbit.theta) * ad; orbit.phi += (orbit.tphi - orbit.phi) * ad;
      camera.position.copy(L2W(orbitPosL(orbit))); camera.lookAt(L2W(orbit.center));
      if (Math.abs(camera.fov - orbit.fov) > 1e-3) { camera.fov = orbit.fov; camera.updateProjectionMatrix(); }
    } else if (mode === 'seat') {
      const k = 1 - Math.exp(-8 * dt);   // 2026-11-14: 끈 만큼 부드럽게 따라가고, 멈추면 곧 멈춤
      look.yaw += (look.tYaw - look.yaw) * k; look.pitch += (look.tPitch - look.pitch) * k;
      euler.set(look.pitch, look.yaw, 0); camera.quaternion.setFromEuler(euler);
      if (Math.abs(camera.fov - look.fov) > 1e-3) { camera.fov = look.fov; camera.updateProjectionMatrix(); }
    }
  }
  const pickKey = (obj) => PICK.get(obj) ?? null;

  return {
    group: G, glow, floor: world.floor, isFloor: (o) => o === world.floor || o === tunnelFloor, pickExtra, lights: [spot, ledgeLight, pageGlow.light], station: STATION,
    get owns() { return owns; }, get mode() { return mode; }, get busy() { return busy; },
    pickKey, act, label: (k) => LABEL[k], inLounge, insideRoom, limitW, update, pointerDown, pointerMove, pointerUp, wheel, escape, keydown,
    sit, stand, openBook, openWriting, get pages() { return pages; }, set pages(v) { pages = v; }, book, page, traces, setLevel,
  };
}
