/**
 * Zoom Phase A: Steady-state 시나리오
 * 줌 상태에서 시작, 해당 배율에 맞는 타겟으로 트래킹
 * 배율별 거리/크기/속도 자동 조정
 * 1x: 근거리(5-15m), 큰/빠른 타겟
 * 3x: 중거리(15-30m), 중간 타겟
 * 6x+: 장거리(30-50m), 작은/느린 타겟
 */
import * as THREE from 'three';
import { Scenario } from './Scenario';
import { MetricsCollector } from '../metrics/MetricsCollector';
import { VelocityTracker } from '../metrics/VelocityTracker';
import { angularDistance } from '../HitDetection';
import { DEG2RAD, RAD2DEG } from '../../utils/physics';
import { calculateTrackingScore } from '../metrics/CompositeScore';
import type { GameEngine } from '../GameEngine';
import type { TargetManager } from '../TargetManager';
import type { ZoomPhaseConfig, ZoomPhaseResult } from '../../utils/types';

/** 줌 티어별 기본 파라미터 — 7단계 그라데이션 */
const TIER_PARAMS: Record<string, { distRange: [number, number]; sizeDeg: number; speedDeg: number }> = {
  '1x':  { distRange: [5, 15],  sizeDeg: 4.0, speedDeg: 50 },
  '2x':  { distRange: [10, 25], sizeDeg: 3.0, speedDeg: 40 },
  '4x':  { distRange: [20, 40], sizeDeg: 2.0, speedDeg: 28 },
  '6x':  { distRange: [30, 55], sizeDeg: 1.4, speedDeg: 20 },
  '8x':  { distRange: [40, 70], sizeDeg: 1.0, speedDeg: 15 },
  '10x': { distRange: [50, 85], sizeDeg: 0.8, speedDeg: 12 },
  '12x': { distRange: [60, 100], sizeDeg: 0.6, speedDeg: 9 },
};

export class ZoomSteadyScenario extends Scenario {
  private config: ZoomPhaseConfig;
  private metrics!: MetricsCollector;
  private velocityTracker!: VelocityTracker;

  private elapsedMs = 0;
  private completed = false;
  private currentTargetId: string | null = null;
  private moveDirection = 1;
  private segmentDuration = 0;
  private segmentElapsed = 0;
  private directionChangesRemaining = 4;
  private targetDistance: number;
  private targetSpeedDegPerSec: number;
  private prevTargetPos: THREE.Vector3 | null = null;
  /** 동적 이동범위 제한 — min(fov/2 * 0.8, 30) */
  private maxMovementDeg: number;

  private onComplete: ((result: ZoomPhaseResult) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    config: ZoomPhaseConfig,
  ) {
    super(engine, targetManager);
    this.config = config;

    // 줌 티어별 파라미터
    const tier = TIER_PARAMS[config.zoomTier];
    const [minDist, maxDist] = tier.distRange;
    this.targetDistance = minDist + Math.random() * (maxDist - minDist);
    this.targetSpeedDegPerSec = tier.speedDeg;
    // 동적 이동범위: 줌 FOV에 비례하여 제한
    this.maxMovementDeg = Math.min((config.scopeFov / 2) * 0.8, 30);
  }

  setOnComplete(cb: (result: ZoomPhaseResult) => void): void {
    this.onComplete = cb;
  }

  /** 시나리오 시작 — 줌 FOV 적용 + 타겟 생성 */
  start(): void {
    this.elapsedMs = 0;
    this.completed = false;
    this.metrics = new MetricsCollector();
    this.velocityTracker = new VelocityTracker();

    // 줌 FOV 적용
    this.engine.setScope(this.config.scopeFov, this.config.scopeMultiplier);

    // 방향 전환 간격
    this.segmentDuration = this.config.duration / 5;
    this.segmentElapsed = 0;
    this.directionChangesRemaining = 4;

    // 카메라 정면에 타겟 생성
    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const targetPos = camera.position
      .clone()
      .addScaledVector(forward, this.targetDistance);

    const tier = TIER_PARAMS[this.config.zoomTier];
    const target = this.targetManager.spawnTarget(targetPos, {
      angularSizeDeg: tier.sizeDeg,
      distanceM: this.targetDistance,
      color: 0x4ade80,
      movementType: 'static',
    });
    this.currentTargetId = target.id;
    this.prevTargetPos = targetPos.clone();
  }

  update(deltaTime: number): void {
    if (this.completed) return;

    const dtMs = deltaTime * 1000;
    this.elapsedMs += dtMs;
    this.segmentElapsed += dtMs;

    // 시간 종료
    if (this.elapsedMs >= this.config.duration) {
      this.completed = true;
      // 줌 해제
      this.engine.setScope(this.config.hipfireFov, 1);
      const tracking = this.metrics.computeTrackingMetrics('horizontal');
      const score = calculateTrackingScore(tracking.mad, tracking.velocityMatchRatio);
      this.onComplete?.({
        score,
        phase: 'steady',
        zoomTier: this.config.zoomTier,
      });
      return;
    }

    // 방향 전환
    if (
      this.segmentElapsed >= this.segmentDuration &&
      this.directionChangesRemaining > 0
    ) {
      this.moveDirection *= -1;
      this.segmentElapsed = 0;
      this.directionChangesRemaining--;
    }

    // 타겟 이동 + 오차 측정
    if (this.currentTargetId) {
      const target = this.targetManager.getTarget(this.currentTargetId);
      if (target) {
        this.moveTarget(target, deltaTime);
        this.measureError(target, deltaTime);
      }
    }

    const { yaw, pitch } = this.engine.getRotation();
    this.velocityTracker.record(performance.now(), yaw, pitch);
  }

  onClick(): void {
    // Tracking 기반이므로 no-op
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): ZoomPhaseResult {
    const tracking = this.metrics.computeTrackingMetrics('horizontal');
    const score = calculateTrackingScore(tracking.mad, tracking.velocityMatchRatio);
    return { score, phase: 'steady', zoomTier: this.config.zoomTier };
  }

  /** 줌 해제 후 정리 */
  dispose(): void {
    this.engine.setScope(this.config.hipfireFov, 1);
    super.dispose();
  }

  // === 내부 ===

  private moveTarget(target: import('../Target').Target, dt: number): void {
    const speedMs =
      this.targetDistance *
      Math.tan(this.targetSpeedDegPerSec * DEG2RAD) *
      dt;
    this.prevTargetPos = target.position.clone();
    target.position.x += speedMs * this.moveDirection;

    // 동적 이동범위 제한 — FOV 기반 최대 수평 편차
    const maxOffsetM = this.targetDistance * Math.tan(this.maxMovementDeg * DEG2RAD);
    const cameraX = this.engine.getCamera().position.x;
    const offset = target.position.x - cameraX;
    if (Math.abs(offset) > maxOffsetM) {
      target.position.x = cameraX + Math.sign(offset) * maxOffsetM;
      this.moveDirection *= -1; // 범위 도달 시 방향 전환
    }

    target.mesh.position.copy(target.position);
  }

  private measureError(target: import('../Target').Target, dt: number): void {
    const cameraPos = this.engine.getCamera().position;
    const forward = this.engine.getCameraForward();
    const error = angularDistance(cameraPos, forward, target.position);
    const cameraVelocity = this.velocityTracker.getVelocity();

    let targetVelocity = 0;
    if (this.prevTargetPos && dt > 0) {
      const targetAngularDist = angularDistance(
        cameraPos,
        new THREE.Vector3()
          .subVectors(this.prevTargetPos, cameraPos)
          .normalize(),
        target.position,
      );
      targetVelocity = (targetAngularDist * RAD2DEG) / dt;
    }

    this.metrics.recordTrackingFrame({
      timestamp: performance.now(),
      angularError: error,
      cameraVelocity,
      targetVelocity,
    });
  }
}
