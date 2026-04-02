/**
 * Micro-Flick 시나리오 (Tracking + Flick 하이브리드)
 * 메인 타겟을 트래킹하다가 랜덤 간격으로 인터럽트 타겟 출현
 * 인터럽트 플릭 후 메인 타겟 재획득 시간 측정
 * 실전 FPS에서 트래킹 중 갑작스런 적 출현 대응 시뮬
 */
import * as THREE from 'three';
import { Scenario } from './Scenario';
import { MetricsCollector, type FlickTargetResult } from '../metrics/MetricsCollector';
import { VelocityTracker } from '../metrics/VelocityTracker';
import { classifyClick } from '../metrics/ClickClassifier';
import { classifyMotor, calculateMovementDistance } from '../metrics/MotorClassifier';
import { angularDistance } from '../HitDetection';
import { DEG2RAD, RAD2DEG } from '../../utils/physics';
import { constrainedAzimuth } from '../SpawnUtils';
import type { GameEngine } from '../GameEngine';
import type { TargetManager } from '../TargetManager';
import type { MicroFlickConfig, Direction } from '../../utils/types';
import type { MicroFlickTrialMetrics } from '../../utils/types';
import {
  calculateTrackingScore,
  calculateFlickScore,
  calculateMicroFlickScore,
} from '../metrics/CompositeScore';

/** 상태 머신 */
type MFState = 'TRACKING' | 'FLICK_INTERRUPT' | 'RE_ACQUIRE';

/** 8방향 */
const DIRECTION_SECTORS: Array<{ dir: Direction; min: number; max: number }> = [
  { dir: 'right', min: -22.5, max: 22.5 },
  { dir: 'upper_right', min: 22.5, max: 67.5 },
  { dir: 'up', min: 67.5, max: 112.5 },
  { dir: 'upper_left', min: 112.5, max: 157.5 },
  { dir: 'left', min: 157.5, max: 202.5 },
  { dir: 'lower_left', min: 202.5, max: 247.5 },
  { dir: 'down', min: 247.5, max: 292.5 },
  { dir: 'lower_right', min: 292.5, max: 337.5 },
];

const BUCKETS = [10, 30, 60, 90, 120, 150, 180];

/** 재획득 판정 임계값: 타겟 각도 반지름의 2배 이내 */
const REACQUIRE_MULTIPLIER = 2;
/** 인터럽트 플릭 타임아웃 (ms) */
const FLICK_TIMEOUT = 3000;

export class MicroFlickScenario extends Scenario {
  private config: MicroFlickConfig;
  private metrics: MetricsCollector;
  private velocityTracker: VelocityTracker;

  private state: MFState = 'TRACKING';
  private elapsedMs = 0;
  private completed = false;

  // 메인 트래킹 타겟
  private mainTargetId: string | null = null;
  private moveDirection = 1;
  private targetDistance: number;
  private prevTargetPos: THREE.Vector3 | null = null;

  // 인터럽트 플릭 타겟
  private interruptTargetId: string | null = null;
  private interruptAppearTime = 0;
  private interruptAngle = 0;
  private interruptDirection: Direction = 'right';

  // 인터럽트 타이머
  private nextInterruptMs = 0; // 다음 인터럽트까지 남은 시간
  private interruptIntervalMs: number; // 인터럽트 간격 (ms)

  // 재획득 타이머
  private reacquireStartTime = 0;

  // 궤적 누적 (운동체계 분류용)
  private movementEvents: Array<{ deltaX: number; deltaY: number }> = [];
  private dpi: number;

  // 오버슛 추적 (플릭용)
  private minAngularError = Infinity;
  private correctionCount = 0;
  private wasApproaching = true;

  // 메인 타겟 각도 반지름 (재획득 판정용)
  private mainTargetAngularRadius = 0;

  // 결과 콜백
  private onComplete: ((results: MicroFlickTrialMetrics) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    config: MicroFlickConfig,
    dpi: number,
  ) {
    super(engine, targetManager);
    this.config = config;
    this.dpi = dpi;
    this.targetDistance = config.distance;
    this.interruptIntervalMs = 1000 / config.switchFrequencyHz;
    this.metrics = new MetricsCollector();
    this.velocityTracker = new VelocityTracker();
  }

  /** 완료 콜백 설정 */
  setOnComplete(cb: (results: MicroFlickTrialMetrics) => void): void {
    this.onComplete = cb;
  }

  /** 시나리오 시작 */
  start(): void {
    this.elapsedMs = 0;
    this.completed = false;
    this.state = 'TRACKING';
    this.metrics.reset();
    this.velocityTracker.reset();
    this.moveDirection = 1;

    // 메인 트래킹 타겟 생성 (카메라 정면)
    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const targetPos = camera.position
      .clone()
      .addScaledVector(forward, this.targetDistance);

    const target = this.targetManager.spawnTarget(targetPos, {
      angularSizeDeg: this.config.targetSizeDeg,
      distanceM: this.targetDistance,
      color: 0x4ade80,
      movementType: 'static',
    });
    this.mainTargetId = target.id;
    this.prevTargetPos = targetPos.clone();

    // 타겟 각도 반지름 계산
    this.mainTargetAngularRadius =
      Math.atan(
        this.targetDistance *
          Math.tan((this.config.targetSizeDeg / 2) * DEG2RAD) /
          this.targetDistance,
      );

    // 첫 인터럽트 타이머
    this.nextInterruptMs = this.interruptIntervalMs;
  }

  /** 매 프레임 업데이트 */
  update(deltaTime: number): void {
    if (this.completed) return;

    const dtMs = deltaTime * 1000;
    this.elapsedMs += dtMs;

    // 시간 종료 체크
    if (this.elapsedMs >= this.config.duration) {
      this.completed = true;
      this.finalize();
      return;
    }

    // 속도 추적
    const { yaw, pitch } = this.engine.getRotation();
    this.velocityTracker.record(performance.now(), yaw, pitch);

    // 메인 타겟은 항상 이동 (상태와 무관)
    this.moveMainTarget(deltaTime);

    switch (this.state) {
      case 'TRACKING':
        this.updateTracking(dtMs, deltaTime);
        break;
      case 'FLICK_INTERRUPT':
        this.updateFlickInterrupt();
        break;
      case 'RE_ACQUIRE':
        this.updateReacquire();
        break;
    }
  }

  /** 클릭 처리 (FLICK_INTERRUPT 상태에서만 유효) */
  onClick(): void {
    if (this.completed || this.state !== 'FLICK_INTERRUPT' || !this.interruptTargetId)
      return;

    const now = performance.now();
    const ttt = now - this.interruptAppearTime;

    const cameraPos = this.engine.getCamera().position;
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(cameraPos, forward);

    // 클릭/운동체계 분류
    const velocity = this.velocityTracker.getVelocity();
    const isDecel = this.velocityTracker.isDecelerating();
    const clickType = classifyClick(velocity, isDecel);
    const moveDist = calculateMovementDistance(this.movementEvents, this.dpi);
    const motorRegion = classifyMotor(moveDist);

    const hit = hitResult?.hit ?? false;
    if (hit && hitResult) {
      const target = this.targetManager.getTarget(hitResult.targetId);
      target?.onHit();
    }

    const angularError = hitResult?.angularError ?? Math.PI;
    const directAngleRad = this.interruptAngle * DEG2RAD;
    const pathEfficiency =
      moveDist > 0
        ? Math.min(1, directAngleRad / (angularError + directAngleRad))
        : 0;

    // 플릭 결과 저장
    const result: FlickTargetResult = {
      ttt,
      overshoot:
        this.minAngularError < angularError
          ? angularError - this.minAngularError
          : 0,
      correctionCount: this.correctionCount,
      settleTime: ttt * 0.3,
      pathEfficiency,
      hit,
      angleBucket: this.getNearestBucket(this.interruptAngle),
      direction: this.interruptDirection,
      motorRegion,
      clickType,
      angularError,
    };
    this.metrics.addFlickResult(result);

    // 인터럽트 타겟 제거 → 재획득 상태로
    this.removeInterruptTarget();
    this.state = 'RE_ACQUIRE';
    this.reacquireStartTime = performance.now();
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): MicroFlickTrialMetrics {
    return this.computeResults();
  }

  getTrialJson() {
    return this.metrics.toTrialJson();
  }

  // === 내부 메서드 ===

  /** TRACKING 상태: 오차 측정 + 인터럽트 타이머 */
  private updateTracking(dtMs: number, deltaTime: number): void {
    // 트래킹 오차 측정
    if (this.mainTargetId) {
      const target = this.targetManager.getTarget(this.mainTargetId);
      if (target) {
        this.measureTrackingError(target, deltaTime);
      }
    }

    // 인터럽트 타이머 감소
    this.nextInterruptMs -= dtMs;
    if (this.nextInterruptMs <= 0) {
      this.spawnInterruptTarget();
      this.state = 'FLICK_INTERRUPT';
      this.nextInterruptMs = this.interruptIntervalMs;
    }
  }

  /** FLICK_INTERRUPT 상태: 오버슛 감지 + 타임아웃 */
  private updateFlickInterrupt(): void {
    if (!this.interruptTargetId) return;

    const now = performance.now();

    // 타임아웃
    if (now - this.interruptAppearTime > FLICK_TIMEOUT) {
      // 미스 처리
      const moveDist = calculateMovementDistance(this.movementEvents, this.dpi);
      this.metrics.addFlickResult({
        ttt: FLICK_TIMEOUT,
        overshoot: 0,
        correctionCount: this.correctionCount,
        settleTime: FLICK_TIMEOUT,
        pathEfficiency: 0,
        hit: false,
        angleBucket: this.getNearestBucket(this.interruptAngle),
        direction: this.interruptDirection,
        motorRegion: classifyMotor(moveDist),
        clickType: 'Flick',
        angularError: Math.PI,
      });

      this.removeInterruptTarget();
      this.state = 'RE_ACQUIRE';
      this.reacquireStartTime = now;
      return;
    }

    // 오버슛 감지 (sphere + humanoid 통합)
    const targetPos = this.targetManager.getTargetPosition(this.interruptTargetId);
    if (targetPos) {
      const forward = this.engine.getCameraForward();
      const cameraPos = this.engine.getCamera().position;
      const toTarget = new THREE.Vector3()
        .subVectors(targetPos, cameraPos)
        .normalize();
      const angError = Math.acos(
        Math.max(-1, Math.min(1, forward.dot(toTarget))),
      );

      if (angError < this.minAngularError) {
        this.minAngularError = angError;
        this.wasApproaching = true;
      } else if (this.wasApproaching && angError > this.minAngularError + 0.02) {
        this.correctionCount++;
        this.wasApproaching = false;
      }
    }
  }

  /** RE_ACQUIRE 상태: 메인 타겟 재획득 판정 */
  private updateReacquire(): void {
    if (!this.mainTargetId) return;

    const target = this.targetManager.getTarget(this.mainTargetId);
    if (!target) return;

    const cameraPos = this.engine.getCamera().position;
    const forward = this.engine.getCameraForward();
    const error = angularDistance(cameraPos, forward, target.position);

    // 재획득 판정: 타겟 각도 반지름 × 2 이내
    const threshold = this.mainTargetAngularRadius * REACQUIRE_MULTIPLIER;
    if (error <= threshold) {
      const reacquireTime = performance.now() - this.reacquireStartTime;
      this.metrics.recordReacquireTime(reacquireTime);
      this.state = 'TRACKING';
    }
  }

  /** 메인 타겟 수평 이동 */
  private moveMainTarget(dt: number): void {
    if (!this.mainTargetId) return;

    const target = this.targetManager.getTarget(this.mainTargetId);
    if (!target) return;

    const speedMs =
      this.targetDistance *
      Math.tan(this.config.trackingSpeedDegPerSec * DEG2RAD) *
      dt;

    this.prevTargetPos = target.position.clone();
    target.position.x += speedMs * this.moveDirection;
    target.mesh.position.copy(target.position);

    // 각도 제한 (±30°)으로 방향 전환
    const cameraPos = this.engine.getCamera().position;
    const toTarget = new THREE.Vector3()
      .subVectors(target.position, cameraPos)
      .normalize();
    const forward = new THREE.Vector3(0, 0, -1);
    const angle = Math.acos(
      Math.max(-1, Math.min(1, forward.dot(toTarget))),
    );
    if (angle > 30 * DEG2RAD) {
      this.moveDirection *= -1;
    }
  }

  /** 트래킹 오차 측정 */
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

  /** 인터럽트 플릭 타겟 스폰 — 120° 방위각 제한 */
  private spawnInterruptTarget(): void {
    const [minAngle, maxAngle] = this.config.flickAngleRange;
    this.interruptAngle = minAngle + Math.random() * (maxAngle - minAngle);

    // 120° 방위각 제한 (±60°)
    const azimuth = constrainedAzimuth();
    const azimuthNormalized = ((azimuth % 360) + 360) % 360;
    this.interruptDirection = this.getDirection(azimuthNormalized);

    const camera = this.engine.getCamera();
    const distance = 5 + Math.random() * 10;

    const angleRad = this.interruptAngle * DEG2RAD;
    const azimuthRad = azimuth * DEG2RAD;

    const localDir = new THREE.Vector3(
      Math.sin(angleRad) * Math.cos(azimuthRad),
      Math.sin(angleRad) * Math.sin(azimuthRad - Math.PI / 2),
      -Math.cos(angleRad),
    );

    const worldDir = localDir.applyQuaternion(camera.quaternion);
    const targetPos = camera.position
      .clone()
      .addScaledVector(worldDir, distance);

    const target = this.targetManager.spawnTarget(targetPos, {
      angularSizeDeg: this.config.targetSizeDeg * 0.8, // 인터럽트 타겟은 약간 작게
      distanceM: distance,
      color: 0xff6b6b, // 밝은 빨강 (구분용)
    });
    this.interruptTargetId = target.id;
    this.interruptAppearTime = performance.now();

    // 추적 상태 초기화
    this.movementEvents = [];
    this.minAngularError = Infinity;
    this.correctionCount = 0;
    this.wasApproaching = true;
  }

  /** 인터럽트 타겟 제거 */
  private removeInterruptTarget(): void {
    if (this.interruptTargetId) {
      this.targetManager.removeTarget(this.interruptTargetId);
      this.interruptTargetId = null;
    }
  }

  /** 최종 결과 계산 */
  private computeResults(): MicroFlickTrialMetrics {
    const hybrid = this.metrics.computeHybridMetrics('horizontal');
    const trackingScore = calculateTrackingScore(
      hybrid.tracking.mad,
      hybrid.tracking.velocityMatchRatio,
    );
    const flickScore = calculateFlickScore(
      hybrid.flick.hitRate,
      hybrid.flick.avgTtt,
      hybrid.flick.avgOvershoot,
      hybrid.flick.preFireRatio,
    );
    const compositeScore = calculateMicroFlickScore(
      trackingScore,
      flickScore,
      hybrid.avgReacquireTimeMs,
    );

    return {
      trackingMad: hybrid.tracking.mad,
      trackingVelocityMatch: hybrid.tracking.velocityMatchRatio,
      flickHitRate: hybrid.flick.hitRate,
      flickAvgTtt: hybrid.flick.avgTtt,
      avgReacquireTimeMs: hybrid.avgReacquireTimeMs,
      compositeScore,
    };
  }

  /** 시나리오 종료 처리 */
  private finalize(): void {
    this.removeInterruptTarget();
    const results = this.computeResults();
    this.onComplete?.(results);
  }

  /** azimuth → 8방향 */
  private getDirection(azimuthDeg: number): Direction {
    const norm = ((azimuthDeg % 360) + 360) % 360;
    for (const sector of DIRECTION_SECTORS) {
      if (sector.min < 0) {
        if (norm >= 360 + sector.min || norm < sector.max) return sector.dir;
      } else if (norm >= sector.min && norm < sector.max) {
        return sector.dir;
      }
    }
    return 'right';
  }

  /** 각도 → 가장 가까운 버킷 */
  private getNearestBucket(angleDeg: number): number {
    let closest = BUCKETS[0];
    let minDiff = Infinity;
    for (const bucket of BUCKETS) {
      const diff = Math.abs(angleDeg - bucket);
      if (diff < minDiff) {
        minDiff = diff;
        closest = bucket;
      }
    }
    return closest;
  }
}
