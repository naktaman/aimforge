/**
 * Close Range Tracking 시나리오 (10-15m)
 * 팔 움직임 영역 — 빠르고 큰 이동, ADAD 스트레이핑
 * 4가지 이동 패턴 순환: Linear, Parabolic, Jitter, Acceleration
 * 독립 DNA 축: tracking_close_score
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import type { TrackingStageConfig, MovementPattern } from '../../../utils/types';
import { RandomPatternScheduler, getCloseRangePatterns } from './MovementPatternSystem';
import { STAGE_COLORS } from '../../../config/theme';

/** 트래킹 샘플 */
interface TrackingSample {
  errorDeg: number;
  timestamp: number;
  pattern: MovementPattern;
  directionChanged: boolean;
}

/** 패턴별 통계 */
interface PatternStats {
  mad: number;
  accuracy: number;
  sampleCount: number;
}

export class TrackingCloseScenario extends Scenario {
  private config: TrackingStageConfig;
  private completed = false;
  private startTime = 0;
  private currentTargetId: string | null = null;

  // 이동 패턴 스케줄러 — 랜덤 순서 + 가변 시간 패턴 전환
  private patternScheduler: RandomPatternScheduler;

  // 측정
  private samples: TrackingSample[] = [];
  private lastSampleTime = 0;
  private sampleIntervalMs = 16; // ~60fps

  // 기본 위치 — 근거리
  private distance = 12;
  private basePos: THREE.Vector3;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(engine: GameEngine, targetManager: TargetManager, config: TrackingStageConfig) {
    super(engine, targetManager);
    this.config = config;

    // 거리 설정 (근거리: 10-15m)
    this.distance = config.distance || 12;
    // basePos는 start() 시점에 카메라 전방 기준으로 설정
    this.basePos = new THREE.Vector3(0, 1.6, -this.distance);

    // 이동 패턴 초기화 — 랜덤 스케줄러로 4가지 패턴 섞어서 순환
    const patterns = config.patterns.length > 0
      ? config.patterns
      : getCloseRangePatterns();

    // 이동 범위: 근거리는 넓은 X축 이동 (팔 움직임)
    this.patternScheduler = new RandomPatternScheduler(
      patterns,
      config.durationMs,
      /* xBound */ 6,
      /* yBound */ 2.5,
    );
  }

  setOnComplete(cb: (results: unknown) => void): void {
    this.onCompleteCallback = cb;
  }

  start(): void {
    this.completed = false;
    this.samples = [];
    this.startTime = performance.now();
    this.lastSampleTime = 0;
    this.patternScheduler.reset();

    // 카메라 전방 기준으로 basePos 초기화
    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    this.basePos = camera.position.clone().addScaledVector(forward, this.distance);

    // 초기 타겟 스폰
    const target = this.targetManager.spawnTarget(
      this.basePos.clone(),
      {
        angularSizeDeg: this.config.difficulty.targetSizeDeg,
        distanceM: this.distance,
        color: STAGE_COLORS.aerialTracking,
      },
    );
    this.currentTargetId = target.id;
  }

  update(deltaTime: number): void {
    if (this.completed) return;

    const elapsed = performance.now() - this.startTime;

    // 시간 초과 → 완료
    if (elapsed >= this.config.durationMs) {
      this.finish();
      return;
    }

    // 랜덤 스케줄러로 패턴 전환 + 위치 업데이트
    const { x, y, directionChanged } = this.patternScheduler.update(deltaTime, elapsed);

    // 타겟 위치 적용
    if (this.currentTargetId) {
      const newPos = this.basePos.clone();
      newPos.x = x;
      newPos.y = this.basePos.y + y;
      this.targetManager.updateTargetPosition(this.currentTargetId, newPos);
    }

    // 트래킹 에러 샘플링
    if (elapsed - this.lastSampleTime >= this.sampleIntervalMs) {
      this.sampleTrackingError(elapsed, this.patternScheduler.getActivePattern(), directionChanged);
      this.lastSampleTime = elapsed;
    }
  }

  onClick(): void {
    // 트래킹 시나리오 — 클릭 불필요
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): unknown {
    if (this.samples.length === 0) {
      return {
        stageType: 'tracking_close' as const,
        category: 'tracking' as const,
        mad: 999,
        accuracy: 0,
        score: 0,
        patternScores: {},
      };
    }

    // 전체 MAD
    const mad = this.samples.reduce((s, sample) => s + sample.errorDeg, 0) / this.samples.length;

    // 타겟 내부 비율
    const targetRadDeg = this.config.difficulty.targetSizeDeg / 2;
    const onTarget = this.samples.filter((s) => s.errorDeg <= targetRadDeg).length;
    const accuracy = onTarget / this.samples.length;

    // 패턴별 통계
    const patternScores: Record<string, PatternStats> = {};
    const patternGroups = new Map<MovementPattern, TrackingSample[]>();
    for (const s of this.samples) {
      if (!patternGroups.has(s.pattern)) patternGroups.set(s.pattern, []);
      patternGroups.get(s.pattern)!.push(s);
    }
    for (const [pattern, samples] of patternGroups) {
      const pMad = samples.reduce((sum, s) => sum + s.errorDeg, 0) / samples.length;
      const pOnTarget = samples.filter((s) => s.errorDeg <= targetRadDeg).length;
      patternScores[pattern] = {
        mad: pMad,
        accuracy: pOnTarget / samples.length,
        sampleCount: samples.length,
      };
    }

    // 방향 전환 시 정확도
    const changeSamples = this.samples.filter((s) => s.directionChanged);
    const changeAccuracy = changeSamples.length > 0
      ? changeSamples.filter((s) => s.errorDeg <= targetRadDeg).length / changeSamples.length
      : 0;

    // 점수: accuracy 45% + MAD 30% + 방향전환 25%
    const madScore = Math.max(0, 1 - mad / 15); // 근거리는 MAD 기준 느슨
    const score = accuracy * 45 + madScore * 30 + changeAccuracy * 25;

    return {
      stageType: 'tracking_close' as const,
      category: 'tracking' as const,
      score,
      accuracy,
      trackingMad: mad,
      patternScores,
      changeAccuracy,
      samples: this.samples.length,
      durationMs: this.config.durationMs,
      distance: this.distance,
    };
  }

  /** 에러 샘플 수집 */
  private sampleTrackingError(timestamp: number, pattern: MovementPattern, directionChanged: boolean): void {
    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);

    if (hitResult) {
      const errorDeg = hitResult.angularError * (180 / Math.PI);
      this.samples.push({ errorDeg, timestamp, pattern, directionChanged });
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
}
