/**
 * Strafe Tracking 시나리오 — 좌우 스트레이핑 적 트래킹
 * CS2/발로란트 스타일: ADAD 스트레이핑, 긴 노출/짧은 노출 혼합
 * 방향 전환 예측 + 연속 트래킹
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import type { DifficultyConfig } from '../../../utils/types';
import { STAGE_COLORS } from '../../../config/theme';

/** 스트레이핑 패턴 타입 */
type StrafePattern = 'adad' | 'wide_strafe' | 'jiggle_peek' | 'random_stop';

/** 측정 데이터 */
interface TrackingSample {
  errorDeg: number;
  timestamp: number;
  targetMoving: boolean;
  directionChange: boolean;
}

export class StrafeTrackingScenario extends Scenario {
  private difficulty: DifficultyConfig;
  private durationMs: number;
  private completed = false;
  private startTime = 0;
  private currentTargetId: string | null = null;

  // 스트레이핑 파라미터
  private pattern: StrafePattern;
  private strafeSpeed: number; // m/s
  private basePos: THREE.Vector3;
  private moveDirection = 1;
  private lastDirectionChange = 0;
  private nextChangeInterval = 0;
  private currentX = 0;
  private stopped = false;

  // 측정 데이터
  private samples: TrackingSample[] = [];
  private sampleInterval = 16;
  private lastSampleTime = 0;
  private prevDirection = 1;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    difficulty: DifficultyConfig,
    pattern: StrafePattern = 'adad',
    durationMs = 15000,
  ) {
    super(engine, targetManager);
    this.difficulty = difficulty;
    this.durationMs = durationMs;
    this.pattern = pattern;

    // 스트레이핑 속도 — 난이도 연동
    this.strafeSpeed = 2 + difficulty.targetSpeedDegPerSec / 8;

    // 기본 위치 — 전방 10m
    const dist = 10;
    this.basePos = new THREE.Vector3(0, 1.6, -dist);
  }

  setOnComplete(cb: (results: unknown) => void): void {
    this.onCompleteCallback = cb;
  }

  start(): void {
    this.completed = false;
    this.samples = [];
    this.startTime = performance.now();
    this.lastSampleTime = 0;
    this.currentX = 0;
    this.moveDirection = 1;
    this.lastDirectionChange = 0;
    this.nextChangeInterval = this.getNextChangeInterval();

    // 초기 타겟 스폰
    const target = this.targetManager.spawnTarget(
      this.basePos.clone(),
      {
        angularSizeDeg: this.difficulty.targetSizeDeg,
        distanceM: this.basePos.length(),
        color: STAGE_COLORS.strafeTracking,
      },
    );
    this.currentTargetId = target.id;
  }

  update(deltaTime: number): void {
    if (this.completed) return;

    const elapsed = performance.now() - this.startTime;

    // 시간 초과 → 완료
    if (elapsed >= this.durationMs) {
      this.finish();
      return;
    }

    // 타겟 위치 업데이트
    if (this.currentTargetId) {
      this.updateStrafePosition(deltaTime * 1000, elapsed);

      // 트래킹 에러 샘플링
      if (elapsed - this.lastSampleTime >= this.sampleInterval) {
        this.sampleTrackingError(elapsed);
        this.lastSampleTime = elapsed;
      }
    }
  }

  onClick(): void {
    // 트래킹 시나리오 — 클릭 불필요
  }

  /** 패턴별 스트레이핑 위치 업데이트 */
  private updateStrafePosition(dtMs: number, elapsedMs: number): void {
    const timeSinceChange = elapsedMs - this.lastDirectionChange;

    switch (this.pattern) {
      case 'adad': {
        // AD 반복 — 일정 간격으로 방향 전환
        if (timeSinceChange >= this.nextChangeInterval) {
          this.moveDirection *= -1;
          this.lastDirectionChange = elapsedMs;
          this.nextChangeInterval = this.getNextChangeInterval();
        }
        this.currentX += this.moveDirection * this.strafeSpeed * (dtMs / 1000);
        // 이동 범위 제한
        this.currentX = Math.max(-5, Math.min(5, this.currentX));
        break;
      }

      case 'wide_strafe': {
        // 넓은 좌우 이동 — 탱크/느린 캐릭터 스타일
        if (Math.abs(this.currentX) >= 6) {
          this.moveDirection *= -1;
          this.lastDirectionChange = elapsedMs;
        }
        this.currentX += this.moveDirection * this.strafeSpeed * 0.7 * (dtMs / 1000);
        break;
      }

      case 'jiggle_peek': {
        // 지글 피크 — 짧은 노출 후 복귀 반복
        const jiggleDuration = 200 + Math.random() * 150; // 200~350ms 노출
        if (timeSinceChange < jiggleDuration) {
          this.currentX += this.moveDirection * this.strafeSpeed * 1.5 * (dtMs / 1000);
        } else if (timeSinceChange < jiggleDuration * 2) {
          this.currentX -= this.moveDirection * this.strafeSpeed * 1.5 * (dtMs / 1000);
        } else {
          this.moveDirection *= (Math.random() > 0.3 ? -1 : 1);
          this.lastDirectionChange = elapsedMs;
        }
        this.currentX = Math.max(-3, Math.min(3, this.currentX));
        break;
      }

      case 'random_stop': {
        // 랜덤 정지 — 이동 중 갑자기 멈춤 (헤드샷 타이밍)
        if (this.stopped) {
          if (timeSinceChange >= 300 + Math.random() * 400) {
            this.stopped = false;
            this.moveDirection = Math.random() > 0.5 ? 1 : -1;
            this.lastDirectionChange = elapsedMs;
          }
        } else {
          this.currentX += this.moveDirection * this.strafeSpeed * (dtMs / 1000);
          if (timeSinceChange >= this.nextChangeInterval) {
            if (Math.random() > 0.5) {
              this.stopped = true;
            } else {
              this.moveDirection *= -1;
            }
            this.lastDirectionChange = elapsedMs;
            this.nextChangeInterval = this.getNextChangeInterval();
          }
        }
        this.currentX = Math.max(-5, Math.min(5, this.currentX));
        break;
      }
    }

    // 위치 적용
    const newPos = this.basePos.clone();
    newPos.x = this.currentX;
    this.targetManager.updateTargetPosition(this.currentTargetId!, newPos);
  }

  /** 다음 방향 전환 간격 (ms) */
  private getNextChangeInterval(): number {
    switch (this.pattern) {
      case 'adad': return 300 + Math.random() * 500; // 300~800ms
      case 'wide_strafe': return 1000 + Math.random() * 1000;
      case 'jiggle_peek': return 400 + Math.random() * 300;
      case 'random_stop': return 500 + Math.random() * 700;
      default: return 500;
    }
  }

  /** 트래킹 에러 샘플 수집 */
  private sampleTrackingError(timestamp: number): void {
    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);

    const directionChanged = this.moveDirection !== this.prevDirection;
    this.prevDirection = this.moveDirection;

    if (hitResult) {
      const errorDeg = hitResult.angularError * (180 / Math.PI);
      this.samples.push({
        errorDeg,
        timestamp,
        targetMoving: !this.stopped,
        directionChange: directionChanged,
      });
    }
  }

  /** 시나리오 종료 */
  private finish(): void {
    this.completed = true;
    if (this.currentTargetId) {
      this.targetManager.removeTarget(this.currentTargetId);
      this.currentTargetId = null;
    }
    if (this.onCompleteCallback) {
      this.onCompleteCallback(this.getResults());
    }
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): unknown {
    if (this.samples.length === 0) {
      return {
        stageType: 'strafe_tracking',
        mad: 999,
        accuracy: 0,
        score: 0,
        samples: 0,
        pattern: this.pattern,
      };
    }

    // MAD
    const mad = this.samples.reduce((s, sample) => s + sample.errorDeg, 0) / this.samples.length;

    // 타겟 이내 비율
    const targetRadDeg = this.difficulty.targetSizeDeg / 2;
    const onTarget = this.samples.filter((s) => s.errorDeg <= targetRadDeg).length;
    const accuracy = onTarget / this.samples.length;

    // 방향 전환 시점 정확도 — 전환 후 200ms 샘플
    const changeWindows = this.samples.filter((s) => s.directionChange);
    const changeAccuracy = changeWindows.length > 0
      ? changeWindows.filter((s) => s.errorDeg <= targetRadDeg).length / changeWindows.length
      : 0;

    // 이동 중 vs 정지 시 비교 (random_stop 패턴)
    const movingSamples = this.samples.filter((s) => s.targetMoving);
    const stoppedSamples = this.samples.filter((s) => !s.targetMoving);
    const movingAccuracy = movingSamples.length > 0
      ? movingSamples.filter((s) => s.errorDeg <= targetRadDeg).length / movingSamples.length : 0;
    const stoppedAccuracy = stoppedSamples.length > 0
      ? stoppedSamples.filter((s) => s.errorDeg <= targetRadDeg).length / stoppedSamples.length : 0;

    // 점수: accuracy 50% + MAD 30% + 방향전환 반응 20%
    const score = accuracy * 50
      + (1 - Math.min(mad / 10, 1)) * 30
      + changeAccuracy * 20;

    return {
      stageType: 'strafe_tracking',
      mad,
      accuracy,
      score,
      samples: this.samples.length,
      pattern: this.pattern,
      changeAccuracy,
      movingAccuracy,
      stoppedAccuracy,
      trackingMad: mad,
      durationMs: this.durationMs,
    };
  }
}
