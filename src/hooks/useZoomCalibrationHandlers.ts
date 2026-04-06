/**
 * 줌 캘리브레이션 트라이얼 루프 핸들러 훅
 * get_next_zoom_trial → phase별 시나리오 → submit_zoom_trial → 반복/완료
 * useCalibrationHandlers.ts / useBatteryHandlers.ts 패턴 참고
 */
import { useCallback, type MutableRefObject } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEngineStore } from '../stores/engineStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSessionStore } from '../stores/sessionStore';
import { useZoomCalibrationStore } from '../stores/zoomCalibrationStore';
import type { KFitResult, PredictedMultiplier } from '../stores/zoomCalibrationStore';
import { useToastStore } from '../stores/toastStore';
import { useGameMetricsStore } from './useGameMetrics';
import { ZoomSteadyScenario } from '../engine/scenarios/ZoomSteadyScenario';
import { ZoomCorrectionScenario } from '../engine/scenarios/ZoomCorrectionScenario';
import { ZoomReacquisitionScenario } from '../engine/scenarios/ZoomReacquisitionScenario';
import { SoundEngine } from '../engine/SoundEngine';
import type { GameEngine } from '../engine/GameEngine';
import type { TargetManager } from '../engine/TargetManager';
import type {
  ZoomTrialAction,
  ZoomTrialFeedback,
  ZoomCalibrationResultResponse,
  ZoomPhaseConfig,
  ZoomPhaseResult,
} from '../utils/types';

interface ZoomCalibrationHandlerDeps {
  engineRef: MutableRefObject<GameEngine | null>;
  targetManagerRef: MutableRefObject<TargetManager | null>;
  soundEngine: SoundEngine;
}

/** 줌 트라이얼 정보로 ZoomPhaseConfig 생성 */
function buildZoomPhaseConfig(trial: ZoomTrialAction, hfov: number): ZoomPhaseConfig {
  // scope FOV 근사: hipfire_fov / zoom_ratio
  const hipRad = (hfov * Math.PI) / 180 / 2;
  const scopeHalf = Math.atan(Math.tan(hipRad) / trial.ratio);
  const scopeFov = (scopeHalf * 2 * 180) / Math.PI;

  // phase에 따른 타입 매핑
  const typeMap: Record<string, ZoomPhaseConfig['type']> = {
    steady: 'zoom_steady',
    correction: 'zoom_correction',
    zoomout: 'zoom_reacquisition',
  };

  // zoom tier 근사
  const tierMap = [1, 2, 4, 6, 8, 10, 12] as const;
  const closestTier = tierMap.reduce((prev, curr) =>
    Math.abs(curr - trial.ratio) < Math.abs(prev - trial.ratio) ? curr : prev,
  );

  return {
    type: typeMap[trial.phase] ?? 'zoom_steady',
    targetSizeDeg: 3,
    hipfireFov: hfov,
    scopeFov,
    scopeMultiplier: trial.multiplier,
    zoomTier: `${closestTier}x` as ZoomPhaseConfig['zoomTier'],
    distance: 10,
    duration: 15000,
    numTargets: 10,
  };
}

/** 줌 캘리브레이션 트라이얼 루프 핸들러 */
export function useZoomCalibrationHandlers(deps: ZoomCalibrationHandlerDeps): {
  handleZoomLaunchTrial: () => void;
  handleZoomFinalize: () => Promise<void>;
} {
  const { engineRef, targetManagerRef, soundEngine } = deps;
  const { startScenario, endScenario } = useSessionStore();
  const setScreen = useEngineStore((s) => s.setScreen);

  /** 줌 캘리브레이션 최종 결과 생성 + 결과 화면 이동 */
  const handleZoomFinalize = useCallback(async (): Promise<void> => {
    try {
      const result = await invoke<ZoomCalibrationResultResponse>('finalize_zoom_calibration');

      // store에 K 피팅 결과 + 예측 배율 저장
      const kFit: KFitResult = {
        kValue: result.kFit.kValue,
        kVariance: result.kFit.kVariance,
        quality: result.kFit.quality as KFitResult['quality'],
        dataPoints: result.kFit.dataPoints,
        piecewiseK: result.kFit.piecewiseK,
      };
      const predictions: PredictedMultiplier[] = result.predictedMultipliers.map((p) => ({
        scopeName: p.scopeName,
        zoomRatio: p.zoomRatio,
        multiplier: p.multiplier,
        isMeasured: p.isMeasured,
      }));

      useZoomCalibrationStore.getState().setKFitResult(kFit);
      useZoomCalibrationStore.getState().setPredictedMultipliers(predictions);
      setScreen('zoom-calibration-result');
    } catch (e) {
      console.error('줌 캘리브레이션 최종화 실패:', e);
      useToastStore.getState().addToast('줌 캘리브레이션 결과 생성 실패: ' + String(e), 'error');
    }
  }, [setScreen]);

  /** 다음 줌 트라이얼 가져와서 phase별 시나리오 실행 */
  const handleZoomLaunchTrial = useCallback((): void => {
    const engine = engineRef.current;
    const tm = targetManagerRef.current;
    if (!engine || !tm) return;

    (async () => {
      try {
        // 1. Rust에서 다음 트라이얼 정보 조회
        const trial = await invoke<ZoomTrialAction | null>('get_next_zoom_trial');

        // null → 모든 비율 완료
        if (!trial) {
          await handleZoomFinalize();
          return;
        }

        // 2. 스토어 상태 업데이트
        const store = useZoomCalibrationStore.getState();
        store.setCurrentPhase(trial.phase);

        // 3. Phase별 ZoomPhaseConfig 생성
        const hfov = useSettingsStore.getState().hfov || 103;
        const config = buildZoomPhaseConfig(trial, hfov);

        // 4. 시나리오 화면 전환
        setScreen('viewport');
        startScenario('flick'); // zoom scenario도 viewport 사용

        // 5. HUD 메트릭 시작
        useGameMetricsStore.getState().startSession({
          durationMs: config.duration,
          totalTargets: config.numTargets,
        });

        // 6. Phase별 시나리오 완료 콜백
        const onPhaseComplete = async (result: ZoomPhaseResult): Promise<void> => {
          try {
            endScenario();
            useGameMetricsStore.getState().endSession();
            engine.setScenario(null);

            // Rust에 결과 제출
            const feedback = await invoke<ZoomTrialFeedback>('submit_zoom_trial', {
              params: { phase: trial.phase, score: result.score },
            });

            // 스토어 업데이트
            store.updateRatioProgress(
              trial.ratioIndex,
              trial.iteration + 1,
              feedback.currentBestMultiplier,
              feedback.currentBestScore,
            );

            // 비율 수렴 → 완료 처리
            if (feedback.ratioConverged) {
              store.completeRatio(trial.ratioIndex);
            }
            if (feedback.advanceToNextRatio) {
              store.advanceToNextRatio();
            }

            // 피로 중단
            if (feedback.fatigueStop) {
              useToastStore.getState().addToast('피로 감지 — 캘리브레이션 자동 종료', 'warning');
              await handleZoomFinalize();
              return;
            }

            // 전체 완료
            if (feedback.allComplete) {
              await handleZoomFinalize();
              return;
            }

            // 계속 → progress 화면 복귀
            setScreen('zoom-calibration-progress');
          } catch (e) {
            console.error('줌 트라이얼 제출 실패:', e);
            useToastStore.getState().addToast('줌 트라이얼 제출 실패: ' + String(e), 'error');
            endScenario();
            engine.setScenario(null);
            setScreen('zoom-calibration-progress');
          }
        };

        // 7. Phase별 시나리오 생성
        let scenario;
        switch (trial.phase) {
          case 'steady':
            scenario = new ZoomSteadyScenario(engine, tm, config);
            break;
          case 'correction':
            scenario = new ZoomCorrectionScenario(engine, tm, config);
            break;
          case 'zoomout':
            scenario = new ZoomReacquisitionScenario(engine, tm, config);
            break;
          default:
            scenario = new ZoomSteadyScenario(engine, tm, config);
        }

        scenario.setOnComplete(onPhaseComplete);
        engine.setScenario(scenario);
        scenario.start();
        soundEngine.playSpawn();
      } catch (e) {
        console.error('줌 트라이얼 시작 실패:', e);
        useToastStore.getState().addToast('줌 트라이얼 시작 실패: ' + String(e), 'error');
      }
    })();
  }, [startScenario, endScenario, setScreen, engineRef, targetManagerRef, soundEngine, handleZoomFinalize]);

  return { handleZoomLaunchTrial, handleZoomFinalize };
}
