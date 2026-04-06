/**
 * Aerial Tracking 시나리오 — 공중 타겟 트래킹
 * Apex 점프패드, 오버워치 Pharah 등 공중 이동 적 추적
 * 포물선/불규칙 3D 궤적
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import type { DifficultyConfig } from '../../../utils/types';
import { TARGET_COLORS } from '../../../config/theme';

/** 공중 궤적 타입 */
type AerialTrajectory = 'parabolic' | 'hover' | 'dive' | 'zigzag';

/** 궤적 파라미터 */
interface TrajectoryParams {
  type: AerialTrajectory;
  /** 시작 위치 */
  startPos: THREE.Vector3;
  /** 최고점 높이 (m) */
  peakHeight: number;
  /** 수평 이동 범위 (m) */
  horizontalRange: number;
  /** 궤적 주기 (ms) */
  periodMs: number;
}

export class AerialTrackingScenario extends Scenario {
  private difficulty: DifficultyConfig;
  private durationMs: number;
  private completed = false;
  private startTime = 0;
  private currentTargetId: string | null = null;

  // 궤적 상태
  private trajectory: TrajectoryParams;
  private basePosition = new THREE.Vector3();

  // 측정 데이터
  private samples: Array<{ errorDeg: number; timestamp: number }> = [];
  private sampleInterval = 16; // ~60fps
  private lastSampleTime = 0;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    difficulty: DifficultyConfig,
    trajectoryType: AerialTrajectory = 'parabolic',
    durationMs = 12000,
  ) {
    super(engine, targetManager);
    this.difficulty = difficulty;
    this.durationMs = durationMs;

    // 궤적 파라미터 설정
    const distance = 12; // 타겟 기본 거리
    this.trajectory = {
      type: trajectoryType,
      startPos: new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        2,
        -distance,
      ),
      peakHeight: 6 + Math.random() * 4,
      horizontalRange: 8 + Math.random() * 6,
      periodMs: 3000 + Math.random() * 2000,
    };
  }

  setOnComplete(cb: (results: unknown) => void): void {
    this.onCompleteCallback = cb;
  }

  start(): void {
    this.completed = false;
    this.samples = [];
    this.startTime = performance.now();
    this.lastSampleTime = 0;
    this.basePosition.copy(this.trajectory.startPos);

    // 초기 타겟 스폰
    const target = this.targetManager.spawnTarget(
      this.trajectory.startPos.clone(),
      {
        angularSizeDeg: this.difficulty.targetSizeDeg,
        distanceM: this.trajectory.startPos.length(),
        color: TARGET_COLORS.trackingTeal,
      },
    );
    this.currentTargetId = target.id;
  }

  update(_deltaTime: number): void {
    if (this.completed) return;

    const elapsed = performance.now() - this.startTime;

    // 시간 초과
    if (elapsed >= this.durationMs) {
      this.completed = true;
      if (this.onCompleteCallback) {
        this.onCompleteCallback(this.getResults());
      }
      return;
    }

    // 타겟 위치 업데이트 — 궤적 타입별 계산
    if (this.currentTargetId) {
      const newPos = this.calculatePosition(elapsed);
      this.targetManager.updateTargetPosition(this.currentTargetId, newPos);

      // 트래킹 에러 샘플링
      if (elapsed - this.lastSampleTime >= this.sampleInterval) {
        this.sampleTrackingError(elapsed);
        this.lastSampleTime = elapsed;
      }
    }
  }

  onClick(): void {
    // 트래킹 시나리오 — 클릭 불필요 (연속 추적)
  }

  /** 궤적 타입별 위치 계산 */
  private calculatePosition(elapsedMs: number): THREE.Vector3 {
    const t = elapsedMs / this.trajectory.periodMs;
    const speed = this.difficulty.targetSpeedDegPerSec / 30; // 속도 보정
    const pos = new THREE.Vector3();

    switch (this.trajectory.type) {
      case 'parabolic': {
        // 포물선 궤적 — 점프패드 스타일
        const phase = (t * speed) % 2;
        const ascend = phase < 1;
        const p = ascend ? phase : 2 - phase;
        pos.set(
          this.basePosition.x + Math.sin(t * speed * Math.PI) * this.trajectory.horizontalRange,
          this.basePosition.y + p * this.trajectory.peakHeight,
          this.basePosition.z + Math.cos(t * speed * 0.5) * 3,
        );
        break;
      }

      case 'hover': {
        // 호버링 — Pharah 스타일 (높은 곳에서 불규칙 이동)
        const hoverHeight = this.trajectory.peakHeight;
        pos.set(
          this.basePosition.x + Math.sin(t * speed * 1.3) * 4 + Math.sin(t * speed * 3.7) * 1.5,
          hoverHeight + Math.sin(t * speed * 2.1) * 2,
          this.basePosition.z + Math.cos(t * speed * 0.8) * 3,
        );
        break;
      }

      case 'dive': {
        // 다이브 — 높은 곳에서 빠르게 내려옴
        const divePhase = (t * speed * 0.5) % 1;
        const height = divePhase < 0.7
          ? this.trajectory.peakHeight * (1 - divePhase / 0.7)
          : this.trajectory.peakHeight * (divePhase - 0.7) / 0.3;
        pos.set(
          this.basePosition.x + Math.sin(t * speed * 2) * this.trajectory.horizontalRange * 0.5,
          this.basePosition.y + height,
          this.basePosition.z + (divePhase < 0.7 ? -divePhase * 5 : (1 - divePhase) * 5),
        );
        break;
      }

      case 'zigzag': {
        // 지그재그 공중 이동
        const zigPhase = t * speed;
        pos.set(
          this.basePosition.x + ((zigPhase % 2 < 1 ? zigPhase % 1 : 1 - (zigPhase % 1)) - 0.5) * this.trajectory.horizontalRange * 2,
          this.basePosition.y + this.trajectory.peakHeight * 0.5 + Math.sin(zigPhase * Math.PI * 2) * 2,
          this.basePosition.z + Math.sin(zigPhase * 0.7) * 2,
        );
        break;
      }
    }

    return pos;
  }

  /** 트래킹 에러 샘플 수집 */
  private sampleTrackingError(timestamp: number): void {
    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);

    if (hitResult) {
      const errorDeg = hitResult.angularError * (180 / Math.PI);
      this.samples.push({ errorDeg, timestamp });
    }
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): unknown {
    if (this.samples.length === 0) {
      return {
        stageType: 'aerial_tracking',
        mad: 999,
        accuracy: 0,
        score: 0,
        samples: 0,
        trajectoryType: this.trajectory.type,
      };
    }

    // MAD (Mean Angular Deviation)
    const mad = this.samples.reduce((s, sample) => s + sample.errorDeg, 0) / this.samples.length;

    // 타겟 크기 이내 비율 (트래킹 정확도)
    const targetRadDeg = this.difficulty.targetSizeDeg / 2;
    const onTarget = this.samples.filter((s) => s.errorDeg <= targetRadDeg).length;
    const accuracy = onTarget / this.samples.length;

    // 편차 분산
    const variance = this.samples.reduce((s, sample) => s + (sample.errorDeg - mad) ** 2, 0) / this.samples.length;

    // 점수: accuracy 60% + MAD 역수 30% + smoothness 10%
    const smoothness = variance > 0 ? Math.min(1 / variance, 10) / 10 : 1;
    const score = accuracy * 60 + (1 - Math.min(mad / 10, 1)) * 30 + smoothness * 10;

    return {
      stageType: 'aerial_tracking',
      mad,
      accuracy,
      variance,
      smoothness,
      score,
      samples: this.samples.length,
      trajectoryType: this.trajectory.type,
      durationMs: this.durationMs,
      trackingMad: mad,
    };
  }
}
