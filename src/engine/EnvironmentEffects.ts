/**
 * 환경 이펙트 — 먼지 파티클 시스템 + 네온 그리드 + B-4 Phase 2 파티클/라이팅
 * Cold Forge 분위기 연출용 (성능 최적화: AdditiveBlending, depthWrite false)
 *
 * B-4 Phase 2 추가:
 * - 히트 스파크 파티클 (탄착점에서 불꽃 방출)
 * - 탄착 먼지 파티클 (벽/바닥 충격)
 * - 앰비언트 파티클 (떠다니는 먼지/안개)
 * - 머즐 플래시 동적 라이팅 (PointLight 깜빡임)
 * - 네온 조명 pulse 애니메이션
 */
import * as THREE from 'three';
import type { DustConfig } from './EnvironmentPresets';
import { createMaterial, COLD_FORGE_MATERIALS } from './EnvironmentPresets';

// ═══════════════════════════════════════════════════════
// B-4 Phase 2 상수
// ═══════════════════════════════════════════════════════

/** 스파크 파티클 최대 수 */
const SPARK_MAX_PARTICLES = 64;
/** 스파크 파티클 수명 (초) */
const SPARK_LIFETIME = 0.3;
/** 스파크 초기 속도 (m/s) */
const SPARK_SPEED = 8;
/** 스파크 크기 */
const SPARK_SIZE = 0.04;
/** 스파크 색상 — 뜨거운 오렌지 */
const SPARK_COLOR = 0xffaa33;
/** 스파크 방출 개수/히트 */
const SPARK_COUNT_PER_HIT = 12;

/** 먼지 파티클 최대 수 (히트 이펙트용) */
const DUST_HIT_MAX_PARTICLES = 32;
/** 먼지 수명 (초) */
const DUST_HIT_LIFETIME = 0.8;
/** 먼지 초기 속도 (m/s) */
const DUST_HIT_SPEED = 2;
/** 먼지 크기 (히트 이펙트용) */
const DUST_HIT_SIZE = 0.06;
/** 먼지 색상 (히트 이펙트용) */
const DUST_HIT_COLOR = 0x888888;
/** 먼지 방출 개수/히트 */
const DUST_COUNT_PER_HIT = 6;

/** 앰비언트 파티클 수 */
const AMBIENT_PARTICLE_COUNT = 200;
/** 앰비언트 분포 범위 (m) */
const AMBIENT_RANGE = 30;
/** 앰비언트 하강 속도 (m/s) */
const AMBIENT_FALL_SPEED = 0.15;
/** 앰비언트 수평 흔들림 속도 */
const AMBIENT_DRIFT_SPEED = 0.1;
/** 앰비언트 크기 */
const AMBIENT_SIZE = 0.025;
/** 앰비언트 색상 — 미세 먼지/안개 */
const AMBIENT_COLOR = 0x8899aa;

/** 머즐 플래시 라이트 강도 */
const MUZZLE_LIGHT_INTENSITY = 3.0;
/** 머즐 플래시 감쇠 속도 (초당) */
const MUZZLE_LIGHT_DECAY_RATE = 20;
/** 머즐 플래시 라이트 사거리 */
const MUZZLE_LIGHT_DISTANCE = 8;
/** 머즐 플래시 색상 — 밝은 주황 */
const MUZZLE_LIGHT_COLOR = 0xffcc44;

/** 네온 pulse 주기 (초) */
const NEON_PULSE_PERIOD = 3.0;
/** 네온 pulse 최소 강도 배율 */
const NEON_PULSE_MIN = 0.7;
/** 네온 pulse 최대 강도 배율 */
const NEON_PULSE_MAX = 1.0;

/** 중력 가속도 (m/s²) */
const GRAVITY = 9.81;

// ═══════════════════════════════════════════════════════
// B-4 Phase 2 타입
// ═══════════════════════════════════════════════════════

/** 파티클 개별 상태 */
interface Particle {
  alive: boolean;
  age: number;
  maxAge: number;
  velocity: THREE.Vector3;
}

/** 환경 이펙트 설정 */
export interface EnvironmentEffectsConfig {
  /** 파티클 이펙트 활성화 (기본 true) */
  particlesEnabled?: boolean;
  /** 앰비언트 파티클 활성화 (기본 true) */
  ambientEnabled?: boolean;
  /** 머즐 플래시 라이트 활성화 (기본 true) */
  muzzleFlashEnabled?: boolean;
  /** 네온 pulse 활성화 (기본 true) */
  neonPulseEnabled?: boolean;
}

// ═══════════════════════════════════════════════════════
// 먼지 파티클 시스템 (B-4 Phase 1 — 앰비언트 먼지)
// ═══════════════════════════════════════════════════════

export class DustParticleSystem {
  private points: THREE.Points;
  private velocities: Float32Array;
  private config: DustConfig;

  constructor(config: DustConfig) {
    this.config = config;

    const positions = new Float32Array(config.count * 3);
    this.velocities = new Float32Array(config.count * 3);

    // 초기 위치 + 느린 랜덤 드리프트 속도
    for (let i = 0; i < config.count; i++) {
      const idx = i * 3;
      positions[idx] = (Math.random() - 0.5) * config.area.width;
      positions[idx + 1] = Math.random() * config.area.height;
      positions[idx + 2] = (Math.random() - 0.5) * config.area.depth;

      this.velocities[idx] = (Math.random() - 0.5) * config.speed;
      this.velocities[idx + 1] = (Math.random() - 0.5) * config.speed * 0.5;
      this.velocities[idx + 2] = (Math.random() - 0.5) * config.speed;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: config.color,
      size: config.size,
      transparent: true,
      opacity: config.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, material);
  }

  /** 매 프레임 위치 업데이트 — 경계 래핑 */
  update(deltaTime: number): void {
    const positions = this.points.geometry.attributes.position.array as Float32Array;
    const { width, height, depth } = this.config.area;
    const halfW = width / 2;
    const halfD = depth / 2;

    for (let i = 0; i < this.config.count; i++) {
      const idx = i * 3;
      positions[idx] += this.velocities[idx] * deltaTime;
      positions[idx + 1] += this.velocities[idx + 1] * deltaTime;
      positions[idx + 2] += this.velocities[idx + 2] * deltaTime;

      // 경계 래핑
      if (positions[idx] > halfW) positions[idx] = -halfW;
      else if (positions[idx] < -halfW) positions[idx] = halfW;
      if (positions[idx + 1] > height) positions[idx + 1] = 0;
      else if (positions[idx + 1] < 0) positions[idx + 1] = height;
      if (positions[idx + 2] > halfD) positions[idx + 2] = -halfD;
      else if (positions[idx + 2] < -halfD) positions[idx + 2] = halfD;
    }

    this.points.geometry.attributes.position.needsUpdate = true;
  }

  /** Three.js Points 객체 반환 (씬에 추가용) */
  getObject(): THREE.Points {
    return this.points;
  }

  /** 리소스 해제 */
  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

// ═══════════════════════════════════════════════════════
// 네온 바닥 그리드
// ═══════════════════════════════════════════════════════

/**
 * 네온 글로우 바닥 그리드 생성
 * @param width  바닥 폭 (m)
 * @param depth  바닥 깊이 (m)
 * @param spacing 그리드 간격 (m)
 * @returns Three.js Group (씬에 추가)
 */
export function createNeonGrid(
  width: number,
  depth: number,
  spacing: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'neon-grid';

  // 은은한 시안 그리드 재질 (emissive 낮춤)
  const gridMat = createMaterial(COLD_FORGE_MATERIALS.neonCyan);
  gridMat.emissiveIntensity = 0.3;

  const halfW = width / 2;
  const halfD = depth / 2;
  const yOffset = 0.001; // 바닥 위로 미세 오프셋

  // X 방향 라인 (Z축 따라 깔림)
  for (let x = -halfW; x <= halfW; x += spacing) {
    const geo = new THREE.PlaneGeometry(0.02, depth);
    const line = new THREE.Mesh(geo, gridMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, yOffset, 0);
    group.add(line);
  }

  // Z 방향 라인 (X축 따라 깔림)
  for (let z = -halfD; z <= halfD; z += spacing) {
    const geo = new THREE.PlaneGeometry(width, 0.02);
    const line = new THREE.Mesh(geo, gridMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, yOffset, z);
    group.add(line);
  }

  return group;
}

// ═══════════════════════════════════════════════════════
// 네온 트림 라인 (벽 하단 장식)
// ═══════════════════════════════════════════════════════

/**
 * 벽/바닥 경계에 얇은 네온 트림 라인 생성
 * @param points  경로 포인트 배열 (3개 이상)
 * @param color   네온 색상 (기본: 시안)
 */
export function createNeonTrimLine(
  points: THREE.Vector3[],
  color: number = 0x00e5ff,
): THREE.Mesh {
  if (points.length < 2) {
    // 최소 2점 필요 — 빈 메시 반환
    return new THREE.Mesh(new THREE.BufferGeometry());
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, Math.max(points.length * 8, 16), 0.025, 6, false);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 3.0,
    toneMapped: false,
  });
  return new THREE.Mesh(geo, mat);
}

/**
 * 사각 영역 하단에 네온 트림 라인 자동 생성 (4변)
 */
export function createPerimeterTrim(
  width: number,
  depth: number,
  height: number = 0.1,
  color: number = 0x00e5ff,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'perimeter-trim';
  const halfW = width / 2;
  const halfD = depth / 2;
  const y = height;

  // 4변 경로
  const corners = [
    new THREE.Vector3(-halfW, y, -halfD),
    new THREE.Vector3(halfW, y, -halfD),
    new THREE.Vector3(halfW, y, halfD),
    new THREE.Vector3(-halfW, y, halfD),
    new THREE.Vector3(-halfW, y, -halfD), // 닫기
  ];

  const trim = createNeonTrimLine(corners, color);
  group.add(trim);
  return group;
}

// ═══════════════════════════════════════════════════════
// B-4 Phase 2: GPU 친화적 파티클 풀
// ═══════════════════════════════════════════════════════

/**
 * GPU 친화적 파티클 풀 — Points + BufferGeometry 기반
 * 고정 크기 배열에서 죽은 파티클을 재활용 (GC 없음)
 */
class ParticlePool {
  readonly points: THREE.Points;
  private positions: Float32Array;
  private opacities: Float32Array;
  private particles: Particle[];
  private maxCount: number;

  constructor(
    maxCount: number,
    size: number,
    color: number,
    blending: THREE.Blending = THREE.AdditiveBlending,
  ) {
    this.maxCount = maxCount;
    this.particles = [];
    this.positions = new Float32Array(maxCount * 3);
    this.opacities = new Float32Array(maxCount);

    // 파티클 상태 초기화 (모두 비활성)
    for (let i = 0; i < maxCount; i++) {
      this.particles.push({
        alive: false,
        age: 0,
        maxAge: 0,
        velocity: new THREE.Vector3(),
      });
      // 보이지 않는 위치로 초기화
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = -100;
      this.positions[i * 3 + 2] = 0;
      this.opacities[i] = 0;
    }

    // BufferGeometry + Points 생성
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('opacity', new THREE.BufferAttribute(this.opacities, 1));

    const mat = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      blending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  /** 파티클 발사 — 풀에서 비활성 슬롯 재활용 */
  emit(origin: THREE.Vector3, velocity: THREE.Vector3, lifetime: number): void {
    for (let i = 0; i < this.maxCount; i++) {
      if (!this.particles[i].alive) {
        this.particles[i].alive = true;
        this.particles[i].age = 0;
        this.particles[i].maxAge = lifetime;
        this.particles[i].velocity.copy(velocity);
        this.positions[i * 3] = origin.x;
        this.positions[i * 3 + 1] = origin.y;
        this.positions[i * 3 + 2] = origin.z;
        this.opacities[i] = 1;
        return;
      }
    }
    // 풀 가득 참 — 무시 (성능 보호)
  }

  /** 매 프레임 업데이트 — 위치/투명도 갱신 */
  update(dt: number, useGravity: boolean): void {
    let needsUpdate = false;

    for (let i = 0; i < this.maxCount; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;

      p.age += dt;
      if (p.age >= p.maxAge) {
        // 수명 종료 — 비활성화
        p.alive = false;
        this.positions[i * 3 + 1] = -100;
        this.opacities[i] = 0;
        needsUpdate = true;
        continue;
      }

      // 중력 적용
      if (useGravity) {
        p.velocity.y -= GRAVITY * dt;
      }

      // 위치 이동
      this.positions[i * 3] += p.velocity.x * dt;
      this.positions[i * 3 + 1] += p.velocity.y * dt;
      this.positions[i * 3 + 2] += p.velocity.z * dt;

      // 투명도 — 선형 페이드아웃
      this.opacities[i] = 1 - (p.age / p.maxAge);
      needsUpdate = true;
    }

    if (needsUpdate) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.opacity.needsUpdate = true;
    }
  }

  /** 리소스 정리 */
  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

// ═══════════════════════════════════════════════════════
// B-4 Phase 2: 환경 이펙트 통합 매니저
// ═══════════════════════════════════════════════════════

/**
 * 환경 이펙트 통합 매니저
 * GameEngine에서 생성 후 update(dt) + 이벤트 메서드 호출
 */
export class EnvironmentEffects {
  private scene: THREE.Scene;
  private config: Required<EnvironmentEffectsConfig>;

  // ── 파티클 풀 ──
  private sparkPool: ParticlePool;
  private dustPool: ParticlePool;

  // ── 앰비언트 파티클 (항시 활성) ──
  private ambientPoints: THREE.Points;
  private ambientPositions: Float32Array;
  private ambientDrifts: Float32Array; // 개별 흔들림 위상

  // ── 머즐 플래시 라이트 ──
  private muzzleLight: THREE.PointLight;
  private muzzleLightIntensity = 0;

  // ── 네온 조명 ──
  private neonLights: THREE.PointLight[] = [];
  private neonElapsed = 0;

  constructor(scene: THREE.Scene, config: EnvironmentEffectsConfig = {}) {
    this.scene = scene;
    this.config = {
      particlesEnabled: config.particlesEnabled !== false,
      ambientEnabled: config.ambientEnabled !== false,
      muzzleFlashEnabled: config.muzzleFlashEnabled !== false,
      neonPulseEnabled: config.neonPulseEnabled !== false,
    };

    // 스파크 파티클 풀 (히트 시 불꽃)
    this.sparkPool = new ParticlePool(
      SPARK_MAX_PARTICLES, SPARK_SIZE, SPARK_COLOR, THREE.AdditiveBlending,
    );
    scene.add(this.sparkPool.points);

    // 먼지 파티클 풀 (탄착 시 먼지)
    this.dustPool = new ParticlePool(
      DUST_HIT_MAX_PARTICLES, DUST_HIT_SIZE, DUST_HIT_COLOR, THREE.NormalBlending,
    );
    scene.add(this.dustPool.points);

    // 앰비언트 파티클 (떠다니는 먼지)
    const { points, positions, drifts } = this.createAmbientParticles();
    this.ambientPoints = points;
    this.ambientPositions = positions;
    this.ambientDrifts = drifts;
    if (this.config.ambientEnabled) {
      scene.add(this.ambientPoints);
    }

    // 머즐 플래시 PointLight (기본 비활성, 발사 시 순간 점등)
    this.muzzleLight = new THREE.PointLight(
      MUZZLE_LIGHT_COLOR, 0, MUZZLE_LIGHT_DISTANCE,
    );
    this.muzzleLight.position.set(0, 1.5, -0.5);
    scene.add(this.muzzleLight);
  }

  /** 매 프레임 업데이트 */
  update(dt: number): void {
    // 파티클 시뮬레이션
    if (this.config.particlesEnabled) {
      this.sparkPool.update(dt, true);
      this.dustPool.update(dt, true);
    }

    // 앰비언트 파티클 흔들림
    if (this.config.ambientEnabled) {
      this.updateAmbient(dt);
    }

    // 머즐 플래시 라이트 감쇠
    if (this.muzzleLightIntensity > 0) {
      this.muzzleLightIntensity = Math.max(
        0,
        this.muzzleLightIntensity - MUZZLE_LIGHT_DECAY_RATE * dt,
      );
      this.muzzleLight.intensity = this.muzzleLightIntensity;
    }

    // 네온 pulse
    if (this.config.neonPulseEnabled && this.neonLights.length > 0) {
      this.neonElapsed += dt;
      this.updateNeonPulse();
    }
  }

  // ═══════════════ 이벤트 메서드 ═══════════════

  /**
   * 히트 이벤트 — 탄착점에서 스파크 + 먼지 방출
   * @param hitPoint 월드 좌표 탄착 지점
   * @param hitNormal 표면 법선 (파티클 방출 방향)
   */
  emitHitEffect(hitPoint: THREE.Vector3, hitNormal?: THREE.Vector3): void {
    if (!this.config.particlesEnabled) return;

    const normal = hitNormal ?? new THREE.Vector3(0, 1, 0);

    // 스파크 — 법선 중심 반구형 분산
    for (let i = 0; i < SPARK_COUNT_PER_HIT; i++) {
      const dir = normal.clone()
        .add(new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
        ))
        .normalize();
      const speed = SPARK_SPEED * (0.5 + Math.random() * 0.5);
      this.sparkPool.emit(
        hitPoint,
        dir.multiplyScalar(speed),
        SPARK_LIFETIME * (0.5 + Math.random() * 0.5),
      );
    }

    // 먼지 — 느린 상방 확산
    for (let i = 0; i < DUST_COUNT_PER_HIT; i++) {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        0.5 + Math.random() * 0.5,
        (Math.random() - 0.5) * 1.5,
      ).normalize();
      this.dustPool.emit(
        hitPoint,
        dir.multiplyScalar(DUST_HIT_SPEED * (0.3 + Math.random() * 0.7)),
        DUST_HIT_LIFETIME * (0.5 + Math.random() * 0.5),
      );
    }
  }

  /**
   * 머즐 플래시 이벤트 — 발사 시 PointLight 순간 점등
   * @param position 머즐 월드 좌표 (무기 총구 위치)
   */
  triggerMuzzleFlash(position?: THREE.Vector3): void {
    if (!this.config.muzzleFlashEnabled) return;
    if (position) {
      this.muzzleLight.position.copy(position);
    }
    this.muzzleLightIntensity = MUZZLE_LIGHT_INTENSITY;
    this.muzzleLight.intensity = MUZZLE_LIGHT_INTENSITY;
  }

  /**
   * 네온 조명 등록 — Environment에서 생성한 PointLight 참조 추가
   * pulse 애니메이션 대상으로 관리
   */
  addNeonLight(light: THREE.PointLight): void {
    this.neonLights.push(light);
  }

  /** 설정 변경 */
  setConfig(config: Partial<EnvironmentEffectsConfig>): void {
    if (config.particlesEnabled !== undefined) {
      this.config.particlesEnabled = config.particlesEnabled;
    }
    if (config.ambientEnabled !== undefined) {
      this.config.ambientEnabled = config.ambientEnabled;
      if (config.ambientEnabled) {
        this.scene.add(this.ambientPoints);
      } else {
        this.scene.remove(this.ambientPoints);
      }
    }
    if (config.muzzleFlashEnabled !== undefined) {
      this.config.muzzleFlashEnabled = config.muzzleFlashEnabled;
    }
    if (config.neonPulseEnabled !== undefined) {
      this.config.neonPulseEnabled = config.neonPulseEnabled;
    }
  }

  /** 리소스 정리 */
  dispose(): void {
    this.sparkPool.dispose();
    this.dustPool.dispose();
    this.ambientPoints.geometry.dispose();
    (this.ambientPoints.material as THREE.Material).dispose();
    this.scene.remove(this.sparkPool.points);
    this.scene.remove(this.dustPool.points);
    this.scene.remove(this.ambientPoints);
    this.scene.remove(this.muzzleLight);
  }

  // ═══════════════ 내부 메서드 ═══════════════

  /** 앰비언트 파티클 생성 — 씬 전체에 분포 */
  private createAmbientParticles(): {
    points: THREE.Points;
    positions: Float32Array;
    drifts: Float32Array;
  } {
    const count = AMBIENT_PARTICLE_COUNT;
    const positions = new Float32Array(count * 3);
    const drifts = new Float32Array(count); // 개별 위상 오프셋

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * AMBIENT_RANGE;
      positions[i * 3 + 1] = Math.random() * AMBIENT_RANGE * 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * AMBIENT_RANGE;
      drifts[i] = Math.random() * Math.PI * 2; // 랜덤 시작 위상
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: AMBIENT_COLOR,
      size: AMBIENT_SIZE,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      sizeAttenuation: true,
    });

    return { points: new THREE.Points(geo, mat), positions, drifts };
  }

  /** drifts 배열 — ambient update에서 누적 시간 */
  private drifts: Float32Array = new Float32Array(AMBIENT_PARTICLE_COUNT);

  /** 앰비언트 파티클 업데이트 — 느린 하강 + 좌우 흔들림 */
  private updateAmbient(dt: number): void {
    const count = AMBIENT_PARTICLE_COUNT;
    let needsUpdate = false;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      // 하강
      this.ambientPositions[idx + 1] -= AMBIENT_FALL_SPEED * dt;
      // 수평 흔들림 (사인파 + 개별 위상)
      this.drifts[i] += dt;
      this.ambientPositions[idx] += Math.sin(this.ambientDrifts[i] + this.drifts[i])
        * AMBIENT_DRIFT_SPEED * dt;

      // 바닥 도달 시 재배치 (상단 리스폰)
      if (this.ambientPositions[idx + 1] < -1) {
        this.ambientPositions[idx] = (Math.random() - 0.5) * AMBIENT_RANGE;
        this.ambientPositions[idx + 1] = AMBIENT_RANGE * 0.5;
        this.ambientPositions[idx + 2] = (Math.random() - 0.5) * AMBIENT_RANGE;
      }
      needsUpdate = true;
    }

    if (needsUpdate) {
      this.ambientPoints.geometry.attributes.position.needsUpdate = true;
    }
  }

  /** 네온 라이트 pulse — sin파로 강도 변동 */
  private updateNeonPulse(): void {
    const t = (this.neonElapsed / NEON_PULSE_PERIOD) * Math.PI * 2;
    const factor = NEON_PULSE_MIN + (NEON_PULSE_MAX - NEON_PULSE_MIN)
      * (0.5 + 0.5 * Math.sin(t));

    for (const light of this.neonLights) {
      // 원래 강도 × pulse 배율 — 원래 강도를 userData에 캐싱
      if (light.userData['baseIntensity'] === undefined) {
        light.userData['baseIntensity'] = light.intensity;
      }
      light.intensity = (light.userData['baseIntensity'] as number) * factor;
    }
  }
}
