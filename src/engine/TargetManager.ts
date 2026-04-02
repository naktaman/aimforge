/**
 * 타겟 관리자
 * 타겟 생성/제거/히트 판정을 중앙에서 관리
 * sphere + humanoid 타겟 모두 지원
 */
import * as THREE from 'three';
import { Target, type MovementType, type MovementParams } from './Target';
import { HumanoidTarget, getHitZone } from './HumanoidTarget';
import { angularDistance, isHit } from './HitDetection';
import type { HitResult, HitZone } from '../utils/types';

export interface SpawnConfig {
  angularSizeDeg: number;
  distanceM: number;
  color?: number;
  movementType?: MovementType;
  movementParams?: MovementParams;
}

/** 휴머노이드 타겟 래퍼 — Target과 동일한 인터페이스로 관리 */
export interface HumanoidEntry {
  humanoid: HumanoidTarget;
  position: THREE.Vector3;
  distanceM: number;
  angularRadius: number;
}

export class TargetManager {
  private targets: Map<string, Target> = new Map();
  /** humanoid 타겟 저장소 */
  private humanoids: Map<string, HumanoidEntry> = new Map();
  private scene: THREE.Scene;
  private nextId = 0;

  /** Raycaster (humanoid 파트별 히트 판정용) */
  private raycaster = new THREE.Raycaster();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** sphere 타겟 생성 */
  spawnTarget(position: THREE.Vector3, config: SpawnConfig): Target {
    const id = `target_${this.nextId++}`;
    const target = new Target(
      id,
      this.scene,
      position,
      config.angularSizeDeg,
      config.distanceM,
      config.color,
      config.movementType,
      config.movementParams,
    );
    this.targets.set(id, target);
    return target;
  }

  /** humanoid 타겟 생성 — 카메라를 바라보도록 배치 */
  spawnHumanoidTarget(
    position: THREE.Vector3,
    config: SpawnConfig,
    cameraPos: THREE.Vector3,
  ): { id: string; target: HumanoidTarget } {
    const id = `target_${this.nextId++}`;
    const humanoid = new HumanoidTarget();
    humanoid.setPosition(position);
    humanoid.lookAt(cameraPos);
    this.scene.add(humanoid.group);

    const DEG2RAD = Math.PI / 180;
    const angularRadius = (config.angularSizeDeg / 2) * DEG2RAD;

    this.humanoids.set(id, {
      humanoid,
      position: position.clone(),
      distanceM: config.distanceM,
      angularRadius,
    });

    return { id, target: humanoid };
  }

  /** 타겟 제거 (sphere + humanoid 모두 지원) */
  removeTarget(id: string): void {
    const target = this.targets.get(id);
    if (target) {
      target.removeFrom(this.scene);
      this.targets.delete(id);
      return;
    }
    const entry = this.humanoids.get(id);
    if (entry) {
      entry.humanoid.removeFrom(this.scene);
      this.humanoids.delete(id);
    }
  }

  /** 히트 판정 — sphere: angular distance, humanoid: Raycaster */
  checkHit(
    cameraPos: THREE.Vector3,
    cameraForward: THREE.Vector3,
  ): HitResult | null {
    // sphere 타겟 히트 판정 (기존 angular distance 로직)
    let closestDist = Infinity;
    let closestTarget: Target | null = null;

    for (const target of this.targets.values()) {
      const dist = angularDistance(cameraPos, cameraForward, target.position);
      if (dist < closestDist) {
        closestDist = dist;
        closestTarget = target;
      }
    }

    let sphereResult: HitResult | null = null;
    if (closestTarget) {
      const hit = isHit(closestDist, closestTarget.angularRadius);
      sphereResult = {
        hit,
        angularError: closestDist,
        targetId: closestTarget.id,
      };
    }

    // humanoid 타겟 히트 판정 (Raycaster로 개별 mesh 감지)
    let humanoidResult: HitResult | null = null;
    if (this.humanoids.size > 0) {
      this.raycaster.set(cameraPos, cameraForward.clone().normalize());

      // 모든 humanoid 메쉬 수집
      const allMeshes: THREE.Mesh[] = [];
      for (const entry of this.humanoids.values()) {
        allMeshes.push(...entry.humanoid.hitMeshes);
      }

      const intersects = this.raycaster.intersectObjects(allMeshes, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;

        // 어느 humanoid의 mesh인지 찾기
        for (const [id, entry] of this.humanoids.entries()) {
          if (entry.humanoid.hitMeshes.includes(hitMesh)) {
            const bodyPart = HumanoidTarget.getBodyPartFromMesh(hitMesh);
            const hitZone: HitZone = bodyPart ? getHitZone(bodyPart) : 'body';
            const angError = angularDistance(cameraPos, cameraForward, entry.position);

            humanoidResult = {
              hit: true,
              angularError: angError,
              targetId: id,
              hitZone,
            };
            break;
          }
        }
      } else {
        // Raycaster 미스 — 가장 가까운 humanoid 기준 angular error 반환
        let closestHumanoidDist = Infinity;
        let closestHumanoidId = '';
        for (const [id, entry] of this.humanoids.entries()) {
          const dist = angularDistance(cameraPos, cameraForward, entry.position);
          if (dist < closestHumanoidDist) {
            closestHumanoidDist = dist;
            closestHumanoidId = id;
          }
        }
        if (closestHumanoidId) {
          humanoidResult = {
            hit: false,
            angularError: closestHumanoidDist,
            targetId: closestHumanoidId,
          };
        }
      }
    }

    // 둘 다 있으면 히트된 쪽 우선, 둘 다 히트면 더 가까운 쪽
    if (sphereResult && humanoidResult) {
      if (sphereResult.hit && !humanoidResult.hit) return sphereResult;
      if (!sphereResult.hit && humanoidResult.hit) return humanoidResult;
      return sphereResult.angularError <= humanoidResult.angularError
        ? sphereResult
        : humanoidResult;
    }
    return sphereResult ?? humanoidResult;
  }

  /** 매 프레임 모든 타겟 업데이트 */
  update(deltaTime: number): void {
    for (const target of this.targets.values()) {
      target.update(deltaTime);
    }
    for (const entry of this.humanoids.values()) {
      entry.humanoid.update(deltaTime);
    }
  }

  /** 모든 타겟 제거 */
  clear(): void {
    for (const target of this.targets.values()) {
      target.removeFrom(this.scene);
    }
    this.targets.clear();
    for (const entry of this.humanoids.values()) {
      entry.humanoid.removeFrom(this.scene);
    }
    this.humanoids.clear();
  }

  /** 타겟 위치 업데이트 — sphere + humanoid 모두 지원 */
  updateTargetPosition(id: string, newPos: THREE.Vector3): void {
    const target = this.targets.get(id);
    if (target) {
      target.position.copy(newPos);
      target.mesh.position.copy(newPos);
      return;
    }
    const entry = this.humanoids.get(id);
    if (entry) {
      entry.position.copy(newPos);
      entry.humanoid.setPosition(newPos);
    }
  }

  /** 특정 타겟 가져오기 (sphere 전용) */
  getTarget(id: string): Target | undefined {
    return this.targets.get(id);
  }

  /** 특정 humanoid 엔트리 가져오기 */
  getHumanoid(id: string): HumanoidEntry | undefined {
    return this.humanoids.get(id);
  }

  /** 타겟 위치 가져오기 (sphere + humanoid 통합) */
  getTargetPosition(id: string): THREE.Vector3 | undefined {
    const target = this.targets.get(id);
    if (target) return target.position;
    const entry = this.humanoids.get(id);
    if (entry) return entry.position;
    return undefined;
  }

  /** 타겟 angular radius 가져오기 (sphere + humanoid 통합) */
  getTargetAngularRadius(id: string): number {
    const target = this.targets.get(id);
    if (target) return target.angularRadius;
    const entry = this.humanoids.get(id);
    if (entry) return entry.angularRadius;
    return 0;
  }

  /** 현재 활성 타겟 수 */
  getCount(): number {
    return this.targets.size + this.humanoids.size;
  }
}
