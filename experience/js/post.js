// 화면 후처리: 영상 초안처럼 부드러운 접지 그림자(AO) · 얕은 심도(DOF) · 은은한 빛 번짐 · 따뜻한 색 · 필름 질감.
// 휴대폰·저사양에서는 AO와 심도를 끄고 가벼운 마무리만 남긴다.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// 출력(sRGB) 뒤에 얹는 마무리: 가장자리를 살짝 어둡게, 아주 옅은 종이 그레인(색조는 바꾸지 않는다)
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.014 }, vignette: { value: 0.09 } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform float grain; uniform float vignette; varying vec2 vUv;
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      // 2026-11-10 노출·색 수정: 하이라이트 따뜻하게·그늘 라벤더 쪽·크림 틴트(파랑 −3.8%)·채도 −7%를 뺐다.
      // 화면 전체에 색을 덧씌워 라벤더(#C1B1D1)가 회분홍으로, 초록이 누렇게 보였다. 브랜드 색은 재질·조명이 그대로 전한다.
      // 남긴 것: 아주 약한 중간 톤 대비(0.18 → 0.1), 가장자리 어둡게, 종이 그레인
      c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), 0.1);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - vignette * smoothstep(0.25, 0.85, length(d * vec2(1.1, 1.0)));
      c.rgb += (h(vUv * 1000.0 + time) - 0.5) * grain;
      gl_FragColor = c;
    }`,
};

// 품질 단계: 느려지면 '눈에 덜 띄는 것'부터 한 단계씩 덜어 내고, 여유가 생기면 되돌린다.
//   scale  = 화면 밀도 대비 렌더 해상도(SMAA가 가장자리를 다듬어 0.8까지는 거의 티가 나지 않는다)
//   shadow = 그림자 맵 갱신 간격(프레임). 움직이는 건 관람객뿐이라 2~3프레임 간격은 보이지 않는다
//   ao     = 접지 그림자(AO) 사용 여부. AO는 화면과 같은 해상도로 계산한다
//            (절반 해상도로 줄였더니 책장 뒤판 등에 오돌토돌한 얼룩 노이즈가 남았다). 느려지면 줄이지 않고 끈다
const BLOOM = 0.045;
export const QUALITY = [
  // 2026-11-11: 가장 낮은 단계도 0.62 → 0.72(멀리·큰 화면에서 책·패키지 글자가 뭉개지던 것)
  { scale: 1.0, shadow: 2, ao: false },
  { scale: 0.93, shadow: 2, ao: false },
  { scale: 0.86, shadow: 3, ao: false },
  { scale: 0.79, shadow: 3, ao: false },
  { scale: 0.72, shadow: 4, ao: false },
];

// 휴대폰·태블릿용 가벼운 경로: 후처리 버퍼 없이 화면에 바로 그린다.
// 모바일 GPU는 전체 화면을 여러 번 오가는 비용(빛 번짐 밉 체인·SMAA 3단계·마무리)이 가장 비싸고,
// 화면 버퍼의 기본 MSAA는 타일 GPU에서 거의 공짜라 가장자리는 오히려 더 매끈하다.
// 마무리의 비네트는 CSS로 대신하고(.lite-vignette), 색 보정·그레인은 2~3% 수준이라 생략한다.
//   scale = 기준 해상도 대비 배율. 0단계는 여유 있는 기기(아이패드 등)만 올라간다
export const LITE = [
  { scale: 1.15, shadow: 3 },
  { scale: 1.0, shadow: 3 },
  { scale: 0.88, shadow: 4 },
  { scale: 0.78, shadow: 4 },
  { scale: 0.68, shadow: 6 },
];

function createLite(renderer, scene, camera, overlay) {
  // 기준: 화면 밀도 1.75배까지, 전체 픽셀 160만 개 안에서(휴대폰 ≈ 1.75배, 아이패드 ≈ 1.1배)
  // 가장 낮은 단계에서도 화면 밀도 1배 아래로는 내리지 않는다(그 아래는 글자·가장자리가 눈에 띄게 뭉개진다)
  const base = () => Math.min(devicePixelRatio, 1.75, Math.sqrt(1.6e6 / (innerWidth * innerHeight)));
  let level = 1;
  const ratio = () => Math.max(Math.min(1, devicePixelRatio), Math.min(devicePixelRatio, 2, base() * LITE[level].scale));
  function applyLevel() {
    renderer.setPixelRatio(ratio());
    renderer.setSize(innerWidth, innerHeight);
  }
  applyLevel();
  return {
    lite: true, composer: null, ao: null, bokeh: null,
    get level() { return level; },
    get levels() { return LITE.length; },
    get shadowEvery() { return LITE[level].shadow; },
    setLevel(i) {
      const n = Math.max(0, Math.min(LITE.length - 1, i));
      if (n === level) return false;
      level = n; applyLevel();
      return true;
    },
    pixelRatio: () => ratio(),
    setFocus() {}, setAperture() {}, setReading() {}, setGlow() {},
    resize() { applyLevel(); },
    render() {
      renderer.setRenderTarget(null);
      renderer.autoClear = true;
      renderer.render(scene, camera);
      if (overlay) {
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(overlay, camera);
        renderer.autoClear = true;
      }
    },
  };
}

export function createPost(renderer, scene, camera, { high, overlay, lite }) {
  if (lite) return createLite(renderer, scene, camera, overlay);
  // 후처리를 거치면 renderer의 antialias가 무시되어 가장자리가 계단처럼 깨진다.
  // 버퍼 MSAA는 모든 패스마다 비용이 반복돼 버벅이므로, 마지막에 한 번만 SMAA로 가장자리를 다듬는다.
  const composer = new EffectComposer(renderer);
  // 기준 해상도: 화면 밀도를 따르되(최대 2배) 전체 픽셀 수 상한 안에서. 실제 해상도 = 기준 × 품질 단계의 scale
  const base = () => Math.min(devicePixelRatio, 2, Math.sqrt((high ? 8.3e6 : 3.6e6) / (innerWidth * innerHeight)));   // 2026-11-11: 픽셀 상한 3.2M → 6.5M(레티나 1440×900을 거의 원래 해상도로)
  let level = high ? 0 : 1;
  const ratio = () => Math.max(Math.min(devicePixelRatio, 1.5), base() * QUALITY[level].scale);   // 2026-11-11: 레티나 최저 1.25 → 1.5배   // 레티나에서는 1.25배 아래로 내리지 않는다
  composer.setPixelRatio(ratio());
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));

  let ao = null, bokeh = null;
  // 2026-11-11: 화면 공간 AO를 쓰지 않는다. 품질 조절이 FPS에 따라 AO를 켰다 껐다 해서 셸프 전체가 10.6%씩 어두워졌다 밝아졌다(측정).
  // 접지 그늘은 그림자 맵과 바닥 접지 그림자 판이 맡는다. 심도(Bokeh)는 그대로
  const USE_AO = false;
  if (high) {
    if (USE_AO) {
    ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    // 2.0: 접지 그림자를 더 얇고 부드럽게(진한 AO는 CGI 티의 주원인)
    ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.8, thickness: 1.2, scale: 1.0, samples: 8 });
    ao.blendIntensity = 0.8;   // rev4: 0.5 → 0.8 — 책·선반·받침·다이스가 닿는 곳에 접지 그늘(낮의 평평함 줄임)
    composer.addPass(ao);
    }
    bokeh = new BokehPass(scene, camera, { focus: 5, aperture: 0.0006, maxblur: 0.0028 });
    bokeh.enabled = false;
    composer.addPass(bokeh);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), BLOOM, 0.5, 0.98);   // 2.0 최종: 번짐 절제
  // (빛 번짐은 해상도를 낮추면 번지는 반경이 넓어져 문틈 빛 모양이 달라지므로 그대로 둔다)
  composer.addPass(bloom);
  // 고른 물체 층: 깊이만 지우고 위에 그린다(흐림·AO·빛 번짐 없이 또렷하게)
  if (overlay) {
    const ov = new RenderPass(overlay, camera);
    ov.clear = false; ov.clearDepth = true;
    composer.addPass(ov);
  }
  composer.addPass(new OutputPass());
  const smaa = new SMAAPass(innerWidth * ratio(), innerHeight * ratio());
  composer.addPass(smaa);
  const finish = new ShaderPass(FinishShader);
  composer.addPass(finish);
  composer.setSize(innerWidth, innerHeight);

  function applyLevel() {
    composer.setPixelRatio(ratio());
    composer.setSize(innerWidth, innerHeight);
    if (ao) ao.enabled = QUALITY[level].ao;
  }

  let focus = 5;
  let reading = false;
  return {
    lite: false, composer, ao, bokeh,
    get level() { return level; },
    get levels() { return QUALITY.length; },
    get shadowEvery() { return QUALITY[level].shadow; },
    // 품질 단계 바꾸기(0 = 최고). 프레임이 모자라면 main.js가 한 단계씩 내린다
    setLevel(i) {
      const n = Math.max(0, Math.min(QUALITY.length - 1, i));
      if (n === level) return false;
      level = n; applyLevel();
      return true;
    },
    pixelRatio: () => ratio(),
    // 초점 거리(m)를 부드럽게 따라간다
    setFocus(target, dt) {
      focus += (target - focus) * (1 - Math.exp(-4 * dt));
      if (bokeh) bokeh.uniforms.focus.value = focus;
    },
    // 흐림이 없을 때(둘러보기)는 심도 패스 자체를 끈다
    setAperture(a) { if (bokeh) { bokeh.uniforms.aperture.value = a; bokeh.enabled = a > 0; } },
    resize() { applyLevel(); },
    // 읽는 동안에는 빛 번짐을 줄여 글자 대비를 지킨다
    setReading(on) { reading = on; bloom.strength = on ? 0.02 : BLOOM; },
    // 문틈 빛처럼 아주 밝은 곳만 번지게(문 앞 유혹 동안)
    setGlow(g) { if (!reading) bloom.strength = BLOOM + g; },
    render(t) {
      finish.uniforms.time.value = t % 100;
      composer.render();
    },
  };
}
