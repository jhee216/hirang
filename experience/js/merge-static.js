// 2.0 성능: 움직이지 않는 메쉬 중 같은 재질·같은 그림자 설정인 것을 하나로 합쳐 그리기 호출을 줄인다.
// 모양·위치·재질은 그대로라 보이는 것은 같다. 합치지 않는 것:
//  - 움직이거나 눌리는 것(펼칠 수 있는 책·패키지, 관람객, 떠 있는 책), 따로 참조하는 것(바닥·보드 칸)
//  - 여러 재질을 쓰는 메쉬, 투명한 것, 점(Points)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function mergeStatic(root, { skipRoots = [], skipMeshes = [] } = {}) {
  const skipR = new Set(skipRoots), skipM = new Set(skipMeshes);
  root.updateMatrixWorld(true);
  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  const walk = (o) => {
    if (skipR.has(o)) return;
    if (o.isMesh && !skipM.has(o) && o.visible && !Array.isArray(o.material) && !o.material.transparent &&
        !o.isInstancedMesh && !o.isSkinnedMesh && !o.morphTargetInfluences) {
      const g = o.geometry, attrs = Object.keys(g.attributes).sort().join(',');
      const key = `${o.material.uuid}|${+o.castShadow}${+o.receiveShadow}|${attrs}|${g.index ? 'i' : 'n'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
  let removed = 0, added = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map((m) => {
      const g = m.geometry.clone();
      g.clearGroups();   // 단일 재질 메쉬의 Box·Extrude 기본 그룹은 필요 없다
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverseRoot, m.matrixWorld));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const src = list[0];
    const mesh = new THREE.Mesh(merged, src.material);
    mesh.castShadow = src.castShadow; mesh.receiveShadow = src.receiveShadow;
    mesh.name = 'merged-static';
    root.add(mesh);
    for (const m of list) { m.parent.remove(m); }
    removed += list.length; added++;
  }
  return { removed, added };
}

// 2.0 성능: 여러 재질 메쉬(책 상자·보드 칸·패키지 면)는 면마다 따로 그려진다.
// 같은 재질을 쓰는 면끼리 인덱스를 모아 한 번에 그리게 한다(모양·재질은 그대로, 그리기 횟수만 준다).
export function compactMaterialGroups(root) {
  let before = 0, after = 0;
  root.traverse((o) => {
    if (!o.isMesh || !Array.isArray(o.material) || !o.geometry.index || o.geometry.groups.length < 2) return;
    const g = o.geometry, idx = g.index.array, mats = o.material;
    const uniq = [...new Set(g.groups.map((gr) => mats[gr.materialIndex]))];
    before += g.groups.length;
    if (uniq.length === g.groups.length) { after += uniq.length; return; }
    const out = new (idx.constructor)(idx.length);
    const ng = g.clone();   // 같은 모양을 쓰는 다른 메쉬에 영향이 없도록 복제해서 바꾼다
    ng.clearGroups();
    let w = 0;
    uniq.forEach((m, mi) => {
      const start = w;
      for (const gr of g.groups) if (mats[gr.materialIndex] === m) { out.set(idx.subarray(gr.start, gr.start + gr.count), w); w += gr.count; }
      ng.addGroup(start, w - start, mi);
    });
    ng.setIndex(new THREE.BufferAttribute(out, 1));
    o.geometry = ng;
    o.material = uniq;
    after += uniq.length;
  });
  return { before, after };
}
