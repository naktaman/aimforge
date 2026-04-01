/**
 * Medium Flick 시나리오 (30-60°)
 * 손목 조작 영역 — 실제 FPS에서 가장 빈번한 플릭 거리
 * Composite 가중치 최고, DNA에서 핵심 축
 * 독립 DNA 축: flick_medium_score
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import type { FlickStageConfig } from '../../../utils/types';
import { DEG2RAD } from '../../../utils/physics';

/** 개별 타겟 결과 */
interface MediumFlickTrial {
  hit: boolean;
  tttMs: number;
  angleDeg: number;
  overshootDeg: number;
  correctionCount: number;
  settleTimeMs: number;
  pathEfficiency: number;
}

export class FlickMediumScenario extends Scenario {
  private config: FlickStageConfig;
  private targetIndex = 0;
  private currentTargetId: string | null = null;
  private targetAppearTime = 0;
  private targetAngleDeg = 0;
  private completed = false;
  private trials: MediumFlickTrial[] = [];
  private distance = 12;

  // 궤적 추적
  private trajectory: Array<{ t: number; error: number }> = [];
  private minAngularError = Infinity;
  private correctionCount = 0;
  private wasApproaching = true;
  private firstOnTargetTime: number | null = null;

  // 타이머 정리용
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(engine: GameEngine, targetManager: TargetManager, config: FlickStageConfig) {
    super(engine, targetManager);
    this.config = config;
    // Medium: 강제 30-60° 범위
    if (config.angleRange[0] < 30) config.angleRange[0] = 30;
    if (config.angleRange[1] > 60) config.angleRange[1] = 60;
  }

  setOnComplete(cb: (results: unknown) => void): void {
    this.onCompleteCallback = cb;
  }

  start(): void {
    this.targetIndex = 0;
    this.completed = false;
    this.trials = [];
    this.spawnNext();
  }

  update(_deltaTime: number): void {
    if (this.completed || !this.currentTargetId) return;

    const elapsed = performance.now() - this.targetAppearTime;
    if (elapsed >= this.config.timeoutMs) {
      this.recordMiss();
      this.advanceOrFinish();
      return;
    }

    // 궤적 기록 + 오버슛 추적
    this.trackTrajectory();
  }

  onClick(): void {
    if (this.completed || !this.currentTargetId) return;

    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);

    const ttt = performance.now() - this.targetAppearTime;
    const overshootDeg = this.calculateOvershoot();
    const settleTime = this.firstOnTargetTime
      ? (performance.now() - this.firstOnTargetTime)
      : 0;
    const pathEfficiency = this.calculatePathEfficiency();

    this.trials.push({
      hit: hitResult?.hit ?? false,
      tttMs: ttt,
      angleDeg: this.targetAngleDeg,
      overshootDeg,
      correctionCount: this.correctionCount,
      settleTimeMs: settleTime,
      pathEfficiency,
    });

    this.advanceOrFinish();
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): unknown {
    const hits = this.trials.filter((t) => t.hit);
    const accuracy = this.trials.length > 0 ? hits.length / this.trials.length : 0;
    const avgTtt = hits.length > 0
      ? hits.reduce((s, t) => s + t.tttMs, 0) / hits.length
      : this.config.timeoutMs;
    const avgOvershoot = hits.length > 0
      ? hits.reduce((s, t) => s + t.overshootDeg, 0) / hits.length
      : 0;
    const avgSettle = hits.length > 0
      ? hits.reduce((s, t) => s + t.settleTimeMs, 0) / hits.length
      : 0;
    const avgPathEff = hits.length > 0
      ? hits.reduce((s, t) => s + t.pathEfficiency, 0) / hits.length
      : 0;

    // 점수: 정확도 35% + TTT 25% + 오버슛 20% + 경로효율 20%
    const tttScore = Math.max(0, 1 - avgTtt / this.config.timeoutMs);
    const overshootScore = Math.max(0, 1 - avgOvershoot / 10);
    const score = accuracy * 35 + tttScore * 25 + overshootScore * 20 + avgPathEff * 20;

    return {
      stageType: 'flick_medium' as const,
      category: 'flick' as const,
      score,
      accuracy,
      avgTttMs: avgTtt,
      avgOvershootDeg: avgOvershoot,
      avgSettleTimeMs: avgSettle,
      avgPathEfficiency: avgPathEff,
      trials: this.trials,
      totalTargets: this.config.numTargets,
      hits: hits.length,
    };
  }

  private advanceOrFinish(): void {
    if (this.currentTargetId) {
      this.targetManager.removeTarget(this.currentTargetId);
      this.currentTargetId = null;
    }
    this.targetIndex++;
    if (this.targetIndex >= this.config.numTargets) {
      this.completed = true;
      if (this.onCompleteCallback) this.onCompleteCallback(this.getResults());
    } else {
      this.pendingTimeout = setTimeout(() => this.spawnNext(), 400 + Math.random() * 300);
    }
  }

  private spawnNext(): void {
    const [minAngle, maxAngle] = this.config.angleRange;
    this.targetAngleDeg = minAngle + Math.random() * (maxAngle - minAngle);

    // 360° 어느 방향이든 출현 가능
    const azimuth = Math.random() * Math.PI * 2;
    const elevation = (Math.random() - 0.5) * 30 * DEG2RAD;
    const angleRad = this.targetAngleDeg * DEG2RAD;

    const x = Math.sin(azimuth) * Math.sin(angleRad) * this.distance;
    const y = 1.6 + Math.sin(elevation) * Math.sin(angleRad) * this.distance;
    const z = -Math.cos(angleRad) * this.distance;

    const target = this.targetManager.spawnTarget(
      new THREE.Vector3(x, y, z),
      {
        angularSizeDeg: this.config.difficulty.targetSizeDeg,
        distanceM: this.distance,
        color: 0xffa500,
      },
    );
    this.currentTargetId = target.id;
    this.targetAppearTime = performance.now();
    this.trajectory = [];
    this.minAngularError = Infinity;
    this.correctionCount = 0;
    this.wasApproaching = true;
    this.firstOnTargetTime = null;
  }

  /** 리소스 정리 — 타이머 해제 */
  dispose(): void {
    if (this.pendingTimeout !== null) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
    super.dispose();
  }

  /** 궤적 기록 + 오버슛/보정 추적 */
  private trackTrajectory(): void {
    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);
    if (!hitResult) return;

    const error = hitResult.angularError;
    const elapsed = performance.now() - this.targetAppearTime;
    this.trajectory.push({ t: elapsed, error });

    // 타겟 위에 처음 올라온 시점 기록
    const targetRad = this.config.difficulty.targetSizeDeg * DEG2RAD / 2;
    if (!this.firstOnTargetTime && error <= targetRad) {
      this.firstOnTargetTime = performance.now();
    }

    // 오버슛 감지
    if (error < this.minAngularError) {
      this.minAngularError = error;
      this.wasApproaching = true;
    } else if (this.wasApproaching && error > this.minAngularError * 1.3) {
      this.correctionCount++;
      this.wasApproaching = false;
    }
  }

  /** 오버슛 계산 (도) */
  private calculateOvershoot(): number {
    if (this.minAngularError === Infinity) return 0;
    // 타겟 경계를 넘어선 최소 에러의 반대편까지의 거리
    return Math.max(0, this.minAngularError * 180 / Math.PI);
  }

  /** 경로 효율: 이상적 직선 대비 실제 이동 비율 */
  private calculatePathEfficiency(): number {
    if (this.trajectory.length < 2) return 0;
    const idealDistance = this.targetAngleDeg * DEG2RAD;
    // 실제 궤적 총 거리 (에러 변화량 합)
    let totalMovement = 0;
    for (let i = 1; i < this.trajectory.length; i++) {
      totalMovement += Math.abs(this.trajectory[i].error - this.trajectory[i - 1].error);
    }
    if (totalMovement === 0) return 1;
    return Math.min(1, idealDistance / totalMovement);
  }

  private recordMiss(): void {
    this.trials.push({
      hit: false,
      tttMs: this.config.timeoutMs,
      angleDeg: this.targetAngleDeg,
      overshootDeg: 0,
      correctionCount: this.correctionCount,
      settleTimeMs: 0,
      pathEfficiency: 0,
    });
  }
}
