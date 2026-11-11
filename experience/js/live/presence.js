// 익명 접속(presence): 이 브라우저가 지금 하이랑에 있다는 신호만 보낸다.
//  - 방문자 키: 이 브라우저의 무작위 값(localStorage). 이름·계정·IP와 연결하지 않고, 서버는 키 원문이 아니라 해시만 저장한다.
//    같은 브라우저의 여러 탭·새로고침 = 한 명. 다른 브라우저·시크릿 창 = 다른 사람(정확한 '사람 수'가 아니라 추정치인 이유).
//  - 탭 키: 페이지를 열 때마다 새로(복제한 탭도 서로 다른 탭).
//  - 화면이 숨겨지거나 5분 동안 아무 입력이 없으면 박동을 멈춘다 → 서버에서 45초 뒤 접속이 끝난 것으로 본다.
//  - 창을 닫으면 '나감'을 알린다(몇 초 유예: 새로고침은 나갔다 들어온 것으로 보이지 않는다).
// 돌려받는 값: 나를 뺀 다른 방문자 최대 5명의 '나에게만 의미 있는' 토큰. 정확한 수·식별자는 받지 않는다.
import { getBackend } from './backend.js';

const BEAT_MS = 10000;
const IDLE_MS = 5 * 60 * 1000;
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');

export function visitorKey() {
  try {
    let k = localStorage.getItem('hirang.vk');
    if (!/^[a-f0-9]{32}$/.test(k || '')) { k = hex(16); localStorage.setItem('hirang.vk', k); }
    return k;
  } catch (e) {
    // 저장소를 쓸 수 없는 창(차단·일부 시크릿 모드): 이 페이지 동안만 쓰는 키
    return (visitorKey.mem ||= hex(16));
  }
}

export function startPresence(onFigures) {
  const tab = hex(8);
  let backend = null, timer = 0, lastInput = Date.now(), beating = false, stopped = false;
  const api = { backend: null, figures: [], lastError: null, active: false };

  async function beat() {
    if (!backend || stopped || beating) return;
    beating = true;
    try {
      const f = await backend.beat(visitorKey(), tab);
      api.figures = f; api.lastError = null; api.active = true;
      onFigures(f);
    } catch (e) {
      api.lastError = e.code || e.message;
    } finally { beating = false; }
  }
  const alive = () => !document.hidden && Date.now() - lastInput < IDLE_MS;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (alive()) await beat();
      else if (api.active) { api.active = false; onFigures([]); }   // 쉬는 동안에는 다른 사람도 그리지 않는다(돌아오면 즉시 다시 받음)
      schedule();
    }, BEAT_MS);
  }
  const wake = () => {
    const wasIdle = !api.active;
    lastInput = Date.now();
    if (wasIdle && !document.hidden && backend) { beat(); schedule(); }
  };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, wake, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  addEventListener('pagehide', () => { if (backend) backend.leave(visitorKey(), tab); });
  // 뒤로/앞으로 캐시에서 돌아온 페이지
  addEventListener('pageshow', (e) => { if (e.persisted) { lastInput = Date.now(); beat(); schedule(); } });

  getBackend().then((b) => {
    backend = api.backend = b;
    if (!b) return;
    beat(); schedule();
  });
  api.stop = () => { stopped = true; clearTimeout(timer); if (backend) backend.leave(visitorKey(), tab); };
  api.tab = tab;
  return api;
}
