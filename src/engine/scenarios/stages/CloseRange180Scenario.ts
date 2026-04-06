/**
 * Close Range 180° 시나리오 — 초근접 교전
 * 오버워치 스타일: 180° 플릭, 점프하면서 트래킹, 스트레이핑 적
 * 큰 각도의 빠른 플릭 + 근거리 속도전
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import type { DifficultyConfig } from '../../../utils/types';
import { DEG2RAD } from '../../../utils/physics';
import { TARGET_COLORS } from '../../../config/theme';

/** 적 유형 */
type EnemyBehavior = 'static_behind' | 'strafing' | 'jumping' | 'circling';

/** 개별 적 설정 */
interface EnemyConfig {
  behavior: EnemyBehavior;
  /** 출현 각도 — 플레이어 후방 포함 (±180°) */
  spawnAngleDeg: number;
  /** 이동 속도 (m/s) */
  moveSpeed: number;
  /** 거리 (m) — 근거리 2~8m */
  distance: number;
}

/** 개별 결과 */
interface TrialResult {
  hit: boolean;
  reactionMs: number;
  flipAngleDeg: number;
  behavior: EnemyBehavior;
  distance: number;
}

export class CloseRange180Scenario extends Scenario {
  private difficulty: DifficultyConfig;
  private enemies: EnemyConfig[] = [];
  private currentEnemy = 0;
  private results: TrialResult[] = [];
  private completed = false;

  private currentTargetId: string | null = null;
  private targetAppearTime = 0;
  private enemyElapsed = 0;
  private waitingForTarget = true;
  private nextSpawnTime = 0;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    difficulty: DifficultyConfig,
  ) {
    super(engine, targetManager);
    this.difficulty = difficulty;
    this.enemies = this.generateEnemies(difficulty.targetCount);
  }

  setOnComplete(cb: (results: unknown) => void): void {
    this.onCompleteCallback = cb;
  }

  /** 적 구성 생성 — 다양한 행동 패턴 */
  private generateEnemies(count: number): EnemyConfig[] {
    const behaviors: EnemyBehavior[] = ['static_behind', 'strafing', 'jumping', 'circling'];
    const enemies: EnemyConfig[] = [];

    for (let i = 0; i < count; i++) {
      const behavior = behaviors[i % behaviors.length];

      // 후방 + 측면 강조: 90°~180° 범위 다수
      let angle: number;
      if (i % 3 === 0) {
        // 후방 (150~180°)
        angle = (150 + Math.random() * 30) * (Math.random() > 0.5 ? 1 : -1);
      } else if (i % 3 === 1) {
        // 측면 (60~150°)
        angle = (60 + Math.random() * 90) * (Math.random() > 0.5 ? 1 : -1);
      } else {
        // 전방 근거리 (0~60°)
        angle = (Math.random() * 60) * (Math.random() > 0.5 ? 1 : -1);
      }

      enemies.push({
        behavior,
        spawnAngleDeg: angle,
        moveSpeed: behavior === 'static_behind' ? 0 : 3 + Math.random() * 4,
        distance: 2 + Math.random() * 6, // 2~8m
      });
    }

    return enemies;
  }

  start(): void {
    this.currentEnemy = 0;
    this.completed = false;
    this.results = [];
    this.waitingForTarget = true;
    this.nextSpawnTime = performance.now() + 1000;
  }

  update(deltaTime: number): void {
    if (this.completed) return;

    const now = performance.now();

    // 타겟 대기 중
    if (this.waitingForTarget && this.currentEnemy < this.enemies.length) {
      if (now >= this.nextSpawnTime) {
        this.spawnEnemy();
        this.waitingForTarget = false;
      }
      return;
    }

    // 활성 타겟 업데이트
    if (this.currentTargetId) {
      const enemy = this.enemies[this.currentEnemy];
      this.enemyElapsed += deltaTime * 1000;

      // 이동형 적 위치 업데이트
      if (enemy.behavior !== 'static_behind') {
        const newPos = this.calculateEnemyPosition(enemy, this.enemyElapsed);
        this.targetManager.updateTargetPosition(this.currentTargetId, newPos);
      }

      // 시간 초과
      if (now - this.targetAppearTime > this.difficulty.reactionWindowMs) {
        this.recordMiss(enemy);
        this.advanceToNext();
      }
    }
  }

  onClick(): void {
    if (this.completed || this.waitingForTarget || !this.currentTargetId) return;

    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);
    const enemy = this.enemies[this.currentEnemy];

    const reactionMs = performance.now() - this.targetAppearTime;

    if (hitResult?.hit) {
      this.results.push({
        hit: true,
        reactionMs,
        flipAngleDeg: Math.abs(enemy.spawnAngleDeg),
        behavior: enemy.behavior,
        distance: enemy.distance,
      });
      this.advanceToNext();
    }
    // 미스는 무시 — 계속 시도 가능
  }

  /** 적 스폰 */
  private spawnEnemy(): void {
    const enemy = this.enemies[this.currentEnemy];
    const pos = this.calculateEnemyPosition(enemy, 0);

    const target = this.targetManager.spawnTarget(pos, {
      angularSizeDeg: this.difficulty.targetSizeDeg,
      distanceM: enemy.distance,
      color: TARGET_COLORS.alertRed,
    });

    this.currentTargetId = target.id;
    this.targetAppearTime = performance.now();
    this.enemyElapsed = 0;
  }

  /** 적 위치 계산 */
  private calculateEnemyPosition(enemy: EnemyConfig, elapsedMs: number): THREE.Vector3 {
    const baseYaw = enemy.spawnAngleDeg * DEG2RAD;
    const d = enemy.distance;
    const t = elapsedMs / 1000;
    const speed = enemy.moveSpeed;

    let x = d * Math.sin(baseYaw);
    let y = 1.6;
    let z = -d * Math.cos(baseYaw);

    switch (enemy.behavior) {
      case 'strafing':
        // 좌우 스트레이핑
        x += Math.sin(t * speed * 0.5) * 2;
        break;
      case 'jumping':
        // 점프 (반복 포물선)
        y += Math.max(0, Math.sin(t * speed * 0.8) * 1.5);
        x += Math.sin(t * speed * 0.3) * 1;
        break;
      case 'circling':
        // 플레이어 주변 원형 이동
        const circleAngle = baseYaw + t * speed * 0.2;
        x = d * Math.sin(circleAngle);
        z = -d * Math.cos(circleAngle);
        break;
    }

    return new THREE.Vector3(x, y, z);
  }

  /** 미스 기록 */
  private recordMiss(enemy: EnemyConfig): void {
    this.results.push({
      hit: false,
      reactionMs: this.difficulty.reactionWindowMs,
      flipAngleDeg: Math.abs(enemy.spawnAngleDeg),
      behavior: enemy.behavior,
      distance: enemy.distance,
    });
  }

  /** 다음 적으로 전진 */
  private advanceToNext(): void {
    if (this.currentTargetId) {
      this.targetManager.removeTarget(this.currentTargetId);
      this.currentTargetId = null;
    }

    this.currentEnemy++;
    this.waitingForTarget = true;
    this.nextSpawnTime = performance.now() + 800 + Math.random() * 700;

    if (this.currentEnemy >= this.enemies.length) {
      this.completed = true;
      if (this.onCompleteCallback) {
        this.onCompleteCallback(this.getResults());
      }
    }
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): unknown {
    const hits = this.results.filter((r) => r.hit);
    const accuracy = this.results.length > 0 ? hits.length / this.results.length : 0;
    const avgReaction = hits.length > 0
      ? hits.reduce((s, r) => s + r.reactionMs, 0) / hits.length : 0;
    const avgFlipAngle = this.results.length > 0
      ? this.results.reduce((s, r) => s + r.flipAngleDeg, 0) / this.results.length : 0;

    // 행동별 히트율
    const behaviorStats: Record<string, { total: number; hits: number }> = {};
    for (const r of this.results) {
      if (!behaviorStats[r.behavior]) behaviorStats[r.behavior] = { total: 0, hits: 0 };
      behaviorStats[r.behavior].total++;
      if (r.hit) behaviorStats[r.behavior].hits++;
    }

    const score = accuracy * 40
      + (1 - Math.min(avgReaction / 1500, 1)) * 35
      + Math.min(avgFlipAngle / 180, 1) * 25; // 큰 각도 보너스

    return {
      stageType: 'close_range_180',
      accuracy,
      avgReactionMs: avgReaction,
      avgFlipAngleDeg: avgFlipAngle,
      totalTargets: this.results.length,
      hits: hits.length,
      behaviorStats,
      score,
      trials: this.results,
    };
  }
}
