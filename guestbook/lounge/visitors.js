// 라운지의 실제 접속자: 원래 3D 독서구역과 같은 캐릭터(experience/js/world/people.js)를 그대로 쓴다.
// 서버가 주는 것은 '나를 뺀 다른 방문자 최대 5명'의 무작위 토큰뿐(이름·계정·식별자 없음).
// 다른 방문자는 의자에 앉지 않는다 — 앉기·쓰기·읽기는 각자의 화면에서 일어나므로 의자를 서로 차지하지 않는다.
// 이들은 뒷벽 통로로 들어와 받침의 방명록·벽감 스티커·창가를 둘러보고, 접속이 끝나면 통로로 나간다.
import * as THREE from 'three';
import { figure, LOOKS } from '../../experience/js/world/people.js';

const NODES = {
  P: [1.45, -6.25], IN: [1.45, -4.85], BK: [0.15, -4.75], AL: [-0.85, -4.7],
  R1: [1.95, -3.95], R2: [1.95, -2.3], FR: [1.0, -1.35], FL: [-0.9, -1.15], WL: [-1.25, -0.8],
};
const EDGES = [['P', 'IN'], ['IN', 'BK'], ['BK', 'AL'], ['IN', 'R1'], ['R1', 'R2'], ['R2', 'FR'], ['FR', 'FL'], ['FL', 'WL']];
// [노드, 서는 자리 x, z, 바라볼 곳 x, z, 자세]
const SPOTS = [
  ['R2', 2.05, -2.5, 2.75, -2.9, 'read'], ['R1', 2.05, -3.45, 2.75, -2.95, 'look'],
  ['AL', -0.95, -4.85, -0.4, -6.0, 'look'], ['BK', 0.12, -4.92, -0.4, -6.0, 'look'],
  ['WL', -1.25, -0.72, -1.25, 0.4, 'look'],
];
const MAX = 5;
const adj = {};
for (const [a, b] of EDGES) { (adj[a] ||= []).push(b); (adj[b] ||= []).push(a); }
function route(from, to) {
  const prev = { [from]: null }, q = [from];
  while (q.length) { const n = q.shift(); if (n === to) break; for (const m of adj[n]) if (!(m in prev)) { prev[m] = n; q.push(m); } }
  const path = []; for (let n = to; n; n = prev[n]) path.unshift(n);
  return path;
}
const V = (n) => new THREE.Vector3(n[0], 0, n[1]);
const rand = (a, b) => a + Math.random() * (b - a);
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const nearest = (pos) => { let best = 'IN', bd = Infinity; for (const [k, n] of Object.entries(NODES)) { const d = Math.hypot(n[0] - pos.x, n[1] - pos.z); if (d < bd) { bd = d; best = k; } } return best; };

export function buildVisitors(group) {
  const people = [], taken = new Set();
  let want = [], first = true;
  function pose(p, kind) {
    if (kind === 'read') { p.arms.forEach((a, i) => { a.rotation.x = -1.0; a.rotation.z = (i ? -1 : 1) * 0.3; }); p.head.rotation.x = 0.15; }
    else if (kind === 'look') { p.arms.forEach((a, i) => { a.rotation.x = 0; a.rotation.z = (i ? 1 : -1) * 0.25; }); p.head.rotation.x = -0.25; }
    else { p.head.rotation.x = 0; p.arms.forEach((a) => { a.rotation.z = 0; }); }
  }
  const freeSpot = () => { const f = SPOTS.map((s, i) => i).filter((i) => !taken.has(i)); return f.length ? f[Math.floor(Math.random() * f.length)] : -1; };
  function goTo(p, node, final) {
    const path = route(p.node, node).slice(1).map((n) => V(NODES[n]));
    if (final) path.push(final);
    p.path = path; p.dest = node; p.mode = 'walk'; pose(p, 'walk');
  }
  function next(p) {
    if (p.spot >= 0) { taken.delete(p.spot); p.spot = -1; }
    if (p.leaving) { goTo(p, 'P'); return; }
    const i = freeSpot();
    if (i < 0) { p.mode = 'stay'; p.wait = rand(4, 8); return; }
    const sp = SPOTS[i]; taken.add(i); p.spot = i;
    goTo(p, sp[0], new THREE.Vector3(sp[1], 0, sp[2]));
  }
  function spawn(token, inside) {
    const used = new Set(people.map((p) => p.lookIdx));
    let k = hash(token) % LOOKS.length;
    for (let n = 0; n < LOOKS.length && used.has(k); n++) k = (k + 1) % LOOKS.length;
    const f = figure(LOOKS[k]);
    group.add(f.root);
    const p = { ...f, token, lookIdx: k, node: 'P', path: [], mode: 'walk', spot: -1, leaving: false, wait: 0, ph: Math.random() * 10 };
    const at = inside ? freeSpot() : -1;
    if (at >= 0) {   // 내가 오기 전부터 있던 방문자: 이미 자리에서 둘러보는 중
      const sp = SPOTS[at]; taken.add(at); p.spot = at; p.node = sp[0];
      f.root.position.set(sp[1], 0, sp[2]); f.root.rotation.y = Math.atan2(sp[3] - sp[1], sp[4] - sp[2]);
      p.mode = 'stay'; p.wait = rand(5, 12); pose(p, sp[5]);
    } else {         // 새로 온 방문자: 뒷벽 통로로 걸어 들어온다
      f.root.position.copy(V(NODES.P)); f.root.rotation.y = 0;
      next(p);
    }
    people.push(p);
  }
  function remove(p) {
    group.remove(p.root);
    p.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    if (p.spot >= 0) taken.delete(p.spot);
    people.splice(people.indexOf(p), 1);
  }
  function reconcile() {
    const ws = new Set(want);
    for (const p of [...people]) {
      if (ws.has(p.token) || p.leaving) continue;
      p.leaving = true;
      if (p.mode === 'stay') next(p); else { p.path = []; p.node = nearest(p.root.position); goTo(p, 'P'); }
    }
    for (const tok of want) {
      if (people.some((p) => p.token === tok && !p.leaving)) continue;
      const back = people.find((p) => p.token === tok && p.leaving);
      if (back) { back.leaving = false; next(back); continue; }
      if (people.filter((p) => !p.leaving).length >= MAX) break;
      spawn(tok, first);
    }
    first = false;
  }
  return {
    setFigures(tokens) { want = (tokens || []).slice(0, MAX); reconcile(); },
    count: () => people.filter((p) => !p.leaving).length,
    update(t, dt, still) {
      for (const p of [...people]) {
        if (p.mode === 'stay') {
          p.wait -= dt;
          if (!still) { p.body.position.y = Math.abs(Math.sin(t * 1.4 + p.ph)) * 0.008; p.head.rotation.y = Math.sin(t * 0.3 + p.ph) * 0.35; }
          p.legs.forEach((l) => { l.rotation.x *= 0.85; });
          if (p.turnTo != null) p.root.rotation.y += Math.atan2(Math.sin(p.turnTo - p.root.rotation.y), Math.cos(p.turnTo - p.root.rotation.y)) * Math.min(1, dt * 3);
          if (p.wait <= 0) next(p);
          continue;
        }
        const tgt = p.path[0];
        if (!tgt) {
          if (p.leaving && p.dest === 'P') { remove(p); continue; }
          p.node = p.dest || p.node;
          const sp = SPOTS[p.spot];
          p.mode = 'stay'; p.wait = sp ? rand(6, 14) : 1;
          if (sp) { pose(p, sp[5]); p.turnTo = Math.atan2(sp[3] - sp[1], sp[4] - sp[2]); }
          continue;
        }
        const pos = p.root.position, dx = tgt.x - pos.x, dz = tgt.z - pos.z, d = Math.hypot(dx, dz);
        if (d < 0.03) { p.path.shift(); continue; }
        const step = Math.min(d, 0.42 * dt);
        pos.x += (dx / d) * step; pos.z += (dz / d) * step;
        const yaw = Math.atan2(dx, dz);
        p.root.rotation.y += Math.atan2(Math.sin(yaw - p.root.rotation.y), Math.cos(yaw - p.root.rotation.y)) * Math.min(1, dt * 5);
        p.turnTo = null;
        if (!still) {
          p.ph += step * 12;
          p.legs[0].rotation.x = Math.sin(p.ph) * 0.42; p.legs[1].rotation.x = -Math.sin(p.ph) * 0.42;
          p.arms[0].rotation.x = -Math.sin(p.ph) * 0.32; p.arms[1].rotation.x = Math.sin(p.ph) * 0.32;
          p.body.position.y = Math.abs(Math.cos(p.ph)) * 0.02;
        }
      }
    },
  };
}
