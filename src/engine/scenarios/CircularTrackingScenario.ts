/**
 * Circular Tracking 시나리오
 * 타겟이 원형 궤도로 이동 (가변 반지름/속도)
 * TrackingScenario 패턴 기반, MAD/velocity_match/phase_lag 측정
 */
import * as THREE from 'three';
import { Scenario } from './Scenario';
import { MetricsCollector } from '../metrics/MetricsCollector';
import { VelocityTracker } from '../metrics/VelocityTracker';
import { angularDistance } from '../HitDetection';
import { DEG2RAD, RAD2DEG } from '../../utils/physics';
import type { GameEngine } from '../GameEngine';
import type { TargetManager } from '../TargetManager';
import type { CircularTrackingConfig, TrackingTrialMetrics } from '../../utils/types';

export class CircularTrackingScenario extends Scenario {
  private config: CircularTrackingConfig;
  private metrics: MetricsCollector;
  private velocityTracker: VelocityTracker;

  private elapsedMs = 0;
  private completed = false;
  private currentTargetId: string | null = null;

  // 궤도 중심 (월드 좌표)
  private orbitCenter = new THREE.Vector3();
  // 카메라 로컬 기준 궤도 축 (right, up)
  private orbitRight = new THREE.Vector3();
  private orbitUp = new THREE.Vector3();
  private targetDistance: number;

  // 이전 타겟 위치 (속도 계산용)
  private prevTargetPos: THREE.Vector3 | null = null;

  // 결과 콜백
  private onComplete: ((results: TrackingTrialMetrics) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    config: CircularTrackingConfig,
  ) {
    super(engine, targetManager);
    this.config = config;
    this.targetDistance = config.distance;
    this.metrics = new MetricsCollector();
    this.velocityTracker = new VelocityTracker();
  }

  /** 완료 콜백 설정 */
  setOnComplete(cb: (results: TrackingTrialMetrics) => void): void {
    this.onComplete = cb;
  }

  /** 시나리오 시작 — 궤도 중심에 타겟 생성 */
  start(): void {
    this.elapsedMs = 0;
    this.completed = false;
    this.metrics.reset();
    this.velocityTracker.reset();

    // 카메라 정면 방향 기준으로 궤도 축 설정
    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();

    // 궤도 중심: 카메라 정면 distance m 위치
    this.orbitCenter = camera.position
      .clone()
      .addScaledVector(forward, this.targetDistance);

    // 카메라 로컬 right/up 벡터 (궤도 평면 정의)
    this.orbitRight = new THREE.Vector3(1, 0, 0).applyQuaternion(
      camera.quaternion,
    );
    this.orbitUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
      camera.quaternion,
    );

    // 초기 타겟 위치 (궤도 시작점)
    const initialOffset = this.orbitRight
      .clone()
      .multiplyScalar(
        this.targetDistance *
          Math.tan(this.config.orbitRadiusDeg * DEG2RAD),
      );
    const targetPos = this.orbitCenter.clone().add(initialOffset);

    const target = this.targetManager.spawnTarget(targetPos, {
      angularSizeDeg: this.config.targetSizeDeg,
      distanceM: this.targetDistance,
      color: 0x4ade80,
      movementType: 'static', // 이동은 직접 제어
    });
    this.currentTargetId = target.id;
    this.prevTargetPos = targetPos.clone();
  }

  /** 매 프레임 업데이트 — 원형 궤도 이동 + 오차 측정 */
  update(deltaTime: number): void {
    if (this.completed) return;

    const dtMs = deltaTime * 1000;
    this.elapsedMs += dtMs;

    // 시간 종료 체크
    if (this.elapsedMs >= this.config.duration) {
      this.completed = true;
      const results = this.metrics.computeTrackingMetrics('circular');
      this.onComplete?.(results);
      return;
    }

    // 타겟 이동
    if (this.currentTargetId) {
      const target = this.targetManager.getTarget(this.currentTargetId);
      if (target) {
        this.moveTargetOnOrbit(target, deltaTime);
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

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): TrackingTrialMetrics {
    return this.metrics.computeTrackingMetrics('circular');
  }

  getTrialJson() {
    return this.metrics.toTrialJson();
  }

  // === 내부 메서드 ===

  /** 원형 궤도 상 타겟 이동 */
  private moveTargetOnOrbit(
    target: import('../Target').Target,
    _dt: number,
  ): void {
    const elapsed = this.elapsedMs / 1000; // 초

    // 가변 속도: 기본 속도 × (1 + speedVariation × cos(t × 0.35))
    const speed =
      this.config.orbitSpeedDegPerSec *
      (1 + this.config.speedVariation * Math.cos(elapsed * 0.35));

    // 궤도 각도 (누적)
    const angle = speed * DEG2RAD * elapsed;

    // 가변 반지름: 기본 반지름 × (1 + radiusVariation × sin(t × 0.5))
    const radiusDeg =
      this.config.orbitRadiusDeg *
      (1 + this.config.radiusVariation * Math.sin(elapsed * 0.5));

    // 각도 → 실제 거리 (m)
    const radiusM = this.targetDistance * Math.tan(radiusDeg * DEG2RAD);

    // 궤도 위치 계산 (right/up 평면)
    const offsetRight = this.orbitRight
      .clone()
      .multiplyScalar(radiusM * Math.cos(angle));
    const offsetUp = this.orbitUp
      .clone()
      .multiplyScalar(radiusM * Math.sin(angle));

    this.prevTargetPos = target.position.clone();
    const newPos = this.orbitCenter.clone().add(offsetRight).add(offsetUp);
    target.position.copy(newPos);
    target.mesh.position.copy(newPos);
  }

  /** 크로스헤어↔타겟 오차 측정 */
  private measureError(
    target: import('../Target').Target,
    dt: number,
  ): void {
    const cameraPos = this.engine.getCamera().position;
    const forward = this.engine.getCameraForward();

    const error = angularDistance(cameraPos, forward, target.position);

    // 카메라 속도
    const cameraVelocity = this.velocityTracker.getVelocity();

    // 타겟 속도 (위치 변화 기반)
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
