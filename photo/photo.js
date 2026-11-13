// HIRANG PHOTO PAGE — 웹캠 촬영 · 레이아웃 합성 · QR(임시 보관 후 개별 다운로드) · AirDrop(운영체제 공유)
// 방문객 사진은 AI로 바꾸지 않는다. 원본은 카메라 화면 그대로(미리보기와 같은 좌우 반전), 프레임·글자·로고 없이 저장한다.
import { LIVE } from '../guestbook/lib/live-config.js';

const $ = (id) => document.getElementById(id);
const COLOR = { green: '#4F5F4C', lavender: '#C1B1D1', ivory: '#FFF9EA', ink: '#2E3A2C' };
const COUNTDOWN = 5;                      // 초(전시 요청: 5초)
const IDLE_RESET_MS = 120000;             // 미리보기·저장 화면에서 2분 동안 아무도 만지지 않으면 처음으로(다음 방문객에게 사진이 남지 않게)
const FN = `${LIVE.supabase.url}/functions/v1/hirang-photo`;
const params = new URLSearchParams(location.search);
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const MOCK = LOCAL && params.has('mock');          // 로컬 확인용: 서버 대신 이 브라우저 안(IndexedDB)에 보관
const TESTCAM = LOCAL && params.has('testcam');    // 로컬 확인용: 실제 카메라 대신 그려진 화면

const LAYOUTS = {
  editorial: {
    shots: 1, page: 'HIRANG_PAGE.png',
    frames: [['ivory', 'IVORY', COLOR.ivory], ['lavender', 'LAVENDER', COLOR.lavender]],
  },
  bookmark: {
    shots: 2, page: 'HIRANG_BOOKMARK.png',
    frames: [['green', 'GREEN', COLOR.green], ['lavender', 'LAVENDER', COLOR.lavender], ['ivory', 'IVORY', COLOR.ivory]],
  },
};

// ---------- 상태(방문객 한 사람 분) ----------
let S = fresh();
function fresh() { return { layout: null, frame: null, shots: [], shotIdx: 0, date: '', page: null, pageUrl: '', token: '', files: null, busy: false }; }

// ---------- 날짜: 한국(Asia/Seoul) 기준 실제 촬영일 ----------
const MON = ['JAN.', 'FEB.', 'MAR.', 'APR.', 'MAY', 'JUNE', 'JULY', 'AUG.', 'SEP.', 'OCT.', 'NOV.', 'DEC.'];
function seoulDate(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return `${MON[+p.month - 1]} ${+p.day}, ${p.year}`;
}

// ---------- 화면 단계 ----------
function go(step) {
  $('app').dataset.step = step;
  for (const s of ['enter', 'layout', 'capture', 'preview', 'save']) $(`s-${s}`).hidden = s !== step;
  document.querySelectorAll('.pp-steps li').forEach((li) => li.classList.toggle('on', li.dataset.s === step));
  if (step !== 'capture') stopCamera();
  armIdle(step === 'preview' || step === 'save');
}
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3600); }

// ---------- 카메라 ----------
let stream = null;
async function startCamera() {
  $('camErr').hidden = true; $('video').hidden = false; $('guide').hidden = false;
  if (stream) return true;
  try {
    if (TESTCAM) stream = testStream();
    else {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('insecure'), { name: 'InsecureContext' });
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 3840 }, height: { ideal: 2160 }, facingMode: 'user' }, audio: false }); }
      catch (e) {   // 고해상도 요청을 못 받아 주는 카메라는 기본 설정으로 한 번 더
        if (e.name === 'OverconstrainedError' || e.name === 'NotReadableError' || e.name === 'AbortError') stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        else throw e;
      }
    }
    const v = $('video'); v.srcObject = stream;
    await v.play().catch(() => {});
    if (!v.videoWidth) await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
    return true;
  } catch (e) {
    stream = null;
    console.warn('[photo] camera', e?.name, e?.message);
    $('camErrMsg').textContent = camMessage(e?.name);
    $('camErr').hidden = false; $('video').hidden = true; $('guide').hidden = true;
    $('btnShoot').disabled = true;
    return false;
  }
}
// 카메라가 안 켜진 이유를 정확히 알려 준다
function camMessage(name) {
  if (name === 'InsecureContext') return 'The camera can only be used on a secure page. Please open PHOTO PAGE from the website address (https), not from a saved file.';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access was blocked. Allow camera access for this site in your browser settings, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found. Connect a camera and try again.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'The camera is being used by another app. Close other apps that use the camera, then try again.';
  return 'Camera access is needed to take your photo. Allow camera access in your browser and try again.';
}
function stopCamera() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  const v = $('video'); v.srcObject = null;
}
function testStream() {   // 로컬 확인용 가짜 카메라(실제 전시에서는 쓰이지 않음)
  const c = document.createElement('canvas'); c.width = 1920; c.height = 1080;
  const g = c.getContext('2d'); let f = 0;
  const draw = () => {
    f++;
    const gr = g.createLinearGradient(0, 0, 0, 1080); gr.addColorStop(0, '#E8DCC4'); gr.addColorStop(1, '#BBA88A'); g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080);
    g.fillStyle = '#6E7466'; g.beginPath(); g.ellipse(960, 430, 150, 185, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.roundRect(700, 620, 520, 520, 200); g.fill();
    g.fillStyle = '#2E3A2C'; g.font = '600 48px sans-serif'; g.fillText('TEST CAMERA ' + (f % 100), 60, 90);
    requestAnimationFrame(draw);
  };
  draw();
  return c.captureStream(30);
}

// 지금 카메라 화면을 원본 그대로(미리보기와 같은 좌우 반전) 고해상도 캔버스로
function grabFrame() {
  const v = $('video'), w = v.videoWidth, h = v.videoHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.translate(w, 0); g.scale(-1, 1); g.drawImage(v, 0, 0, w, h);
  return c;
}

// ---------- 촬영 흐름 ----------
async function enterCapture() {
  S.shotIdx = S.shots.length < LAYOUTS[S.layout].shots ? S.shots.length : 0;
  go('capture');
  showShotLabel();
  $('still').hidden = true; $('reviewActions').hidden = true; $('capActions').hidden = false;
  $('btnShoot').disabled = false;
  await startCamera();
}
function showShotLabel() {
  const n = LAYOUTS[S.layout].shots;
  $('shotLabel').textContent = n > 1 ? `PHOTO 0${S.shotIdx + 1} / 0${n}` : 'PHOTO 01';
}
async function shoot() {
  if (S.busy || !stream) return;
  S.busy = true; $('btnShoot').disabled = true; $('btnLayoutBack').disabled = true;
  for (let i = COUNTDOWN; i > 0; i--) { $('count').textContent = i; await wait(1000); }
  $('count').textContent = '';
  const frame = grabFrame();
  const fl = $('flash'); fl.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => fl.classList.remove('on')));
  S.shots[S.shotIdx] = frame;
  const still = $('still'); still.src = frame.toDataURL('image/jpeg', 0.9); still.hidden = false;
  $('video').hidden = true; $('guide').hidden = true;
  $('capActions').hidden = true; $('reviewActions').hidden = false;
  const last = S.shotIdx >= LAYOUTS[S.layout].shots - 1;
  $('btnNext').textContent = last ? 'CONTINUE' : 'NEXT PHOTO';
  S.busy = false; $('btnLayoutBack').disabled = false;
  $('btnNext').focus();
}
function retake() {
  $('still').hidden = true; $('video').hidden = false; $('guide').hidden = false;
  $('reviewActions').hidden = true; $('capActions').hidden = false; $('btnShoot').disabled = false;
}
async function next() {
  if (S.shotIdx < LAYOUTS[S.layout].shots - 1) { S.shotIdx++; showShotLabel(); retake(); return; }
  S.date = seoulDate();
  S.frame = LAYOUTS[S.layout].frames[0][0];
  $('btnNext').disabled = true; $('btnRetake').disabled = true;
  try { await renderPage(); } finally { $('btnNext').disabled = false; $('btnRetake').disabled = false; }
  buildSwatches();
  go('preview');
}

// ---------- 합성(고해상도 PNG) ----------
const logo = new Image(); logo.src = 'assets/hirang-logo.png';
const ready = Promise.all([
  logo.decode().catch(() => {}),
  document.fonts?.load('500 40px Pretendard'), document.fonts?.load('600 40px Pretendard'),
].filter(Boolean));

function cover(g, src, x, y, w, h) {   // 가운데를 기준으로 사진을 자리 비율에 맞게 자른다(늘리지 않음)
  const sw = src.width, sh = src.height, r = Math.max(w / sw, h / sh);
  const cw = w / r, ch = h / r;
  g.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, w, h);
}
function spaced(g, text, x, y, size, weight, color, track, align = 'left') {   // 자간을 준 영문
  g.font = `${weight} ${size}px Pretendard, sans-serif`; g.fillStyle = color; g.textBaseline = 'alphabetic';
  const ls = size * track, w = [...text].reduce((a, ch) => a + g.measureText(ch).width + ls, -ls);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  for (const ch of text) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + ls; }
}
function drawLogo(g, x, y, h, align = 'left') {   // 원본 로고 그대로(비율·색 유지)
  const w = h * logo.naturalWidth / logo.naturalHeight;
  g.drawImage(logo, align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, y, w, h);
}

function composeEditorial(frame) {
  const W = 2400, H = 3200, M = 200;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = frame === 'lavender' ? COLOR.lavender : COLOR.ivory; g.fillRect(0, 0, W, H);
  const ink = COLOR.green;
  spaced(g, 'A PAGE OF YOU', W / 2, 200, 40, 500, ink, 0.6, 'center');
  cover(g, S.shots[0], M, 300, W - 2 * M, 2500);             // 4:5
  drawLogo(g, M, 2915, 104);
  spaced(g, S.date, W - M, 3000, 40, 500, ink, 0.32, 'right');
  g.fillStyle = frame === 'lavender' ? 'rgba(79,95,76,.45)' : COLOR.lavender; g.fillRect(M, 3078, W - 2 * M - 120, 3);
  spaced(g, '01', W - M, 3094, 32, 500, ink, 0.2, 'right');
  return c;
}

function composeBookmark(frame) {
  const W = 1200, H = 3400, PX = 80, PW = W - 2 * PX, PH = 1300;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = frame === 'lavender' ? COLOR.lavender : frame === 'ivory' ? COLOR.ivory : COLOR.green;
  const line = frame === 'green' ? 'rgba(255,249,234,.75)' : 'rgba(79,95,76,.55)';
  const text = frame === 'green' ? COLOR.ivory : COLOR.green;
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = line; g.lineWidth = 3; g.strokeRect(36, 36, W - 72, H - 72);
  const y1 = 190, y2 = y1 + PH + 170;
  cover(g, S.shots[0], PX, y1, PW, PH);
  cover(g, S.shots[1], PX, y2, PW, PH);
  spaced(g, 'TWO MOMENTS, ONE PAGE', W / 2, y1 + PH + 100, 30, 500, text, 0.42, 'center');
  // 아래 아이보리 라벨: 원본(초록) 로고를 색을 바꾸지 않고 그대로 올리기 위한 자리
  const ly = y2 + PH + 60, lh = H - 80 - ly;
  g.fillStyle = COLOR.ivory; g.fillRect(PX, ly, PW, lh);
  if (frame === 'ivory') { g.strokeStyle = 'rgba(79,95,76,.35)'; g.lineWidth = 2; g.strokeRect(PX, ly, PW, lh); }
  drawLogo(g, W / 2, ly + 62, 92, 'center');
  g.fillStyle = COLOR.lavender; g.fillRect(W / 2 - 170, ly + 196, 340, 3);
  spaced(g, S.date, W / 2, ly + 262, 30, 500, COLOR.green, 0.36, 'center');
  // 책갈피 구멍(투명)
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(W / 2, 108, 24, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = line; g.lineWidth = 3; g.beginPath(); g.arc(W / 2, 108, 30, 0, Math.PI * 2); g.stroke();
  return c;
}

async function renderPage() {
  await ready;
  const c = S.layout === 'bookmark' ? composeBookmark(S.frame) : composeEditorial(S.frame);
  S.page = c;
  if (S.pageUrl) URL.revokeObjectURL(S.pageUrl);
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));   // 화면 미리보기는 빠르게(JPEG) — 저장 파일은 PNG로 따로 만든다
  S.pageUrl = URL.createObjectURL(blob);
  S.files = null; S.token = '';
  $('resultImg').src = S.pageUrl; $('resultImg2').src = S.pageUrl;
  $('dateLabel').textContent = S.date;
}
const toPng = (c) => new Promise((res) => c.toBlob(res, 'image/png'));

function buildSwatches() {
  const box = $('swatches'); box.textContent = '';
  for (const [key, label, hex] of LAYOUTS[S.layout].frames) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pp-swatch'; b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(key === S.frame));
    const i = document.createElement('i'); i.style.background = hex;
    b.append(i, label);
    b.addEventListener('click', async () => {
      if (S.frame === key) return;
      S.frame = key; box.querySelectorAll('.pp-swatch').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      await renderPage();
    });
    box.append(b);
  }
}

// ---------- 저장용 파일(완성본 + 원본) ----------
async function buildFiles() {
  if (S.files) return S.files;
  const L = LAYOUTS[S.layout];
  const files = [new File([await toPng(S.page)], L.page, { type: 'image/png' })];
  for (let i = 0; i < L.shots; i++) files.push(new File([await toPng(S.shots[i])], `HIRANG_PHOTO_0${i + 1}.png`, { type: 'image/png' }));
  S.files = files;
  return files;
}

// ---------- QR: 비공개 저장소에 임시 보관 → 다운로드 페이지 주소 ----------
async function prepareQr() {
  $('qrStatus').textContent = 'PREPARING…'; $('qrStatus').hidden = false;
  $('qrNote').hidden = true; $('btnQrRetry').hidden = true;
  $('qrBox').querySelectorAll('svg,img').forEach((n) => n.remove());
  const me = S;   // 준비 중에 FINISH(처음으로)를 누르면, 끝난 결과를 다음 방문객 화면에 붙이지 않는다
  try {
    const files = await buildFiles();
    if (S !== me) return;
    if (!S.token) { const t = MOCK ? await mockPut(files) : await upload(files); if (S !== me) return; S.token = t; }
    const url = new URL(`download/?t=${encodeURIComponent(S.token)}${MOCK ? '&mock' : ''}`, location.href).href;
    const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
    $('qrBox').insertAdjacentHTML('beforeend', qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true }));
    $('qrBox').dataset.url = url;
    $('qrStatus').hidden = true; $('qrNote').hidden = false;
  } catch (e) {
    if (S !== me) return;
    $('qrStatus').textContent = 'QR CODE IS NOT AVAILABLE RIGHT NOW.';
    $('btnQrRetry').hidden = false;
    console.warn('[photo] upload failed', e);
  }
}
async function upload(files) {
  const fd = new FormData();
  fd.append('layout', S.layout); fd.append('date', S.date);
  for (const f of files) fd.append(f.name, f, f.name);
  const r = await fetch(FN, { method: 'POST', body: fd, headers: { apikey: LIVE.supabase.anonKey }, credentials: 'omit' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.token) throw new Error(d.error || `upload ${r.status}`);
  return d.token;
}

// 로컬 확인용 보관함(IndexedDB) — 실제 전시에서는 쓰지 않는다
function idb() { return new Promise((res, rej) => { const q = indexedDB.open('hirang-photo-mock', 1); q.onupgradeneeded = () => q.result.createObjectStore('p'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function mockPut(files) {
  const token = 'mock-' + crypto.randomUUID();
  const db = await idb();
  await new Promise((res, rej) => { const t = db.transaction('p', 'readwrite'); t.objectStore('p').put({ layout: S.layout, date: S.date, files: files.map((f) => ({ name: f.name, blob: f })) }, token); t.oncomplete = res; t.onerror = () => rej(t.error); });
  return token;
}

// ---------- AirDrop: 운영체제 공유(지원하는 곳만) ----------
function shareSupported(files) { try { return !!(navigator.canShare && navigator.canShare({ files })); } catch (e) { return false; } }
async function setupAir() {
  const files = await buildFiles();
  const ok = shareSupported(files);
  $('btnShare').hidden = !ok;
  $('airNote').textContent = ok
    ? 'Choose AirDrop in the share sheet and select your device.'
    : 'AirDrop sharing is available in Safari on Mac, iPhone and iPad. Please use the QR code, or download the files here.';
}
async function share() {
  const files = await buildFiles();
  try { await navigator.share({ files, title: 'HIRANG PHOTO PAGE' }); }
  catch (e) { if (e?.name !== 'AbortError') toast('Sharing is not available here. Please use the QR code.'); }
}
async function downloadAll() {
  const files = await buildFiles();
  for (const f of files) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    await wait(400);
  }
}

function setTab(which) {
  const qr = which === 'qr';
  $('tabQr').setAttribute('aria-selected', String(qr)); $('tabAir').setAttribute('aria-selected', String(!qr));
  $('panelQr').hidden = !qr; $('panelAir').hidden = qr;
  if (qr) { if (!$('qrBox').querySelector('svg')) prepareQr(); } else setupAir();
}

// ---------- 처음으로(다음 방문객을 위해 모두 지운다) ----------
function resetAll() {
  stopCamera();
  if (S.pageUrl) URL.revokeObjectURL(S.pageUrl);
  for (const c of S.shots) if (c) { c.width = c.height = 0; }
  if (S.page) { S.page.width = S.page.height = 0; }
  S = fresh();
  for (const id of ['resultImg', 'resultImg2', 'still']) { const im = $(id); im.removeAttribute('src'); }
  $('qrBox').querySelectorAll('svg,img').forEach((n) => n.remove()); delete $('qrBox').dataset.url;
  $('swatches').textContent = '';
  go('enter');
}
let idleT = 0;
function armIdle(on) {
  clearTimeout(idleT);
  if (on) idleT = setTimeout(resetAll, IDLE_RESET_MS);
}
['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, () => { const st = $('app').dataset.step; if (st === 'preview' || st === 'save') armIdle(true); }, { passive: true }));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 연결 ----------
$('btnStart').addEventListener('click', () => go('layout'));
document.querySelectorAll('.pp-card').forEach((b) => b.addEventListener('click', () => { S.layout = b.dataset.layout; S.shots = []; enterCapture(); }));
$('btnLayoutBack').addEventListener('click', () => { S.shots = []; go('layout'); });
$('btnShoot').addEventListener('click', shoot);
$('btnRetake').addEventListener('click', retake);
$('btnNext').addEventListener('click', next);
$('btnCamRetry').addEventListener('click', async () => { $('btnShoot').disabled = false; await startCamera(); });
$('btnRetakeAll').addEventListener('click', () => { S.shots = []; S.files = null; S.token = ''; enterCapture(); });
$('btnToSave').addEventListener('click', () => { $('resultImg2').src = S.pageUrl; go('save'); setTab('qr'); });
$('tabQr').addEventListener('click', () => setTab('qr'));
$('tabAir').addEventListener('click', () => setTab('air'));
$('btnQrRetry').addEventListener('click', prepareQr);
$('btnShare').addEventListener('click', share);
$('btnDownload').addEventListener('click', downloadAll);
$('btnFinish').addEventListener('click', resetAll);
addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && $('app').dataset.step === 'capture' && !$('capActions').hidden && document.activeElement === document.body) { e.preventDefault(); shoot(); } });
addEventListener('pagehide', stopCamera);

window.__photo = { get state() { return S; }, seoulDate, resetAll };
go('enter');
