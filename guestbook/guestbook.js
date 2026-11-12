// HIRANG GUESTBOOK — 웹사이트 '비밀 큐레이션' 화면과 같은 구성(왼쪽 정보 칸 · 오른쪽 알약 + 종이 카드 모자이크)
// 승인된 흐름은 그대로: 가운데 한 장을 쓴다(익명·숨기기가 기본) → 접혀 '비밀의 보관함'으로 → 공개를 고른 페이지만 카드로 펼쳐 읽는다.
//  - 카드에는 서버가 준 공개 페이지만 들어간다(숨긴 글·시각·식별자는 브라우저로 오지 않는다). 빈 칸은 글 없는 빈 종이 — 지어낸 글은 넣지 않는다.
//  - 보관함의 심볼 조각 고리는 서버의 로그 단계(0~12)로만 그린다(개수로 방문 수를 셀 수 없다).
//  - 사용자 글은 모두 textContent로만 넣는다.
import { getBackend } from './lib/backend.js';
import { visitorKey } from './lib/visitor-key.js';

const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));
// 애니메이션이 멈춘 환경(백그라운드 탭 등)에서도 흐름이 끝나도록: 정해진 시간이 지나면 마지막 장면으로
const play = (anim, ms) => Promise.race([anim.finished, new Promise((r) => setTimeout(r, ms + 400))]).then(() => { try { anim.finish(); } catch (e) { /* 끝남 */ } });
const ERR = {
  too_fast: '조금 더 천천히 적어 주세요.',
  too_short: '두 글자 이상 적어 주세요.',
  too_long: '300자까지 남길 수 있습니다.',
  links: '링크나 주소는 남길 수 없습니다.',
  rate: '페이지를 여러 번 남기셨습니다. 잠시 후 다시 남겨 주세요.',
  duplicate: '같은 글이 이미 보관함에 있습니다.',
  name_too_long: '이름은 20자까지 적을 수 있습니다.',
};
// 웹사이트 큐레이션 카드와 같은 아홉 가지 종이 색
const PAPER = ['#F6EFE4', '#D9D4CE', '#EFCAC4', '#E8C9B3', '#C9C2D6', '#E2D5C3', '#D8DCC4', '#B0A8C9'];
// 모자이크 칸: [칸 번호, 높이 비율]
const SLOTS = [[0, 1.15], [0, 1], [1, 1], [1, 1.3], [2, 1.25], [2, 1], [3, 1]];

const room = $('room'), page = $('page'), form = $('form'), body = $('body'), nameIn = $('name');
let backend = null, pages = [], idx = 0, openedAt = Date.now(), busy = false, level = { visits: 0, leaves: 0 }, freshId = null;

/* ---------- 모자이크: 공개 페이지 카드 + 빈 종이 ---------- */
function renderTiles() {
  document.querySelectorAll('.col .tile:not(.vault)').forEach((t) => t.remove());
  SLOTS.forEach(([c, h], i) => {
    const col = document.querySelector(`.col[data-col="${c}"]`);
    const p = pages[i];
    const t = document.createElement(p ? 'button' : 'div');
    t.className = 'tile' + (p ? '' : ' blank') + (p && p.id === freshId ? ' new' : '');
    t.style.setProperty('--c', PAPER[i % PAPER.length]);
    t.style.setProperty('--h', h);
    if (p) {
      t.type = 'button';
      const g = document.createElement('span'); g.className = 'g'; g.textContent = p.name || '익명';
      const q = document.createElement('p'); q.className = 'q'; q.textContent = p.body;
      t.append(g, q);
      t.setAttribute('aria-label', `${p.name || '익명'}의 페이지 펼쳐 읽기`);
      t.addEventListener('click', () => { idx = i; go('read'); });
      if (room.dataset.mode === 'read' && i === ((idx % pages.length) + pages.length) % pages.length) t.classList.add('on');
    } else t.setAttribute('aria-hidden', 'true');
    const vault = col.querySelector('.vault');
    vault ? col.insertBefore(t, vault) : col.append(t);
  });
}

/* ---------- 읽기 ---------- */
function renderRead() {
  const has = pages.length > 0;
  $('leaf').hidden = !has; $('empty').hidden = has;
  $('prev').disabled = $('next').disabled = pages.length < 2;
  if (!has) { $('readLabel').textContent = 'FROM THE ARCHIVE'; return; }
  const p = pages[((idx % pages.length) + pages.length) % pages.length];
  $('readLabel').textContent = p.name || '익명';
  $('leafBody').textContent = p.body;
  document.querySelectorAll('button.tile').forEach((t, i) => t.classList.toggle('on', i === ((idx % pages.length) + pages.length) % pages.length));
}
async function turn(d) {
  if (pages.length < 2) return;
  const leaf = $('leaf'), k = d > 0 ? 'n' : 'p';
  leaf.className = `leaf out-${k}`; await wait(260);
  idx += d; renderRead();
  leaf.className = `leaf in-${k}`; await wait(450); leaf.className = 'leaf';
}
$('prev').addEventListener('click', () => turn(-1));
$('next').addEventListener('click', () => turn(1));
$('read').addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') turn(-1); if (e.key === 'ArrowRight') turn(1); });

/* ---------- 쓰기 / 읽기 전환(주소 #write · #read — 뒤로/앞으로 가기에도 맞는다) ---------- */
function setMode(m) {
  room.dataset.mode = m;
  form.hidden = m !== 'write'; $('read').hidden = m !== 'read';
  page.classList.toggle('reading', m === 'read');
  $('pWrite').classList.toggle('k', m === 'write'); $('pRead').classList.toggle('k', m === 'read');
  $('pWrite').toggleAttribute('aria-current', m === 'write'); $('pRead').toggleAttribute('aria-current', m === 'read');
  if (m === 'read') renderRead(); else document.querySelectorAll('button.tile.on').forEach((t) => t.classList.remove('on'));
}
function go(m) {
  if (location.hash !== '#' + m) history.pushState(null, '', '#' + m);
  setMode(m);
  if (m === 'write' && !matchMedia('(max-width:900px)').matches) body.focus({ preventScroll: true });
  if (matchMedia('(max-width:900px)').matches) page.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}
document.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); go(a.dataset.go); }));
addEventListener('popstate', () => setMode(location.hash === '#read' ? 'read' : 'write'));

/* ---------- 쓰기 ---------- */
const val = (n) => form.querySelector(`input[name="${n}"]:checked`).value;
function sync() {
  const id = val('identity'), pub = val('visibility') === 'public';
  nameIn.hidden = id === 'anonymous';
  nameIn.placeholder = id === 'realname' ? '실명' : '닉네임';
  $('showNameRow').hidden = !(pub && id !== 'anonymous');
  if ($('showNameRow').hidden) $('showName').checked = false;
  document.querySelector('.opts2').classList.toggle('empty-row', nameIn.hidden && $('showNameRow').hidden);
  $('visHint').textContent = pub ? '다른 방문자도 이 페이지를 펼쳐 읽을 수 있습니다.' : '관리자만 읽을 수 있습니다.';
  $('count').textContent = String(body.value.length);
}
form.addEventListener('change', sync);
body.addEventListener('input', sync);

/* ---------- 비밀의 보관함: 하이랑 심볼 조각 고리 ---------- */
let symD = null;
async function loadSymbol() {
  try {
    const s = await fetch('assets/symbol-shape.json').then((r) => r.json());
    const P = (pts, step) => pts.filter((_, i) => i % step === 0).map(([u, v], i) => `${i ? 'L' : 'M'}${((u - 0.5) * 2).toFixed(3)} ${((v - s.aspect / 2) * 2).toFixed(3)}`).join('') + 'Z';
    symD = P(s.outer, Math.max(1, Math.floor(s.outer.length / 80))) + s.holes.map((h) => P(h, Math.max(1, Math.floor(h.length / 30)))).join('');
  } catch (e) { symD = 'M-1 -.7h2v1.4h-2z'; }
}
const rnd = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const FILL = ['rgba(255,249,234,.85)', 'rgba(255,249,234,.62)', 'rgba(244,236,252,.78)', 'rgba(255,249,234,.95)'];
// 단계(0~12) → 조각 [x, y, 회전, 크기, 색]: 낱장 몇 장 → 6장씩 꽃잎 → 하나의 고리
function layout(L) {
  const r = rnd(17), out = [];
  if (L <= 0) return out;
  if (L <= 4) { const n = [0, 1, 2, 3, 5][L]; for (let i = 0; i < n; i++) { const a = i * 1.25 + r() * 0.6; out.push([Math.cos(a) * (38 + r() * 30), Math.sin(a) * (38 + r() * 30), r() * 60 - 30, 13 + r() * 4, i % 4]); } return out; }
  if (L <= 8) { const cs = [[0, 0], [-42, -34], [44, -30], [2, 46]].slice(0, L - 4); cs.forEach(([cx, cy], k) => { for (let j = 0; j < 6; j++) { const a = j / 6 * Math.PI * 2 + k; out.push([cx + Math.cos(a) * 15, cy + Math.sin(a) * 15, a * 57.3 + 90, 10, (j + k) % 4]); } }); return out; }
  const n = Math.min(40, 20 + (L - 9) * 6);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; out.push([Math.cos(a) * (66 + (i % 2) * 8), Math.sin(a) * (66 + (i % 2) * 8), a * 57.3 + 90, 10 + (i % 3) * 1.5, i % 4]); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; out.push([Math.cos(a) * 30, Math.sin(a) * 30, a * 57.3 + 90, 9, 2]); }
  return out;
}
const frag = (x, y, rot, size, ci, cls = '') => `<g class="frag ${cls}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${(size / 2).toFixed(2)})"><path d="${symD}" fill-rule="evenodd" fill="${FILL[ci] || 'rgba(255,249,234,.95)'}"/></g>`;
const myFrags = [];
function drawTraces() {
  if (!symD) return;
  $('traces').innerHTML = layout(Math.max(level.visits, level.leaves)).map((f) => frag(...f)).join('') + myFrags.map((f) => frag(...f)).join('');
}
function addMyTrace() {
  if (!symD) return;
  const a = -1.2 + myFrags.length * 0.5, f = [Math.cos(a) * 84, Math.sin(a) * 84, a * 57.3 + 90, 15, 9];
  myFrags.push(f);
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.innerHTML = frag(...f, 'new');
  $('traces').append(g.firstChild);
  const v = $('vault'); v.classList.remove('take'); void v.offsetWidth; v.classList.add('take');
}
async function trace() { try { const t = await backend.trace(); if (t) { level = t; drawTraces(); } } catch (e) { /* 흔적 없이 */ } }

/* ---------- 접혀 보관함으로 ---------- */
async function foldIntoVault(text) {
  if (reduced) { addMyTrace(); return; }
  const r = page.getBoundingClientRect(), b = body.getBoundingClientRect();
  const fold = $('fold');
  Object.assign(fold.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  for (const f of [$('faceTop'), $('faceBottom')]) { f.textContent = text; f.style.padding = `${b.top - r.top + 4}px ${r.right - b.right}px 0 ${b.left - r.left}px`; f.style.height = `${r.height}px`; }
  $('faceTop').style.top = '0'; $('faceBottom').style.top = `${-r.height / 2}px`;
  fold.hidden = false;
  page.style.transition = 'none'; page.style.opacity = '0';
  const bottom = fold.querySelector('.bottom');
  await play(bottom.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(178deg)' }], { duration: 640, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'forwards' }), 640);
  const t = $('vault').getBoundingClientRect();
  const dx = t.left + t.width / 2 - (r.left + r.width / 2), dy = t.top + t.height / 2 - (r.top + r.height / 4);
  await play(fold.animate([
    { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.4 - 50}px) scale(.55) rotate(-4deg)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(.16) rotate(-10deg)`, opacity: 0 },
  ], { duration: 820, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' }), 820);
  addMyTrace();
  fold.hidden = true; fold.getAnimations().forEach((a) => a.cancel()); bottom.getAnimations().forEach((a) => a.cancel());
}
function freshPage(msg, eyebrow) {
  form.reset(); sync(); openedAt = Date.now();
  page.style.opacity = ''; page.style.transition = '';
  page.classList.remove('arrive'); void page.offsetWidth; page.classList.add('arrive');
  $('eyebrow').textContent = eyebrow; $('visHint').textContent = msg; $('live').textContent = msg;
  setTimeout(() => { if (room.dataset.mode === 'write') { $('eyebrow').textContent = 'ONE PAGE'; sync(); } }, 5000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy) return;
  $('err').textContent = '';
  const text = body.value.trim();
  if (text.length < 2) { $('err').textContent = ERR.too_short; body.focus(); return; }
  const identity = val('identity');
  const name = identity === 'anonymous' ? '' : nameIn.value.trim();
  if (identity !== 'anonymous' && !name) { $('err').textContent = identity === 'realname' ? '실명을 적거나 익명을 골라 주세요.' : '닉네임을 적거나 익명을 골라 주세요.'; nameIn.focus(); return; }
  const visibility = val('visibility');
  busy = true; $('submit').disabled = true;
  form.classList.add('ink'); page.classList.add('pressed');
  try {
    if (!backend) {   // 미리보기(저장소 없음): 접히는 장면만, 저장·전송 없음
      await wait(160); page.classList.remove('pressed');
      await foldIntoVault(text);
      freshPage('미리보기라 이 페이지는 저장되지 않았습니다', 'PREVIEW');
      return;
    }
    const res = await backend.submit({ vk: visitorKey(), body: text, identity, name, showName: $('showName').checked, visibility, website: $('website').value, elapsed: Date.now() - openedAt });
    await wait(160); page.classList.remove('pressed');
    await foldIntoVault(text);
    if (res.page) { pages = [res.page, ...pages.filter((p) => p.id !== res.page.id)]; freshId = res.page.id; renderTiles(); }
    freshPage(visibility === 'public' ? '보관함에 담겼습니다 · 다른 방문자도 펼쳐 읽을 수 있습니다' : '보관함에 담겼습니다 · 관리자만 읽을 수 있습니다', 'ARCHIVED');
    trace();
  } catch (ex) {
    page.classList.remove('pressed'); page.style.opacity = ''; page.style.transition = '';
    $('err').textContent = ERR[ex.code] || '지금은 페이지를 담지 못했습니다. 잠시 후 다시 시도해 주세요.';
  } finally {
    busy = false; $('submit').disabled = false; form.classList.remove('ink');
  }
});

/* ---------- 시작 ---------- */
if (new URLSearchParams(location.search).get('from') === 'room') {   // 3D에서 왔다면 방 안으로 돌려보낸다
  for (const a of [$('toRoom'), $('pRoom')]) a.href = '../experience/index.html?return=room';
}
sync();
setMode(location.hash === '#read' ? 'read' : 'write');
renderTiles();
const symReady = loadSymbol();
getBackend().then(async (b) => {
  backend = b;
  if (!b) { room.classList.add('preview'); $('previewNote').hidden = false; }
  else {
    try { pages = (await b.publicPages()).pages || []; } catch (e) { pages = []; }
    renderTiles(); if (room.dataset.mode === 'read') renderRead();
  }
  await symReady;
  if (b) await trace(); else drawTraces();
});

// 브라우저 확인용(흔적 단계 미리 보기). 공개 데이터만 다룬다
window.__gb = { preview(visits, leaves = visits) { level = { visits, leaves }; drawTraces(); }, level: () => level };
