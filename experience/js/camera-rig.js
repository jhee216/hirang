// 카메라 컨트롤러: 문으로 들어오는 동안에는 연출용 경로(pos·look)를 따르고,
// 안에 들어오면 '걷는 관람객'이 된다 — 바닥 위를 천천히 걸어 이동하고(휠·바닥 클릭·키·관람 지점),
// 드래그로 고개를 돌려 둘러본다. 움직임은 모두 감쇠되어 휙휙 돌지 않는다.
import * as THREE from 'three';
import { CAMERA } from './config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(...CAMERA.start);   // 눈 위치(걷는 동안 y는 눈높이로 고정)
    this.look = new THREE.Vector3(...CAMERA.startLook);
    this.yaw = 0; this.pitch = 0;
    this.tYaw = 0; this.tPitch = 0;                    // 목표 시선
    this.target = null;                                // 걸어갈 목표 지점(xz)
    this.keys = { f: 0, t: 0 };                        // 키보드: 앞/뒤, 좌/우 회전
    this.turnRate = 0;                                 // 가로 드래그(조이스틱)로 도는 속도(rad/s)
    this.explore = false;
    this.bob = 0;
    this.moving = 0;
    this.limit = (p) => p;                             // 방 경계·장애물 처리(main.js에서 지정)
    // 2.0: 눈높이·렌즈도 목표값을 향해 천천히 바뀐다(관람 지점마다 다른 구도). fovScale = 세로 화면 배율
    this.eye = this.tEye = CAMERA.eye;
    this.fov = CAMERA.fov; this.tFov = this.walkFov || CAMERA.fovIn;
    this.fovScale = 1;
    this.fovScaleIn = 1;   // 2.0 최종: 세로 화면에서 방 안(문턱 안쪽)일 때의 렌즈 배율. 문턱을 지나는 동안 천천히 바뀐다
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.syncBase();
  }

  // look 지점으로부터 yaw/pitch 계산(입장 연출 중)
  syncBase() {
    const d = new THREE.Vector3().subVectors(this.look, this.pos);
    this.yaw = this.tYaw = Math.atan2(-d.x, -d.z);
    this.pitch = this.tPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  }

  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  // 2026-11-14 관람 걸음 방식: 마우스 가로 움직임 = 고개를 조금 돌림(작은 감도). 세로 움직임은 고개가 아니라 걸음(main.js)
  // 목표 방향은 지금 보는 방향에서 최대 0.35 rad(약 20°)까지만 앞서 간다 — 마우스를 크게 휘둘러도 휙 돌지 않고, 멈추면 곧 멈춘다
  addLook(dx) {
    this.focus = false;
    if (this.walkTurn) { this.tYaw = this.yaw; this.walkTurn = false; }
    this.dragLook = true;
    if (dx) this.tYaw = this.yaw + clamp(wrapPi(this.tYaw - dx * CAMERA.look.speed - this.yaw), -CAMERA.look.lead, CAMERA.look.lead);
  }

  // 걷기 시작하면 시선을 사람 눈높이의 정면으로 부드럽게 되돌린다(바닥을 내려다보며 걷지 않게)
  levelGaze() { this.tPitch = CAMERA.look.level; }

  // 직접 걷기 시작하면 기본 눈높이·기본 렌즈로 돌아간다
  resetLens() { this.tEye = CAMERA.eye; this.tFov = this.walkFov || CAMERA.fovIn; }

  // 지금 보는 방향으로 dist(m)만큼 걸어간다
  // rev4: 키·핀치도 휠과 같은 방식(앞서 쌓이는 거리를 lead로 제한) — 손을 떼면 곧 멈춘다
  walk(dist) { this.nudge(dist); }

  // rev4: 휠 한 눈금 = 짧은 이동. 목표는 지금 위치에서 최대 lead(m) 앞까지만 쌓인다(휠을 계속 굴려도 끝까지 미끄러져 가지 않음).
  // 방향을 바꾸면 앞서 쌓인 이동을 버리고 새 방향으로만 움직인다.
  nudge(dist) {
    this.focus = false;
    if (dist > 0) this.pushT = performance.now();   // 앞으로 걸으려 한 때(문 밖으로 나가려는지 판단)
    this.fast = false;
    this.levelGaze();
    this.resetLens();
    this.walkTurn = false;
    const f = this.forward();
    let lead = 0;
    if (this.target) lead = (this.target.x - this.pos.x) * f.x + (this.target.z - this.pos.z) * f.z;
    if (Math.sign(lead) !== Math.sign(dist)) lead = 0;
    const max = CAMERA.walk.lead;
    lead = clamp(lead + dist, -max, max);
    this.target = this.limit(new THREE.Vector3(this.pos.x + f.x * lead, CAMERA.eye, this.pos.z + f.z * lead));
  }

  // 2026-11-14 게임처럼: 바닥을 꾹 누르고 있는 동안 계속 걷는다. 누른 곳 쪽으로 천천히 몸을 돌리고, 마우스를 옆으로 움직이면 그만큼 방향을 튼다
  startHold(point) {
    this.focus = false; this.fast = false; this.holding = true; this.dragLook = false;
    if (point) {
      const d = new THREE.Vector3(point.x - this.pos.x, 0, point.z - this.pos.z);
      if (d.lengthSq() > 0.01) { this.tYaw = this.yaw + wrapPi(Math.atan2(-d.x, -d.z) - this.yaw); this.walkTurn = true; }
    }
    this.levelGaze(); this.tEye = CAMERA.eye; this.tFov = this.walkFov || CAMERA.fovIn;
  }
  endHold() { this.holding = false; }

  isMoving() {
    if (this.holding) return true;
    if (this.keys.f) return true;
    return !!this.target && Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.z) > 0.02;
  }

  // rev4: 지금 자리·지금 시선에서 즉시 멈춘다(남은 목표·회전·렌즈 변화를 모두 버림. 뒤로 튀거나 순간이동하지 않는다)
  stop() {
    this.holding = false; this.edgeDir = 0;
    this.walkTurn = false;
    this.target = null; this.moving = 0; this.turnRate = 0;
    this.keys.f = 0; this.keys.t = 0;
    this.tYaw = this.yaw; this.tPitch = this.pitch;
    this.tEye = this.eye; this.tFov = this.fov;
  }

  // 지점까지 걸어가며, lookAt이 있으면 그쪽으로 천천히 고개를 돌린다
  walkTo(point, lookAt, lens) {
    this.focus = false;
    this.fast = !!lens;   // 2026-11-14: 관람 지점 단추로 가는 긴 길은 조금 빠른 걸음(1.5 m/s), 한두 걸음은 천천히(1.05 m/s)
    // 2026-11-14: 눈높이·렌즈는 관람 지점과 상관없이 늘 사람 눈높이·기본 렌즈(확대·축소 연출 없음)
    this.tEye = CAMERA.eye;
    this.tFov = this.walkFov || CAMERA.fovIn;
    this.target = this.limit(new THREE.Vector3(point.x, this.tEye, point.z));
    this.levelGaze();
    this.walkTurn = !!lookAt; this.dragLook = false;
    if (lookAt) {
      const d = new THREE.Vector3().subVectors(lookAt, this.target);
      this.tYaw = this.yaw + wrapPi(Math.atan2(-d.x, -d.z) - this.yaw);
      // 2.0 버그 수정: d는 이미 '도착 지점(눈높이) → 바라볼 곳' 벡터라 눈높이를 또 빼면 안 된다(전에는 모든 관람 지점이 약 20° 더 아래를 봤다)
      this.tPitch = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), CAMERA.look.pitchMin, CAMERA.look.pitchMax);   // 2026-11-14: 바닥·천장으로 고개가 꺾이지 않게
    }
  }

  snapshot() { return { yaw: this.tYaw, pitch: this.tPitch }; }
  restore(s) { this.focus = false; this.tYaw = s.yaw; this.tPitch = s.pitch; }

  update(dt, frozen) {
    if (!this.explore) {
      this.syncBase();
      this.camera.position.copy(this.pos);
    } else {
      if (!frozen) {
        // 키보드: ←→ 고개 돌리기, ↑↓ 걷기. 걷기는 누르고 있는 동안 바로 앞 0.35 m를 목표로 삼아, 놓으면 그 안에서 부드럽게 선다
        // 2026-11-14(2): 끌다가 화면 가장자리에 닿아 누른 채 있으면 그쪽으로 계속 돈다(손을 떼거나 가장자리에서 벗어나면 멈춤)
        if (this.edgeDir) { this.walkTurn = false; this.dragLook = true; this.tYaw = this.yaw + clamp(wrapPi(this.tYaw - this.edgeDir * CAMERA.look.edgeTurn * dt - this.yaw), -CAMERA.look.lead, CAMERA.look.lead); }
        if (this.keys.t) { this.walkTurn = false; this.dragLook = true; this.tYaw = this.yaw + clamp(wrapPi(this.tYaw + this.keys.t * CAMERA.walk.turn * dt - this.yaw), -CAMERA.look.lead, CAMERA.look.lead); }
        if (this.keys.f || this.holding) {
          const f = this.forward(), k = this.keys.f || 1;
          this.target = this.limit(new THREE.Vector3(this.pos.x + f.x * k * 0.35, CAMERA.eye, this.pos.z + f.z * k * 0.35));
          this.fast = false; this.tEye = CAMERA.eye; this.tFov = this.walkFov || CAMERA.fovIn; this.tPitch = CAMERA.look.level;
        }
      }
      // 2026-11-14 걷기: 사람 걸음처럼 천천히 출발해(가속 제한) 일정한 속도로 걷고, 남은 거리에 맞춰 부드럽게 선다
      if (this.target) {
        const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
        const dist = Math.hypot(dx, dz), A = CAMERA.walk.accel;
        if (dist < 0.003) { this.target = null; this.moving = 0; }
        else {
          const want = Math.min(this.fast ? CAMERA.walk.routeSpeed : CAMERA.walk.speed, Math.sqrt(2 * A * dist));
          this.moving = this.moving < want ? Math.min(want, this.moving + A * dt) : want;
          const step = Math.min(dist, Math.max(this.moving, 0.05) * dt);
          this.pos.x += (dx / dist) * step; this.pos.z += (dz / dist) * step;
          // 발걸음: 보폭 0.65 m마다 한 걸음(발소리 + 아주 작은 머리 높이 변화)
          const before = Math.floor(this.bob / Math.PI);
          this.bob += (step / CAMERA.walk.stride) * Math.PI;
          if (Math.floor(this.bob / Math.PI) !== before) this.onStep?.(Math.min(1, this.moving / CAMERA.walk.speed));
        }
      } else this.moving = 0;
      const kl = 1 - Math.exp(-CAMERA.lens.damping * dt);
      this.eye += (this.tEye - this.eye) * kl;
      this.fov += (this.tFov - this.fov) * kl;
      this.pos.y = this.eye;
      // 2026-11-14 고개: 목표 방향으로 부드럽게 돌되 초당 최대 각도를 넘지 않는다(손으로 돌릴 때 약 40°/s, 걸으며 저절로 돌 때 약 30°/s).
      // 위아래는 눈높이 정면 근처로만(바닥·벽·천장으로 시선이 꺾이지 않게)
      if (!this.focus) this.tPitch = clamp(this.tPitch, CAMERA.look.pitchMin, CAMERA.look.pitchMax);
      const k = 1 - Math.exp(-CAMERA.look.damping * dt), capY = CAMERA.look.autoTurn * dt, capP = 0.25 * dt;
      if (this.dragLook) {
        // 2026-11-14(4): 마우스로 돌릴 때 — 속도 상한 없이 지수 보간만(시간 상수 1/dragSmooth 초, 프레임 속도와 무관).
        // 목표를 넘어가지 않고(과회전·관성 없음), 마우스를 멈추면 약 0.25초 안에 멈춘다. 상한이 있으면 일정 속도로 끌려가다 뚝 멈춰 끊겨 보였다
        this.yaw += wrapPi(this.tYaw - this.yaw) * (1 - Math.exp(-CAMERA.look.dragSmooth * dt));
      } else this.yaw += clamp(wrapPi(this.tYaw - this.yaw) * k, -capY, capY);
      this.pitch += clamp((this.tPitch - this.pitch) * k, -capP, capP);
      // 걸을 때만 아주 작은 상하 흔들림(걸음 느낌)
      // 2026-11-14: 걷는 동안만 발을 디딜 때 살짝(최대 1.2 cm) 내려앉는다 — 서 있으면 눈높이 그대로
      this.bobAmt = (this.bobAmt || 0) + ((this.moving > 0.05 ? Math.min(1, this.moving / CAMERA.walk.speed) : 0) - (this.bobAmt || 0)) * (1 - Math.exp(-6 * dt));
      const dip = this.bobAmt * CAMERA.walk.bob * (Math.abs(Math.sin(this.bob)) - 0.5);
      this.camera.position.set(this.pos.x, this.pos.y + dip, this.pos.z);
    }
    // 렌즈 배율(세로 화면): 문 밖 → 방 안. 입장 중에는 걷는 전체 거리에 걸쳐 고르게(entryZ), 그 밖에는 문턱 0.7 m 구간에서
    const z = this.camera.position.z;
    const kIn = !this.explore && this.entryZ ? clamp((this.entryZ[0] - z) / (this.entryZ[0] - this.entryZ[1]), 0, 1) : clamp((0.2 - z) / 0.7, 0, 1);
    const f = this.fov * (this.fovScale + (this.fovScaleIn - this.fovScale) * kIn * kIn * (3 - 2 * kIn));
    if (Math.abs(this.camera.fov - f) > 1e-4) { this.camera.fov = f; this.camera.updateProjectionMatrix(); }
    this.euler.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(this.euler);
  }
}
