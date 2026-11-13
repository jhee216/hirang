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
  // rev4 문 재구성(2026-11-10): blender/hirang_room_2.0_door_shelf_check.blend 의 HRD 문 치수 그대로.
  // 두 봉우리 = 반지름 0.69 m 원 두 개(중심 x ±0.51 m)가 가운데에서 겹친다 → 가운데 골 높이 2.21 m
  // rev5: 문을 10% 줄였다(2.4×2.44 → 2.16×2.2) — 열리는 순간 방 전체가 한꺼번에 드러나지 않게. 비율(두 봉우리 모양)은 그대로
  width: 2.16,
  height: 2.2,        // 봉우리 꼭대기까지
  lobe: { cx: 0.51 / 1.2, r: 0.69 / 1.2 },   // 반폭(W/2) 대비 비율
  thickness: 0.06,
  gap: 0.008,         // 문틀과 문 사이 간격
  wallThickness: 0.24,   // 초록 문설주(잼) 깊이
  ring: 0.05,         // 초록 안쪽 테두리 폭(문짝과 같은 면)
  facade: 0.33,       // 초록 테두리 앞으로 비스듬히 벌어지는 크림색 문틀 깊이
  reveal: { cx: 0.634 * 0.9, r: 0.814 * 0.9, hc: 1.872 * 0.9 },   // 벽면에서의 문틀 윤곽(m) — blender 실측 × 0.9(rev5 문 축소)
  openAngle: THREE_DEG(100),
  revealAngle: THREE_DEG(68),   // rev5: 처음에는 여기까지만 열려 문짝이 방의 왼쪽을 가린다. 걸어 들어가는 동안 나머지가 열린다
  hoverAjar: THREE_DEG(2.6),
};

export const CAMERA = {
  fov: 50,            // 문 앞(입구) 렌즈
  fovIn: 44,          // 2.0: 방 안 기본 렌즈. 50°보다 원근 왜곡이 적어 아치 곡선이 덜 휜다
  start: [0, 1.545, 4.9],   // rev4: 눈높이 3.5 cm 낮춤(1.58 → 1.545)
  startLook: [0, 1.22, 0],
  // 2.0 첫 실내 구도: 문턱 바로 안쪽, 셸프 정면. 셸프=주, 초록·라벤더 아치=틀, 패키지 3종=아래 한 묶음
  // (구도 스터디 F1은 z −0.2·42°. 나가기 판정선(z −0.4) 안쪽에 서도록 z −0.5·44°로 같은 화면을 만든다)
  // rev5: 입장은 문턱 바로 안(z −0.5)에서 멈추지 않고 '시크릿 책장' 관람 지점(셸프 정면, 아홉 큐레이션 전체)까지 한 번에 간다
  arrive: [0, 1.485, -1.75],   // 2026-11-14: 도착 눈높이도 걷는 눈높이와 같게(처음 움직일 때 눈높이가 저절로 올라가지 않게)
  arriveLook: [0, 1.3, -5.15],
  arriveFov: 48, arrivePfov: 54, arriveStation: 1,
  portrait: { fovScale: 1.36, fovScaleIn: 1.75, arriveZ: -1.75, startZ: 3.8, lookY: 1.1 },   // 2.0 최종: 방 안에서는 더 넓게(세로 화면에서도 심볼 셸프 외곽 전체가 보이게), 시선은 셸프 가운데로  // 세로 화면: 시야를 넓힌다(68/50)
  eye: 1.485,                                     // 걷는 동안 기본 눈높이(m). rev4: 1.52 → 1.485(3.5 cm 낮춤, 문 높이 2.45 m 기준 실제 미터 단위)
  // 2.0 입장 이동: 사람 걸음. 최고 속도 ≈ 거리 × π/2 ÷ 시간 (sine.inOut) → 5.4m ÷ 6.6s ≈ 1.3 m/s
  entry: { duration: 7.4 / 1.3 / 1.4, startAt: 0.6, speed: 1.2 },   // 2026-11-13: 걸어 들어가는 구간 1.4배 빠르게   // 2026-11-11: 문 → 책장 이동 1.3배 빠르게(걷는 구간만, 문 열림·손잡이 타이밍은 그대로)   // rev4: 문 열림~입장 타임라인 전체를 1.2배속(timeScale) — 길이 ÷ 1.2, 문·카메라 관계는 그대로        // 2.0 최종: 5.4m ÷ 7.4s × π/2 ≈ 1.15–1.2 m/s, 문이 60% 열린 뒤 출발        // startAt: 문 열림의 몇 % 지점에서 걷기 시작하나
  // 2026-11-14 관람 걸음 방식: 마우스 가로 = 고개를 조금(감도 낮게), 고개 돌림은 초당 약 40°(손)·30°(저절로)까지, 위아래 시선은 눈높이 정면 근처(−8°~+4.5°)
  // 2026-11-14(2): 끄는 만큼 계속 돈다 — 감도 0.0011 → 0.0024 rad/px(화면 폭을 끌면 약 110°), 앞서 갈 수 있는 각도 0.35 → 1.2 rad, 손으로 돌릴 때 초당 최대 0.7 → 1.8 rad
  // 화면 가장자리에서 누른 채 머물면 그 방향으로 천천히(초당 약 45°) 계속 돈다(edgeTurn)
  look: { speed: 0.0024, lead: 1.2, damping: 9, maxTurn: 1.8, edgeTurn: 0.8, edge: 0.06, autoTurn: 0.5, pitchMin: -0.14, pitchMax: 0.08, level: -0.06, pitch: 0.5 },
  // 2026-11-14: 걷기 1.05 m/s(전시장에서 천천히 걷는 속도)·가속 1.2 m/s²(급출발·급정거 없이). 한 번의 움직임(클릭·휠·끌기)은 한두 걸음(최대 1.4 m)까지
  walk: { speed: 1.25, routeSpeed: 1.5, accel: 1.6, turn: 0.6, bob: 0.024, stride: 0.65, wheel: 0.0025, click: 1.4, step: 0.7, lead: 1.4, dragStep: 0.005, gesture: 1.4 },
  lens: { damping: 1.8 },                         // 2.0: 관람 지점마다 눈높이·렌즈가 천천히 바뀐다
  dragThresholdTouch: 16,   // 2026-11-13: 손가락은 누를 때 조금 밀리므로 더 너그럽게(터치가 끌기로 잘못 잡히지 않게)
  dragThreshold: 6,                               // px. 이보다 멀리 움직이면 클릭이 아니라 드래그
};

// 관람 지점: 전시장처럼 차례로 걸어가며 본다. [이름, 서는 위치(x,z), 바라볼 곳(x,y,z), {eye, fov}]
// 2.0: 실제 장면에서 후보를 비교해 고른 구도(HIRANG_2.0_DESIGN_DIRECTION.md 6장)
// rev4(2026-11-10): 모든 관람 지점 눈높이도 3.5 cm 낮췄다(바라볼 곳은 그대로 — 피치로 흉내 내지 않고 눈 위치만 내림)
export const STATIONS = [
  ['입구', [0, -0.5], [0, 0.9, -5.15], { eye: 1.485, fov: 44 }],
  ['시크릿 책장', [0, -1.75], [0, 1.3, -5.15], { eye: 1.265, fov: 48, pfov: 54 }],   // rev5: 42° → 48° — 셸프 외곽(두 봉우리 꼭대기·아래 아치)까지 한 화면에   // 2.0 최종(깊어진 셸프·다이스): 셸프 정면 3.1m(앞면 기준), 외곽 전체   // pfov: 세로 화면용 렌즈(×fovScaleIn) — 9권·아치 외곽이 좁은 화면 폭에 다 들어오게     // 아홉 권 전경: 정면 3.6m, 망원 쪽 렌즈로 기울어짐 최소
  ['패키지 진열', [0, -0.8], [0, 0.88, -4.2], { eye: 1.165, fov: 48 }],      // 2.0 최종: 눈높이를 낮추고 시선을 들어 바닥 여백을 줄임 — 세 패키지가 화면 아래 1/3에 온전히, 셸프가 배경
  ['큐레이션 테이블 왼쪽', [-1.15, -2.6], [-2.55, 0.75, -2.6]],
  ['큐레이션 테이블 오른쪽', [1.15, -2.6], [2.55, 0.75, -2.6]],
  ['Ch1 패키지', [-1.0, -2.95], [-1.85, 0.55, -3.9], { eye: 1.315, fov: 44 }],
  ['Ch3 패키지', [0, -3.1], [0, 0.5, -4.3], { eye: 1.265, fov: 44 }],
  ['Ch2 패키지', [1.0, -2.95], [1.85, 0.55, -3.9], { eye: 1.315, fov: 44 }],
  ['벽면 큐레이션', [-2.0, -5.9], [-3.15, 1.55, -7.8]],
  ['방명록', [6, -4.8], [5, 1, -4.8], { eye: 1.485, fov: 48 }],   // 2026-11-13: 옆방 방명록 라운지(좌표는 라운지를 붙인 뒤 main.js에서 채운다)
  ['출구', null, null],
];
// 패키지 전시 배율: 실제 비율을 유지한 채 전시용으로 키운다(멀리서도 디자인이 보이도록)
export const PACKAGE_SCALE = 1.9;

function THREE_DEG(d) { return (d * Math.PI) / 180; }

// 2026-11-13: 방명록 라운지(옆방) 입구 — 오른쪽 벽, 계단 앞. 라운지(guestbook/lounge)의 뒷벽 통로와 맞물린다
export const GUESTBOOK_DOOR = { z: -4.8, R: 0.92, leg: 1.3 };
