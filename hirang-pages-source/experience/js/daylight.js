// 실제 해의 흐름: 기기의 지금 시각·날짜로 해 높이(고도)와 방향(방위각)을 계산한다.
// 위치는 서울 기준(하이랑 매장). 기기 시간대가 한국이 아니면 그 시간대의 기준 경도를 쓴다.
// 주소에 ?hour=21.5 처럼 붙이면 그 시각으로 미리 볼 수 있다(확인용).
const RAD = Math.PI / 180;
const SEOUL = { lat: 37.57, lon: 126.98 };

export function hourOverride() {
  const v = parseFloat(new URLSearchParams(location.search).get('hour'));
  return Number.isFinite(v) ? ((v % 24) + 24) % 24 : null;
}

// 해 위치(도): { elev, az }  az 0=북, 90=동, 180=남, 270=서
export function sunPosition(date = new Date(), hour = null) {
  const tz = -date.getTimezoneOffset() / 60;
  const lon = tz === 9 ? SEOUL.lon : tz * 15;
  const start = new Date(date.getFullYear(), 0, 0);
  const doy = Math.floor((date - start) / 86400000);
  const h = hour ?? date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const decl = 23.44 * Math.sin(2 * Math.PI * (284 + doy) / 365) * RAD;
  const B = 2 * Math.PI * (doy - 81) / 364;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);      // 균시차(분)
  const lst = h + (4 * (lon - tz * 15) + eot) / 60;                                    // 지방 태양시
  const hra = 15 * (lst - 12) * RAD;
  const lat = SEOUL.lat * RAD;
  const sinE = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hra);
  const elev = Math.asin(Math.max(-1, Math.min(1, sinE)));
  let az = Math.acos(Math.max(-1, Math.min(1, (Math.sin(decl) * Math.cos(lat) - Math.cos(decl) * Math.sin(lat) * Math.cos(hra)) / Math.max(1e-6, Math.cos(elev)))));
  if (hra > 0) az = 2 * Math.PI - az;
  return { elev: elev / RAD, az: az / RAD };
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 조명에 쓰는 값: day(0 밤 → 1 한낮), warm(해 뜰 녘·질 녘의 붉은 기운), morning(오전일수록 1)
export function daylight(date = new Date(), hour = null) {
  const { elev, az } = sunPosition(date, hour);
  const day = smooth(-6, 14, elev);                         // 시민박명(-6°)부터 밝아져 고도 14°면 한낮 밝기
  const warm = smooth(-4, 2, elev) * (1 - smooth(6, 22, elev));
  const morning = az < 150 ? 1 : 0;   // 해가 아직 동남쪽에 있을 때까지만 '아침'
  return { elev, az, day, warm, night: 1 - day, morning };
}
