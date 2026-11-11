// HIRANG GUESTBOOK — THE SECRET ARCHIVE
// 한 사람이 한 장을 남기고, 모든 장이 관리자만 읽는 한 권의 비밀의 책이 된다.
//  - 공개 읽기에는 작성자가 '보여 주기'를 고른 페이지만 서버에서 온다(숨긴 글은 브라우저로 오지 않는다).
//  - 흔적(벽의 종이 조각·보관함 더미)은 서버가 주는 로그 단계(0~12)로만 그린다 — 조각·장수를 세어 방문 수를 알 수 없다.
//  - 사용자 글은 모두 textContent로만 넣는다.
import { getBackend } from './lib/backend.js';
import { visitorKey } from './lib/visitor-key.js';

const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));
// 애니메이션이 멈춘 환경(백그라운드 탭 등)에서도 흐름이 끝나도록: 정해진 시간이 지나면 마지막 장면으로 넘긴다
const play = (anim, ms) => Promise.race([anim.finished, new Promise((r) => setTimeout(r, ms + 400))]).then(() => { try { anim.finish(); } catch (e) { /* 이미 끝남 */ } });
const ERR = {
  too_fast: '조금 더 천천히 적어 주세요.',
  too_short: '두 글자 이상 적어 주세요.',
  too_long: '300자까지 남길 수 있습니다.',
  links: '링크나 주소는 남길 수 없습니다.',
  rate: '페이지를 여러 번 남기셨습니다. 잠시 후 다시 남겨 주세요.',
  duplicate: '같은 글이 이미 보관함에 있습니다.',
  name_too_long: '이름은 20자까지 적을 수 있습니다.',
};
const rnd = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const room = $('room'), sheet = $('sheet'), form = $('form'), body = $('body'), nameIn = $('name');
let backend = null, pages = [], idx = 0, openedAt = Date.now(), busy = false, level = { visits: 0, leaves: 0 };

/* ---------- 흔적: 하이랑 심볼 종이 조각 ---------- */
let symD = null;
async function loadSymbol() {
  try {
    const s = await fetch('assets/symbol-shape.json').then((r) => r.json());
    const P = (pts, step) => pts.filter((_, i) => i % step === 0).map(([u, v], i) => `${i ? 'L' : 'M'}${((u - 0.5) * 2).toFixed(3)} ${((v - s.aspect / 2) * 2).toFixed(3)}`).join('') + 'Z';
    symD = P(s.outer, Math.max(1, Math.floor(s.outer.length / 80))) + s.holes.map((h) => P(h, Math.max(1, Math.floor(h.length / 30)))).join('');
  } catch (e) { symD = 'M-1 -.7h2v1.4h-2z'; }
}
const FILL = ['#EDE4F1', '#E6EADF', '#F4ECD5', '#F1E9E2', '#D8C8E6'];   // 마지막 = 이번에 내가 남긴 조각(라벤더)
// 단계 → 조각 배치 [x, y, 회전(도), 크기(px), 색]. 페이지 둘레의 띠(반지름 340~480)에 놓여 페이지를 가리지 않는다
function layout(L) {
  const r = rnd(17), out = [];
  if (L <= 0) return out;
  const band = (a, rad) => [Math.cos(a) * rad * 1.3, Math.sin(a) * rad * 0.74];   // 페이지 둘레 타원 띠(병풍 위)
  if (L <= 4) {
    const n = [0, 1, 2, 3, 5][L];
    for (let i = 0; i < n; i++) { const a = -2.4 + i * 1.3 + r() * 0.5; const [x, y] = band(a, 380 + r() * 70); out.push([x, y, r() * 60 - 30, 26 + r() * 8, i % 4]); }
    return out;
  }
  if (L <= 8) {
    const centers = [-0.6, 2.5, -2.6, 0.9].slice(0, L - 4);
    centers.forEach((a, k) => {
      const [cx, cy] = band(a, 410);
      for (let j = 0; j < 6; j++) { const t = j / 6 * Math.PI * 2 + k; out.push([cx + Math.cos(t) * 26, cy + Math.sin(t) * 26, t * 57.3 + 90, 22, (j + k) % 4]); }
    });
    return out;
  }
  const n = Math.min(44, 22 + (L - 9) * 7);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const [x, y] = band(a, 400 + (i % 2) * 18); out.push([x, y, a * 57.3 + 90, 20 + (i % 3) * 3, i % 4]); }
  return out;
}
function frag(x, y, rot, size, ci, cls = '') {
  const s = size / 2;
  return `<g class="frag ${cls}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${s.toFixed(2)})">`
    + `<path d="${symD}" fill-rule="evenodd" fill="rgba(60,52,36,.07)" transform="translate(.08 .1)"/>`
    + `<path d="${symD}" fill-rule="evenodd" fill="${FILL[ci] || FILL[0]}" stroke="rgba(79,95,76,.16)" stroke-width="${(0.6 / s).toFixed(3)}"/></g>`;
}
function drawTraces() {
  if (!symD) return;
  const L = Math.max(level.visits, level.leaves);
  // 숫자·좌표만 — 사용자 글은 여기에 들어가지 않는다. 이번에 내가 남긴 조각(이 화면에만)은 다시 그려도 남는다
  $('traces').innerHTML = layout(L).map((f) => frag(...f)).join('') + myFrags.map((f) => frag(...f)).join('');
}
const myFrags = [];
function addMyTrace() {
  if (!symD) return;
  const a = -0.95 + myFrags.length * 0.32;
  const f = [Math.cos(a) * 520, Math.sin(a) * 300, a * 57.3 + 90, 30, 4];
  myFrags.push(f);
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.innerHTML = frag(...f, 'new');
  $('traces').append(g.firstChild);
}

/* ---------- 보관함 더미: 장수는 단계로 묶는다(실제 장수가 아니다) ---------- */
function sheetTransform(i, extra = '') {
  const r = rnd(i * 7 + 3)();
  return `translateY(${-i * 4.2}px) rotateX(64deg) rotateZ(${(r - 0.5) * 9}deg) ${extra}`;
}
let mySheets = 0;   // 이번에 내가 더한 장(이 화면에만)
function drawStack() {
  const n = Math.min(30, 3 + level.leaves * 2 + mySheets);
  const st = $('stack'); st.textContent = '';
  for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.className = 's'; d.style.transform = sheetTransform(i); st.append(d); }
}
function landOnStack() {
  mySheets++;
  const st = $('stack'), i = st.children.length;
  const d = document.createElement('div'); d.className = 's land';
  d.style.transform = sheetTransform(i);
  d.style.setProperty('--from', `translateY(${-i * 4.2 - 60}px) rotateX(64deg) rotateZ(-14deg)`);
  st.append(d);
}

/* ---------- 읽기 ---------- */
function render() {
  const has = pages.length > 0;
  $('leaf').hidden = !has; $('empty').hidden = has;
  $('prev').disabled = $('next').disabled = pages.length < 2;
  if (!has) return;
  const p = pages[((idx % pages.length) + pages.length) % pages.length];
  $('leafBody').textContent = p.body;
  $('leafName').textContent = p.name ? `— ${p.name}` : '';
}
async function turn(d) {
  if (pages.length < 2) return;
  const leaf = $('leaf'), k = d > 0 ? 'n' : 'p';
  leaf.className = `leaf out-${k}`; await wait(280);
  idx += d; render();
  leaf.className = `leaf in-${k}`; await wait(450); leaf.className = 'leaf';
}
$('prev').addEventListener('click', () => turn(-1));
$('next').addEventListener('click', () => turn(1));
$('read').addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') turn(-1); if (e.key === 'ArrowRight') turn(1); });

function setMode(m) {
  room.dataset.mode = m;
  form.hidden = m !== 'write'; $('read').hidden = m !== 'read';
  $('mWrite').setAttribute('aria-selected', String(m === 'write'));
  $('mRead').setAttribute('aria-selected', String(m === 'read'));
  $('eyebrow').textContent = m === 'read' ? 'FROM THE ARCHIVE' : 'ONE PAGE';
}
$('mWrite').addEventListener('click', () => setMode('write'));
$('mRead').addEventListener('click', () => setMode('read'));

/* ---------- 쓰기 ---------- */
const val = (n) => form.querySelector(`input[name="${n}"]:checked`).value;
function sync() {
  const id = val('identity'), pub = val('visibility') === 'public';
  nameIn.hidden = id === 'anonymous';
  nameIn.placeholder = id === 'realname' ? '실명' : '닉네임';
  $('showNameRow').hidden = !(pub && id !== 'anonymous');
  if ($('showNameRow').hidden) $('showName').checked = false;
  $('visHint').textContent = pub ? '다른 방문자가 보관함에서 펼쳐 읽을 수 있습니다.' : '관리자만 읽을 수 있습니다.';
  $('count').textContent = String(body.value.length);
}
form.addEventListener('change', sync);
body.addEventListener('input', sync);

// 접혀서 보관함으로: 페이지가 살짝 눌리고 → 아래 반이 위로 접히고 → 작아지며 보관함 더미 위로 내려앉는다
async function foldIntoArchive(text) {
  if (reduced) { landOnStack(); addMyTrace(); return; }
  const r = sheet.getBoundingClientRect();
  const fold = $('fold');
  Object.assign(fold.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, transform: '', opacity: '1' });
  // 접히는 종이에 쓴 글을 같은 자리에 옮겨 적는다(글이 접힘과 함께 움직이게)
  const b = body.getBoundingClientRect();
  for (const f of [$('faceTop'), $('faceBottom')]) { f.textContent = text; f.style.padding = `${b.top - r.top + 3}px ${r.right - b.right}px 0 ${b.left - r.left}px`; }
  $('faceTop').style.top = '0'; $('faceTop').style.height = `${r.height}px`;
  $('faceBottom').style.top = `${-r.height / 2}px`; $('faceBottom').style.height = `${r.height}px`; $('faceBottom').style.position = 'absolute';
  fold.hidden = false;
  sheet.style.transition = 'none'; sheet.style.opacity = '0';
  const bottom = fold.querySelector('.bottom');
  await play(bottom.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(178deg)' }], { duration: 640, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'forwards' }), 640);
  const t = $('stack').getBoundingClientRect();
  const dx = t.left + t.width / 2 - (r.left + r.width / 2), dy = t.bottom - 30 - (r.top + r.height / 4);
  await play(fold.animate([
    { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
    { transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 40}px) scale(.55) rotate(-4deg)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(.22) rotate(-10deg)`, opacity: 0 },
  ], { duration: 820, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' }), 820);
  landOnStack(); addMyTrace();
  fold.hidden = true; fold.getAnimations().forEach((a) => a.cancel()); bottom.getAnimations().forEach((a) => a.cancel());
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
  form.classList.add('ink'); sheet.classList.add('pressed');
  // 미리보기(저장소 없음): 접히는 장면만 보여 주고 아무것도 저장·전송하지 않는다
  if (!backend) {
    await wait(160); sheet.classList.remove('pressed');
    await foldIntoArchive(text);
    form.reset(); sync(); openedAt = Date.now();
    sheet.style.opacity = ''; sheet.style.transition = '';
    sheet.classList.remove('arrive'); void sheet.offsetWidth; sheet.classList.add('arrive');
    const msg = '미리보기라 이 페이지는 저장되지 않았습니다';
    $('eyebrow').textContent = 'PREVIEW'; $('visHint').textContent = msg; $('live').textContent = msg;
    setTimeout(() => { if (room.dataset.mode === 'write') { $('eyebrow').textContent = 'ONE PAGE'; sync(); } }, 5000);
    busy = false; $('submit').disabled = false; form.classList.remove('ink');
    return;
  }
  try {
    const res = await backend.submit({ vk: visitorKey(), body: text, identity, name, showName: $('showName').checked, visibility, website: $('website').value, elapsed: Date.now() - openedAt });
    await wait(160);
    sheet.classList.remove('pressed');
    await foldIntoArchive(text);
    if (res.page) { pages = [res.page, ...pages.filter((p) => p.id !== res.page.id)]; idx = 0; render(); }
    // 다시 준비된 빈 페이지
    form.reset(); sync(); openedAt = Date.now();
    sheet.style.opacity = ''; sheet.style.transition = '';
    sheet.classList.remove('arrive'); void sheet.offsetWidth; sheet.classList.add('arrive');
    const msg = visibility === 'public' ? '보관함에 담겼습니다 · 다른 방문자도 펼쳐 읽을 수 있습니다' : '보관함에 담겼습니다 · 관리자만 읽을 수 있습니다';
    $('eyebrow').textContent = 'ARCHIVED'; $('visHint').textContent = msg; $('live').textContent = msg;
    setTimeout(() => { if (room.dataset.mode === 'write') { $('eyebrow').textContent = 'ONE PAGE'; sync(); } }, 5000);
    trace();
  } catch (ex) {
    sheet.classList.remove('pressed');
    $('err').textContent = ERR[ex.code] || '지금은 페이지를 담지 못했습니다. 잠시 후 다시 시도해 주세요.';
  } finally {
    busy = false; $('submit').disabled = false; form.classList.remove('ink');
  }
});

async function trace() {
  try { const t = await backend.trace(); if (t) { level = t; drawStack(); drawTraces(); } } catch (e) { /* 흔적 없이 */ }
}

/* ---------- 시작 ---------- */
// 3D 독서구역에서 왔다면 '비밀독서구역 3D'가 방 안으로 돌려보낸다
if (new URLSearchParams(location.search).get('from') === 'room') {
  const a = $('toRoom'); a.href = '../experience/index.html?return=room'; a.classList.add('back-room'); a.textContent = '← 비밀독서구역으로';
}
sync();
drawStack();
const symReady = loadSymbol();
getBackend().then(async (b) => {
  backend = b;
  // 저장소가 없으면(GitHub Pages에 Supabase를 아직 연결하지 않은 상태) 미리보기: 쓰기·애니메이션은 되지만 저장되지 않는다고 분명히 알린다
  if (!b) { room.classList.add('preview'); $('previewNote').hidden = false; setMode('write'); render(); return; }
  setMode('write');
  try { pages = (await b.publicPages()).pages || []; } catch (e) { pages = []; }
  render();
  await symReady;
  await trace();
});

// 브라우저 확인용(흔적 단계 미리 보기). 공개 데이터만 다룬다
window.__gb = { preview(visits, leaves = visits) { level = { visits, leaves }; drawStack(); drawTraces(); }, level: () => level };
