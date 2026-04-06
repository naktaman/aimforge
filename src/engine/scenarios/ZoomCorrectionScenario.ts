/**
 * Zoom Phase B: Post-zoom Correction 시나리오
 * hipfire FOV → 줌 전환 → 타겟 화면상 "점프" → 미세 보정 → 클릭
 * multiplier 적합성 측정 (over/under-correction)
 */
import * as THREE from 'three';
import { Scenario } from './Scenario';
import { MetricsCollector } from '../metrics/MetricsCollector';
import { VelocityTracker } from '../metrics/VelocityTracker';
import { angularDistance } from '../HitDetection';
import { calculateZoomCorrectionScore } from '../metrics/CompositeScore';
import { TARGET_COLORS } from '../../config/theme';
import { DEG2RAD } from '../../utils/physics';
import type { GameEngine } from '../GameEngine';
import type { TargetManager } from '../TargetManager';
import type { ZoomPhaseConfig, ZoomPhaseResult, ZoomCorrectionResult } from '../../utils/types';
import { ZOOM_PRE_ZOOM_DELAY_MS, ZOOM_CORRECTION_TIMEOUT_MS } from '../../config/constants';

/** 상태 머신 */
type ZCState = 'HIPFIRE_VIEW' | 'ZOOMED_CORRECT' | 'BETWEEN';

/** 타겟 표시 대기 시간 (ms) — 줌 전에 타겟 위치 인지 */
const PRE_ZOOM_DELAY = ZOOM_PRE_ZOOM_DELAY_MS;
/** 보정 타임아웃 (ms) */
const CORRECTION_TIMEOUT = ZOOM_CORRECTION_TIMEOUT_MS;

export class ZoomCorrectionScenario extends Scenario {
  private config: ZoomPhaseConfig;
  private metrics: MetricsCollector;
  private velocityTracker: VelocityTracker;

  private state: ZCState = 'BETWEEN';
  private targetIndex = 0;
  private completed = false;

  // 타겟 상태
  private currentTargetId: string | null = null;

  // HIPFIRE_VIEW 타이머
  private hipfireViewElapsed = 0;

  // ZOOMED_CORRECT 상태
  private zoomStartTime = 0;
  private jumpOffsetRecorded = false;
  private jumpOffset = 0;
  private minErrorDuringCorrection = Infinity;
  private hasOvershot = false;

  // 결과 콜백
  private onComplete: ((result: ZoomPhaseResult) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    config: ZoomPhaseConfig,
  ) {
    super(engine, targetManager);
    this.config = config;
    this.metrics = new MetricsCollector();
    this.velocityTracker = new VelocityTracker();
  }

  setOnComplete(cb: (result: ZoomPhaseResult) => void): void {
    this.onComplete = cb;
  }

  /** 시나리오 시작 — hipfire FOV로 시작 */
  start(): void {
    this.targetIndex = 0;
    this.completed = false;
    this.metrics.reset();
    this.velocityTracker.reset();

    // hipfire FOV 적용
    this.engine.setScope(this.config.hipfireFov, 1);
    this.spawnTargetAndShowHipfire();
  }

  update(deltaTime: number): void {
    if (this.completed) return;

    const dtMs = deltaTime * 1000;
    const { yaw, pitch } = this.engine.getRotation();
    this.velocityTracker.record(performance.now(), yaw, pitch);

    switch (this.state) {
      case 'HIPFIRE_VIEW':
        this.hipfireViewElapsed += dtMs;
        // 대기 후 줌 전환
        if (this.hipfireViewElapsed >= PRE_ZOOM_DELAY) {
          this.transitionToZoom();
        }
        break;

      case 'ZOOMED_CORRECT':
        this.updateZoomedCorrection();
        break;

      case 'BETWEEN':
        // 다음 타겟 준비 중
        break;
    }
  }

  /** 클릭 — 줌 보정 상태에서만 유효 */
  onClick(): void {
    if (this.completed || this.state !== 'ZOOMED_CORRECT' || !this.currentTargetId)
      return;

    const now = performance.now();
    const correctionTime = now - this.zoomStartTime;

    const cameraPos = this.engine.getCamera().position;
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(cameraPos, forward);

    const hit = hitResult?.hit ?? false;
    const settledError = hitResult?.angularError ?? Math.PI;

    if (hit && hitResult) {
      const target = this.targetManager.getTarget(hitResult.targetId);
      target?.onHit();
    }

    // 과보정/과소보정 판정
    const overCorrected = this.hasOvershot;
    const underCorrected = !overCorrected && settledError > this.jumpOffset * 0.5;

    // 결과 기록
    const result: ZoomCorrectionResult = {
      jumpOffset: this.jumpOffset,
      correctionTime,
      overCorrected,
      underCorrected,
      settledError,
      hit,
    };
    this.metrics.recordZoomCorrection(result);

    this.advanceTarget();
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): ZoomPhaseResult {
    const corrMetrics = this.metrics.computeZoomCorrectionMetrics();
    const score = calculateZoomCorrectionScore(
      corrMetrics.hitRate,
      corrMetrics.avgCorrectionTime,
      corrMetrics.overCorrectionRatio,
    );
    return { score, phase: 'correction', zoomTier: this.config.zoomTier };
  }

  dispose(): void {
    this.engine.setScope(this.config.hipfireFov, 1);
    super.dispose();
  }

  // === 내부 ===

  /** hipfire에서 타겟 배치 후 대기 시작 */
  private spawnTargetAndShowHipfire(): void {
    const camera = this.engine.getCamera();

    // 타겟 위치: 중앙에서 2~5° 벗어남 (줌 전환 후 보정 필요)
    const offsetDeg = 2 + Math.random() * 3;
    // 120° 방위각 제한 (±60°)
    const azimuth = (Math.random() * 120) - 60;
    const angleRad = offsetDeg * DEG2RAD;
    const azimuthRad = azimuth * DEG2RAD;

    const localDir = new THREE.Vector3(
      Math.sin(angleRad) * Math.cos(azimuthRad),
      Math.sin(angleRad) * Math.sin(azimuthRad - Math.PI / 2),
      -Math.cos(angleRad),
    );
    const worldDir = localDir.applyQuaternion(camera.quaternion);
    const distance = this.config.distance;
    const targetPos = camera.position.clone().addScaledVector(worldDir, distance);

    const target = this.targetManager.spawnTarget(targetPos, {
      angularSizeDeg: this.config.targetSizeDeg,
      distanceM: distance,
      color: TARGET_COLORS.flickRed,
    });
    this.currentTargetId = target.id;

    this.state = 'HIPFIRE_VIEW';
    this.hipfireViewElapsed = 0;
  }

  /** hipfire → zoom 전환 */
  private transitionToZoom(): void {
    // 줌 전환 직전 오차 기록은 다음 프레임에서
    this.engine.setScope(this.config.scopeFov, this.config.scopeMultiplier);
    this.state = 'ZOOMED_CORRECT';
    this.zoomStartTime = performance.now();
    this.jumpOffsetRecorded = false;
    this.minErrorDuringCorrection = Infinity;
    this.hasOvershot = false;
  }

  /** 줌 보정 상태 업데이트 */
  private updateZoomedCorrection(): void {
    if (!this.currentTargetId) return;

    const now = performance.now();
    const target = this.targetManager.getTarget(this.currentTargetId);
    if (!target) return;

    const cameraPos = this.engine.getCamera().position;
    const forward = this.engine.getCameraForward();
    const error = angularDistance(cameraPos, forward, target.position);

    // 줌 직후 첫 프레임: jump offset 기록
    if (!this.jumpOffsetRecorded) {
      this.jumpOffset = error;
      this.jumpOffsetRecorded = true;
    }

    // 오버슛 감지
    if (error < this.minErrorDuringCorrection) {
      this.minErrorDuringCorrection = error;
    } else if (error > this.minErrorDuringCorrection + 0.01) {
      this.hasOvershot = true;
    }

    // 보정 타임아웃
    if (now - this.zoomStartTime > CORRECTION_TIMEOUT) {
      // 타임아웃 → 미스 기록
      const result: ZoomCorrectionResult = {
        jumpOffset: this.jumpOffset,
        correctionTime: CORRECTION_TIMEOUT,
        overCorrected: this.hasOvershot,
        underCorrected: true,
        settledError: error,
        hit: false,
      };
      this.metrics.recordZoomCorrection(result);
      this.advanceTarget();
    }
  }

  /** 다음 타겟 또는 완료 */
  private advanceTarget(): void {
    if (this.currentTargetId) {
      this.targetManager.removeTarget(this.currentTargetId);
      this.currentTargetId = null;
    }

    // hipfire 복귀
    this.engine.setScope(this.config.hipfireFov, 1);

    this.targetIndex++;
    if (this.targetIndex >= this.config.numTargets) {
      this.completed = true;
      const result = this.getResults();
      this.onComplete?.(result);
      return;
    }

    // 다음 타겟 (약간의 딜레이 없이 즉시)
    this.spawnTargetAndShowHipfire();
  }
}
