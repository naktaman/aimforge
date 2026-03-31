/**
 * 타겟 관리자
 * 타겟 생성/제거/히트 판정을 중앙에서 관리
 */
import * as THREE from 'three';
import { Target, type MovementType, type MovementParams } from './Target';
import { angularDistance, isHit } from './HitDetection';
import type { HitResult } from '../utils/types';

export interface SpawnConfig {
  angularSizeDeg: number;
  distanceM: number;
  color?: number;
  movementType?: MovementType;
  movementParams?: MovementParams;
}

export class TargetManager {
  private targets: Map<string, Target> = new Map();
  private scene: THREE.Scene;
  private nextId = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** 타겟 생성 — 지정 위치에 배치 */
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

  /** 타겟 제거 */
  removeTarget(id: string): void {
    const target = this.targets.get(id);
    if (target) {
      target.removeFrom(this.scene);
      this.targets.delete(id);
    }
  }

  /** 히트 판정 — 카메라 방향에 가장 가까운 타겟 확인 */
  checkHit(
    cameraPos: THREE.Vector3,
    cameraForward: THREE.Vector3,
  ): HitResult | null {
    let closestDist = Infinity;
    let closestTarget: Target | null = null;

    for (const target of this.targets.values()) {
      const dist = angularDistance(cameraPos, cameraForward, target.position);
      if (dist < closestDist) {
        closestDist = dist;
        closestTarget = target;
      }
    }

    if (!closestTarget) return null;

    const hit = isHit(closestDist, closestTarget.angularRadius);
    return {
      hit,
      angularError: closestDist,
      targetId: closestTarget.id,
    };
  }

  /** 매 프레임 모든 타겟 업데이트 */
  update(deltaTime: number): void {
    for (const target of this.targets.values()) {
      target.update(deltaTime);
    }
  }

  /** 모든 타겟 제거 */
  clear(): void {
    for (const target of this.targets.values()) {
      target.removeFrom(this.scene);
    }
    this.targets.clear();
  }

  /** 특정 타겟 가져오기 */
  getTarget(id: string): Target | undefined {
    return this.targets.get(id);
  }

  /** 현재 활성 타겟 수 */
  getCount(): number {
    return this.targets.size;
  }
}
