// QR로 여는 다운로드 페이지: 사진마다 따로 미리보고 따로 받는다(ZIP 없음).
// 링크의 토큰으로 서버(Edge Function)에서 짧게 유효한 서명 주소를 받아 온다. 24시간이 지나면 사진은 지워진다.
import { LIVE } from '../../guestbook/lib/live-config.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const token = params.get('t') || '';
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const MOCK = LOCAL && params.has('mock');
const FN = `${LIVE.supabase.url}/functions/v1/hirang-photo`;

const LABEL = {
  'HIRANG_BOOKMARK.png': ['BOOKMARK', 'DOWNLOAD BOOKMARK'],
  'HIRANG_PAGE.png': ['PAGE', 'DOWNLOAD PAGE'],
  'HIRANG_PHOTO_01.png': ['PHOTO 01', 'DOWNLOAD PHOTO 01'],
  'HIRANG_PHOTO_02.png': ['PHOTO 02', 'DOWNLOAD PHOTO 02'],
};
const ORDER = ['HIRANG_BOOKMARK.png', 'HIRANG_PAGE.png', 'HIRANG_PHOTO_01.png', 'HIRANG_PHOTO_02.png'];

function fail(title, text) {
  $('list').innerHTML = '';
  const p = document.createElement('p'); p.className = 'dl-msg';
  const b = document.createElement('b'); b.textContent = title; p.append(b, text);
  $('list').append(p);
}

async function load() {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return fail('LINK NOT FOUND', 'Please scan the QR code again.');
  let data;
  try {
    data = MOCK ? await mockGet(token) : await fetch(`${FN}?t=${encodeURIComponent(token)}`, { headers: { apikey: LIVE.supabase.anonKey }, credentials: 'omit', cache: 'no-store' })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(d.error || r.status), { status: r.status }); return d; });
  } catch (e) {
    if (e.status === 410 || e.status === 404) return fail('THIS LINK HAS EXPIRED', 'Photos are kept for 24 hours and then deleted.');
    return fail('SOMETHING WENT WRONG', 'Please try again in a moment.');
  }
  $('date').textContent = data.date || '';
  $('list').innerHTML = '';
  const files = [...data.files].sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
  for (const f of files) {
    const [label, action] = LABEL[f.name] || [f.name, 'DOWNLOAD'];
    const sec = document.createElement('section'); sec.className = 'dl-item' + (f.name === 'HIRANG_BOOKMARK.png' ? ' bm' : '');
    const h = document.createElement('p'); h.className = 'dl-label'; h.textContent = label;
    const img = document.createElement('img'); img.className = 'dl-img'; img.src = f.preview; img.alt = label; img.loading = 'lazy'; img.decoding = 'async';
    const a = document.createElement('a'); a.className = 'dl-btn'; a.href = f.download; a.download = f.name; a.textContent = action; a.rel = 'noopener';
    sec.append(h, img, a);
    $('list').append(sec);
  }
  if (data.expiresAt) {
    const until = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(data.expiresAt));
    $('note').textContent = `Available until ${until} (KST). On iPhone, you can also press and hold a photo to save it to Photos.`;
    $('note').hidden = false;
  }
}

// 로컬 확인용(IndexedDB) — 실제 전시에서는 쓰지 않는다
async function mockGet(t) {
  const db = await new Promise((res, rej) => { const q = indexedDB.open('hirang-photo-mock', 1); q.onupgradeneeded = () => q.result.createObjectStore('p'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  const rec = await new Promise((res, rej) => { const q = db.transaction('p').objectStore('p').get(t); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  if (!rec) throw Object.assign(new Error('gone'), { status: 404 });
  return { date: rec.date, expiresAt: Date.now() + 864e5, files: rec.files.map((f) => { const u = URL.createObjectURL(f.blob); return { name: f.name, preview: u, download: u }; }) };
}

load();
