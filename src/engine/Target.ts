/**
 * 3D 타겟 클래스
 * SphereGeometry/BoxGeometry로 렌더링, 거리에 따른 물리적 크기 자동 계산
 * TargetConfig를 통한 확장된 설정 지원
 */
import * as THREE from 'three';
import { DEG2RAD } from '../utils/physics';
import { HIT_FLASH_DURATION_SEC, HIT_EMISSIVE_INTENSITY } from '../config/constants';
import { TARGET_COLORS, HIT_FLASH_COLORS } from '../config/theme';
import { MovementState, type MovementConfig } from './TargetMovement';

/** 타겟 형상 유형 */
export type TargetShape = 'sphere' | 'cube';

/** 이동 패턴 (하위 호환용 — 새 코드는 MovementConfig 사용 권장) */
export type MovementType = 'static' | 'linear' | 'circular' | 'random';

/** 이동 파라미터 (하위 호환용) */
export interface MovementParams {
  /** 이동 속도 (m/s) */
  speed?: number;
  /** 이동 방향 벡터 */
  direction?: THREE.Vector3;
  /** 원형 궤도 중심 */
  orbitCenter?: THREE.Vector3;
  /** 원형 궤도 반지름 */
  orbitRadius?: number;
  /** 방향 전환 간격 (초) */
  changeInterval?: number;
}

/**
 * 확장된 타겟 설정 인터페이스
 * 크기, 색상, 유형, 스폰 패턴, 움직임 파라미터 통합
 */
export interface TargetConfig {
  /** 타겟 크기 — 시각각(도) 기준 */
  angularSizeDeg: number;
  /** 타겟까지 거리 (m) */
  distanceM: number;
  /** 타겟 형상 (기본: sphere) */
  shape?: TargetShape;
  /** 타겟 색상 (Three.js hex) */
  color?: number;
  /** 움직임 설정 (새 시스템) */
  movement?: MovementConfig;
  /** 레거시 이동 타입 (하위 호환) */
  movementType?: MovementType;
  /** 레거시 이동 파라미터 (하위 호환) */
  movementParams?: MovementParams;
}

export class Target {
  mesh: THREE.Mesh;
  id: string;
  position: THREE.Vector3;
  radiusM: number;      // 물리적 반지름 (미터)
  angularRadius: number; // 각도 반지름 (라디안)
  distanceM: number;

  /** 레거시 이동 (하위 호환) */
  movementType: MovementType;
  movementParams: MovementParams;

  /** 새 움직임 시스템 */
  private movementState: MovementState | null = null;

  // 레거시 이동 내부 상태
  private orbitAngle = 0;
  private timeSinceChange = 0;
  private currentDirection: THREE.Vector3;

  // 히트 피드백 상태
  private hitFlashTime = 0;
  private originalColor: number;

  // 파티클 씬 참조
  private particleScene: THREE.Scene | null = null;

  constructor(
    id: string,
    scene: THREE.Scene,
    position: THREE.Vector3,
    angularSizeDeg: number,
    distanceM: number,
    color: number = TARGET_COLORS.flickRed,
    movementType: MovementType = 'static',
    movementParams: MovementParams = {},
    shape: TargetShape = 'sphere',
  ) {
    this.id = id;
    this.distanceM = distanceM;
    this.position = position.clone();
    this.movementType = movementType;
    this.movementParams = movementParams;
    this.originalColor = color;
    this.currentDirection = movementParams.direction?.clone() ?? new THREE.Vector3(1, 0, 0);

    // 각도 크기 → 물리적 반지름 변환
    this.angularRadius = (angularSizeDeg / 2) * DEG2RAD;
    this.radiusM = distanceM * Math.tan(this.angularRadius);

    // 형상에 따라 Geometry 선택
    const geometry = shape === 'cube'
      ? new THREE.BoxGeometry(this.radiusM * 2, this.radiusM * 2, this.radiusM * 2)
      : new THREE.SphereGeometry(this.radiusM, 24, 16);

    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      metalness: 0.1,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    scene.add(this.mesh);
  }

  /** 새 움직임 시스템 설정 */
  setMovement(config: MovementConfig): void {
    if (config.pattern === 'static') {
      this.movementState = null;
      return;
    }
    this.movementState = new MovementState(this.position.clone(), config);
  }

  /** 파티클 씬 참조 설정 */
  setParticleScene(scene: THREE.Scene): void {
    this.particleScene = scene;
  }

  /** 매 프레임 위치 업데이트 */
  update(deltaTime: number): void {
    // 히트 플래시 복원
    if (this.hitFlashTime > 0) {
      this.hitFlashTime -= deltaTime;
      if (this.hitFlashTime <= 0) {
        (this.mesh.material as THREE.MeshStandardMaterial).color.setHex(
          this.originalColor,
        );
        (this.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(
          this.originalColor,
        );
      }
    }

    // 새 움직임 시스템 우선
    if (this.movementState) {
      const newPos = this.movementState.update(deltaTime);
      this.position.copy(newPos);
      this.mesh.position.copy(newPos);
      return;
    }

    // 레거시 이동 패턴
    switch (this.movementType) {
      case 'linear':
        this.updateLinear(deltaTime);
        break;
      case 'circular':
        this.updateCircular(deltaTime);
        break;
      case 'random':
        this.updateRandom(deltaTime);
        break;
      case 'static':
      default:
        break;
    }
  }

  /** 히트 시 시각 피드백 (색상 플래시 + 파티클) */
  onHit(): void {
    const mat = this.mesh.material as THREE.MeshStandardMaterial;
    mat.color.setHex(HIT_FLASH_COLORS.default);
    mat.emissive.setHex(HIT_FLASH_COLORS.default);
    mat.emissiveIntensity = HIT_EMISSIVE_INTENSITY;
    this.hitFlashTime = HIT_FLASH_DURATION_SEC;

    // 파티클 생성
    if (this.particleScene) {
      this.spawnHitParticles();
    }
  }

  /** 씬에서 제거 */
  removeFrom(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
    (this.mesh.material as THREE.Material).dispose();
  }

  /** 물리적 반지름 = distance × tan(angularSize/2) */
  static calculatePhysicalRadius(
    distanceM: number,
    angularSizeDeg: number,
  ): number {
    return distanceM * Math.tan((angularSizeDeg / 2) * DEG2RAD);
  }

  // === 레거시 이동 패턴 (하위 호환) ===

  private updateLinear(dt: number): void {
    const speed = this.movementParams.speed ?? 5;
    this.position.addScaledVector(this.currentDirection, speed * dt);
    this.mesh.position.copy(this.position);
  }

  private updateCircular(dt: number): void {
    const speed = this.movementParams.speed ?? 2;
    const center = this.movementParams.orbitCenter ?? new THREE.Vector3(0, 1.6, -10);
    const radius = this.movementParams.orbitRadius ?? 5;

    this.orbitAngle += speed * dt;
    this.position.x = center.x + Math.cos(this.orbitAngle) * radius;
    this.position.y = center.y + Math.sin(this.orbitAngle) * radius * 0.3;
    this.position.z = center.z;
    this.mesh.position.copy(this.position);
  }

  private updateRandom(dt: number): void {
    const speed = this.movementParams.speed ?? 3;
    const interval = this.movementParams.changeInterval ?? 1.5;

    this.timeSinceChange += dt;
    if (this.timeSinceChange >= interval) {
      this.timeSinceChange = 0;
      this.currentDirection.set(
        Math.random() * 2 - 1,
        Math.random() * 0.5 - 0.25,
        Math.random() * 2 - 1,
      ).normalize();
    }

    this.position.addScaledVector(this.currentDirection, speed * dt);
    this.mesh.position.copy(this.position);
  }

  /** 피격 파티클 생성 — 간단한 구체 파편 */
  private spawnHitParticles(): void {
    if (!this.particleScene) return;

    const particleCount = 5 + Math.floor(Math.random() * 3);
    const particles: THREE.Mesh[] = [];
    const geo = new THREE.SphereGeometry(0.012, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color: HIT_FLASH_COLORS.default });

    for (let i = 0; i < particleCount; i++) {
      const p = new THREE.Mesh(geo, mat.clone());
      p.position.copy(this.position);
      p.userData['velocity'] = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 2 + 0.5,
        (Math.random() - 0.5) * 3,
      );
      p.userData['life'] = 0.25;
      this.particleScene.add(p);
      particles.push(p);
    }

    const scene = this.particleScene;
    let lastTime = performance.now();
    const animate = (): void => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      let allDead = true;
      for (const p of particles) {
        const life = (p.userData['life'] as number) - dt;
        p.userData['life'] = life;
        if (life <= 0) {
          scene.remove(p);
          p.geometry.dispose();
          (p.material as THREE.Material).dispose();
          continue;
        }
        allDead = false;
        const vel = p.userData['velocity'] as THREE.Vector3;
        vel.y -= 9.8 * dt;
        p.position.addScaledVector(vel, dt);
        (p.material as THREE.MeshBasicMaterial).opacity = life / 0.25;
        (p.material as THREE.MeshBasicMaterial).transparent = true;
      }
      if (!allDead) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
}
