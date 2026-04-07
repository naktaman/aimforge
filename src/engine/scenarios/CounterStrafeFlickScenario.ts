/**
 * Counter-Strafe Flick 시나리오
 * 환경이 시각적으로 스트레이프(좌우 이동) → 정지 → 타겟 출현 → 플릭
 * FPS에서 스트레이프 정지 후 사격하는 패턴 시뮬레이션
 * stop_time 적용으로 정지 타이밍 적응 측정
 */
import * as THREE from 'three';
import { Scenario } from './Scenario';
import { MetricsCollector, type FlickTargetResult } from '../metrics/MetricsCollector';
import { VelocityTracker } from '../metrics/VelocityTracker';
import { classifyClick } from '../metrics/ClickClassifier';
import { classifyMotor, calculateMovementDistance } from '../metrics/MotorClassifier';
import { DEG2RAD } from '../../utils/physics';
import { constrainedAzimuth } from '../SpawnUtils';
import { HIT_ZONE_MULTIPLIER, type HitZoneType } from '../HumanoidTarget';
import { TARGET_COLORS } from '../../config/theme';
import type { GameEngine } from '../GameEngine';
import type { TargetManager } from '../TargetManager';
import type { CounterStrafeFlickConfig, Direction, TargetType } from '../../utils/types';

/** 상태 머신 */
type CSState = 'STRAFING' | 'STOPPING' | 'FLICK';

/** 8방향 각도 범위 */
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

export class CounterStrafeFlickScenario extends Scenario {
  private config: CounterStrafeFlickConfig;
  private metrics: MetricsCollector;
  private velocityTracker: VelocityTracker;

  private state: CSState = 'STRAFING';
  private targetIndex = 0;
  private completed = false;

  // 스트레이프 상태
  private strafeDirection = 1; // 1=우, -1=좌
  private strafeDurationMs = 0; // 현재 스트레이프 지속 시간
  private strafeElapsedMs = 0;
  private envGroup: THREE.Group | null = null;

  // 정지 대기 타이머
  private stopElapsedMs = 0;

  // 플릭 상태
  private currentTargetId: string | null = null;
  private targetAppearTime = 0;
  private targetAngle = 0;
  private targetDirection: Direction = 'right';
  private movementEvents: Array<{ deltaX: number; deltaY: number }> = [];
  private dpi: number;
  private targetType: TargetType;
  private minAngularError = Infinity;
  private correctionCount = 0;
  private wasApproaching = true;

  // 결과 콜백
  private onComplete: ((results: ReturnType<MetricsCollector['computeFlickMetrics']>) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    config: CounterStrafeFlickConfig,
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

  /** 시나리오 시작 */
  start(): void {
    this.targetIndex = 0;
    this.completed = false;
    this.metrics.reset();
    this.velocityTracker.reset();

    // 환경 그룹 참조 획득
    this.envGroup = this.engine.getEnvironmentGroup();

    // 첫 스트레이프 시작
    this.startStrafe();
  }

  /** 매 프레임 업데이트 — 상태 머신 기반 */
  update(deltaTime: number): void {
    if (this.completed) return;

    const dtMs = deltaTime * 1000;
    const { yaw, pitch } = this.engine.getRotation();
    this.velocityTracker.record(performance.now(), yaw, pitch);

    switch (this.state) {
      case 'STRAFING':
        this.updateStrafe(dtMs, deltaTime);
        break;
      case 'STOPPING':
        this.updateStopping(dtMs);
        break;
      case 'FLICK':
        this.updateFlick();
        break;
    }
  }

  /** 클릭 시 히트 판정 (FLICK 상태에서만 유효) */
  onClick(): void {
    if (this.completed || this.state !== 'FLICK' || !this.currentTargetId) return;

    const now = performance.now();
    const ttt = now - this.targetAppearTime;

    const cameraPos = this.engine.getCamera().position;
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(cameraPos, forward);

    // 클릭/운동체계 분류
    const velocity = this.velocityTracker.getVelocity();
    const acceleration = this.velocityTracker.getAcceleration();
    const isDecel = this.velocityTracker.isDecelerating();
    const clickType = classifyClick(velocity, isDecel);
    const moveDist = calculateMovementDistance(this.movementEvents, this.dpi);
    const motorRegion = classifyMotor(moveDist);

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
          } else if (zone === 'limbs') {
            flashMesh = entry.humanoid.hitMeshes[2]; // 왼팔 (팔 대표)
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

    const angularError = hitResult?.angularError ?? Math.PI;

    // 히트존 배율
    const hitZoneMultiplier = (hit && hitResult?.hitZone)
      ? HIT_ZONE_MULTIPLIER[hitResult.hitZone]
      : 1;

    // 메트릭 기록
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

    const directAngleRad = this.targetAngle * DEG2RAD;
    const pathEfficiency =
      moveDist > 0 ? Math.min(1, directAngleRad / (angularError + directAngleRad)) : 0;

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

    // 다음 타겟으로 진행
    this.advanceTarget();
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults() {
    return this.metrics.computeFlickMetrics();
  }

  getTrialJson() {
    return this.metrics.toTrialJson();
  }

  /** 리소스 정리 — 환경 그룹 위치 복원 */
  dispose(): void {
    if (this.envGroup) {
      this.envGroup.position.x = 0;
    }
    super.dispose();
  }

  // === 내부 메서드 ===

  /** 스트레이프 시작 — 랜덤 방향/지속시간 설정 */
  private startStrafe(): void {
    this.state = 'STRAFING';
    this.strafeDirection = Math.random() > 0.5 ? 1 : -1;
    // 스트레이프 지속: 1~2초 랜덤
    this.strafeDurationMs = 1000 + Math.random() * 1000;
    this.strafeElapsedMs = 0;
  }

  /** STRAFING 상태: 환경 좌우 이동 */
  private updateStrafe(dtMs: number, dt: number): void {
    this.strafeElapsedMs += dtMs;

    // 환경 그룹 이동 (시각적 스트레이프 시뮬)
    if (this.envGroup) {
      const speedMs =
        10 * Math.tan(this.config.strafeSpeedDegPerSec * DEG2RAD) * dt;
      this.envGroup.position.x += speedMs * this.strafeDirection;
    }

    // 스트레이프 완료 → STOPPING 전환
    if (this.strafeElapsedMs >= this.strafeDurationMs) {
      this.state = 'STOPPING';
      this.stopElapsedMs = 0;
    }
  }

  /** STOPPING 상태: stop_time 대기 후 타겟 스폰 */
  private updateStopping(dtMs: number): void {
    this.stopElapsedMs += dtMs;

    if (this.stopElapsedMs >= this.config.stopTimeMs) {
      // 환경 정지 확인 (위치 유지)
      this.state = 'FLICK';
      this.spawnFlickTarget();
    }
  }

  /** FLICK 상태: 타임아웃 + 오버슛 체크 */
  private updateFlick(): void {
    if (!this.currentTargetId) return;

    const now = performance.now();

    // 타임아웃 체크
    if (now - this.targetAppearTime > this.config.timeout) {
      this.recordMiss(now);
      this.advanceTarget();
      return;
    }

    // 오버슛 감지 (sphere + humanoid 통합)
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

  /** 다음 타겟으로 진행 또는 완료 */
  private advanceTarget(): void {
    if (this.currentTargetId) {
      this.targetManager.removeTarget(this.currentTargetId);
      this.currentTargetId = null;
    }

    // 환경 위치 초기화
    if (this.envGroup) {
      this.envGroup.position.x = 0;
    }

    this.targetIndex++;
    if (this.targetIndex >= this.config.numTargets) {
      this.completed = true;
      const results = this.metrics.computeFlickMetrics();
      this.onComplete?.(results);
      return;
    }

    // 다음 스트레이프 사이클
    this.startStrafe();
  }

  /** 플릭 타겟 스폰 — 120° 방위각 제한 적용 */
  private spawnFlickTarget(): void {
    const [minAngle, maxAngle] = this.config.angleRange;
    this.targetAngle = minAngle + Math.random() * (maxAngle - minAngle);

    // 120° 방위각 제한 (±60°)
    const azimuth = constrainedAzimuth();
    const azimuthNormalized = ((azimuth % 360) + 360) % 360;
    this.targetDirection = this.getDirection(azimuthNormalized);

    const camera = this.engine.getCamera();
    const cameraPos = camera.position.clone();
    const distance = 5 + Math.random() * 10;

    const angleRad = this.targetAngle * DEG2RAD;
    const azimuthRad = azimuth * DEG2RAD;

    // humanoid는 수평 ±3° elevation
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
