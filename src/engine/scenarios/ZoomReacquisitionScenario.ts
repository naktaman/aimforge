/**
 * Zoom Phase C: Zoom-out Re-acquisition 시나리오
 * 줌 상태에서 타겟 트래킹 → FOV 즉시 hipfire 복귀 → 타겟 "축소"
 * hipfire sens로 타겟 재획득 시간 측정
 */
import * as THREE from 'three';
import { Scenario } from './Scenario';
import { MetricsCollector } from '../metrics/MetricsCollector';
import { VelocityTracker } from '../metrics/VelocityTracker';
import { angularDistance } from '../HitDetection';
import { calculateZoomReacquisitionScore } from '../metrics/CompositeScore';
import { TARGET_COLORS } from '../../config/theme';
import { DEG2RAD, RAD2DEG } from '../../utils/physics';
import type { GameEngine } from '../GameEngine';
import type { TargetManager } from '../TargetManager';
import type { ZoomPhaseConfig, ZoomPhaseResult, ZoomReacquisitionResult } from '../../utils/types';
import {
  ZOOM_TRACKING_MIN_MS,
  ZOOM_TRACKING_MAX_MS,
  ZOOM_REACQUIRE_TIMEOUT_MS,
  ZOOM_REACQUIRE_THRESHOLD_MULTIPLIER,
} from '../../config/constants';

/** 상태 머신 */
type ZRState = 'ZOOMED_TRACKING' | 'HIPFIRE_REACQUIRE' | 'BETWEEN';

/** 줌 트래킹 최소/최대 시간 (ms) */
const ZOOM_TRACKING_MIN = ZOOM_TRACKING_MIN_MS;
const ZOOM_TRACKING_MAX = ZOOM_TRACKING_MAX_MS;
/** 재획득 타임아웃 (ms) */
const REACQUIRE_TIMEOUT = ZOOM_REACQUIRE_TIMEOUT_MS;
/** 재획득 판정 각도 임계값 (rad) — 타겟 반지름의 N배 */
const REACQUIRE_MULTIPLIER = ZOOM_REACQUIRE_THRESHOLD_MULTIPLIER;

export class ZoomReacquisitionScenario extends Scenario {
  private config: ZoomPhaseConfig;
  private metrics: MetricsCollector;
  private velocityTracker: VelocityTracker;

  private state: ZRState = 'BETWEEN';
  private targetIndex = 0;
  private completed = false;

  // 타겟 상태
  private currentTargetId: string | null = null;
  private targetDistance: number;
  private moveDirection = 1;
  private prevTargetPos: THREE.Vector3 | null = null;

  // ZOOMED_TRACKING 타이머
  private zoomTrackingDuration = 0;
  private zoomTrackingElapsed = 0;

  // HIPFIRE_REACQUIRE 상태
  private unzoomTime = 0;
  private unzoomOffset = 0;
  private targetAngularRadius = 0;

  private onComplete: ((result: ZoomPhaseResult) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    config: ZoomPhaseConfig,
  ) {
    super(engine, targetManager);
    this.config = config;
    this.targetDistance = config.distance;
    this.metrics = new MetricsCollector();
    this.velocityTracker = new VelocityTracker();
  }

  setOnComplete(cb: (result: ZoomPhaseResult) => void): void {
    this.onComplete = cb;
  }

  /** 시나리오 시작 — 줌 상태로 시작 */
  start(): void {
    this.targetIndex = 0;
    this.completed = false;
    this.metrics.reset();
    this.velocityTracker.reset();
    this.startZoomedTracking();
  }

  update(deltaTime: number): void {
    if (this.completed) return;

    const dtMs = deltaTime * 1000;
    const { yaw, pitch } = this.engine.getRotation();
    this.velocityTracker.record(performance.now(), yaw, pitch);

    switch (this.state) {
      case 'ZOOMED_TRACKING':
        this.updateZoomedTracking(dtMs, deltaTime);
        break;
      case 'HIPFIRE_REACQUIRE':
        this.updateHipfireReacquire(deltaTime);
        break;
      case 'BETWEEN':
        break;
    }
  }

  onClick(): void {
    // no-op — 재획득은 각도 기반 자동 판정
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): ZoomPhaseResult {
    const reacqMetrics = this.metrics.computeZoomReacquisitionMetrics();
    const score = calculateZoomReacquisitionScore(
      reacqMetrics.reacquisitionRate,
      reacqMetrics.avgReacquisitionTime,
    );
    return { score, phase: 'reacquisition', zoomTier: this.config.zoomTier };
  }

  dispose(): void {
    this.engine.setScope(this.config.hipfireFov, 1);
    super.dispose();
  }

  // === 내부 ===

  /** 줌 트래킹 시작 */
  private startZoomedTracking(): void {
    this.engine.setScope(this.config.scopeFov, this.config.scopeMultiplier);
    this.state = 'ZOOMED_TRACKING';
    this.zoomTrackingDuration =
      ZOOM_TRACKING_MIN + Math.random() * (ZOOM_TRACKING_MAX - ZOOM_TRACKING_MIN);
    this.zoomTrackingElapsed = 0;

    // 카메라 정면에 타겟 생성
    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const targetPos = camera.position
      .clone()
      .addScaledVector(forward, this.targetDistance);

    const target = this.targetManager.spawnTarget(targetPos, {
      angularSizeDeg: this.config.targetSizeDeg,
      distanceM: this.targetDistance,
      color: TARGET_COLORS.trackingGreen,
      movementType: 'static',
    });
    this.currentTargetId = target.id;
    this.prevTargetPos = targetPos.clone();

    // 타겟 각도 반지름
    this.targetAngularRadius =
      (this.config.targetSizeDeg / 2) * DEG2RAD;
  }

  /** 줌 상태 트래킹 업데이트 */
  private updateZoomedTracking(dtMs: number, deltaTime: number): void {
    this.zoomTrackingElapsed += dtMs;

    // 타겟 이동
    if (this.currentTargetId) {
      const target = this.targetManager.getTarget(this.currentTargetId);
      if (target) {
        this.moveTarget(target, deltaTime);
        this.measureTrackingError(target, deltaTime);
      }
    }

    // 줌 해제 시점
    if (this.zoomTrackingElapsed >= this.zoomTrackingDuration) {
      this.transitionToHipfire();
    }
  }

  /** 줌 → hipfire 전환 */
  private transitionToHipfire(): void {
    this.engine.setScope(this.config.hipfireFov, 1);
    this.state = 'HIPFIRE_REACQUIRE';
    this.unzoomTime = performance.now();

    // 줌 해제 직후 오차 기록 (다음 프레임에서 정확)
    if (this.currentTargetId) {
      const target = this.targetManager.getTarget(this.currentTargetId);
      if (target) {
        const cameraPos = this.engine.getCamera().position;
        const forward = this.engine.getCameraForward();
        this.unzoomOffset = angularDistance(cameraPos, forward, target.position);
      }
    }
  }

  /** hipfire 재획득 업데이트 */
  private updateHipfireReacquire(deltaTime: number): void {
    if (!this.currentTargetId) return;

    const now = performance.now();
    const target = this.targetManager.getTarget(this.currentTargetId);
    if (!target) return;

    // 타겟 계속 이동
    this.moveTarget(target, deltaTime);

    const cameraPos = this.engine.getCamera().position;
    const forward = this.engine.getCameraForward();
    const error = angularDistance(cameraPos, forward, target.position);

    // 재획득 판정
    const threshold = this.targetAngularRadius * REACQUIRE_MULTIPLIER;
    if (error <= threshold) {
      const reacqTime = now - this.unzoomTime;
      const result: ZoomReacquisitionResult = {
        unzoomOffset: this.unzoomOffset,
        reacquisitionTime: reacqTime,
        reacquired: true,
      };
      this.metrics.recordZoomReacquisition(result);
      this.advanceTarget();
      return;
    }

    // 타임아웃
    if (now - this.unzoomTime > REACQUIRE_TIMEOUT) {
      const result: ZoomReacquisitionResult = {
        unzoomOffset: this.unzoomOffset,
        reacquisitionTime: REACQUIRE_TIMEOUT,
        reacquired: false,
      };
      this.metrics.recordZoomReacquisition(result);
      this.advanceTarget();
    }
  }

  /** 다음 타겟 또는 완료 */
  private advanceTarget(): void {
    if (this.currentTargetId) {
      this.targetManager.removeTarget(this.currentTargetId);
      this.currentTargetId = null;
    }

    this.targetIndex++;
    if (this.targetIndex >= this.config.numTargets) {
      this.completed = true;
      this.engine.setScope(this.config.hipfireFov, 1);
      const result = this.getResults();
      this.onComplete?.(result);
      return;
    }

    // 다음 줌 트래킹 사이클
    this.startZoomedTracking();
  }

  /** 타겟 수평 이동 */
  private moveTarget(target: import('../Target').Target, dt: number): void {
    const speedMs =
      this.targetDistance *
      Math.tan(20 * DEG2RAD) * // 느린 이동 (20°/s)
      dt;
    this.prevTargetPos = target.position.clone();
    target.position.x += speedMs * this.moveDirection;
    target.mesh.position.copy(target.position);

    // 30° 제한
    const cameraPos = this.engine.getCamera().position;
    const toTarget = new THREE.Vector3()
      .subVectors(target.position, cameraPos)
      .normalize();
    const fwd = new THREE.Vector3(0, 0, -1);
    if (Math.acos(Math.max(-1, Math.min(1, fwd.dot(toTarget)))) > 30 * DEG2RAD) {
      this.moveDirection *= -1;
    }
  }

  /** 트래킹 오차 기록 */
  private measureTrackingError(
    target: import('../Target').Target,
    dt: number,
  ): void {
    const cameraPos = this.engine.getCamera().position;
    const forward = this.engine.getCameraForward();
    const error = angularDistance(cameraPos, forward, target.position);
    const cameraVelocity = this.velocityTracker.getVelocity();

    let targetVelocity = 0;
    if (this.prevTargetPos && dt > 0) {
      const tad = angularDistance(
        cameraPos,
        new THREE.Vector3()
          .subVectors(this.prevTargetPos, cameraPos)
          .normalize(),
        target.position,
      );
      targetVelocity = (tad * RAD2DEG) / dt;
    }

    this.metrics.recordTrackingFrame({
      timestamp: performance.now(),
      angularError: error,
      cameraVelocity,
      targetVelocity,
    });
  }
}
