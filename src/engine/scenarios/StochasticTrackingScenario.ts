/**
 * Stochastic Tracking 시나리오
 * Perlin noise 기반 랜덤 이동 타겟 추적
 * 부드럽지만 예측 불가능한 궤적으로 반응형 트래킹 측정
 */
import * as THREE from 'three';
import { Scenario } from './Scenario';
import { MetricsCollector } from '../metrics/MetricsCollector';
import { VelocityTracker } from '../metrics/VelocityTracker';
import { PerlinNoise } from '../../utils/perlin';
import { angularDistance } from '../HitDetection';
import { DEG2RAD, RAD2DEG } from '../../utils/physics';
import { TARGET_COLORS } from '../../config/theme';
import type { GameEngine } from '../GameEngine';
import type { TargetManager } from '../TargetManager';
import type { StochasticTrackingConfig, TrackingTrialMetrics } from '../../utils/types';

export class StochasticTrackingScenario extends Scenario {
  private config: StochasticTrackingConfig;
  private metrics: MetricsCollector;
  private velocityTracker: VelocityTracker;
  private perlin: PerlinNoise;

  private elapsedMs = 0;
  private completed = false;
  private currentTargetId: string | null = null;

  // 타겟 초기 위치 (noise offset 기준점)
  private basePosition = new THREE.Vector3();
  // 카메라 로컬 축
  private localRight = new THREE.Vector3();
  private localUp = new THREE.Vector3();
  private targetDistance: number;

  // 이전 타겟 위치 (속도 계산용)
  private prevTargetPos: THREE.Vector3 | null = null;

  // 결과 콜백
  private onComplete: ((results: TrackingTrialMetrics) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    config: StochasticTrackingConfig,
  ) {
    super(engine, targetManager);
    this.config = config;
    this.targetDistance = config.distance;
    this.metrics = new MetricsCollector();
    this.velocityTracker = new VelocityTracker();
    // 랜덤 시드로 매번 다른 궤적 생성
    this.perlin = new PerlinNoise(Math.floor(Math.random() * 100000));
  }

  /** 완료 콜백 설정 */
  setOnComplete(cb: (results: TrackingTrialMetrics) => void): void {
    this.onComplete = cb;
  }

  /** 시나리오 시작 */
  start(): void {
    this.elapsedMs = 0;
    this.completed = false;
    this.metrics.reset();
    this.velocityTracker.reset();

    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();

    // 기준 위치: 카메라 정면 distance m
    this.basePosition = camera.position
      .clone()
      .addScaledVector(forward, this.targetDistance);

    // 카메라 로컬 축
    this.localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(
      camera.quaternion,
    );
    this.localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
      camera.quaternion,
    );

    // 초기 위치에 타겟 생성
    const target = this.targetManager.spawnTarget(this.basePosition.clone(), {
      angularSizeDeg: this.config.targetSizeDeg,
      distanceM: this.targetDistance,
      color: TARGET_COLORS.trackingGreen,
      movementType: 'static', // 이동은 직접 제어
    });
    this.currentTargetId = target.id;
    this.prevTargetPos = this.basePosition.clone();
  }

  /** 매 프레임 업데이트 — Perlin noise 기반 이동 + 오차 측정 */
  update(deltaTime: number): void {
    if (this.completed) return;

    const dtMs = deltaTime * 1000;
    this.elapsedMs += dtMs;

    // 시간 종료 체크
    if (this.elapsedMs >= this.config.duration) {
      this.completed = true;
      const results = this.metrics.computeTrackingMetrics('stochastic');
      this.onComplete?.(results);
      return;
    }

    // 타겟 이동
    if (this.currentTargetId) {
      const target = this.targetManager.getTarget(this.currentTargetId);
      if (target) {
        this.moveTargetWithNoise(target);
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
    return this.metrics.computeTrackingMetrics('stochastic');
  }

  getTrialJson() {
    return this.metrics.toTrialJson();
  }

  // === 내부 메서드 ===

  /** Perlin noise 기반 타겟 이동 */
  private moveTargetWithNoise(target: import('../Target').Target): void {
    const t = this.elapsedMs / 1000; // 초
    const tScaled = t * this.config.noiseSpeed;

    // X/Y 독립적 noise (offset +100으로 비상관화)
    const dx = this.perlin.noise2D(tScaled, 0) * this.config.amplitudeDeg;
    const dy =
      this.perlin.noise2D(0, tScaled + 100) * this.config.amplitudeDeg;

    // 각도 → 실제 거리 (m)
    const offsetX = this.targetDistance * Math.tan(dx * DEG2RAD);
    const offsetY = this.targetDistance * Math.tan(dy * DEG2RAD);

    // 새 위치 계산
    this.prevTargetPos = target.position.clone();
    const newPos = this.basePosition
      .clone()
      .addScaledVector(this.localRight, offsetX)
      .addScaledVector(this.localUp, offsetY);

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
    const cameraVelocity = this.velocityTracker.getVelocity();

    // 타겟 속도
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
