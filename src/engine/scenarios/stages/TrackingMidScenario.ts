/**
 * Mid Range Tracking 시나리오 (20-30m)
 * 손목+팔 혼합 영역 — 중간 속도, 다양한 이동 패턴
 * 가장 범용적인 트래킹 거리대
 * 독립 DNA 축: tracking_mid_score
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import type { TrackingStageConfig, MovementPattern } from '../../../utils/types';
import { RandomPatternScheduler, getMidRangePatterns } from './MovementPatternSystem';

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

export class TrackingMidScenario extends Scenario {
  private config: TrackingStageConfig;
  private completed = false;
  private startTime = 0;
  private currentTargetId: string | null = null;

  // 이동 패턴 스케줄러 — 랜덤 순서 + 가변 시간 패턴 전환
  private patternScheduler: RandomPatternScheduler;

  // 측정
  private samples: TrackingSample[] = [];
  private lastSampleTime = 0;
  private sampleIntervalMs = 16;

  // 중거리
  private distance = 25;
  private basePos: THREE.Vector3;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(engine: GameEngine, targetManager: TargetManager, config: TrackingStageConfig) {
    super(engine, targetManager);
    this.config = config;

    this.distance = config.distance || 25;
    // basePos는 start() 시점에 카메라 전방 기준으로 설정
    this.basePos = new THREE.Vector3(0, 1.6, -this.distance);

    // 이동 패턴 초기화 — 랜덤 스케줄러로 4가지 패턴 섞어서 순환
    const patterns = config.patterns.length > 0
      ? config.patterns
      : getMidRangePatterns();

    // 중거리: 적당한 이동 범위
    this.patternScheduler = new RandomPatternScheduler(
      patterns,
      config.durationMs,
      /* xBound */ 4,
      /* yBound */ 1.8,
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

    const target = this.targetManager.spawnTarget(
      this.basePos.clone(),
      {
        angularSizeDeg: this.config.difficulty.targetSizeDeg,
        distanceM: this.distance,
        color: 0x0984e3,
      },
    );
    this.currentTargetId = target.id;
  }

  update(deltaTime: number): void {
    if (this.completed) return;

    const elapsed = performance.now() - this.startTime;

    if (elapsed >= this.config.durationMs) {
      this.finish();
      return;
    }

    // 랜덤 스케줄러로 패턴 전환 + 위치 업데이트
    const { x, y, directionChanged } = this.patternScheduler.update(deltaTime, elapsed);

    if (this.currentTargetId) {
      const newPos = this.basePos.clone();
      newPos.x = x;
      newPos.y = this.basePos.y + y;
      this.targetManager.updateTargetPosition(this.currentTargetId, newPos);
    }

    if (elapsed - this.lastSampleTime >= this.sampleIntervalMs) {
      this.sampleTrackingError(elapsed, this.patternScheduler.getActivePattern(), directionChanged);
      this.lastSampleTime = elapsed;
    }
  }

  onClick(): void { /* 트래킹 — 클릭 불필요 */ }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): unknown {
    if (this.samples.length === 0) {
      return {
        stageType: 'tracking_mid' as const,
        category: 'tracking' as const,
        mad: 999, accuracy: 0, score: 0, patternScores: {},
      };
    }

    const mad = this.samples.reduce((s, sample) => s + sample.errorDeg, 0) / this.samples.length;
    const targetRadDeg = this.config.difficulty.targetSizeDeg / 2;
    const onTarget = this.samples.filter((s) => s.errorDeg <= targetRadDeg).length;
    const accuracy = onTarget / this.samples.length;

    // 패턴별 통계
    const patternScores: Record<string, PatternStats> = {};
    const groups = new Map<MovementPattern, TrackingSample[]>();
    for (const s of this.samples) {
      if (!groups.has(s.pattern)) groups.set(s.pattern, []);
      groups.get(s.pattern)!.push(s);
    }
    for (const [pattern, samples] of groups) {
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

    // 속도 추종 — 에러 변동 표준편차 (낮을수록 안정적)
    const errorValues = this.samples.map((s) => s.errorDeg);
    const errorMean = mad;
    const errorVariance = errorValues.reduce((s, v) => s + (v - errorMean) ** 2, 0) / errorValues.length;
    const errorStdDev = Math.sqrt(errorVariance);

    // 점수: accuracy 40% + MAD 30% + 안정성 15% + 방향전환 15%
    const madScore = Math.max(0, 1 - mad / 10);
    const stabilityScore = Math.max(0, 1 - errorStdDev / 8);
    const score = accuracy * 40 + madScore * 30 + stabilityScore * 15 + changeAccuracy * 15;

    return {
      stageType: 'tracking_mid' as const,
      category: 'tracking' as const,
      score,
      accuracy,
      trackingMad: mad,
      errorStdDev,
      patternScores,
      changeAccuracy,
      samples: this.samples.length,
      durationMs: this.config.durationMs,
      distance: this.distance,
    };
  }

  private sampleTrackingError(timestamp: number, pattern: MovementPattern, directionChanged: boolean): void {
    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);
    if (hitResult) {
      const errorDeg = hitResult.angularError * (180 / Math.PI);
      this.samples.push({ errorDeg, timestamp, pattern, directionChanged });
    }
  }

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
