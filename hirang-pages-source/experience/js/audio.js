// 비밀독서구역 BGM: 외부 음원 없이 Web Audio로 실시간 생성한다.
// 조용한 서점의 따뜻한 패드 화음(가단조·도리안 색), 드문드문 울리는 오르골 선율, 낮은 드론, 오래된 레코드 같은 잡음, 은은한 잔향.
const CHORDS = [
  [57, 60, 64, 71],   // Am(add9 느낌) A C E B
  [53, 57, 60, 64],   // Fmaj7  F A C E
  [50, 53, 57, 64],   // Dm9    D F A E
  [52, 55, 59, 62],   // Em7    E G B D
];
const SCALE = [69, 71, 72, 74, 76, 79, 81, 83, 84];   // A 단조 펜타토닉 + 9·11(오르골 음역)
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createAudio() {
  let ctx = null, master = null, wet = null, timer = 0, nextChord = 0, nextNote = 0, chordIdx = 0, noteIdx = 4;
  let on = true;
  try { on = localStorage.getItem('hirang-bgm') !== 'off'; } catch (e) { /* 저장소 없음 */ }

  function impulse(sec) {
    const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    return buf;
  }

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    const verb = ctx.createConvolver(); verb.buffer = impulse(3.6);
    wet = ctx.createGain(); wet.gain.value = 0.55;
    wet.connect(verb).connect(master);
    // 낮은 드론(A1, 아주 작게) — 공간의 공기
    const drone = ctx.createOscillator(); drone.type = 'sine'; drone.frequency.value = hz(33);
    const dg = ctx.createGain(); dg.gain.value = 0.035;
    const dlfo = ctx.createOscillator(); dlfo.frequency.value = 0.07;
    const dlg = ctx.createGain(); dlg.gain.value = 0.015;
    dlfo.connect(dlg).connect(dg.gain);
    drone.connect(dg).connect(master); dg.connect(wet);
    drone.start(); dlfo.start();
    // 레코드 잡음: 아주 옅은 바스락거림
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() < 0.0008 ? (Math.random() * 2 - 1) * 0.6 : (Math.random() * 2 - 1) * 0.012;
    const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2400; nf.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.16;
    noise.connect(nf).connect(ng).connect(master); noise.start();
    nextChord = nextNote = ctx.currentTime + 0.2;
    timer = setInterval(schedule, 200);
  }

  // 패드: 두 개의 살짝 어긋난 오실레이터를 부드러운 저역 필터로
  function pad(t, notes, dur) {
    for (const m of notes) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.028, t + 2.6);
      g.gain.setValueAtTime(0.028, t + dur - 2.4);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.3;
      g.connect(f); f.connect(master); f.connect(wet);
      for (const [type, det] of [['triangle', -6], ['sine', 7]]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz(m); o.detune.value = det;
        o.connect(g); o.start(t); o.stop(t + dur + 0.8);
      }
    }
  }

  // 오르골: 짧게 울리고 길게 사라지는 맑은 음(기음 + 배음)
  function chime(t, m) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 2.4);
    g.connect(wet); g.connect(master);
    for (const [mult, amp] of [[1, 1], [2.01, 0.32], [4.02, 0.08]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(m) * mult;
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og).connect(g); o.start(t); o.stop(t + 2.5);
    }
  }

  function schedule() {
    const ahead = ctx.currentTime + 1.2;
    while (nextChord < ahead) {
      pad(nextChord, CHORDS[chordIdx % CHORDS.length], 9.5);
      chordIdx++;
      nextChord += 8;
    }
    while (nextNote < ahead) {
      // 드문드문, 비밀을 속삭이듯: 이웃한 음으로 걸어가는 선율
      if (Math.random() < 0.62) {
        noteIdx = Math.max(0, Math.min(SCALE.length - 1, noteIdx + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
        chime(nextNote, SCALE[noteIdx]);
        if (Math.random() < 0.18) chime(nextNote + 0.32, SCALE[Math.max(0, noteIdx - 2)]);
      }
      nextNote += [0.75, 1.0, 1.5, 1.5, 2.25][Math.floor(Math.random() * 5)];
    }
  }

  function setOn(v) {
    on = v;
    try { localStorage.setItem('hirang-bgm', v ? 'on' : 'off'); } catch (e) { /* 저장소 없음 */ }
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(v ? 0.9 : 0, t + 1.5);
  }

  return {
    isOn: () => on,
    // 사용자 동작(문 클릭) 안에서 호출해야 소리가 난다
    start() {
      init();
      if (ctx.state === 'suspended') ctx.resume();
      setOn(on);
    },
    toggle() { if (!ctx) init(); if (ctx.state === 'suspended') ctx.resume(); setOn(!on); return on; },
    fadeOut(sec = 3) {
      if (!ctx) return;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + sec);
      setTimeout(() => clearInterval(timer), sec * 1000 + 100);
    },
  };
}
