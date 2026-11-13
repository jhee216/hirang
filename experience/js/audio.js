// 비밀독서구역 BGM (2.0 최종, 2026-11-10): 승인된 'Margin Notes' 원곡으로 교체.
// 이전 버전은 외부 음원 없이 Web Audio로 패드·오르골을 실시간 합성했다(그래서 음원 파일을 바꿔도 소리가 그대로였다).
// 원곡: ~/Downloads/Margin_Notes.mp3 (61.9 s) → assets/audio/hirang-bgm-margin-notes.mp3
//   0–54 s 구간, 끝(54–57 s, 잦아드는 아웃트로)을 처음 3 s에 겹쳐 넣은 이음매 없는 루프, −19.9 LUFS, 160 kbps
//   (만드는 명령: HIRANG_2.0_DESIGN_DIRECTION.md 9장)
// 재생: 디코드한 버퍼를 AudioBufferSourceNode.loop로 — <audio loop>와 달리 루프 지점에 빈틈·딸깍 소리가 없다.
// 사용자 동작(문 클릭·첫 터치) 안에서만 시작(자동 재생 제한), 인스턴스 하나, 읽는 동안 음량을 낮춘다.
const SRC = 'assets/audio/hirang-bgm-margin-notes.mp3?v=20261110';   // 파일을 바꾸면 v를 올려 캐시된 옛 파일을 피한다
const LOOP_SEC = 54.0;
const READING_DUCK = 0.45;   // 책·패키지를 펼쳐 읽는 동안 음량 배율
const FADE_IN = 3.0;

export function createAudio() {
  let stepBuf = null;
  let ctx = null, master = null, duck = null, source = null, buffer = null, loading = null, meter = null;
  let on = true, volume = 0.4,   // 2026-11-11: 처음 음량 60 → 40
  reading = false, wanted = false, startedAt = 0;
  try { on = localStorage.getItem('hirang-bgm') !== 'off'; } catch (e) { /* 저장소 없음 */ }
  try { const v = parseFloat(localStorage.getItem('hirang-bgm-vol-v2')); if (v >= 0 && v <= 1) volume = v; } catch (e) { /* 저장소 없음 */ }
  const state = { src: SRC, loaded: false, playing: false, error: null, duration: 0, loopStart: 0, loopEnd: 0 };

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;          // 켜기/끄기·음량
    duck = ctx.createGain(); duck.gain.value = 1;              // 읽는 동안 낮추기
    master.connect(duck).connect(ctx.destination);
    meter = ctx.createAnalyser(); meter.fftSize = 2048; duck.connect(meter);   // 확인용: 실제로 나가는 소리 크기
    loading = fetch(SRC, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(`BGM ${r.status}`); return r.arrayBuffer(); })
      .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .then((buf) => { buffer = buf; state.loaded = true; state.duration = buf.duration; if (wanted) play(); })
      .catch((e) => { state.error = String(e); console.warn('[HIRANG BGM]', e); });
  }

  function play() {
    if (!buffer || source) return;                             // 인스턴스는 하나만
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    // 디코더가 앞에 붙인 여백(인코더 지연)이 있으면 건너뛰어 정확히 54 s 구간만 돈다
    const pad = Math.max(0, buffer.duration - LOOP_SEC);
    source.loopStart = pad; source.loopEnd = pad + LOOP_SEC;
    state.loopStart = source.loopStart; state.loopEnd = source.loopEnd;
    source.connect(master);
    source.start(ctx.currentTime + 0.05, pad);
    startedAt = ctx.currentTime + 0.05;
    state.playing = true;
  }

  function ramp(node, value, sec) {
    const t = ctx.currentTime;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(node.gain.value, t);
    node.gain.linearRampToValueAtTime(value, t + sec);
  }

  function apply(sec) {
    if (!ctx) return;
    ramp(master, on ? volume : 0, sec);
  }

  function setOn(v) {
    on = v;
    try { localStorage.setItem('hirang-bgm', v ? 'on' : 'off'); } catch (e) { /* 저장소 없음 */ }
    apply(v ? FADE_IN : 1.2);
  }

  // 2026-11-13: 다른 앱·다른 탭으로 나가거나 페이지를 떠나면 음악을 멈추고, 돌아오면 이어서 재생한다
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (wanted) ctx.resume();
  });
  addEventListener('pagehide', () => { if (ctx) ctx.suspend(); });
  addEventListener('pageshow', (e) => { if (e.persisted && ctx && wanted && !document.hidden) ctx.resume(); });

  return {
    isOn: () => on,
    getVolume: () => volume,
    // 지금 스피커로 나가는 소리의 RMS(dBFS). 무음이면 −100
    level() { if (!meter) return -100; const a = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(a); let e = 0; for (const v of a) e += v * v; return 10 * Math.log10(e / a.length + 1e-10); },
    position: () => (ctx && source ? ((ctx.currentTime - startedAt) % LOOP_SEC) : 0),
    info: () => ({ ...state, ctxState: ctx?.state ?? 'none', gain: master?.gain.value ?? 0, duck: duck?.gain.value ?? 1, volume, on, reading }),
    // 사용자 동작(문 클릭) 안에서 호출해야 소리가 난다. 여러 번 불려도 소리는 하나
    start() {
      init();
      wanted = true;
      if (ctx.state === 'suspended') ctx.resume();
      play();
      setOn(on);
    },
    toggle() { this.start(); setOn(!on); return on; },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      try { localStorage.setItem('hirang-bgm-vol-v2', String(volume)); } catch (e) { /* 저장소 없음 */ }
      apply(0.25);
    },
    // 읽는 동안은 음악을 한 걸음 뒤로(매 프레임 불려도 상태가 바뀔 때만 동작)
    setReading(r) {
      if (r === reading) return;
      reading = r;
      if (ctx) ramp(duck, r ? READING_DUCK : 1, r ? 1.2 : 2.0);
    },
    // 2026-11-14: 나무 바닥을 걷는 낮고 부드러운 발소리 한 번(배경음과 같은 켜기·음량을 따른다). 매번 조금씩 다르게
    step(k = 1) {
      if (!ctx || !on || ctx.state !== 'running' || k < 0.2) return;
      const t = ctx.currentTime, amp = Math.min(1, volume * 1.6) * k;
      if (!stepBuf) {
        stepBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
        const d = stepBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      }
      const n = ctx.createBufferSource(); n.buffer = stepBuf; n.playbackRate.value = 0.75 + Math.random() * 0.3;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 550 + Math.random() * 250;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * amp + 1e-4, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      n.connect(lp).connect(g).connect(ctx.destination); n.start(t); n.stop(t + 0.2);
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(105 + Math.random() * 15, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.09);
      const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.12 * amp + 1e-4, t + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(og).connect(ctx.destination); o.start(t); o.stop(t + 0.14);
    },
    fadeOut(sec = 3) {
      if (!ctx) return;
      ramp(master, 0, sec);
      setTimeout(() => { try { source?.stop(); } catch (e) { /* 이미 멈춤 */ } source = null; state.playing = false; }, sec * 1000 + 100);
    },
  };
}
