/**
 * Zoom Multi-Flick 시나리오 — 줌 상태에서 멀티 플릭 + 트래킹
 * PUBG 스타일: 줌 상태에서 이동하는 여러 타겟 순차 사격
 * 줌 감도 적응 + 타겟 스위칭 복합
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import { WeaponSystem, WEAPON_PRESETS } from '../../WeaponSystem';
import type { DifficultyConfig } from '../../../utils/types';
import { DEG2RAD } from '../../../utils/physics';

/** 개별 결과 */
interface TrialResult {
  hit: boolean;
  reactionMs: number;
  switchTimeMs: number;
  angularErrorDeg: number;
  targetMoving: boolean;
}

export class ZoomMultiFlickScenario extends Scenario {
  private difficulty: DifficultyConfig;
  private weapon: WeaponSystem;
  private results: TrialResult[] = [];
  private completed = false;
  /** 동적 이동범위 제한 — min(fov/2 * 0.8, 30) */
  private maxYawRange: number;

  private activeTargets: Array<{
    id: string;
    moving: boolean;
    basePos: THREE.Vector3;
    speed: number;
    spawnTime: number;
  }> = [];
  private waveIndex = 0;
  private totalWaves: number;
  private waveStartTime = 0;
  private lastKillTime = 0;
  private killsInWave = 0;
  private waitingForWave = true;
  private nextWaveTime = 0;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    difficulty: DifficultyConfig,
    zoomPreset = 'zoom_4x',
  ) {
    super(engine, targetManager);
    this.difficulty = difficulty;
    this.weapon = new WeaponSystem(WEAPON_PRESETS[zoomPreset] ?? WEAPON_PRESETS.zoom_4x);
    this.totalWaves = Math.ceil(difficulty.targetCount / 3);
    // 동적 이동범위: FOV 기반 제한 (줌이 높을수록 좁은 범위)
    const fov = this.weapon.getConfig().zoomFov;
    this.maxYawRange = Math.min((fov / 2) * 0.8, 30);
  }

  setOnComplete(cb: (results: unknown) => void): void {
    this.onCompleteCallback = cb;
  }

  start(): void {
    this.waveIndex = 0;
    this.completed = false;
    this.results = [];
    this.waitingForWave = true;
    this.nextWaveTime = performance.now() + 1000;

    // 줌 활성화
    this.weapon.setZoomed(true);
    const zoom = this.weapon.getZoomState();
    this.engine.setScope(zoom.fov, zoom.sensMultiplier);
  }

  update(_deltaTime: number): void {
    if (this.completed) return;

    const now = performance.now();

    if (this.waitingForWave) {
      if (now >= this.nextWaveTime) {
        this.spawnWave();
        this.waitingForWave = false;
      }
      return;
    }

    // 이동 타겟 위치 업데이트
    for (const t of this.activeTargets) {
      if (t.moving) {
        const elapsed = (now - t.spawnTime) / 1000;
        const newPos = t.basePos.clone();
        // 느린 수평 이동 (줌 상태이므로 작은 이동도 크게 느껴짐)
        newPos.x += Math.sin(elapsed * t.speed * 0.5) * 3;
        newPos.y += Math.sin(elapsed * t.speed * 0.3) * 0.5;
        this.targetManager.updateTargetPosition(t.id, newPos);
      }
    }

    // 웨이브 시간 초과
    const waveTimeLimit = this.difficulty.reactionWindowMs * this.activeTargets.length;
    if (now - this.waveStartTime > waveTimeLimit) {
      // 남은 타겟 미스 처리
      for (let i = this.killsInWave; i < this.activeTargets.length; i++) {
        this.results.push({
          hit: false,
          reactionMs: waveTimeLimit,
          switchTimeMs: 0,
          angularErrorDeg: 999,
          targetMoving: this.activeTargets[i]?.moving ?? false,
        });
      }

      this.targetManager.clear();
      this.activeTargets = [];
      this.waveIndex++;
      this.waitingForWave = true;
      this.nextWaveTime = now + 1500;

      if (this.waveIndex >= this.totalWaves) {
        this.finish();
      }
    }
  }

  onClick(): void {
    if (this.completed || this.activeTargets.length === 0) return;

    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);
    const now = performance.now();

    // 반동 적용
    this.weapon.fire(now);

    if (hitResult?.hit) {
      const targetData = this.activeTargets.find((t) => t.id === hitResult.targetId);
      if (targetData) {
        const switchTime = now - this.lastKillTime;
        const reactionTime = now - this.waveStartTime;

        this.results.push({
          hit: true,
          reactionMs: reactionTime,
          switchTimeMs: this.killsInWave > 0 ? switchTime : reactionTime,
          angularErrorDeg: hitResult.angularError * (180 / Math.PI),
          targetMoving: targetData.moving,
        });

        this.targetManager.removeTarget(targetData.id);
        this.activeTargets = this.activeTargets.filter((t) => t.id !== targetData.id);
        this.lastKillTime = now;
        this.killsInWave++;

        // 웨이브 완료
        if (this.activeTargets.length === 0) {
          this.waveIndex++;
          this.waitingForWave = true;
          this.nextWaveTime = now + 1500;

          if (this.waveIndex >= this.totalWaves) {
            this.finish();
          }
        }
      }
    }
  }

  /** 웨이브 스폰 */
  private spawnWave(): void {
    this.activeTargets = [];
    this.killsInWave = 0;
    this.waveStartTime = performance.now();
    this.lastKillTime = this.waveStartTime;

    const count = 2 + Math.min(this.waveIndex, 3); // 2~5개
    const distance = 30 + Math.random() * 40; // 30~70m

    for (let i = 0; i < count; i++) {
      // 동적 이동범위 — FOV에 비례하여 스폰 영역 제한
      const yaw = (Math.random() - 0.5) * (this.maxYawRange * 2);
      const pitch = (Math.random() - 0.5) * this.maxYawRange;
      const moving = Math.random() > 0.4; // 60% 이동 타겟

      const pos = new THREE.Vector3(
        distance * Math.sin(yaw * DEG2RAD),
        1.6 + distance * Math.sin(pitch * DEG2RAD),
        -distance * Math.cos(yaw * DEG2RAD),
      );

      const target = this.targetManager.spawnTarget(pos, {
        angularSizeDeg: this.difficulty.targetSizeDeg / this.weapon.getConfig().zoomMultiplier,
        distanceM: distance,
        color: moving ? 0xff9f43 : 0xe94560,
      });

      this.activeTargets.push({
        id: target.id,
        moving,
        basePos: pos.clone(),
        speed: this.difficulty.targetSpeedDegPerSec,
        spawnTime: performance.now(),
      });
    }
  }

  /** 시나리오 종료 */
  private finish(): void {
    this.completed = true;
    this.weapon.setZoomed(false);
    this.engine.setScope(103, 1);
    if (this.onCompleteCallback) {
      this.onCompleteCallback(this.getResults());
    }
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): unknown {
    const hits = this.results.filter((r) => r.hit);
    const accuracy = this.results.length > 0 ? hits.length / this.results.length : 0;
    const avgSwitch = hits.length > 1
      ? hits.slice(1).reduce((s, r) => s + r.switchTimeMs, 0) / (hits.length - 1) : 0;

    // 이동/정적 분리 통계
    const movingResults = this.results.filter((r) => r.targetMoving);
    const staticResults = this.results.filter((r) => !r.targetMoving);
    const movingAccuracy = movingResults.length > 0
      ? movingResults.filter((r) => r.hit).length / movingResults.length : 0;
    const staticAccuracy = staticResults.length > 0
      ? staticResults.filter((r) => r.hit).length / staticResults.length : 0;

    const score = accuracy * 40
      + (1 - Math.min(avgSwitch / 2000, 1)) * 35
      + movingAccuracy * 25;

    return {
      stageType: 'zoom_multi_flick',
      accuracy,
      avgSwitchTimeMs: avgSwitch,
      movingAccuracy,
      staticAccuracy,
      totalTargets: this.results.length,
      hits: hits.length,
      waves: this.totalWaves,
      score,
      trials: this.results,
    };
  }
}
