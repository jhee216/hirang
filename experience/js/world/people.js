// 공간을 둘러보는 관람객: 작고 귀여운 아바타(큰 머리·점 눈·볼 터치)에 브랜드 색 옷.
// 몇 명은 전시물 앞에 서서 보고, 한 명은 천천히 걸어 다닌다. 클릭 대상이 아니며(noPick), 서 있는 사람은 걷기 경로에서 피한다.
import * as THREE from 'three';

const mat = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r, emissive: c, emissiveIntensity: 0.12 });

// 하이랑 관람객 캐릭터(약 1m): 콩·달걀·동그라미 머리, 모자·머리 모양·눈·옷·소품을 조합해 저마다 다르게
function figure({ skin = '#F1DCC8', head = 'round', hair = 'bun', hairColor = '#4A3A2E', hat = '#C1B1D1',
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
const LOOKS = [
  { head: 'bean', hair: 'beret', hat: '#C1B1D1', hairColor: '#3E3029', eyes: 'arc', outfit: 'dress', top: '#F4EEE2', extra: 'book', height: 0.98 },
  { head: 'egg', hair: 'bun', hairColor: '#5C4434', eyes: 'glasses', outfit: 'coat', top: '#4F5F4C', bottom: '#E9DFC9', extra: 'tote', skin: '#E3C4A6', height: 1.02 },
  { head: 'round', hair: 'bucket', hat: '#EFE5A2', eyes: 'dot', outfit: 'overalls', bottom: '#4F5F4C', skin: '#F3E0CC', height: 0.94 },
  { head: 'bean', hair: 'bob', hairColor: '#A07A58', eyes: 'dot', outfit: 'coat', top: '#E2D5C3', bottom: '#5D5A51', extra: 'scarf', skin: '#D9B192', height: 1.0 },
  { head: 'round', hair: 'band', hat: '#4F5F4C', hairColor: '#2F2823', eyes: 'arc', outfit: 'dress', top: '#B49DC2', skin: '#EBCDB3', height: 0.97 },
  { head: 'egg', hair: 'beret', hat: '#4F5F4C', hairColor: '#6B4F3A', eyes: 'dot', outfit: 'overalls', bottom: '#C1B1D1', skin: '#F1DCC8', extra: 'tote', height: 0.96 },
  { head: 'round', hair: 'bob', hairColor: '#2E2724', eyes: 'glasses', outfit: 'dress', top: '#EFE5A2', skin: '#E8C8AA', extra: 'book', height: 1.01 },
];

// 걷는 길(전시물을 피하는 통로)과 바라보는 자리
const NODES = {
  OUT: [0, 1.7], DOOR: [0, 0.15], E: [0, -0.9], F: [0, -1.9],
  LF: [-0.8, -2.2], LB: [-0.8, -4.3], RF: [0.8, -2.2], RB: [0.8, -4.3], B: [0, -4.4],
  BL: [-1.9, -4.6], BL2: [-1.95, -5.85], BR: [1.9, -4.6], BR2: [1.95, -5.6],
};
const EDGES = [['OUT', 'DOOR'], ['DOOR', 'E'], ['E', 'F'], ['F', 'LF'], ['F', 'RF'], ['LF', 'LB'], ['RF', 'RB'], ['LB', 'B'], ['RB', 'B'],
  ['LB', 'BL'], ['BL', 'BL2'], ['RB', 'BR'], ['BR', 'BR2'], ['BL2', 'BR2']];
// [노드, 서는 자리 x, z, 바라보는 곳 x, z, 자세]
const SPOTS = [
  ['LF', -1.95, -2.2, -2.6, -2.2, 'read'], ['LF', -1.95, -3.0, -2.6, -3.0, 'read'],
  ['RF', 1.95, -2.3, 2.6, -2.3, 'read'], ['RF', 1.95, -2.95, 2.6, -2.95, 'read'],
  ['LF', -0.95, -2.85, -1.45, -3.45, 'look'], ['RF', 0.95, -2.85, 1.45, -3.45, 'look'], ['F', 0.3, -2.95, 0, -3.75, 'look'],
  ['B', -0.7, -4.6, -0.7, -5.2, 'look'], ['B', 0.7, -4.6, 0.7, -5.2, 'look'],
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
const V = (xz) => new THREE.Vector3(xz[0], 0, xz[1]);
const rand = (a, b) => a + Math.random() * (b - a);

export function buildPeople(group) {
  const people = [];
  const taken = new Set();
  let active = false, spawnT = 6, cap = 4;

  function pose(p, kind) {
    if (kind === 'read') { p.arms.forEach((a, i) => { a.rotation.x = -1.0; a.rotation.z = (i ? -1 : 1) * 0.3; }); p.head.rotation.x = 0.15; }
    else if (kind === 'look') { p.arms.forEach((a, i) => { a.rotation.x = 0; a.rotation.z = (i ? 1 : -1) * 0.25; }); p.head.rotation.x = -0.25; }
    else { p.head.rotation.x = 0; p.arms.forEach((a) => { a.rotation.z = 0; }); }
  }
  function freeSpot() {
    const free = SPOTS.map((sp, i) => i).filter((i) => !taken.has(i));
    return free.length ? free[Math.floor(Math.random() * free.length)] : -1;
  }
  // 경로 지정: 지금 노드에서 목표 노드까지 통로를 따라, 마지막에 자리로
  function goTo(p, node, final) {
    const path = route(p.node, node).slice(1).map((n) => V(NODES[n]));
    if (final) path.push(final);
    p.path = path; p.dest = node; p.mode = 'walk'; pose(p, 'walk');
  }
  function nextAction(p) {
    if (p.spot >= 0) { taken.delete(p.spot); p.spot = -1; }
    if (p.visits <= 0 || !active) { goTo(p, 'OUT'); p.leaving = true; return; }
    const i = freeSpot();
    if (i < 0) { goTo(p, 'OUT'); p.leaving = true; return; }
    const sp = SPOTS[i];
    taken.add(i); p.spot = i; p.visits--;
    goTo(p, sp[0], new THREE.Vector3(sp[1], 0, sp[2]));
  }
  function spawn(look, at) {
    const f = figure(look);
    group.add(f.root);
    const p = { ...f, look, node: 'OUT', path: [], mode: 'walk', spot: -1, visits: 2 + Math.floor(Math.random() * 3), leaving: false, wait: 0, ph: Math.random() * 10 };
    if (at != null) {
      // 처음부터 안에 있는 사람: 자리에서 구경 중
      const sp = SPOTS[at]; taken.add(at); p.spot = at; p.node = sp[0];
      f.root.position.set(sp[1], 0, sp[2]);
      f.root.rotation.y = Math.atan2(sp[3] - sp[1], sp[4] - sp[2]);
      p.mode = 'stay'; p.wait = rand(2, 9); pose(p, sp[5]);
    } else {
      f.root.position.copy(V(NODES.OUT));
      f.root.rotation.y = Math.PI;
      nextAction(p);
    }
    people.push(p);
  }
  // 처음 안에 있는 다섯 명
  [0, 1, 2, 3, 4].forEach((k, i) => spawn(LOOKS[k], [0, 7, 9, 3, 5][i]));

  function remove(p) {
    group.remove(p.root);
    if (p.spot >= 0) taken.delete(p.spot);
    people.splice(people.indexOf(p), 1);
  }

  return {
    obstacles: [],
    // 플레이어가 안에 들어온 동안에만 드나든다(문이 열려 있을 때)
    setActive(on) { active = on; },
    count: () => people.length,
    debug: () => ({ active, cap, spawnT, people: people.map((p) => ({ mode: p.mode, wait: +p.wait.toFixed(1), node: p.node, dest: p.dest, spot: p.spot, path: p.path.length, leaving: p.leaving })) }),
    update(t, dt, still) {
      if (still) return;
      // 드나들기: 가끔 새 관람객이 문으로 들어온다. 머무는 인원 상한도 천천히 바뀐다
      if (active) {
        spawnT -= dt;
        if (spawnT <= 0) {
          spawnT = rand(7, 14);
          if (Math.random() < 0.3) cap = 3 + Math.floor(Math.random() * 4);
          const inside = people.filter((p) => !p.leaving).length;
          if (inside < cap) {
            const used = new Set(people.map((p) => p.look));
            const pool = LOOKS.filter((l) => !used.has(l));
            if (pool.length) spawn(pool[Math.floor(Math.random() * pool.length)]);
          }
        }
      }
      for (const p of [...people]) {
        if (p.mode === 'stay') {
          p.wait -= dt;
          p.body.position.y = Math.abs(Math.sin(t * 1.4 + p.ph)) * 0.008;
          p.head.rotation.y = Math.sin(t * 0.3 + p.ph) * 0.35;
          p.legs.forEach((l) => { l.rotation.x *= 0.85; });
          if (p.wait <= 0 && active) nextAction(p);
          continue;
        }
        // 걷기
        const tgt = p.path[0];
        if (!tgt) {
          if (p.leaving && p.dest === 'OUT') { remove(p); continue; }
          p.node = p.dest;
          const sp = SPOTS[p.spot];
          if (sp) {
            p.mode = 'stay'; p.wait = rand(5, 11); pose(p, sp[5]);
            const want = Math.atan2(sp[3] - sp[1], sp[4] - sp[2]);
            p.turnTo = want;
          } else { p.mode = 'stay'; p.wait = 1; }
          continue;
        }
        const pos = p.root.position;
        const dx = tgt.x - pos.x, dz = tgt.z - pos.z, d = Math.hypot(dx, dz);
        if (d < 0.03) { p.path.shift(); continue; }
        const step = Math.min(d, 0.42 * dt);
        pos.x += dx / d * step; pos.z += dz / d * step;
        const yaw = Math.atan2(dx, dz);
        p.root.rotation.y += Math.atan2(Math.sin(yaw - p.root.rotation.y), Math.cos(yaw - p.root.rotation.y)) * Math.min(1, dt * 5);
        p.ph += step * 12;
        p.legs[0].rotation.x = Math.sin(p.ph) * 0.42; p.legs[1].rotation.x = -Math.sin(p.ph) * 0.42;
        p.arms[0].rotation.x = -Math.sin(p.ph) * 0.32; p.arms[1].rotation.x = Math.sin(p.ph) * 0.32;
        p.body.position.y = Math.abs(Math.cos(p.ph)) * 0.02;
        p.body.rotation.z = Math.sin(p.ph) * 0.05;
      }
      // 자리에 선 사람은 전시물 쪽으로 천천히 돌아선다
      for (const p of people) if (p.mode === 'stay' && p.turnTo != null) {
        p.root.rotation.y += Math.atan2(Math.sin(p.turnTo - p.root.rotation.y), Math.cos(p.turnTo - p.root.rotation.y)) * Math.min(1, dt * 3);
        p.body.rotation.z *= 0.9;
      }
    },
  };
}
