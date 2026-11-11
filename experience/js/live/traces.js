// 익명의 흔적(3D): 입구 쪽 오른쪽 벽의 아주 작은 종이 조각들. 방명록이 아니다 — 읽거나 누를 수 없고, 가구도 없다.
// 2026-11-11 수정: 방 안 방명록(탁자·책·읽기/쓰기 화면)을 걷어내고 흔적만 남겼다. 방명록은 /guestbook/ 페이지.
//
// 정확한 수를 드러내지 않는다:
//  - 서버는 누적 방문 수를 '로그 단계'(0~12)로만 준다(1 → 1, 2~3 → 2, 4~7 → 3 …). 몇 명이 언제 왔는지 역산할 수 없다.
//  - 단계가 낮으면 낱장 몇 장, 높아지면 6장씩 모인 작은 무늬, 더 높아지면 하나의 고리 무늬로 합쳐진다.
//  - 조각은 최대 30장(InstancedMesh 하나, 그리기 1회) — 방문이 늘어도 형상이 끝없이 늘지 않는다.
//  - 벽 색에 가까운 종이 색·작은 크기(약 6 cm)로, 셸프·패키지 쪽 첫 구도에는 보이지 않는다(등 뒤 벽).
import * as THREE from 'three';

const PAPER = ['#F7F0DF', '#E9E0EE', '#F6F1D4', '#E3E6DA'];
const MAX = 30;
const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

function symbolGeometry(sym, width) {
  const P = ([u, v]) => new THREE.Vector2((u - 0.5) * width, (sym.aspect / 2 - v) * width);
  const step = Math.max(1, Math.floor(sym.outer.length / 90));
  const shape = new THREE.Shape(sym.outer.filter((_, i) => i % step === 0).map(P));
  shape.holes = sym.holes.map((h) => new THREE.Path(h.filter((_, i) => i % Math.max(1, Math.floor(h.length / 40)) === 0).map(P)));
  return new THREE.ShapeGeometry(shape, 3);
}

// 단계(0~12) → [y, z, 회전, 크기, 색]
function markLayout(level) {
  const rnd = mulberry(7);
  const out = [];
  const cz = -1.0, cy = 1.5;   // 오른쪽 벽(x≈4.2), 입구 가까이 · 징두리 몰딩(1.05 m) 위
  if (level <= 0) return out;
  if (level <= 4) {
    const n = [0, 1, 2, 3, 4][level];
    for (let i = 0; i < n; i++) out.push([cy + (rnd() - 0.5) * 0.3, cz + (rnd() - 0.5) * 0.36, (rnd() - 0.5) * 1.2, 0.85 + rnd() * 0.3, i % 3]);
    return out;
  }
  if (level <= 8) {
    const centers = [[0, 0], [-0.19, 0.14], [0.2, 0.11], [0.01, -0.19]];
    for (let r = 0; r < level - 4; r++) {
      const [dz, dy] = centers[r];
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2 + r * 0.4;
        out.push([cy + dy + Math.sin(a) * 0.055, cz + dz + Math.cos(a) * 0.055, a - Math.PI / 2, 0.8, (r + k) % 4]);
      }
    }
    return out;
  }
  const inner = 6, outer = Math.min(MAX - inner, 14 + (level - 9) * 3);
  const R = 0.15 + (level - 9) * 0.015;
  for (let k = 0; k < inner; k++) { const a = k / inner * Math.PI * 2; out.push([cy + Math.sin(a) * 0.065, cz + Math.cos(a) * 0.065, a - Math.PI / 2, 0.75, 2]); }
  for (let k = 0; k < outer; k++) { const a = k / outer * Math.PI * 2 + 0.2; out.push([cy + Math.sin(a) * R, cz + Math.cos(a) * R, a + Math.PI / 2, 0.9, k % 2 ? 1 : 0]); }
  return out.slice(0, MAX);
}

export function buildTraces({ sym }) {
  const group = new THREE.Group();
  group.name = 'anonymous-traces';
  group.userData.noPick = true;
  const marks = new THREE.InstancedMesh(symbolGeometry(sym, 0.06),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, side: THREE.DoubleSide }), MAX);
  marks.count = 0;
  marks.frustumCulled = false;   // 인스턴스를 나중에 배치하므로(처음 경계구가 비어 통째로 잘리던 문제)
  marks.userData.noPick = true;
  marks.receiveShadow = true;
  group.add(marks);

  const WALL_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0));   // 면이 방 안(−x)을 향한다
  const Z = new THREE.Vector3(0, 0, 1);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _spin = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  let level = 0;
  return {
    group, marks,
    level: () => level,
    setTrace(tr) {
      if (!tr) return;
      level = Math.max(0, Math.min(12, tr.visits | 0));
      const L = markLayout(level);
      L.forEach(([y, z, r, s, ci], i) => {
        _q.copy(WALL_Q).multiply(_spin.setFromAxisAngle(Z, r));
        _p.set(4.193 - (i % 3) * 0.0012, y, z); _s.setScalar(s);
        marks.setMatrixAt(i, _m.compose(_p, _q, _s));
        marks.setColorAt(i, _c.set(PAPER[ci % PAPER.length]));
      });
      marks.count = L.length;
      marks.instanceMatrix.needsUpdate = true;
      if (marks.instanceColor) marks.instanceColor.needsUpdate = true;
    },
  };
}
