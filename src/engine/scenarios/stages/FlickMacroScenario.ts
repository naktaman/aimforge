/**
 * Macro Flick 시나리오 (90-180°)
 * 팔 움직임 영역 — 대각 플릭, 180° 턴샷
 * 배틀로얄/밀리터리 FPS에서 후방 적 대응
 * 독립 DNA 축: flick_macro_score
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import type { FlickStageConfig } from '../../../utils/types';
import { DEG2RAD } from '../../../utils/physics';

/** 개별 타겟 결과 */
interface MacroFlickTrial {
  hit: boolean;
  tttMs: number;
  angleDeg: number;
  overshootDeg: number;
  correctionCount: number;
  /** 180° 턴의 경우 true */
  is180: boolean;
}

export class FlickMacroScenario extends Scenario {
  private config: FlickStageConfig;
  private targetIndex = 0;
  private currentTargetId: string | null = null;
  private targetAppearTime = 0;
  private targetAngleDeg = 0;
  private completed = false;
  private trials: MacroFlickTrial[] = [];
  private distance = 10; // 매크로는 약간 가까운 거리

  // 오버슛 추적
  private minAngularError = Infinity;
  private correctionCount = 0;
  private wasApproaching = true;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(engine: GameEngine, targetManager: TargetManager, config: FlickStageConfig) {
    super(engine, targetManager);
    this.config = config;
    // Macro: 강제 90-180° 범위
    if (config.angleRange[0] < 90) config.angleRange[0] = 90;
    if (config.angleRange[1] > 180) config.angleRange[1] = 180;
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
    // 매크로 플릭은 더 긴 타임아웃
    const timeout = this.config.timeoutMs * 1.5;
    if (elapsed >= timeout) {
      this.trials.push({
        hit: false,
        tttMs: timeout,
        angleDeg: this.targetAngleDeg,
        overshootDeg: 0,
        correctionCount: this.correctionCount,
        is180: this.targetAngleDeg >= 170,
      });
      this.advanceOrFinish();
      return;
    }

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
      is180: this.targetAngleDeg >= 170,
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

    // 180° 턴 통계 분리
    const turns180 = this.trials.filter((t) => t.is180);
    const turns180Acc = turns180.length > 0
      ? turns180.filter((t) => t.hit).length / turns180.length
      : 0;

    // 점수: 정확도 45% + TTT 30% + 오버슛 25% (매크로는 정확도 비중 높음)
    const timeout = this.config.timeoutMs * 1.5;
    const tttScore = Math.max(0, 1 - avgTtt / timeout);
    const overshootScore = Math.max(0, 1 - avgOvershoot / 20);
    const score = accuracy * 45 + tttScore * 30 + overshootScore * 25;

    return {
      stageType: 'flick_macro' as const,
      category: 'flick' as const,
      score,
      accuracy,
      avgTttMs: avgTtt,
      avgOvershootDeg: avgOvershoot,
      trials: this.trials,
      totalTargets: this.config.numTargets,
      hits: hits.length,
      turn180Accuracy: turns180Acc,
      turn180Count: turns180.length,
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
      // 매크로는 리셋 시간 더 김
      setTimeout(() => this.spawnNext(), 500 + Math.random() * 400);
    }
  }

  private spawnNext(): void {
    const [minAngle, maxAngle] = this.config.angleRange;
    this.targetAngleDeg = minAngle + Math.random() * (maxAngle - minAngle);

    // 주로 좌우 + 후방에서 출현 (상하 편향 적음)
    const azimuth = Math.random() * Math.PI * 2;
    // 수직 편차는 매크로에서 적게
    const elevation = (Math.random() - 0.5) * 20 * DEG2RAD;
    const angleRad = this.targetAngleDeg * DEG2RAD;

    const x = Math.sin(azimuth) * Math.sin(angleRad) * this.distance;
    const y = 1.6 + Math.sin(elevation) * this.distance * 0.3;
    const z = -Math.cos(angleRad) * this.distance;

    const target = this.targetManager.spawnTarget(
      new THREE.Vector3(x, y, z),
      {
        angularSizeDeg: this.config.difficulty.targetSizeDeg,
        distanceM: this.distance,
        // 매크로 타겟은 좀 더 크고 눈에 띄는 색
        color: 0xe74c3c,
      },
    );
    this.currentTargetId = target.id;
    this.targetAppearTime = performance.now();
    this.minAngularError = Infinity;
    this.correctionCount = 0;
    this.wasApproaching = true;
  }

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
      this.correctionCount++;
      this.wasApproaching = false;
    }
  }
}
