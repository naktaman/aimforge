/**
 * 시나리오 런처 훅 — 일반 시나리오 + 훈련 세분류 시나리오 시작 로직
 * App.tsx에서 분리하여 시나리오 생성/완료 처리를 담당
 */
import { useCallback, type MutableRefObject } from 'react';
import { useEngineStore } from '../stores/engineStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSessionStore } from '../stores/sessionStore';
import { safeInvoke } from '../utils/ipc';
import { useGameMetricsStore } from './useGameMetrics';
import type { ScenarioParams, TrainingStartParams } from '../components/ScenarioSelect';
import { FlickScenario } from '../engine/scenarios/FlickScenario';
import { TrackingScenario } from '../engine/scenarios/TrackingScenario';
import { CircularTrackingScenario } from '../engine/scenarios/CircularTrackingScenario';
import { StochasticTrackingScenario } from '../engine/scenarios/StochasticTrackingScenario';
import { CounterStrafeFlickScenario } from '../engine/scenarios/CounterStrafeFlickScenario';
import { MicroFlickScenario } from '../engine/scenarios/MicroFlickScenario';
import { SoundEngine } from '../engine/SoundEngine';
import { RECOIL_PRESETS, type RecoilPreset } from '../stores/engineStore';
import { calculateFlickScore, calculateTrackingScore } from '../engine/metrics/CompositeScore';
import {
  FlickMicroScenario,
  FlickMediumScenario,
  FlickMacroScenario,
  TrackingCloseScenario,
  TrackingMidScenario,
  TrackingLongScenario,
  SwitchingCloseScenario,
  SwitchingWideScenario,
  getCloseRangePatterns,
  getMidRangePatterns,
  getLongRangePatterns,
} from '../engine/scenarios/stages';
import type { GameEngine } from '../engine/GameEngine';
import type { TargetManager } from '../engine/TargetManager';
import type { ScenarioType } from '../utils/types';
import type { WeaponStyle } from '../engine/WeaponViewModel';

interface ScenarioLauncherDeps {
  engineRef: MutableRefObject<GameEngine | null>;
  targetManagerRef: MutableRefObject<TargetManager | null>;
  lastScenarioRef: MutableRefObject<{ type: ScenarioType; params: ScenarioParams } | null>;
  soundEngine: SoundEngine;
}

/** 시나리오 런처 훅 — 일반 시나리오 + 훈련 시작 핸들러 반환 */
export function useScenarioLauncher(deps: ScenarioLauncherDeps) {
  const { engineRef, targetManagerRef, lastScenarioRef, soundEngine } = deps;
  const { dpi, cmPer360 } = useSettingsStore();
  const { startScenario, endScenario, setFlickResult, setTrackingResult, setMicroFlickResult } = useSessionStore();
  const setScreen = useEngineStore((s) => s.setScreen);

  /** 반동 설정을 엔진에 동기화 + 무기 스타일 매핑 */
  const syncRecoilToEngine = useCallback((engine: GameEngine) => {
    const { recoilEnabled, recoilPreset, fireMode, fireRpm } = useEngineStore.getState();
    if (recoilEnabled) {
      const p = RECOIL_PRESETS[recoilPreset];
      engine.setRecoil(p.verticalDeg, p.horizontalSpreadDeg, p.recoveryRate);
    } else {
      engine.setRecoil(0, 0, 0);
    }
    const weaponStyleMap: Record<RecoilPreset, WeaponStyle> = {
      none: 'pistol', light: 'pistol', heavy: 'rifle', shotgun: 'rifle',
    };
    engine.setWeaponStyle(weaponStyleMap[recoilPreset]);
    engine.setFireMode(fireMode);
    engine.setFireRpm(fireRpm);
  }, []);

  /** Flick 시나리오 완료 처리 (공통 헬퍼) */
  const handleFlickComplete = useCallback(
    (engine: GameEngine, results: ReturnType<FlickScenario['getResults']>, scenario?: { getTrialJson: () => ReturnType<FlickScenario['getTrialJson']> }) => {
      const byAngle: Record<number, typeof results.overall> = {};
      results.byAngle.forEach((v, k) => { byAngle[k] = v; });
      const byDirection: Record<string, typeof results.overall> = {};
      results.byDirection.forEach((v, k) => { byDirection[k] = v; });
      const byMotor: Record<string, typeof results.overall> = {};
      results.byMotor.forEach((v, k) => { byMotor[k] = v; });

      setFlickResult({ overall: results.overall, byAngle, byDirection, byMotor });
      endScenario();
      useGameMetricsStore.getState().endSession();
      engine.setScenario(null);
      setScreen('results');
      soundEngine.playEndSound();

      // DB 저장 (비동기, fire-and-forget)
      const sid = useSessionStore.getState().sessionId;
      if (sid && scenario) {
        const raw = scenario.getTrialJson();
        const total = raw.flickResults.length || 1;
        const hits = raw.flickResults.filter((r: { hit: boolean }) => r.hit).length;
        const avgTtt = raw.flickResults.reduce((s: number, r: { ttt: number }) => s + r.ttt, 0) / total;
        const avgOver = raw.flickResults.reduce((s: number, r: { overshoot: number }) => s + r.overshoot, 0) / total;
        const preFire = raw.flickResults.filter((r: { clickType: string }) => r.clickType === 'PreFire').length;
        const score = calculateFlickScore(hits / total, avgTtt, avgOver, preFire / total);
        safeInvoke('save_trial', { params: {
          session_id: sid, scenario_type: 'flick', cm360_tested: cmPer360,
          composite_score: score,
          raw_metrics: JSON.stringify(raw.flickResults),
          mouse_trajectory: '[]', click_events: '[]',
          angle_breakdown: JSON.stringify(byAngle),
          motor_breakdown: JSON.stringify(byMotor),
        }}).then(() => safeInvoke('end_session', { params: {
          session_id: sid, total_trials: 1,
          avg_fps: useEngineStore.getState().fps, monitor_refresh: 0,
        }}));
      }
    },
    [setFlickResult, endScenario, setScreen, cmPer360, soundEngine],
  );

  /** 시나리오 시작 */
  const handleStart = useCallback(
    (scenarioType: ScenarioType, params: ScenarioParams) => {
      const engine = engineRef.current;
      const tm = targetManagerRef.current;
      if (!engine || !tm) return;
      syncRecoilToEngine(engine);

      lastScenarioRef.current = { type: scenarioType, params };
      setScreen('viewport');
      startScenario(scenarioType);

      // 세션 생성
      safeInvoke<number>('start_session', { params: {
        profile_id: 1, /* 단일 사용자 — user profiles.id */ mode: 'quick_play', session_type: scenarioType,
      }}).then((sid) => { if (sid) useSessionStore.getState().setSessionId(sid); });

      // HUD 메트릭 세션 시작
      const hudDuration = (scenarioType !== 'flick' && params.duration) ? params.duration : 0;
      const hudTargets = scenarioType === 'flick' ? params.numTargets : undefined;
      useGameMetricsStore.getState().startSession({ durationMs: hudDuration, totalTargets: hudTargets });

      switch (scenarioType) {
        case 'flick': {
          const scenario = new FlickScenario(engine, tm, {
            type: 'flick', targetSizeDeg: params.targetSizeDeg, angleRange: params.angleRange,
            numTargets: params.numTargets, timeout: params.timeout,
          }, dpi);
          scenario.setOnComplete((results) => handleFlickComplete(engine, results, scenario));
          engine.setScenario(scenario);
          scenario.start();
          soundEngine.playSpawn();
          break;
        }
        case 'tracking': {
          const scenario = new TrackingScenario(engine, tm, {
            type: 'tracking', targetSizeDeg: params.targetSizeDeg,
            targetSpeedDegPerSec: params.targetSpeedDegPerSec,
            directionChanges: params.directionChanges, duration: params.duration,
            trajectoryType: params.trajectoryType,
          });
          scenario.setOnComplete((results) => {
            setTrackingResult(results);
            endScenario();
            useGameMetricsStore.getState().endSession();
            engine.setScenario(null);
            setScreen('results');
            const sid = useSessionStore.getState().sessionId;
            if (sid) {
              const score = calculateTrackingScore(results.mad, results.velocityMatchRatio);
              safeInvoke('save_trial', { params: {
                session_id: sid, scenario_type: 'tracking', cm360_tested: cmPer360,
                composite_score: score, raw_metrics: JSON.stringify(results),
                mouse_trajectory: '[]', click_events: '[]',
                angle_breakdown: '{}', motor_breakdown: '{}',
              }}).then(() => safeInvoke('end_session', { params: {
                session_id: sid, total_trials: 1,
                avg_fps: useEngineStore.getState().fps, monitor_refresh: 0,
              }}));
            }
          });
          engine.setScenario(scenario);
          scenario.start();
          break;
        }
        case 'circular_tracking': {
          const scenario = new CircularTrackingScenario(engine, tm, {
            type: 'circular_tracking', targetSizeDeg: params.targetSizeDeg,
            orbitRadiusDeg: params.orbitRadiusDeg, orbitSpeedDegPerSec: params.orbitSpeedDegPerSec,
            radiusVariation: params.radiusVariation, speedVariation: params.speedVariation,
            duration: params.duration, distance: params.distance,
          });
          scenario.setOnComplete((results) => {
            setTrackingResult(results);
            endScenario();
            useGameMetricsStore.getState().endSession();
            engine.setScenario(null);
            setScreen('results');
            const sid = useSessionStore.getState().sessionId;
            if (sid) {
              const score = calculateTrackingScore(results.mad, results.velocityMatchRatio);
              safeInvoke('save_trial', { params: {
                session_id: sid, scenario_type: 'circular_tracking', cm360_tested: cmPer360,
                composite_score: score, raw_metrics: JSON.stringify(results),
                mouse_trajectory: '[]', click_events: '[]',
                angle_breakdown: '{}', motor_breakdown: '{}',
              }}).then(() => safeInvoke('end_session', { params: {
                session_id: sid, total_trials: 1,
                avg_fps: useEngineStore.getState().fps, monitor_refresh: 0,
              }}));
            }
          });
          engine.setScenario(scenario);
          scenario.start();
          break;
        }
        case 'stochastic_tracking': {
          const scenario = new StochasticTrackingScenario(engine, tm, {
            type: 'stochastic_tracking', targetSizeDeg: params.targetSizeDeg,
            noiseSpeed: params.noiseSpeed, amplitudeDeg: params.amplitudeDeg,
            duration: params.duration, distance: params.distance,
          });
          scenario.setOnComplete((results) => {
            setTrackingResult(results);
            endScenario();
            useGameMetricsStore.getState().endSession();
            engine.setScenario(null);
            setScreen('results');
            const sid = useSessionStore.getState().sessionId;
            if (sid) {
              const score = calculateTrackingScore(results.mad, results.velocityMatchRatio);
              safeInvoke('save_trial', { params: {
                session_id: sid, scenario_type: 'stochastic_tracking', cm360_tested: cmPer360,
                composite_score: score, raw_metrics: JSON.stringify(results),
                mouse_trajectory: '[]', click_events: '[]',
                angle_breakdown: '{}', motor_breakdown: '{}',
              }}).then(() => safeInvoke('end_session', { params: {
                session_id: sid, total_trials: 1,
                avg_fps: useEngineStore.getState().fps, monitor_refresh: 0,
              }}));
            }
          });
          engine.setScenario(scenario);
          scenario.start();
          break;
        }
        case 'counter_strafe_flick': {
          const scenario = new CounterStrafeFlickScenario(engine, tm, {
            type: 'counter_strafe_flick', targetSizeDeg: params.targetSizeDeg,
            stopTimeMs: params.stopTimeMs, strafeSpeedDegPerSec: params.strafeSpeedDegPerSec,
            numTargets: params.numTargets, angleRange: params.angleRange, timeout: params.timeout,
          }, dpi);
          scenario.setOnComplete((results) => handleFlickComplete(engine, results, scenario));
          engine.setScenario(scenario);
          scenario.start();
          soundEngine.playSpawn();
          break;
        }
        case 'micro_flick': {
          const scenario = new MicroFlickScenario(engine, tm, {
            type: 'micro_flick', targetSizeDeg: params.targetSizeDeg,
            switchFrequencyHz: params.switchFrequencyHz,
            trackingSpeedDegPerSec: params.targetSpeedDegPerSec,
            flickAngleRange: params.flickAngleRange, duration: params.duration, distance: params.distance,
          }, dpi);
          scenario.setOnComplete((results) => {
            setMicroFlickResult(results);
            endScenario();
            useGameMetricsStore.getState().endSession();
            engine.setScenario(null);
            setScreen('results');
            const sid = useSessionStore.getState().sessionId;
            if (sid) {
              safeInvoke('save_trial', { params: {
                session_id: sid, scenario_type: 'micro_flick', cm360_tested: cmPer360,
                composite_score: results.compositeScore ?? 0,
                raw_metrics: JSON.stringify(results),
                mouse_trajectory: '[]', click_events: '[]',
                angle_breakdown: '{}', motor_breakdown: '{}',
              }}).then(() => safeInvoke('end_session', { params: {
                session_id: sid, total_trials: 1,
                avg_fps: useEngineStore.getState().fps, monitor_refresh: 0,
              }}));
            }
          });
          engine.setScenario(scenario);
          scenario.start();
          soundEngine.playSpawn();
          break;
        }
        default:
          break;
      }
    },
    [dpi, cmPer360, startScenario, endScenario, setFlickResult, setTrackingResult, setMicroFlickResult, setScreen, handleFlickComplete, syncRecoilToEngine, engineRef, targetManagerRef, lastScenarioRef, soundEngine],
  );

  /** 훈련 세분류 시나리오 시작 */
  const handleTrainingStart = useCallback(
    (params: TrainingStartParams) => {
      const engine = engineRef.current;
      const tm = targetManagerRef.current;
      if (!engine || !tm) return;
      syncRecoilToEngine(engine);

      setScreen('viewport');
      startScenario('flick');
      useGameMetricsStore.getState().startSession({ durationMs: 20000 });

      /** 스테이지 타입 → 카테고리 매핑 */
      const categoryFromStageType = (st: string): string => {
        if (st.startsWith('flick')) return 'flick';
        if (st.startsWith('tracking')) return 'tracking';
        if (st.startsWith('switching')) return 'switching';
        return 'flick';
      };

      const defaultDifficulty = {
        mode: 'benchmark' as const, targetSizeDeg: 3, targetSpeedDegPerSec: 40,
        reactionWindowMs: 3000, targetCount: 20, adaptiveTargetSuccessRate: 0.75,
      };

      /** 훈련 결과 공통 콜백 */
      const onTrainingComplete = (results: unknown) => {
        const r = results as {
          score?: number; accuracy?: number; stageType?: string;
          avgTtkMs?: number; avgReactionMs?: number;
          avgOvershootDeg?: number; avgUndershootDeg?: number;
          trackingMad?: number; mad?: number;
        };
        endScenario();
        useGameMetricsStore.getState().endSession();
        engine.setScenario(null);
        setScreen('results');

        if (r.stageType) {
          safeInvoke('submit_stage_result', { params: { result: {
            profile_id: 1, /* 단일 사용자 — user profiles.id */ stage_type: r.stageType,
            category: categoryFromStageType(r.stageType),
            difficulty: defaultDifficulty, accuracy: r.accuracy ?? 0,
            avg_ttk_ms: r.avgTtkMs ?? 0, avg_reaction_ms: r.avgReactionMs ?? 0,
            avg_overshoot_deg: r.avgOvershootDeg ?? 0, avg_undershoot_deg: r.avgUndershootDeg ?? 0,
            tracking_mad: r.trackingMad ?? r.mad ?? null,
            score: r.score ?? 0, raw_metrics: JSON.stringify(results),
          }}});
        }
      };

      switch (params.stageType) {
        case 'flick_micro': {
          const s = new FlickMicroScenario(engine, tm, {
            stageType: 'flick_micro', difficulty: { ...defaultDifficulty, targetSizeDeg: 2.5 },
            angleRange: [5, 15], numTargets: 20, timeoutMs: 2500,
          });
          s.setOnComplete(onTrainingComplete); engine.setScenario(s); s.start(); soundEngine.playSpawn(); break;
        }
        case 'flick_medium': {
          const s = new FlickMediumScenario(engine, tm, {
            stageType: 'flick_medium', difficulty: { ...defaultDifficulty, targetSizeDeg: 3 },
            angleRange: [30, 60], numTargets: 20, timeoutMs: 3000,
          });
          s.setOnComplete(onTrainingComplete); engine.setScenario(s); s.start(); soundEngine.playSpawn(); break;
        }
        case 'flick_macro': {
          const s = new FlickMacroScenario(engine, tm, {
            stageType: 'flick_macro', difficulty: { ...defaultDifficulty, targetSizeDeg: 4 },
            angleRange: [90, 180], numTargets: 15, timeoutMs: 4000,
          });
          s.setOnComplete(onTrainingComplete); engine.setScenario(s); s.start(); soundEngine.playSpawn(); break;
        }
        case 'tracking_close': {
          const s = new TrackingCloseScenario(engine, tm, {
            stageType: 'tracking_close', difficulty: { ...defaultDifficulty, targetSizeDeg: 3.5, targetSpeedDegPerSec: 60 },
            distance: 12, patterns: getCloseRangePatterns(), durationMs: 20000,
          });
          s.setOnComplete(onTrainingComplete); engine.setScenario(s); s.start(); break;
        }
        case 'tracking_mid': {
          const s = new TrackingMidScenario(engine, tm, {
            stageType: 'tracking_mid', difficulty: { ...defaultDifficulty, targetSizeDeg: 2.5, targetSpeedDegPerSec: 40 },
            distance: 25, patterns: getMidRangePatterns(), durationMs: 20000,
          });
          s.setOnComplete(onTrainingComplete); engine.setScenario(s); s.start(); break;
        }
        case 'tracking_long': {
          const s = new TrackingLongScenario(engine, tm, {
            stageType: 'tracking_long', difficulty: { ...defaultDifficulty, targetSizeDeg: 1.5, targetSpeedDegPerSec: 20 },
            distance: 50, patterns: getLongRangePatterns(), durationMs: 20000,
          });
          s.setOnComplete(onTrainingComplete); engine.setScenario(s); s.start(); break;
        }
        case 'switching_close': {
          const s = new SwitchingCloseScenario(engine, tm, {
            stageType: 'switching_close', difficulty: { ...defaultDifficulty, targetSizeDeg: 3 },
            separationRange: [15, 45], waveCount: 6, targetsPerWave: 3,
          });
          s.setOnComplete(onTrainingComplete); engine.setScenario(s); s.start(); soundEngine.playSpawn(); break;
        }
        case 'switching_wide': {
          const s = new SwitchingWideScenario(engine, tm, {
            stageType: 'switching_wide', difficulty: { ...defaultDifficulty, targetSizeDeg: 3.5 },
            separationRange: [60, 150], waveCount: 5, targetsPerWave: 3,
          });
          s.setOnComplete(onTrainingComplete); engine.setScenario(s); s.start(); soundEngine.playSpawn(); break;
        }
        default:
          console.warn('[Training] 미지원 스테이지:', params.stageType);
          break;
      }
    },
    [startScenario, endScenario, setScreen, syncRecoilToEngine, engineRef, targetManagerRef, soundEngine],
  );

  return { handleStart, handleTrainingStart, syncRecoilToEngine };
}
