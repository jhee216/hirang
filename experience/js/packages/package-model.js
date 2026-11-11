// 하이랑 챕터 패키지 3D 모델.
// Ch1·Ch2: 기존 사이트의 '직접 열어보기'와 같은 도면 지오메트리 · 텍스처 · 접힘 규칙(fold-rules.js)을 Three.js로 그린다.
// Ch3: 사진 속 텐트형(삼각) 파우치를 규격(150×40×220mm)대로 만들고 같은 방식으로 열리게 했다.
import * as THREE from 'three';
import { COLORS, PACKAGE_SCALE } from '../config.js';
import { makeCH1Cfg, makeCH2Cfg } from './fold-rules.js';

const MM = 0.001 * PACKAGE_SCALE;
const IVORY = [1, 0.976, 0.918];
const texLoader = new THREE.TextureLoader();

function loadTex(url, repeat) {
  return new Promise((res) => texLoader.load(url, (t) => {
    t.flipY = false;                               // 원본 렌더러와 같은 UV 방향
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    res(t);
  }, undefined, () => res(null)));
}

// 공통: 바깥 그룹(선택·이동) → center(열림에 따라 중심 보정) → model(mm, 축 변환)
class PackageBase {
  constructor(id, meta) {
    Object.assign(this, meta);
    this.id = id;
    this.label = `${meta.chapter} · ${meta.title}`;
    this.kind = 'package';
    this.hover = 'package';
    this.group = new THREE.Group();
    this.group.name = `package:${id}`;
    this.center = new THREE.Group();
    this.model = new THREE.Group();
    this.model.scale.setScalar(MM);
    this.group.add(this.center);
    this.center.add(this.model);
    this.hit = [];
    this.open = 0;
    this.busy = false;
    this.bounds = { c: new THREE.Vector3(), r: 0.1 };
  }
  // 바닥이 y=0에 닿도록 닫힌 상태 기준으로 중심을 맞춘다
  settle() {
    this.setOpen(0);
    this.closedBox = this.box.clone();
    this.restCenter = new THREE.Vector3(-(this.box.min.x + this.box.max.x) / 2, -this.box.min.y, -(this.box.min.z + this.box.max.z) / 2);
    this.center.position.copy(this.restCenter);
    this.height = this.box.max.y - this.box.min.y;
    this.group.traverse((m) => { m.userData.openable = this; });
  }
  // 열린 정도에 맞춘 시선 앞 중심 보정값(바깥 그룹 기준)
  presentOffset() {
    return new THREE.Vector3().addVectors(this.box.min, this.box.max).multiplyScalar(-0.5);
  }
  stepAt(p) {
    let k = 0;
    this.steps.forEach((s, i) => { if (p + 0.02 >= s[1]) k = i; });
    return k;
  }
}

/* ---------- Ch1 · Ch2: 도면 접기 ---------- */
class FoldedPackage extends PackageBase {
  constructor(id, meta, geo, cfg, tex) {
    super(id, meta);
    this.cfg = cfg;
    this.box = new THREE.Box3();
    // 도면(z-up) → 장면(y-up)
    this.model.rotation.x = -Math.PI / 2;
    this.parts = cfg.objects.map((o) => {
      const g = geo[o.geo];
      const n = g.p.length / 3;
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.p.length), 3));
      bg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.uv), 2));
      bg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(g.p.length), 3));
      // 인쇄면은 조명에 바래지 않도록 같은 그림으로 자체 발광을 섞는다(멀리서도 디자인이 보이게)
      const side = (key, col, s) => new THREE.MeshStandardMaterial({
        map: key ? tex[key] : null,
        emissiveMap: key ? tex[key] : null,
        emissive: key ? 0xffffff : new THREE.Color().setRGB(...(col || IVORY), THREE.SRGBColorSpace),
        emissiveIntensity: key ? 0.12 : 0.08,   // 2026-11-11: 0.42/0.22 → 0.2/0.12 — 자체 발광이 조명 위에 더해져 윗면이 평평하게 하얗게 떴다
        color: key ? 0xcfcfcf : new THREE.Color().setRGB(...(col || IVORY), THREE.SRGBColorSpace),
        roughness: 0.82, metalness: 0, side: s,
        polygonOffset: !!o.offset, polygonOffsetFactor: o.offset || 0, polygonOffsetUnits: o.offset || 0,
      });
      const front = new THREE.Mesh(bg, side(o.front, o.cf, THREE.FrontSide));
      const back = new THREE.Mesh(bg, side(o.back, o.cb, THREE.BackSide));
      for (const m of [front, back]) { m.castShadow = true; m.receiveShadow = true; this.model.add(m); this.hit.push(m); }
      // 도면 보조선(아주 얇은 삼각형)은 경계 계산에서 뺀다
      const solid = new Uint8Array(n / 3);
      for (let t = 0; t < n / 3; t++) {
        const P = (k) => [g.p[(t * 3 + k) * 3], g.p[(t * 3 + k) * 3 + 1], g.p[(t * 3 + k) * 3 + 2]];
        const [a, b, c] = [P(0), P(1), P(2)];
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        // 삼각형의 '높이'(2×넓이 ÷ 가장 긴 변)가 0.3mm보다 얇으면 도면 보조선으로 본다
        const area2 = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
        const edge = Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2])) || 1;
        solid[t] = area2 / edge > 0.3 ? 1 : 0;
      }
      return { o, g, n, bg, front, back, solid };
    });
    this.settle();
    // 닫혔을 때 접힌 면 사이 틈으로 속이 비쳐 보이지 않도록(불투명한 종이) 닫힌 상자 크기의 속을 채운다
    const size = this.closedBox.getSize(new THREE.Vector3()).multiplyScalar(0.982);
    this.core = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshStandardMaterial({ color: meta.coreColor || '#F2ECDF', roughness: 0.9 }));
    this.closedBox.getCenter(this.core.position);
    this.core.castShadow = true;
    this.center.add(this.core);
    this.hit.push(this.core);
    this.core.userData.openable = this;
  }

  setOpen(p) {
    this.open = p;
    if (this.core) this.core.visible = p < 0.004;
    const { cfg } = this;
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    const v = [0, 0, 0];
    for (const part of this.parts) {
      const { o, g, n, bg, solid } = part;
      const vis = !o.when || o.when(p);
      part.front.visible = part.back.visible = vis;
      if (!vis) continue;
      const P = bg.attributes.position.array, N = bg.attributes.normal.array;
      for (let i = 0; i < n; i++) {
        v[0] = g.p[i * 3]; v[1] = g.p[i * 3 + 1]; v[2] = g.p[i * 3 + 2];
        const t = Math.floor(i / 3);
        const m = g.m.length ? [g.m[t * 2], g.m[t * 2 + 1]] : null;
        const w = cfg.pose(v, o, m, p);
        P[i * 3] = w[0]; P[i * 3 + 1] = w[1]; P[i * 3 + 2] = w[2];
        if (solid[t]) for (let d = 0; d < 3; d++) { if (w[d] < mn[d]) mn[d] = w[d]; if (w[d] > mx[d]) mx[d] = w[d]; }
      }
      // 삼각형마다 평평한 법선(접힌 종이 면)
      for (let t = 0; t < n; t += 3) {
        const ax = P[t * 3 + 3] - P[t * 3], ay = P[t * 3 + 4] - P[t * 3 + 1], az = P[t * 3 + 5] - P[t * 3 + 2];
        const bx = P[t * 3 + 6] - P[t * 3], by = P[t * 3 + 7] - P[t * 3 + 1], bz = P[t * 3 + 8] - P[t * 3 + 2];
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        for (let k = 0; k < 3; k++) { N[(t + k) * 3] = nx; N[(t + k) * 3 + 1] = ny; N[(t + k) * 3 + 2] = nz; }
      }
      bg.attributes.position.needsUpdate = true;
      bg.attributes.normal.needsUpdate = true;
      bg.computeBoundingSphere();
    }
    // mm(z-up) 경계 → 장면 좌표(m, y-up): (x, z, -y)
    this.box.min.set(mn[0] * MM, mn[2] * MM, -mx[1] * MM);
    this.box.max.set(mx[0] * MM, mx[2] * MM, -mn[1] * MM);
  }
}

/* ---------- Ch3: 텐트형 파우치 ---------- */
function symbolPath(ctx, sym, x, y, w) {
  const h = w * sym.aspect;
  const loop = (pts) => { pts.forEach(([u, v], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + u * w, y + v * w)); ctx.closePath(); };
  ctx.beginPath(); loop(sym.outer); sym.holes.forEach(loop);
  return h;
}

function ch3FrontTexture(sym, wordImg) {
  const W = 750, H = 1100;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = COLORS.yellow; x.fillRect(0, 0, W, H);
  // 워드마크(모스 그린) + 오른쪽 심볼 칼선(뚫린 창)
  const ww = W * 0.5, wh = ww * wordImg.naturalHeight / wordImg.naturalWidth;
  const t = document.createElement('canvas'); t.width = wordImg.naturalWidth; t.height = wordImg.naturalHeight;
  const tx = t.getContext('2d'); tx.drawImage(wordImg, 0, 0); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = COLORS.moss; tx.fillRect(0, 0, t.width, t.height);
  const base = H * 0.6;
  x.drawImage(t, W * 0.1, base - wh, ww, wh);
  const sw = W * 0.27;
  x.globalCompositeOperation = 'destination-out';
  symbolPath(x, sym, W * 0.62, base - sw * sym.aspect + wh * 0.18, sw);
  x.fill('evenodd');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

// 앞판 위로 이어지는 덮개(도면 기준): 크게 둥근 모서리 + 가운데 탭 + U자 칼집, 그 사이 문구.
// 덮개는 뒤판 쪽으로 접혀 닫히므로 문구는 거꾸로 인쇄되어 있다(접으면 뒷면에서 바로 읽힌다)
function flapTexture(W, FH, TAB) {
  const k = 6, cw = W * k, ch = (FH + TAB) * k;
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  const top = TAB * k, r = 30 * k, tw = 37 * k, tr = 9 * k;
  x.fillStyle = COLORS.yellow;
  x.beginPath();
  x.moveTo(0, ch);
  x.lineTo(0, top + r);
  x.arcTo(0, top, r, top, r);
  x.lineTo(cw / 2 - tw / 2, top);
  x.lineTo(cw / 2 - tw / 2, tr);
  x.arcTo(cw / 2 - tw / 2, 0, cw / 2 - tw / 2 + tr, 0, tr);
  x.lineTo(cw / 2 + tw / 2 - tr, 0);
  x.arcTo(cw / 2 + tw / 2, 0, cw / 2 + tw / 2, tr, tr);
  x.lineTo(cw / 2 + tw / 2, top);
  x.lineTo(cw - r, top);
  x.arcTo(cw, top, cw, top + r, r);
  x.lineTo(cw, ch);
  x.closePath();
  x.fill();
  // 문구(거꾸로)
  x.save();
  x.translate(cw / 2, top + 13 * k);
  x.rotate(Math.PI);
  x.fillStyle = COLORS.soft; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `600 ${4.6 * k}px "Pretendard","Inter",sans-serif`;
  x.fillText('하이랑 오늘의 책은 어떤 사람일까요?', 0, 0);
  x.restore();
  // U자 칼집(잘린 선)
  const uy = top + 24 * k, ud = 13 * k, ur = 8 * k;
  x.strokeStyle = 'rgba(70,72,60,0.75)'; x.lineWidth = 0.5 * k;
  x.beginPath();
  x.moveTo(cw / 2 - tw / 2, uy);
  x.lineTo(cw / 2 - tw / 2, uy + ud - ur);
  x.arcTo(cw / 2 - tw / 2, uy + ud, cw / 2 - tw / 2 + ur, uy + ud, ur);
  x.lineTo(cw / 2 + tw / 2 - ur, uy + ud);
  x.arcTo(cw / 2 + tw / 2, uy + ud, cw / 2 + tw / 2, uy + ud - ur, ur);
  x.lineTo(cw / 2 + tw / 2, uy);
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// 뒤판: 덮개 탭이 끼워지는 칼집 두 줄
function backTexture(W, L, slitY) {
  const k = 4, cw = W * k, ch = L * k;
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  x.fillStyle = COLORS.yellow; x.fillRect(0, 0, cw, ch);
  x.strokeStyle = 'rgba(70,72,60,0.7)'; x.lineWidth = 0.6 * k;
  for (const dy of [0, 7]) {
    const y = ch - (slitY - dy) * k;
    x.beginPath(); x.moveTo(cw / 2 - 17 * k, y); x.lineTo(cw / 2 + 17 * k, y); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

class TentPouch extends PackageBase {
  constructor(id, meta, { sym, wordImg, sheets }) {
    super(id, meta);
    const [W, D, H] = meta.size;                 // 150 × 40 × 220 mm
    Object.assign(this, { W, D, H });
    this.box = new THREE.Box3();
    const kraft = '#D9C29A';
    // 종이 색이 그늘에서 올리브로 죽지 않게 같은 색을 약하게 자체 발광시킨다
    const glow = (col) => ({ emissive: col, emissiveIntensity: 0.12 });
    // 안쪽 면: 텍스처의 알파(칼선)만 쓰고 색은 크라프트로 칠한다
    const innerOf = (map) => {
      const m = new THREE.MeshStandardMaterial({ map, color: kraft, alphaTest: 0.5, roughness: 0.9, side: THREE.BackSide });
      m.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = diffuse;'); };
      return m;
    };
    const front = ch3FrontTexture(sym, wordImg);
    const outerFront = new THREE.MeshStandardMaterial({ map: front, emissiveMap: front, emissive: '#FFFFFF', emissiveIntensity: 0.05, color: 0xd2d2d2, alphaTest: 0.5, roughness: 0.8, side: THREE.FrontSide });
    const FH = 80, TAB = 13;                      // 덮개 높이(탭 제외)·탭 높이(mm)
    const L0 = Math.hypot(H, D / 2);
    const backTex = backTexture(W, L0, L0 - FH - TAB * 0.4);
    const outerPlain = new THREE.MeshStandardMaterial({ map: backTex, emissiveMap: backTex, emissive: '#FFFFFF', emissiveIntensity: 0.05, color: 0xd2d2d2, roughness: 0.8, side: THREE.FrontSide });
    const innerPlain = new THREE.MeshStandardMaterial({ color: kraft, roughness: 0.9, side: THREE.BackSide });

    const L = Math.hypot(H, D / 2);
    this.L = L;
    const panelGeo = (h) => { const g = new THREE.PlaneGeometry(W, h); g.translate(0, h / 2, 0); return g; };
    // 앞판·뒤판: 바닥 모서리 경첩. 닫히면 위가 모여 삼각(텐트), 열면 상자처럼 선다
    this.frontPivot = new THREE.Group(); this.frontPivot.position.set(0, 0, D / 2);
    this.backPivot = new THREE.Group(); this.backPivot.position.set(0, 0, -D / 2); this.backPivot.rotation.y = Math.PI;
    const fp = [new THREE.Mesh(panelGeo(L), outerFront), new THREE.Mesh(panelGeo(L), innerOf(front))];
    const bp = [new THREE.Mesh(panelGeo(L), outerPlain), new THREE.Mesh(panelGeo(L), innerPlain)];
    fp.forEach((m) => this.frontPivot.add(m)); bp.forEach((m) => this.backPivot.add(m));

    // 덮개: 앞판 윗변 경첩. 닫힘 = 뒤판 위로 접혀 내려와 탭이 칼집에 끼워짐, 열림 = 뒤에서 들어 올려 앞판 위로 선다
    const flapTex = flapTexture(W, FH, TAB);
    this.flapPivot = new THREE.Group(); this.flapPivot.position.set(0, L, 0);
    const flapGeo = panelGeo(FH + TAB);
    const flap = [
      new THREE.Mesh(flapGeo, new THREE.MeshStandardMaterial({ map: flapTex, emissiveMap: flapTex, emissive: '#FFFFFF', emissiveIntensity: 0.05, color: 0xd2d2d2, alphaTest: 0.5, roughness: 0.8, side: THREE.FrontSide })),
      new THREE.Mesh(flapGeo, innerOf(flapTex)),
    ];
    flap.forEach((m) => { m.position.z = 0.8; this.flapPivot.add(m); });
    this.frontPivot.add(this.flapPivot);

    // 바닥
    const base = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: kraft, roughness: 0.9, side: THREE.DoubleSide }));
    base.rotation.x = -Math.PI / 2; base.position.y = 0.5;
    // 옆면(거셋): 앞·뒤판 모서리를 잇는 면을 매 프레임 다시 만든다
    this.sideGeo = [0, 1].map(() => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
      return g;
    });
    // rev6-5: 옆면(거셋)은 자체 발광을 줄여 앞판과 다른 면으로 읽히게(두께가 보이게)
    const sideMat = [new THREE.MeshStandardMaterial({ color: '#E9DFAE', emissive: '#F1E9BE', emissiveIntensity: 0.03, roughness: 0.85, side: THREE.FrontSide }), new THREE.MeshStandardMaterial({ color: kraft, roughness: 0.9, side: THREE.BackSide })];
    this.sides = this.sideGeo.flatMap((g) => sideMat.map((m) => new THREE.Mesh(g, m)));

    // 안의 굿즈: 하이랑 스티커 시트 3장(144×204mm). 열면 위로 올라오며 부채처럼 펼쳐진다
    const backing = new THREE.MeshStandardMaterial({ color: '#F4EEE2', roughness: 0.9, side: THREE.BackSide });
    this.sheets = sheets.map((tex, i) => {
      const g = new THREE.Group();
      const geo = panelGeo(204);
      g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, side: THREE.FrontSide })), new THREE.Mesh(geo, backing));
      g.userData.i = i;
      return g;
    });

    for (const m of [...fp, ...bp, ...flap, base, ...this.sides]) { m.castShadow = true; m.receiveShadow = true; this.hit.push(m); }
    for (const g of this.sheets) g.children.forEach((m) => { m.castShadow = true; m.receiveShadow = true; this.hit.push(m); });
    this.model.add(this.frontPivot, this.backPivot, base, ...this.sides, ...this.sheets);
    this.theta0 = Math.atan2(D / 2, H);          // 닫혔을 때 안쪽으로 기운 각도
    this.settle();
  }

  setOpen(p) {
    this.open = p;
    const { W, D, H, L, theta0 } = this;
    const ease = (t) => { t = Math.max(0, Math.min(1, t)); return -(Math.cos(Math.PI * t) - 1) / 2; };
    // 1) 덮개를 들어 올린다  2) 모였던 입구가 벌어져 상자처럼 선다  3) 스티커 시트가 올라온다
    // 덮개가 다 열린 뒤에야 입구가 벌어진다(덮개를 여는 동안 몸통은 그대로)
    const eFlap = ease(p / 0.4), eBody = ease((p - 0.42) / 0.26), eGoods = ease((p - 0.66) / 0.34);
    const tf = theta0 - eBody * (theta0 + 0.05);     // 양수 = 안쪽으로 기움
    const tb = theta0 - eBody * theta0;
    this.frontPivot.rotation.x = -tf;
    this.backPivot.rotation.x = tb;
    // 덮개 각도(앞판 기준): 닫힘 = 뒤판 위에 포개짐(뒤쪽으로 접힘), 열림 = 앞판 위로 거의 곧게 섬
    const folded = -(Math.PI - (tf + tb)) + 0.01;
    // 마지막 단계에서는 덮개가 앞으로 넘어가 스티커가 올라오는 입구를 가리지 않는다
    this.flapPivot.rotation.x = folded + (-0.1 - folded) * eFlap + 2.55 * eGoods;

    const top = (sideZ, th) => [0, L * Math.cos(th), sideZ - Math.sign(sideZ) * L * Math.sin(th)];
    const ft = top(D / 2, tf), bt = top(-D / 2, tb);
    this.sideGeo.forEach((g, i) => {
      const x = i ? W / 2 : -W / 2;
      const fb = [x, 0, D / 2], bb = [x, 0, -D / 2], fT = [x, ft[1], ft[2]], bT = [x, bt[1], bt[2]];
      // 접혀 들어간 거셋: 입구가 모일수록 가운데 접힘선을 안쪽으로 밀어 넣는다
      // 안쪽으로 접혀 들어가는 깊이는 2mm만: 안의 스티커 시트(폭 144mm)가 옆면을 뚫고 나오지 않게
      const mid = [x - Math.sign(x) * 2 * (1 - eBody), (fT[1] + bT[1]) / 2 * 0.55, (fT[2] + bT[2]) / 2];
      const tris = i ? [fb, bb, mid, bb, bT, mid, fb, mid, fT, mid, bT, fT] : [fb, mid, bb, bb, mid, bT, fb, fT, mid, mid, fT, bT];
      const a = g.attributes.position.array;
      tris.forEach((v, k) => { a[k * 3] = v[0]; a[k * 3 + 1] = v[1]; a[k * 3 + 2] = v[2]; });
      g.attributes.position.needsUpdate = true;
      g.computeVertexNormals();
      g.computeBoundingSphere();
    });
    // 스티커 시트: 먼저 입구(위)로 곧게 끝까지 빠져나온 뒤(옆면으로는 나오지 않는다), 파우치 위에서 부채처럼 펼쳐진다
    const eRise = ease((p - 0.66) / 0.22), eFan = ease((p - 0.86) / 0.14);
    let topY = Math.max(ft[1], bt[1]);
    for (const s of this.sheets) {
      const k = s.userData.i - 1;                    // -1, 0, 1 (뒤 → 앞)
      // 카드를 펼치듯: 세 장 모두 그림이 보이도록 좌우로 벌리고 기울이며, 앞장일수록 앞으로 나온다
      s.position.set(k * 118 * eFan, 1 + eRise * (L + 16) + (1 - Math.abs(k)) * 26 * eFan, k * 2.4 * eBody + (k + 1) * 9 * eFan);
      s.rotation.set(0, 0, -k * 0.3 * eFan);
      topY = Math.max(topY, s.position.y + 204);
    }
    const fy = this.flapPivot.rotation.x;
    topY = Math.max(topY, ft[1] + 93 * Math.max(0, Math.cos(fy)));
    const zf = Math.max(D / 2, ft[2] + 93 * Math.max(0, Math.sin(fy))), zb = Math.min(-D / 2, bt[2], ft[2] + 93 * Math.sin(fy));
    const xw = Math.max(W / 2 + 40, 118 * eFan + 110);
    this.box.min.set(-xw * MM, 0, zb * MM);
    this.box.max.set(xw * MM, Math.max(H, topY) * MM, zf * MM);
  }
}

/* ---------- 불러오기 ---------- */

// 원본 '직접 열어보기'의 단계 이름
const STEPS = {
  ch1: [['닫힘', 0], ['덮개 열기', 0.32], ['안쪽 덮개 열기', 0.66], ['모두 펼침', 1]],
  ch2: [['닫힘', 0], ['바깥 날개', 0.34], ['안쪽 날개', 0.6], ['책 꺼내기', 1]],
  ch3: [['닫힘', 0], ['덮개 열기', 0.4], ['입구 열기', 0.7], ['스티커 꺼내기', 1]],
};
// 정면에 가깝게 세워 약 20° 기울인 고정 시점(요청한 각도). 원본 렌더 시점(yaw atan2(650,-550), pitch 0.86)보다 덜 눕힘
const FLAT_VIEW = { yaw: Math.atan2(650, -550) - 0.4, pitch: 1.25 };

export async function loadPackages(metas, { sym, wordImg }) {
  const base = 'assets/packages/';
  const json = (u) => fetch(base + u).then((r) => r.json());
  const [g1, g2] = await Promise.all([json('ch1-geo.json'), json('ch2-geo.json')]);
  const T = async (pairs) => Object.fromEntries(await Promise.all(pairs.map(async ([k, f]) => [k, await loadTex(base + f, k === 'book')])));
  const [t1, t2] = await Promise.all([
    T([['art', 'ch1-art.jpg'], ['intro1', 'ch1-intro1.jpg'], ['intro2', 'ch1-intro2.jpg'], ['cardF', 'ch1-cardF.jpg'], ['cardB', 'ch1-cardB.jpg'], ['message', 'ch1-message.jpg'], ['book', 'ch1-book.jpg']]),
    T([['art', 'ch2-art.jpg'], ['book', 'ch2-book.jpg']]),
  ]);
  // Ch3 굿즈: 하이랑 스티커 시트 3종(sticker1·2-3·3 PDF의 2페이지)
  const sheetTex = await Promise.all([1, 2, 3].map((i) => new Promise((res) => texLoader.load(`assets/goods/sticker-sheet-${i}.jpg`, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t); }, undefined, () => res(null)))));

  const meta = Object.fromEntries(metas.map((m) => [m.id, m]));
  const cfg1 = makeCH1Cfg();
  const cfg2 = makeCH2Cfg(g2._K);
  cfg2.init(g2);
  cfg2.setMode('slide');                      // 크림 띠를 열고 책을 꺼내는 방식(원본 기본값)
  const view = (o, v) => Object.assign(o, { view: v });
  return {
    ch1: view(new FoldedPackage('ch1', { ...meta.ch1, steps: STEPS.ch1, coreColor: '#F3EEE3' }, g1, cfg1, t1), FLAT_VIEW),
    ch2: view(new FoldedPackage('ch2', { ...meta.ch2, steps: STEPS.ch2, coreColor: '#B9A8CC' }, g2, cfg2, t2), FLAT_VIEW),
    ch3: view(new TentPouch('ch3', { ...meta.ch3, steps: STEPS.ch3 }, { sym, wordImg, sheets: sheetTex }), { yaw: -Math.PI / 2 + 0.42, pitch: 0.3, standing: true }),
  };
}
