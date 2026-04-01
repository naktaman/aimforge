/**
 * Close Multi-target Switching 시나리오 (15-45° 간격)
 * 근접 타겟 간 빠른 전환 — CS2 사이트 정리, Valorant 러시 차단
 * 2-4개 타겟이 좁은 범위에 동시 출현, 순서대로 처치
 * 독립 DNA 축: switching_close_score
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import type { SwitchingStageConfig } from '../../../utils/types';
import { DEG2RAD } from '../../../utils/physics';

/** 개별 타겟 결과 */
interface SwitchTarget {
  hit: boolean;
  switchTimeMs: number;
  angularDistanceDeg: number;
  waveIndex: number;
  targetIndex: number;
  reactionMs: number;
}

export class SwitchingCloseScenario extends Scenario {
  private config: SwitchingStageConfig;
  private currentWave = 0;
  private activeTargetIds: string[] = [];
  private results: SwitchTarget[] = [];
  private completed = false;
  private distance = 12;

  private waveStartTime = 0;
  private lastKillTime = 0;
  private killsInWave = 0;
  private previousTargetAngle = 0;
  private waveTimeLimitMs = 8000; // 웨이브당 8초

  // 타이머 정리용
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(engine: GameEngine, targetManager: TargetManager, config: SwitchingStageConfig) {
    super(engine, targetManager);
    this.config = config;
    // Close: 강제 15-45° 간격
    if (config.separationRange[0] < 15) config.separationRange[0] = 15;
    if (config.separationRange[1] > 45) config.separationRange[1] = 45;
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

    // 웨이브 타임아웃 체크
    const elapsed = performance.now() - this.waveStartTime;
    if (elapsed >= this.waveTimeLimitMs && this.activeTargetIds.length > 0) {
      // 남은 타겟은 미스 처리
      for (let i = this.killsInWave; i < this.activeTargetIds.length + this.killsInWave; i++) {
        this.results.push({
          hit: false,
          switchTimeMs: this.waveTimeLimitMs,
          angularDistanceDeg: 0,
          waveIndex: this.currentWave,
          targetIndex: i,
          reactionMs: this.waveTimeLimitMs,
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
      // 타겟 히트
      const targetIdx = this.activeTargetIds.indexOf(hitResult.targetId);
      if (targetIdx !== -1) {
        // 전환 각도 계산
        const angularDist = hitResult.angularError * (180 / Math.PI);

        this.results.push({
          hit: true,
          switchTimeMs: switchTime,
          angularDistanceDeg: this.previousTargetAngle,
          waveIndex: this.currentWave,
          targetIndex: this.killsInWave,
          reactionMs: switchTime,
        });

        // 타겟 제거
        this.targetManager.removeTarget(hitResult.targetId);
        this.activeTargetIds.splice(targetIdx, 1);
        this.previousTargetAngle = angularDist;
        this.lastKillTime = now;
        this.killsInWave++;

        // 웨이브 내 모든 타겟 처치
        if (this.activeTargetIds.length === 0) {
          this.advanceWave();
        }
      }
    } else {
      // 미스 기록
      this.results.push({
        hit: false,
        switchTimeMs: switchTime,
        angularDistanceDeg: this.previousTargetAngle,
        waveIndex: this.currentWave,
        targetIndex: this.killsInWave,
        reactionMs: switchTime,
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

    // 점수: 정확도 40% + 스위치 속도 40% + 일관성 20%
    const speedScore = Math.max(0, 1 - avgSwitchTime / 2000);
    // 일관성: 스위치 시간 표준편차
    const switchTimes = hits.map((r) => r.switchTimeMs);
    const mean = avgSwitchTime;
    const variance = switchTimes.length > 1
      ? switchTimes.reduce((s, t) => s + (t - mean) ** 2, 0) / (switchTimes.length - 1)
      : 0;
    const consistency = Math.max(0, 1 - Math.sqrt(variance) / 1000);

    const score = accuracy * 40 + speedScore * 40 + consistency * 20;

    return {
      stageType: 'switching_close' as const,
      category: 'switching' as const,
      score,
      accuracy,
      avgSwitchTimeMs: avgSwitchTime,
      consistency,
      totalTargets: this.results.length,
      hits: hits.length,
      waveCount: this.config.waveCount,
      trials: this.results,
    };
  }

  /** 웨이브 스폰 */
  private spawnWave(): void {
    const targetsPerWave = this.config.targetsPerWave;
    const [minSep, maxSep] = this.config.separationRange;

    this.activeTargetIds = [];
    this.killsInWave = 0;
    this.waveStartTime = performance.now();
    this.lastKillTime = performance.now();
    this.previousTargetAngle = 0;

    // 타겟 위치 생성 — 좁은 범위에 클러스터링
    const baseAzimuth = Math.random() * Math.PI * 2;
    for (let i = 0; i < targetsPerWave; i++) {
      const sep = minSep + Math.random() * (maxSep - minSep);
      const azimuth = baseAzimuth + (i - targetsPerWave / 2) * sep * DEG2RAD;
      const elevation = (Math.random() - 0.5) * 20 * DEG2RAD;

      const x = Math.sin(azimuth) * this.distance;
      const y = 1.6 + Math.sin(elevation) * this.distance * 0.2;
      const z = -Math.cos(azimuth) * this.distance;

      const target = this.targetManager.spawnTarget(
        new THREE.Vector3(x, y, z),
        {
          angularSizeDeg: this.config.difficulty.targetSizeDeg,
          distanceM: this.distance,
          color: 0xfdcb6e,
        },
      );
      this.activeTargetIds.push(target.id);
    }
  }

  /** 웨이브 클리어 */
  private clearWave(): void {
    for (const id of this.activeTargetIds) {
      this.targetManager.removeTarget(id);
    }
    this.activeTargetIds = [];
  }

  /** 다음 웨이브 또는 종료 */
  private advanceWave(): void {
    this.currentWave++;
    if (this.currentWave >= this.config.waveCount) {
      this.completed = true;
      if (this.onCompleteCallback) this.onCompleteCallback(this.getResults());
    } else {
      this.pendingTimeout = setTimeout(() => this.spawnWave(), 500 + Math.random() * 300);
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
