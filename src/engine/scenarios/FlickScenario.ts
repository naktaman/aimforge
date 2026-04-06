/**
 * Static Flick 시나리오
 * 랜덤 각도/방향에 타겟 출현 → 플릭 → 클릭 → 히트 판정 → 다음 타겟
 * 각도/방향/운동체계별 분리 기록
 *
 * 120° 방위각 제한: 카메라 정면 ±60° 이내에서만 스폰
 * humanoid 타겟: 수평 ±3° 스폰, head/body 히트존 구분
 */
import * as THREE from 'three';
import { Scenario } from './Scenario';
import { MetricsCollector, type FlickTargetResult } from '../metrics/MetricsCollector';
import { VelocityTracker } from '../metrics/VelocityTracker';
import { classifyClick } from '../metrics/ClickClassifier';
import { classifyMotor, calculateMovementDistance } from '../metrics/MotorClassifier';
import { DEG2RAD } from '../../utils/physics';
import { TARGET_COLORS } from '../../config/theme';
import { constrainedAzimuth } from '../SpawnUtils';
import { HIT_ZONE_MULTIPLIER, type HitZoneType } from '../HumanoidTarget';
import type { GameEngine } from '../GameEngine';
import type { TargetManager } from '../TargetManager';
import type { FlickConfig, Direction, TargetType } from '../../utils/types';
import { FLICK_ANGLE_BUCKETS } from '../../config/constants';

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
const BUCKETS = FLICK_ANGLE_BUCKETS;

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

  /** 타겟 타입 (sphere or humanoid) */
  private targetType: TargetType;

  // 궤적 누적 (운동체계 분류용)
  private movementEvents: Array<{ deltaX: number; deltaY: number }> = [];
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
    targetType: TargetType = 'sphere',
  ) {
    super(engine, targetManager);
    this.config = config;
    this.dpi = dpi;
    this.targetType = targetType;
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
      this.recordMiss(now);
      this.advanceTarget();
    }

    // 오버슛 감지: 현재 각도 오차 추적
    if (this.currentTargetId) {
      // sphere + humanoid 통합 위치 조회
      const targetPos = this.targetManager.getTargetPosition(this.currentTargetId);
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
      if (this.targetType === 'humanoid') {
        // humanoid: 히트존별 다른 메쉬에 시각 피드백
        const entry = this.targetManager.getHumanoid(hitResult.targetId);
        if (entry) {
          const zone = (hitResult.hitZone ?? 'upper_body') as HitZoneType;
          // hitMeshes 배열 순서: [0]head [1]torso [2]leftArm [3]rightArm [4]leftLeg [5]rightLeg
          let flashMesh: THREE.Mesh;
          if (zone === 'head') {
            flashMesh = entry.humanoid.headMesh;
          } else if (zone === 'lower_body') {
            flashMesh = entry.humanoid.hitMeshes[4]; // 왼다리 (하체 대표)
          } else {
            flashMesh = entry.humanoid.hitMeshes[1]; // 몸통 (상체 대표)
          }
          entry.humanoid.onHit(flashMesh, zone);
        }
      } else {
        const target = this.targetManager.getTarget(hitResult.targetId);
        target?.onHit();
      }
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

    // 히트존 배율 (humanoid head=2x, body=1x)
    const hitZoneMultiplier = (hit && hitResult?.hitZone)
      ? HIT_ZONE_MULTIPLIER[hitResult.hitZone]
      : 1;

    // Flick 결과 저장
    const result: FlickTargetResult = {
      ttt,
      overshoot: this.minAngularError < angularError ? angularError - this.minAngularError : 0,
      correctionCount: this.correctionCount,
      settleTime: ttt * 0.3,
      pathEfficiency,
      hit,
      angleBucket: this.getNearestBucket(this.targetAngle),
      direction: this.targetDirection,
      motorRegion,
      clickType,
      angularError,
      hitZoneMultiplier,
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

  /** 랜덤 각도/방향에 새 타겟 배치 — 120° 방위각 제한 적용 */
  private spawnNextTarget(): void {
    const [minAngle, maxAngle] = this.config.angleRange;
    this.targetAngle = minAngle + Math.random() * (maxAngle - minAngle);

    // 120° 방위각 제한 (카메라 정면 ±60°)
    const azimuth = constrainedAzimuth();
    const azimuthNormalized = ((azimuth % 360) + 360) % 360;
    this.targetDirection = this.getDirection(azimuthNormalized);

    const camera = this.engine.getCamera();
    const cameraPos = camera.position.clone();
    const distance = 5 + Math.random() * 10;

    const angleRad = this.targetAngle * DEG2RAD;
    const azimuthRad = azimuth * DEG2RAD;

    // humanoid는 수평 ±3° elevation, sphere는 기존 로직 유지
    const elevationRad = this.targetType === 'humanoid'
      ? (Math.random() * 6 - 3) * DEG2RAD
      : (azimuthRad - Math.PI / 2);

    const localDir = new THREE.Vector3(
      Math.sin(angleRad) * Math.cos(azimuthRad),
      Math.sin(angleRad) * Math.sin(elevationRad),
      -Math.cos(angleRad),
    );

    const worldDir = localDir.applyQuaternion(camera.quaternion);
    const targetPos = cameraPos.clone().addScaledVector(worldDir, distance);

    // 타겟 타입에 따라 sphere 또는 humanoid 생성
    if (this.targetType === 'humanoid') {
      const { id } = this.targetManager.spawnHumanoidTarget(
        targetPos,
        { angularSizeDeg: this.config.targetSizeDeg, distanceM: distance },
        cameraPos,
      );
      this.currentTargetId = id;
    } else {
      const target = this.targetManager.spawnTarget(targetPos, {
        angularSizeDeg: this.config.targetSizeDeg,
        distanceM: distance,
        color: TARGET_COLORS.flickRed,
      });
      this.currentTargetId = target.id;
    }

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
