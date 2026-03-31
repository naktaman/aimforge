/**
 * Zoom 3-Phase Composite Runner (오케스트레이터)
 * Phase A(Steady) → B(Correction) → C(Reacquisition) 순차 실행
 * 페이즈 간 3초 카운트다운
 * composite = w_steady × A + w_correction × B + w_zoomout × C
 *
 * Scenario를 상속하지 않음 — 내부에서 각 Phase 시나리오를 관리
 */
import { ZoomSteadyScenario } from './ZoomSteadyScenario';
import { ZoomCorrectionScenario } from './ZoomCorrectionScenario';
import { ZoomReacquisitionScenario } from './ZoomReacquisitionScenario';
import { calculateZoomCompositeScore } from '../metrics/CompositeScore';
import type { GameEngine } from '../GameEngine';
import type { TargetManager } from '../TargetManager';
import type {
  ZoomCompositeConfig,
  ZoomTrialMetrics,
  ZoomPhaseResult,
  ZoomPhaseWeights,
} from '../../utils/types';

/** 기본 Phase 가중치 */
const DEFAULT_WEIGHTS: ZoomPhaseWeights = {
  steady: 0.5,
  correction: 0.3,
  zoomout: 0.2,
};

/** 페이즈 간 카운트다운 (ms) */
const PHASE_COUNTDOWN = 3000;

/** 실행 단계 */
type RunPhase = 'countdown_a' | 'phase_a' | 'countdown_b' | 'phase_b' | 'countdown_c' | 'phase_c' | 'complete';

export class ZoomCompositeRunner {
  private engine: GameEngine;
  private targetManager: TargetManager;
  private config: ZoomCompositeConfig;
  private weights: ZoomPhaseWeights;

  // 현재 실행 상태
  private runPhase: RunPhase = 'countdown_a';
  private countdownElapsed = 0;

  // Phase 시나리오 인스턴스
  private steadyScenario: ZoomSteadyScenario | null = null;
  private correctionScenario: ZoomCorrectionScenario | null = null;
  private reacquisitionScenario: ZoomReacquisitionScenario | null = null;

  // Phase 결과
  private steadyResult: ZoomPhaseResult | null = null;
  private correctionResult: ZoomPhaseResult | null = null;
  private reacquisitionResult: ZoomPhaseResult | null = null;

  // 콜백
  private onComplete: ((result: ZoomTrialMetrics) => void) | null = null;
  private onPhaseChange: ((phase: RunPhase, countdown?: number) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    config: ZoomCompositeConfig,
  ) {
    this.engine = engine;
    this.targetManager = targetManager;
    this.config = config;
    this.weights = config.weights ?? DEFAULT_WEIGHTS;
  }

  /** 완료 콜백 설정 */
  setOnComplete(cb: (result: ZoomTrialMetrics) => void): void {
    this.onComplete = cb;
  }

  /** 페이즈 변경 콜백 (UI 카운트다운 표시용) */
  setOnPhaseChange(cb: (phase: RunPhase, countdown?: number) => void): void {
    this.onPhaseChange = cb;
  }

  /** 실행 시작 */
  start(): void {
    this.runPhase = 'countdown_a';
    this.countdownElapsed = 0;
    this.steadyResult = null;
    this.correctionResult = null;
    this.reacquisitionResult = null;
    this.onPhaseChange?.('countdown_a', PHASE_COUNTDOWN);
  }

  /** 매 프레임 업데이트 */
  update(deltaTime: number): void {
    const dtMs = deltaTime * 1000;

    switch (this.runPhase) {
      case 'countdown_a':
      case 'countdown_b':
      case 'countdown_c':
        this.updateCountdown(dtMs);
        break;

      case 'phase_a':
        this.steadyScenario?.update(deltaTime);
        if (this.steadyScenario?.isComplete()) {
          this.steadyResult = this.steadyScenario.getResults();
          this.steadyScenario.dispose();
          this.steadyScenario = null;
          this.runPhase = 'countdown_b';
          this.countdownElapsed = 0;
          this.onPhaseChange?.('countdown_b', PHASE_COUNTDOWN);
        }
        break;

      case 'phase_b':
        this.correctionScenario?.update(deltaTime);
        if (this.correctionScenario?.isComplete()) {
          this.correctionResult = this.correctionScenario.getResults();
          this.correctionScenario.dispose();
          this.correctionScenario = null;
          this.runPhase = 'countdown_c';
          this.countdownElapsed = 0;
          this.onPhaseChange?.('countdown_c', PHASE_COUNTDOWN);
        }
        break;

      case 'phase_c':
        this.reacquisitionScenario?.update(deltaTime);
        if (this.reacquisitionScenario?.isComplete()) {
          this.reacquisitionResult = this.reacquisitionScenario.getResults();
          this.reacquisitionScenario.dispose();
          this.reacquisitionScenario = null;
          this.runPhase = 'complete';
          this.finalize();
        }
        break;

      case 'complete':
        break;
    }
  }

  /** 클릭 전달 */
  onClick(): void {
    switch (this.runPhase) {
      case 'phase_a':
        this.steadyScenario?.onClick();
        break;
      case 'phase_b':
        this.correctionScenario?.onClick();
        break;
      case 'phase_c':
        this.reacquisitionScenario?.onClick();
        break;
    }
  }

  /** 완료 여부 */
  isComplete(): boolean {
    return this.runPhase === 'complete';
  }

  /** 결과 반환 */
  getResults(): ZoomTrialMetrics {
    const steadyScore = this.steadyResult?.score ?? 0;
    const correctionScore = this.correctionResult?.score ?? 0;
    const reacquisitionScore = this.reacquisitionResult?.score ?? 0;
    const compositeScore = calculateZoomCompositeScore(
      steadyScore,
      correctionScore,
      reacquisitionScore,
      this.weights,
    );

    return {
      steadyScore,
      correctionScore,
      reacquisitionScore,
      compositeScore,
      zoomTier: this.config.steady.zoomTier,
      overCorrectionRatio: 0, // 상세값은 correctionScenario에서 추출 가능
      underCorrectionRatio: 0,
    };
  }

  /** 현재 실행 페이즈 */
  getCurrentPhase(): RunPhase {
    return this.runPhase;
  }

  /** 리소스 정리 */
  dispose(): void {
    this.steadyScenario?.dispose();
    this.correctionScenario?.dispose();
    this.reacquisitionScenario?.dispose();
    this.targetManager.clear();
  }

  // === 내부 ===

  /** 카운트다운 업데이트 */
  private updateCountdown(dtMs: number): void {
    this.countdownElapsed += dtMs;

    if (this.countdownElapsed >= PHASE_COUNTDOWN) {
      switch (this.runPhase) {
        case 'countdown_a':
          this.startPhaseA();
          break;
        case 'countdown_b':
          this.startPhaseB();
          break;
        case 'countdown_c':
          this.startPhaseC();
          break;
      }
    }
  }

  /** Phase A 시작 */
  private startPhaseA(): void {
    this.runPhase = 'phase_a';
    this.onPhaseChange?.('phase_a');

    const cfg = { ...this.config.steady, type: 'zoom_steady' as const };
    this.steadyScenario = new ZoomSteadyScenario(
      this.engine,
      this.targetManager,
      cfg,
    );
    this.steadyScenario.start();
  }

  /** Phase B 시작 */
  private startPhaseB(): void {
    this.runPhase = 'phase_b';
    this.onPhaseChange?.('phase_b');

    const cfg = { ...this.config.correction, type: 'zoom_correction' as const };
    this.correctionScenario = new ZoomCorrectionScenario(
      this.engine,
      this.targetManager,
      cfg,
    );
    this.correctionScenario.start();
  }

  /** Phase C 시작 */
  private startPhaseC(): void {
    this.runPhase = 'phase_c';
    this.onPhaseChange?.('phase_c');

    const cfg = { ...this.config.reacquisition, type: 'zoom_reacquisition' as const };
    this.reacquisitionScenario = new ZoomReacquisitionScenario(
      this.engine,
      this.targetManager,
      cfg,
    );
    this.reacquisitionScenario.start();
  }

  /** 최종 결과 계산 및 콜백 */
  private finalize(): void {
    const result = this.getResults();
    this.onComplete?.(result);
  }
}
