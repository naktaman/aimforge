/**
 * Static Flick 시나리오
 * 랜덤 각도/방향에 타겟 출현 → 플릭 → 클릭 → 히트 판정 → 다음 타겟
 * 각도/방향/운동체계별 분리 기록
 */
import * as THREE from 'three';
import { Scenario } from './Scenario';
import { MetricsCollector, type FlickTargetResult } from '../metrics/MetricsCollector';
import { VelocityTracker } from '../metrics/VelocityTracker';
import { classifyClick } from '../metrics/ClickClassifier';
import { classifyMotor, calculateMovementDistance } from '../metrics/MotorClassifier';
import { DEG2RAD } from '../../utils/physics';
import type { GameEngine } from '../GameEngine';
import type { TargetManager } from '../TargetManager';
import type { FlickConfig, Direction } from '../../utils/types';

/** 8방향 각도 범위 (azimuth 기준) */
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

/** 각도 구간 버킷 */
const BUCKETS = [10, 30, 60, 90, 120, 150, 180];

export class FlickScenario extends Scenario {
  private config: FlickConfig;
  private metrics: MetricsCollector;
  private velocityTracker: VelocityTracker;

  private targetIndex = 0;
  private currentTargetId: string | null = null;
  private targetAppearTime = 0;
  private targetAngle = 0;     // 타겟까지의 각도 (도)
  private targetDirection: Direction = 'right';
  private completed = false;

  // 궤적 누적 (운동체계 분류용)
  private movementEvents: Array<{ delta_x: number; delta_y: number }> = [];
  private dpi: number;

  // 오버슛 추적
  private minAngularError = Infinity;
  private correctionCount = 0;
  private wasApproaching = true;

  // 결과 콜백
  private onComplete: ((results: ReturnType<MetricsCollector['computeFlickMetrics']>) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    config: FlickConfig,
    dpi: number,
  ) {
    super(engine, targetManager);
    this.config = config;
    this.dpi = dpi;
    this.metrics = new MetricsCollector();
    this.velocityTracker = new VelocityTracker();
  }

  /** 완료 콜백 설정 */
  setOnComplete(cb: (results: ReturnType<MetricsCollector['computeFlickMetrics']>) => void): void {
    this.onComplete = cb;
  }

  /** 시나리오 시작 — 첫 타겟 생성 */
  start(): void {
    this.targetIndex = 0;
    this.completed = false;
    this.metrics.reset();
    this.velocityTracker.reset();
    this.spawnNextTarget();
  }

  /** 매 프레임 업데이트 */
  update(_deltaTime: number): void {
    if (this.completed) return;

    const { yaw, pitch } = this.engine.getRotation();
    const now = performance.now();

    // 속도 추적
    this.velocityTracker.record(now, yaw, pitch);

    // 타임아웃 체크
    if (this.currentTargetId && now - this.targetAppearTime > this.config.timeout) {
      // 타임아웃: 미스 처리
      this.recordMiss(now);
      this.advanceTarget();
    }

    // 오버슛 감지: 현재 각도 오차 추적
    if (this.currentTargetId) {
      const target = this.targetManager.getTarget(this.currentTargetId);
      if (target) {
        const forward = this.engine.getCameraForward();
        const cameraPos = this.engine.getCamera().position;
        const toTarget = new THREE.Vector3()
          .subVectors(target.position, cameraPos)
          .normalize();
        const angError = Math.acos(
          Math.max(-1, Math.min(1, forward.dot(toTarget))),
        );

        // 오버슛 감지: 오차가 줄다가 증가하면 오버슛
        if (angError < this.minAngularError) {
          this.minAngularError = angError;
          this.wasApproaching = true;
        } else if (this.wasApproaching && angError > this.minAngularError + 0.02) {
          // 오버슛 발생 → 보정 카운트 증가
          this.correctionCount++;
          this.wasApproaching = false;
        }
      }
    }
  }

  /** 클릭 시 히트 판정 */
  onClick(): void {
    if (this.completed || !this.currentTargetId) return;

    const now = performance.now();
    const ttt = now - this.targetAppearTime;

    // 히트 판정
    const cameraPos = this.engine.getCamera().position;
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(cameraPos, forward);

    // 클릭 분류
    const velocity = this.velocityTracker.getVelocity();
    const acceleration = this.velocityTracker.getAcceleration();
    const isDecel = this.velocityTracker.isDecelerating();
    const clickType = classifyClick(velocity, isDecel);

    // 운동체계 분류
    const moveDist = calculateMovementDistance(this.movementEvents, this.dpi);
    const motorRegion = classifyMotor(moveDist);

    // 히트 피드백
    const hit = hitResult?.hit ?? false;
    if (hit && hitResult) {
      const target = this.targetManager.getTarget(hitResult.targetId);
      target?.onHit();
    }

    // 메트릭 기록
    const angularError = hitResult?.angularError ?? Math.PI;
    this.metrics.recordClick({
      timestamp_us: Date.now() * 1000,
      crosshair_velocity: velocity,
      crosshair_acceleration: acceleration,
      is_decelerating: isDecel,
      angular_error: angularError,
      hit,
      time_since_direction_change: this.velocityTracker.timeSinceDirectionChange(now),
      click_type: clickType,
    });

    // path_efficiency: 직선 거리 / 실제 이동 거리 (간이: 각도 기반)
    const directAngleRad = this.targetAngle * DEG2RAD;
    const pathEfficiency =
      moveDist > 0 ? Math.min(1, directAngleRad / (angularError + directAngleRad)) : 0;

    // Flick 결과 저장
    const result: FlickTargetResult = {
      ttt,
      overshoot: this.minAngularError < angularError ? angularError - this.minAngularError : 0,
      correctionCount: this.correctionCount,
      settleTime: ttt * 0.3, // 간이: TTT의 30%를 안정화 시간으로 추정
      pathEfficiency,
      hit,
      angleBucket: this.getNearestBucket(this.targetAngle),
      direction: this.targetDirection,
      motorRegion,
      clickType,
      angularError,
    };
    this.metrics.addFlickResult(result);

    // 다음 타겟
    this.advanceTarget();
  }

  /** 시나리오 완료 여부 */
  isComplete(): boolean {
    return this.completed;
  }

  /** 결과 반환 */
  getResults() {
    return this.metrics.computeFlickMetrics();
  }

  /** JSON 데이터 (DB 저장용) */
  getTrialJson() {
    return this.metrics.toTrialJson();
  }

  // === 내부 메서드 ===

  /** 다음 타겟으로 진행 */
  private advanceTarget(): void {
    // 현재 타겟 제거
    if (this.currentTargetId) {
      this.targetManager.removeTarget(this.currentTargetId);
      this.currentTargetId = null;
    }

    this.targetIndex++;
    if (this.targetIndex >= this.config.numTargets) {
      this.completed = true;
      const results = this.metrics.computeFlickMetrics();
      this.onComplete?.(results);
      return;
    }

    this.spawnNextTarget();
  }

  /** 랜덤 각도/방향에 새 타겟 배치 */
  private spawnNextTarget(): void {
    const [minAngle, maxAngle] = this.config.angleRange;

    // 랜덤 각도 선택
    this.targetAngle = minAngle + Math.random() * (maxAngle - minAngle);

    // 랜덤 방향 (8방향 중 하나)
    const azimuth = Math.random() * 360;
    this.targetDirection = this.getDirection(azimuth);

    // 카메라 기준 타겟 위치 계산
    const camera = this.engine.getCamera();
    const cameraPos = camera.position.clone();

    // 거리: hipfire 기준 5~15m
    const distance = 5 + Math.random() * 10;

    // 구면 좌표 → 카메라 로컬 좌표 → 월드 좌표
    const angleRad = this.targetAngle * DEG2RAD;
    const azimuthRad = azimuth * DEG2RAD;

    // 카메라 로컬 좌표계에서의 타겟 방향
    const localDir = new THREE.Vector3(
      Math.sin(angleRad) * Math.cos(azimuthRad),
      Math.sin(angleRad) * Math.sin(azimuthRad - Math.PI / 2), // 위/아래
      -Math.cos(angleRad), // 전방
    );

    // 카메라 quaternion으로 월드 방향 변환
    const worldDir = localDir.applyQuaternion(camera.quaternion);
    const targetPos = cameraPos.clone().addScaledVector(worldDir, distance);

    // 타겟 생성
    const target = this.targetManager.spawnTarget(targetPos, {
      angularSizeDeg: this.config.targetSizeDeg,
      distanceM: distance,
      color: 0xe94560,
    });
    this.currentTargetId = target.id;
    this.targetAppearTime = performance.now();

    // 추적 상태 초기화
    this.movementEvents = [];
    this.minAngularError = Infinity;
    this.correctionCount = 0;
    this.wasApproaching = true;
  }

  /** 타임아웃 미스 처리 */
  private recordMiss(now: number): void {
    const ttt = now - this.targetAppearTime;
    const moveDist = calculateMovementDistance(this.movementEvents, this.dpi);

    this.metrics.addFlickResult({
      ttt,
      overshoot: 0,
      correctionCount: this.correctionCount,
      settleTime: ttt,
      pathEfficiency: 0,
      hit: false,
      angleBucket: this.getNearestBucket(this.targetAngle),
      direction: this.targetDirection,
      motorRegion: classifyMotor(moveDist),
      clickType: 'Flick',
      angularError: Math.PI,
    });
  }

  /** azimuth 각도 → 8방향 분류 */
  private getDirection(azimuthDeg: number): Direction {
    // 0~360 정규화
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
