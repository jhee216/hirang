// 캔버스 텍스처: 브랜드 로고 틴트, 패키지·북커버 앞면, 읽을 수 있는 페이지, 그라디언트
import * as THREE from 'three';
import { COLORS, FONTS } from './config.js';

const logos = {};
let maxAniso = 4;

export const logoImage = (key) => logos[key];

export function setAnisotropy(renderer) {
  maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
}

export async function loadLogos() {
  const load = (src) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
  const [word, sym, lock] = await Promise.all([
    load('assets/logo-wordmark.png'), load('assets/logo-symbol.png'), load('assets/logo-lock.png'),
  ]);
  Object.assign(logos, { word, sym, lock });
  try {
    await Promise.all([
      document.fonts.load(`400 40px Pretendard`), document.fonts.load(`700 40px Pretendard`),
      document.fonts.load(`600 40px Inter`), document.fonts.load(`500 40px Inter`),
    ]);
  } catch (e) { /* 시스템 서체로 대체 */ }
}

// 로고 이미지를 원하는 브랜드 색으로 칠한다(기존 형태 그대로)
function tinted(img, color) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

function drawLogo(ctx, key, color, cx, cy, w) {
  const img = logos[key];
  if (!img) return;
  const h = (w * img.naturalHeight) / img.naturalWidth;
  ctx.drawImage(tinted(img, color), cx - w / 2, cy - h / 2, w, h);
  return h;
}

function toTex(canvas, { mirror = false } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (mirror) { t.repeat.x = -1; t.offset.x = 1; }
  t.needsUpdate = true;
  return t;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// 종이결: 아주 옅은 노이즈(±3 밝기).
// 예전에는 표지마다 모든 픽셀을 하나씩 계산해(표지 한 장 78만 픽셀) 휴대폰에서 시작이 몇 초씩 늦었다.
// 같은 결의 작은 노이즈 타일을 한 번만 만들어 무늬로 깔아 준다(진폭이 1% 남짓이라 반복은 보이지 않는다)
let grain = null;
function grainTile() {
  if (grain) return grain;
  const S = 256;
  const [c, x] = canvas(S, S);
  const img = x.createImageData(S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 6;          // 예전과 같은 세기
    const v = n > 0 ? 255 : 0;                     // 밝게(흰색) 또는 어둡게(검정)를 그만큼의 투명도로 얹는다
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = Math.abs(n);
  }
  x.putImageData(img, 0, 0);
  grain = c;
  return grain;
}
function paper(ctx, w, h, base) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/* ---------- 문 ---------- */

// 문 옆 명판: 하이랑 라벨 스티커(첫 줄) 모양 — 위아래가 반원으로 오목한 모스 그린 라벨에 아이보리 글자
export function plaqueTexture() {
  // 처음 디자인(심볼 + 두 줄 글자, 바탕 없이 벽에 바로)으로, 글자를 굵고 크게 해 멀리서도 읽히게
  const W = 1600, H = 380;
  const [c, x] = canvas(W, H);
  x.clearRect(0, 0, W, H);
  drawLogo(x, 'sym', COLORS.moss, 165, H / 2, 260);
  x.textAlign = 'left'; x.textBaseline = 'middle';
  x.fillStyle = COLORS.ink;
  let fs = 108;
  do { x.font = `800 ${fs}px ${FONTS.en}`; fs -= 2; } while (x.measureText('SECRET READING ZONE').width > W - 365 && fs > 60);   // 캔버스 안에 다 들어오게
  x.fillText('SECRET READING ZONE', 345, H * 0.4);
  x.fillStyle = COLORS.moss;
  x.font = `700 66px ${FONTS.ko}`;
  x.fillText('비밀독서구역 하이랑', 349, H * 0.72);
  return toTex(c);
}

// 문 아래에서 새어 나온 빛이 퍼지는 둥근 빛(cy: 빛의 중심이 캔버스 위쪽(0)인지 아래쪽(1)인지)
export function baseGlowTexture(cy) {
  const [c, x] = canvas(512, 512);
  const g = x.createRadialGradient(256, cy * 512, 10, 256, cy * 512, 256);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  return toTex(c);
}

// 문틈 빛이 벽으로 번지는 후광(문 가장자리에서 가장 진하고 바깥으로 옅어진다)
export function haloTexture() {
  const [c, x] = canvas(512, 512);
  const g = x.createRadialGradient(256, 307, 40, 256, 307, 256);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  return toTex(c);
}

export function doorEmblemTexture() {
  const [c, x] = canvas(256, 256);
  x.clearRect(0, 0, 256, 256);
  drawLogo(x, 'sym', COLORS.yellow, 128, 128, 200);
  return toTex(c);
}

// 문틈 아래로 새어 나오는 따뜻한 빛(바닥)
export function spillTexture() {
  const [c, x] = canvas(256, 256);
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,240,190,1)');
  g.addColorStop(0.35, 'rgba(255,240,190,0.35)');
  g.addColorStop(1, 'rgba(255,240,190,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  // 가장자리 부드럽게
  const s = x.createLinearGradient(0, 0, 256, 0);
  s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(0.2, 'rgba(0,0,0,0)');
  s.addColorStop(0.8, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out';
  x.fillStyle = s; x.fillRect(0, 0, 256, 256);
  return toTex(c);
}

// 바닥 접지 그림자(가짜 AO)
export function contactShadowTexture() {
  const [c, x] = canvas(256, 256);
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(40,36,28,0.55)');
  g.addColorStop(0.45, 'rgba(40,36,28,0.22)');
  g.addColorStop(1, 'rgba(40,36,28,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  return toTex(c);
}

export function glowTexture(color) {
  const [c, x] = canvas(256, 512);
  const g = x.createRadialGradient(128, 256, 10, 128, 256, 250);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 512);
  return toTex(c);
}

// 책장을 넘길 때 아래 페이지에 지는 그림자
export function pageShadowTexture() {
  const [c, x] = canvas(256, 8);
  const g = x.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(30,26,20,0.75)');
  g.addColorStop(1, 'rgba(30,26,20,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 8);
  return toTex(c);
}

/* ---------- 시크릿 북커버 ---------- */

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// 같은 책은 책장과 큐레이션 테이블에 두 번 놓이므로 표지는 한 번만 그려 함께 쓴다
const coverCache = new Map();
export function bookCover(book) {
  if (!coverCache.has(book.id)) coverCache.set(book.id, drawBookCover(book));
  return coverCache.get(book.id);
}
function drawBookCover(book) {
  const W = 740, H = 1050;
  const [c, x] = canvas(W, H);
  paper(x, W, H, book.color);
  const deep = shade(book.color, -0.5);
  // 책등 쪽 모스 그린 띠(영상 초안의 책처럼 짙은 그린 책등이 표지로 살짝 감긴다)
  x.fillStyle = COLORS.moss; x.fillRect(0, 0, 34, H);
  x.strokeStyle = shade(book.color, -0.12); x.lineWidth = 3;
  x.strokeRect(70, 40, W - 110, H - 80);
  drawLogo(x, 'sym', shade(book.color, -0.12), W / 2 + 17, H * 0.36, W * 0.3);
  x.fillStyle = deep; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `600 26px ${FONTS.en}`;
  x.fillText(`NO. ${book.id}  ·  SECRET COVER`, W / 2 + 17, 110);
  // 큐레이션 이름: 가까이 다가가면 읽을 수 있도록 크게
  x.fillStyle = COLORS.ink;
  x.font = `700 128px ${FONTS.ko}`;
  x.fillText(book.name, W / 2 + 17, H * 0.64);
  x.fillStyle = deep;
  x.font = `600 34px ${FONTS.ko}`;
  x.fillText(book.genre, W / 2 + 17, H * 0.64 + 104);
  x.font = `500 24px ${FONTS.ko}`;
  x.fillText('제목·저자는 봉인되어 있습니다', W / 2 + 17, H - 170);
  drawLogo(x, 'word', deep, W / 2 + 17, H - 100, 140);
  return toTex(c);
}

/* ---------- 전시 이름판 ---------- */

export function plateTexture(label) {
  const [c, x] = canvas(800, 120);
  x.fillStyle = COLORS.moss; x.beginPath(); x.roundRect(0, 0, 800, 120, 18); x.fill();
  x.fillStyle = COLORS.ivory; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `600 50px ${FONTS.ko}`;
  x.fillText(label, 400, 62);
  return toTex(c);
}

/* ---------- '큐레이션' 보드 ---------- */

export function boardTitleTexture() {
  const [c, x] = canvas(900, 160);
  x.fillStyle = COLORS.ink; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `700 72px ${FONTS.ko}`;
  x.fillText('큐레이션', 450, 70);
  x.fillStyle = COLORS.moss; x.fillRect(330, 130, 240, 4);
  return toTex(c);
}

// 큐레이션 색 그대로의 칸 + 가운데 이름. 조명에 색이 바래지 않도록 같은 그림으로 자체 발광시킨다
export function curationTileMaterial(b) {
  const [c, x] = canvas(360, 360);
  x.fillStyle = b.color; x.fillRect(0, 0, 360, 360);
  x.fillStyle = shade(b.color, -0.06); x.fillRect(0, 300, 360, 60);
  x.fillStyle = COLORS.ink; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `600 64px ${FONTS.ko}`;
  x.fillText(b.name, 180, 165);
  x.fillStyle = shade(b.color, -0.45); x.font = `500 24px ${FONTS.ko}`;
  x.fillText(b.genre, 180, 330);
  const t = toTex(c);
  return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#FFFFFF', emissiveIntensity: 0.55, color: '#BDBDBD', roughness: 0.7 });
}

/* ---------- 페이지 ---------- */

const PAGE_W = 1100;
const PAGE_SS = 1.5;   // 한 페이지 본문이 작은 글자로 들어가므로 실제 해상도는 1.5배로 그린다
function pageCanvas(aspect) {
  const H = Math.round(PAGE_W * aspect);
  const [c, x] = canvas(Math.round(PAGE_W * PAGE_SS), Math.round(H * PAGE_SS));
  paper(x, c.width, c.height, '#FFFBF1');
  x.scale(PAGE_SS, PAGE_SS);
  return [c, x, PAGE_W, H];
}

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? `${line} ${word}` : word;
      if (ctx.measureText(t).width <= maxW) { line = t; continue; }
      if (line) out.push(line);
      // 한 단어가 줄보다 길면 글자 단위로 자른다
      line = '';
      for (const ch of word) {
        if (ctx.measureText(line + ch).width > maxW) { out.push(line); line = ch; } else line += ch;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

const BODY = { size: 40, lh: 74, top: 150, side: 110, bottom: 150 };

function footer(x, W, H, n, accent, label) {
  x.fillStyle = COLORS.muted; x.font = `500 24px ${FONTS.en}`;
  x.textBaseline = 'middle';
  x.textAlign = n % 2 ? 'right' : 'left';
  x.fillText(String(n + 1).padStart(2, '0'), n % 2 ? W - BODY.side : BODY.side, H - 80);
  x.textAlign = n % 2 ? 'left' : 'right';
  x.fillStyle = accent;
  x.fillText(label, n % 2 ? BODY.side : W - BODY.side, H - 80);
}

// 페이지 정의 → 텍스처. 앞면/거울(뒷면) 두 벌을 만든다
export function pageTextures(def, n, aspect, accent, label = 'HIRANG SECRET PREVIEW') {
  const [c, x, W, H] = pageCanvas(aspect);
  x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  if (def.type === 'introquote') {
    // 표지 안쪽: 번호·이름·장르 + 이 책의 한 줄
    x.fillStyle = accent; x.font = `600 26px ${FONTS.en}`;
    x.fillText(def.eyebrow, BODY.side, BODY.top);
    x.fillStyle = def.swatch; x.fillRect(BODY.side, BODY.top + 50, 110, 110);
    x.fillStyle = COLORS.ink; x.font = `700 76px ${FONTS.ko}`;
    x.fillText(def.title, BODY.side, BODY.top + 290);
    x.fillStyle = COLORS.soft; x.font = `500 34px ${FONTS.ko}`;
    x.fillText(def.meta.join('  ·  '), BODY.side, BODY.top + 350);
    x.fillStyle = accent; x.font = `600 26px ${FONTS.en}`;
    x.fillText('THE ONE LINE', BODY.side, H * 0.5);
    x.fillStyle = COLORS.moss; x.font = `600 52px ${FONTS.ko}`;
    let qy = H * 0.5 + 90;
    for (const l of wrap(x, def.quote, W - BODY.side * 2)) { x.fillText(l, BODY.side, qy); qy += 84; }
    x.font = `400 30px ${FONTS.ko}`; x.fillStyle = COLORS.muted;
    let ny = H - 260;
    for (const l of wrap(x, def.note, W - BODY.side * 2)) { x.fillText(l, BODY.side, ny); ny += 48; }
  } else if (def.type === 'onepage') {
    // 책 속 한 페이지: 나누지 않고 한 장에 전부 들어가도록 글자 크기를 맞춘다
    const side = 84, top = 128, bottom = 132, maxW = W - side * 2;
    x.fillStyle = accent; x.font = `600 22px ${FONTS.en}`;
    x.fillText('ONE PAGE  ·  책 속 한 페이지', side, top - 40);
    let size = 40, lines = [], lh = 0;
    for (; size >= 18; size -= 1) {
      x.font = `400 ${size}px ${FONTS.ko}`;
      lines = wrap(x, def.text, maxW);
      lh = size * 1.68;
      const h = lines.reduce((acc, l) => acc + (l ? lh : lh * 0.45), 0);
      if (h <= H - top - bottom) break;
    }
    x.fillStyle = COLORS.ink;
    let y = top + size;
    for (const l of lines) { if (l) x.fillText(l, side, y); y += l ? lh : lh * 0.45; }
  } else if (def.type === 'end') {
    drawLogo(x, 'sym', accent, W / 2, H * 0.3, 220);
    x.textAlign = 'center';
    x.fillStyle = COLORS.ink; x.font = `700 54px ${FONTS.ko}`;
    x.fillText(def.title, W / 2, H * 0.5);
    x.fillStyle = COLORS.soft; x.font = `400 34px ${FONTS.ko}`;
    let y = H * 0.5 + 80;
    for (const l of wrap(x, def.text, W - BODY.side * 2.4)) { x.fillText(l, W / 2, y); y += 56; }
    x.fillStyle = COLORS.moss; x.font = `600 34px ${FONTS.ko}`;
    x.fillText('아래 ‘자세히 보기’로 이어집니다 →', W / 2, H * 0.78);
  } else if (def.type === 'blank') {
    drawLogo(x, 'sym', 'rgba(79,95,76,0.12)', W / 2, H / 2, 200);
  }
  footer(x, W, H, n, accent, label);
  // 뒷면은 같은 이미지(source)를 좌우만 뒤집어 GPU 업로드를 한 번으로 줄인다
  const front = toTex(c);
  const back = front.clone();
  back.repeat.x = -1; back.offset.x = 1; back.needsUpdate = true;
  return { front, back };
}

/* ---------- 실제 공간 재질: 나무 바닥 · 석재 타일 · 회벽 (색 + 요철) ---------- */

function repeatTex(c, rx, ry, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = maxAniso;
  return t;
}

// 밝은 오크 마루: 판마다 톤이 조금씩 다르고, 판 사이 홈은 요철 맵으로 실제로 패여 보인다
export function woodFloor(rx, ry) {
  const S = 1024, rows = 8, PW = S / rows;
  const [c, x] = canvas(S, S), [b, y] = canvas(S, S);
  y.fillStyle = '#ffffff'; y.fillRect(0, 0, S, S);
  for (let r = 0; r < rows; r++) {
    let px = -Math.random() * S * 0.5;
    while (px < S) {
      const len = S * (0.35 + Math.random() * 0.4);
      const l = 80 + Math.random() * 10, base = `hsl(36, ${30 + Math.random() * 10}%, ${l}%)`;
      x.fillStyle = base; x.fillRect(px, r * PW, len, PW);
      // 나뭇결
      for (let k = 0; k < 18; k++) {
        x.strokeStyle = `rgba(150,110,60,${0.04 + Math.random() * 0.06})`; x.lineWidth = 1 + Math.random() * 2;
        const gy = r * PW + Math.random() * PW;
        x.beginPath(); x.moveTo(px, gy); x.bezierCurveTo(px + len * 0.3, gy + (Math.random() - 0.5) * 8, px + len * 0.7, gy + (Math.random() - 0.5) * 8, px + len, gy); x.stroke();
      }
      y.fillStyle = '#3a3a3a'; y.fillRect(px - 1, r * PW, 3, PW);   // 판 끝 이음
      px += len;
    }
    x.fillStyle = 'rgba(90,70,40,0.35)'; x.fillRect(0, r * PW, S, 2);
    y.fillStyle = '#3a3a3a'; y.fillRect(0, r * PW - 1, S, 3);         // 판 사이 홈
  }
  return { map: repeatTex(c, rx, ry), bump: repeatTex(b, rx, ry, false) };
}

// 회벽 요철: 손으로 바른 듯한 옅은 굴곡(빛이 스치면 결이 보인다)
export function plasterBump(rx, ry) {
  const S = 512;
  const [c, x] = canvas(S, S);
  x.fillStyle = '#808080'; x.fillRect(0, 0, S, S);
  for (let k = 0; k < 1400; k++) {
    const v = 110 + Math.random() * 40;
    x.fillStyle = `rgba(${v},${v},${v},0.18)`;
    x.beginPath(); x.ellipse(Math.random() * S, Math.random() * S, 4 + Math.random() * 22, 3 + Math.random() * 10, Math.random() * 3, 0, 7); x.fill();
  }
  return repeatTex(c, rx, ry, false);
}

// 문 앞 바닥: 이음매 없는 광택 민바닥(마이크로시멘트처럼 아주 옅은 구름 결만). 시선을 끌지 않고 빛만 은은하게 비친다
export function polishedFloor(rx, ry) {
  const S = 512;
  const [c, x] = canvas(S, S);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, S, S);
  for (let k = 0; k < 220; k++) {
    const v = 236 + Math.random() * 14;
    x.fillStyle = `rgba(${v},${v - 3},${v - 9},0.06)`;
    x.beginPath(); x.ellipse(Math.random() * S, Math.random() * S, 30 + Math.random() * 90, 20 + Math.random() * 60, Math.random() * 3, 0, 7); x.fill();
  }
  return repeatTex(c, rx, ry);
}
