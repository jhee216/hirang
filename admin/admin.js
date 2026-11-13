// 하이랑 관리자 화면. 데이터는 모두 서버(로컬 /api/admin/* 또는 Supabase 관리자 함수)가 로그인을 확인한 뒤에만 준다.
// 이 파일에는 비밀번호·서비스 키가 없다. 화면에 넣는 글은 모두 textContent(HTML로 해석하지 않음).
import { LIVE } from '../experience/js/live/live-config.js';

const $ = (id) => document.getElementById(id);
const sb = LIVE.supabase || {};
const SUPA = !!(sb.url && sb.anonKey);
const fmt = (n) => (n ?? 0).toLocaleString('ko-KR');

// ---------- 백엔드 ----------
const api = SUPA ? {
  token: () => { try { return sessionStorage.getItem('hirang.admin.token'); } catch (e) { return null; } },
  async login(email, password) {
    const r = await fetch(`${sb.url}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: sb.anonKey }, body: JSON.stringify({ email, password }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(r.status === 400 ? 'denied' : 'error');
    try { sessionStorage.setItem('hirang.admin.token', d.access_token); } catch (e) { /* 이 탭에서만 */ }
    await this.stats();   // 관리자 목록에 없는 계정이면 여기서 거절된다
  },
  async rpc(fn, args = {}) {
    const r = await fetch(`${sb.url}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: sb.anonKey, Authorization: `Bearer ${this.token() || sb.anonKey}` }, body: JSON.stringify(args),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403 || /not_admin|JWT/.test(d.message || '')) throw new Error('unauthorized');
    if (!r.ok) throw new Error(d.message || 'error');
    return d;
  },
  stats() { return this.rpc('hirang_admin_stats'); },
  entries() { return this.rpc('hirang_admin_entries').then((rows) => ({ entries: rows })); },
  moderate(id, action) { return this.rpc('hirang_admin_moderate', { p_id: id, p_action: action }); },
  async logout() { try { sessionStorage.removeItem('hirang.admin.token'); } catch (e) { /* */ } },
} : {
  async req(path, body) {
    const r = await fetch('/api/admin/' + path, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin',
      headers: { 'X-Hirang-Admin': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) throw new Error('unauthorized');
    if (!r.ok) throw new Error(d.error || 'error');
    return d;
  },
  login(_email, password) { return this.req('login', { password }); },
  stats() { return this.req('stats'); },
  entries() { return this.req('entries'); },
  moderate(id, action) { return this.req('moderate', { id, action }); },
  logout() { return this.req('logout', {}).catch(() => {}); },
};

// ---------- 화면: 방명록과 같은 구성(왼쪽 정보 칸 · 오른쪽 알약 + 종이 카드) ----------
const PAPER = ['#F6EFE4', '#D9D4CE', '#EFCAC4', '#E8C9B3', '#C9C2D6', '#E2D5C3', '#D8DCC4', '#B0A8C9', '#B49DC2'];
// 비밀의 책 주변 카드 칸: [칸 번호, 높이 비율] — 왼쪽 두 칸(앞 페이지들) · 오른쪽 두 칸(뒤 페이지들)
const SLOTS = [[0, 1.15], [0, 1], [1, 1], [1, 1.3], [2, 1.25], [2, 1], [3, 1], [3, 1.2]];
const ID_LABEL = { anonymous: '익명', nickname: '닉네임', realname: '실명' };
const ERR = { denied: '비밀번호가 맞지 않습니다.', locked: '로그인 시도가 많아 잠시 잠겼습니다. 15분 뒤 다시 시도하세요.', not_configured: '아직 관리자 비밀번호가 설정되지 않았습니다. 서버에서 python3 tools/hirang_admin.py set-password 를 실행하세요.', unauthorized: '관리자 권한이 없는 계정입니다.' };
const VIEWS = ['book', 'list', 'stats'];

let all = [], filter = 'all', cur = 0, view = 'book', authed = false;
const chrono = () => [...all].sort((a, b) => a.created.localeCompare(b.created) || a.id - b.id);
const fmtTime = (iso) => iso.replace('T', ' ').slice(0, 19);
const whoOf = (e) => e.name || ID_LABEL[e.identity] || '익명';
const visOf = (e) => e.visibility === 'public' ? (e.status === 'hidden' ? ['공개 요청 · 관리자가 가림', 'gone'] : ['공개', 'pub']) : ['숨김(관리자만)', 'priv'];
const no = (n) => `No. ${String(n).padStart(3, '0')}`;
const el = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; };

function setView(v) {
  view = authed ? (VIEWS.includes(v) ? v : 'book') : (v === 'wait' ? 'wait' : 'login');
  $('screen').dataset.view = view;
  $('login').hidden = view !== 'login';
  for (const k of VIEWS) $(k).hidden = view !== k;
  $('pills').querySelectorAll('[data-go]').forEach((p) => {
    const on = p.dataset.go === view; p.classList.toggle('k', on);
    on ? p.setAttribute('aria-current', 'true') : p.removeAttribute('aria-current');
  });
  $('chs').hidden = !authed; $('logout').hidden = !authed;
}
addEventListener('hashchange', () => setView(location.hash.slice(1)));

async function load() {
  try {
    const [s, e] = await Promise.all([api.stats(), api.entries()]);
    all = e.entries || []; authed = true;
    renderStats(s); renderEntries(); renderBook();
    setView(location.hash.slice(1));
  } catch (err) {
    authed = false; setView('login');
    if (err.message !== 'unauthorized') $('loginErr').textContent = '서버에 연결하지 못했습니다.';
  }
}

function renderStats(s) {
  const g = s.guestbook || {};
  // 왼쪽 큰 숫자 두 개는 방명록 기준
  $('sTotal').textContent = fmt(g.total);
  $('sToday').textContent = String(g.today ?? 0).padStart(2, '0');
  $('asOf').textContent = s.now ? `${s.now.replace('T', ' ').slice(0, 16)} 기준` : '';
  $('tActive').textContent = fmt(s.active?.browsers);
  $('tActiveSub').textContent = `브라우저 기준 · 열린 탭 ${fmt(s.active?.tabs)}`;
  $('tToday').textContent = fmt(s.today?.visits);
  $('tTodaySub').textContent = `추정 고유 방문자 ${fmt(s.today?.unique)}`;
  $('tTotal').textContent = fmt(s.total?.visits);
  $('tTotalSub').textContent = `추정 고유 방문자 ${fmt(s.total?.unique)}`;
  $('tGb').textContent = fmt(g.total);
  $('tGbSub').textContent = `공개 중 ${fmt(g.public)} · 숨긴 글 ${fmt(g.private)} · 가림 ${fmt(g.hidden)} · 오늘 ${fmt(g.today)}`;
  const tb = $('daily'); tb.textContent = '';
  for (const d of [...(s.daily || [])].reverse()) {
    const tr = document.createElement('tr');
    for (const v of [d.day, fmt(d.visits), fmt(d.unique), fmt(d.entries)]) tr.append(el('td', '', v));
    tb.append(tr);
  }
}

function actions(e, box) {
  box.textContent = '';
  for (const [label, action, show, danger] of [
    ['공개에서 가리기', 'hide', e.visibility === 'public' && e.status === 'visible'],
    ['다시 공개', 'show', e.visibility === 'public' && e.status === 'hidden'],
    ['숨긴 글로 바꾸기', 'make_private', e.visibility === 'public'],
    ['삭제', 'remove', true, true],
  ]) {
    if (!show) continue;
    const b = el('button', danger ? 'danger' : '', label); b.type = 'button';
    b.addEventListener('click', () => moderate(e.id, action, b));
    box.append(b);
  }
  return box;
}

// ---------- 비밀의 책: 웹사이트 큐레이션과 같은 모자이크 ----------
// 데스크톱 5열(2+2+1+2+2), 휴대폰 3열(3+3+3) — 한 번에 9장(오래된 순). [칸 안 순번, 높이 비중]
const DESK = [[[0, 1.3], [1, 1]], [[2, 1], [3, 1.35]], [[4, 1]], [[5, 1.2], [6, 1]], [[7, 1], [8, 1.3]]];
const MOB = [[[0, 1.25], [1, 1], [2, 1.1]], [[3, 1], [4, 1.3], [5, 1]], [[6, 1.2], [7, 1], [8, 1.15]]];
const PER = 9, NEAR = 28;
const mq = matchMedia('(max-width:900px)');
const SHORT = { pub: '공개', priv: '숨김', gone: '가림' };
let sp = 0, tiles = [], active = null, pend, timer = 0, openId = null, lastPT = 'mouse';

function setActive(t) {
  if (t === active) return;
  if (active) { active.classList.remove('on'); active.parentElement.classList.remove('on'); }
  active = t;
  if (t) { t.classList.add('on'); t.parentElement.classList.add('on'); }
  $('mosaic').classList.toggle('has-on', !!t);
}
function want(t) {
  if (t === active) { pend = undefined; clearTimeout(timer); return; }
  if (pend !== undefined && t === pend) return;
  pend = t; clearTimeout(timer);
  timer = setTimeout(() => { setActive(pend); pend = undefined; }, t === null ? 120 : 70);
}
function nearest(x, y) {
  let best = null, bd = 1e9;
  for (const t of tiles) {
    const r = t.getBoundingClientRect();
    const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
    if (d < bd) { bd = d; best = t; }
  }
  return bd <= NEAR ? best : null;
}
let raf = 0, px = 0, py = 0;
document.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch' || view !== 'book' || openId != null) return;
  px = e.clientX; py = e.clientY;
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; want(nearest(px, py)); });
});
document.addEventListener('mouseout', (e) => { if (!e.relatedTarget && openId == null) want(null); });
document.addEventListener('pointerdown', (e) => {
  lastPT = e.pointerType;
  if (e.pointerType !== 'mouse' && view === 'book' && openId == null && !e.target.closest('.mosaic .tile')) setActive(null);
}, true);

function renderMosaic() {
  const list = chrono();
  const pages = Math.max(1, Math.ceil(list.length / PER));
  sp = Math.max(0, Math.min(sp, pages - 1));
  const m = $('mosaic'); m.textContent = ''; m.classList.remove('has-on');
  tiles = []; active = null;
  (mq.matches ? MOB : DESK).forEach((colDef) => {
    const col = el('div', 'col');
    for (const [k, h] of colDef) {
      const i = sp * PER + k, p = list[i];
      const t = el(p ? 'button' : 'div', 'tile' + (p ? '' : ' blank'));
      t.style.setProperty('--h', h);
      t.style.setProperty('--c', PAPER[(p ? i : k + 3) % PAPER.length]);
      if (p) {
        t.type = 'button'; t.dataset.i = i;
        t.append(el('span', 'g', `${whoOf(p)} · ${SHORT[visOf(p)[1]]}`), el('span', 'q', p.body), el('span', 'nm', no(i + 1)), el('span', 'more', '펼쳐 읽기'));
        t.setAttribute('aria-label', `${no(i + 1)} 펼쳐 읽기`);
        t.addEventListener('click', (e) => {
          // 마우스·키보드는 바로 펼친다. 터치는 첫 탭에 커지고, 두 번째 탭에 펼친다
          if (lastPT !== 'mouse' && e.detail !== 0 && t !== active) { setActive(t); return; }
          openPage(i, t);
        });
        t.addEventListener('focus', () => { if (t.matches(':focus-visible')) setActive(t); });
        tiles.push(t);
      } else t.setAttribute('aria-hidden', 'true');
      col.append(t);
    }
    m.append(col);
  });
  $('bookEmpty').hidden = list.length > 0;
  m.hidden = list.length === 0;
  const a = sp * PER + 1, b = Math.min(list.length, (sp + 1) * PER);
  $('sPos').textContent = list.length ? `${a === b ? a : `${a}–${b}`} / ${list.length}쪽` : '';
  $('sPrev').disabled = sp <= 0;
  $('sNext').disabled = sp >= pages - 1;
}
mq.addEventListener('change', () => { if (authed) renderMosaic(); });
const turnSpread = (d) => { sp += d; renderMosaic(); };
$('sPrev').addEventListener('click', () => turnSpread(-1));
$('sNext').addEventListener('click', () => turnSpread(1));

// 펼친 한 장: 누른 카드 자리에서 커져 나온다(같은 자리로 접혀 들어간다)
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function clipFrom(t) {
  const s = $('stage').getBoundingClientRect(), r = t.getBoundingClientRect();
  return `inset(${r.top - s.top}px ${s.right - r.right}px ${s.bottom - r.bottom}px ${r.left - s.left}px round 10px)`;
}
function fillPage(dir) {
  const list = chrono(), i = list.findIndex((x) => x.id === openId), e = list[i];
  if (!e) return closePage(true);
  const [vl, vc] = visOf(e);
  $('aNo').textContent = no(i + 1);
  $('aVis').textContent = vl; $('aVis').className = 'tag ' + vc;
  $('aName').textContent = `${whoOf(e)}${e.name ? ` · ${ID_LABEL[e.identity]}${e.showName ? ' (이름 공개)' : ' (이름 비공개)'}` : ''}`;
  $('aTime').textContent = fmtTime(e.created); $('aTime').dateTime = e.created;
  $('aBody').textContent = e.body;
  actions(e, $('aActs'));
  $('bPos').textContent = `${i + 1} / ${list.length}쪽`;
  $('bPrev').disabled = i <= 0; $('bNext').disabled = i >= list.length - 1;
  if (dir) { const leaf = $('leaf'); leaf.className = 'leaf'; void leaf.offsetWidth; leaf.className = `leaf in-${dir > 0 ? 'n' : 'p'}`; }
}
function openPage(i, t) {
  const e = chrono()[i]; if (!e) return;
  openId = e.id; clearTimeout(timer); pend = undefined;
  fillPage();
  const pg = $('apage'); pg.hidden = false;
  if (!reduceMotion && t) pg.animate([{ clipPath: clipFrom(t), opacity: .6 }, { clipPath: 'inset(0px 0px 0px 0px round 10px)', opacity: 1 }], { duration: 560, easing: 'cubic-bezier(.22,1,.36,1)' });
  $('aClose').focus({ preventScroll: true });
}
function closePage(instant) {
  if (openId == null) return;
  const list = chrono(), i = list.findIndex((x) => x.id === openId);
  openId = null;
  const pg = $('apage');
  if (i >= 0) { const s = Math.floor(i / PER); if (s !== sp) { sp = s; renderMosaic(); } }
  const t = tiles.find((x) => +x.dataset.i === i);
  if (instant || reduceMotion || !t) { pg.hidden = true; return; }
  const anim = pg.animate([{ clipPath: 'inset(0px 0px 0px 0px round 10px)', opacity: 1 }, { clipPath: clipFrom(t), opacity: .4 }], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
  const done = () => { pg.hidden = true; t.focus({ preventScroll: true }); };
  Promise.race([anim.finished, new Promise((r) => setTimeout(r, 700))]).then(done, done);
}
function stepPage(d) {
  const list = chrono(), i = list.findIndex((x) => x.id === openId) + d;
  if (i < 0 || i >= list.length) return;
  openId = list[i].id;
  const s = Math.floor(i / PER); if (s !== sp) { sp = s; renderMosaic(); }   // 뒤의 모자이크도 같은 9장으로
  fillPage(d);
}
$('aClose').addEventListener('click', () => closePage());
$('bPrev').addEventListener('click', () => stepPage(-1));
$('bNext').addEventListener('click', () => stepPage(1));
document.addEventListener('keydown', (e) => {
  if (view !== 'book' || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (openId != null) {
    if (e.key === 'Escape') closePage();
    if (e.key === 'ArrowRight') stepPage(1);
    if (e.key === 'ArrowLeft') stepPage(-1);
  } else {
    if (e.key === 'ArrowRight' && !$('sNext').disabled) turnSpread(1);
    if (e.key === 'ArrowLeft' && !$('sPrev').disabled) turnSpread(-1);
  }
});
function renderBook() {
  renderMosaic();
  if (openId != null) { if (all.some((x) => x.id === openId)) fillPage(); else closePage(true); }
}

// ---------- 목록 · 관리: 최신 순 종이 카드 ----------
function renderEntries() {
  const list = $('entries'); list.textContent = '';
  const order = chrono().map((e) => e.id);
  const rows = all.filter((e) => filter === 'all' || (filter === 'public' && e.visibility === 'public' && e.status === 'visible')
    || (filter === 'private' && e.visibility === 'private') || (filter === 'hidden' && e.status === 'hidden'));
  $('entriesEmpty').hidden = rows.length > 0;
  for (const e of rows) {
    const n = order.indexOf(e.id);
    const li = el('li', `entry ${e.visibility} ${e.status}`);
    li.style.setProperty('--c', PAPER[n % PAPER.length]);
    const meta = el('div', 'meta');
    const [vl, vc] = visOf(e);
    meta.append(el('span', 'tag ' + vc, vl), el('span', 'who', `${no(n + 1)} · ${ID_LABEL[e.identity]}${e.name ? ` · ${e.name}${e.showName ? ' (이름 공개)' : ' (이름 비공개)'}` : ''}`));
    const time = el('time', '', fmtTime(e.created)); time.dateTime = e.created; meta.append(time);
    li.append(meta, el('p', 'body', e.body), actions(e, el('div', 'acts')));
    list.append(li);
  }
}

async function moderate(id, action, b) {
  if (action === 'remove' && !confirm('이 페이지를 완전히 지웁니다. 되돌릴 수 없습니다. 계속할까요?')) return;
  b.disabled = true;
  try { await api.moderate(id, action); await load(); } catch (err) { b.disabled = false; alert('처리하지 못했습니다.'); }
}

// PDF: 브라우저 인쇄 → 'PDF로 저장'. 한 장에 한 페이지
$('printBook').addEventListener('click', () => {
  const area = $('printArea'); area.textContent = '';
  const cover = el('section', 'pcover');
  cover.append(el('h1', '', 'HIRANG GUESTBOOK'), el('p', '', `방문자가 남긴 ${all.length}페이지 · ${new Date().toLocaleDateString('ko-KR')} 엮음`));
  area.append(cover);
  chrono().forEach((e, i) => {
    const a = el('article', 'ppage'), h = el('header');
    const t = el('time', '', fmtTime(e.created)); h.append(el('b', '', no(i + 1)), t);
    a.append(h, el('p', 'pmeta', `${ID_LABEL[e.identity]}${e.name ? ` · ${e.name}${e.showName ? ' (이름 공개)' : ' (이름 비공개)'}` : ''}  ·  ${visOf(e)[0]}`), el('p', 'pbody', e.body));
    area.append(a);
  });
  window.print();
});

$('loginForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('loginErr').textContent = '';
  try { await api.login($('email').value, $('password').value); $('password').value = ''; await load(); }
  catch (err) { $('loginErr').textContent = ERR[err.message] || '로그인하지 못했습니다.'; }
});
$('logout').addEventListener('click', async () => {
  await api.logout(); all = []; authed = false; openId = null; $('apage').hidden = true;
  $('sTotal').textContent = $('sToday').textContent = '–';
  setView('login');
});
document.querySelectorAll('.refresh').forEach((b) => b.addEventListener('click', load));
document.querySelectorAll('.filters button').forEach((b) => b.addEventListener('click', () => {
  filter = b.dataset.f;
  document.querySelectorAll('.filters button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  renderEntries();
}));
$('fileHint').hidden = true;   // 스크립트가 돌고 있다 = 주소로 연 화면
if (SUPA) { $('emailRow').hidden = false; $('email').required = true; }
setView(SUPA && api.token() ? 'wait' : 'login');
load();
