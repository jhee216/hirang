// HIRANG GUESTBOOK — 읽고 쓰는 라운지(비밀독서구역 바로 옆방).
// 같은 건물: 같은 회벽·마루·모스 징두리·천장 코브·빛. 다른 쓰임: 책장 대신 아치 의자·글쓰기 책상·모이는 방명록.
// 모든 아치는 하이랑 심볼의 비례에서 온다(넓고 낮은 반원 + 짧은 다리, 띠 두께 = 반지름의 0.4).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { woodFloor, plasterBump, contactShadowTexture } from '../../experience/js/textures.js';
import { sharedMat } from '../../experience/js/mat-cache.js';

export const C = {
  moss: '#4F5F4C', mossSide: '#5B6B56', mossDark: '#3F4D3C',
  ivory: '#FFF9EA', lavender: '#C1B1D1', lavenderBack: '#CDBFDD', yellow: '#FDF9C6',
  pad: '#F3E9D4', paper: '#FBF6EA',
};
const mat = (c, r = 0.9, x = {}) => sharedMat(c, r, x);

// 방: 폭 6 m(x −3..3), 깊이 5.6 m(z 0..−5.6), 높이 3.2 m. 뒷벽 너머가 원래 비밀독서구역
export const ROOM = { x: 2.6, z0: 0, z1: -5.6, h: 3.2, wt: 0.24 };
// 가구 배치(m). 책상이 중심. 쓰는 의자는 책상 긴 변 뒤에서 앞(+z)을 보고, 읽는 의자는 책상 오른쪽 끝에서 비스듬히
export const LAYOUT = {
  table: { x: -0.4, z: -3.15, w: 1.3, d: 0.72, h: 0.74 },
  writeChair: { x: -0.4, z: -3.92, ry: 0 },             // 정면(+z)이 책상
  readChair: { x: 0.82, z: -3.06, ry: -Math.PI / 2 + 0.26 },   // 책상 오른쪽 끝에서 책상을 향해, 방 쪽으로 살짝 돌아앉음
  door: { x: 1.45, R: 0.92, leg: 1.3 },                  // 뒷벽 통로(옛 방으로)
  alcove: { x: -0.4, R: 0.86, leg: 0.72, y: 0, depth: 0.26 },   // 쓰는 의자 뒤 라벤더 벽감
  niche: { x: -0.4, R: 0.4, y: 1.9, depth: 0.16 },       // 로고 반원 벽감(라벤더 벽감 위)
  ledge: { z: -2.9, R: 0.78, leg: 0.5, y: 0.62, depth: 0.42 },   // 오른쪽 벽 방명록 받침
};

let contactTex;
function contact(w, d, op = 0.85) {
  contactTex ||= contactShadowTexture();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false, opacity: op }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.003; m.renderOrder = 1;
  return m;
}
const sh = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };

/* ---------- 하이랑 아치 ---------- */
// 꽉 찬 아치(벽감·통로 구멍): 폭 2R, 다리 leg, 반원 꼭대기
export function archSolid(R, leg, cx = 0, y0 = 0, seg = 48) {
  const s = new THREE.Shape();
  s.moveTo(cx - R, y0); s.lineTo(cx + R, y0); s.lineTo(cx + R, y0 + leg);
  s.absarc(cx, y0 + leg, R, 0, Math.PI, false);
  s.lineTo(cx - R, y0);
  return s;
}
// 아치 띠(심볼의 한 봉우리): 바깥 반지름 R, 띠 두께 T(심볼 기준 0.4R), 다리 leg
export function archBand(R, leg, T = R * 0.4) {
  const s = new THREE.Shape(), r = R - T;
  s.moveTo(-R, 0); s.lineTo(-R, leg);
  s.absarc(0, leg, R, Math.PI, 0, true);
  s.lineTo(R, 0); s.lineTo(r, 0); s.lineTo(r, leg);
  s.absarc(0, leg, r, 0, Math.PI, false);
  s.lineTo(-r, 0); s.lineTo(-R, 0);
  return s;
}
const extrude = (shape, depth, bevel = 0.012, seg = 40) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: seg });
  g.translate(0, 0, -depth / 2 + bevel);
  return g;
};

/* ---------- 벽 ---------- */
// 벽 한 장: 길이 L(로컬 x 0..L), 높이 H, 두께 wt(로컬 z 0..−wt). 바닥까지 뚫린 통로(doors)는 외곽선 홈으로, 벽감·창은 구멍으로
function wallPiece(L, H, wt, { doors = [], holes = [] }, wallMat, revealMat) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  for (const d of [...doors].sort((a, b) => a.x - b.x)) {
    s.lineTo(d.x - d.R, 0); s.lineTo(d.x - d.R, d.leg);
    s.absarc(d.x, d.leg, d.R, Math.PI, 0, true);
    s.lineTo(d.x + d.R, 0);
  }
  s.lineTo(L, 0); s.lineTo(L, H); s.lineTo(0, H); s.lineTo(0, 0);
  for (const h of holes) s.holes.push(archSolid(h.R, h.leg, h.x, h.y));
  const g = new THREE.ExtrudeGeometry(s, { depth: wt, bevelEnabled: false, curveSegments: 56 });
  g.translate(0, 0, -wt);
  return sh(new THREE.Mesh(g, [wallMat, revealMat]));
}

// 벽감(벽 구멍 뒤의 실제 깊이): 안쪽 옆면 + 뒷면
function recess(R, leg, depth, sideMat, backMat) {
  const g = new THREE.Group();
  const s = archSolid(R, leg);
  const sides = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 56 });
  sides.translate(0, 0, -depth);
  const inv = new THREE.MeshBasicMaterial({ visible: false });
  g.add(sh(new THREE.Mesh(sides, [inv, sideMat]), false));
  const back = new THREE.Mesh(new THREE.ShapeGeometry(s, 56), backMat);
  back.position.z = -depth + 0.001; back.receiveShadow = true;
  g.add(back);
  return g;
}

// 모스 징두리(아래 1 m) + 아이보리 몰딩 + 어두운 걸레받이 — 원래 방과 같은 치수. 통로·벽감 자리는 비운다
function wainscot(group, L, gaps, place) {
  const WH = 1.0;
  const wain = mat(C.moss, 0.7, { bumpMap: plasterBump(6, 1), bumpScale: 0.2 }), rail = mat('#F4EAD3', 0.6), base = mat(C.mossDark, 0.6);
  const runs = []; let a = 0;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > a) runs.push([a, g0]); a = Math.max(a, g1); }
  if (a < L) runs.push([a, L]);
  for (const [r0, r1] of runs) {
    const w = r1 - r0, cx = (r0 + r1) / 2;
    const p = sh(new THREE.Mesh(new THREE.BoxGeometry(w, WH, 0.03), wain)); p.position.set(cx, WH / 2, 0.015);
    const rl = sh(new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.05), rail)); rl.position.set(cx, WH + 0.02, 0.025);
    const b = sh(new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.045), base)); b.position.set(cx, 0.05, 0.03);
    const g = new THREE.Group(); g.add(p, rl, b); place(g); group.add(g);
  }
}

/* ---------- 가구 ---------- */
// 시안(lounge-3·4)의 아기자기한 형태: 두껍고 모서리가 둥근 모스 아치 띠, 통통한 아이보리 쿠션.
// 의자: 옆판 = 옆에서 보이는 낮고 넓은 아치(두꺼운 띠), 등받이 = 앞에서 보이는 아치 띠, 좌판 = 초록 받침 위 둥근 쿠션(좌면 0.44 m). 앞쪽이 +z
export function buildChair() {
  const g = new THREE.Group();
  const green = [mat(C.moss, 0.86), mat(C.mossSide, 0.86)], pad = mat(C.pad, 0.95);
  const W = 0.8, D = 0.72, SEAT = 0.44;
  // 팔걸이(옆판): 띠 두께 0.15 m · 판 두께 0.13 m · 큰 둥근 모서리
  const armR = D / 2, armLeg = 0.24, armT = 0.15, armTh = 0.13;
  for (const s of [-1, 1]) {
    const arm = sh(new THREE.Mesh(extrude(archBand(armR, armLeg, armT), armTh, 0.04), green));
    arm.rotation.y = Math.PI / 2;
    arm.position.set(s * (W / 2 - armTh / 2), 0, 0);
    g.add(arm);
  }
  // 좌판 받침(초록 덩어리) + 통통한 쿠션
  const inner = W - armTh * 2;
  const base = sh(new THREE.Mesh(new RoundedBoxGeometry(inner + 0.02, 0.26, D - 0.1, 4, 0.045), green[0]));
  base.position.set(0, 0.13 + 0.04, 0.0);
  const cushion = sh(new THREE.Mesh(new RoundedBoxGeometry(inner - 0.01, 0.11, D - 0.14, 6, 0.05), pad));
  cushion.position.set(0, SEAT - 0.055, 0.02);
  g.add(base, cushion);
  // 등받이: 두꺼운 아치 띠(앞에서 보이는 심볼 봉우리), 살짝 뒤로 눕힘. 안쪽은 아이보리 등쿠션
  const back = new THREE.Group();
  back.position.set(0, 0, -D / 2 + 0.07);
  back.rotation.x = -0.12;
  const bR = W / 2, bLeg = 0.3, bT = 0.15;
  back.add(sh(new THREE.Mesh(extrude(archBand(bR, bLeg, bT), 0.14, 0.045), green)));
  const r = bR - bT;
  const ps = new THREE.Shape();
  ps.moveTo(-r, SEAT); ps.lineTo(r, SEAT); ps.lineTo(r, bLeg); ps.absarc(0, bLeg, r, 0, Math.PI, false); ps.lineTo(-r, SEAT);
  const backPad = sh(new THREE.Mesh(extrude(ps, 0.08, 0.035), pad));
  backPad.position.z = 0.02;
  back.add(backPad);
  g.add(back);
  const cs = contact(1.15, 1.05, 0.8); g.add(cs);
  return g;
}

// 글쓰기 책상: 두툼한 아이보리 상판(둥근 모서리) + 앞에서 보이는 하나의 두꺼운 모스 아치 받침(낮고 넓은 심볼 비례)
export function buildTable() {
  const { w, d, h } = LAYOUT.table;
  const g = new THREE.Group();
  const TT = 0.06;
  const top = sh(new THREE.Mesh(new RoundedBoxGeometry(w, TT, d, 6, 0.028), mat('#F7EEDA', 0.86)));
  top.position.y = h - TT / 2;
  g.add(top);
  const green = [mat(C.moss, 0.86), mat(C.mossSide, 0.86)];
  const R = 0.46, leg = h - TT - R, T = 0.13;
  const baseArch = sh(new THREE.Mesh(extrude(archBand(R, leg, T), 0.22, 0.04), green));
  g.add(baseArch);
  const cs = contact(w + 0.5, d + 0.45, 0.6); g.add(cs);
  return g;
}

// 종이 받침(얕은 트레이)과 빈 종이 묶음. 맨 위 한 장이 집어 드는 페이지
export function buildTray() {
  const g = new THREE.Group();
  const W = 0.27, D = 0.36, H = 0.022;
  const tm = mat(C.moss, 0.8);
  const base = sh(new THREE.Mesh(new RoundedBoxGeometry(W, 0.008, D, 2, 0.003), tm)); base.position.y = 0.004;
  g.add(base);
  for (const [x, z, w, d] of [[-W / 2 + 0.004, 0, 0.008, D], [W / 2 - 0.004, 0, 0.008, D], [0, -D / 2 + 0.004, W, 0.008]]) {
    const r = sh(new THREE.Mesh(new RoundedBoxGeometry(w, H, d, 2, 0.003), tm)); r.position.set(x, H / 2, z); g.add(r);
  }
  const stack = sh(new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.01, 0.297), mat('#F6EEDC', 0.95)));
  stack.position.set(0, 0.013, 0.008);
  g.add(stack);
  return g;
}

// 한 장의 페이지(A4 비율 0.21×0.297, 두께 있는 종이). 앞면은 캔버스 텍스처로 바꿀 수 있다
export function buildPage(faceTex = null) {
  const geo = new THREE.BoxGeometry(0.21, 0.0012, 0.297);
  const edge = mat('#EFE6D2', 0.95);
  const face = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.95, map: faceTex });
  const m = sh(new THREE.Mesh(geo, [edge, edge, face, edge, edge, edge]));
  m.userData.face = face;
  return m;
}

// 모이는 방명록: 라벤더 표지 · 모스 책등 · 아이보리 종이 덩어리. 앞표지는 책등 쪽 경첩으로 열린다
// 로컬: 책등이 −x, 표지 앞면이 +y(눕혀 놓은 상태)
export function buildGuestbook() {
  const g = new THREE.Group();
  const W = 0.36, D = 0.48, CT = 0.008;
  const cover = mat(C.lavender, 0.82), spineM = mat(C.moss, 0.8), paper = mat('#F4ECDA', 0.95);
  const back = sh(new THREE.Mesh(new RoundedBoxGeometry(W, CT, D, 2, 0.002), cover));
  g.add(back);
  const block = sh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.012, 1, D - 0.014), paper));
  block.position.x = 0.002;
  g.add(block);
  const spine = sh(new THREE.Mesh(new RoundedBoxGeometry(0.016, 1, D, 2, 0.004), spineM));
  spine.position.x = -W / 2 + 0.002;
  g.add(spine);
  const hinge = new THREE.Group();
  hinge.position.x = -W / 2 + 0.008;
  const front = sh(new THREE.Mesh(new RoundedBoxGeometry(W - 0.004, CT, D, 2, 0.002), cover));
  front.position.x = (W - 0.004) / 2 - 0.004;
  hinge.add(front);
  // 표지의 작은 모스 띠(장식은 하나만)
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.0006, D - 0.001), spineM);
  band.position.set(0.035, CT / 2 + 0.0003, 0); hinge.add(band);
  g.add(hinge);
  // 펼쳤을 때 보이는 두 면: 오른쪽 = 종이 덩어리 윗면, 왼쪽 = 앞표지 안쪽(표지가 180° 넘어가면 위를 본다)
  const pageGeo = new THREE.PlaneGeometry(W - 0.03, D - 0.03);
  const rightMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.95 });
  const leftMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.95 });
  const rightPage = new THREE.Mesh(pageGeo, rightMat); rightPage.rotation.x = -Math.PI / 2; rightPage.position.x = 0.004; rightPage.receiveShadow = true;
  const leftPage = new THREE.Mesh(pageGeo, leftMat); leftPage.rotation.x = Math.PI / 2; leftPage.position.set((W - 0.004) / 2 - 0.004, -CT / 2 - 0.0006, 0); leftPage.receiveShadow = true;
  hinge.add(leftPage);
  g.add(rightPage);
  // 넘기는 한 장(오른쪽 → 왼쪽): 책등 경첩에 붙은 얇은 종이
  const leafHinge = new THREE.Group(); leafHinge.position.x = -W / 2 + 0.012;
  const leafFront = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.95 });
  const leafBack = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.95 });
  const leafA = new THREE.Mesh(pageGeo, leafFront); leafA.rotation.x = -Math.PI / 2; leafA.position.x = (W - 0.03) / 2 + 0.006;
  const leafB = new THREE.Mesh(pageGeo, leafBack); leafB.rotation.x = Math.PI / 2; leafB.position.set((W - 0.03) / 2 + 0.006, -0.0004, 0);
  leafHinge.add(leafA, leafB); leafHinge.visible = false;
  g.add(leafHinge);
  // 두께: 받은 장 수의 '단계'(0~12)로 계단식. 정확한 수는 드러나지 않는다
  const setLevel = (lv) => {
    const t = 0.04 + Math.min(12, Math.max(0, lv)) * 0.004;
    block.scale.y = t; block.position.y = CT / 2 + t / 2;
    spine.scale.y = t + CT * 2; spine.position.y = (t + CT * 2) / 2 - CT / 2;
    hinge.position.y = CT + t;
    rightPage.position.y = CT / 2 + t + 0.0006;
    leafHinge.position.y = CT / 2 + t + 0.0012;
    g.userData.thick = t + CT * 2; g.userData.top = CT / 2 + t;
  };
  setLevel(0);
  Object.assign(g.userData, { hinge, setLevel, W, D, CT, block, rightMat, leftMat, leafHinge, leafFront, leafBack });
  return g;
}

/* ---------- 옛 방(비밀독서구역)의 한 조각: 통로 너머로 보이는 심볼 책장 ---------- */
function symbolShapes(sym, SW) {
  const P = ([u, v]) => new THREE.Vector2((u - 0.5) * SW, (sym.aspect - v) * SW);
  const outer = new THREE.Shape(sym.outer.map(P));
  outer.holes = sym.holes.map((h) => new THREE.Path(h.map(P)));
  return { outer, holes: sym.holes.map((h) => new THREE.Shape(h.map(P))) };
}
function buildShelfGlimpse(sym) {
  const g = new THREE.Group();
  const SW = 2.9, FD = 0.52;
  const { outer, holes } = symbolShapes(sym, SW);
  const frame = sh(new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: FD - 0.056, bevelEnabled: true, bevelSize: 0.028, bevelThickness: 0.028, bevelSegments: 4, curveSegments: 14 }),
    [mat(C.moss, 0.86), mat(C.mossSide, 0.86)]));
  frame.position.z = -FD / 2;
  g.add(frame);
  const backBoard = sh(new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.03, bevelEnabled: false, curveSegments: 14 }), mat(C.lavender, 0.9)));
  backBoard.position.z = -FD / 2 - 0.045; g.add(backBoard);
  for (const h of holes) { const bp = new THREE.Mesh(new THREE.ShapeGeometry(h), mat('#BBAACD', 0.9)); bp.position.z = -FD / 2 + 0.012; g.add(bp); }
  const Y = (v) => (sym.aspect - v) * SW, X = (u) => (u - 0.5) * SW;
  const board = mat('#F5ECD6', 0.82);
  const cols = ['#F6EFE4', '#EFCAC4', '#D9D4CE', '#E8C9B3', '#C9C2D6', '#E2D5C3', '#D8DCC4', '#B0A8C9', '#B49DC2'];
  const sw = X(0.889) - X(0.111) + 0.05;
  [[Y(0.2755), [X(0.2775) - 0.19, X(0.2775) + 0.14, X(0.7225) - 0.19, X(0.7225) + 0.14]], [Y(0.461) + 0.036, [-0.92, -0.46, 0, 0.46, 0.92]]].forEach(([y, xs], row) => {
    const b = sh(new THREE.Mesh(new THREE.BoxGeometry(sw, 0.036, FD - 0.06), board)); b.position.set(0, y - 0.018, 0); g.add(b);
    xs.forEach((x, i) => {
      const bk = sh(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.31, 0.033), mat(cols[(row * 4 + i) % 9], 0.85)));
      bk.position.set(x, y + 0.155, -0.05); bk.rotation.x = -0.08; g.add(bk);
      const pg = sh(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.22, 0.004), mat('#FBF6EA', 0.95)));
      pg.position.set(x + 0.13, y + 0.11, -0.02); pg.rotation.x = -0.12; g.add(pg);
    });
  });
  const cs = contact(3.8, 1.3, 0.8); cs.position.z = 0.1; g.add(cs);
  return g;
}

/* ---------- 로고 벽감: 공식 hirang 글자 로고를 아이보리 얇은 판으로 ---------- */
function logoCutout(img, width) {
  const g = new THREE.Group();
  // alphaMap은 초록 채널을 읽으므로, 로고 모양(알파)을 흰색으로 옮긴 캔버스를 쓴다
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); cx.globalCompositeOperation = 'source-in'; cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv);
  const h = width * img.height / img.width;
  const geo = new THREE.PlaneGeometry(width, h);
  // 앞판 여러 겹으로 3 mm 두께를 만든다(알파 모양 그대로)
  const face = new THREE.MeshStandardMaterial({ color: '#FBF3E1', roughness: 0.92, alphaMap: tex, alphaTest: 0.5, transparent: false });
  const edgeM = new THREE.MeshStandardMaterial({ color: '#E9DCC2', roughness: 0.95, alphaMap: tex, alphaTest: 0.5 });
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(geo, i === 5 ? face : edgeM); m.position.z = i * 0.0012; g.add(m); }
  // 벽감 뒷면에 떨어지는 부드러운 그림자
  const shadow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#6D5F48', alphaMap: tex, transparent: true, opacity: 0.16, depthWrite: false }));
  shadow.position.set(0.006, -0.008, -0.012); g.add(shadow);
  g.userData.h = h;
  return g;
}

/* ---------- 방 전체 ---------- */
export function buildLounge({ sym, logoImg }) {
  const group = new THREE.Group();
  const { x: RX, z0, z1, h: RH, wt } = ROOM;
  const D = z0 - z1, cz = (z0 + z1) / 2;
  const L = LAYOUT;
  const wood = woodFloor(RX, D / 2);
  const floorMat = mat('#F8EEDC', 0.82, { map: wood.map, bumpMap: wood.bump, bumpScale: 0.25, emissive: '#FFF6E4', emissiveIntensity: 0.04 });
  const wallMat = mat(C.ivory, 0.95, { bumpMap: plasterBump(4, 2), bumpScale: 0.35, emissive: C.ivory, emissiveIntensity: 0.1 });
  const revealMat = mat('#F2E8D3', 0.95, { emissive: C.ivory, emissiveIntensity: 0.06 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2 + 1, D + 6), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, cz - 2.6); floor.receiveShadow = true;
  group.add(floor);
  const ceil = sh(new THREE.Mesh(new THREE.BoxGeometry(RX * 2 + 0.6, 0.2, D + 0.4), wallMat));
  ceil.position.set(0, RH + 0.1, cz); group.add(ceil);
  // 천장 간접조명 코브(원래 방과 같은 발광 띠)
  const coveMat = new THREE.MeshBasicMaterial({ color: '#FFF3D0' });
  for (const x of [-RX + 0.45, RX - 0.45]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, D - 1.0), coveMat); c.position.set(x, RH - 0.01, cz); group.add(c); }

  // 뒷벽(z1): 옛 방으로 가는 통로 + 라벤더 벽감(쓰는 의자 뒤) + 로고 반원 벽감
  const backWall = wallPiece(RX * 2, RH, wt, {
    // 바닥에 닿는 통로·벽감은 외곽선 홈으로(구멍이 바깥선에 닿으면 삼각분할이 깨진다)
    doors: [{ x: L.door.x + RX, R: L.door.R, leg: L.door.leg }, { x: L.alcove.x + RX, R: L.alcove.R, leg: L.alcove.leg }],
    holes: [{ x: L.niche.x + RX, R: L.niche.R, leg: 0, y: L.niche.y }],
  }, wallMat, revealMat);
  backWall.position.set(-RX, 0, z1);
  group.add(backWall);
  // 라벤더 벽감: 바닥에서 올라오는 낮고 넓은 아치. 안쪽은 원래 방 아치 벽감과 같은 라벤더
  const alc = recess(L.alcove.R, L.alcove.leg, L.alcove.depth, mat(C.lavender, 0.9, { emissive: '#E9DDF5', emissiveIntensity: 0.08 }), mat(C.lavenderBack, 0.9, { emissive: '#E9DDF5', emissiveIntensity: 0.06 }));
  alc.position.set(L.alcove.x, L.alcove.y, z1 - wt); group.add(alc);
  // 로고 반원 벽감
  const nic = recess(L.niche.R, 0, L.niche.depth, revealMat, mat('#F6EDDA', 0.95, { emissive: C.ivory, emissiveIntensity: 0.08 }));
  nic.position.set(L.niche.x, L.niche.y, z1 - wt); group.add(nic);
  if (logoImg) {
    const logo = logoCutout(logoImg, L.niche.R * 1.1);
    logo.position.set(L.niche.x, L.niche.y + logo.userData.h / 2 + 0.035, z1 - wt - L.niche.depth + 0.03);
    group.add(logo);
  }
  // 징두리: 통로·벽감 자리를 비운다
  wainscot(group, RX * 2, [[L.door.x + RX - L.door.R, L.door.x + RX + L.door.R], [L.alcove.x + RX - L.alcove.R, L.alcove.x + RX + L.alcove.R]], (g) => g.position.set(-RX, 0, z1));

  // 왼쪽 벽(x −RX): 민벽 + 징두리
  const left = wallPiece(D, RH, wt, {}, wallMat, revealMat);
  left.rotation.y = Math.PI / 2; left.position.set(-RX, 0, z0); group.add(left);
  wainscot(group, D, [], (g) => { g.rotation.y = Math.PI / 2; g.position.set(-RX, 0, z0); });
  // 오른쪽 벽(x +RX): 방명록 받침 벽감
  const ledgeZ = L.ledge.z;
  const right = wallPiece(D, RH, wt, { holes: [{ x: z0 - ledgeZ, R: L.ledge.R, leg: L.ledge.leg, y: L.ledge.y }] }, wallMat, revealMat);
  // +π/2 회전: 로컬 x(0..D) → 장면 z(z0..z1), 로컬 두께(−wt..0) → x(RX..RX+wt)
  right.rotation.y = Math.PI / 2; right.position.set(RX + wt, 0, z0);
  group.add(right);
  const led = recess(L.ledge.R, L.ledge.leg, L.ledge.depth, mat(C.yellow, 0.9, { emissive: '#FFF8D0', emissiveIntensity: 0.08 }), mat('#F7F0C2', 0.9, { emissive: '#FFF8D0', emissiveIntensity: 0.06 }));
  led.rotation.y = -Math.PI / 2; led.position.set(RX + wt, L.ledge.y, ledgeZ); group.add(led);
  // 받침 단: 벽감 바닥보다 9 cm 앞으로 나온 노란 판
  const lipW = L.ledge.depth + wt + 0.09;
  const shelfLip = sh(new THREE.Mesh(new RoundedBoxGeometry(lipW, 0.06, L.ledge.R * 2 + 0.06, 3, 0.015), mat(C.yellow, 0.88)));
  shelfLip.position.set(RX - 0.09 + lipW / 2, L.ledge.y - 0.03, ledgeZ);
  group.add(shelfLip);
  // −π/2: 로컬 x(0..D) → 장면 z(z1..z0), 앞면이 방 쪽(−x)
  wainscot(group, D, [[ledgeZ - z1 - L.ledge.R - 0.03, ledgeZ - z1 + L.ledge.R + 0.03]], (g) => { g.rotation.y = -Math.PI / 2; g.position.set(RX, 0, z1); });
  // 앞벽(처음 시점의 등 뒤, 쓰는 자리에서는 정면): 원래 방 왼쪽 벽처럼 낮은 아치 창 두 개로 낮빛이 든다
  const WIN = [{ x: -1.25, R: 0.62, leg: 0.42, y: 1.12 }, { x: 0.95, R: 0.62, leg: 0.42, y: 1.12 }];   // 넓고 낮은 아치(폭 1.24 · 높이 1.04)
  const front = wallPiece(RX * 2, RH, wt, { holes: WIN.map((w) => ({ ...w, x: RX - w.x })) }, wallMat, revealMat);
  front.rotation.y = Math.PI; front.position.set(RX, 0, z0);
  group.add(front);
  wainscot(group, RX * 2, [], (g) => { g.rotation.y = Math.PI; g.position.set(RX, 0, z0); });
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2 + 2, RH + 1), new THREE.MeshBasicMaterial({ color: '#FBF1D2' }));
  outside.rotation.y = Math.PI; outside.position.set(0, RH / 2, z0 + wt + 1.2); group.add(outside);
  for (const w of WIN) {
    const sill = sh(new THREE.Mesh(new THREE.BoxGeometry(w.R * 2, 0.025, wt + 0.03), mat(C.moss, 0.6)));
    sill.position.set(w.x, w.y, z0 + wt / 2 - 0.015); group.add(sill);
  }

  // ----- 통로 너머: 원래 비밀독서구역(같은 마루·회벽·징두리·라벤더 아치 벽감·심볼 책장) -----
  const old = new THREE.Group();
  const oz1 = z1 - wt - 4.2, ox = L.door.x + 1.15;   // 대각선 시선이 통로를 지나 닿는 곳에 책장이 오도록
  const oBack = sh(new THREE.Mesh(new THREE.BoxGeometry(7, RH + 0.6, 0.2), wallMat)); oBack.position.set(ox, (RH + 0.6) / 2, oz1 - 0.1); old.add(oBack);
  // 옛 방 옆벽: 왼쪽은 라벤더 벽감 뒤를 피해 통로 바로 옆에서, 오른쪽은 멀리
  const oz0 = z1 - wt - 0.4, oL = L.door.x - L.door.R - 0.25, oR = ox + 3.3;
  for (const x of [oL, oR]) { const w = sh(new THREE.Mesh(new THREE.BoxGeometry(0.2, RH + 0.6, oz0 - oz1), wallMat)); w.position.set(x, (RH + 0.6) / 2, (oz0 + oz1) / 2); old.add(w); }
  const oCeil = new THREE.Mesh(new THREE.BoxGeometry(7, 0.2, 4.6), wallMat); oCeil.position.set(ox, RH + 0.7, z1 - wt - 2.1); old.add(oCeil);
  wainscot(old, 7, [], (g) => g.position.set(ox - 3.5, 0, oz1));
  const relief = new THREE.Mesh(new THREE.ShapeGeometry(archSolid(2.0, 1.55), 56), mat('#CDBFDD', 0.9)); relief.position.set(ox, 0, oz1 + 0.002); old.add(relief);
  if (sym) { const shelf = buildShelfGlimpse(sym); shelf.position.set(ox, 0.06, oz1 + 0.75); old.add(shelf); }
  const dais = sh(new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.66, 0.06, 96), mat('#F3EAD6', 0.86))); dais.position.set(ox, 0.03, oz1 + 0.95); old.add(dais);
  group.add(old);

  // ----- 가구 -----
  const table = buildTable(); table.position.set(L.table.x, 0, L.table.z); group.add(table);
  const writeChair = buildChair(); writeChair.position.set(L.writeChair.x, 0, L.writeChair.z); writeChair.rotation.y = L.writeChair.ry; group.add(writeChair);
  const readChair = buildChair(); readChair.position.set(L.readChair.x, 0, L.readChair.z); readChair.rotation.y = L.readChair.ry; group.add(readChair);
  const tray = buildTray(); tray.position.set(L.table.x - 0.47, L.table.h, L.table.z + 0.04); tray.rotation.y = 0.1; group.add(tray);
  // 책등이 벽 쪽(+x), 앞표지는 방 쪽으로 열린다
  const book = buildGuestbook(); book.position.set(RX + 0.12, L.ledge.y + 0.004, ledgeZ); book.rotation.y = Math.PI - 0.1;
  group.add(book);

  return { group, table, tray, book, writeChair, readChair, oldRoom: old };
}

/* ---------- 익명의 흔적: 라벤더 벽감 안쪽에 모이는 하이랑 심볼 모양 종이 조각 ---------- */
// 단계(0~12)만 받는다. 조각 수는 단계마다 계단식으로 늘어 정확한 방문·글 수를 거꾸로 셀 수 없다.
const TRACE_COUNT = [0, 3, 5, 7, 9, 12, 15, 18, 21, 24, 28, 32, 36];
export function buildTraces(sym) {
  const g = new THREE.Group();
  const L = LAYOUT.alcove, { z1, wt } = ROOM;
  g.position.set(L.x, 0, z1 - wt - L.depth + 0.004);
  if (!sym) return { group: g, setLevel() {}, addMine() {} };
  const SW = 0.075;
  const P = ([u, v]) => new THREE.Vector2((u - 0.5) * SW, (sym.aspect - v) * SW - sym.aspect * SW / 2);
  const shape = new THREE.Shape(sym.outer.map(P));
  shape.holes = sym.holes.map((h) => new THREE.Path(h.map(P)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.002, bevelEnabled: false, curveSegments: 6 });
  const tints = ['#FFFCF4', '#F6EFE4', '#FDF9C6', '#EFE6F5', '#F3EBDD'].map((c) => mat(c, 0.95));
  // 자리: 벽감 아치를 따라 두 겹의 호(심볼의 봉우리처럼), 정해진 순서로 채운다
  const spots = [];
  const cy = L.leg, rings = [L.R - 0.2, L.R - 0.38];
  for (let r = 0; r < rings.length; r++) {
    const n = r ? 14 : 22;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.1 + 0.8 * (i + (r ? 0.5 : 0)) / (n - 1 + (r ? 1 : 0)));
      spots.push([Math.cos(a) * rings[r], cy + Math.sin(a) * rings[r], r]);
    }
  }
  // 채우는 순서: 꼭대기에서 양옆으로 번져 나간다
  const order = spots.map((s, i) => [i, Math.abs(s[0]) + s[2] * 0.3]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  const pieces = order.map((k, i) => {
    const [x, y] = spots[k];
    const m = new THREE.Mesh(geo, tints[(k * 7) % tints.length]);
    m.position.set(x + Math.sin(k * 12.9) * 0.012, y + Math.cos(k * 7.3) * 0.012, 0);
    m.rotation.z = Math.sin(k * 3.7) * 0.5;
    const s = 0.75 + ((k * 37) % 10) / 22;
    m.scale.setScalar(s);
    m.castShadow = true; m.visible = false;
    m.userData.s = s;
    g.add(m);
    return m;
  });
  let base = 0, mine = 0;
  const show = () => pieces.forEach((p, i) => { p.visible = i < base + mine; });
  return {
    group: g,
    setLevel(lv) { base = TRACE_COUNT[Math.max(0, Math.min(12, lv | 0))]; show(); },
    // 방금 남긴 한 장의 흔적: 다음 자리에 한 조각(단계가 오르지 않아도 이 방문 동안만)
    addMine() {
      const p = pieces[base + mine];
      if (!p) return null;
      mine++; show();
      return p;
    },
  };
}
