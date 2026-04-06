/**
 * Comparator (변환 방식 비교기) 트라이얼 루프 핸들러 훅
 * start_comparator → get_next_comparator_trial → 3-phase 시나리오 →
 * submit_comparator_trial → 반복 → finalize_comparator
 */
import { useCallback, type MutableRefObject } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEngineStore, type AppScreen } from '../stores/engineStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSessionStore } from '../stores/sessionStore';
import { useZoomCalibrationStore } from '../stores/zoomCalibrationStore';
import type { ComparatorResult } from '../stores/zoomCalibrationStore';
import { useToastStore } from '../stores/toastStore';
import { useGameMetricsStore } from './useGameMetrics';
import { ZoomSteadyScenario } from '../engine/scenarios/ZoomSteadyScenario';
import { ZoomCorrectionScenario } from '../engine/scenarios/ZoomCorrectionScenario';
import { ZoomReacquisitionScenario } from '../engine/scenarios/ZoomReacquisitionScenario';
import { SoundEngine } from '../engine/SoundEngine';
import type { GameEngine } from '../engine/GameEngine';
import type { TargetManager } from '../engine/TargetManager';
import type {
  ComparatorTrialAction,
  ComparatorTrialFeedbackResponse,
  ZoomPhaseConfig,
  ZoomPhaseResult,
  ScenarioType,
} from '../utils/types';

interface ComparatorHandlerDeps {
  engineRef: MutableRefObject<GameEngine | null>;
  targetManagerRef: MutableRefObject<TargetManager | null>;
  soundEngine: SoundEngine;
}

/** Comparator 트라이얼에서 3-phase 시나리오를 순차 실행하고 점수 수집 */
async function run3PhaseScenario(
  engine: GameEngine,
  tm: TargetManager,
  multiplier: number,
  hfov: number,
  ratio: number,
  soundEngine: SoundEngine,
  startScenario: (type: ScenarioType | null) => void,
  endScenario: () => void,
  setScreen: (screen: AppScreen) => void,
): Promise<{ steady: number; correction: number; zoomout: number } | null> {
  // scope FOV 근사
  const hipRad = (hfov * Math.PI) / 180 / 2;
  const scopeHalf = Math.atan(Math.tan(hipRad) / ratio);
  const scopeFov = (scopeHalf * 2 * 180) / Math.PI;

  const tierMap = [1, 2, 4, 6, 8, 10, 12] as const;
  const closestTier = tierMap.reduce((prev, curr) =>
    Math.abs(curr - ratio) < Math.abs(prev - ratio) ? curr : prev,
  );

  const baseConfig: ZoomPhaseConfig = {
    type: 'zoom_steady',
    targetSizeDeg: 3,
    hipfireFov: hfov,
    scopeFov,
    scopeMultiplier: multiplier,
    zoomTier: `${closestTier}x` as ZoomPhaseConfig['zoomTier'],
    distance: 10,
    duration: 10000,
    numTargets: 8,
  };

  /** 단일 phase 실행 후 점수 반환 */
  const runPhase = (
    phase: 'steady' | 'correction' | 'zoomout',
  ): Promise<number> => {
    return new Promise((resolve) => {
      const config = { ...baseConfig, type: phaseTypeMap[phase] };

      setScreen('viewport');
      startScenario('flick');
      useGameMetricsStore.getState().startSession({
        durationMs: config.duration,
        totalTargets: config.numTargets,
      });

      let scenario;
      switch (phase) {
        case 'steady':
          scenario = new ZoomSteadyScenario(engine, tm, config);
          break;
        case 'correction':
          scenario = new ZoomCorrectionScenario(engine, tm, config);
          break;
        case 'zoomout':
          scenario = new ZoomReacquisitionScenario(engine, tm, config);
          break;
      }

      scenario.setOnComplete((result: ZoomPhaseResult) => {
        endScenario();
        useGameMetricsStore.getState().endSession();
        engine.setScenario(null);
        resolve(result.score);
      });

      engine.setScenario(scenario);
      scenario.start();
      soundEngine.playSpawn();
    });
  };

  const phaseTypeMap: Record<string, ZoomPhaseConfig['type']> = {
    steady: 'zoom_steady',
    correction: 'zoom_correction',
    zoomout: 'zoom_reacquisition',
  };

  try {
    const steady = await runPhase('steady');
    const correction = await runPhase('correction');
    const zoomout = await runPhase('zoomout');
    return { steady, correction, zoomout };
  } catch (e) {
    console.error('Comparator 3-phase 시나리오 실패:', e);
    return null;
  }
}

/** Comparator 핸들러 훅 */
export function useComparatorHandlers(deps: ComparatorHandlerDeps): {
  handleComparatorStart: (profileId: number, zoomProfileId: number, multipliers: number[]) => void;
  handleComparatorRunTrial: () => void;
} {
  const { engineRef, targetManagerRef, soundEngine } = deps;
  const { startScenario, endScenario } = useSessionStore();
  const setScreen = useEngineStore((s) => s.setScreen);

  /** Comparator 시작 — Rust에 시작 요청 + 스토어 초기화 */
  const handleComparatorStart = useCallback(
    (profileId: number, zoomProfileId: number, multipliers: number[]): void => {
      (async () => {
        try {
          await invoke('start_comparator', {
            params: {
              profile_id: profileId,
              zoom_profile_id: zoomProfileId,
              multipliers,
            },
          });

          // 전체 트라이얼 수: 방식 6개 × 반복 3회 = 18
          const totalTrials = multipliers.length * 3;
          useZoomCalibrationStore.getState().startComparator(totalTrials);
          setScreen('zoom-calibration-progress');
        } catch (e) {
          console.error('Comparator 시작 실패:', e);
          useToastStore.getState().addToast('방식 비교 시작 실패: ' + String(e), 'error');
        }
      })();
    },
    [setScreen],
  );

  /** 다음 Comparator 트라이얼 실행 */
  const handleComparatorRunTrial = useCallback((): void => {
    const engine = engineRef.current;
    const tm = targetManagerRef.current;
    if (!engine || !tm) return;

    (async () => {
      try {
        // 현재 예측 배율 목록 (Comparator가 내부적으로 사용)
        const preds = useZoomCalibrationStore.getState().predictedMultipliers;
        const multipliers = preds.map((p) => p.multiplier);

        // 다음 트라이얼 조회
        const trial = await invoke<ComparatorTrialAction | null>(
          'get_next_comparator_trial',
          { multipliers },
        );

        if (!trial) {
          // 모든 트라이얼 완료 → finalize
          const result = await invoke<ComparatorResult>('finalize_comparator');
          useZoomCalibrationStore.getState().setComparatorResult(result);
          setScreen('comparator-result');
          return;
        }

        // 스토어 업데이트
        useZoomCalibrationStore.getState().updateComparator(trial.trialNumber, trial.method);

        // 3-phase 시나리오 실행
        const hfov = useSettingsStore.getState().hfov || 103;
        // 현재 줌 비율 가져오기
        const store = useZoomCalibrationStore.getState();
        const currentStatus = store.ratioStatuses[store.currentRatioIndex];
        const ratio = currentStatus?.zoomRatio ?? 2.25;

        const scores = await run3PhaseScenario(
          engine, tm, trial.multiplier, hfov, ratio, soundEngine,
          startScenario, endScenario, setScreen,
        );

        if (!scores) {
          setScreen('zoom-calibration-progress');
          return;
        }

        // 합성 점수 계산 (가중 평균 — steady 40%, correction 35%, zoomout 25%)
        const composite = scores.steady * 0.4 + scores.correction * 0.35 + scores.zoomout * 0.25;

        // 제출
        const feedback = await invoke<ComparatorTrialFeedbackResponse>(
          'submit_comparator_trial',
          {
            params: {
              steady_score: scores.steady,
              correction_score: scores.correction,
              zoomout_score: scores.zoomout,
              composite_score: composite,
            },
          },
        );

        // 완료 여부 확인
        if (!feedback.hasNext) {
          const result = await invoke<ComparatorResult>('finalize_comparator');
          useZoomCalibrationStore.getState().setComparatorResult(result);
          setScreen('comparator-result');
        } else {
          // progress 화면 복귀
          setScreen('zoom-calibration-progress');
        }
      } catch (e) {
        console.error('Comparator 트라이얼 실패:', e);
        useToastStore.getState().addToast('방식 비교 트라이얼 실패: ' + String(e), 'error');
        setScreen('zoom-calibration-progress');
      }
    })();
  }, [startScenario, endScenario, setScreen, engineRef, targetManagerRef, soundEngine]);

  return { handleComparatorStart, handleComparatorRunTrial };
}
