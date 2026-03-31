/**
 * Long Range Tracking 시나리오 (40-60m)
 * 손목 정밀 영역 — 느리지만 정밀한 추적, 작은 타겟
 * 스나이퍼/DMR 스타일 원거리 트래킹
 * 독립 DNA 축: tracking_long_score
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import type { TrackingStageConfig, MovementPattern } from '../../../utils/types';
import { RandomPatternScheduler, getLongRangePatterns } from './MovementPatternSystem';

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

export class TrackingLongScenario extends Scenario {
  private config: TrackingStageConfig;
  private completed = false;
  private startTime = 0;
  private currentTargetId: string | null = null;

  // 이동 패턴 스케줄러 — 랜덤 순서 + 가변 시간 패턴 전환
  private patternScheduler: RandomPatternScheduler;

  private samples: TrackingSample[] = [];
  private lastSampleTime = 0;
  private sampleIntervalMs = 16;

  // 원거리
  private distance = 50;
  private basePos: THREE.Vector3;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(engine: GameEngine, targetManager: TargetManager, config: TrackingStageConfig) {
    super(engine, targetManager);
    this.config = config;

    this.distance = config.distance || 50;
    this.basePos = new THREE.Vector3(0, 1.6, -this.distance);

    // 이동 패턴 초기화 — 랜덤 스케줄러로 4가지 패턴 섞어서 순환
    const patterns = config.patterns.length > 0
      ? config.patterns
      : getLongRangePatterns();

    // 원거리: 좁은 이동 범위 (시각적으로 작은 움직임)
    this.patternScheduler = new RandomPatternScheduler(
      patterns,
      config.durationMs,
      /* xBound */ 3,
      /* yBound */ 1.2,
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

    const target = this.targetManager.spawnTarget(
      this.basePos.clone(),
      {
        angularSizeDeg: this.config.difficulty.targetSizeDeg,
        distanceM: this.distance,
        // 원거리: 작고 밝은 타겟
        color: 0x6c5ce7,
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
        stageType: 'tracking_long' as const,
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

    // Phase lag 근사 — 에러 자기상관
    const phaseLag = this.estimatePhaseLag();

    // 점수: accuracy 35% + MAD 35% + phaseLag 15% + 방향전환 15%
    // 원거리는 MAD 기준 엄격 (작은 타겟)
    const madScore = Math.max(0, 1 - mad / 5);
    const phaseLagScore = Math.max(0, 1 - phaseLag / 200); // 200ms 이상이면 0점
    const score = accuracy * 35 + madScore * 35 + phaseLagScore * 15 + changeAccuracy * 15;

    return {
      stageType: 'tracking_long' as const,
      category: 'tracking' as const,
      score,
      accuracy,
      trackingMad: mad,
      phaseLag,
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

  /** Phase Lag 근사 — 방향 전환 후 에러 최소화까지 걸리는 시간 */
  private estimatePhaseLag(): number {
    const changeIndices: number[] = [];
    for (let i = 0; i < this.samples.length; i++) {
      if (this.samples[i].directionChanged) changeIndices.push(i);
    }
    if (changeIndices.length === 0) return 0;

    const lags: number[] = [];
    for (const idx of changeIndices) {
      // 방향 전환 후 에러가 줄어들기 시작하는 시점 찾기
      let minError = Infinity;
      let minIdx = idx;
      const window = Math.min(idx + 30, this.samples.length); // 30 샘플 = ~500ms
      for (let i = idx; i < window; i++) {
        if (this.samples[i].errorDeg < minError) {
          minError = this.samples[i].errorDeg;
          minIdx = i;
        }
      }
      if (minIdx > idx) {
        const lag = this.samples[minIdx].timestamp - this.samples[idx].timestamp;
        lags.push(lag);
      }
    }

    if (lags.length === 0) return 0;
    return lags.reduce((s, l) => s + l, 0) / lags.length;
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
