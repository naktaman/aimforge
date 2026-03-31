/**
 * Custom Drill 시나리오 — 사용자 정의 조합 훈련
 * 플릭/트래킹/멀티플릭을 파라미터로 자유롭게 구성
 * Aim DNA 약점 기반 자동 생성 드릴 또는 수동 커스텀
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';

/** 드릴 모드 — 단일 타입 또는 혼합 */
type DrillMode = 'flick' | 'track' | 'switch' | 'mixed';

/** 커스텀 드릴 설정 */
export interface CustomDrillConfig {
  /** 드릴 모드 */
  mode: DrillMode;
  /** 총 시행 수 (flick/switch) 또는 지속 시간 ms (track) */
  count: number;
  /** 타겟 크기 (각도) */
  targetSizeDeg: number;
  /** 타겟 거리 (m) */
  distanceM: number;
  /** 최소 각도 (deg) */
  minAngleDeg: number;
  /** 최대 각도 (deg) */
  maxAngleDeg: number;
  /** 타겟 이동 속도 (track 모드, deg/s) */
  targetSpeedDegPerSec: number;
  /** 반응 윈도우 (ms) */
  reactionWindowMs: number;
  /** 동시 타겟 수 (switch 모드) */
  simultaneousTargets: number;
  /** 드릴 이름 (사용자 지정) */
  drillName: string;
}

/** 개별 결과 */
interface TrialResult {
  hit: boolean;
  reactionMs: number;
  errorDeg: number;
  mode: DrillMode;
}

/** 기본 설정 */
const DEFAULT_CONFIG: CustomDrillConfig = {
  mode: 'flick',
  count: 20,
  targetSizeDeg: 2.5,
  distanceM: 10,
  minAngleDeg: 15,
  maxAngleDeg: 90,
  targetSpeedDegPerSec: 30,
  reactionWindowMs: 3000,
  simultaneousTargets: 1,
  drillName: 'Custom Drill',
};

export class CustomDrillScenario extends Scenario {
  private config: CustomDrillConfig;
  private completed = false;
  private results: TrialResult[] = [];

  // Flick/Switch 모드 상태
  private currentTargetIds: string[] = [];
  private targetIndex = 0;
  private targetAppearTime = 0;
  private waitingForTarget = true;
  private nextSpawnTime = 0;

  // Track 모드 상태
  private trackStartTime = 0;
  private trackSamples: Array<{ errorDeg: number }> = [];
  private lastSampleTime = 0;
  private trackMoveAngle = 0;

  // Mixed 모드 — 페이즈 순환
  private mixedPhaseIndex = 0;
  private mixedPhases: DrillMode[] = ['flick', 'track', 'switch'];
  private mixedPhaseCount = 0;
  private readonly mixedPerPhase = 5; // 페이즈당 시행 수

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    config: Partial<CustomDrillConfig> = {},
  ) {
    super(engine, targetManager);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setOnComplete(cb: (results: unknown) => void): void {
    this.onCompleteCallback = cb;
  }

  start(): void {
    this.completed = false;
    this.results = [];
    this.targetIndex = 0;
    this.waitingForTarget = true;
    this.nextSpawnTime = performance.now() + 1000;
    this.mixedPhaseIndex = 0;
    this.mixedPhaseCount = 0;
  }

  update(_deltaTime: number): void {
    if (this.completed) return;

    const now = performance.now();
    const activeMode = this.getActiveMode();

    switch (activeMode) {
      case 'flick':
        this.updateFlick(now);
        break;
      case 'track':
        this.updateTrack(now);
        break;
      case 'switch':
        this.updateSwitch(now);
        break;
    }
  }

  onClick(): void {
    if (this.completed) return;

    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);
    const now = performance.now();
    const activeMode = this.getActiveMode();

    switch (activeMode) {
      case 'flick': {
        if (this.currentTargetIds.length > 0) {
          const reactionMs = now - this.targetAppearTime;
          this.results.push({
            hit: hitResult?.hit ?? false,
            reactionMs,
            errorDeg: hitResult ? hitResult.angularError * (180 / Math.PI) : 999,
            mode: 'flick',
          });
          this.clearTargets();
          this.advanceTarget();
        }
        break;
      }

      case 'track':
        // 트래킹은 클릭 불필요
        break;

      case 'switch': {
        if (hitResult?.hit && this.currentTargetIds.includes(hitResult.targetId)) {
          const reactionMs = now - this.targetAppearTime;
          this.results.push({
            hit: true,
            reactionMs,
            errorDeg: hitResult.angularError * (180 / Math.PI),
            mode: 'switch',
          });
          this.targetManager.removeTarget(hitResult.targetId);
          this.currentTargetIds = this.currentTargetIds.filter((id) => id !== hitResult.targetId);

          // 모든 타겟 처치 시
          if (this.currentTargetIds.length === 0) {
            this.advanceTarget();
          }
        }
        break;
      }
    }
  }

  /** 현재 활성 모드 (mixed 시 순환) */
  private getActiveMode(): DrillMode {
    if (this.config.mode !== 'mixed') return this.config.mode;
    return this.mixedPhases[this.mixedPhaseIndex % this.mixedPhases.length];
  }

  // ── Flick 모드 ──

  private updateFlick(now: number): void {
    if (this.waitingForTarget && now >= this.nextSpawnTime) {
      this.spawnFlickTarget();
      this.waitingForTarget = false;
    }

    // 시간 초과
    if (!this.waitingForTarget && this.currentTargetIds.length > 0) {
      if (now - this.targetAppearTime > this.config.reactionWindowMs) {
        this.results.push({
          hit: false,
          reactionMs: this.config.reactionWindowMs,
          errorDeg: 999,
          mode: 'flick',
        });
        this.clearTargets();
        this.advanceTarget();
      }
    }
  }

  // ── Track 모드 ──

  private updateTrack(now: number): void {
    // 첫 프레임 — 트래킹 타겟 스폰
    if (this.waitingForTarget && now >= this.nextSpawnTime) {
      this.spawnTrackTarget();
      this.trackStartTime = now;
      this.waitingForTarget = false;
    }

    if (!this.waitingForTarget && this.currentTargetIds.length > 0) {
      // 타겟 이동
      const elapsed = now - this.trackStartTime;
      this.trackMoveAngle += (this.config.targetSpeedDegPerSec / 60) * 0.016;
      const x = Math.sin(this.trackMoveAngle) * 5;
      const pos = new THREE.Vector3(x, 1.6, -this.config.distanceM);
      this.targetManager.updateTargetPosition(this.currentTargetIds[0], pos);

      // 샘플링
      if (now - this.lastSampleTime >= 16) {
        const camera = this.engine.getCamera();
        const forward = this.engine.getCameraForward();
        const hitResult = this.targetManager.checkHit(camera.position, forward);
        if (hitResult) {
          this.trackSamples.push({ errorDeg: hitResult.angularError * (180 / Math.PI) });
        }
        this.lastSampleTime = now;
      }

      // 트래킹 종료 (count를 지속 시간 ms로 사용)
      if (elapsed >= this.config.count) {
        const mad = this.trackSamples.length > 0
          ? this.trackSamples.reduce((s, sample) => s + sample.errorDeg, 0) / this.trackSamples.length
          : 999;
        this.results.push({
          hit: this.trackSamples.length > 0,
          reactionMs: elapsed,
          errorDeg: mad,
          mode: 'track',
        });
        this.clearTargets();
        this.trackSamples = [];
        this.advanceTarget();
      }
    }
  }

  // ── Switch 모드 ──

  private updateSwitch(now: number): void {
    if (this.waitingForTarget && now >= this.nextSpawnTime) {
      this.spawnSwitchTargets();
      this.waitingForTarget = false;
    }

    // 시간 초과
    if (!this.waitingForTarget && this.currentTargetIds.length > 0) {
      const timeLimit = this.config.reactionWindowMs * this.config.simultaneousTargets;
      if (now - this.targetAppearTime > timeLimit) {
        // 남은 타겟 미스 처리
        for (let i = 0; i < this.currentTargetIds.length; i++) {
          this.results.push({
            hit: false,
            reactionMs: timeLimit,
            errorDeg: 999,
            mode: 'switch',
          });
        }
        this.clearTargets();
        this.advanceTarget();
      }
    }
  }

  // ── 스폰 헬퍼 ──

  private spawnFlickTarget(): void {
    const azimuth = Math.random() * 360 - 180;
    const DEG2RAD = Math.PI / 180;
    const d = this.config.distanceM;

    const pos = new THREE.Vector3(
      d * Math.sin(azimuth * DEG2RAD),
      1.6 + (Math.random() - 0.5) * 3,
      -d * Math.cos(azimuth * DEG2RAD),
    );

    const target = this.targetManager.spawnTarget(pos, {
      angularSizeDeg: this.config.targetSizeDeg,
      distanceM: d,
      color: 0xe94560,
    });

    this.currentTargetIds = [target.id];
    this.targetAppearTime = performance.now();
  }

  private spawnTrackTarget(): void {
    const pos = new THREE.Vector3(0, 1.6, -this.config.distanceM);

    const target = this.targetManager.spawnTarget(pos, {
      angularSizeDeg: this.config.targetSizeDeg,
      distanceM: this.config.distanceM,
      color: 0x4ecdc4,
    });

    this.currentTargetIds = [target.id];
    this.targetAppearTime = performance.now();
    this.trackMoveAngle = 0;
  }

  private spawnSwitchTargets(): void {
    this.currentTargetIds = [];
    const count = this.config.simultaneousTargets;
    const DEG2RAD = Math.PI / 180;
    const d = this.config.distanceM;

    for (let i = 0; i < count; i++) {
      const yaw = ((i / count) * 360 - 180 + Math.random() * 30) * DEG2RAD;
      const pos = new THREE.Vector3(
        d * Math.sin(yaw),
        1.6 + (Math.random() - 0.5) * 2,
        -d * Math.cos(yaw),
      );

      const target = this.targetManager.spawnTarget(pos, {
        angularSizeDeg: this.config.targetSizeDeg,
        distanceM: d,
        color: 0xff9f43,
      });
      this.currentTargetIds.push(target.id);
    }

    this.targetAppearTime = performance.now();
  }

  // ── 진행 관리 ──

  private clearTargets(): void {
    for (const id of this.currentTargetIds) {
      this.targetManager.removeTarget(id);
    }
    this.currentTargetIds = [];
  }

  private advanceTarget(): void {
    if (this.config.mode === 'mixed') {
      this.mixedPhaseCount++;
      if (this.mixedPhaseCount >= this.mixedPerPhase) {
        this.mixedPhaseCount = 0;
        this.mixedPhaseIndex++;
        if (this.mixedPhaseIndex >= this.mixedPhases.length) {
          this.finish();
          return;
        }
      }
    } else {
      this.targetIndex++;
      const limit = this.config.mode === 'track' ? 1 : this.config.count;
      if (this.targetIndex >= limit) {
        this.finish();
        return;
      }
    }

    this.waitingForTarget = true;
    this.nextSpawnTime = performance.now() + 800 + Math.random() * 700;
  }

  private finish(): void {
    this.completed = true;
    this.clearTargets();
    if (this.onCompleteCallback) {
      this.onCompleteCallback(this.getResults());
    }
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): unknown {
    const flickResults = this.results.filter((r) => r.mode === 'flick');
    const trackResults = this.results.filter((r) => r.mode === 'track');
    const switchResults = this.results.filter((r) => r.mode === 'switch');

    const hits = this.results.filter((r) => r.hit);
    const accuracy = this.results.length > 0 ? hits.length / this.results.length : 0;

    const avgReaction = hits.filter((r) => r.mode !== 'track').length > 0
      ? hits.filter((r) => r.mode !== 'track').reduce((s, r) => s + r.reactionMs, 0)
        / hits.filter((r) => r.mode !== 'track').length
      : 0;

    const avgError = this.results.length > 0
      ? this.results.filter((r) => r.errorDeg < 100).reduce((s, r) => s + r.errorDeg, 0)
        / Math.max(this.results.filter((r) => r.errorDeg < 100).length, 1)
      : 0;

    // 점수: 정확도 50% + 반응 시간 30% + 정밀도 20%
    const score = accuracy * 50
      + (1 - Math.min(avgReaction / 3000, 1)) * 30
      + (1 - Math.min(avgError / 5, 1)) * 20;

    return {
      stageType: 'custom_drill',
      drillName: this.config.drillName,
      mode: this.config.mode,
      accuracy,
      avgReactionMs: avgReaction,
      avgErrorDeg: avgError,
      totalTrials: this.results.length,
      hits: hits.length,
      score,
      flickStats: flickResults.length > 0 ? {
        total: flickResults.length,
        hits: flickResults.filter((r) => r.hit).length,
      } : null,
      trackStats: trackResults.length > 0 ? {
        avgMad: trackResults.reduce((s, r) => s + r.errorDeg, 0) / trackResults.length,
      } : null,
      switchStats: switchResults.length > 0 ? {
        total: switchResults.length,
        hits: switchResults.filter((r) => r.hit).length,
      } : null,
      trials: this.results,
    };
  }
}
