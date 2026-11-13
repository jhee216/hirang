// 공간을 둘러보는 관람객: 작고 귀여운 아바타(큰 머리·점 눈·볼 터치)에 브랜드 색 옷.
// 몇 명은 전시물 앞에 서서 보고, 한 명은 천천히 걸어 다닌다. 클릭 대상이 아니며(noPick), 서 있는 사람은 걷기 경로에서 피한다.
import * as THREE from 'three';

import { sharedMat } from '../mat-cache.js';
// 2.0: 같은 색 재질 공유(관람객 5~7명이 같은 색을 많이 쓴다)
const mat = (c, r = 0.85) => sharedMat(c, r, { emissive: c, emissiveIntensity: 0.12 });

// 하이랑 관람객 캐릭터(약 1m): 콩·달걀·동그라미 머리, 모자·머리 모양·눈·옷·소품을 조합해 저마다 다르게
// 2026-11-13: 방명록 라운지(guestbook/lounge/visitors.js)도 같은 캐릭터를 쓴다
export function figure({ skin = '#F1DCC8', head = 'round', hair = 'bun', hairColor = '#4A3A2E', hat = '#C1B1D1',
  eyes = 'dot', outfit = 'coat', top = '#4F5F4C', bottom = '#F4EEE2', extra = null, height = 1.0 }) {
  const s = height;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mTop = mat(top), mBottom = mat(bottom), mSkin = mat(skin, 0.7), mHair = mat(hairColor, 0.8), mHat = mat(hat, 0.75);
  const cap = (r, len, m) => { const g = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), m); g.castShadow = true; return g; };
  const add = (parent, mesh, x, y, z) => { mesh.position.set(x * s, y * s, z * s); mesh.castShadow = true; parent.add(mesh); return mesh; };
  // 다리
  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.065 * s, 0.3 * s, 0);
    const leg = cap(0.05 * s, 0.14 * s, outfit === 'dress' ? mSkin : mBottom);
    leg.position.y = -0.13 * s; hip.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.06 * s, 0.15 * s), mat('#5A4A3E', 0.7));
    shoe.geometry.translate(0, 0, 0.02 * s);
    add(hip, shoe, 0, -0.26, 0.0);
    body.add(hip);
    return hip;
  });
  // 옷
  if (outfit === 'dress') {
    add(body, new THREE.Mesh(new THREE.ConeGeometry(0.19 * s, 0.36 * s, 28, 1, true), mTop), 0, 0.42, 0).material.side = THREE.DoubleSide;
    add(body, new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.12 * s, 0.12 * s, 20), mTop), 0, 0.56, 0);
  } else if (outfit === 'overalls') {
    add(body, new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.14 * s, 0.32 * s, 22), mat('#F6F0E2')), 0, 0.45, 0);
    add(body, new THREE.Mesh(new THREE.CylinderGeometry(0.142 * s, 0.15 * s, 0.17 * s, 22), mBottom), 0, 0.37, 0);
    add(body, new THREE.Mesh(new THREE.BoxGeometry(0.15 * s, 0.12 * s, 0.03 * s), mBottom), 0, 0.5, 0.115);
    for (const side of [-1, 1]) add(body, new THREE.Mesh(new THREE.BoxGeometry(0.025 * s, 0.16 * s, 0.02 * s), mBottom), side * 0.06, 0.55, 0.11);
  } else {
    // 코트·카디건: 아래로 퍼지는 몸통 + 가운데 단추 줄
    add(body, new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.165 * s, 0.34 * s, 24), mTop), 0, 0.44, 0);
    for (let k = 0; k < 3; k++) add(body, new THREE.Mesh(new THREE.SphereGeometry(0.012 * s, 8, 6), mat('#F6EEDA')), 0, 0.53 - k * 0.07, 0.125 + k * 0.01);
  }
  // 팔
  const arms = [-1, 1].map((side) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.13 * s, 0.57 * s, 0);
    const arm = cap(0.038 * s, 0.12 * s, outfit === 'dress' ? mSkin : (outfit === 'overalls' ? mat('#F6F0E2') : mTop));
    arm.position.y = -0.09 * s; sh.add(arm);
    add(sh, new THREE.Mesh(new THREE.SphereGeometry(0.04 * s, 12, 10), mSkin), 0, -0.19, 0);
    body.add(sh);
    return sh;
  });
  // 머리
  const headG = new THREE.Group();
  headG.position.y = 0.62 * s;
  let face;
  if (head === 'bean') {
    face = add(headG, new THREE.Mesh(new THREE.CapsuleGeometry(0.13 * s, 0.1 * s, 8, 20), mSkin), 0, 0.18, 0);
    face.rotation.z = Math.PI / 2; face.scale.set(1, 1, 0.9);
  } else if (head === 'egg') {
    face = add(headG, new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 28, 22), mSkin), 0, 0.19, 0);
    face.scale.set(0.95, 1.15, 0.92);
  } else {
    face = add(headG, new THREE.Mesh(new THREE.SphereGeometry(0.165 * s, 28, 22), mSkin), 0, 0.18, 0);
  }
  const fz = 0.15;   // 얼굴 앞면 깊이
  // 머리 모양 · 모자
  if (hair === 'bun') {
    add(headG, new THREE.Mesh(new THREE.SphereGeometry(0.168 * s, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), mHair), 0, 0.2, -0.015);
    add(headG, new THREE.Mesh(new THREE.SphereGeometry(0.075 * s, 18, 14), mHair), 0, 0.37, -0.04);
  } else if (hair === 'bob') {
    const b = add(headG, new THREE.Mesh(new THREE.CylinderGeometry(0.175 * s, 0.185 * s, 0.17 * s, 26, 1, true), mHair), 0, 0.16, -0.01);
    b.material = b.material.clone(); b.material.side = THREE.DoubleSide;
    add(headG, new THREE.Mesh(new THREE.SphereGeometry(0.176 * s, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), mHair), 0, 0.24, -0.01);
  } else if (hair === 'beret') {
    add(headG, new THREE.Mesh(new THREE.SphereGeometry(0.168 * s, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), mHair), 0, 0.19, -0.02);
    const br = add(headG, new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.17 * s, 0.05 * s, 28), mHat), 0.03, 0.32, -0.01);
    br.rotation.z = -0.28;
    add(headG, new THREE.Mesh(new THREE.SphereGeometry(0.018 * s, 8, 6), mHat), 0.05, 0.36, 0);
  } else if (hair === 'bucket') {
    add(headG, new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.17 * s, 0.13 * s, 28), mHat), 0, 0.3, 0);
    add(headG, new THREE.Mesh(new THREE.CylinderGeometry(0.235 * s, 0.24 * s, 0.018 * s, 32), mHat), 0, 0.24, 0);
  } else if (hair === 'band') {
    add(headG, new THREE.Mesh(new THREE.SphereGeometry(0.168 * s, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), mHair), 0, 0.2, -0.015);
    const band = add(headG, new THREE.Mesh(new THREE.TorusGeometry(0.17 * s, 0.014 * s, 8, 32, Math.PI), mHat), 0, 0.2, 0.02);
    band.rotation.y = Math.PI / 2;
    for (const side of [-1, 1]) add(headG, new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.035 * s, 18), mHat), side * 0.17, 0.18, 0.02).rotation.z = Math.PI / 2;
  }
  // 눈: 점 / 웃는 반달 / 동그란 안경
  const ink = new THREE.MeshBasicMaterial({ color: '#2E2924' });
  for (const side of [-1, 1]) {
    if (eyes === 'arc') {
      const e = add(headG, new THREE.Mesh(new THREE.TorusGeometry(0.02 * s, 0.005 * s, 6, 12, Math.PI), ink), side * 0.055, 0.17, fz);
      e.rotation.z = 0;
    } else {
      add(headG, new THREE.Mesh(new THREE.SphereGeometry(0.014 * s, 10, 8), ink), side * 0.055, 0.17, fz).scale.set(1, 1.2, 0.5);
    }
    if (eyes === 'glasses') add(headG, new THREE.Mesh(new THREE.TorusGeometry(0.032 * s, 0.005 * s, 6, 20), mat('#5B4A3A', 0.5)), side * 0.055, 0.17, fz + 0.01);
  }
  // 작은 입
  add(headG, new THREE.Mesh(new THREE.TorusGeometry(0.014 * s, 0.004 * s, 6, 10, Math.PI), ink), 0, 0.125, fz - 0.002).rotation.z = Math.PI;
  body.add(headG);
  // 소품
  if (extra === 'tote') {
    const bag = add(body, new THREE.Mesh(new THREE.BoxGeometry(0.15 * s, 0.17 * s, 0.035 * s), mat('#EFE6CF', 0.9)), 0.17, 0.33, 0.02);
    add(bag, new THREE.Mesh(new THREE.TorusGeometry(0.035 * s, 0.006 * s, 6, 16, Math.PI), mat('#4F5F4C')), 0, 0.085, 0);
  } else if (extra === 'scarf') {
    const sc = add(body, new THREE.Mesh(new THREE.TorusGeometry(0.1 * s, 0.03 * s, 10, 24), mat('#C1B1D1')), 0, 0.62, 0);
    sc.rotation.x = Math.PI / 2;
    add(body, new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.12 * s, 0.03 * s), mat('#C1B1D1')), 0.05, 0.53, 0.11);
  } else if (extra === 'book') {
    const bk = add(arms[1], new THREE.Mesh(new THREE.BoxGeometry(0.09 * s, 0.12 * s, 0.02 * s), mat('#EFCAC4')), -0.06, -0.2, 0.04);
    bk.rotation.y = 0.3;
  }
  root.traverse((o) => { o.userData.noPick = true; });
  return { root, body, legs, arms, head: headG };
}

// 관람객 캐릭터 일곱 가지(동시에 3~6명이 머문다)
export const LOOKS = [
  { head: 'bean', hair: 'beret', hat: '#C1B1D1', hairColor: '#3E3029', eyes: 'arc', outfit: 'dress', top: '#F4EEE2', extra: 'book', height: 0.98 },
  { head: 'egg', hair: 'bun', hairColor: '#5C4434', eyes: 'glasses', outfit: 'coat', top: '#4F5F4C', bottom: '#E9DFC9', extra: 'tote', skin: '#E3C4A6', height: 1.02 },
  { head: 'round', hair: 'bucket', hat: '#EFE5A2', eyes: 'dot', outfit: 'overalls', bottom: '#4F5F4C', skin: '#F3E0CC', height: 0.94 },
  { head: 'bean', hair: 'bob', hairColor: '#A07A58', eyes: 'dot', outfit: 'coat', top: '#E2D5C3', bottom: '#5D5A51', extra: 'scarf', skin: '#D9B192', height: 1.0 },
  { head: 'round', hair: 'band', hat: '#4F5F4C', hairColor: '#2F2823', eyes: 'arc', outfit: 'dress', top: '#B49DC2', skin: '#EBCDB3', height: 0.97 },
  { head: 'egg', hair: 'beret', hat: '#4F5F4C', hairColor: '#6B4F3A', eyes: 'dot', outfit: 'overalls', bottom: '#C1B1D1', skin: '#F1DCC8', extra: 'tote', height: 0.96 },
  { head: 'round', hair: 'bob', hairColor: '#2E2724', eyes: 'glasses', outfit: 'dress', top: '#EFE5A2', skin: '#E8C8AA', extra: 'book', height: 1.01 },
];

// 2.0 최종(3차): 관람객이 다시 드나든다. 단, 정문(관람자의 카메라가 서는 곳)이 아니라
// 오른쪽 뒤 계단 위의 노란 빛 아치 문으로 들어오고 나간다 → 첫 실내 구도·셸프 정면·패키지 앞을 가로지르지 않는다.
// 통로는 셸프 뒤와 양옆 벽 쪽 통로뿐. 노드 = [x, z, 높이 y](계단은 높이가 바뀐다)
const ENTER_FROM_DOOR = true;
const NODES = {
  OUT: [4.12, -6.85, 1.2], PLAT: [3.25, -6.85, 1.2], STT: [2.62, -6.85, 1.2], STB: [1.02, -6.85, 0],
  BC: [0, -6.45], RG: [1.42, -5.82], BL2: [-2.05, -6.3],
  LW: [-2.78, -5.25], LW2: [-2.78, -4.3], LM: [-2.62, -3.72], LWB: [-3.3, -3.55], LWF: [-3.3, -1.45], LF: [-1.9, -1.45],
  // 2026-11-11: 정문(출구)으로도 드나든다 — 문 밖 DOOR → 문턱 안 DIN → 양옆 테이블 앞 통로
  DOOR: [0, 1.0], DIN: [0, -0.75],
  BR: [2.6, -5.35], RW2: [2.78, -4.3], RM: [2.62, -3.72], RWB: [3.3, -3.55], RWF: [3.3, -1.45], RF: [1.9, -1.45],
};
// (테이블로 갈 때는 벽 쪽으로 돌아 앞에서 들어간다 — 입구에서 보는 Ch1·Ch2 시선(약 29°)과 셸프 정면을 가로지르지 않게. 뒤쪽 통로·뒷벽 큐레이션 앞은 첫 구도 가장자리에 멀리 보인다)
const EDGES = [['OUT', 'PLAT'], ['PLAT', 'STT'], ['STT', 'STB'], ['STB', 'BC'], ['STB', 'RG'], ['BC', 'BL2'],
  ['BL2', 'LW'], ['LW', 'LW2'], ['LW2', 'LM'], ['LM', 'LWB'], ['LWB', 'LWF'], ['LWF', 'LF'],
  ['RG', 'BR'], ['BR', 'RW2'], ['RW2', 'RM'], ['RM', 'RWB'], ['RWB', 'RWF'], ['RWF', 'RF'],
  ['DOOR', 'DIN'], ['DIN', 'LF'], ['DIN', 'RF']];
const EXITS = ['OUT', 'DOOR'];   // 계단 위 아치 문 · 정문(출구)
// [노드, 서는 자리 x, z, 바라보는 곳 x, z, 자세] — 양옆 큐레이션 테이블, Ch1·Ch2를 바깥쪽에서, 뒷벽 큐레이션
const SPOTS = [
  ['LF', -1.95, -2.2, -2.6, -2.2, 'read'], ['LF', -1.95, -2.95, -2.6, -2.95, 'read'],
  ['RF', 1.95, -2.3, 2.6, -2.3, 'read'], ['RF', 1.95, -2.95, 2.6, -2.95, 'read'],
  ['LM', -2.62, -3.72, -1.85, -3.9, 'look'], ['RM', 2.62, -3.72, 1.85, -3.9, 'look'],
  ['BL2', -2.6, -6.75, -3.1, -7.8, 'look'], ['BL2', -1.95, -6.9, -3.1, -7.8, 'look'],
];
const adj = {};
for (const [a, b] of EDGES) { (adj[a] ||= []).push(b); (adj[b] ||= []).push(a); }
function route(from, to) {
  const prev = { [from]: null }, q = [from];
  while (q.length) { const n = q.shift(); if (n === to) break; for (const m of adj[n]) if (!(m in prev)) { prev[m] = n; q.push(m); } }
  const path = []; for (let n = to; n; n = prev[n]) path.unshift(n);
  return path;
}
const V = (n) => new THREE.Vector3(n[0], n[2] || 0, n[1]);
const rand = (a, b) => a + Math.random() * (b - a);

// 2026-11-11 라이브: 장식용으로 지어낸 관람객을 없애고, 지금 실제로 접속한 다른 방문자만 그린다(최대 5명).
// 서버가 주는 값은 '나에게만 의미 있는' 무작위 토큰뿐 → 이름·계정·세션 식별자를 알 수 없다.
// 같은 토큰은 같은 모습(접속이 이어지는 동안 같은 캐릭터)으로 그린다. 아무도 없으면 아무도 그리지 않는다.
const MAX = 5;
const tokenHash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export function buildPeople(group) {
  const people = [];
  const taken = new Set();
  let active = false, visible = true;
  let want = [];              // 서버가 알려 준 지금 접속 중인 다른 방문자(토큰)

  function pose(p, kind) {
    if (kind === 'read') { p.arms.forEach((a, i) => { a.rotation.x = -1.0; a.rotation.z = (i ? -1 : 1) * 0.3; }); p.head.rotation.x = 0.15; }
    else if (kind === 'look') { p.arms.forEach((a, i) => { a.rotation.x = 0; a.rotation.z = (i ? 1 : -1) * 0.25; }); p.head.rotation.x = -0.25; }
    else { p.head.rotation.x = 0; p.arms.forEach((a) => { a.rotation.z = 0; }); }
  }
  function freeSpot() {
    const free = SPOTS.map((sp, i) => i).filter((i) => !taken.has(i));
    return free.length ? free[Math.floor(Math.random() * free.length)] : -1;
  }
  function goTo(p, node, final) {
    const path = route(p.node, node).slice(1).map((n) => V(NODES[n]));
    if (final) path.push(final);
    p.path = path; p.dest = node; p.mode = 'walk'; pose(p, 'walk');
  }
  // 접속이 이어지는 동안은 나가지 않고 빈자리를 옮겨 다니며 구경한다. 접속이 끝나면(leaving) 출구로 걸어 나간다
  function nextAction(p) {
    if (p.spot >= 0) { taken.delete(p.spot); p.spot = -1; }
    if (p.leaving) { goTo(p, p.exit); return; }
    const i = freeSpot();
    if (i < 0) { p.mode = 'stay'; p.wait = rand(4, 8); return; }
    const sp = SPOTS[i];
    taken.add(i); p.spot = i;
    goTo(p, sp[0], new THREE.Vector3(sp[1], 0, sp[2]));
  }
  function pickLook(token) {
    const used = new Set(people.filter((p) => !p.leaving).map((p) => p.lookIdx));
    let k = tokenHash(token) % LOOKS.length;
    for (let n = 0; n < LOOKS.length && used.has(k); n++) k = (k + 1) % LOOKS.length;
    return k;
  }
  function spawn(token, inside) {
    const lookIdx = pickLook(token);
    const f = figure(LOOKS[lookIdx]);
    f.root.visible = visible;
    group.add(f.root);
    const exit = EXITS[tokenHash(token + 'x') % EXITS.length];
    const p = { ...f, token, lookIdx, exit, node: exit, path: [], mode: 'walk', spot: -1, leaving: false, wait: 0, ph: Math.random() * 10 };
    const at = inside ? freeSpot() : -1;
    if (at >= 0) {
      // 내가 들어오기 전부터 있던 방문자: 자리에서 구경 중
      const sp = SPOTS[at]; taken.add(at); p.spot = at; p.node = sp[0];
      f.root.position.set(sp[1], 0, sp[2]);
      f.root.rotation.y = Math.atan2(sp[3] - sp[1], sp[4] - sp[2]);
      p.mode = 'stay'; p.wait = rand(4, 12); pose(p, sp[5]);
    } else {
      // 내가 안에 있는 동안 새로 들어온 방문자: 문으로 걸어 들어온다
      f.root.position.copy(V(NODES[exit]));
      f.root.rotation.y = exit === 'DOOR' ? Math.PI : -Math.PI / 2;
      nextAction(p);
    }
    people.push(p);
  }
  function remove(p) {
    group.remove(p.root);
    p.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    if (p.spot >= 0) taken.delete(p.spot);
    people.splice(people.indexOf(p), 1);
  }
  // 원하는 집합(want)과 그려진 사람을 맞춘다
  function reconcile() {
    const wantSet = new Set(want);
    for (const p of [...people]) {
      if (wantSet.has(p.token) || p.leaving) continue;
      if (!active || !visible) { remove(p); continue; }   // 보이지 않을 때는 바로 지운다
      p.leaving = true;
      if (p.mode === 'stay') nextAction(p);
      else { // 걷던 길을 멈추고 출구로
        p.path = []; p.dest = null; p.node = nearestNode(p.root.position); goTo(p, p.exit);
      }
    }
    for (const tok of want) {
      if (people.some((p) => p.token === tok && !p.leaving)) continue;
      const back = people.find((p) => p.token === tok && p.leaving);
      if (back) { back.leaving = false; nextAction(back); continue; }   // 잠깐 끊겼다 다시 이어진 방문자
      if (people.filter((p) => !p.leaving).length >= MAX) break;
      spawn(tok, !active);
    }
  }
  function nearestNode(pos) {
    let best = null, bd = Infinity;
    for (const [k, n] of Object.entries(NODES)) { const d = Math.hypot(n[0] - pos.x, n[1] - pos.z); if (d < bd) { bd = d; best = k; } }
    return best;
  }

  return {
    obstacles: [],
    setActive(on) { if (active !== on) { active = on; } },
    setVisible(v) { visible = v; for (const p of people) p.root.visible = v; },
    // 서버에서 받은 다른 방문자 토큰 목록(최대 5)
    setFigures(tokens) { want = (tokens || []).slice(0, MAX); reconcile(); },
    count: () => people.filter((p) => !p.leaving).length,
    debug: () => ({ active, want: want.length, people: people.map((p) => ({ look: p.lookIdx, mode: p.mode, node: p.node, dest: p.dest, spot: p.spot, leaving: p.leaving, x: +p.root.position.x.toFixed(2), z: +p.root.position.z.toFixed(2) })) }),
    update(t, dt, still) {
      for (const p of [...people]) {
        if (p.mode === 'stay') {
          p.wait -= dt;
          if (!still) {
            p.body.position.y = Math.abs(Math.sin(t * 1.4 + p.ph)) * 0.008;
            p.head.rotation.y = Math.sin(t * 0.3 + p.ph) * 0.35;
          }
          p.legs.forEach((l) => { l.rotation.x *= 0.85; });
          if (p.wait <= 0 && (active || p.leaving)) nextAction(p);
          continue;
        }
        const tgt = p.path[0];
        if (!tgt) {
          if (p.leaving && p.dest === p.exit) { remove(p); continue; }
          p.node = p.dest || p.node;
          const sp = SPOTS[p.spot];
          if (sp) {
            p.mode = 'stay'; p.wait = rand(6, 14); pose(p, sp[5]);
            p.turnTo = Math.atan2(sp[3] - sp[1], sp[4] - sp[2]);
          } else { p.mode = 'stay'; p.wait = 1; }
          continue;
        }
        const pos = p.root.position;
        const dx = tgt.x - pos.x, dz = tgt.z - pos.z, d = Math.hypot(dx, dz);
        if (d < 0.03) { pos.y = tgt.y; p.path.shift(); continue; }
        // 움직임 줄이기 설정이면 걸음 흔들림 없이 미끄러지듯 이동만
        const step = Math.min(d, 0.42 * dt);
        pos.x += dx / d * step; pos.z += dz / d * step;
        pos.y += (tgt.y - pos.y) * (step / d);
        const yaw = Math.atan2(dx, dz);
        p.root.rotation.y += Math.atan2(Math.sin(yaw - p.root.rotation.y), Math.cos(yaw - p.root.rotation.y)) * Math.min(1, dt * 5);
        if (!still) {
          p.ph += step * 12;
          p.legs[0].rotation.x = Math.sin(p.ph) * 0.42; p.legs[1].rotation.x = -Math.sin(p.ph) * 0.42;
          p.arms[0].rotation.x = -Math.sin(p.ph) * 0.32; p.arms[1].rotation.x = Math.sin(p.ph) * 0.32;
          p.body.position.y = Math.abs(Math.cos(p.ph)) * 0.02;
          p.body.rotation.z = Math.sin(p.ph) * 0.05;
        }
      }
      for (const p of people) if (p.mode === 'stay' && p.turnTo != null) {
        p.root.rotation.y += Math.atan2(Math.sin(p.turnTo - p.root.rotation.y), Math.cos(p.turnTo - p.root.rotation.y)) * Math.min(1, dt * 3);
        p.body.rotation.z *= 0.9;
      }
    },
  };
}
