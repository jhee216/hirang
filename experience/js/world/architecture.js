// 영상 초안의 분위기를 만드는 건축 요소: 햇빛이 드는 아치 창(왼쪽 벽), 창 밖 안뜰, 오른쪽 계단과 노란 빛 아치 문,
// 모스 그린 모서리 띠, 공간에 떠 있는 종이 페이지와 책.
import * as THREE from 'three';
import { COLORS } from '../config.js';
import { archShape } from './door.js';

const mat = (color, rough = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const IVORY_LIT = { emissive: '#FFF6E2', emissiveIntensity: 0.05 };

function shadowed(m) { m.castShadow = true; m.receiveShadow = true; return m; }

// 블록 윗면 앞 모서리의 얇은 모스 그린 띠(초안의 계단·단 모서리처럼)
function trim(w, d = 0.012, h = 0.02) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(COLORS.moss, 0.6));
}

/* ---------- 떠 있는 페이지 · 책 텍스처 ---------- */
function pageTexture(highlight) {
  const W = 420, H = 580;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#FBF7EE'; x.fillRect(0, 0, W, H);
  const bar = (y, w, col) => { x.fillStyle = col; x.beginPath(); x.roundRect(46, y, w, 12, 6); x.fill(); };
  let y = 70;
  for (let i = 0; i < 14; i++) {
    if (i === 3 && highlight) { bar(y - 2, 300, '#F4E7A6'); y += 30; continue; }
    if (i === 8) { y += 26; continue; }
    bar(y, 230 + ((i * 53) % 100), '#D7D3CC');
    y += 30;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function cloudCoverTexture(bg, cloud, hill) {
  const W = 300, H = 420;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  x.fillStyle = cloud;
  x.beginPath(); x.arc(110, 250, 60, Math.PI, 0); x.arc(190, 240, 50, Math.PI, 0); x.lineTo(240, 300); x.lineTo(50, 300); x.closePath(); x.fill();
  x.fillStyle = hill;
  x.beginPath(); x.moveTo(0, 330); x.quadraticCurveTo(110, 270, 300, 320); x.lineTo(300, 420); x.lineTo(0, 420); x.closePath(); x.fill();
  x.fillStyle = 'rgba(253,249,198,0.95)';
  x.beginPath(); x.arc(220, 150, 26, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function buildArchitecture(group, ROOM) {
  const { x: RX, z0, z1, h: RH } = ROOM;
  const D = z0 - z1, cz = (z0 + z1) / 2;
  const wallMat = mat(COLORS.ivory, 0.95, IVORY_LIT);
  const revealMat = mat('#D8C9E6', 0.9, { emissive: '#E9DDF5', emissiveIntensity: 0.12 });

  /* ---- 왼쪽 벽: 바닥 가까이 내려오는 큰 아치 창 세 개. 이 창으로 햇빛이 들어와 바닥과 셸프에 아치 모양 빛을 남긴다 ---- */
  const WT = 0.32;
  const wallShape = new THREE.Shape();
  wallShape.moveTo(0, 0); wallShape.lineTo(D + 0.2, 0); wallShape.lineTo(D + 0.2, RH + 0.2); wallShape.lineTo(0, RH + 0.2); wallShape.lineTo(0, 0);
  const windows = [2.15, 3.95, 5.75];
  for (const a of windows) {
    const w = 1.12, h = 3.0, y0 = 0.32, r = w / 2;
    const p = new THREE.Path();
    p.moveTo(a - r, y0); p.lineTo(a - r, y0 + h - r); p.absarc(a, y0 + h - r, r, Math.PI, 0, true); p.lineTo(a + r, y0); p.lineTo(a - r, y0);
    wallShape.holes.push(p);
  }
  const leftWall = shadowed(new THREE.Mesh(new THREE.ExtrudeGeometry(wallShape, { depth: WT, bevelEnabled: false, curveSegments: 40 }), [wallMat, revealMat]));
  leftWall.rotation.y = Math.PI / 2;                 // 모양의 x → 장면의 -z
  leftWall.position.set(-RX - WT, 0, z0 + 0.1);
  group.add(leftWall);
  // 창턱: 모스 띠
  for (const a of windows) {
    const sill = trim(1.12, WT + 0.02, 0.025);
    sill.rotation.y = Math.PI / 2;
    sill.position.set(-RX - WT / 2, 0.32, z0 + 0.1 - a);
    group.add(sill);
  }

  /* ---- 창 밖 안뜰: 햇빛 받는 바닥, 낮은 벽, 계단 블록, 노란·라벤더 아치 ---- */
  const yard = new THREE.Group();
  const yardFloor = new THREE.Mesh(new THREE.PlaneGeometry(9, D + 4), mat('#F3E8D2', 0.9, { emissive: '#FFF1D8', emissiveIntensity: 0.12 }));
  yardFloor.rotation.x = -Math.PI / 2; yardFloor.position.set(-RX - 4.6, 0.001, cz); yardFloor.receiveShadow = true;
  const yardWall = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, D + 4), wallMat));
  yardWall.position.set(-RX - 7.6, 2.6, cz);
  const step = (x, y, z, w, h, d, m = wallMat) => { const b = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)); b.position.set(x, y + h / 2, z); yard.add(b); return b; };
  // 안뜰 계단(창 너머로 비스듬히 보이는 층계)
  for (let i = 0; i < 7; i++) step(-RX - 5.2 + i * 0.32, 0, -3.2, 0.34, 0.18 * (i + 1), 1.6);
  step(-RX - 3.0, 0, -6.4, 1.4, 1.26, 2.2);
  const yArch = new THREE.Mesh(new THREE.ShapeGeometry(archShape(1.3, 2.7), 40), new THREE.MeshBasicMaterial({ color: '#F6E7A8' }));
  yArch.rotation.y = Math.PI / 2; yArch.position.set(-RX - 7.39, 0.6, -2.2);
  const lArch = new THREE.Mesh(new THREE.ShapeGeometry(archShape(1.2, 2.4), 40), mat(COLORS.lavender, 0.9));
  lArch.rotation.y = Math.PI / 2; lArch.position.set(-RX - 7.39, 0.6, -5.6);
  yard.add(yardFloor, yardWall, yArch, lArch);
  group.add(yard);

  /* ---- 오른쪽 뒤: 모스 띠가 있는 계단 → 높은 단 → 노란 빛이 새는 아치 문 ---- */
  const stair = new THREE.Group();
  const SH = 0.2, SD = 0.24, N = 6, platX0 = RX - 1.5;
  for (let i = 0; i < N; i++) {
    const h = SH * (i + 1);
    const b = shadowed(new THREE.Mesh(new THREE.BoxGeometry(SD, h, 1.3), wallMat));
    const x = platX0 - (N - i) * SD + SD / 2;
    b.position.set(x, h / 2, z1 + 0.95);
    const t = trim(1.3, 0.02, 0.022); t.rotation.y = Math.PI / 2; t.position.set(x - SD / 2 + 0.01, h + 0.001, z1 + 0.95);
    stair.add(b, t);
  }
  const plat = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.5, SH * N, 1.9), wallMat));
  plat.position.set(RX - 0.75, SH * N / 2, z1 + 0.95);
  const platTrim = trim(1.9, 0.02, 0.022); platTrim.rotation.y = Math.PI / 2; platTrim.position.set(platX0 + 0.01, SH * N + 0.001, z1 + 0.95);
  // 오른쪽 벽의 아치 문(안쪽 노란 빛)
  const door = new THREE.Mesh(new THREE.ShapeGeometry(archShape(1.0, 2.3), 40), new THREE.MeshBasicMaterial({ color: '#F8EBB0' }));
  door.rotation.y = -Math.PI / 2; door.position.set(RX - 0.004, SH * N, z1 + 0.95);
  const doorFrame = new THREE.Mesh(new THREE.ExtrudeGeometry(archShape(1.22, 2.42), { depth: 0.03, bevelEnabled: false, curveSegments: 40 }), mat(COLORS.lavender, 0.85));
  doorFrame.rotation.y = -Math.PI / 2; doorFrame.position.set(RX - 0.001, SH * N, z1 + 0.95);
  const doorLight = new THREE.PointLight('#FFE9A8', 2.2, 3.2, 1.6);
  doorLight.position.set(RX - 0.5, SH * N + 1.2, z1 + 0.95);
  stair.add(plat, platTrim, doorFrame, door, doorLight);
  group.add(stair);

  /* ---- 공간에 떠 있는 종이 페이지와 책(천천히 떠다닌다) ---- */
  const floaters = [];
  const pageGeo = new THREE.BoxGeometry(0.26, 0.36, 0.004);
  const edge = mat(COLORS.moss, 0.6);
  const pageTex = [pageTexture(true), pageTexture(false)];
  // [x, y, z, 기울기x, 방향y] — 중간 높이에서 시선 쪽을 비스듬히 향하게
  const pagePos = [
    [-2.1, 2.85, -3.1, 0.12, 0.55], [-1.2, 3.05, -6.6, -0.1, 0.2], [2.2, 2.9, -2.9, 0.1, -0.6],
    [1.85, 3.1, -6.6, -0.08, -0.35], [-3.45, 2.95, -4.6, 0.06, 1.2], [3.2, 2.7, -4.9, -0.15, -1.0],
  ];
  pagePos.forEach(([x, y, z, rx, ry], i) => {
    const face = new THREE.MeshStandardMaterial({ map: pageTex[i % 2], roughness: 0.85, emissive: '#FFFFFF', emissiveMap: pageTex[i % 2], emissiveIntensity: 0.32 });
    const m = new THREE.Mesh(pageGeo, [edge, edge, edge, edge, face, face]);
    m.position.set(x, y, z); m.rotation.set(rx, ry, (i % 3 - 1) * 0.12);
    m.castShadow = true;
    floaters.push({ m, base: m.position.clone(), rot: m.rotation.clone(), ph: i * 1.7, amp: 0.05 + (i % 3) * 0.015 });
    group.add(m);
  });
  const covers = [
    cloudCoverTexture('#C9B8DD', '#F2EEE6', '#4F5F4C'), cloudCoverTexture('#F6EBB5', '#C9B8DD', '#F2EEE6'),
    cloudCoverTexture('#F4EFE6', '#C9B8DD', '#E9D99A'), cloudCoverTexture('#4F5F4C', '#C9B8DD', '#F6EBB5'),
  ];
  const bookGeo = new THREE.BoxGeometry(0.16, 0.22, 0.026);
  const pagesSide = mat('#F3ECDD', 0.9);
  const bookPos = [[-3.0, 3.5, -3.6, 0.4, 0.8], [2.9, 3.0, -4.0, -0.3, -1.1], [-1.6, 3.7, -4.4, 0.6, 0.2], [3.4, 3.35, -5.4, 0.2, -0.4], [-3.5, 3.3, -6.0, -0.4, 1.2]];
  bookPos.forEach(([x, y, z, rx, ry], i) => {
    const cov = new THREE.MeshStandardMaterial({ map: covers[i % covers.length], roughness: 0.75 });
    const m = new THREE.Mesh(bookGeo, [edge, pagesSide, pagesSide, pagesSide, cov, cov]);
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0.2);
    m.castShadow = true;
    floaters.push({ m, base: m.position.clone(), rot: m.rotation.clone(), ph: 3 + i * 2.1, amp: 0.06 });
    group.add(m);
  });

  const yardDay = yardFloor.material.color.clone(), yardNight = new THREE.Color('#3E4352');
  return {
    windows: windows.map((a) => z0 + 0.1 - a),
    // 밤에는 창밖 안뜰이 어두운 남색 저녁빛으로
    setNight(n) {
      yardFloor.material.color.copy(yardDay).lerp(yardNight, n * 0.85);
      yardFloor.material.emissiveIntensity = 0.12 * (1 - n);
    },
    update(t, still) {
      if (still) return;
      for (const f of floaters) {
        f.m.position.y = f.base.y + Math.sin(t * 0.45 + f.ph) * f.amp;
        f.m.rotation.x = f.rot.x + Math.sin(t * 0.3 + f.ph) * 0.06;
        f.m.rotation.y = f.rot.y + Math.sin(t * 0.22 + f.ph * 0.7) * 0.1;
      }
    },
  };
}
