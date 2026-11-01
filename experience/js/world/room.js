// SCENE 03 — 비밀독서구역 내부. 문 뒤(-z)에 처음부터 존재하는 실제 공간.
// 중앙: 하이랑 심볼 외곽선을 그대로 세운 '시크릿 셸프'(9권). 주변: Ch1·Ch2·Ch3 실제 패키지.
import * as THREE from 'three';
import { COLORS, BOOK_SIZE, mm, LINKS, DOOR } from '../config.js';
import { BOOKS } from '../books-data.js';
import { archShape } from './door.js';
import { buildArchitecture } from './architecture.js';
import { Openable } from './openable.js';
import { woodFloor, plasterBump, bookCover, contactShadowTexture, boardTitleTexture, curationTileMaterial, plateTexture } from '../textures.js';

export const ROOM = { x: 4.2, z0: -0.12, z1: -7.8, h: 4.2 };

const mat = (color, rough = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

function contact(w, d, opacity = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false, opacity }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  return m;
}
let contactTex;

/* ---------- 책 페이지: [표지 안쪽 + 한 줄 | 책 속 한 페이지] → [끝 | 빈 면] ---------- */

function bookPages(b) {
  return [
    { type: 'introquote', eyebrow: `HIRANG SECRET PREVIEW  ·  NO. ${b.id}`, swatch: b.color, title: b.name,
      meta: [b.genre], quote: b.quote,
      note: '제목·저자·표지는 봉인되어 있습니다. 책 속 한 페이지만 미리 볼 수 있습니다.' },
    { type: 'onepage', text: b.fullPage },
    { type: 'end', title: '이 한 페이지에 끌렸다면', text: '제목도 작가도 모른 채, 지금 남는 문장으로 고릅니다.' },
    { type: 'blank' },
  ];
}

/* ---------- 심볼 셸프 ---------- */

// 추적한 심볼 폴리곤(가로 0..1, y 아래로) → 셸프 정면 좌표(m)
function symbolShapes(sym, SW) {
  const P = ([u, v]) => new THREE.Vector2((u - 0.5) * SW, (sym.aspect - v) * SW);
  const outer = new THREE.Shape(sym.outer.map(P));
  outer.holes = sym.holes.map((h) => new THREE.Path(h.map(P)));
  const holes = sym.holes.map((h) => new THREE.Shape(h.map(P)));
  return { outer, holes };
}

export function buildRoom({ sym, packages }) {
  contactTex ||= contactShadowTexture();
  const group = new THREE.Group();
  group.name = 'room';
  const openables = [];
  const { x: RX, z0, z1, h: RH } = ROOM;
  const D = z0 - z1, cz = (z0 + z1) / 2;

  // 실제 재질: 밝은 오크 마루(판 이음·홈 요철)와 손으로 바른 회벽. 자체 발광은 아주 조금만(빛과 그림자가 형태를 만든다)
  const wood = woodFloor(RX, D / 2);
  const floorMat = mat('#FFFFFF', 0.72, { map: wood.map, bumpMap: wood.bump, bumpScale: 0.6, emissive: '#FFF6E4', emissiveIntensity: 0.04 });
  const wallMat = mat(COLORS.ivory, 0.95, { bumpMap: plasterBump(4, 2), bumpScale: 0.3, emissive: COLORS.ivory, emissiveIntensity: 0.12 });

  // 바닥·천장·벽(그림자를 받고, 천장·벽은 바깥 빛을 가린다)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, D), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, cz); floor.receiveShadow = true;
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(RX * 2 + 0.4, 0.2, D + 0.2), wallMat);
  ceil.position.set(0, RH + 0.1, cz); ceil.castShadow = true; ceil.receiveShadow = true;
  const back = new THREE.Mesh(new THREE.BoxGeometry(RX * 2 + 0.4, RH, 0.2), wallMat);
  back.position.set(0, RH / 2, z1 - 0.1); back.receiveShadow = true; back.castShadow = true;
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.2, RH, D + 0.2), wallMat);
  right.position.set(RX + 0.1, RH / 2, cz); right.receiveShadow = true; right.castShadow = true;
  group.add(floor, ceil, back, right);
  // 브랜드 모스 그린 징두리 벽(아래 1m) + 아이보리 몰딩 띠 + 걸레받이: 벽에 깊이와 색을 준다
  const wainMat = mat(COLORS.moss, 0.7, { bumpMap: plasterBump(6, 1), bumpScale: 0.2 });
  const railMat = mat('#F4EAD3', 0.6);
  const WH = 1.0;
  const wainscot = (w, x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, WH, 0.03), wainMat); p.position.set(0, WH / 2, 0.015);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.05), railMat); rail.position.set(0, WH + 0.02, 0.025);
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.045), mat('#3F4D3C', 0.6)); base.position.set(0, 0.05, 0.03);
    for (const m of [p, rail, base]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
    group.add(g);
  };
  wainscot(RX * 2, 0, z1, 0);                 // 뒷벽
  wainscot(D, RX, cz, -Math.PI / 2);          // 오른쪽 벽
  // 입구 벽 안쪽 면: 문 구멍 양옆과 위를 실내 회벽·징두리로 마감(뒤돌아봐도 회색 벽면이 아니라 방의 벽)
  const dw = DOOR.width / 2 + 0.06;
  for (const s of [-1, 1]) {
    const w = RX - dw, x = s * (dw + w / 2);
    const face = new THREE.Mesh(new THREE.BoxGeometry(w, RH, 0.02), wallMat);
    face.position.set(x, RH / 2, z0 - 0.01); face.receiveShadow = true;
    group.add(face);
    wainscot(w, x, z0 - 0.02, Math.PI);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(dw * 2, RH - DOOR.height, 0.02), wallMat);
  lintel.position.set(0, DOOR.height + (RH - DOOR.height) / 2, z0 - 0.01); lintel.receiveShadow = true;
  group.add(lintel);
  // 왼쪽 벽(햇빛 드는 아치 창)·안뜰·계단·떠 있는 페이지는 architecture.js
  const arch = buildArchitecture(group, ROOM);

  // 천장 간접조명 코브(발광 띠)
  const coveMat = new THREE.MeshBasicMaterial({ color: '#FFF3D0' });
  for (const x of [-RX + 0.5, RX - 0.5]) {
    const cove = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, D - 1.2), coveMat);
    cove.position.set(x, RH - 0.01, cz);
    group.add(cove);
  }

  // 바닥 모스 그린 인레이 원
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.05, 2.08, 128), mat(COLORS.moss, 0.6));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.003, -4.9);
  group.add(ring);

  // 뒷벽의 라벤더 아치 부조
  const relief = new THREE.Mesh(new THREE.ExtrudeGeometry(archShape(4.4, 3.7), { depth: 0.04, bevelEnabled: false, curveSegments: 64 }), mat('#D9CCE4', 0.9));
  relief.position.set(0, 0, z1 + 0.001); relief.receiveShadow = true;
  group.add(relief);

  /* ---- 중앙: 심볼 셸프. 심볼 외곽선을 그대로 세워 깊이만 준다 ---- */
  const shelf = new THREE.Group();
  shelf.position.set(0, 0, -5.15);
  group.add(shelf);
  const SW = 2.9, FD = 0.4;
  const Y = (v) => (sym.aspect - v) * SW;      // 심볼 세로 좌표 → 높이(m)
  const X = (u) => (u - 0.5) * SW;
  const { outer, holes } = symbolShapes(sym, SW);
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: FD, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 12 }), mat(COLORS.moss, 0.62));
  frame.position.z = -FD / 2; frame.castShadow = true; frame.receiveShadow = true;
  shelf.add(frame);
  const shelfShadow = contact(3.8, 1.3, 0.9);
  shelfShadow.position.z = 0.1;
  shelf.add(shelfShadow);
  // 심볼 안쪽 빈 공간의 라벤더 뒷판
  for (const h of holes) {
    const bp = new THREE.Mesh(new THREE.ShapeGeometry(h), mat(COLORS.lavender, 0.9));
    bp.position.z = -FD / 2 + 0.03; bp.receiveShadow = true;
    shelf.add(bp);
  }
  // 선반: 가운데 기둥 끝(심볼 v=0.2755)과 아래 고리 꼭대기(v≈0.461)에 맞춘다
  const inner = [X(0.111), X(0.889)];
  const boardMat = mat('#F5ECD6', 0.7);
  const BT = 0.026;
  const shelfTop = { mid: Y(0.2755), low: Y(0.461) + BT };
  for (const y of [shelfTop.mid, shelfTop.low]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(inner[1] - inner[0] - 0.01, BT, FD - 0.04), boardMat);
    b.position.set(0, y - BT / 2, -0.005); b.castShadow = true; b.receiveShadow = true;
    shelf.add(b);
  }

  /* ---- 큐레이션 9권: 시크릿 책장에 9권 모두 + 입구 양쪽 큐레이션 테이블(왼쪽 01~05, 오른쪽 06~09)에도 9권 모두 ---- */
  const [bw, bt, bh] = BOOK_SIZE.map(mm);
  const makeBook = (b) => {
    const book = new Openable({
      kind: 'book', id: b.id, w: bw, h: bh, t: bt, c: 0.0032, body: b.color, spine: COLORS.moss, coverTex: bookCover(b),
      accent: COLORS.moss, label: `No.${b.id} ${b.name}`, sub: b.genre,
      detailUrl: LINKS.book(b.id), pageDefs: bookPages(b),
    });
    book.hover = 'book';
    book.curation = b;
    openables.push(book);
    return book;
  };
  const books = BOOKS.map(makeBook);          // 책장용(보드 칸도 이 책을 연다)
  const archL = X(0.2775), archR = X(0.7225);
  // 책장: [책 번호, 선반, x, 기울기] — 01~04는 두 아치 안, 05~09는 아래 칸
  const shelfSlots = [
    [0, 'mid', archL - 0.22, 0], [1, 'mid', archL + 0.06, 0.03],
    [2, 'mid', archR - 0.06, -0.03], [3, 'mid', archR + 0.22, 0],
    [4, 'low', -0.92, 0], [5, 'low', -0.46, 0.02], [6, 'low', 0.0, 0], [7, 'low', 0.46, -0.02], [8, 'low', 0.92, 0],
  ];
  for (const [i, lv, x, lean] of shelfSlots) {
    const slot = new THREE.Group();
    slot.position.set(x, shelfTop[lv] + bh / 2 + 0.002, 0.02);
    slot.rotation.set(-0.11, 0, lean); // 뒤 판에 살짝 기대 선다
    slot.add(books[i].group);
    shelf.add(slot);
  }

  // 소품: 아치 안 빈자리와 심볼 아래 두 고리 안
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.075, 40, 28), mat(COLORS.lavender, 0.5));
  sphere.position.set(archR - 0.33, shelfTop.mid + 0.075, 0.0); sphere.castShadow = true;
  const blk = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), mat(COLORS.yellow, 0.6));
  blk.position.set(archL + 0.33, shelfTop.mid + 0.065, 0); blk.rotation.y = 0.4; blk.castShadow = true;
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 40), mat(COLORS.moss, 0.55));
  cyl.position.set(X(0.222), 0.1, 0.02); cyl.castShadow = true;
  const cyl2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 40), mat(COLORS.ivory, 0.6));
  cyl2.position.set(X(0.778), 0.06, 0.02); cyl2.castShadow = true;
  shelf.add(sphere, blk, cyl, cyl2);

  const shadowedMesh = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; };
  const ivoryBlock = mat('#FBF4E2', 0.8, { emissive: '#FFF9EA', emissiveIntensity: 0.08 });
  const obstacles = [];   // 걸을 때 피해 갈 바닥 영역 [x0, z0, x1, z1]
  const footprint = (g, w, d) => {
    g.updateMatrixWorld(true);
    const c = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => new THREE.Vector3(x, 0, z).applyMatrix4(g.matrixWorld));
    obstacles.push([Math.min(...c.map((v) => v.x)), Math.min(...c.map((v) => v.z)), Math.max(...c.map((v) => v.x)), Math.max(...c.map((v) => v.z))]);
  };
  footprint(shelf, 3.0, 0.5);
  obstacles.push([1.1, z1, RX, z1 + 1.95]);   // 오른쪽 뒤 계단·단

  // 큐레이션 테이블: 통로를 따라 놓인 긴 전시대, 윗면이 관람객 쪽으로 기울어 표지가 잘 보인다
  const displayTable = (x, z, ids, side) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = side * Math.PI / 2;        // 앞(+z)이 가운데 통로를 본다
    const W = 0.32 + ids.length * 0.27, H = 0.8, Dp = 0.6, tilt = 0.4;
    const base = shadowedMesh(new THREE.BoxGeometry(W, H, Dp), ivoryBlock);
    base.position.y = H / 2;
    const top = new THREE.Group();
    top.position.set(0, H + 0.02, 0);
    top.rotation.x = tilt;                   // 앞(+z)쪽이 낮게
    const slab = shadowedMesh(new THREE.BoxGeometry(W + 0.04, 0.035, Dp / Math.cos(tilt) + 0.02), mat('#F6EEDB', 0.75, { emissive: '#FFF9EA', emissiveIntensity: 0.06 }));
    slab.position.y = -0.0175;
    const lip = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.04, 0.018), mat(COLORS.moss, 0.6));
    lip.position.set(0, 0.012, Dp / Math.cos(tilt) / 2);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(W + 0.042, 0.012, 0.012), mat(COLORS.moss, 0.6));
    edge.position.set(0, H + 0.001, Dp / 2 + 0.001);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.09), new THREE.MeshBasicMaterial({ map: plateTexture(side > 0 ? '큐레이션 테이블 왼쪽' : '큐레이션 테이블 오른쪽'), transparent: true }));
    plate.position.set(0, H * 0.7, Dp / 2 + 0.002);
    top.add(slab, lip);
    ids.forEach((bi, k) => {
      const book = makeBook(BOOKS[bi]);
      const s = new THREE.Group();
      s.position.set((k - (ids.length - 1) / 2) * 0.27, bt / 2 + 0.002, 0.02);
      s.rotation.set(-Math.PI / 2, 0, ((k % 2) ? -1 : 1) * 0.04);   // 표지가 위를 보게 눕힘
      s.add(book.group);
      top.add(s);
    });
    g.add(base, top, edge, plate, contact(W + 0.6, 1.0, 0.8));
    group.add(g);
    footprint(g, W, Dp);
    return g;
  };
  displayTable(-2.55, -2.6, [0, 1, 2, 3, 4], 1);
  displayTable(2.55, -2.6, [5, 6, 7, 8], -1);

  /* ---- 챕터 패키지: 공간 곳곳에 하나씩. 챕터 색 아치 배경 + 이름판 + 작은 조명으로 멀리서도 눈에 띈다 ---- */
  const placeOn = (pk, parent, y) => {
    const s = new THREE.Group();
    s.position.y = y;
    s.add(pk.group);
    parent.add(s);
    openables.push(pk);
    return s;
  };
  // 눕혀 두는 형태(정면 = 위)의 패키지를 세워 정면이 앞을 보게 한다. 정면 글자가 바로 서도록 위아래를 맞춘다
  const standUp = (pk, lean = 0.1) => {
    const w = new THREE.Group();
    const half = (pk.closedBox.max.z - pk.closedBox.min.z) / 2;
    w.rotation.set(Math.PI / 2 - lean, Math.PI, 0);
    w.position.y = half * Math.cos(lean) + 0.002;
    w.add(pk.group);
    openables.push(pk);
    return w;
  };
  const spots = [];
  const plateOn = (g, label, y, z) => {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.064), new THREE.MeshBasicMaterial({ map: plateTexture(label), transparent: true }));
    plate.position.set(0, y, z);
    g.add(plate);
  };
  // 각 받침은 입구(관람 동선 시작) 쪽을 향해 비스듬히 선다. 높이를 낮게 해 뒤의 책장을 가리지 않는다
  const faceEntry = (g) => { g.rotation.y = Math.atan2(0 - g.position.x, -1.0 - g.position.z); };

  // Ch1: 낮은 아이보리 기둥 위 비스듬한 그린 받침(렉턴)
  const ped1 = new THREE.Group(); ped1.position.set(-1.45, 0, -3.45); faceEntry(ped1);
  const col1 = shadowedMesh(new THREE.BoxGeometry(0.46, 0.5, 0.52), ivoryBlock);
  col1.position.y = 0.25;
  const tilt = new THREE.Group(); tilt.position.set(0, 0.56, 0); tilt.rotation.x = 0.42;
  const cap1 = shadowedMesh(new THREE.BoxGeometry(0.46, 0.02, 0.6), mat(COLORS.moss, 0.6));
  cap1.position.y = -0.01;
  const lip1 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.035, 0.02), mat(COLORS.moss, 0.6));
  lip1.position.set(0, 0.012, 0.29);
  tilt.add(cap1, lip1);
  ped1.add(col1, tilt, contact(1.0, 1.0));
  plateOn(ped1, 'Ch1 · 하이랑 큐레이션', 0.3, 0.262);
  const s1 = placeOn(packages.ch1, tilt, 0.001);
  s1.position.z = 0.02; s1.rotation.y = Math.PI;
  group.add(ped1);
  footprint(ped1, 0.46, 0.52);
  spots.push(new THREE.Vector3(-1.45, 0.65, -3.45));

  // Ch2: 낮은 라벤더 계단형 블록. 아래 단에 세워 뒤 단에 살짝 기대 둠
  const ped2 = new THREE.Group(); ped2.position.set(1.45, 0, -3.45); faceEntry(ped2);
  const st1 = shadowedMesh(new THREE.BoxGeometry(0.6, 0.36, 0.5), mat(COLORS.lavender, 0.8, { emissive: '#E6DAF2', emissiveIntensity: 0.14 }));
  st1.position.set(0, 0.18, 0);
  const st2 = shadowedMesh(new THREE.BoxGeometry(0.6, 0.3, 0.15), mat('#B9A7CB', 0.8, { emissive: '#E6DAF2', emissiveIntensity: 0.1 }));
  st2.position.set(0, 0.51, -0.175);
  const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.016, 0.012), mat(COLORS.moss, 0.6));
  t2.position.set(0, 0.36, 0.251);
  const ch2Stand = standUp(packages.ch2, 0.1);
  ch2Stand.position.y += 0.36; ch2Stand.position.z = -0.02;
  ped2.add(st1, st2, t2, ch2Stand, contact(1.1, 0.9));
  plateOn(ped2, 'Ch2 · Selection Curation', 0.2, 0.252);
  group.add(ped2);
  footprint(ped2, 0.6, 0.5);
  spots.push(new THREE.Vector3(1.45, 0.6, -3.45));

  // Ch3: 가운데 낮은 노란 원형 스툴 위에 세워 둠
  const ped3 = new THREE.Group(); ped3.position.set(0, 0, -3.75); faceEntry(ped3);
  const stool = shadowedMesh(new THREE.CylinderGeometry(0.32, 0.34, 0.32, 64), mat('#F8F0C8', 0.7, { emissive: '#FFF6D6', emissiveIntensity: 0.16 }));
  stool.position.y = 0.16;
  const t3 = new THREE.Mesh(new THREE.TorusGeometry(0.325, 0.006, 8, 96), mat(COLORS.moss, 0.6));
  t3.rotation.x = Math.PI / 2; t3.position.y = 0.32;
  ped3.add(stool, t3, contact(0.9, 0.9));
  plateOn(ped3, 'Ch3 · Archive Curation', 0.17, 0.335);
  placeOn(packages.ch3, ped3, 0.32);
  group.add(ped3);
  footprint(ped3, 0.68, 0.68);
  spots.push(new THREE.Vector3(0, 0.55, -3.75));

  /* ---- 뒷벽 왼쪽: '큐레이션' 보드(큐레이션 색 9칸). 칸을 누르면 그 책이 펼쳐진다 ---- */
  const board = new THREE.Group();
  board.position.set(-3.1, 0, z1 + 0.02);
  group.add(board);
  const panel = shadowedMesh(new THREE.BoxGeometry(1.42, 1.66, 0.04), mat('#FBF5E6', 0.85, { emissive: '#FFF9EA', emissiveIntensity: 0.08 }));
  panel.position.set(0, 1.62, 0.02);
  const frameB = new THREE.Mesh(new THREE.BoxGeometry(1.46, 1.7, 0.03), mat(COLORS.moss, 0.6));
  frameB.position.set(0, 1.62, 0.0);
  board.add(frameB, panel);
  const title = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.16), new THREE.MeshBasicMaterial({ map: boardTitleTexture(), transparent: true }));
  title.position.set(0, 2.3, 0.045);
  board.add(title);
  const tiles = [];
  books.forEach((bk, i) => {
    const r = Math.floor(i / 3), c = i % 3;
    const tile = shadowedMesh(new THREE.BoxGeometry(0.36, 0.36, 0.03), [
      mat(COLORS.moss, 0.6), mat(COLORS.moss, 0.6), mat(COLORS.moss, 0.6), mat(COLORS.moss, 0.6),
      curationTileMaterial(bk.curation), mat(COLORS.moss, 0.6),
    ]);
    tile.position.set((c - 1) * 0.42, 1.98 - r * 0.42, 0.06);
    tile.userData.tileOf = bk;
    tile.userData.base = tile.position.clone();
    board.add(tile);
    tiles.push(tile);
  });

  for (const o of openables) o.group.userData.base = { p: o.group.position.clone(), r: o.group.rotation.clone() };

  // 공간에 떠 있는 아주 옅은 먼지(정지 화면처럼 보이지 않게)
  const N = 140;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * RX * 1.8;
    pos[i * 3 + 1] = Math.random() * RH * 0.9;
    pos[i * 3 + 2] = z0 - 0.5 - Math.random() * (D - 1);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#FFF6D6', size: 0.012, transparent: true, opacity: 0.55, depthWrite: false }));
  group.add(dust);

  return {
    group, openables, shelf, windows: arch.windows, obstacles, tiles, floor, packageSpots: spots,
    setNight(n) { arch.setNight(n); coveMat.color.setRGB(1, 0.95, 0.82).multiplyScalar(1 + n * 1.2); },
    update(t, dt, still) {
      arch.update(t, still);
      if (still) return;
      const a = dustGeo.attributes.position;
      for (let i = 0; i < N; i++) {
        let y = a.getY(i) + dt * 0.025 * (0.4 + (i % 5) * 0.15);
        if (y > RH * 0.9) y = 0.1;
        a.setY(i, y);
        a.setX(i, a.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.01);
      }
      a.needsUpdate = true;
    },
  };
}
