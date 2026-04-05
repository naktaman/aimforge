/**
 * 사람 모양 3D 타겟 (HumanoidTarget)
 * head/torso/arms/legs 파트별 Mesh로 구성, Group으로 묶음
 * 2-tier 히트박스: head = 2x score, body = 1x score
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

/** 히트 가능한 신체 부위 */
export type BodyPart = 'head' | 'torso' | 'left_arm' | 'right_arm' | 'left_leg' | 'right_leg';

/**
 * 히트 부위 분류 (점수 배율용)
 * head: 머리 (헤드샷 2x), upper_body: 몸통+팔 (1x), lower_body: 다리 (0.75x)
 */
export type HitZoneType = 'head' | 'upper_body' | 'lower_body';

/** 히트존별 점수 배율 */
export const HIT_ZONE_MULTIPLIER: Record<HitZoneType, number> = {
  head: 2,
  upper_body: 1,
  lower_body: 0.75,
};

/** BodyPart → HitZoneType 변환 — 3구역 분리 */
export function getHitZone(part: BodyPart): HitZoneType {
  if (part === 'head') return 'head';
  if (part === 'left_leg' || part === 'right_leg') return 'lower_body';
  // torso, left_arm, right_arm → upper_body
  return 'upper_body';
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

  /** 머리 메쉬 (2x 히트존 판정용 직접 참조) */
  readonly headMesh: THREE.Mesh;

  // 히트 피드백 상태
  private hitFlashTime = 0;
  private flashedMesh: THREE.Mesh | null = null;
  private originalColor: number = 0;

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
   * 히트 시 시각 피드백 — 구역별 다른 플래시 색상
   * head: 빨강(0xff0000), upper_body: 흰색(0xffffff), lower_body: 주황(0xff8800)
   */
  onHit(mesh: THREE.Mesh, hitZone: HitZoneType): void {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    this.originalColor = mat.color.getHex();
    this.flashedMesh = mesh;

    let flashColor: number;
    if (hitZone === 'head') {
      flashColor = HIT_FLASH_COLORS.headshot; // 헤드샷: 빨강
    } else if (hitZone === 'lower_body') {
      flashColor = HIT_FLASH_COLORS.lowerBody; // 하체: 주황 (서브옵티멀 신호)
    } else {
      flashColor = HIT_FLASH_COLORS.upperBody; // 상체: 흰색
    }

    mat.color.setHex(flashColor);
    mat.emissive.setHex(flashColor);
    mat.emissiveIntensity = 1.0;
    this.hitFlashTime = HIT_FLASH_DURATION_SEC;
  }

  /** 매 프레임 업데이트 — 히트 플래시 복원 */
  update(deltaTime: number): void {
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
}
