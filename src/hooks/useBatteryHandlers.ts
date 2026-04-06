/**
 * 배터리 모드 핸들러 훅 — 배터리 시작/실행/취소/완료 로직
 * App.tsx에서 분리하여 배터리 시나리오 관리를 담당
 */
import { useCallback, type MutableRefObject } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEngineStore } from '../stores/engineStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSessionStore } from '../stores/sessionStore';
import { useBatteryStore, BATTERY_SCENARIO_DEFAULTS } from '../stores/batteryStore';
import { safeInvoke } from '../utils/ipc';
import { useGameMetricsStore } from './useGameMetrics';
import type { BatteryParams } from '../components/ScenarioSelect';
import { FlickScenario } from '../engine/scenarios/FlickScenario';
import { TrackingScenario } from '../engine/scenarios/TrackingScenario';
import { CircularTrackingScenario } from '../engine/scenarios/CircularTrackingScenario';
import { StochasticTrackingScenario } from '../engine/scenarios/StochasticTrackingScenario';
import { CounterStrafeFlickScenario } from '../engine/scenarios/CounterStrafeFlickScenario';
import { MicroFlickScenario } from '../engine/scenarios/MicroFlickScenario';
import { SoundEngine } from '../engine/SoundEngine';
import { calculateFlickScore, calculateTrackingScore } from '../engine/metrics/CompositeScore';
import type { GameEngine } from '../engine/GameEngine';
import type { TargetManager } from '../engine/TargetManager';
import type { ScenarioType } from '../utils/types';

interface BatteryHandlerDeps {
  engineRef: MutableRefObject<GameEngine | null>;
  targetManagerRef: MutableRefObject<TargetManager | null>;
  soundEngine: SoundEngine;
  syncRecoilToEngine: (engine: GameEngine) => void;
}

/** 배터리 모드 핸들러 훅 — 배터리 시작/시나리오 실행/취소/완료 반환 */
export function useBatteryHandlers(deps: BatteryHandlerDeps) {
  const { engineRef, targetManagerRef, soundEngine, syncRecoilToEngine } = deps;
  const { dpi } = useSettingsStore();
  const cmPer360 = useSettingsStore((s) => s.cmPer360);
  const { startScenario, endScenario } = useSessionStore();
  const setScreen = useEngineStore((s) => s.setScreen);

  /** 배터리 시작 — 세션 생성 후 battery-progress 이동 */
  const handleBattery = useCallback(
    async (params: BatteryParams) => {
      try {
        const sessionId = await invoke<number>('start_session', {
          params: { profile_id: 1, /* 단일 사용자 — user profiles.id */ mode: 'battery', session_type: params.preset },
        });
        useBatteryStore.getState().startBattery(params.preset, sessionId);
        setScreen('battery-progress');
      } catch (e) {
        console.error('배터리 시작 실패:', e);
      }
    },
    [setScreen],
  );

  /** 배터리 시나리오 실행 — battery-progress에서 호출 */
  const handleBatteryLaunchScenario = useCallback(
    (scenarioType: ScenarioType) => {
      const engine = engineRef.current;
      const tm = targetManagerRef.current;
      if (!engine || !tm) return;

      setScreen('viewport');
      startScenario(scenarioType);

      const defaults = BATTERY_SCENARIO_DEFAULTS[scenarioType] ?? {};

      // HUD 메트릭 세션 시작
      const bDur = (defaults.duration as number) ?? 0;
      const bTargets = scenarioType === 'flick' ? ((defaults.numTargets as number) ?? 20) : undefined;
      useGameMetricsStore.getState().startSession({
        durationMs: scenarioType === 'flick' ? 0 : bDur,
        totalTargets: bTargets,
      });

      /** 배터리 모드 시나리오 완료 콜백 */
      const onBatteryComplete = (score: number, rawMetrics: unknown) => {
        useBatteryStore.getState().recordComplete(scenarioType, score, rawMetrics);
        useBatteryStore.getState().advanceNext();
        endScenario();
        useGameMetricsStore.getState().endSession();
        engine.setScenario(null);
        setScreen('battery-progress');

        const sid = useBatteryStore.getState().sessionId;
        if (sid) {
          safeInvoke('save_trial', { params: {
            session_id: sid, scenario_type: scenarioType, cm360_tested: cmPer360,
            composite_score: score, raw_metrics: JSON.stringify(rawMetrics),
            mouse_trajectory: '[]', click_events: '[]',
            angle_breakdown: '{}', motor_breakdown: '{}',
          }}, true);
        }
      };

      /** Flick 계열 완료 콜백 */
      const onFlickBatteryDone = (_results: ReturnType<FlickScenario['getResults']>, scenario: { getTrialJson: () => ReturnType<FlickScenario['getTrialJson']> }) => {
        const raw = scenario.getTrialJson();
        const totalHits = raw.flickResults.filter(r => r.hit).length;
        const totalCount = raw.flickResults.length || 1;
        const avgTtt = raw.flickResults.reduce((s, r) => s + r.ttt, 0) / totalCount;
        const avgOvershoot = raw.flickResults.reduce((s, r) => s + r.overshoot, 0) / totalCount;
        const preFireCount = raw.flickResults.filter(r => r.clickType === 'PreFire').length;
        const score = calculateFlickScore(totalHits / totalCount, avgTtt, avgOvershoot, preFireCount / totalCount);
        onBatteryComplete(score, raw.flickResults);
      };

      switch (scenarioType) {
        case 'flick': {
          const scenario = new FlickScenario(engine, tm, {
            type: 'flick', targetSizeDeg: (defaults.targetSizeDeg as number) ?? 3,
            angleRange: (defaults.angleRange as [number, number]) ?? [10, 180],
            numTargets: (defaults.numTargets as number) ?? 20,
            timeout: (defaults.timeout as number) ?? 3000,
          }, dpi);
          scenario.setOnComplete((results) => onFlickBatteryDone(results, scenario));
          engine.setScenario(scenario); scenario.start(); soundEngine.playSpawn(); break;
        }
        case 'tracking': {
          const scenario = new TrackingScenario(engine, tm, {
            type: 'tracking', targetSizeDeg: (defaults.targetSizeDeg as number) ?? 3,
            targetSpeedDegPerSec: (defaults.targetSpeedDegPerSec as number) ?? 60,
            directionChanges: (defaults.directionChanges as number) ?? 6,
            duration: (defaults.duration as number) ?? 15000,
            trajectoryType: (defaults.trajectoryType as 'mixed') ?? 'mixed',
          });
          scenario.setOnComplete((results) => {
            const score = calculateTrackingScore(results.mad, results.velocityMatchRatio);
            onBatteryComplete(score, results);
          });
          engine.setScenario(scenario); scenario.start(); break;
        }
        case 'circular_tracking': {
          const scenario = new CircularTrackingScenario(engine, tm, {
            type: 'circular_tracking', targetSizeDeg: (defaults.targetSizeDeg as number) ?? 3,
            orbitRadiusDeg: (defaults.orbitRadiusDeg as number) ?? 15,
            orbitSpeedDegPerSec: (defaults.orbitSpeedDegPerSec as number) ?? 45,
            radiusVariation: (defaults.radiusVariation as number) ?? 0.2,
            speedVariation: (defaults.speedVariation as number) ?? 0.2,
            duration: (defaults.duration as number) ?? 15000,
            distance: (defaults.distance as number) ?? 10,
          });
          scenario.setOnComplete((results) => {
            const score = calculateTrackingScore(results.mad, results.velocityMatchRatio);
            onBatteryComplete(score, results);
          });
          engine.setScenario(scenario); scenario.start(); break;
        }
        case 'stochastic_tracking': {
          const scenario = new StochasticTrackingScenario(engine, tm, {
            type: 'stochastic_tracking', targetSizeDeg: (defaults.targetSizeDeg as number) ?? 3,
            noiseSpeed: (defaults.noiseSpeed as number) ?? 1.5,
            amplitudeDeg: (defaults.amplitudeDeg as number) ?? 20,
            duration: (defaults.duration as number) ?? 15000,
            distance: (defaults.distance as number) ?? 10,
          });
          scenario.setOnComplete((results) => {
            const score = calculateTrackingScore(results.mad, results.velocityMatchRatio);
            onBatteryComplete(score, results);
          });
          engine.setScenario(scenario); scenario.start(); break;
        }
        case 'counter_strafe_flick': {
          const scenario = new CounterStrafeFlickScenario(engine, tm, {
            type: 'counter_strafe_flick', targetSizeDeg: (defaults.targetSizeDeg as number) ?? 3,
            stopTimeMs: (defaults.stopTimeMs as number) ?? 200,
            strafeSpeedDegPerSec: (defaults.strafeSpeedDegPerSec as number) ?? 60,
            numTargets: (defaults.numTargets as number) ?? 15,
            angleRange: (defaults.angleRange as [number, number]) ?? [10, 120],
            timeout: (defaults.timeout as number) ?? 3000,
          }, dpi);
          scenario.setOnComplete((results) => onFlickBatteryDone(results, scenario));
          engine.setScenario(scenario); scenario.start(); soundEngine.playSpawn(); break;
        }
        case 'micro_flick': {
          const scenario = new MicroFlickScenario(engine, tm, {
            type: 'micro_flick', targetSizeDeg: (defaults.targetSizeDeg as number) ?? 3,
            switchFrequencyHz: (defaults.switchFrequencyHz as number) ?? 0.5,
            trackingSpeedDegPerSec: (defaults.targetSpeedDegPerSec as number) ?? 40,
            flickAngleRange: (defaults.flickAngleRange as [number, number]) ?? [5, 30],
            duration: (defaults.duration as number) ?? 20000,
            distance: (defaults.distance as number) ?? 10,
          }, dpi);
          scenario.setOnComplete((results) => { onBatteryComplete(results.compositeScore, results); });
          engine.setScenario(scenario); scenario.start(); soundEngine.playSpawn(); break;
        }
        default:
          useBatteryStore.getState().recordComplete(scenarioType, 50, {});
          useBatteryStore.getState().advanceNext();
          setScreen('battery-progress');
          break;
      }
    },
    [dpi, cmPer360, startScenario, endScenario, setScreen, engineRef, targetManagerRef, soundEngine, syncRecoilToEngine],
  );

  /** 배터리 취소 */
  const handleBatteryCancel = useCallback(() => {
    useBatteryStore.getState().resetBattery();
    setScreen('settings');
  }, [setScreen]);

  /** 배터리 완료 → 결과 화면 + 세션 종료 */
  const handleBatteryComplete = useCallback(() => {
    const { sessionId, completedScores } = useBatteryStore.getState();
    useBatteryStore.getState().finalizeBattery();
    setScreen('battery-result');

    if (sessionId) {
      safeInvoke('end_session', { params: {
        session_id: sessionId,
        total_trials: Object.keys(completedScores).length,
        avg_fps: useEngineStore.getState().fps,
        monitor_refresh: 0,
      }});
    }
  }, [setScreen]);

  return { handleBattery, handleBatteryLaunchScenario, handleBatteryCancel, handleBatteryComplete };
}
