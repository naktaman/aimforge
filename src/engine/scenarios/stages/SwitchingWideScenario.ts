/**
 * Wide Multi-target Switching 시나리오 (60-150° 간격)
 * 넓은 시야 전환 — 배틀로얄 멀티킬, 사이트 크로스 체크
 * 타겟이 넓게 퍼져 있어 큰 팔 움직임 + 정밀 착지 필요
 * 독립 DNA 축: switching_wide_score
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import type { SwitchingStageConfig } from '../../../utils/types';
import { DEG2RAD } from '../../../utils/physics';
import { STAGE_COLORS } from '../../../config/theme';

/** 개별 타겟 결과 */
interface SwitchTarget {
  hit: boolean;
  switchTimeMs: number;
  angularDistanceDeg: number;
  waveIndex: number;
  targetIndex: number;
}

export class SwitchingWideScenario extends Scenario {
  private config: SwitchingStageConfig;
  private currentWave = 0;
  private activeTargetIds: string[] = [];
  private targetPositions: THREE.Vector3[] = [];
  private results: SwitchTarget[] = [];
  private completed = false;
  private distance = 15;

  private waveStartTime = 0;
  private lastKillTime = 0;
  private killsInWave = 0;
  private lastKilledPosition: THREE.Vector3 | null = null;
  private waveTimeLimitMs = 12000; // 넓은 전환은 12초

  // 타이머 정리용
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(engine: GameEngine, targetManager: TargetManager, config: SwitchingStageConfig) {
    super(engine, targetManager);
    this.config = config;
    // Wide: 강제 60-150° 간격
    if (config.separationRange[0] < 60) config.separationRange[0] = 60;
    if (config.separationRange[1] > 150) config.separationRange[1] = 150;
  }

  setOnComplete(cb: (results: unknown) => void): void {
    this.onCompleteCallback = cb;
  }

  start(): void {
    this.currentWave = 0;
    this.completed = false;
    this.results = [];
    this.spawnWave();
  }

  update(_deltaTime: number): void {
    if (this.completed) return;

    const elapsed = performance.now() - this.waveStartTime;
    if (elapsed >= this.waveTimeLimitMs && this.activeTargetIds.length > 0) {
      // 남은 타겟 미스 처리
      for (let i = 0; i < this.activeTargetIds.length; i++) {
        this.results.push({
          hit: false,
          switchTimeMs: this.waveTimeLimitMs,
          angularDistanceDeg: 0,
          waveIndex: this.currentWave,
          targetIndex: this.killsInWave + i,
        });
      }
      this.clearWave();
      this.advanceWave();
    }
  }

  onClick(): void {
    if (this.completed || this.activeTargetIds.length === 0) return;

    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);

    const now = performance.now();
    const switchTime = this.killsInWave === 0
      ? now - this.waveStartTime
      : now - this.lastKillTime;

    if (hitResult?.hit && hitResult.targetId) {
      const targetIdx = this.activeTargetIds.indexOf(hitResult.targetId);
      if (targetIdx !== -1) {
        // 이전 타겟과의 각도 거리 계산
        let angularDist = 0;
        if (this.lastKilledPosition) {
          const targetPos = this.targetPositions[targetIdx];
          const toLastKill = this.lastKilledPosition.clone().sub(camera.position).normalize();
          const toTarget = targetPos.clone().sub(camera.position).normalize();
          angularDist = Math.acos(Math.min(1, toLastKill.dot(toTarget))) * (180 / Math.PI);
        }

        this.results.push({
          hit: true,
          switchTimeMs: switchTime,
          angularDistanceDeg: angularDist,
          waveIndex: this.currentWave,
          targetIndex: this.killsInWave,
        });

        this.lastKilledPosition = this.targetPositions[targetIdx].clone();
        this.targetManager.removeTarget(hitResult.targetId);
        this.activeTargetIds.splice(targetIdx, 1);
        this.targetPositions.splice(targetIdx, 1);
        this.lastKillTime = now;
        this.killsInWave++;

        if (this.activeTargetIds.length === 0) {
          this.advanceWave();
        }
      }
    } else {
      this.results.push({
        hit: false,
        switchTimeMs: switchTime,
        angularDistanceDeg: 0,
        waveIndex: this.currentWave,
        targetIndex: this.killsInWave,
      });
    }
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): unknown {
    const hits = this.results.filter((r) => r.hit);
    const accuracy = this.results.length > 0 ? hits.length / this.results.length : 0;
    const avgSwitchTime = hits.length > 0
      ? hits.reduce((s, r) => s + r.switchTimeMs, 0) / hits.length
      : 9999;
    const avgAngularDist = hits.filter((r) => r.angularDistanceDeg > 0).length > 0
      ? hits.filter((r) => r.angularDistanceDeg > 0)
        .reduce((s, r) => s + r.angularDistanceDeg, 0)
        / hits.filter((r) => r.angularDistanceDeg > 0).length
      : 0;

    // 점수: 정확도 35% + 스위치 속도 35% + 각도 대비 효율 30%
    const speedScore = Math.max(0, 1 - avgSwitchTime / 3000);
    // 각도 효율: 큰 각도를 빠르게 전환할수록 높은 점수
    const angleEfficiency = avgAngularDist > 0
      ? Math.max(0, 1 - (avgSwitchTime / avgAngularDist) / 50) // ms/도 기준
      : 0;
    const score = accuracy * 35 + speedScore * 35 + angleEfficiency * 30;

    return {
      stageType: 'switching_wide' as const,
      category: 'switching' as const,
      score,
      accuracy,
      avgSwitchTimeMs: avgSwitchTime,
      avgAngularDistanceDeg: avgAngularDist,
      totalTargets: this.results.length,
      hits: hits.length,
      waveCount: this.config.waveCount,
      trials: this.results,
    };
  }

  /** 웨이브 스폰 — 넓게 퍼진 타겟 */
  private spawnWave(): void {
    const targetsPerWave = this.config.targetsPerWave;
    const [minSep, maxSep] = this.config.separationRange;

    this.activeTargetIds = [];
    this.targetPositions = [];
    this.killsInWave = 0;
    this.waveStartTime = performance.now();
    this.lastKillTime = performance.now();
    this.lastKilledPosition = null;

    // 타겟 위치 — 카메라 기준 넓게 분산
    const camera = this.engine.getCamera();
    const cameraPos = camera.position.clone();
    const totalArc = minSep + Math.random() * (maxSep - minSep);
    const startAzimuth = Math.random() * Math.PI * 2;

    for (let i = 0; i < targetsPerWave; i++) {
      const azimuth = startAzimuth + (i / (targetsPerWave - 1 || 1)) * totalArc * DEG2RAD;
      const elevation = (Math.random() - 0.5) * 25 * DEG2RAD;

      // 카메라 로컬 공간에서 방향 계산
      const localDir = new THREE.Vector3(
        Math.sin(azimuth),
        Math.sin(elevation) * 0.3,
        -Math.cos(azimuth),
      ).normalize();
      const worldDir = localDir.applyQuaternion(camera.quaternion);
      const pos = cameraPos.clone().addScaledVector(worldDir, this.distance);

      const target = this.targetManager.spawnTarget(
        pos.clone(),
        {
          angularSizeDeg: this.config.difficulty.targetSizeDeg,
          distanceM: this.distance,
          color: STAGE_COLORS.switchingWide,
        },
      );
      this.activeTargetIds.push(target.id);
      this.targetPositions.push(pos);
    }
  }

  private clearWave(): void {
    for (const id of this.activeTargetIds) {
      this.targetManager.removeTarget(id);
    }
    this.activeTargetIds = [];
    this.targetPositions = [];
  }

  private advanceWave(): void {
    this.currentWave++;
    if (this.currentWave >= this.config.waveCount) {
      this.completed = true;
      if (this.onCompleteCallback) this.onCompleteCallback(this.getResults());
    } else {
      this.pendingTimeout = setTimeout(() => this.spawnWave(), 600 + Math.random() * 400);
    }
  }

  /** 리소스 정리 — 타이머 해제 */
  dispose(): void {
    if (this.pendingTimeout !== null) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
    super.dispose();
  }
}
