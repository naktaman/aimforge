/**
 * Linear Tracking 시나리오
 * 이동하는 타겟을 크로스헤어로 추적
 * MAD, deviation_variance, phase_lag, velocity_match_ratio 측정
 */
import * as THREE from 'three';
import { Scenario } from './Scenario';
import { MetricsCollector } from '../metrics/MetricsCollector';
import { VelocityTracker } from '../metrics/VelocityTracker';
import { angularDistance } from '../HitDetection';
import { DEG2RAD, RAD2DEG } from '../../utils/physics';
import type { GameEngine } from '../GameEngine';
import type { TargetManager } from '../TargetManager';
import type { TrackingConfig, TrackingTrialMetrics } from '../../utils/types';

export class TrackingScenario extends Scenario {
  private config: TrackingConfig;
  private metrics: MetricsCollector;
  private velocityTracker: VelocityTracker;

  private elapsedMs = 0;
  private completed = false;
  private currentTargetId: string | null = null;

  // 타겟 이동 상태
  private moveDirection = 1; // 1 또는 -1
  private segmentDuration = 0; // 방향 전환 간격 (ms)
  private segmentElapsed = 0;
  private directionChangesRemaining: number;

  // 타겟 이동 속도 (°/s → 실제 m/s 변환 시 거리 기반)
  private targetSpeedDegPerSec: number;
  private targetDistance = 10; // m

  // 이전 타겟 위치 (속도 계산용)
  private prevTargetPos: THREE.Vector3 | null = null;

  // 결과 콜백
  private onComplete: ((results: TrackingTrialMetrics) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    config: TrackingConfig,
  ) {
    super(engine, targetManager);
    this.config = config;
    this.targetSpeedDegPerSec = config.targetSpeedDegPerSec;
    this.directionChangesRemaining = config.directionChanges;
    this.metrics = new MetricsCollector();
    this.velocityTracker = new VelocityTracker();
  }

  /** 완료 콜백 설정 */
  setOnComplete(cb: (results: TrackingTrialMetrics) => void): void {
    this.onComplete = cb;
  }

  /** 시나리오 시작 — 추적 타겟 생성 */
  start(): void {
    this.elapsedMs = 0;
    this.completed = false;
    this.metrics.reset();
    this.velocityTracker.reset();

    // 방향 전환 간격 계산
    this.segmentDuration =
      this.config.duration / (this.config.directionChanges + 1);
    this.segmentElapsed = 0;
    this.directionChangesRemaining = this.config.directionChanges;

    // 카메라 정면 10m 위치에 타겟 생성
    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const targetPos = camera.position
      .clone()
      .addScaledVector(forward, this.targetDistance);

    const target = this.targetManager.spawnTarget(targetPos, {
      angularSizeDeg: this.config.targetSizeDeg,
      distanceM: this.targetDistance,
      color: 0x4ade80,
      movementType: 'static', // 이동은 직접 제어
    });
    this.currentTargetId = target.id;
    this.prevTargetPos = targetPos.clone();
  }

  /** 매 프레임 업데이트 — 타겟 이동 + 오차 측정 */
  update(deltaTime: number): void {
    if (this.completed) return;

    const dtMs = deltaTime * 1000;
    this.elapsedMs += dtMs;
    this.segmentElapsed += dtMs;

    // 시간 종료 체크
    if (this.elapsedMs >= this.config.duration) {
      this.completed = true;
      const results = this.metrics.computeTrackingMetrics(
        this.config.trajectoryType,
      );
      this.onComplete?.(results);
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

    // 타겟 이동
    if (this.currentTargetId) {
      const target = this.targetManager.getTarget(this.currentTargetId);
      if (target) {
        this.moveTarget(target, deltaTime);
        this.measureError(target, deltaTime);
      }
    }

    // 속도 추적
    const { yaw, pitch } = this.engine.getRotation();
    this.velocityTracker.record(performance.now(), yaw, pitch);
  }

  /** Tracking에서는 클릭 사용하지 않음 */
  onClick(): void {
    // no-op
  }

  /** 완료 여부 */
  isComplete(): boolean {
    return this.completed;
  }

  /** 결과 반환 */
  getResults(): TrackingTrialMetrics {
    return this.metrics.computeTrackingMetrics(this.config.trajectoryType);
  }

  /** JSON 데이터 (DB 저장용) */
  getTrialJson() {
    return this.metrics.toTrialJson();
  }

  // === 내부 메서드 ===

  /** 타겟 이동 (°/s를 m/s로 변환) */
  private moveTarget(target: import('../Target').Target, dt: number): void {
    // °/s → 실제 이동 속도 (m/s)
    // 거리 d에서 θ°/s → v = d × tan(θ × DEG2RAD) / 1
    const speedMs =
      this.targetDistance *
      Math.tan(this.targetSpeedDegPerSec * DEG2RAD) *
      dt;

    this.prevTargetPos = target.position.clone();

    switch (this.config.trajectoryType) {
      case 'horizontal':
        target.position.x += speedMs * this.moveDirection;
        break;
      case 'vertical':
        target.position.y += speedMs * this.moveDirection;
        break;
      case 'mixed':
        target.position.x += speedMs * this.moveDirection * 0.7;
        target.position.y += speedMs * this.moveDirection * 0.3;
        break;
    }
    target.mesh.position.copy(target.position);
  }

  /** 크로스헤어와 타겟 사이 오차 측정 */
  private measureError(
    target: import('../Target').Target,
    dt: number,
  ): void {
    const cameraPos = this.engine.getCamera().position;
    const forward = this.engine.getCameraForward();

    // angular distance (크로스헤어↔타겟 각도 오차)
    const error = angularDistance(cameraPos, forward, target.position);

    // 카메라 속도 (°/s)
    const cameraVelocity = this.velocityTracker.getVelocity();

    // 타겟 속도 (°/s) — 위치 변화에서 계산
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

    // 프레임 데이터 기록
    this.metrics.recordTrackingFrame({
      timestamp: performance.now(),
      angularError: error,
      cameraVelocity,
      targetVelocity,
    });
  }
}
