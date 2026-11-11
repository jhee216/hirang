// 이 브라우저의 무작위 방문자 키(localStorage). 이름·계정·IP와 연결하지 않는다 — 서버는 해시만 저장(빈도 제한용).
// 3D(experience/js/live/presence.js)와 같은 저장 이름을 써서, 같은 사이트에서는 같은 방문자로 본다.
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
let mem = null;
export function visitorKey() {
  try {
    let k = localStorage.getItem('hirang.vk');
    if (!/^[a-f0-9]{32}$/.test(k || '')) { k = hex(16); localStorage.setItem('hirang.vk', k); }
    return k;
  } catch (e) { return (mem ||= hex(16)); }
}
