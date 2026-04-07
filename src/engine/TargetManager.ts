/**
 * 타겟 관리자
 * 타겟 생성/제거/히트 판정을 중앙에서 관리
 * sphere/cube + humanoid 타겟 모두 지원
 * TargetConfig 기반 확장 스폰 + 프리셋 지원
 */
import * as THREE from 'three';
import { Target, type MovementType, type MovementParams, type TargetConfig, type TargetShape } from './Target';
import { HumanoidTarget, getHitZone } from './HumanoidTarget';
import { angularDistance, isHit } from './HitDetection';
import type { HitResult, HitZone } from '../utils/types';
import type { TargetPresetName } from './TargetPresets';
import { getTargetPreset } from './TargetPresets';

/** 기존 SpawnConfig (하위 호환) */
export interface SpawnConfig {
  angularSizeDeg: number;
  distanceM: number;
  color?: number;
  movementType?: MovementType;
  movementParams?: MovementParams;
  /** 타겟 형상 (기본: sphere) */
  shape?: TargetShape;
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

  /** sphere/cube 타겟 생성 */
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
      config.shape,
    );
    this.targets.set(id, target);
    return target;
  }

  /**
   * TargetConfig 기반 확장 스폰 — 새 움직임 시스템 + 형상 지원
   * humanoid가 아닌 sphere/cube 타겟용
   */
  spawnFromConfig(position: THREE.Vector3, config: TargetConfig): Target {
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
      config.shape,
    );
    // 새 움직임 시스템 적용
    if (config.movement) {
      target.setMovement(config.movement);
    }
    // 파티클 씬 연결
    target.setParticleScene(this.scene);
    this.targets.set(id, target);
    return target;
  }

  /**
   * 프리셋 이름으로 타겟 스폰
   * humanoid/sphere 자동 분기
   */
  spawnFromPreset(
    position: THREE.Vector3,
    presetName: TargetPresetName,
    cameraPos?: THREE.Vector3,
  ): { id: string; target: Target | HumanoidTarget } | null {
    const preset = getTargetPreset(presetName);
    if (!preset) return null;

    if (preset.isHumanoid) {
      const cam = cameraPos ?? new THREE.Vector3(0, 1.6, 0);
      const result = this.spawnHumanoidFromConfig(position, preset.config, cam);
      return { id: result.id, target: result.target };
    }

    const target = this.spawnFromConfig(position, preset.config);
    return { id: target.id, target };
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
    humanoid.setParticleScene(this.scene);
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

  /**
   * TargetConfig 기반 humanoid 스폰 — 움직임 시스템 적용
   */
  spawnHumanoidFromConfig(
    position: THREE.Vector3,
    config: TargetConfig,
    cameraPos: THREE.Vector3,
  ): { id: string; target: HumanoidTarget } {
    const id = `target_${this.nextId++}`;
    const humanoid = new HumanoidTarget();
    humanoid.setPosition(position);
    humanoid.lookAt(cameraPos);
    humanoid.setParticleScene(this.scene);

    // 움직임 설정
    if (config.movement) {
      humanoid.setMovement(config.movement);
    }

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
            const hitZone: HitZone = bodyPart ? getHitZone(bodyPart) : 'upper_body';
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
      // 움직임 후 위치 동기화 (히트 판정용)
      entry.position.copy(entry.humanoid.group.position);
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
