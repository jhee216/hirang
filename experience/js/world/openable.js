// 펼칠 수 있는 오브젝트(시크릿 북커버 책 / 챕터 패키지).
// 앞표지(뚜껑)는 실제 책등(x=0) 경첩을 기준으로 회전하고, 페이지는 곡률을 가진 3D 종이로 넘어간다.
import * as THREE from 'three';
import { COLORS } from '../config.js';
import { pageTextures, pageShadowTexture } from '../textures.js';

const PI = Math.PI;
const SEG = 28;
let edgeTex = null;
let shadowTex = null;

function pageEdgeTexture() {
  if (edgeTex) return edgeTex;
  const c = document.createElement('canvas');
  c.width = 8; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#F7F0DF'; x.fillRect(0, 0, 8, 128);
  for (let i = 0; i < 128; i += 3) { x.fillStyle = `rgba(120,108,88,${0.05 + Math.random() * 0.08})`; x.fillRect(0, i, 8, 1); }
  edgeTex = new THREE.CanvasTexture(c);
  edgeTex.colorSpace = THREE.SRGBColorSpace;
  edgeTex.wrapS = edgeTex.wrapT = THREE.RepeatWrapping;
  edgeTex.repeat.set(1, 6);
  return edgeTex;
}

function setMap(m, tex) {
  m.map = m.emissiveMap = tex || null;
  m.needsUpdate = true;
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Openable {
  constructor(o) {
    Object.assign(this, o); // kind, id, w, h, t, c, body, coverTex, accent, label, detailUrl, pageDefs
    const { w, h, t, c } = this;
    this.group = new THREE.Group();
    this.group.name = `${this.kind}:${this.id}`;
    this.inner = new THREE.Group();
    this.closedOffset = new THREE.Vector3(-w / 2, 0, -t / 2);
    this.openOffset = new THREE.Vector3(0, 0, -(t - c));
    this.inner.position.copy(this.closedOffset);
    this.group.add(this.inner);
    this.hit = [];
    this.spread = 0;
    this.pageTex = null;
    this.flipping = false;
    this.openP = 0;

    // 큐레이션 색이 조명에 바래 비슷해 보이지 않도록, 표지·몸체는 같은 색으로 자체 발광을 섞는다
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.body, emissive: this.body, emissiveIntensity: 0.18, roughness: 0.78, metalness: 0 });   // 2026-11-11: 0.38 → 0.18(조명 위 자체 발광이 표지를 바래게 했다)
    const innerMat = new THREE.MeshStandardMaterial({ color: COLORS.ivory, roughness: 0.9 });
    const coverMats = [bodyMat, bodyMat, bodyMat, bodyMat,
      new THREE.MeshStandardMaterial({ map: this.coverTex, emissiveMap: this.coverTex, emissive: '#FFFFFF', emissiveIntensity: 0.18, color: '#D2D2D2', roughness: 0.72 }), innerMat];   // 2026-11-11: 발광 0.5 → 0.18, 반사율 0.55 → 0.64
    const edgeMat = new THREE.MeshStandardMaterial({ map: pageEdgeTexture(), roughness: 0.95 });

    // 뒤표지(패키지 바닥판)
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, c), bodyMat);
    back.position.set(w / 2, 0, c / 2);
    // 책등
    const spineMat = this.spine ? new THREE.MeshStandardMaterial({ color: this.spine, roughness: 0.7 }) : bodyMat;
    const spine = new THREE.Mesh(new THREE.BoxGeometry(c * 1.6, h + 0.001, t + 0.001), spineMat);
    spine.position.set(-c / 2 + 0.0004, 0, t / 2);
    // 본문 블록(패키지는 안쪽 내용물)
    const inset = 0.004;
    const block = new THREE.Mesh(new THREE.BoxGeometry(w - inset, h - inset * 2, t - c * 2),
      [edgeMat, edgeMat, edgeMat, edgeMat, innerMat, innerMat]);
    block.position.set((w - inset) / 2, 0, t / 2);

    // 앞표지: 경첩(책등)에 붙은 피벗
    this.coverPivot = new THREE.Group();
    this.coverPivot.position.set(0, 0, t - c);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(w, h, c), coverMats);
    cover.position.set(w / 2, 0, c / 2);
    this.coverPivot.add(cover);

    // 펼쳤을 때 보이는 양쪽 페이지
    const pw = w - 0.008, ph = h - 0.012;
    this.pw = pw; this.ph = ph;
    const planeGeo = new THREE.PlaneGeometry(pw, ph);
    // 페이지는 어느 방향을 보든 읽혀야 하므로 같은 이미지를 약하게 자체 발광시킨다
    const pageMat = (o = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(0.15, 0.15, 0.15), roughness: 0.92, emissive: '#ffffff', emissiveIntensity: 0.64, ...o });   // 2026-11-11: 펼친 페이지는 진열 화면처럼 스스로 밝고 조명은 조금만 받는다 — 셸프 스포트·햇빛·반사광이 겹쳐 글자·소개글 디자인이 하얗게 날아가던 것(측정)   // 2026-11-11: 흰 1.0 + 발광 0.16 → 0.66 + 0.05(펼친 페이지 글자·소개글 디자인이 하얗게 날아가던 것)
    this.leftMat = pageMat();
    this.rightMat = pageMat();
    this.leftPage = new THREE.Mesh(planeGeo, this.leftMat);
    this.leftPage.rotation.y = PI;
    this.leftPage.position.set(w / 2, 0, -0.0009);
    this.leftPage.visible = false;
    this.leftPage.userData.page = 'left';
    this.coverPivot.add(this.leftPage);

    this.rightPage = new THREE.Mesh(planeGeo, this.rightMat);
    this.rightPage.position.set(pw / 2 + 0.002, 0, t - c + 0.0009);
    this.rightPage.visible = false;
    this.rightPage.userData.page = 'right';

    // 넘어가는 종이: 앞/뒤 두 장의 메쉬가 같은 변형 지오메트리를 공유
    this.flipGeo = new THREE.PlaneGeometry(pw, ph, SEG, 1);
    this.flipGeo.translate(pw / 2, 0, 0);
    this.flipBase = this.flipGeo.attributes.position.array.slice();
    this.flipFrontMat = pageMat({ side: THREE.FrontSide });
    this.flipBackMat = pageMat({ side: THREE.BackSide });
    this.flipper = new THREE.Group();
    this.flipper.position.set(0.002, 0, t - c + 0.0022);
    this.flipper.add(new THREE.Mesh(this.flipGeo, this.flipFrontMat), new THREE.Mesh(this.flipGeo, this.flipBackMat));
    this.flipper.visible = false;

    // 넘기는 종이가 아래 페이지에 드리우는 그림자
    shadowTex ||= pageShadowTexture();
    const shGeo = new THREE.PlaneGeometry(pw, ph);
    shGeo.translate(pw / 2, 0, 0);
    this.flipShadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0, depthWrite: false });
    this.flipShadow = new THREE.Mesh(shGeo, this.flipShadowMat);
    this.flipShadow.position.set(0.002, 0, t - c + 0.0014);
    this.flipShadow.visible = false;

    for (const m of [back, spine, block, cover]) { m.castShadow = true; m.receiveShadow = true; }
    this.inner.add(back, spine, block, this.coverPivot, this.rightPage, this.flipper, this.flipShadow);
    this.hit.push(back, spine, block, cover, this.leftPage, this.rightPage);
    this.group.traverse((m) => { m.userData.openable = this; });
  }

  get pageCount() { return this.pageDefs.length; }
  get spreadCount() { return Math.ceil(this.pageDefs.length / 2); }

  ensurePages() {
    if (this.pageTex) return;
    const aspect = this.ph / this.pw;
    this.pageTex = this.pageDefs.map((d, i) => pageTextures(d, i, aspect, this.accent, this.footer));
    this.showSpread(this.spread);
  }

  disposePages() {
    if (!this.pageTex) return;
    for (const p of this.pageTex) { p.front.dispose(); p.back.dispose(); }
    this.pageTex = null;
    for (const m of [this.leftMat, this.rightMat, this.flipFrontMat, this.flipBackMat]) setMap(m, null);
  }

  setLeft(i) { setMap(this.leftMat, this.pageTex?.[i]?.front); }
  setRight(i) { setMap(this.rightMat, this.pageTex?.[i]?.front); }

  showSpread(s) {
    this.spread = s;
    this.setLeft(s * 2);
    this.setRight(s * 2 + 1);
  }

  // p: 0(닫힘) → 1(완전히 펼침)
  setOpen(p) {
    this.openP = p;
    const e = easeInOut(p);
    // 2.0 최종(3차): 제자리 펼침(inPlace) — 책은 선반의 그 자리에 그대로 있고, 표지만 책등을 축으로 약 108° 열린다
    // (끝까지 젖히면 옆 책과 겹치므로). 책 몸체도 옮기지 않는다
    this.coverPivot.rotation.y = -PI * e * (this.inPlace ? 0.6 : 1);
    if (!this.inPlace) this.inner.position.lerpVectors(this.closedOffset, this.openOffset, e);
    const showPages = p > 0.001;
    this.leftPage.visible = showPages;
    this.rightPage.visible = showPages;
  }

  // 페이지 곡률: 책등 쪽은 각도 a, 바깥쪽 끝은 진행 방향 반대로 살짝 늦게 따라온다
  bendFlip(a, dir) {
    const pos = this.flipGeo.attributes.position;
    const base = this.flipBase;
    const pw = this.pw;
    const lag = 0.55 * Math.sin(-a) * dir;
    const cols = SEG + 1;
    const xs = new Float32Array(cols), zs = new Float32Array(cols);
    let px = 0, pz = 0;
    const ds = pw / SEG;
    xs[0] = 0; zs[0] = 0;
    for (let i = 1; i < cols; i++) {
      const u = (i - 0.5) / SEG;
      const th = a + lag * Math.pow(u, 1.6);
      px += ds * Math.cos(th);
      pz += -ds * Math.sin(th);
      xs[i] = px; zs[i] = pz;
    }
    for (let v = 0; v < pos.count; v++) {
      const col = Math.round((base[v * 3] / pw) * SEG);
      pos.setXYZ(v, xs[col], base[v * 3 + 1], zs[col]);
    }
    pos.needsUpdate = true;
    this.flipGeo.computeVertexNormals();
  }

  // dir: +1 다음, -1 이전. onUpdate는 매 프레임 렌더 요청용
  flip(dir, duration) {
    if (this.flipping || !this.pageTex) return Promise.resolve(false);
    const next = this.spread + dir;
    if (next < 0 || next >= this.spreadCount) return Promise.resolve(false);
    this.flipping = true;
    const s = this.spread;
    const T = this.pageTex;
    // 앞면 = 넘어가는 오른쪽 페이지, 뒷면 = 다음 펼침의 왼쪽 페이지
    const frontIdx = dir > 0 ? s * 2 + 1 : s * 2 - 1;
    const backIdx = dir > 0 ? s * 2 + 2 : s * 2;
    setMap(this.flipFrontMat, T[frontIdx]?.front);
    setMap(this.flipBackMat, T[backIdx]?.back);
    if (dir > 0) this.setRight(next * 2 + 1); else this.setLeft(next * 2);
    const from = dir > 0 ? 0 : -PI, to = dir > 0 ? -PI : 0;
    this.flipper.visible = true;
    this.flipShadow.visible = true;
    this.bendFlip(from, dir);
    return new Promise((resolve) => {
      const proxy = { k: 0 };
      gsap.to(proxy, {
        k: 1, duration, ease: 'power2.inOut',
        onUpdate: () => {
          const a = from + (to - from) * proxy.k;
          this.bendFlip(a, dir);
          // 그림자는 종이가 덮는 쪽 페이지에 진다
          const onRight = a > -PI / 2;
          this.flipShadow.scale.x = onRight ? 1 : -1;
          this.flipShadowMat.opacity = 0.32 * Math.sin(-a);
          if (dir > 0 && a < -PI / 2) this.setLeft(next * 2);
          if (dir < 0 && a > -PI / 2) this.setRight(next * 2 + 1);
        },
        onComplete: () => {
          this.flipper.visible = false;
          this.flipShadow.visible = false;
          this.showSpread(next);
          this.flipping = false;
          resolve(true);
        },
      });
    });
  }
}
