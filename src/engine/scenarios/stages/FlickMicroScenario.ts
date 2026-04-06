/**
 * Micro Flick 시나리오 (5-15°)
 * 손가락 정밀 조작 영역 — 작은 각도 플릭
 * 헤드샷 미세 조정, 근접 타겟 미세 보정에 해당
 * 독립 DNA 축: flick_micro_score
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import type { FlickStageConfig } from '../../../utils/types';
import { DEG2RAD } from '../../../utils/physics';
import { TARGET_COLORS } from '../../../config/theme';

/** 개별 타겟 결과 */
interface MicroFlickTrial {
  hit: boolean;
  tttMs: number;
  angleDeg: number;
  overshootDeg: number;
  correctionCount: number;
  direction: string;
}

export class FlickMicroScenario extends Scenario {
  private config: FlickStageConfig;
  private targetIndex = 0;
  private currentTargetId: string | null = null;
  private targetAppearTime = 0;
  private targetAngleDeg = 0;
  private completed = false;
  private trials: MicroFlickTrial[] = [];
  private distance = 12; // 미터

  // 오버슛 추적
  private minAngularError = Infinity;
  private correctionCount = 0;
  private wasApproaching = true;

  // 타이머 정리용
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(engine: GameEngine, targetManager: TargetManager, config: FlickStageConfig) {
    super(engine, targetManager);
    this.config = config;
    // Micro: 강제 5-15° 범위
    if (config.angleRange[0] < 5) config.angleRange[0] = 5;
    if (config.angleRange[1] > 15) config.angleRange[1] = 15;
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

    // 타임아웃 체크
    const elapsed = performance.now() - this.targetAppearTime;
    if (elapsed >= this.config.timeoutMs) {
      this.trials.push({
        hit: false,
        tttMs: this.config.timeoutMs,
        angleDeg: this.targetAngleDeg,
        overshootDeg: 0,
        correctionCount: this.correctionCount,
        direction: '',
      });
      this.advanceOrFinish();
      return;
    }

    // 오버슛/보정 추적
    this.trackCorrections();
  }

  onClick(): void {
    if (this.completed || !this.currentTargetId) return;

    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);

    const ttt = performance.now() - this.targetAppearTime;
    const overshootDeg = this.minAngularError < Infinity
      ? (this.minAngularError * 180 / Math.PI)
      : 0;

    this.trials.push({
      hit: hitResult?.hit ?? false,
      tttMs: ttt,
      angleDeg: this.targetAngleDeg,
      overshootDeg: Math.max(0, overshootDeg),
      correctionCount: this.correctionCount,
      direction: this.getDirectionLabel(),
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

    // 점수: 정확도 40% + TTT 30% + 오버슛 30%
    const tttScore = Math.max(0, 1 - avgTtt / this.config.timeoutMs);
    const overshootScore = Math.max(0, 1 - avgOvershoot / 5);
    const score = (accuracy * 40 + tttScore * 30 + overshootScore * 30);

    return {
      stageType: 'flick_micro' as const,
      category: 'flick' as const,
      score,
      accuracy,
      avgTttMs: avgTtt,
      avgOvershootDeg: avgOvershoot,
      trials: this.trials,
      totalTargets: this.config.numTargets,
      hits: hits.length,
    };
  }

  /** 다음 타겟 또는 종료 */
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
      // 약간의 딜레이 후 다음 타겟
      this.pendingTimeout = setTimeout(() => this.spawnNext(), 300 + Math.random() * 200);
    }
  }

  /** 타겟 스폰 — 카메라 상대좌표 기준으로 배치 */
  private spawnNext(): void {
    const [minAngle, maxAngle] = this.config.angleRange;
    this.targetAngleDeg = minAngle + Math.random() * (maxAngle - minAngle);

    // 카메라 기준 로컬 방향 계산
    const azimuth = Math.random() * Math.PI * 2;
    const angleRad = this.targetAngleDeg * DEG2RAD;
    const localDir = new THREE.Vector3(
      Math.sin(angleRad) * Math.cos(azimuth),
      Math.sin(angleRad) * Math.sin(azimuth - Math.PI / 2),
      -Math.cos(angleRad),
    );

    // 카메라 quaternion으로 월드 방향 변환
    const camera = this.engine.getCamera();
    const worldDir = localDir.applyQuaternion(camera.quaternion);
    const targetPos = camera.position.clone().addScaledVector(worldDir, this.distance);

    const target = this.targetManager.spawnTarget(
      targetPos,
      {
        angularSizeDeg: this.config.difficulty.targetSizeDeg,
        distanceM: this.distance,
        color: TARGET_COLORS.alertRed,
      },
    );
    this.currentTargetId = target.id;
    this.targetAppearTime = performance.now();
    this.minAngularError = Infinity;
    this.correctionCount = 0;
    this.wasApproaching = true;
  }

  /** 리소스 정리 — 타이머 해제 */
  dispose(): void {
    if (this.pendingTimeout !== null) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
    super.dispose();
  }

  /** 오버슛/보정 추적 */
  private trackCorrections(): void {
    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);
    if (!hitResult) return;

    const error = hitResult.angularError;
    if (error < this.minAngularError) {
      this.minAngularError = error;
      this.wasApproaching = true;
    } else if (this.wasApproaching && error > this.minAngularError * 1.5) {
      // 오버슛 감지 — 최소 에러에서 50% 이상 벗어남
      this.correctionCount++;
      this.wasApproaching = false;
    }
  }

  /** 방향 라벨 */
  private getDirectionLabel(): string {
    if (!this.currentTargetId) return 'unknown';
    // 간단히 시나리오 카운트 기반
    const dirs = ['right', 'upper_right', 'up', 'upper_left', 'left', 'lower_left', 'down', 'lower_right'];
    return dirs[this.targetIndex % dirs.length];
  }
}
