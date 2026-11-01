// SCENE 01 — 비밀의 문. 문이 달린 벽, 문틀(아치), 실제 두께의 문, 경첩, 레버 손잡이.
// 문은 경첩 위치의 피벗을 기준으로 실제로 회전하고, 그 뒤에는 처음부터 내부 공간이 있다.
import * as THREE from 'three';
import { COLORS, DOOR } from '../config.js';
import { plaqueTexture, doorEmblemTexture, spillTexture, haloTexture, baseGlowTexture, polishedFloor, plasterBump } from '../textures.js';

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

export function buildDoor() {
  const { width: W, height: H, thickness: T, gap, wallThickness: WT } = DOOR;
  const group = new THREE.Group();
  group.name = 'doorway';

  // 브랜드 아이보리(#FFF9EA)가 그늘에서 노란 회색으로 보이지 않게, 같은 색을 조금 자체 발광으로 섞는다
  const wallMat = new THREE.MeshStandardMaterial({ color: COLORS.ivory, roughness: 0.94, bumpMap: plasterBump(6, 2.5), bumpScale: 0.3, emissive: COLORS.ivory, emissiveIntensity: 0.14 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#F2E9D3', roughness: 0.8 });
  const doorMat = new THREE.MeshStandardMaterial({ color: COLORS.moss, roughness: 0.52, metalness: 0.04 });
  const brassMat = new THREE.MeshStandardMaterial({ color: COLORS.yellow, roughness: 0.28, metalness: 0.78 });

  // 벽: 아치 구멍(문 + 간격)을 뚫고 두께만큼 돌출. 구멍 안쪽 면이 곧 문틀(잼)이다
  const wallShape = notched({ rect: true, hw: 9, top: 6.5 }, W + gap * 2, H + gap);
  const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: WT, bevelEnabled: false, curveSegments: 48 });
  wallGeo.translate(0, 0, -WT / 2);
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.castShadow = true; wall.receiveShadow = true;
  group.add(wall);

  // 바깥쪽 몰딩(아키트레이브)
  const trimShape = notched({ w: W + 0.22, h: H + 0.11 }, W + gap * 2, H + gap);
  const trimGeo = new THREE.ExtrudeGeometry(trimShape, { depth: 0.022, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 48 });
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.position.z = WT / 2;
  trim.castShadow = true; trim.receiveShadow = true;
  group.add(trim);

  // 문 피벗: 경첩 쪽(왼쪽) 안쪽 면 모서리. 안쪽(-z)으로 열린다
  const doorZ = WT / 2 - 0.03 - T / 2;
  const pivot = new THREE.Group();
  pivot.position.set(-W / 2, 0.0, doorZ - T / 2);
  group.add(pivot);

  const leaf = new THREE.Group();          // 문짝 (피벗 기준 로컬 좌표: x 0→W, z 0→T)
  leaf.position.set(0, 0.004, 0);
  pivot.add(leaf);
  const doorGeo = new THREE.ExtrudeGeometry(archShape(W - 0.006, H - 0.004, 0.003), {
    depth: T - 0.006, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 48,
  });
  doorGeo.translate(0, 0, 0.003);
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.castShadow = true; door.receiveShadow = true;
  leaf.add(door);


  // 문 위쪽의 작은 엠블럼(브랜드 심볼)
  const emblem = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshStandardMaterial({ map: doorEmblemTexture(), transparent: true, roughness: 0.3, metalness: 0.7 }));
  emblem.position.set(W / 2, H - 0.42, T + 0.0105);
  leaf.add(emblem);

  // 레버 손잡이(앞·뒤). 손잡이 피벗은 로즈(원판) 중심
  const handles = [];
  const mkHandle = (side) => {
    const hp = new THREE.Group();
    hp.position.set(W - 0.085, 1.02, side > 0 ? T + 0.006 : -0.006);
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
  const groundMat = new THREE.MeshPhysicalMaterial({ color: '#EFE8DB', map: polishedFloor(6, 4), roughness: 0.3, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.14 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(44, 30), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 15 + WT / 2 - 0.001);
  ground.receiveShadow = true;
  group.add(ground);

  /* ---- 문 앞 디테일: 모스 걸레받이, 양옆 벽등(벽을 타고 내려오는 빛 무늬) ---- */
  const baseMat = new THREE.MeshStandardMaterial({ color: '#F2E9D3', roughness: 0.6 });   // 초록 바닥과 벽 사이 아이보리 걸레받이
  const sconceSpots = [], sconceShades = [];
  const trimHalf = (W + 0.22) / 2 + 0.01;
  for (const s of [-1, 1]) {
    const len = 9 - trimHalf;
    const bb = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.03), baseMat);
    bb.position.set(s * (trimHalf + len / 2), 0.07, WT / 2 + 0.015);
    bb.castShadow = true; bb.receiveShadow = true;
    group.add(bb);
    // 벽등: 황동 받침 + 노란 유리 갓. 아래·위로 빛을 뿌려 벽에 부채꼴 빛이 생긴다
    const sx = s * (W / 2 + 0.42);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 32), brassMat);
    plate.rotation.x = Math.PI / 2; plate.position.set(sx, 2.02, WT / 2 + 0.008);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 12), brassMat);
    arm.rotation.x = Math.PI / 2; arm.position.set(sx, 2.02, WT / 2 + 0.07);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.16, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: '#FDF3B8', emissive: '#FFE58A', emissiveIntensity: 1.6, roughness: 0.4, side: THREE.DoubleSide }));
    sconceShades.push(shade.material);
    shade.position.set(sx, 2.02, WT / 2 + 0.13);
    group.add(plate, arm, shade);
    for (const [ty, ang] of [[0.2, 0.62], [3.6, 0.5]]) {
      const sp = new THREE.SpotLight('#FFEBC4', ty < 1 ? 7 : 5, 3.4, ang, 0.65, 1.3);
      sp.userData.base = sp.intensity; sconceSpots.push(sp);
      sp.position.set(sx, 2.02, WT / 2 + 0.14);
      sp.target.position.set(sx, ty, WT / 2 + 0.02);
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
    const z = WT / 2 + 0.05, edge = W / 2 + 0.26;        // edge: 문틀 바로 바깥
    const right = halfW - Math.max(0.16, halfW * 0.1);   // 오른쪽 여백(화면 폭의 약 5%)
    for (const sc of [1, 0.88, 0.78]) {
      const x = Math.min(W / 2 + 1.02, right - PW * sc / 2);
      if (x - PW * sc / 2 >= edge) { plaque.position.set(x, 1.55, z); plaque.scale.setScalar(sc); return; }
    }
    plaque.position.set(0, H + 0.36, z);
    plaque.scale.setScalar(Math.min(0.92, (halfW * 2 * 0.84) / PW));
  }
  placePlaque(3);
  plaque.receiveShadow = false;
  group.add(plaque);

  // 문틈 아래 바닥으로 새는 빛
  const spillMat = new THREE.MeshBasicMaterial({
    map: spillTexture(), color: '#FFE6A8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const spillGeo = new THREE.PlaneGeometry(1.5, 1.7);
  spillGeo.translate(0, -0.85, 0);                     // 문 아래(벽)에서 시작해 앞으로 번지도록 기준을 벽쪽 끝에
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
  const seamShape = notched({ w: W + gap * 2 + 0.05, h: H + gap + 0.025 }, W - 0.07, H - 0.04);   // 문 가장자리 3.5cm까지 빛이 번진다
  // 밝은 아이보리 위에서도 보이도록 가산이 아닌 진한 금빛으로 덮는다
  const seamBase = new THREE.Color('#FFD98A');
  const daySeam = new THREE.Color('#EBA83D');
  let daylightStrength = 0;
  const seamMat = new THREE.MeshBasicMaterial({ color: seamBase.clone(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const seam = new THREE.Mesh(new THREE.ShapeGeometry(seamShape, 48), seamMat);
  seam.position.z = WT / 2 + 0.036;   // 몰딩 앞으로 번지는 빛
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
  const lureLight = new THREE.PointLight('#FFF0C8', 0, 3.2, 1.5);
  lureLight.position.set(0.25, 0.7, -0.5);
  group.add(lureLight);

  // 문 둘레 벽으로 번지는 금빛 후광: 옆 명판까지 닿는다
  // 문 모양을 뚫어 문짝은 또렷하게 두고, 둘레 벽에만 빛이 번진다
  const haloTex = haloTexture();
  haloTex.repeat.set(1 / 4.2, 1 / 3.4); haloTex.offset.set(0.5, 0);   // ShapeGeometry의 uv(=미터 좌표)를 텍스처에 맞춤
  const haloMat = new THREE.MeshBasicMaterial({ map: haloTex, color: '#FFF3C6', transparent: true, opacity: 0, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.ShapeGeometry(notched({ rect: true, hw: 2.1, top: 3.4 }, W + gap * 2, H + gap), 48), haloMat);
  halo.position.set(0, 0, WT / 2 + 0.04);
  group.add(halo);

  // 문 아래 틈에서 나온 빛이 위·아래·양옆으로 넓게 퍼진다: 벽(문 구멍은 비워 문은 또렷하게)과 바닥에 둥글게
  const wallGlowTex = baseGlowTexture(1);
  wallGlowTex.repeat.set(1 / 6.4, 1 / 3.2); wallGlowTex.offset.set(0.5, 0);
  const wallGlowMat = new THREE.MeshBasicMaterial({ map: wallGlowTex, color: '#FFC96A', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const wallGlow = new THREE.Mesh(new THREE.ShapeGeometry(notched({ rect: true, hw: 3.2, top: 3.2 }, W + gap * 2, H + gap), 48), wallGlowMat);
  wallGlow.position.set(0, 0, WT / 2 + 0.045);
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
  slit.position.set(0, 0.02, WT / 2 + 0.05); slit.scale.y = 1.4;
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

  function updateLure(lure, t, flick) {
    haloMat.opacity = Math.min(0.8, lure * (0.45 + flick * 0.2));
    seamMat.opacity = Math.min(1, lure * (0.75 + flick * 0.25));
    seamMat.color.copy(seamBase).lerp(daySeam, daylightStrength).multiplyScalar(1.6 + flick * 0.8 - daylightStrength * 0.7);   // 1을 넘는 밝기 → 블룸으로 틈 빛이 번진다
    wallGlowMat.opacity = Math.min(1, lure * (0.4 + flick * 0.1));
    floorGlowMat.opacity = Math.min(1, lure * 0.2);
    // 문 뒤(방 안)의 빛: 닫힌 문 둘레 틈과 살짝 벌어진 손잡이 쪽 틈으로만 보여, 빛이 문을 뚫고 나오는 것처럼 보인다
    backMat.opacity = Math.min(1, lure * 1.4);
    backLight.visible = backMat.opacity > 0.004 && pivot.rotation.y < 0.25;
    backMat.color.copy(backBase).multiplyScalar(3.2 + flick * 1.6);
    slitMat.opacity = Math.min(1, lure * 1.2);
    slitMat.color.setRGB(1, 0.92, 0.7).multiplyScalar(2.5 + flick);
    show(wallGlow, wallGlowMat); show(floorGlow, floorGlowMat); show(slit, slitMat); show(halo, haloMat); show(seam, seamMat);
    // 문 아래로 쏟아지는 빛: 커지며 앞으로 길게 뻗는다(처음 호버 효과보다 훨씬 크게)
    // 빛은 문 아래에 모여 앞으로 짧게 번진다(바닥 전체가 아니라 문 앞이 쨍하게)
    spill.scale.set(1 + lure * (0.35 + flick * 0.05), 1 + lure * (0.45 + flick * 0.08), 1);
    coreMat.opacity = Math.min(1, lure * (1.1 + flick * 0.15));
    core.visible = coreMat.opacity > 0.004;
    // 빛줄기 판은 문 위에 얼룩처럼 보여 쓰지 않는다(벽 후광·바닥 빛으로 충분)
    rays.forEach((r) => { r.material.opacity = 0; r.visible = false; });
    lureLight.intensity = lure * (5 + flick * 4);
    moteMat.opacity = lure * 0.9;
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
  const hit = [door, emblem, ...handles.flatMap((h) => h.children)];
  hit.forEach((m) => { m.userData.door = true; });

  return {
    group, pivot, handles, spill, spillMat, hit, doorMat, updateLure, placePlaque,
    setAngle(a) { pivot.rotation.y = a; },
    setLeafVisible(v) { pivot.visible = v; },
    // 해가 지면 벽등이 주인공: 밤일수록 더 밝고 따뜻하게(낮에는 은은하게만)
    setNight(n) {
      daylightStrength = 1 - n;
      // 낮에도 벽등의 밝기를 밤 수준으로 유지하고 발광판은 황금빛 대비를 쓴다.
      for (const sp of sconceSpots) sp.intensity = sp.userData.base * (1.9 - n * 0.05);
      for (const m of sconceShades) m.emissiveIntensity = 2.8 - n * 0.2;
      doorMat.color.set(COLORS.moss).multiplyScalar(1 - daylightStrength * 0.12);
      trimMat.color.set('#F2E9D3').multiplyScalar(1 - daylightStrength * 0.12);
      wallMat.emissiveIntensity = 0.14 - daylightStrength * 0.06;
      // 밝은 바탕 위 가산 합성은 빛을 지워 보이게 하므로 낮에는 색 대비를 보존한다.
      const blend = n < 0.5 ? THREE.NormalBlending : THREE.AdditiveBlending;
      seamMat.blending = wallGlowMat.blending = floorGlowMat.blending = blend;
      wallGlowMat.color.set('#FFC96A').lerp(new THREE.Color('#E9B45C'), daylightStrength);
      floorGlowMat.color.set('#FFD27A').lerp(new THREE.Color('#EFBF69'), daylightStrength);
    },
    setHandle(a) { handles.forEach((h) => { h.rotation.z = a; }); },
  };
}
