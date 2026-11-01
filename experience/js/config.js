// HIRANG Secret Reading Zone — 설정값
// 색상·서체는 기존 index.html의 :root 토큰과 브랜딩 > 컬러 섹션에서 그대로 가져왔다.

export const COLORS = {
  ivory: '#FFF9EA',     // Primary · 종이의 온기
  ink: '#0C0C0C',       // Primary · 차콜
  moss: '#4F5F4C',      // Chapter · Ch1 Green
  lavender: '#C1B1D1',  // Chapter · Ch2 Purple
  yellow: '#FDF9C6',    // Chapter · Ch3 Yellow
  muted: '#716C60',
  soft: '#55524A',
};

export const FONTS = {
  ko: '"Pretendard","Inter","Apple SD Gothic Neo",sans-serif',
  en: '"Inter","Pretendard",sans-serif',
};

// 사이트 연결. 기존 index.html은 #01~#09 로 해당 책 페이지를 바로 열고,
// #packaging 은 이번 작업에서 추가한 패키징 시트 딥링크다.
// from=secret-room 이 붙어 있을 때만 그 화면의 '목록으로'(패키징은 '닫기')가 시크릿 룸으로 돌아온다.
const FROM_ROOM = '?from=secret-room';
export const LINKS = {
  home: '../index.html',
  book: (id) => `../index.html${FROM_ROOM}#${id}`,
  packaging: `../index.html${FROM_ROOM}#packaging`,
};

// 3D 공간은 미터 단위. 패키지·책은 실제 mm 비율을 유지한 채 전시용으로 같은 배율만 키운다.
export const DISPLAY_SCALE = 1.5;
export const mm = (v) => (v / 1000) * DISPLAY_SCALE;

export const PACKAGES = [
  {
    id: 'ch1', chapter: 'Ch1', title: '하이랑 큐레이션', sub: '웰컴 패키지 + 기본형',
    size: [164, 34, 235],
    desc: '하이랑을 처음 만나는 구성으로 포장된 책과 브랜드 소개 인서트가 포함됩니다.',
    detailUrl: LINKS.packaging,
  },
  {
    id: 'ch2', chapter: 'Ch2', title: 'Selection Curation', sub: '시크릿 북커버 패키지 + 추가 구성형',
    size: [180, 42, 235],
    desc: '시크릿 북커버가 함께 포함된 구성입니다.',
    detailUrl: LINKS.packaging,
  },
  {
    id: 'ch3', chapter: 'Ch3', title: 'Archive Curation', sub: '독서 기록 굿즈 포함형',
    size: [150, 40, 220],
    desc: '문장 스티커, 책갈피 등 독서 기록 굿즈가 추가 포함된 구성입니다.',
    detailUrl: LINKS.packaging,
  },
];

// 시크릿 북커버를 씌운 책(A5 148×210, 두께 22mm)
export const BOOK_SIZE = [148, 22, 210];

// 권장 타이밍(초). prefers-reduced-motion 이면 main.js에서 전체를 짧게 줄인다.
export const TIMING = {
  handle: 0.4,
  door: 1.8,
  cameraEntry: 2.6,
  cameraArrival: 0.6,
  hover: 0.25,
  select: 0.8,
  bookOpen: 1.2,
  pageFlip: 0.65,
  returnRoom: 0.9,
};

export const DOOR = {
  width: 1.3,         // 넓은 화면에서도 문이 공간을 채우도록 폭을 넓힘
  height: 2.36,       // 아치 꼭대기까지
  thickness: 0.05,
  gap: 0.008,         // 문틀과 문 사이 간격
  wallThickness: 0.24,
  openAngle: THREE_DEG(100),
  hoverAjar: THREE_DEG(2.6),
};

export const CAMERA = {
  fov: 50,
  start: [0, 1.58, 4.9],
  startLook: [0, 1.22, 0],
  arrive: [0, 1.38, -1.0],
  arriveLook: [0, 1.2, -5.2],
  portrait: { fov: 68, arriveZ: -0.7, startZ: 3.8 },          // 세로 화면: 시야를 넓힌다
  eye: 1.38,                                      // 걷는 동안 눈높이(m): 서 있을 때 책장·전시물이 화면 가운데 오도록
  look: { speed: 0.0016, pitch: 0.5, damping: 2.6, joy: 0.85, joyRange: 320, level: -0.03 }, // 고개 돌리기: 세로는 드래그, 가로는 조이스틱(누른 곳에서 멀수록 빨리, 최대 rad/s)·걸을 때 시선 높이
  walk: { speed: 0.9, turn: 0.7, bob: 0.01, wheel: 0.0025, click: 1.1 }, // 걷기 속도(m/s)·키보드 회전·걸음 흔들림·휠 1눈금 거리·클릭 한 번 이동(한두 걸음)
  dragThreshold: 6,                               // px. 이보다 멀리 움직이면 클릭이 아니라 드래그
};

// 관람 지점: 전시장처럼 차례로 걸어가며 본다. [이름, 서는 위치(x,z), 바라볼 곳(x,y,z)]
export const STATIONS = [ ['입구', [0, -1.0], [0, 1.2, -5.2]], ['시크릿 책장', [0.95, -4.35], [0, 1.15, -5.15]], ['큐레이션 테이블 왼쪽', [-1.15, -2.6], [-2.55, 0.75, -2.6]], ['큐레이션 테이블 오른쪽', [1.15, -2.6], [2.55, 0.75, -2.6]], ['Ch1 패키지', [-0.75, -2.5], [-1.45, 0.55, -3.45]], ['Ch3 패키지', [0, -2.55], [0, 0.5, -3.75]], ['Ch2 패키지', [0.75, -2.5], [1.45, 0.55, -3.45]], ['벽면 큐레이션', [-2.0, -5.9], [-3.15, 1.55, -7.8]], ['출구', null, null] ];
// 패키지 전시 배율: 실제 비율을 유지한 채 전시용으로 키운다(멀리서도 디자인이 보이도록)
export const PACKAGE_SCALE = 1.9;

function THREE_DEG(d) { return (d * Math.PI) / 180; }
