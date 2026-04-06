/**
 * Long Range 시나리오 — 원거리 정밀 사격 + Bullet Drop
 * 2가지 모드:
 * 1. long_range_precision: 정적 소형 타겟 정밀 사격
 * 2. bulletdrop_sniping: bullet drop + 이동 타겟 스나이핑
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import { WeaponSystem, WEAPON_PRESETS } from '../../WeaponSystem';
import type { DifficultyConfig } from '../../../utils/types';
import { DEG2RAD } from '../../../utils/physics';
import { STAGE_COLORS } from '../../../config/theme';

/** 모드 타입 */
type LongRangeMode = 'precision' | 'bulletdrop';

/** 개별 결과 */
interface ShotResult {
  hit: boolean;
  reactionMs: number;
  angularErrorDeg: number;
  distanceM: number;
  bulletDropCompensation: number;
  shotIndex: number;
}

export class LongRangeScenario extends Scenario {
  private difficulty: DifficultyConfig;
  private mode: LongRangeMode;
  private weapon: WeaponSystem;
  private results: ShotResult[] = [];
  private completed = false;

  private currentTargetId: string | null = null;
  private targetIndex = 0;
  private targetAppearTime = 0;
  private targetDistance = 0;
  private waitingForTarget = true;
  private nextSpawnTime = 0;


  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    difficulty: DifficultyConfig,
    mode: LongRangeMode = 'precision',
  ) {
    super(engine, targetManager);
    this.difficulty = difficulty;
    this.mode = mode;

    // 스나이퍼 무기 설정
    if (mode === 'bulletdrop') {
      this.weapon = new WeaponSystem(WEAPON_PRESETS.sniper_pubg);
    } else {
      this.weapon = new WeaponSystem(WEAPON_PRESETS.zoom_4x);
    }
  }

  setOnComplete(cb: (results: unknown) => void): void {
    this.onCompleteCallback = cb;
  }

  start(): void {
    this.targetIndex = 0;
    this.completed = false;
    this.results = [];
    this.waitingForTarget = true;
    this.nextSpawnTime = performance.now() + 1000;

    // 줌 활성화
    this.weapon.setZoomed(true);
    const zoom = this.weapon.getZoomState();
    this.engine.setScope(zoom.fov, zoom.sensMultiplier);
  }

  update(_deltaTime: number): void {
    if (this.completed) return;

    const now = performance.now();

    // 타겟 대기
    if (this.waitingForTarget && this.targetIndex < this.difficulty.targetCount) {
      if (now >= this.nextSpawnTime) {
        this.spawnTarget();
        this.waitingForTarget = false;
      }
      return;
    }

    // 이동 타겟 업데이트 (bulletdrop 모드)
    if (this.mode === 'bulletdrop' && this.currentTargetId) {
      const elapsed = now - this.targetAppearTime;
      const speed = this.difficulty.targetSpeedDegPerSec;
      // 느린 수평 이동
      const offsetX = Math.sin(elapsed / 1000 * speed * DEG2RAD * 0.5) * this.targetDistance * 0.1;
      const basePos = this.getBaseTargetPosition(this.targetIndex);
      basePos.x += offsetX;
      this.targetManager.updateTargetPosition(this.currentTargetId, basePos);
    }

    // 시간 초과
    if (this.currentTargetId && now - this.targetAppearTime > this.difficulty.reactionWindowMs) {
      this.recordResult(false, this.difficulty.reactionWindowMs, 999);
      this.advanceToNext();
    }
  }

  onClick(): void {
    if (this.completed || this.waitingForTarget || !this.currentTargetId) return;

    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const reactionMs = performance.now() - this.targetAppearTime;

    // Bullet drop 보정 계산
    let adjustedHit = false;
    let angularErrorDeg = 999;
    let dropCompensation = 0;

    if (this.mode === 'bulletdrop') {
      // bullet drop 있는 경우 — 타겟 위치에 drop 적용
      const drop = this.weapon.calculateBulletDrop(this.targetDistance);
      dropCompensation = drop.dropAngleDeg;

      // 실제 탄착점은 조준점보다 아래로 이동
      // 유저가 조준점을 타겟 위에 올리면 보정 성공
      const hitResult = this.targetManager.checkHit(camera.position, forward);
      if (hitResult) {
        // 실제 에러 = 조준 에러 + bullet drop (유저가 높게 조준하면 상쇄)
        angularErrorDeg = hitResult.angularError * (180 / Math.PI);
        // 타겟 크기 + drop 보정 여유분 고려
        const effectiveRadius = (this.difficulty.targetSizeDeg / 2) + drop.dropAngleDeg * 0.3;
        adjustedHit = angularErrorDeg <= effectiveRadius;
      }
    } else {
      // 일반 정밀 사격
      const hitResult = this.targetManager.checkHit(camera.position, forward);
      if (hitResult) {
        angularErrorDeg = hitResult.angularError * (180 / Math.PI);
        adjustedHit = hitResult.hit;
      }
    }

    // 반동 적용
    this.weapon.fire(performance.now());

    this.recordResult(adjustedHit, reactionMs, angularErrorDeg, dropCompensation);
    this.advanceToNext();
  }

  /** 타겟 기본 위치 계산 */
  private getBaseTargetPosition(_index: number): THREE.Vector3 {
    // 50~200m 범위, 랜덤 방향
    const distance = 50 + Math.random() * 150;
    this.targetDistance = distance;

    const yaw = (Math.random() - 0.5) * 60; // ±30° 전방
    const pitch = (Math.random() - 0.5) * 20; // ±10°

    return new THREE.Vector3(
      distance * Math.sin(yaw * DEG2RAD),
      1.6 + distance * Math.sin(pitch * DEG2RAD),
      -distance * Math.cos(yaw * DEG2RAD),
    );
  }

  /** 타겟 스폰 */
  private spawnTarget(): void {
    const pos = this.getBaseTargetPosition(this.targetIndex);

    const target = this.targetManager.spawnTarget(pos, {
      angularSizeDeg: this.difficulty.targetSizeDeg,
      distanceM: this.targetDistance,
      color: this.mode === 'bulletdrop' ? STAGE_COLORS.customDrill : STAGE_COLORS.longRange,
    });

    this.currentTargetId = target.id;
    this.targetAppearTime = performance.now();
  }

  /** 결과 기록 */
  private recordResult(hit: boolean, reactionMs: number, errorDeg: number, dropComp = 0): void {
    this.results.push({
      hit,
      reactionMs,
      angularErrorDeg: errorDeg,
      distanceM: this.targetDistance,
      bulletDropCompensation: dropComp,
      shotIndex: this.targetIndex,
    });
  }

  /** 다음 타겟 */
  private advanceToNext(): void {
    if (this.currentTargetId) {
      this.targetManager.removeTarget(this.currentTargetId);
      this.currentTargetId = null;
    }

    this.targetIndex++;
    this.waitingForTarget = true;
    this.nextSpawnTime = performance.now() + 1500 + Math.random() * 1000;

    if (this.targetIndex >= this.difficulty.targetCount) {
      this.completed = true;
      // 줌 해제
      this.weapon.setZoomed(false);
      this.engine.setScope(103, 1);

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
    const avgError = this.results.length > 0
      ? this.results.reduce((s, r) => s + r.angularErrorDeg, 0) / this.results.length : 0;
    const avgDistance = this.results.length > 0
      ? this.results.reduce((s, r) => s + r.distanceM, 0) / this.results.length : 0;

    const stageType = this.mode === 'bulletdrop' ? 'bulletdrop_sniping' : 'long_range_precision';

    // 점수: 정확도 50% + 정밀도 30% + 반응시간 20%
    const score = accuracy * 50
      + (1 - Math.min(avgError / 3, 1)) * 30
      + (1 - Math.min(avgReaction / 5000, 1)) * 20;

    return {
      stageType,
      accuracy,
      avgReactionMs: avgReaction,
      avgAngularErrorDeg: avgError,
      avgDistanceM: avgDistance,
      totalShots: this.results.length,
      hits: hits.length,
      avgOvershootDeg: avgError,
      score,
      mode: this.mode,
      trials: this.results,
    };
  }
}
