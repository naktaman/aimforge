/**
 * 사람 모양 3D 타겟 (HumanoidTarget)
 * head/torso/arms/legs 파트별 Mesh로 구성, Group으로 묶음
 * 4-tier 히트박스: head=2.5x, upper_body=1.0x, lower_body=0.7x, limbs=0.5x
 * CapsuleGeometry 사용하지 않음 (Three.js r128 호환)
 */
import * as THREE from 'three';
import {
  HIT_FLASH_DURATION_SEC,
  HUMANOID_HEAD_RADIUS,
  HUMANOID_TORSO_SIZE,
  HUMANOID_ARM_SIZE,
  HUMANOID_LEG_SIZE,
  HUMANOID_EMISSIVE,
} from '../config/constants';
import { TARGET_COLORS, HIT_FLASH_COLORS } from '../config/theme';
import { MovementState, type MovementConfig } from './TargetMovement';

/** 히트 가능한 신체 부위 */
export type BodyPart = 'head' | 'torso' | 'left_arm' | 'right_arm' | 'left_leg' | 'right_leg';

/**
 * 히트 부위 분류 (점수 배율용) — 4구역 시스템
 * head: 머리 (2.5x), upper_body: 몸통 (1.0x),
 * lower_body: 다리 (0.7x), limbs: 팔 (0.5x)
 */
export type HitZoneType = 'head' | 'upper_body' | 'lower_body' | 'limbs';

/** 히트존별 점수 배율 */
export const HIT_ZONE_MULTIPLIER: Record<HitZoneType, number> = {
  head: 2.5,
  upper_body: 1.0,
  lower_body: 0.7,
  limbs: 0.5,
};

/** BodyPart → HitZoneType 변환 — 4구역 분리 */
export function getHitZone(part: BodyPart): HitZoneType {
  if (part === 'head') return 'head';
  if (part === 'torso') return 'upper_body';
  if (part === 'left_leg' || part === 'right_leg') return 'lower_body';
  // left_arm, right_arm → limbs
  return 'limbs';
}

/** 히트존별 플래시 색상 매핑 */
function getFlashColor(hitZone: HitZoneType): number {
  switch (hitZone) {
    case 'head': return HIT_FLASH_COLORS.headshot;
    case 'upper_body': return HIT_FLASH_COLORS.upperBody;
    case 'lower_body': return HIT_FLASH_COLORS.lowerBody;
    case 'limbs': return HIT_FLASH_COLORS.limbs;
  }
}

/**
 * 사람 모양 타겟 — Three.Group 안에 개별 Mesh 배치
 * 각 Mesh에 name 태그 부여 → Raycaster로 개별 히트 감지 가능
 * 전체 높이 ~1.8m (head top ~ leg bottom)
 */
export class HumanoidTarget {
  /** 전체 그룹 (씬에 추가/제거할 대상) */
  readonly group: THREE.Group;

  /** Raycaster 히트 판정용 메쉬 배열 */
  readonly hitMeshes: THREE.Mesh[];

  /** 머리 메쉬 (히트존 판정용 직접 참조) */
  readonly headMesh: THREE.Mesh;

  /** 움직임 상태 (null이면 정적) */
  private movementState: MovementState | null = null;

  /** 고급 움직임 상태 (B-3 Phase 2) */
  private advancedMovement: MovementState | null = null;

  // 히트 피드백 상태
  private hitFlashTime = 0;
  private flashedMesh: THREE.Mesh | null = null;
  private originalColor: number = 0;

  // 피격 파티클 씬 참조
  private particleScene: THREE.Scene | null = null;

  constructor() {
    this.group = new THREE.Group();
    this.hitMeshes = [];

    // === 머리: SphereGeometry r=0.12m (빨강 계열) ===
    const headGeo = new THREE.SphereGeometry(HUMANOID_HEAD_RADIUS, 16, 12);
    const headMat = new THREE.MeshStandardMaterial({
      color: TARGET_COLORS.flickRed,
      emissive: TARGET_COLORS.flickRed,
      emissiveIntensity: HUMANOID_EMISSIVE.head,
      roughness: 0.4,
      metalness: 0.1,
    });
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.name = 'head';
    // 머리 위치: 몸통(0.25) + 몸통높이/2(0.25) + 목 간격(0.03) + 머리반지름(0.12) = 0.65
    this.headMesh.position.set(0, 0.65, 0);
    this.group.add(this.headMesh);
    this.hitMeshes.push(this.headMesh);

    // === 몸통: BoxGeometry 0.4×0.5×0.25m (파랑 계열) ===
    const torsoGeo = new THREE.BoxGeometry(HUMANOID_TORSO_SIZE.w, HUMANOID_TORSO_SIZE.h, HUMANOID_TORSO_SIZE.d);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: TARGET_COLORS.bodyBlue,
      emissive: TARGET_COLORS.bodyBlue,
      emissiveIntensity: HUMANOID_EMISSIVE.body,
      roughness: 0.5,
      metalness: 0.1,
    });
    const torsoMesh = new THREE.Mesh(torsoGeo, bodyMat.clone());
    torsoMesh.name = 'torso';
    // 몸통 중심: y = 0.25 (바닥 0, 상단 0.5)
    torsoMesh.position.set(0, 0.25, 0);
    this.group.add(torsoMesh);
    this.hitMeshes.push(torsoMesh);

    // === 왼팔: CylinderGeometry r=0.08m h=0.45m ===
    const armGeo = new THREE.CylinderGeometry(HUMANOID_ARM_SIZE.r, HUMANOID_ARM_SIZE.r, HUMANOID_ARM_SIZE.h, 8);
    const leftArm = new THREE.Mesh(armGeo, bodyMat.clone());
    leftArm.name = 'left_arm';
    // 몸통 좌측 바깥에 배치
    leftArm.position.set(-0.28, 0.25, 0);
    this.group.add(leftArm);
    this.hitMeshes.push(leftArm);

    // === 오른팔 ===
    const rightArm = new THREE.Mesh(armGeo.clone(), bodyMat.clone());
    rightArm.name = 'right_arm';
    rightArm.position.set(0.28, 0.25, 0);
    this.group.add(rightArm);
    this.hitMeshes.push(rightArm);

    // === 왼다리: CylinderGeometry r=0.09m h=0.5m ===
    const legGeo = new THREE.CylinderGeometry(HUMANOID_LEG_SIZE.r, HUMANOID_LEG_SIZE.r, HUMANOID_LEG_SIZE.h, 8);
    const leftLeg = new THREE.Mesh(legGeo, bodyMat.clone());
    leftLeg.name = 'left_leg';
    // 몸통 아래, 좌측
    leftLeg.position.set(-0.12, -0.25, 0);
    this.group.add(leftLeg);
    this.hitMeshes.push(leftLeg);

    // === 오른다리 ===
    const rightLeg = new THREE.Mesh(legGeo.clone(), bodyMat.clone());
    rightLeg.name = 'right_leg';
    rightLeg.position.set(0.12, -0.25, 0);
    this.group.add(rightLeg);
    this.hitMeshes.push(rightLeg);
  }

  /**
   * Raycaster로 히트된 메쉬에서 BodyPart 이름 추출
   */
  static getBodyPartFromMesh(mesh: THREE.Object3D): BodyPart | null {
    const name = mesh.name;
    if (name === 'head' || name === 'torso' ||
        name === 'left_arm' || name === 'right_arm' ||
        name === 'left_leg' || name === 'right_leg') {
      return name as BodyPart;
    }
    return null;
  }

  /**
   * 움직임 패턴 설정 — 스폰 후 호출
   * @param config 움직임 설정 (static이면 움직이지 않음)
   */
  setMovement(config: MovementConfig): void {
    if (config.pattern === 'static') {
      this.movementState = null;
      return;
    }
    this.movementState = new MovementState(this.group.position.clone(), config);
  }

  /**
   * 파티클 씬 참조 설정 — 피격 파티클 표시용
   */
  setParticleScene(scene: THREE.Scene): void {
    this.particleScene = scene;
  }

  /**
   * 히트 시 시각 피드백 — 히트존별 다른 플래시 색상
   * head: 빨강, upper_body: 주황, lower_body: 주황, limbs: 노랑
   */
  onHit(mesh: THREE.Mesh, hitZone: HitZoneType): void {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    this.originalColor = mat.color.getHex();
    this.flashedMesh = mesh;

    const flashColor = getFlashColor(hitZone);
    mat.color.setHex(flashColor);
    mat.emissive.setHex(flashColor);
    mat.emissiveIntensity = 1.0;
    this.hitFlashTime = HIT_FLASH_DURATION_SEC;

    // 피격 파티클 생성
    if (this.particleScene) {
      this.spawnHitParticles(mesh.getWorldPosition(new THREE.Vector3()), flashColor);
    }
  }

  /** 고급 움직임 상태 설정 (B-3 Phase 2) */
  setAdvancedMovement(state: MovementState): void {
    this.advancedMovement = state;
  }

  /** 고급 움직임이 활성화되어 있는지 여부 */
  hasMovement(): boolean {
    return this.advancedMovement !== null || this.movementState !== null;
  }

  /** 매 프레임 업데이트 — 히트 플래시 복원 + 움직임 */
  update(deltaTime: number): void {
    // 고급 움직임 시스템 (B-3 Phase 2) — 기존 패턴보다 우선
    if (this.advancedMovement) {
      const newPos = this.advancedMovement.update(deltaTime);
      this.group.position.copy(newPos);
    }

    // 히트 플래시 복원
    if (this.hitFlashTime > 0 && this.flashedMesh) {
      this.hitFlashTime -= deltaTime;
      if (this.hitFlashTime <= 0) {
        const mat = this.flashedMesh.material as THREE.MeshStandardMaterial;
        mat.color.setHex(this.originalColor);
        mat.emissive.setHex(this.originalColor);
        // 머리는 emissive 강도 head, 나머지 부위 body 복원
        mat.emissiveIntensity = this.flashedMesh.name === 'head' ? HUMANOID_EMISSIVE.head : HUMANOID_EMISSIVE.body;
        this.flashedMesh = null;
      }
    }

    // 움직임 업데이트
    if (this.movementState) {
      const newPos = this.movementState.update(deltaTime);
      this.group.position.copy(newPos);
    }
  }

  /** 씬에서 제거 + 리소스 해제 */
  removeFrom(scene: THREE.Scene): void {
    scene.remove(this.group);
    for (const mesh of this.hitMeshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }

  /** 위치 설정 (그룹 전체 이동) */
  setPosition(pos: THREE.Vector3): void {
    this.group.position.copy(pos);
  }

  /** 카메라를 바라보도록 회전 (y축만) */
  lookAt(cameraPos: THREE.Vector3): void {
    const direction = new THREE.Vector3()
      .subVectors(cameraPos, this.group.position);
    direction.y = 0; // 수평 회전만
    if (direction.lengthSq() > 0.001) {
      const angle = Math.atan2(direction.x, direction.z);
      this.group.rotation.y = angle;
    }
  }

  /**
   * 피격 지점에 기본 파티클 스폰
   * 간단한 작은 구체 파편 6~8개, 0.3초 후 소멸
   */
  private spawnHitParticles(worldPos: THREE.Vector3, color: number): void {
    if (!this.particleScene) return;

    const particleCount = 6 + Math.floor(Math.random() * 3);
    const particles: THREE.Mesh[] = [];
    const geo = new THREE.SphereGeometry(0.015, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color });

    for (let i = 0; i < particleCount; i++) {
      const p = new THREE.Mesh(geo, mat.clone());
      p.position.copy(worldPos);
      // 랜덤 속도 방향
      p.userData['velocity'] = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 4,
      );
      p.userData['life'] = 0.3;
      this.particleScene.add(p);
      particles.push(p);
    }

    // 파티클 애니메이션 — requestAnimationFrame 기반 자체 루프
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
        vel.y -= 9.8 * dt; // 중력
        p.position.addScaledVector(vel, dt);
        // 페이드아웃
        (p.material as THREE.MeshBasicMaterial).opacity = life / 0.3;
        (p.material as THREE.MeshBasicMaterial).transparent = true;
      }
      if (!allDead) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
}
