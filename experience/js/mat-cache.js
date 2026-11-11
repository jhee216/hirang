// 2.0: 같은 색·같은 성질의 재질은 하나만 만들어 함께 쓴다(재질 수·셰이더 전환·메모리 절감).
// 텍스처가 들어간 재질은 물체마다 다르므로 캐시하지 않는다.
// 또 2.0 방향(무광 에디토리얼)에 맞춰 칠한 면의 거칠기를 최소 MATTE로 올린다. 금속성 재질은 그대로 둔다.
import * as THREE from 'three';

export const MATTE = 0.8;
const cache = new Map();

export function sharedMat(color, rough = 0.9, extra = {}) {
  const metal = extra.metalness ?? 0;
  const roughness = metal > 0.3 ? rough : Math.max(rough, MATTE);
  const hasTexture = Object.values(extra).some((v) => v && v.isTexture);
  if (hasTexture) return new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const key = JSON.stringify([new THREE.Color(color).getHexString(), roughness, Object.entries(extra).map(([k, v]) =>
    [k, v && v.isColor ? v.getHexString() : typeof v === 'string' ? new THREE.Color(v).getHexString?.() ?? v : v])]);
  let m = cache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness, ...extra }); cache.set(key, m); }
  return m;
}

export const sharedMatCount = () => cache.size;
