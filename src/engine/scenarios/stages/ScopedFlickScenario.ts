/**
 * Scoped Flick 시나리오 — 다양한 줌 배율에서 플릭
 * 1x, 2x, 4x, 8x 등 스코프별 감도 차이 체험
 * 줌 전환 시 감도 적응력 측정
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import { WeaponSystem, WEAPON_PRESETS } from '../../WeaponSystem';
import type { DifficultyConfig } from '../../../utils/types';
import { DEG2RAD } from '../../../utils/physics';
import { STAGE_COLORS } from '../../../config/theme';

/** 줌 단계별 시행 */
interface ZoomTrial {
  zoomPreset: string;
  zoomMultiplier: number;
  fov: number;
  sensMultiplier: number;
}

/** 개별 결과 */
interface TrialResult {
  hit: boolean;
  reactionMs: number;
  overshootDeg: number;
  zoomPreset: string;
  zoomMultiplier: number;
  angleDeg: number;
}

export class ScopedFlickScenario extends Scenario {
  private difficulty: DifficultyConfig;
  private weapon: WeaponSystem;
  private zoomTrials: ZoomTrial[] = [];
  private currentTrial = 0;
  private targetIndex = 0;
  private targetsPerZoom: number;
  private results: TrialResult[] = [];
  private completed = false;

  private currentTargetId: string | null = null;
  private targetAppearTime = 0;
  private targetAngle = 0;
  private waitingForTarget = true;
  private nextSpawnTime = 0;
  private minAngularError = Infinity;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    difficulty: DifficultyConfig,
    zoomPresets: string[] = ['zoom_1x', 'zoom_2x', 'zoom_4x', 'zoom_8x'],
  ) {
    super(engine, targetManager);
    this.difficulty = difficulty;
    this.weapon = new WeaponSystem();

    // 줌별 시행 구성
    this.zoomTrials = zoomPresets.map((preset) => {
      const config = WEAPON_PRESETS[preset] ?? WEAPON_PRESETS.default;
      return {
        zoomPreset: preset,
        zoomMultiplier: config.zoomMultiplier,
        fov: config.zoomFov,
        sensMultiplier: config.zoomSensMultiplier,
      };
    });

    this.targetsPerZoom = Math.ceil(difficulty.targetCount / this.zoomTrials.length);
  }

  setOnComplete(cb: (results: unknown) => void): void {
    this.onCompleteCallback = cb;
  }

  start(): void {
    this.currentTrial = 0;
    this.targetIndex = 0;
    this.completed = false;
    this.results = [];
    this.waitingForTarget = true;
    this.nextSpawnTime = performance.now() + 1500;
    this.applyCurrentZoom();
  }

  /** 현재 줌 적용 */
  private applyCurrentZoom(): void {
    if (this.currentTrial >= this.zoomTrials.length) return;
    const trial = this.zoomTrials[this.currentTrial];
    const preset = WEAPON_PRESETS[trial.zoomPreset] ?? WEAPON_PRESETS.default;
    this.weapon.setConfig(preset);
    this.weapon.setZoomed(trial.zoomMultiplier > 1);
    this.engine.setScope(trial.fov, trial.sensMultiplier);
  }

  update(_deltaTime: number): void {
    if (this.completed) return;

    const now = performance.now();

    if (this.waitingForTarget) {
      if (now >= this.nextSpawnTime) {
        this.spawnTarget();
        this.waitingForTarget = false;
      }
      return;
    }

    // 오버슈트 추적
    if (this.currentTargetId) {
      const camera = this.engine.getCamera();
      const forward = this.engine.getCameraForward();
      const hitResult = this.targetManager.checkHit(camera.position, forward);
      if (hitResult) {
        const errorDeg = hitResult.angularError * (180 / Math.PI);
        this.minAngularError = Math.min(this.minAngularError, errorDeg);
      }

      // 시간 초과
      if (now - this.targetAppearTime > this.difficulty.reactionWindowMs) {
        this.recordResult(false, this.difficulty.reactionWindowMs);
        this.advanceToNext();
      }
    }
  }

  onClick(): void {
    if (this.completed || this.waitingForTarget || !this.currentTargetId) return;

    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);
    const reactionMs = performance.now() - this.targetAppearTime;

    this.recordResult(hitResult?.hit ?? false, reactionMs);
    this.advanceToNext();
  }

  /** 타겟 스폰 */
  private spawnTarget(): void {
    const trial = this.zoomTrials[this.currentTrial];
    // 줌 배율에 따른 각도 범위 조절 (줌 높을수록 좁은 범위)
    const maxAngle = Math.min(60, 120 / trial.zoomMultiplier);
    const angle = 10 + Math.random() * (maxAngle - 10);
    this.targetAngle = angle;

    // 120° 방위각 제한 (±60°)
    const azimuth = (Math.random() * 120) - 60;
    const distance = 15 + Math.random() * 20;

    const yawRad = (azimuth - 180) * DEG2RAD;
    const pitchRad = (Math.random() - 0.5) * 30 * DEG2RAD;

    const pos = new THREE.Vector3(
      distance * Math.sin(yawRad) * Math.cos(pitchRad),
      1.6 + distance * Math.sin(pitchRad),
      -distance * Math.cos(yawRad) * Math.cos(pitchRad),
    );

    // 줌 배율에 따른 타겟 크기 조절
    const adjustedSize = this.difficulty.targetSizeDeg / trial.zoomMultiplier;

    const target = this.targetManager.spawnTarget(pos, {
      angularSizeDeg: Math.max(adjustedSize, 0.3),
      distanceM: distance,
      color: STAGE_COLORS.scopedLongRange,
    });

    this.currentTargetId = target.id;
    this.targetAppearTime = performance.now();
    this.minAngularError = Infinity;
  }

  /** 결과 기록 */
  private recordResult(hit: boolean, reactionMs: number): void {
    const trial = this.zoomTrials[this.currentTrial];
    this.results.push({
      hit,
      reactionMs,
      overshootDeg: this.minAngularError < Infinity ? this.minAngularError : 999,
      zoomPreset: trial.zoomPreset,
      zoomMultiplier: trial.zoomMultiplier,
      angleDeg: this.targetAngle,
    });
  }

  /** 다음 타겟 */
  private advanceToNext(): void {
    if (this.currentTargetId) {
      this.targetManager.removeTarget(this.currentTargetId);
      this.currentTargetId = null;
    }

    this.targetIndex++;

    // 줌 단계 전환 체크
    if (this.targetIndex >= this.targetsPerZoom) {
      this.targetIndex = 0;
      this.currentTrial++;

      if (this.currentTrial >= this.zoomTrials.length) {
        this.completed = true;
        this.engine.setScope(103, 1);
        if (this.onCompleteCallback) {
          this.onCompleteCallback(this.getResults());
        }
        return;
      }

      // 새 줌 적용 (1초 전환 시간)
      this.nextSpawnTime = performance.now() + 1500;
      this.applyCurrentZoom();
    } else {
      this.nextSpawnTime = performance.now() + 800 + Math.random() * 700;
    }

    this.waitingForTarget = true;
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): unknown {
    const hits = this.results.filter((r) => r.hit);
    const accuracy = this.results.length > 0 ? hits.length / this.results.length : 0;

    // 줌별 통계
    const zoomStats: Record<string, { total: number; hits: number; avgReaction: number }> = {};
    for (const r of this.results) {
      if (!zoomStats[r.zoomPreset]) {
        zoomStats[r.zoomPreset] = { total: 0, hits: 0, avgReaction: 0 };
      }
      zoomStats[r.zoomPreset].total++;
      if (r.hit) {
        zoomStats[r.zoomPreset].hits++;
        zoomStats[r.zoomPreset].avgReaction += r.reactionMs;
      }
    }
    for (const key of Object.keys(zoomStats)) {
      const s = zoomStats[key];
      if (s.hits > 0) s.avgReaction /= s.hits;
    }

    const avgReaction = hits.length > 0
      ? hits.reduce((s, r) => s + r.reactionMs, 0) / hits.length : 0;
    const avgOvershoot = this.results.length > 0
      ? this.results.filter((r) => r.overshootDeg < 100).reduce((s, r) => s + r.overshootDeg, 0)
        / this.results.filter((r) => r.overshootDeg < 100).length : 0;

    const score = accuracy * 50
      + (1 - Math.min(avgReaction / 3000, 1)) * 30
      + (1 - Math.min(avgOvershoot / 5, 1)) * 20;

    return {
      stageType: 'scoped_flick',
      accuracy,
      avgReactionMs: avgReaction,
      avgOvershootDeg: avgOvershoot,
      totalTargets: this.results.length,
      hits: hits.length,
      zoomStats,
      score,
      trials: this.results,
    };
  }
}
