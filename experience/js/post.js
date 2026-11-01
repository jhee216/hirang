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

// 출력(sRGB) 뒤에 얹는 마무리: 하이라이트를 따뜻하게, 가장자리를 살짝 어둡게, 아주 옅은 종이 그레인
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.014 }, vignette: { value: 0.09 } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform float grain; uniform float vignette; varying vec2 vUv;
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299,0.587,0.114));
      c.rgb = mix(c.rgb, c.rgb * vec3(1.012, 1.0, 0.98), smoothstep(0.5, 1.0, l));   // 햇빛 쪽은 따뜻하게
      c.rgb = mix(c.rgb, c.rgb * vec3(0.97, 0.96, 1.02), 1.0 - smoothstep(0.0, 0.55, l)); // 그늘은 아주 살짝 라벤더 쪽으로
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - vignette * smoothstep(0.25, 0.85, length(d * vec2(1.1, 1.0)));
      c.rgb += (h(vUv * 1000.0 + time) - 0.5) * grain;
      gl_FragColor = c;
    }`,
};

export function createPost(renderer, scene, camera, { high, overlay }) {
  // 후처리 버퍼에도 4배 MSAA: 이게 없으면 renderer의 antialias가 무시되어 문틀·책장 가장자리가 계단처럼 깨져 보인다
  const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  // 해상도: 화면 밀도를 최대한 따르되(휴대폰·아이패드도 흐리지 않게) 전체 픽셀 수는 성능 한도 안으로
  const ratio = () => Math.max(1, Math.min(devicePixelRatio, 2, Math.sqrt((high ? 4.2e6 : 2.8e6) / (innerWidth * innerHeight))));
  composer.setPixelRatio(ratio());
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));

  let ao = null, bokeh = null;
  if (high) {
    ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.6, thickness: 1.4, scale: 1.0, samples: 12 });
    ao.blendIntensity = 0.7;
    composer.addPass(ao);
    bokeh = new BokehPass(scene, camera, { focus: 5, aperture: 0.0006, maxblur: 0.0028 });
    composer.addPass(bokeh);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.08, 0.55, 0.97);
  composer.addPass(bloom);
  // 고른 물체 층: 깊이만 지우고 위에 그린다(흐림·AO·빛 번짐 없이 또렷하게)
  if (overlay) {
    const ov = new RenderPass(overlay, camera);
    ov.clear = false; ov.clearDepth = true;
    composer.addPass(ov);
  }
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(FinishShader);
  composer.addPass(finish);

  let focus = 5;
  let reading = false;
  return {
    composer, ao, bokeh,
    // 초점 거리(m)를 부드럽게 따라간다
    setFocus(target, dt) {
      focus += (target - focus) * (1 - Math.exp(-4 * dt));
      if (bokeh) bokeh.uniforms.focus.value = focus;
    },
    setAperture(a) { if (bokeh) bokeh.uniforms.aperture.value = a; },
    resize() {
      composer.setPixelRatio(ratio());
      composer.setSize(innerWidth, innerHeight);
      ao?.setSize(innerWidth, innerHeight);
    },
    // 읽는 동안에는 빛 번짐을 줄여 글자 대비를 지킨다
    setReading(on) { reading = on; bloom.strength = on ? 0.03 : 0.08; },
    // 문틈 빛처럼 아주 밝은 곳만 번지게(문 앞 유혹 동안)
    setGlow(g) { if (!reading) bloom.strength = 0.08 + g; },
    render(t) {
      finish.uniforms.time.value = t % 100;
      composer.render();
    },
  };
}
