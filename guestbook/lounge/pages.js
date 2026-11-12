// 종이에 그리는 글(캔버스 텍스처). 방문자 글은 textContent처럼 글자로만 그린다(HTML 해석 없음).
import * as THREE from 'three';

const FONT = '"Pretendard","Apple SD Gothic Neo","Inter",sans-serif';
const INK = '#2E3A2C', MUTED = '#8A8372', RULE = 'rgba(79,95,76,0.13)';

// 한국어 줄바꿈: 어절(띄어쓰기) 단위로 넘기고, 한 어절이 줄보다 길면 글자 단위로
function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (ctx.measureText(t).width <= maxW) { line = t; continue; }
      if (line) out.push(line);
      if (ctx.measureText(word).width <= maxW) { line = word; continue; }
      line = '';
      for (const ch of word) { if (ctx.measureText(line + ch).width > maxW) { out.push(line); line = ch; } else line += ch; }
    }
    out.push(line);
  }
  return out;
}

export function makePageTexture(aspect = 297 / 210) {
  const W = 1024, H = Math.round(W * aspect);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const ctx = cv.getContext('2d');
  // draw({eyebrow, body, name, foot, placeholder, ruled})
  tex.draw = ({ eyebrow = '', body = '', name = '', foot = '', placeholder = '', ruled = true, size = 46 } = {}) => {
    ctx.fillStyle = '#FFFCF4'; ctx.fillRect(0, 0, W, H);
    const pad = 96, lh = Math.round(size * 1.72), top = 230;
    if (ruled) {
      ctx.strokeStyle = RULE; ctx.lineWidth = 2;
      for (let y = top + lh - 14; y < H - 150; y += lh) { ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke(); }
    }
    ctx.textBaseline = 'alphabetic';
    if (eyebrow) { ctx.fillStyle = MUTED; ctx.font = `600 30px ${FONT}`; ctx.letterSpacing = '4px'; ctx.fillText(eyebrow, pad, 150); ctx.letterSpacing = '0px'; }
    ctx.font = `400 ${size}px ${FONT}`;
    const text = body || placeholder;
    ctx.fillStyle = body ? INK : 'rgba(46,58,44,0.38)';
    const lines = wrap(ctx, text, W - pad * 2);
    lines.slice(0, Math.floor((H - top - 170) / lh)).forEach((l, i) => ctx.fillText(l, pad, top + lh * (i + 1) - 26));
    ctx.fillStyle = MUTED; ctx.font = `500 30px ${FONT}`;
    if (name) ctx.fillText(name, pad, H - 96);
    if (foot) { ctx.textAlign = 'right'; ctx.fillText(foot, W - pad, H - 96); ctx.textAlign = 'left'; }
    tex.needsUpdate = true;
  };
  tex.draw();
  return tex;
}
