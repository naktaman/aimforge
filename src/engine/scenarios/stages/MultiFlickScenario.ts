/**
 * Multi-Flick (타겟 스위칭) 시나리오
 * 여러 적이 동시/순차적으로 다른 방향에서 출현 → 빠르게 전환하며 처치
 * BF 스타일 멀티플리킹
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import type { DifficultyConfig } from '../../../utils/types';
import { DEG2RAD } from '../../../utils/physics';

/** 웨이브 구성 */
interface Wave {
  /** 동시 출현 타겟 수 */
  targetCount: number;
  /** 타겟 위치 (yaw, pitch 도 단위) */
  positions: Array<{ yaw: number; pitch: number }>;
  /** 웨이브 제한 시간 (ms) */
  timeLimitMs: number;
}

/** 개별 타겟 결과 */
interface TargetResult {
  hit: boolean;
  reactionMs: number;
  switchTimeMs: number;
  angularDistance: number;
  waveIndex: number;
  targetIndex: number;
}

export class MultiFlickScenario extends Scenario {
  private difficulty: DifficultyConfig;
  private waves: Wave[] = [];
  private currentWave = 0;
  private activeTargetIds: string[] = [];
  private results: TargetResult[] = [];
  private completed = false;

  private waveStartTime = 0;
  private lastKillTime = 0;
  private killsInWave = 0;
  private previousTargetAngle = 0;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    difficulty: DifficultyConfig,
    waveCount = 6,
  ) {
    super(engine, targetManager);
    this.difficulty = difficulty;

    // 웨이브 생성 — 점진적으로 타겟 수 증가
    this.waves = this.generateWaves(waveCount);
  }

  setOnComplete(cb: (results: unknown) => void): void {
    this.onCompleteCallback = cb;
  }

  /** 웨이브 생성 */
  private generateWaves(count: number): Wave[] {
    const waves: Wave[] = [];

    for (let i = 0; i < count; i++) {
      // 2~5개 타겟 (웨이브 진행에 따라 증가)
      const targetCount = Math.min(2 + Math.floor(i / 2), 5);
      const positions: Array<{ yaw: number; pitch: number }> = [];

      for (let j = 0; j < targetCount; j++) {
        // 최소 30° 간격으로 분산 배치
        const baseAngle = (360 / targetCount) * j + Math.random() * 30 - 15;
        const yaw = baseAngle - 180; // -180 ~ +180 범위
        const pitch = (Math.random() - 0.5) * 40; // ±20°

        positions.push({ yaw, pitch });
      }

      waves.push({
        targetCount,
        positions,
        timeLimitMs: this.difficulty.reactionWindowMs * targetCount,
      });
    }

    return waves;
  }

  start(): void {
    this.currentWave = 0;
    this.completed = false;
    this.results = [];
    this.spawnWave();
  }

  /** 웨이브의 타겟 스폰 */
  private spawnWave(): void {
    if (this.currentWave >= this.waves.length) {
      this.completed = true;
      if (this.onCompleteCallback) {
        this.onCompleteCallback(this.getResults());
      }
      return;
    }

    const wave = this.waves[this.currentWave];
    this.activeTargetIds = [];
    this.killsInWave = 0;
    this.waveStartTime = performance.now();
    this.lastKillTime = this.waveStartTime;

    const distance = 12;

    for (const pos of wave.positions) {
      const yawRad = pos.yaw * DEG2RAD;
      const pitchRad = pos.pitch * DEG2RAD;

      const x = distance * Math.sin(yawRad) * Math.cos(pitchRad);
      const y = 1.6 + distance * Math.sin(pitchRad);
      const z = -distance * Math.cos(yawRad) * Math.cos(pitchRad);

      const target = this.targetManager.spawnTarget(
        new THREE.Vector3(x, y, z),
        {
          angularSizeDeg: this.difficulty.targetSizeDeg,
          distanceM: distance,
          color: 0xe94560,
        },
      );

      this.activeTargetIds.push(target.id);
    }
  }

  update(_deltaTime: number): void {
    if (this.completed) return;

    const wave = this.waves[this.currentWave];
    const elapsed = performance.now() - this.waveStartTime;

    // 웨이브 시간 초과 — 남은 타겟 미스 처리
    if (elapsed > wave.timeLimitMs) {
      for (let i = this.killsInWave; i < wave.targetCount; i++) {
        this.results.push({
          hit: false,
          reactionMs: wave.timeLimitMs,
          switchTimeMs: 0,
          angularDistance: 0,
          waveIndex: this.currentWave,
          targetIndex: i,
        });
      }

      this.targetManager.clear();
      this.activeTargetIds = [];
      this.currentWave++;
      this.spawnWave();
    }
  }

  onClick(): void {
    if (this.completed || this.activeTargetIds.length === 0) return;

    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);
    const now = performance.now();

    if (hitResult && hitResult.hit) {
      // 히트! — 해당 타겟 제거
      const targetIdx = this.activeTargetIds.indexOf(hitResult.targetId);
      if (targetIdx >= 0) {
        this.activeTargetIds.splice(targetIdx, 1);
        this.targetManager.removeTarget(hitResult.targetId);

        // 스위치 타임 = 이전 킬 이후 시간
        const switchTime = now - this.lastKillTime;
        const reactionTime = now - this.waveStartTime;

        // 각도 거리 (이전 타겟과의 각도 차이)
        const currentAngle = hitResult.angularError * (180 / Math.PI);
        const angularDist = this.killsInWave > 0
          ? Math.abs(currentAngle - this.previousTargetAngle)
          : currentAngle;

        this.results.push({
          hit: true,
          reactionMs: reactionTime,
          switchTimeMs: switchTime,
          angularDistance: angularDist,
          waveIndex: this.currentWave,
          targetIndex: this.killsInWave,
        });

        this.previousTargetAngle = currentAngle;
        this.lastKillTime = now;
        this.killsInWave++;

        // 웨이브 완료 체크
        if (this.activeTargetIds.length === 0) {
          this.currentWave++;
          // 1초 후 다음 웨이브
          setTimeout(() => this.spawnWave(), 1000);
        }
      }
    } else {
      // 미스 — 패널티 없음 (계속 시도 가능)
    }
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): unknown {
    const hits = this.results.filter((r) => r.hit);
    const accuracy = this.results.length > 0
      ? hits.length / this.results.length
      : 0;
    const avgSwitchTime = hits.length > 1
      ? hits.slice(1).reduce((s, r) => s + r.switchTimeMs, 0) / (hits.length - 1)
      : 0;
    const avgReaction = hits.length > 0
      ? hits.reduce((s, r) => s + r.reactionMs, 0) / hits.length
      : 0;

    // 점수: 정확도 40% + 스위치 속도 35% + 반응 시간 25%
    const score = accuracy * 40
      + (1 - Math.min(avgSwitchTime / 2000, 1)) * 35
      + (1 - Math.min(avgReaction / 5000, 1)) * 25;

    return {
      stageType: 'multi_flick',
      accuracy,
      avgSwitchTimeMs: avgSwitchTime,
      avgReactionMs: avgReaction,
      totalTargets: this.results.length,
      hits: hits.length,
      waves: this.waves.length,
      score,
      trials: this.results,
    };
  }
}
