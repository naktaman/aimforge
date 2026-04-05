/**
 * 3D 타겟 클래스
 * SphereGeometry로 렌더링, 거리에 따른 물리적 크기 자동 계산
 */
import * as THREE from 'three';
import { DEG2RAD } from '../utils/physics';
import { HIT_FLASH_DURATION_SEC, HIT_EMISSIVE_INTENSITY } from '../config/constants';
import { TARGET_COLORS, HIT_FLASH_COLORS } from '../config/theme';

/** 타겟 이동 패턴 */
export type MovementType = 'static' | 'linear' | 'circular' | 'random';

/** 이동 파라미터 */
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

export class Target {
  mesh: THREE.Mesh;
  id: string;
  position: THREE.Vector3;
  radiusM: number;      // 물리적 반지름 (미터)
  angularRadius: number; // 각도 반지름 (라디안)
  distanceM: number;

  movementType: MovementType;
  movementParams: MovementParams;

  // 이동 내부 상태
  private orbitAngle = 0;
  private timeSinceChange = 0;
  private currentDirection: THREE.Vector3;

  // 히트 피드백 상태
  private hitFlashTime = 0;
  private originalColor: number;

  constructor(
    id: string,
    scene: THREE.Scene,
    position: THREE.Vector3,
    angularSizeDeg: number,
    distanceM: number,
    color: number = TARGET_COLORS.flickRed,
    movementType: MovementType = 'static',
    movementParams: MovementParams = {},
  ) {
    this.id = id;
    this.distanceM = distanceM;
    this.position = position.clone();
    this.movementType = movementType;
    this.movementParams = movementParams;
    this.originalColor = color;
    this.currentDirection = movementParams.direction?.clone() ?? new THREE.Vector3(1, 0, 0);

    // 각도 크기 → 물리적 반지름 변환
    // radius = distance × tan(angularRadius)
    this.angularRadius = (angularSizeDeg / 2) * DEG2RAD;
    this.radiusM = distanceM * Math.tan(this.angularRadius);

    // SphereGeometry + MeshStandardMaterial
    const geometry = new THREE.SphereGeometry(this.radiusM, 24, 16);
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

  /** 매 프레임 위치 업데이트 */
  update(deltaTime: number): void {
    // 히트 플래시 복원 (300ms 후)
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

  /** 히트 시 시각 피드백 (초록색 플래시) */
  onHit(): void {
    const mat = this.mesh.material as THREE.MeshStandardMaterial;
    mat.color.setHex(HIT_FLASH_COLORS.default);
    mat.emissive.setHex(HIT_FLASH_COLORS.default);
    mat.emissiveIntensity = HIT_EMISSIVE_INTENSITY;
    this.hitFlashTime = HIT_FLASH_DURATION_SEC;
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

  // === 이동 패턴 ===

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
    this.position.y = center.y + Math.sin(this.orbitAngle) * radius * 0.3; // 약간의 수직 변동
    this.position.z = center.z;
    this.mesh.position.copy(this.position);
  }

  private updateRandom(dt: number): void {
    const speed = this.movementParams.speed ?? 3;
    const interval = this.movementParams.changeInterval ?? 1.5;

    this.timeSinceChange += dt;
    if (this.timeSinceChange >= interval) {
      this.timeSinceChange = 0;
      // 랜덤 방향 변경
      this.currentDirection.set(
        Math.random() * 2 - 1,
        Math.random() * 0.5 - 0.25,
        Math.random() * 2 - 1,
      ).normalize();
    }

    this.position.addScaledVector(this.currentDirection, speed * dt);
    this.mesh.position.copy(this.position);
  }
}
