// SCENE 01 — 비밀의 문. 문이 달린 벽, 문틀(아치), 실제 두께의 문, 경첩, 레버 손잡이.
// 문은 경첩 위치의 피벗을 기준으로 실제로 회전하고, 그 뒤에는 처음부터 내부 공간이 있다.
import * as THREE from 'three';
import { COLORS, DOOR } from '../config.js';
import { ENGRAVE_OUTER, ENGRAVE_INNER, ENGRAVE_DEPTH } from './door-engrave.js';
import { plaqueTexture, spillTexture, haloTexture, baseGlowTexture, polishedFloor, plasterBump, hfBump } from '../textures.js';

export function archShape(w, h, x0 = -w / 2) {
  const r = w / 2;
  const s = new THREE.Shape();
  s.moveTo(x0, 0);
  s.lineTo(x0 + w, 0);
  s.lineTo(x0 + w, h - r);
  s.absarc(x0 + r, h - r, r, 0, Math.PI, false);
  s.lineTo(x0, 0);
  return s;
}

// 바닥까지 뚫린 아치 개구부를 가진 외곽선(구멍이 바깥선에 닿으면 삼각분할이 깨지므로 홈 형태로 만든다)
// outer: 'rect' 이면 [hw, top] 사각형, 아니면 [w, h] 아치
function notched(outer, iw, ih) {
  const ir = iw / 2;
  const s = new THREE.Shape();
  const ow = outer.rect ? outer.hw : outer.w / 2;
  s.moveTo(-ow, 0);
  s.lineTo(-iw / 2, 0);
  s.lineTo(-iw / 2, ih - ir);
  s.absarc(0, ih - ir, ir, Math.PI, 0, true);
  s.lineTo(iw / 2, 0);
  s.lineTo(ow, 0);
  if (outer.rect) {
    s.lineTo(ow, outer.top);
    s.lineTo(-ow, outer.top);
  } else {
    const or = outer.w / 2;
    s.lineTo(ow, outer.h - or);
    s.absarc(0, outer.h - or, or, 0, Math.PI, false);
  }
  s.lineTo(-ow, 0);
  return s;
}

// 두 봉우리 윤곽: 반지름 R0의 원 두 개(중심 x=±cx, 높이 hc)가 가운데에서 만난다. d = 바깥(+)/안쪽(−)으로 넓힌 거리.
// 반환: 왼쪽 아래 → 위(두 봉우리) → 오른쪽 아래 순서의 점들(항상 2·seg+3개 — 두 윤곽을 이어 붙일 때 점 수가 같다)
export function lobeProfile(cx, R0, hc, d = 0, seg = 30) {
  const R = R0 + d;
  const pts = [[-(cx + R), 0]];
  if (R >= cx) {
    const dy = Math.sqrt(R * R - cx * cx), a1 = Math.atan2(dy, cx);
    for (let i = 0; i <= seg; i++) { const a = Math.PI - (Math.PI - a1) * i / seg; pts.push([-cx + R * Math.cos(a), hc + R * Math.sin(a)]); }
    for (let i = 1; i <= seg; i++) { const a = (Math.PI - a1) - (Math.PI - a1) * i / seg; pts.push([cx + R * Math.cos(a), hc + R * Math.sin(a)]); }
  } else {
    for (let i = 0; i <= seg; i++) { const a = Math.PI - Math.PI * i / seg; pts.push([-cx + R * Math.cos(a), hc + R * Math.sin(a)]); }
    for (let i = 1; i <= seg; i++) { const a = Math.PI - Math.PI * i / seg; pts.push([cx + R * Math.cos(a), hc + R * Math.sin(a)]); }
  }
  pts.push([cx + R, 0]);
  return pts;
}
// rev4: 문짝 W×H 기준 윤곽(blender HRD 문 비율). d>0 = 문틀 쪽, d<0 = 문짝 안쪽
export function symProfile(W, H, d = 0, seg = 30) {
  const cx = W / 2 * DOOR.lobe.cx, R0 = W / 2 * DOOR.lobe.r;
  return lobeProfile(cx, R0, H - R0, d, seg);
}
// 닫힌 윤곽 → Shape (dx만큼 옮김)
function profileShape(pts, dx = 0) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0] + dx, pts[0][1]);
  for (const [x, y] of pts.slice(1)) s.lineTo(x + dx, y);
  s.closePath();
  return s;
}
// 바닥까지 뚫린 홈 모양: 바깥 윤곽(왼쪽 아래→오른쪽 아래) 안에서 안쪽 윤곽을 파낸다(구멍이 바깥선에 닿아 삼각분할이 깨지지 않게 한 줄로)
export function notchedProfile(outerPts, innerPts) {
  const s = new THREE.Shape();
  s.moveTo(outerPts[0][0], outerPts[0][1]);
  for (const [x, y] of innerPts) s.lineTo(x, y);
  for (let i = outerPts.length - 1; i >= 0; i--) s.lineTo(outerPts[i][0], outerPts[i][1]);
  return s;
}
const rectPts = (hw, top) => [[-hw, 0], [-hw, top], [hw, top], [hw, 0]];

export function buildDoor() {
  const { width: W, height: H, thickness: T, gap, wallThickness: WT, ring: RING, facade: FD, reveal: RV } = DOOR;
  const FZ = WT / 2 + FD;   // 바깥 벽면(z). 초록 테두리·문짝 앞면은 WT/2, 그 앞 33 cm가 비스듬한 크림색 문틀
  const group = new THREE.Group();
  group.name = 'doorway';

  // 브랜드 아이보리(#FFF9EA)가 그늘에서 노란 회색으로 보이지 않게, 같은 색을 조금 자체 발광으로 섞는다
  const wallMat = new THREE.MeshStandardMaterial({ color: COLORS.ivory, roughness: 0.94, bumpMap: hfBump('wall', 0.6, 0.6), bumpScale: 0.5, emissive: COLORS.ivory, emissiveIntensity: 0.14 });   // rev6-5b: 미장 결(Higgsfield)
  const trimMat = new THREE.MeshStandardMaterial({ color: '#F2E9D3', roughness: 0.85, emissive: '#F2E9D3', emissiveIntensity: 0.08 });
  // 비스듬한 문틀 면: 벽과 같은 아이보리, 매끈한 회벽
  const revealMat = new THREE.MeshStandardMaterial({ color: COLORS.ivory, roughness: 0.92, emissive: COLORS.ivory, emissiveIntensity: 0.1, side: THREE.DoubleSide });
  // 무광 도장 문. 그늘에서도 브랜드 모스 그린(#4F5F4C)이 검정으로 죽지 않게 같은 색을 아주 조금 자체 발광으로 섞는다
  const doorMat = new THREE.MeshStandardMaterial({ color: COLORS.moss, roughness: 0.8, metalness: 0, emissive: COLORS.moss, emissiveIntensity: 0.32 });
  // 음각 바닥: 같은 그린을 한 톤 낮춰(blender HRD_moss_engrave 비율 ≈ 0.8) 파인 홈이 그늘처럼 읽힌다
  const engraveMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.moss).multiplyScalar(0.8), roughness: 0.85, emissive: COLORS.moss, emissiveIntensity: 0.18 });
  const brassMat = new THREE.MeshStandardMaterial({ color: COLORS.yellow, roughness: 0.42, metalness: 0.6 });

  // 문 구멍(문짝 + 간격)과 초록 테두리 바깥선
  const hole = symProfile(W, H, gap);
  const ringOut = symProfile(W, H, RING);
  // 벽면에서의 문틀 윤곽: 더 넓고 높은 두 봉우리(blender 실측: 옆 ±1.448 m, 꼭대기 2.686 m, 골 2.381 m)
  const front = lobeProfile(RV.cx, RV.r, RV.hc, 0);

  // 뒤쪽 벽체(두께 WT): 초록 테두리 바깥선만큼 뚫는다
  const wallGeo = new THREE.ExtrudeGeometry(notchedProfile(rectPts(9, 6.5), ringOut), { depth: WT, bevelEnabled: false, curveSegments: 48 });
  wallGeo.translate(0, 0, -WT / 2);
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.castShadow = true; wall.receiveShadow = true;
  group.add(wall);
  // 앞쪽 벽체(두께 FD): 벽면 윤곽만큼 뚫는다. 그 안을 비스듬한 문틀 면이 채운다
  const faceGeo = new THREE.ExtrudeGeometry(notchedProfile(rectPts(9, 6.5), front), { depth: FD, bevelEnabled: false, curveSegments: 48 });
  faceGeo.translate(0, 0, WT / 2);
  const face = new THREE.Mesh(faceGeo, wallMat);
  face.castShadow = true; face.receiveShadow = true;
  group.add(face);

  // 비스듬히 벌어지는 문틀(스플레이): 초록 테두리 바깥선(z=WT/2) → 벽면 윤곽(z=FZ)을 잇는 실제 면.
  // 옆면·왼쪽 봉우리·오른쪽 봉우리를 따로 이어 가운데 골의 꺾임이 매끈하게 뭉개지지 않게 한다
  const revealGeo = (() => {
    const n = ringOut.length, seg = (n - 3) / 2;
    const runs = [[0, 1], [1, seg + 1], [seg + 1, n - 2], [n - 2, n - 1]];
    const pos = [], uv = [], idx = [];
    for (const [i0, i1] of runs) {
      const base = pos.length / 3;
      let len = 0;
      for (let i = i0; i <= i1; i++) {
        if (i > i0) len += Math.hypot(ringOut[i][0] - ringOut[i - 1][0], ringOut[i][1] - ringOut[i - 1][1]);
        pos.push(ringOut[i][0], ringOut[i][1], WT / 2, front[i][0], front[i][1], FZ);
        uv.push(len, 0, len, 1);
      }
      for (let k = 0; k < i1 - i0; k++) {
        const v = base + k * 2;
        idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  })();
  const reveal = new THREE.Mesh(revealGeo, revealMat);
  reveal.castShadow = true; reveal.receiveShadow = true;
  group.add(reveal);

  // 초록 안쪽 테두리 하나: 문짝과 같은 면(z=WT/2)의 5 cm 띠 + 벽 두께만큼 이어지는 초록 문설주
  const ringMat = new THREE.MeshStandardMaterial({ color: COLORS.moss, roughness: 0.78, emissive: COLORS.moss, emissiveIntensity: 0.26 });
  const ringGeo = new THREE.ExtrudeGeometry(notchedProfile(ringOut, hole), { depth: WT, bevelEnabled: false, curveSegments: 48 });
  ringGeo.translate(0, 0, -WT / 2);
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.castShadow = true; ringMesh.receiveShadow = true;
  group.add(ringMesh);

  // 문턱: 방 바닥(z<-WT/2)부터 바깥 벽면(z=FZ)까지 문틀 바닥을 두 바닥과 같은 높이로 잇는다
  const sillW = (RV.cx + RV.r) * 2 + 0.02;
  const sill = new THREE.Mesh(new THREE.BoxGeometry(sillW, 0.02, WT + FD + 0.006), trimMat);
  sill.position.set(0, -0.0085, FD / 2);   // 윗면 y=+0.0015
  sill.receiveShadow = true;
  group.add(sill);

  // 문 피벗: 경첩 쪽(왼쪽) 안쪽 면 모서리. 안쪽(-z)으로 열린다. 문짝 앞면 = 초록 테두리 면(z=WT/2)
  const doorZ = WT / 2 - T / 2;
  const pivot = new THREE.Group();
  pivot.position.set(-W / 2, 0.0, doorZ - T / 2);
  group.add(pivot);

  const leaf = new THREE.Group();          // 문짝 (피벗 기준 로컬 좌표: x 0→W, z 0→T)
  leaf.position.set(0, 0.004, 0);
  pivot.add(leaf);
  // 문짝: 문틀과 같은 두 봉우리 윤곽, 가운데에 HIRANG 심볼을 6 mm 음각(실제로 파인 홈)
  const ES = W / 2.4;   // 음각 윤곽은 2.4 m 문 기준(blender) — 문 크기에 맞춰 같은 비율로
  // rev6-5b: 심볼을 15% 줄인다(클라이언트 요청). 심볼 윤곽 상자 가운데를 기준으로 줄여 위치는 그대로
  const SYM_K = 0.85;
  const symC = (() => { const xs = ENGRAVE_OUTER.map((p) => p[0]), ys = ENGRAVE_OUTER.map((p) => p[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; })();
  const toLeaf = (loop) => loop.map(([x, y]) => new THREE.Vector2((symC[0] + (x - symC[0]) * SYM_K) * ES + W / 2, (symC[1] + (y - symC[1]) * SYM_K) * ES - 0.004));
  // 윤곽을 d만큼 바깥(+)으로 밀어낸 점들. 음각 바닥·섬을 문짝 면 아래로 2 mm 숨겨 넣어 경계에 틈(뒤의 빛이 새는 실선)이 생기지 않게 한다
  const grow = (pts, d) => {
    const n = pts.length;
    let area = 0;
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; area += p.x * q.y - q.x * p.y; }
    const sgn = area > 0 ? 1 : -1;   // 반시계(+)면 오른쪽 법선이 바깥
    return pts.map((p, i) => {
      const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      const t = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
      return new THREE.Vector2(p.x + t.y * d * sgn, p.y - t.x * d * sgn);
    });
  };
  const outerPts = toLeaf(ENGRAVE_OUTER), innerPts = toLeaf(ENGRAVE_INNER);
  const leafShape = profileShape(symProfile(W, H, -0.004), W / 2);
  // 2026-11-11: 비밀독서구역 문에는 심볼을 넣지 않는다(클라이언트 지시 — 심볼 있는 문은 별도 참고 이미지용). 음각 홈·섬을 만들지 않는다
  const DOOR_SYMBOL = true;   // 2026-11-11(2): 클라이언트 요청으로 문 심볼 복원(대신 명판 왼쪽 심볼을 뺀다)
  if (DOOR_SYMBOL) leafShape.holes.push(new THREE.Path(outerPts));
  const doorGeo = new THREE.ExtrudeGeometry(leafShape, {
    depth: T, bevelEnabled: false, curveSegments: 48,   // 모서리 베벨이 음각 가장자리에 금빛 하이라이트 선을 만들어 뺀다(참고 문도 각진 모서리)
  });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.castShadow = true; door.receiveShadow = true;
  leaf.add(door);
  // 음각 안쪽 섬(심볼 속 빈 칸): 문짝 면 그대로
  if (DOOR_SYMBOL) {
  const island = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(grow(innerPts, 0.002)), { depth: T, bevelEnabled: false, curveSegments: 24 }), doorMat);
  island.castShadow = true; island.receiveShadow = true;
  leaf.add(island);
  // 음각 바닥: 고리 모양 홈, 앞면보다 6 mm 들어가 있다
  const bedShape = new THREE.Shape(grow(outerPts, 0.002));
  bedShape.holes.push(new THREE.Path(innerPts));
  const bed = new THREE.Mesh(new THREE.ExtrudeGeometry(bedShape, { depth: T - ENGRAVE_DEPTH, bevelEnabled: false, curveSegments: 24 }), engraveMat);
  bed.receiveShadow = true;
  leaf.add(bed);
  }
  const kick = null, emblem = null;   // rev4: 황동 발판·작은 엠블럼·덧댄 몰딩 제거(참고 문에 없다)

  // 레버 손잡이(앞·뒤). 손잡이 피벗은 로즈(원판) 중심
  const handles = [];
  const mkHandle = (side) => {
    const hp = new THREE.Group();
    hp.position.set(W - 0.2, 1.02, side > 0 ? T + 0.006 : -0.006);   // rev4: blender 손잡이 자리(잠금 쪽 끝에서 20 cm)
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 32), brassMat);
    rose.rotation.x = Math.PI / 2;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 16), brassMat);
    neck.rotation.x = Math.PI / 2;
    neck.position.z = side * 0.028;
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.017, 0.02), brassMat);
    lever.position.set(-0.06, 0, side * 0.052);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), brassMat);
    tip.position.set(-0.127, 0, side * 0.052);
    for (const m of [rose, neck, lever, tip]) { m.castShadow = true; hp.add(m); }
    leaf.add(hp);
    handles.push(hp);
  };
  mkHandle(1); mkHandle(-1);

  // 경첩(안쪽에 달려 있어 문틈으로만 살짝 보인다)
  for (const y of [0.28, 1.05, 1.72]) {
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.11, 16), brassMat);
    hinge.position.set(0.002, y, -0.004);
    hinge.castShadow = true;
    leaf.add(hinge);
  }

  // 문 앞 바닥(그림자를 받는다)
  // 광택 민바닥: 벽(아이보리)보다 한 톤 깊은 웜 아이보리, 맑은 코팅으로 벽등·문틈 빛과 햇빛이 은은하게 비친다
  // 2.0 최종: 광택 코팅을 걷어 낸 무광 바닥(문 앞 빛이 거울처럼 비쳐 바닥이 하얗게 타던 것 제거). F2 참고안의 크림색 바닥
  const groundMat = new THREE.MeshStandardMaterial({ color: '#EFE6D6', map: polishedFloor(6, 4), bumpMap: hfBump('floor', 22, 15), bumpScale: 0.25, roughness: 0.82, metalness: 0 });   // rev6-5b: 바닥 결(Higgsfield)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(44, 30), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 15 + FZ - 0.001);
  ground.receiveShadow = true;
  group.add(ground);

  // rev6-5: 벽과 바닥이 만나는 모서리의 부드러운 그늘(실제 방 구석의 차폐광). 벽 아래·바닥 벽쪽이 살짝 어두워져
  // 벽이 바닥에서 '서 있는' 깊이가 생긴다. 문 개구부(±1.32 m)는 피한다
  {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const x = c.getContext('2d'), gr = x.createLinearGradient(0, 256, 0, 0);
    for (let i = 0; i <= 10; i++) { const u = i / 10; const v = Math.round(255 * Math.pow(1 - u, 2.2)); gr.addColorStop(u, `rgb(${v},${v},${v})`); }   // alphaMap은 밝기(G)를 읽는다
    x.fillStyle = gr; x.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(c);
    const aoMat = (o) => new THREE.MeshBasicMaterial({ color: '#5A4F3C', alphaMap: tex, transparent: true, opacity: o, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const wallAo = aoMat(0.2), floorAo = aoMat(0.22);
    const texF = tex.clone(); texF.flipY = false; texF.needsUpdate = true; floorAo.alphaMap = texF;   // 바닥: 벽쪽(로컬 y=0)이 진하게
    const half = 1.32, span = 9 - half;
    for (const sx of [-1, 1]) {
      const g = new THREE.PlaneGeometry(span, 0.75); g.translate(0, 0.375, 0);
      const m = new THREE.Mesh(g, wallAo);
      m.position.set(sx * (half + span / 2), 0, FZ + 0.004);
      m.renderOrder = 2; group.add(m);
    }
    const fg = new THREE.PlaneGeometry(18, 1.1); fg.translate(0, -0.55, 0);
    const fm = new THREE.Mesh(fg, floorAo);
    fm.rotation.x = -Math.PI / 2;   // 로컬 −y(벽에서 멀어지는 쪽) → +z
    fm.position.set(0, 0.003, FZ);
    fm.renderOrder = 2; group.add(fm);
  }

  /* ---- 문 앞 디테일: 모스 걸레받이, 양옆 벽등(벽을 타고 내려오는 빛 무늬) ---- */
  const baseMat = new THREE.MeshStandardMaterial({ color: '#F2E9D3', roughness: 0.6 });   // 초록 바닥과 벽 사이 아이보리 걸레받이
  const sconceSpots = [], sconceShades = [];
  const SY = H * 0.857;   // 벽등 높이(blender: 2.09 m / 문 2.44 m)
  const trimHalf = RV.cx + RV.r + 0.01;   // 문틀 벽면 윤곽 바로 바깥
  for (const s of [-1, 1]) {
    const len = 9 - trimHalf;
    const bb = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.03), baseMat);
    bb.position.set(s * (trimHalf + len / 2), 0.07, FZ + 0.015);
    bb.castShadow = true; bb.receiveShadow = true;
    group.add(bb);
    // 벽등: 황동 받침 + 노란 유리 갓. 아래·위로 빛을 뿌려 벽에 부채꼴 빛이 생긴다
    const sx = s * (RV.cx + RV.r + 0.49);   // blender 벽등 자리(문틀 벽면 윤곽 바깥 0.49 m)
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 32), brassMat);
    plate.rotation.x = Math.PI / 2; plate.position.set(sx, SY, FZ + 0.008);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 12), brassMat);
    arm.rotation.x = Math.PI / 2; arm.position.set(sx, SY, FZ + 0.07);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.16, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: '#FDF3B8', emissive: '#FFE58A', emissiveIntensity: 0.9, roughness: 0.6, side: THREE.DoubleSide }));
    sconceShades.push(shade.material);
    shade.position.set(sx, SY, FZ + 0.13);
    group.add(plate, arm, shade);
    // 2.0 최종: 벽에 또렷한 부채꼴(빛 원뿔)을 그리던 좁은 스포트 → 넓고 약한 빛이 벽을 은은하게 적신다
    for (const [ty, ang] of [[0.2, 1.05], [3.6, 0.95]]) {
      const sp = new THREE.SpotLight('#FFEBC4', ty < 1 ? 1.6 : 1.0, 3.0, ang, 1.0, 1.6);
      sp.userData.base = sp.intensity; sconceSpots.push(sp);
      sp.position.set(sx, SY, FZ + 0.14);
      sp.target.position.set(sx, ty, FZ + 0.02);
      group.add(sp, sp.target);
    }
  }

  // 벽 명판
  // 멀리(문 앞 5m)에서도 읽히는 크기의 명판
  const plaqueTex = plaqueTexture();
  // 투명한 사각 평면도 AO·심도 패스에서는 사각형으로 처리된다.
  // 실제 글자와 심볼의 알파 영역만 기하로 남겨 배경판과 사각 그림자를 없앤다.
  function plaqueCutout(texture, width, height) {
    const image = texture.image, w = image.width, h = image.height;
    const pixels = image.getContext('2d').getImageData(0, 0, w, h).data;
    const positions = [], uvs = [];
    function point(x, y) {
      positions.push((x / w - 0.5) * width, (0.5 - y / h) * height, 0);
      uvs.push(x / w, 1 - y / h);
    }
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        while (x < w && pixels[(y * w + x) * 4 + 3] < 8) x++;
        const start = x;
        while (x < w && pixels[(y * w + x) * 4 + 3] >= 8) x++;
        if (start === x) continue;
        point(start, y); point(start, y + 1); point(x, y);
        point(start, y + 1); point(x, y + 1); point(x, y);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    return geometry;
  }
  const plaque = new THREE.Mesh(plaqueCutout(plaqueTex, 1.28, 0.304),
    new THREE.MeshStandardMaterial({ map: plaqueTex, emissiveMap: plaqueTex, emissive: '#FFFFFF', emissiveIntensity: 0.25, roughness: 0.8, transparent: true, depthWrite: false }));
  // 명판 자리는 화면 비율에 따라 바뀐다(halfW: 문 앞 시작 위치에서 벽에 보이는 가로 반폭, m).
  // 문 오른쪽에 오른쪽 여백을 충분히 두고 들어가면 옆, 줄여도 안 들어가면 문 위 가운데.
  const PW = 1.28;
  function placePlaque(halfW) {
    const z = FZ + 0.05, edge = RV.cx + RV.r + 0.2;   // rev4: edge = 문틀 벽면 윤곽 바깥 20 cm
    const right = halfW - Math.max(0.16, halfW * 0.1);   // 오른쪽 여백(화면 폭의 약 5%)
    for (const sc of [1, 0.88, 0.78]) {
      const x = Math.min(edge + PW * sc / 2 + 0.3, right - PW * sc / 2);
      if (x - PW * sc / 2 >= edge) { plaque.position.set(x, 1.37, z); plaque.scale.setScalar(sc); return; }   // rev4: blender 명판 높이(1.19–1.55 m)의 가운데
    }
    plaque.position.set(0, RV.hc + RV.r + 0.42, z);
    plaque.scale.setScalar(Math.min(0.92, (halfW * 2 * 0.84) / PW));
  }
  placePlaque(3);
  plaque.receiveShadow = false;
  group.add(plaque);

  // 문틈 아래 바닥으로 새는 빛
  const spillMat = new THREE.MeshBasicMaterial({
    map: spillTexture(), color: '#FFE6A8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const spillGeo = new THREE.PlaneGeometry(W * 0.8, 1.7 + FD);
  spillGeo.translate(0, -(1.7 + FD) / 2, 0);                     // 문 아래(벽)에서 시작해 앞으로 번지도록 기준을 벽쪽 끝에
  const spill = new THREE.Mesh(spillGeo, spillMat);
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(0, 0.004, WT / 2 + 0.002);
  group.add(spill);
  // 문 바로 아래의 뜨거운 빛 웅덩이(처음 호버 효과의 노란 빛을 문 앞 유혹에서 더 진하게)
  const coreMat = new THREE.MeshBasicMaterial({ map: spillMat.map, color: '#FFEA9A', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const core = new THREE.Mesh(spillGeo, coreMat);
  core.rotation.x = -Math.PI / 2;
  core.position.set(0, 0.0045, WT / 2 + 0.002);
  core.scale.set(0.95, 0.75, 1);
  group.add(core);

  /* ---- 문 앞에서 머뭇거릴 때의 유혹: 문틈으로 새어 나오는 빛 ---- */
  // 문 둘레 틈을 따라 번지는 빛(아치 고리)
  const seamShape = notchedProfile(symProfile(W, H, gap + 0.006), symProfile(W, H, -0.02));   // rev4: 틈에만 — 초록 테두리(5 cm)를 덮어 노란 윤곽선처럼 보이지 않게   // 문 가장자리 3.5cm까지 빛이 번진다
  // 밝은 아이보리 위에서도 보이도록 가산이 아닌 진한 금빛으로 덮는다
  const seamBase = new THREE.Color('#FFD98A');
  const daySeam = new THREE.Color('#EFD37E');   // 2.0: 진한 호박색 → 연한 노랑(Pale Yellow 계열)으로, 테두리처럼 보이지 않게
  let daylightStrength = 0;
  const seamMat = new THREE.MeshBasicMaterial({ color: seamBase.clone(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const seam = new THREE.Mesh(new THREE.ShapeGeometry(seamShape, 48), seamMat);
  seam.position.z = WT / 2 + 0.006;   // rev4: 문짝·초록 테두리 면 바로 앞
  group.add(seam);
  // 문이 살짝 벌어진 쪽(손잡이 쪽) 틈에서 바깥으로 뻗는 빛줄기
  const rayTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 256);
    const s2 = x.createLinearGradient(0, 0, 64, 0);
    s2.addColorStop(0, 'rgba(0,0,0,1)'); s2.addColorStop(0.5, 'rgba(0,0,0,0)'); s2.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = s2; x.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const rays = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3 + i * 0.1, 3.6 + i * 0.7),
      new THREE.MeshBasicMaterial({ map: rayTex, color: '#FFF4CC', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    m.geometry.translate(0, -(3.6 + i * 0.7) / 2, 0);   // 틈(위쪽 끝)에서 바깥으로 뻗는다
    const pivot = new THREE.Group();
    pivot.position.set(W / 2 - 0.02, 0.35 + i * 0.5, WT / 2 + 0.02);
    pivot.rotation.set(Math.PI / 2 + 0.35 + i * 0.08, 0, -0.5 + i * 0.28);
    pivot.add(m);
    group.add(pivot);
    rays.push(m);
  }
  // 틈에서 흘러나오는 금빛 먼지
  const MN = 70;
  const motePos = new Float32Array(MN * 3);
  const moteSeed = Array.from({ length: MN }, () => [Math.random(), Math.random(), Math.random()]);
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  // 둥글고 부드러운 빛 알갱이
  const moteTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const moteMat = new THREE.PointsMaterial({ map: moteTex, color: '#FDF3B8', size: 0.04, transparent: true, opacity: 0, depthWrite: false, alphaTest: 0.01 });
  const motes = new THREE.Points(moteGeo, moteMat);
  group.add(motes);
  // 문 안쪽의 흔들리는 빛(문틈 아래 바닥으로 번진다)
  const lureLight = new THREE.PointLight('#FFF0C8', 0, 4.5, 1.5);
  lureLight.position.set(0.25, 0.7, -0.5);
  group.add(lureLight);

  // 문 둘레 벽으로 번지는 금빛 후광: 옆 명판까지 닿는다
  // 문 모양을 뚫어 문짝은 또렷하게 두고, 둘레 벽에만 빛이 번진다
  const haloTex = haloTexture();
  haloTex.repeat.set(1 / 4.2, 1 / 3.4); haloTex.offset.set(0.5, 0);   // ShapeGeometry의 uv(=미터 좌표)를 텍스처에 맞춤
  const haloMat = new THREE.MeshBasicMaterial({ map: haloTex, color: '#FFF3C6', transparent: true, opacity: 0, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.ShapeGeometry(notchedProfile(rectPts(2.1, 3.4), front), 48), haloMat);
  halo.position.set(0, 0, FZ + 0.005);
  group.add(halo);

  // 문 아래 틈에서 나온 빛이 위·아래·양옆으로 넓게 퍼진다: 벽(문 구멍은 비워 문은 또렷하게)과 바닥에 둥글게
  const wallGlowTex = baseGlowTexture(1);
  wallGlowTex.repeat.set(1 / 6.4, 1 / 3.2); wallGlowTex.offset.set(0.5, 0);
  const wallGlowMat = new THREE.MeshBasicMaterial({ map: wallGlowTex, color: '#FFC96A', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const wallGlow = new THREE.Mesh(new THREE.ShapeGeometry(notchedProfile(rectPts(3.2, 3.2), front), 48), wallGlowMat);
  wallGlow.position.set(0, 0, FZ + 0.006);
  group.add(wallGlow);
  const floorGlowMat = new THREE.MeshBasicMaterial({ map: baseGlowTexture(0), color: '#FFD27A', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const floorGlowGeo = new THREE.PlaneGeometry(6.4, 3.4);
  floorGlowGeo.translate(0, -1.7, 0);                   // 벽쪽 끝(문 아래)이 가장 밝다
  const floorGlow = new THREE.Mesh(floorGlowGeo, floorGlowMat);
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(0, 0.005, WT / 2 + 0.003);
  group.add(floorGlow);
  // 문 아래 틈 자체: 가늘고 아주 밝은 빛줄(블룸이 걸려 '쨍'하게 보인다)
  const slitMat = new THREE.MeshBasicMaterial({ color: '#FFF4CC', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const slit = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.02, 0.03), slitMat);
  slit.position.set(0, 0.02, WT / 2 + 0.008); slit.scale.y = 1.4;
  group.add(slit);
  // 방 안의 밝은 빛(문 바로 뒤). 밝기가 1을 넘어 블룸이 걸린다
  const backBase = new THREE.Color('#FFE3A0');
  const backMat = new THREE.MeshBasicMaterial({ color: backBase.clone(), transparent: true, opacity: 0, depthWrite: false });
  const backLight = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.4, H + 0.3), backMat);
  backLight.position.set(0, (H + 0.3) / 2 - 0.02, doorZ - 0.26);
  backLight.visible = false;
  group.add(backLight);
  // 투명도 0인 판도 화면 공간 그림자(AO) 계산에는 들어가 문 위에 얼룩을 만들므로, 빛이 없을 땐 아예 숨긴다
  const show = (m, mat) => { m.visible = mat.opacity > 0.004; };

  // 2026-11-11: 7초 머뭇거림 빛(lureK)이 너무 약했다(낮엔 후광·벽빛 40%, 바닥 12%, 문 앞 45% 상한 등이 겹쳐 체감 20% 정도).
  // 낮 입구에 늘 깔리는 은은한 빛(glow 중 lureK가 아닌 몫)만 줄이고, 머뭇거림 빛은 분명히 보이게 키운다
  let wallEm = 0.14;
  function updateLure(lure, t, flick, lureK = 0) {
    const dayK = (1 - 0.6 * daylightStrength) * (1 - lureK) + lureK;   // rev5: 낮에는 벽에 번지는 금빛 안개(후광·벽빛)를 40%로 — 입구가 뿌옇게 보이지 않게
    haloMat.opacity = Math.min(1, lure * (0.45 + lureK * 0.5 + flick * 0.2)) * dayK;
    seamMat.opacity = Math.min(0.8, lure * (0.6 + flick * 0.2)) * (1 - 0.45 * daylightStrength);   // 2.0: 틈 빛을 조금 얇게
    seamMat.color.copy(seamBase).lerp(daySeam, daylightStrength).multiplyScalar(1.6 + flick * 0.8 - daylightStrength * 0.7);   // 1을 넘는 밝기 → 블룸으로 틈 빛이 번진다
    wallGlowMat.opacity = Math.min(1, lure * (0.4 + lureK * 0.6 + flick * 0.1)) * dayK;
    floorGlowMat.opacity = Math.min(1, lure * (0.12 + lureK * 0.6));
    // 문 뒤(방 안)의 빛: 닫힌 문 둘레 틈과 살짝 벌어진 손잡이 쪽 틈으로만 보여, 빛이 문을 뚫고 나오는 것처럼 보인다
    backMat.opacity = Math.min(1, lure * 1.4);
    backLight.visible = backMat.opacity > 0.004 && pivot.rotation.y < 0.12;   // 2026-11-11: 문이 조금만 열려도 끈다(열리는 틈으로 노란 판이 튀었다)
    backMat.color.copy(backBase).multiplyScalar(1.8 + flick * 0.6);
    slitMat.opacity = Math.min(1, lure * 1.2);
    slitMat.color.setRGB(1, 0.92, 0.7).multiplyScalar(1.4 + lureK * 0.8 + flick * 0.4);
    show(wallGlow, wallGlowMat); show(floorGlow, floorGlowMat); show(slit, slitMat); show(halo, haloMat);
    seam.visible = false;   // rev4: 문 둘레 금빛 고리는 초록 테두리 위에 겹친 두 번째 윤곽선으로 보여 끈다(빛은 문 아래 틈·벽 후광으로)
    // 문 아래로 쏟아지는 빛: 커지며 앞으로 길게 뻗는다(처음 호버 효과보다 훨씬 크게)
    // 빛은 문 아래에 모여 앞으로 짧게 번진다(바닥 전체가 아니라 문 앞이 쨍하게)
    spill.scale.set(1 + lure * (0.35 + flick * 0.05), 1 + lure * (0.45 + flick * 0.08), 1);
    coreMat.opacity = Math.min(0.45 + lureK * 0.3, lure * (0.5 + lureK * 0.3 + flick * 0.1));   // 2.0 최종: 문 앞 바닥이 하얗게 타지 않게
    core.visible = coreMat.opacity > 0.004;
    // 빛줄기 판은 문 위에 얼룩처럼 보여 쓰지 않는다(벽 후광·바닥 빛으로 충분)
    rays.forEach((r) => { r.material.opacity = 0; r.visible = false; });
    // rev6-6: 문 뒤 점광은 진짜 머뭇거림 빛(lureK)일 때만, 문이 열리기 시작하면 바로 끈다.
    // (낮 입구에 늘 깔리는 은은한 빛 몫으로 1.8이 계속 켜져 있다가, 열리는 문짝이 그 옆을 지나며 둥근 노란 빛점이 튀었다)
    lureLight.intensity = pivot.rotation.y < 0.06 ? lureK * (14 + flick * 4) : 0;
    // 낮: 벽이 스스로 내는 밝기를 머뭇거림 동안 낮춰, 문 둘레 금빛이 밤처럼 대비로 보이게
    wallMat.emissiveIntensity = wallEm * (1 - 0.75 * lureK * daylightStrength);
    moteMat.opacity = lure * (0.35 + lureK * 0.4) * (1 - 0.6 * daylightStrength);   // 2.0 최종: 반짝이 먼지는 아주 옅게
    if (lure > 0.01) {
      const a = moteGeo.attributes.position;
      for (let i = 0; i < MN; i++) {
        const [s1, s2, s3] = moteSeed[i];
        const life = (t * (0.12 + s1 * 0.12) + s2) % 1;       // 0 → 1 동안 틈에서 앞으로 흘러나온다
        a.setXYZ(i, W / 2 - 0.05 + (s3 - 0.5) * 0.25 + Math.sin(t * 0.7 + i) * 0.05 * life,
          0.1 + s2 * (H - 0.3) + life * 0.35, WT / 2 + 0.03 + life * (1.2 + s1));
      }
      a.needsUpdate = true;
    }
  }

  // 클릭 판정용 메쉬
  const hit = [...leaf.children.filter((m) => m.isMesh && m.geometry.type === 'ExtrudeGeometry'), ...handles.flatMap((h) => h.children)];
  hit.forEach((m) => { m.userData.door = true; });

  return {
    group, pivot, handles, spill, spillMat, hit, doorMat, updateLure, placePlaque,
    setAngle(a) { pivot.rotation.y = a; },
    setLeafVisible(v) { pivot.visible = v; },
    // 해가 지면 벽등이 주인공: 밤일수록 더 밝고 따뜻하게(낮에는 은은하게만)
    setNight(n) {
      daylightStrength = 1 - n;
      // 낮에도 벽등의 밝기를 밤 수준으로 유지하고 발광판은 황금빛 대비를 쓴다.
      for (const sp of sconceSpots) sp.intensity = sp.userData.base * (1 + n * 0.6);
      for (const m of sconceShades) m.emissiveIntensity = 0.9 + n * 0.5;   // 2.0 최종: 블룸이 번지지 않는 밝기
      doorMat.color.set(COLORS.moss);   // 2.0 최종: 낮에 문을 어둡게 누르지 않는다(브랜드 그린 그대로)
      doorMat.emissiveIntensity = 0.32;
      trimMat.color.set('#F2E9D3').multiplyScalar(1 - daylightStrength * 0.05);
      wallEm = 0.14 - daylightStrength * 0.06; wallMat.emissiveIntensity = wallEm;   // rev6-5b: 낮 밝기 원래대로(0.035는 회색빛)
      // 밝은 바탕 위 가산 합성은 빛을 지워 보이게 하므로 낮에는 색 대비를 보존한다.
      const blend = n < 0.5 ? THREE.NormalBlending : THREE.AdditiveBlending;
      seamMat.blending = wallGlowMat.blending = floorGlowMat.blending = blend;
      wallGlowMat.color.set('#FFC96A').lerp(new THREE.Color('#E2A23E'), daylightStrength);   // 2026-11-11: 낮 머뭇거림 빛이 밝은 벽에 묻히지 않게 더 진한 금빛
      haloMat.color.set('#FFF3C6').lerp(new THREE.Color('#F2C467'), daylightStrength);   // 2026-11-11: 낮 후광도 금빛(연한 크림은 아이보리 벽에서 안 보였다)
      floorGlowMat.color.set('#FFD27A').lerp(new THREE.Color('#E8AE50'), daylightStrength);
    },
    setHandle(a) { handles.forEach((h) => { h.rotation.z = a; }); },
  };
}
