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

  addLook(dx, dy) {
    const s = CAMERA.look.speed;
    if (dx) this.tYaw -= dx * s;
    this.tPitch = clamp(this.tPitch - dy * s, -CAMERA.look.pitch, CAMERA.look.pitch * 0.8);
  }

  // 걷기 시작하면 시선을 사람 눈높이의 정면으로 부드럽게 되돌린다(바닥을 내려다보며 걷지 않게)
  levelGaze() { this.tPitch = CAMERA.look.level; }

  // 지금 보는 방향으로 dist(m)만큼 걸어간다
  walk(dist) {
    this.levelGaze();
    const from = this.target || this.pos;
    const f = this.forward();
    this.target = this.limit(new THREE.Vector3(from.x + f.x * dist, CAMERA.eye, from.z + f.z * dist));
  }

  // 지점까지 걸어가며, lookAt이 있으면 그쪽으로 천천히 고개를 돌린다
  walkTo(point, lookAt) {
    this.target = this.limit(new THREE.Vector3(point.x, CAMERA.eye, point.z));
    this.levelGaze();
    if (lookAt) {
      const d = new THREE.Vector3().subVectors(lookAt, this.target);
      this.tYaw = this.yaw + wrapPi(Math.atan2(-d.x, -d.z) - this.yaw);
      this.tPitch = clamp(Math.atan2(d.y - CAMERA.eye, Math.hypot(d.x, d.z)), -CAMERA.look.pitch, CAMERA.look.pitch * 0.8);
    }
  }

  snapshot() { return { yaw: this.tYaw, pitch: this.tPitch }; }
  restore(s) { this.tYaw = s.yaw; this.tPitch = s.pitch; }

  update(dt, frozen) {
    if (!this.explore) {
      this.syncBase();
      this.camera.position.copy(this.pos);
    } else {
      if (!frozen) {
        // 키보드 이동·회전
        if (this.keys.t) this.tYaw += this.keys.t * CAMERA.walk.turn * dt;
        if (this.turnRate) this.tYaw += this.turnRate * dt;
        if (this.keys.f) this.walk(this.keys.f * CAMERA.walk.speed * dt * 1.8);
      }
      // 걷기: 출발과 도착이 부드러운 속도 제한 이동
      if (this.target) {
        const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.004) { this.target = null; this.moving = 0; }
        else {
          const v = Math.min(CAMERA.walk.speed, dist * 2.4 + 0.05);
          const step = Math.min(dist, v * dt);
          this.pos.x += (dx / dist) * step; this.pos.z += (dz / dist) * step;
          this.moving = v;
          this.bob += step * 7.5;
        }
      } else this.moving *= 0.9;
      this.pos.y = CAMERA.eye;
      const k = 1 - Math.exp(-CAMERA.look.damping * dt);
      this.yaw += (this.tYaw - this.yaw) * k;
      this.pitch += (this.tPitch - this.pitch) * k;
      // 걸을 때만 아주 작은 상하 흔들림(걸음 느낌)
      const bobAmt = Math.min(1, this.moving / CAMERA.walk.speed) * CAMERA.walk.bob;
      this.camera.position.set(this.pos.x, this.pos.y + Math.sin(this.bob) * bobAmt, this.pos.z);
    }
    this.euler.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(this.euler);
  }
}
