// 라이브 백엔드 어댑터: 로컬 서버(/api) 또는 Supabase(RPC). 두 쪽 모두 같은 응답 모양을 돌려준다.
// 3D(experience/)와 방명록 페이지(guestbook/)가 함께 쓴다.
// 공개 응답에는 숨긴 글의 내용·작성 시각·정확한 수·세션 식별자가 들어 있지 않다(서버·DB에서 걸러 낸다).
import { LIVE } from './live-config.js';

function localAdapter(base) {
  const post = (p, body, opts = {}) => fetch(base + p, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'omit', ...opts,
  });
  const json = async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(d.error || r.status), { code: d.error, status: r.status }); return d; };
  return {
    kind: 'local',
    beat: (vk, tab) => post('/api/presence/beat', { vk, tab }).then(json).then((d) => d.figures || []),
    leave(vk, tab) {
      const data = JSON.stringify({ vk, tab });
      if (navigator.sendBeacon) navigator.sendBeacon(base + '/api/presence/leave', new Blob([data], { type: 'application/json' }));
      else post('/api/presence/leave', { vk, tab }, { keepalive: true }).catch(() => {});
    },
    publicPages: () => fetch(base + '/api/guestbook/public', { credentials: 'omit' }).then(json),
    trace: () => fetch(base + '/api/guestbook/trace', { credentials: 'omit' }).then(json).then((d) => d.trace),
    submit: (payload) => post('/api/guestbook/submit', payload).then(json),
  };
}

function supabaseAdapter({ url, anonKey }) {
  const rpc = (fn, args, opts = {}) => fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify(args || {}), credentials: 'omit', ...opts,
  }).then(async (r) => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const code = (d.message || '').replace(/^hirang:/, ''); throw Object.assign(new Error(code || r.status), { code, status: r.status }); }
    return d;
  });
  return {
    kind: 'supabase',
    beat: (vk, tab) => rpc('hirang_beat', { p_vk: vk, p_tab: tab }).then((d) => d?.figures || []),
    leave: (vk, tab) => { rpc('hirang_leave', { p_vk: vk, p_tab: tab }, { keepalive: true }).catch(() => {}); },
    publicPages: () => rpc('hirang_public', {}),
    trace: () => rpc('hirang_public', {}).then((d) => d.trace),
    submit: (p) => rpc('hirang_submit', {
      p_vk: p.vk, p_body: p.body, p_identity: p.identity, p_name: p.name || null, p_show_name: !!p.showName,
      p_visibility: p.visibility, p_website: p.website || '', p_elapsed: p.elapsed | 0,
    }),
  };
}

let ready;
// 사용할 백엔드를 한 번만 정한다. 없으면 null(방문자 캐릭터·방명록 없이 기존 경험 그대로)
export function getBackend() {
  ready ||= (async () => {
    const sb = LIVE.supabase || {};
    if (sb.url && sb.anonKey) return supabaseAdapter(sb);
    // GitHub Pages(정적 호스팅)에는 서버가 없다 — 확인 요청을 보내지 않는다(콘솔 404 방지)
    if (/\.github\.io$/.test(location.hostname)) return null;
    try {
      const r = await fetch('/api/health', { cache: 'no-store', credentials: 'omit' });
      if (r.ok && (await r.json()).ok) return localAdapter('');
    } catch (e) { /* 정적 호스팅: API 없음 */ }
    return null;
  })();
  return ready;
}
