/**
 * 캘리브레이션 트라이얼 루프 핸들러 훅
 * start_calibration 이후 → get_next_trial_sens → 시나리오 → submit → 반복 → finalize
 */
import { useCallback, type MutableRefObject } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEngineStore } from '../stores/engineStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSessionStore } from '../stores/sessionStore';
import { useCalibrationStore } from '../stores/calibrationStore';
import type { CalibrationMode, ConvergenceLevel } from '../stores/calibrationStore';
import { useToastStore } from '../stores/toastStore';
import { useTranslation } from '../i18n';
import { useGameMetricsStore } from './useGameMetrics';
import { FlickScenario } from '../engine/scenarios/FlickScenario';
import { calculateFlickScore } from '../engine/metrics/CompositeScore';
import { SoundEngine } from '../engine/SoundEngine';
import type { GameEngine } from '../engine/GameEngine';
import type { TargetManager } from '../engine/TargetManager';
import type {
  NextTrialAction,
  TrialFeedback,
  CalibrationStatusResponse,
} from '../utils/types';

interface CalibrationHandlerDeps {
  engineRef: MutableRefObject<GameEngine | null>;
  targetManagerRef: MutableRefObject<TargetManager | null>;
  soundEngine: SoundEngine;
  syncRecoilToEngine: (engine: GameEngine) => void;
}

/** 캘리브레이션 트라이얼 루프 핸들러 */
export function useCalibrationHandlers(deps: CalibrationHandlerDeps): {
  handleCalibrationLaunchTrial: () => void;
  handleCalibrationFinalize: () => Promise<void>;
  handleCalibrationStart: (mode: CalibrationMode, convergence?: ConvergenceLevel) => Promise<void>;
  handleCalibrationCancel: () => Promise<void>;
  handleCalibrationApply: (cm360: number) => void;
} {
  const { engineRef, targetManagerRef, soundEngine } = deps;
  const { dpi, cmPer360 } = useSettingsStore();
  const { startCalibration, resetCalibration } = useCalibrationStore();
  const { t } = useTranslation();
  const { startScenario, endScenario } = useSessionStore();
  const setScreen = useEngineStore((s) => s.setScreen);

  /** 캘리브레이션 최종 결과 생성 + 결과 화면 이동 */
  const handleCalibrationFinalize = useCallback(async (): Promise<void> => {
    const sessionId = useCalibrationStore.getState().sessionId;
    if (!sessionId) {
      console.error('캘리브레이션 세션 ID 없음');
      return;
    }

    try {
      const result = await invoke<ReturnType<typeof useCalibrationStore.getState>['result']>(
        'finalize_calibration',
        { session_id: sessionId },
      );
      if (result) {
        useCalibrationStore.getState().setResult(result);
      }
      setScreen('calibration-result');
    } catch (e) {
      console.error('캘리브레이션 최종화 실패:', e);
      useToastStore.getState().addToast('캘리브레이션 결과 생성 실패: ' + String(e), 'error');
    }
  }, [setScreen]);

  /** 다음 트라이얼 가져와서 시나리오 실행 */
  const handleCalibrationLaunchTrial = useCallback((): void => {
    const engine = engineRef.current;
    const tm = targetManagerRef.current;
    if (!engine || !tm) return;

    // 원본 cm360 저장 — finally에서 반드시 복원
    const originalCm360 = useSettingsStore.getState().cmPer360;

    /** 비동기 트라이얼 시작 */
    (async () => {
      try {
        // 1. Rust에서 다음 테스트할 cm360 조회
        const action = await invoke<NextTrialAction>('get_next_trial_sens');
        useCalibrationStore.getState().setNextCm360(action.cm360);

        // 2. 임시로 감도 설정 — Viewport.tsx useEffect가 엔진에 자동 반영
        useSettingsStore.setState({ cmPer360: action.cm360 });

        // 3. 시나리오 화면 이동
        setScreen('viewport');
        startScenario('flick');

        // 4. HUD 메트릭 세션 시작
        useGameMetricsStore.getState().startSession({ durationMs: 0, totalTargets: 20 });

        // 5. FlickScenario 생성 (배터리 flick case 참고)
        const scenario = new FlickScenario(engine, tm, {
          type: 'flick',
          targetSizeDeg: 3,
          angleRange: [10, 180] as [number, number],
          numTargets: 20,
          timeout: 3000,
        }, dpi);

        // 6. 완료 콜백 — 점수 계산 + 제출 + 상태 업데이트
        scenario.setOnComplete((_results) => {
          // try-finally로 원본 감도 복원 보장
          (async () => {
            try {
              // 점수 계산
              const raw = scenario.getTrialJson();
              const totalCount = raw.flickResults.length || 1;
              const totalHits = raw.flickResults.filter((r) => r.hit).length;
              const avgTtt = raw.flickResults.reduce((s, r) => s + r.ttt, 0) / totalCount;
              const avgOvershoot = raw.flickResults.reduce((s, r) => s + r.overshoot, 0) / totalCount;
              const preFire = raw.flickResults.filter((r) => r.clickType === 'PreFire').length;
              const score = calculateFlickScore(totalHits / totalCount, avgTtt, avgOvershoot, preFire / totalCount);

              // Rust에 트라이얼 결과 제출
              const feedback = await invoke<TrialFeedback>('submit_calibration_trial', {
                params: { cm360: action.cm360, score, metrics_json: JSON.stringify(raw.flickResults) },
              });

              // 상태 업데이트
              const status = await invoke<CalibrationStatusResponse>('get_calibration_status');
              useCalibrationStore.getState().updateStatus(status);

              // 시나리오 정리
              endScenario();
              useGameMetricsStore.getState().endSession();
              engine.setScenario(null);

              // 분기: 수렴 / 피로 / 계속
              if (feedback.converged) {
                await handleCalibrationFinalize();
              } else if (feedback.fatigueStop) {
                useCalibrationStore.getState().setFatigueStopped();
                setScreen('calibration-result');
              } else {
                setScreen('calibration-progress');
              }
            } catch (e) {
              console.error('캘리브레이션 트라이얼 제출 실패:', e);
              useToastStore.getState().addToast('트라이얼 제출 실패: ' + String(e), 'error');
              endScenario();
              engine.setScenario(null);
              setScreen('calibration-progress');
            } finally {
              // 원본 감도 복원 (항상 실행)
              useSettingsStore.setState({ cmPer360: originalCm360 });
            }
          })();
        });

        // 7. 시나리오 시작
        engine.setScenario(scenario);
        scenario.start();
        soundEngine.playSpawn();
      } catch (e) {
        // get_next_trial_sens 실패 시
        console.error('캘리브레이션 트라이얼 시작 실패:', e);
        useToastStore.getState().addToast('트라이얼 시작 실패: ' + String(e), 'error');
        useSettingsStore.setState({ cmPer360: originalCm360 });
      }
    })();
  }, [dpi, startScenario, endScenario, setScreen, engineRef, targetManagerRef, soundEngine, handleCalibrationFinalize]);

  /** 캘리브레이션 시작 */
  const handleCalibrationStart = useCallback(
    async (mode: CalibrationMode, convergence: ConvergenceLevel = 'quick'): Promise<void> => {
      try {
        const sessionId = await invoke<number>('start_calibration', {
          params: {
            profile_id: 1, mode, current_cm360: cmPer360,
            game_category: 'tactical', convergence_mode: convergence,
          },
        });
        startCalibration(mode, sessionId, convergence);
        setScreen('calibration-progress');
      } catch (e) {
        console.error('캘리브레이션 시작 실패:', e);
        useToastStore.getState().addToast(t('cal.startFailed') + ': ' + String(e), 'error');
      }
    },
    [cmPer360, startCalibration, setScreen, t],
  );

  /** 캘리브레이션 취소 */
  const handleCalibrationCancel = useCallback(async (): Promise<void> => {
    try { await invoke('cancel_calibration'); } catch (_) { /* 이미 없을 수 있음 */ }
    resetCalibration();
    setScreen('settings');
  }, [resetCalibration, setScreen]);

  /** 캘리브레이션 결과 감도 적용 */
  const handleCalibrationApply = useCallback(
    (_cm360: number): void => { resetCalibration(); setScreen('settings'); },
    [resetCalibration, setScreen],
  );

  return { handleCalibrationLaunchTrial, handleCalibrationFinalize, handleCalibrationStart, handleCalibrationCancel, handleCalibrationApply };
}
