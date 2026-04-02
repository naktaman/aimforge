import { useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { invoke } from '@tauri-apps/api/core';
import { safeInvoke } from './utils/ipc';
import { useEngineStore } from './stores/engineStore';
import { usePageTransition } from './hooks/usePageTransition';
import { useSettingsStore } from './stores/settingsStore';
import { useSessionStore } from './stores/sessionStore';
import { useUiStore } from './stores/uiStore';
import { isScreenAccessible } from './utils/screenAccess';
import { useCalibrationStore, type CalibrationMode, type ConvergenceLevel } from './stores/calibrationStore';
import { useBatteryStore, BATTERY_SCENARIO_DEFAULTS } from './stores/batteryStore';
import { ScenarioSelect, type ScenarioParams, type BatteryParams, type TrainingStartParams } from './components/ScenarioSelect';
import { Viewport } from './components/Viewport';
import { TrialResults } from './components/TrialResults';
import { ResultScreen } from './components/screens/ResultScreen';
import { CalibrationSetup } from './components/CalibrationSetup';
import { CalibrationProgress } from './components/CalibrationProgress';
import { CalibrationResult } from './components/CalibrationResult';
import { ZoomCalibrationSetup } from './components/ZoomCalibrationSetup';
import { ZoomCalibrationProgress } from './components/ZoomCalibrationProgress';
import { MultiplierCurve } from './components/MultiplierCurve';
import { ComparatorResult } from './components/ComparatorResult';
import { BatteryProgress } from './components/BatteryProgress';
import { BatteryResult } from './components/BatteryResult';
import { AimDnaResult } from './components/AimDnaResult';
import { CrossGameComparison } from './components/CrossGameComparison';
import { SessionHistory } from './components/SessionHistory';
import { PerformanceOverlay } from './components/overlays/PerformanceOverlay';
import { DisplaySettings } from './components/DisplaySettings';
import { GameProfileManager } from './components/GameProfileManager';
import { RoutineList } from './components/RoutineList';
import { RoutineBuilder } from './components/RoutineBuilder';
import { RoutinePlayer } from './components/RoutinePlayer';
import { SteamLogin } from './components/SteamLogin';
import { Leaderboard } from './components/Leaderboard';
import { CommunityShare } from './components/CommunityShare';
import { DataManagement } from './components/DataManagement';
import TrainingPrescription from './components/TrainingPrescription';
import ProgressDashboard from './components/ProgressDashboard';
import TrajectoryAnalysis from './components/TrajectoryAnalysis';
import StyleTransition from './components/StyleTransition';
import MovementEditor from './components/MovementEditor';
import FovComparison from './components/FovComparison';
import HardwareCompare from './components/HardwareCompare';
import DualLandscape from './components/DualLandscape';
import RecoilEditor from './components/RecoilEditor';
import ConversionSelector from './components/ConversionSelector';
import { Toast } from './components/Toast';
import { Onboarding } from './components/Onboarding';
import { SplashScreen } from './components/screens/SplashScreen';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { ProfileWizard } from './components/ProfileWizard';
import { useProfileWizardStore } from './stores/profileWizardStore';
import { useZoomCalibrationStore } from './stores/zoomCalibrationStore';
import { Crosshair } from './components/overlays/Crosshair';
import { ScopeOverlay } from './components/overlays/ScopeOverlay';
import { ShootingFeedback, triggerShootingFeedback, getComboState } from './components/overlays/ShootingFeedback';
import { FireModeIndicator } from './components/overlays/FireModeIndicator';
import { GameHUD } from './components/overlays/GameHUD';
import { useGameMetricsStore } from './hooks/useGameMetrics';
import { TargetManager } from './engine/TargetManager';
import { FlickScenario } from './engine/scenarios/FlickScenario';
import { TrackingScenario } from './engine/scenarios/TrackingScenario';
import { CircularTrackingScenario } from './engine/scenarios/CircularTrackingScenario';
import { StochasticTrackingScenario } from './engine/scenarios/StochasticTrackingScenario';
import { CounterStrafeFlickScenario } from './engine/scenarios/CounterStrafeFlickScenario';
import { MicroFlickScenario } from './engine/scenarios/MicroFlickScenario';
import { SoundEngine } from './engine/SoundEngine';
import { RECOIL_PRESETS, type RecoilPreset } from './stores/engineStore';
import { isPointerLocked } from './engine/PointerLock';
import type { WeaponStyle } from './engine/WeaponViewModel';
import { calculateFlickScore, calculateTrackingScore } from './engine/metrics/CompositeScore';
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
} from './engine/scenarios/stages';
import type { GameEngine } from './engine/GameEngine';
import type { ScenarioType, StageType } from './utils/types';

/** 전역 사운드 엔진 (AudioManager 대체 — 히트/헤드샷/콤보/UI 사운드 통합) */
const soundEngine = new SoundEngine();

function App() {
  const { currentScreen, setScreen, fps, pointerLocked } = useEngineStore();
  const { variants: pageVariants } = usePageTransition(currentScreen);
  const { mode, theme, onboardingCompleted, loaded: uiLoaded, toggleTheme, toggleMode, loadFromDb } = useUiStore();

  /** 앱 시작 시 UI 설정 로드 + 테마 적용 */
  useEffect(() => { loadFromDb(); }, [loadFromDb]);

  /** B키 — 발사 모드 순환 (포인터 잠금 상태에서만) */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'b' || e.key === 'B') && isPointerLocked()) {
        e.preventDefault();
        const engine = engineRef.current;
        if (engine) {
          const newMode = engine.cycleFireMode();
          useEngineStore.getState().setFireMode(newMode);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /** 모드 전환 시 Advanced 전용 화면에 있으면 settings로 리다이렉트 */
  useEffect(() => {
    if (mode === 'simple' && !isScreenAccessible(currentScreen, mode)) {
      setScreen('settings');
    }
  }, [mode, currentScreen, setScreen]);

  /** 루틴 편집/실행 시 사용하는 ID/이름 */
  const [editingRoutineId, setEditingRoutineId] = useState<number | null>(null);
  const [editingRoutineName, setEditingRoutineName] = useState('');
  const [playingRoutineId, setPlayingRoutineId] = useState<number | null>(null);
  const { dpi, cmPer360, currentZoom, scopeMultiplier } = useSettingsStore();
  const {
    startScenario, endScenario,
    setFlickResult, setTrackingResult, setMicroFlickResult,
  } = useSessionStore();
  const { startCalibration, resetCalibration } = useCalibrationStore();
  const {
    kFitResult,
    predictedMultipliers,
    comparatorResult,
    resetZoomCalibration,
    startZoomCalibration: startZoomCal,
    selectedProfileIds,
    convergenceMode: zoomConvergenceMode,
    availableProfiles,
  } = useZoomCalibrationStore();

  const engineRef = useRef<GameEngine | null>(null);
  const targetManagerRef = useRef<TargetManager | null>(null);

  /** 마지막 시나리오 정보 — "다시 하기" 기능용 */
  const lastScenarioRef = useRef<{ type: ScenarioType; params: ScenarioParams } | null>(null);

  /** 엔진 준비 완료 시 호출 */
  const handleEngineReady = useCallback((engine: GameEngine) => {
    engineRef.current = engine;
    const tm = new TargetManager(engine.getScene());
    targetManagerRef.current = tm;
    engine.setTargetManager(tm);

    // 사격 피드백 연결: 총기음 + 히트/헤드샷 분기 + 콤보 피치 연동 + HUD 메트릭
    engine.setOnShoot((hit, hitResult) => {
      soundEngine.playGunshot();
      const hitZone = hitResult?.hitZone;
      triggerShootingFeedback(hit ? 'hit' : 'miss', hitZone);

      if (hit) {
        const { pitchMultiplier, count } = getComboState();
        if (hitZone === 'head') {
          soundEngine.playHeadshotSound(pitchMultiplier);
        } else {
          soundEngine.playHitSound(pitchMultiplier);
        }
        // HUD 콤보 동기화
        useGameMetricsStore.getState().syncCombo(count);
      } else {
        soundEngine.playMissSound();
        useGameMetricsStore.getState().syncCombo(0);
      }

      // HUD 메트릭 기록
      useGameMetricsStore.getState().recordShot({
        hit,
        headshot: hit && hitZone === 'head',
      });
    });

    // 발사 모드 + 무기 표시 상태 동기화
    const { fireMode, fireRpm, weaponVisible } = useEngineStore.getState();
    engine.setFireMode(fireMode);
    engine.setFireRpm(fireRpm);
    engine.setWeaponVisible(weaponVisible);
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
    [setFlickResult, endScenario, setScreen, cmPer360],
  );

  /** 반동 설정을 엔진에 동기화 + 무기 스타일 매핑 */
  const syncRecoilToEngine = useCallback((engine: GameEngine) => {
    const { recoilEnabled, recoilPreset, fireMode, fireRpm } = useEngineStore.getState();
    if (recoilEnabled) {
      const p = RECOIL_PRESETS[recoilPreset];
      engine.setRecoil(p.verticalDeg, p.horizontalSpreadDeg, p.recoveryRate);
    } else {
      engine.setRecoil(0, 0, 0);
    }

    // 반동 프리셋 → 무기 스타일 매핑
    const weaponStyleMap: Record<RecoilPreset, WeaponStyle> = {
      none: 'pistol',
      light: 'pistol',
      heavy: 'rifle',
      shotgun: 'rifle',
    };
    engine.setWeaponStyle(weaponStyleMap[recoilPreset]);

    // 발사 모드 동기화
    engine.setFireMode(fireMode);
    engine.setFireRpm(fireRpm);
  }, []);

  /** 시나리오 시작 */
  const handleStart = useCallback(
    (scenarioType: ScenarioType, params: ScenarioParams) => {
      const engine = engineRef.current;
      const tm = targetManagerRef.current;
      if (!engine || !tm) return;
      syncRecoilToEngine(engine);

      // "다시 하기"를 위해 마지막 시나리오 정보 저장
      lastScenarioRef.current = { type: scenarioType, params };

      setScreen('viewport');
      startScenario(scenarioType);

      // 세션 생성 (비동기, sessionId를 결과 저장 시 사용)
      safeInvoke<number>('start_session', { params: {
        profile_id: 1, mode: 'quick_play', session_type: scenarioType,
      }}).then((sid) => { if (sid) useSessionStore.getState().setSessionId(sid); });

      // HUD 메트릭 세션 시작 (시나리오 타입에 따라 duration/targets 설정)
      const hudDuration = (scenarioType !== 'flick' && params.duration) ? params.duration : 0;
      const hudTargets = scenarioType === 'flick' ? params.numTargets : undefined;
      useGameMetricsStore.getState().startSession({
        durationMs: hudDuration,
        totalTargets: hudTargets,
      });

      switch (scenarioType) {
        case 'flick': {
          const scenario = new FlickScenario(engine, tm, {
            type: 'flick',
            targetSizeDeg: params.targetSizeDeg,
            angleRange: params.angleRange,
            numTargets: params.numTargets,
            timeout: params.timeout,
          }, dpi);

          scenario.setOnComplete((results) => handleFlickComplete(engine, results, scenario));
          engine.setScenario(scenario);
          scenario.start();
          soundEngine.playSpawn();
          break;
        }

        case 'tracking': {
          const scenario = new TrackingScenario(engine, tm, {
            type: 'tracking',
            targetSizeDeg: params.targetSizeDeg,
            targetSpeedDegPerSec: params.targetSpeedDegPerSec,
            directionChanges: params.directionChanges,
            duration: params.duration,
            trajectoryType: params.trajectoryType,
          });

          scenario.setOnComplete((results) => {
            setTrackingResult(results);
            endScenario();
            useGameMetricsStore.getState().endSession();
            engine.setScenario(null);
            setScreen('results');
            // DB 저장
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
            type: 'circular_tracking',
            targetSizeDeg: params.targetSizeDeg,
            orbitRadiusDeg: params.orbitRadiusDeg,
            orbitSpeedDegPerSec: params.orbitSpeedDegPerSec,
            radiusVariation: params.radiusVariation,
            speedVariation: params.speedVariation,
            duration: params.duration,
            distance: params.distance,
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
            type: 'stochastic_tracking',
            targetSizeDeg: params.targetSizeDeg,
            noiseSpeed: params.noiseSpeed,
            amplitudeDeg: params.amplitudeDeg,
            duration: params.duration,
            distance: params.distance,
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
            type: 'counter_strafe_flick',
            targetSizeDeg: params.targetSizeDeg,
            stopTimeMs: params.stopTimeMs,
            strafeSpeedDegPerSec: params.strafeSpeedDegPerSec,
            numTargets: params.numTargets,
            angleRange: params.angleRange,
            timeout: params.timeout,
          }, dpi);

          scenario.setOnComplete((results) => handleFlickComplete(engine, results, scenario));
          engine.setScenario(scenario);
          scenario.start();
          soundEngine.playSpawn();
          break;
        }

        case 'micro_flick': {
          const scenario = new MicroFlickScenario(engine, tm, {
            type: 'micro_flick',
            targetSizeDeg: params.targetSizeDeg,
            switchFrequencyHz: params.switchFrequencyHz,
            trackingSpeedDegPerSec: params.targetSpeedDegPerSec,
            flickAngleRange: params.flickAngleRange,
            duration: params.duration,
            distance: params.distance,
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
    [dpi, cmPer360, startScenario, endScenario, setFlickResult, setTrackingResult, setMicroFlickResult, setScreen, handleFlickComplete, syncRecoilToEngine],
  );

  /** 훈련 세분류 시나리오 시작 */
  const handleTrainingStart = useCallback(
    (params: TrainingStartParams) => {
      const engine = engineRef.current;
      const tm = targetManagerRef.current;
      if (!engine || !tm) return;
      syncRecoilToEngine(engine);

      setScreen('viewport');
      // 세분류 시나리오는 'flick' ScenarioType으로 매핑 (결과 처리는 범용)
      startScenario('flick');

      // HUD 메트릭 세션 시작 (훈련 모드 — 기본 20초 duration)
      useGameMetricsStore.getState().startSession({ durationMs: 20000 });

      /** 스테이지 타입 → 카테고리 매핑 */
      const categoryFromStageType = (st: string): string => {
        if (st.startsWith('flick')) return 'flick';
        if (st.startsWith('tracking')) return 'tracking';
        if (st.startsWith('switching')) return 'switching';
        return 'flick';
      };

      /** 훈련 결과 공통 콜백 */
      const onTrainingComplete = (results: unknown) => {
        const r = results as {
          score?: number; accuracy?: number; stageType?: string;
          avgTtkMs?: number; avgReactionMs?: number;
          avgOvershootDeg?: number; avgUndershootDeg?: number;
          trackingMad?: number; mad?: number;
        };
        console.log('[Training]', r.stageType, 'score:', r.score, 'accuracy:', r.accuracy);
        endScenario();
        useGameMetricsStore.getState().endSession();
        engine.setScenario(null);
        setScreen('results');

        // DB 저장 — submit_stage_result
        if (r.stageType) {
          safeInvoke('submit_stage_result', { params: { result: {
            profile_id: 1,
            stage_type: r.stageType,
            category: categoryFromStageType(r.stageType),
            difficulty: defaultDifficulty,
            accuracy: r.accuracy ?? 0,
            avg_ttk_ms: r.avgTtkMs ?? 0,
            avg_reaction_ms: r.avgReactionMs ?? 0,
            avg_overshoot_deg: r.avgOvershootDeg ?? 0,
            avg_undershoot_deg: r.avgUndershootDeg ?? 0,
            tracking_mad: r.trackingMad ?? r.mad ?? null,
            score: r.score ?? 0,
            raw_metrics: JSON.stringify(results),
          }}});
        }
      };

      // 기본 난이도 설정
      const defaultDifficulty = {
        mode: 'benchmark' as const,
        targetSizeDeg: 3,
        targetSpeedDegPerSec: 40,
        reactionWindowMs: 3000,
        targetCount: 20,
        adaptiveTargetSuccessRate: 0.75,
      };

      switch (params.stageType) {
        case 'flick_micro': {
          const s = new FlickMicroScenario(engine, tm, {
            stageType: 'flick_micro',
            difficulty: { ...defaultDifficulty, targetSizeDeg: 2.5 },
            angleRange: [5, 15],
            numTargets: 20,
            timeoutMs: 2500,
          });
          s.setOnComplete(onTrainingComplete);
          engine.setScenario(s);
          s.start();
          soundEngine.playSpawn();
          break;
        }
        case 'flick_medium': {
          const s = new FlickMediumScenario(engine, tm, {
            stageType: 'flick_medium',
            difficulty: { ...defaultDifficulty, targetSizeDeg: 3 },
            angleRange: [30, 60],
            numTargets: 20,
            timeoutMs: 3000,
          });
          s.setOnComplete(onTrainingComplete);
          engine.setScenario(s);
          s.start();
          soundEngine.playSpawn();
          break;
        }
        case 'flick_macro': {
          const s = new FlickMacroScenario(engine, tm, {
            stageType: 'flick_macro',
            difficulty: { ...defaultDifficulty, targetSizeDeg: 4 },
            angleRange: [90, 180],
            numTargets: 15,
            timeoutMs: 4000,
          });
          s.setOnComplete(onTrainingComplete);
          engine.setScenario(s);
          s.start();
          soundEngine.playSpawn();
          break;
        }
        case 'tracking_close': {
          const s = new TrackingCloseScenario(engine, tm, {
            stageType: 'tracking_close',
            difficulty: { ...defaultDifficulty, targetSizeDeg: 3.5, targetSpeedDegPerSec: 60 },
            distance: 12,
            patterns: getCloseRangePatterns(),
            durationMs: 20000,
          });
          s.setOnComplete(onTrainingComplete);
          engine.setScenario(s);
          s.start();
          break;
        }
        case 'tracking_mid': {
          const s = new TrackingMidScenario(engine, tm, {
            stageType: 'tracking_mid',
            difficulty: { ...defaultDifficulty, targetSizeDeg: 2.5, targetSpeedDegPerSec: 40 },
            distance: 25,
            patterns: getMidRangePatterns(),
            durationMs: 20000,
          });
          s.setOnComplete(onTrainingComplete);
          engine.setScenario(s);
          s.start();
          break;
        }
        case 'tracking_long': {
          const s = new TrackingLongScenario(engine, tm, {
            stageType: 'tracking_long',
            difficulty: { ...defaultDifficulty, targetSizeDeg: 1.5, targetSpeedDegPerSec: 20 },
            distance: 50,
            patterns: getLongRangePatterns(),
            durationMs: 20000,
          });
          s.setOnComplete(onTrainingComplete);
          engine.setScenario(s);
          s.start();
          break;
        }
        case 'switching_close': {
          const s = new SwitchingCloseScenario(engine, tm, {
            stageType: 'switching_close',
            difficulty: { ...defaultDifficulty, targetSizeDeg: 3 },
            separationRange: [15, 45],
            waveCount: 6,
            targetsPerWave: 3,
          });
          s.setOnComplete(onTrainingComplete);
          engine.setScenario(s);
          s.start();
          soundEngine.playSpawn();
          break;
        }
        case 'switching_wide': {
          const s = new SwitchingWideScenario(engine, tm, {
            stageType: 'switching_wide',
            difficulty: { ...defaultDifficulty, targetSizeDeg: 3.5 },
            separationRange: [60, 150],
            waveCount: 5,
            targetsPerWave: 3,
          });
          s.setOnComplete(onTrainingComplete);
          engine.setScenario(s);
          s.start();
          soundEngine.playSpawn();
          break;
        }
        default:
          console.warn('[Training] 미지원 스테이지:', params.stageType);
          break;
      }
    },
    [startScenario, endScenario, setScreen, syncRecoilToEngine],
  );

  /** 배터리 시작 — ScenarioBattery 인스턴스 생성 후 battery-progress 이동 */
  const handleBattery = useCallback(
    async (params: BatteryParams) => {
      try {
        const sessionId = await invoke<number>('start_session', {
          params: {
            profile_id: 1,
            mode: 'battery',
            session_type: params.preset,
          },
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

      // 배터리 기본 파라미터
      const defaults = BATTERY_SCENARIO_DEFAULTS[scenarioType] ?? {};

      // HUD 메트릭 세션 시작 (배터리 모드)
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

        // 개별 트라이얼 DB 저장
        const sid = useBatteryStore.getState().sessionId;
        if (sid) {
          safeInvoke('save_trial', { params: {
            session_id: sid, scenario_type: scenarioType, cm360_tested: cmPer360,
            composite_score: score, raw_metrics: JSON.stringify(rawMetrics),
            mouse_trajectory: '[]', click_events: '[]',
            angle_breakdown: '{}', motor_breakdown: '{}',
          }}, true); // silent — 배터리 중 에러 토스트 억제
        }
      };

      /** Flick 계열 완료 콜백 — FlickTrialMetrics → score + raw data */
      const onFlickBatteryDone = (_results: ReturnType<FlickScenario['getResults']>, scenario: { getTrialJson: () => ReturnType<FlickScenario['getTrialJson']> }) => {
        // getTrialJson으로 raw 데이터 획득
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
            type: 'flick',
            targetSizeDeg: (defaults.targetSizeDeg as number) ?? 3,
            angleRange: (defaults.angleRange as [number, number]) ?? [10, 180],
            numTargets: (defaults.numTargets as number) ?? 20,
            timeout: (defaults.timeout as number) ?? 3000,
          }, dpi);
          scenario.setOnComplete((results) => onFlickBatteryDone(results, scenario));
          engine.setScenario(scenario);
          scenario.start();
          soundEngine.playSpawn();
          break;
        }
        case 'tracking': {
          const scenario = new TrackingScenario(engine, tm, {
            type: 'tracking',
            targetSizeDeg: (defaults.targetSizeDeg as number) ?? 3,
            targetSpeedDegPerSec: (defaults.targetSpeedDegPerSec as number) ?? 60,
            directionChanges: (defaults.directionChanges as number) ?? 6,
            duration: (defaults.duration as number) ?? 15000,
            trajectoryType: (defaults.trajectoryType as 'mixed') ?? 'mixed',
          });
          scenario.setOnComplete((results) => {
            const score = calculateTrackingScore(results.mad, results.velocityMatchRatio);
            onBatteryComplete(score, results);
          });
          engine.setScenario(scenario);
          scenario.start();
          break;
        }
        case 'circular_tracking': {
          const scenario = new CircularTrackingScenario(engine, tm, {
            type: 'circular_tracking',
            targetSizeDeg: (defaults.targetSizeDeg as number) ?? 3,
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
          engine.setScenario(scenario);
          scenario.start();
          break;
        }
        case 'stochastic_tracking': {
          const scenario = new StochasticTrackingScenario(engine, tm, {
            type: 'stochastic_tracking',
            targetSizeDeg: (defaults.targetSizeDeg as number) ?? 3,
            noiseSpeed: (defaults.noiseSpeed as number) ?? 1.5,
            amplitudeDeg: (defaults.amplitudeDeg as number) ?? 20,
            duration: (defaults.duration as number) ?? 15000,
            distance: (defaults.distance as number) ?? 10,
          });
          scenario.setOnComplete((results) => {
            const score = calculateTrackingScore(results.mad, results.velocityMatchRatio);
            onBatteryComplete(score, results);
          });
          engine.setScenario(scenario);
          scenario.start();
          break;
        }
        case 'counter_strafe_flick': {
          const scenario = new CounterStrafeFlickScenario(engine, tm, {
            type: 'counter_strafe_flick',
            targetSizeDeg: (defaults.targetSizeDeg as number) ?? 3,
            stopTimeMs: (defaults.stopTimeMs as number) ?? 200,
            strafeSpeedDegPerSec: (defaults.strafeSpeedDegPerSec as number) ?? 60,
            numTargets: (defaults.numTargets as number) ?? 15,
            angleRange: (defaults.angleRange as [number, number]) ?? [10, 120],
            timeout: (defaults.timeout as number) ?? 3000,
          }, dpi);
          scenario.setOnComplete((results) => onFlickBatteryDone(results, scenario));
          engine.setScenario(scenario);
          scenario.start();
          soundEngine.playSpawn();
          break;
        }
        case 'micro_flick': {
          const scenario = new MicroFlickScenario(engine, tm, {
            type: 'micro_flick',
            targetSizeDeg: (defaults.targetSizeDeg as number) ?? 3,
            switchFrequencyHz: (defaults.switchFrequencyHz as number) ?? 0.5,
            trackingSpeedDegPerSec: (defaults.targetSpeedDegPerSec as number) ?? 40,
            flickAngleRange: (defaults.flickAngleRange as [number, number]) ?? [5, 30],
            duration: (defaults.duration as number) ?? 20000,
            distance: (defaults.distance as number) ?? 10,
          }, dpi);
          scenario.setOnComplete((results) => {
            onBatteryComplete(results.compositeScore, results);
          });
          engine.setScenario(scenario);
          scenario.start();
          soundEngine.playSpawn();
          break;
        }
        default:
          // zoom_composite 등 — 미지원 시나리오는 건너뜀
          useBatteryStore.getState().recordComplete(scenarioType, 50, {});
          useBatteryStore.getState().advanceNext();
          setScreen('battery-progress');
          break;
      }
    },
    [dpi, startScenario, endScenario, setScreen],
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

    // 세션 종료 DB 저장
    if (sessionId) {
      safeInvoke('end_session', { params: {
        session_id: sessionId,
        total_trials: Object.keys(completedScores).length,
        avg_fps: useEngineStore.getState().fps,
        monitor_refresh: 0,
      }});
    }
  }, [setScreen]);

  /** 캘리브레이션 시작 */
  const handleCalibrationStart = useCallback(
    async (mode: CalibrationMode, convergence: ConvergenceLevel = 'quick') => {
      try {
        const sessionId = await invoke<number>('start_calibration', {
          params: {
            profile_id: 1,
            mode,
            current_cm360: cmPer360,
            game_category: 'tactical',
            convergence_mode: convergence,
          },
        });
        startCalibration(mode, sessionId, convergence);
        setScreen('calibration-progress');
      } catch (e) {
        console.error('캘리브레이션 시작 실패:', e);
      }
    },
    [cmPer360, startCalibration, setScreen],
  );

  /** 캘리브레이션 취소 */
  const handleCalibrationCancel = useCallback(async () => {
    try {
      await invoke('cancel_calibration');
    } catch (e) {
      // 이미 없을 수 있음
    }
    resetCalibration();
    setScreen('settings');
  }, [resetCalibration, setScreen]);

  /** 줌 캘리브레이션 시작 */
  const handleZoomCalibrationStart = useCallback(async () => {
    try {
      const hfov = useSettingsStore.getState().hfov || 103;
      await invoke('start_zoom_calibration', {
        params: {
          profile_id: 1,
          game_id: 1,
          hipfire_fov: hfov,
          base_cm360: cmPer360,
          selected_profile_ids: selectedProfileIds,
          convergence_mode: zoomConvergenceMode,
        },
      });

      // 스토어 업데이트
      const statuses = selectedProfileIds.map((id) => {
        const p = availableProfiles.find((ap) => ap.id === id);
        return {
          scopeName: p?.scope_name || `${id}`,
          zoomRatio: p?.zoom_ratio || 1,
          completed: false,
          iteration: 0,
          bestMultiplier: null,
          bestScore: null,
        };
      });
      startZoomCal(statuses);
      setScreen('zoom-calibration-progress');
    } catch (e) {
      console.error('줌 캘리브레이션 시작 실패:', e);
    }
  }, [cmPer360, selectedProfileIds, zoomConvergenceMode, availableProfiles, startZoomCal, setScreen]);

  /** 줌 캘리브레이션 취소 */
  const handleZoomCalibrationCancel = useCallback(() => {
    resetZoomCalibration();
    setScreen('settings');
  }, [resetZoomCalibration, setScreen]);

  /** K 조정 */
  const handleAdjustK = useCallback(async (delta: number) => {
    try {
      const result = await invoke<any>('adjust_k', { delta });
      useZoomCalibrationStore.getState().setKFitResult({
        ...useZoomCalibrationStore.getState().kFitResult!,
        k_value: result.k_value,
      });
      useZoomCalibrationStore.getState().setPredictedMultipliers(result.predictions);
    } catch (e) {
      console.error('K 조정 실패:', e);
    }
  }, []);

  /** 캘리브레이션 결과 감도 적용 */
  const handleCalibrationApply = useCallback(
    (_cm360: number) => {
      resetCalibration();
      setScreen('settings');
    },
    [resetCalibration, setScreen],
  );

  /* UI 설정 로드 전 빈 화면 */
  if (!uiLoaded) return null;

  /** 스플래시 완료 → 첫 실행이면 welcome, 재방문이면 settings */
  const handleSplashComplete = () => {
    if (!onboardingCompleted) {
      setScreen('welcome');
    } else {
      setScreen('settings');
    }
  };

  /* 스플래시 화면 (앱 시작 시 항상 표시) */
  if (currentScreen === 'splash') {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  /* 웰컴 화면 (첫 실행 시 스플래시 후 표시) */
  if (currentScreen === 'welcome') {
    return (
      <WelcomeScreen
        onGetStarted={() => {
          /* 온보딩 미완료 → 기존 Onboarding 위자드로 이동 */
          setScreen('settings');
        }}
      />
    );
  }

  /* 온보딩 미완료 시 위자드 표시 */
  if (!onboardingCompleted) return <Onboarding />;

  return (
    <div className="app">
      {/* 전역 토스트 알림 */}
      <Toast />
      {/* 퍼포먼스 오버레이 (항상 렌더, F3 토글) */}
      <PerformanceOverlay />

      {/* 화면 전환 애니메이션 컨테이너 (viewport 제외) */}
      <AnimatePresence mode="wait">
        {currentScreen !== 'viewport' && (
          <motion.div
            key={currentScreen}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ willChange: 'transform, opacity' }}
          >

      {/* 설정 화면 */}
      {currentScreen === 'settings' && (
        <>
          <header className="app-header">
            <div className="header-left">
              <h1>AimForge</h1>
              <span className="version">v0.1.0</span>
            </div>
            <p className="subtitle">FPS 감도 최적화 & 에임 트레이너</p>
            <div className="header-right">
              <div className="header-controls">
                {/* 모드 토글 */}
                <div className="mode-pill">
                  <button className={mode === 'simple' ? 'active' : ''} onClick={() => mode !== 'simple' && toggleMode()}>Simple</button>
                  <button className={mode === 'advanced' ? 'active' : ''} onClick={() => mode !== 'advanced' && toggleMode()}>Advanced</button>
                </div>
                {/* 테마 토글 */}
                <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? '라이트 모드' : '다크 모드'}>
                  {theme === 'dark' ? '\u2600' : '\u263E'}
                </button>
                <SteamLogin />
              </div>
            </div>
          </header>
          <main className="app-main">
            {/* 부가 메뉴 — 감도/게임 프로필은 감도 탭으로 이동됨 */}
            <div className="quick-nav">
              <button className="btn-secondary btn-sm" onClick={() => setScreen('display-settings')}>디스플레이</button>
              {mode === 'advanced' && (
                <button className="btn-secondary btn-sm" onClick={() => setScreen('routines')}>루틴</button>
              )}
              {mode === 'advanced' && (
                <button className="btn-secondary btn-sm" onClick={() => setScreen('recoil-editor')}>반동 편집기</button>
              )}
              <button className="btn-secondary btn-sm" onClick={() => setScreen('conversion-selector')}>감도 변환</button>
              <button className="btn-primary btn-sm" onClick={() => {
                useProfileWizardStore.getState().startWizard();
                setScreen('profile-wizard');
              }}>프로파일 생성</button>
            </div>
            <ScenarioSelect
              onStart={handleStart}
              onTrainingStart={handleTrainingStart}
              onCalibration={() => setScreen('calibration-setup')}
              onZoomCalibration={() => setScreen('zoom-calibration-setup')}
              onBattery={handleBattery}
              onHistory={() => setScreen('session-history')}
            />
          </main>
        </>
      )}

      {/* 결과 화면 — 감정 디자인 ResultScreen + 기존 상세 TrialResults */}
      {currentScreen === 'results' && (
        <main className="app-main">
          <ResultScreen
            onRetry={() => {
              const last = lastScenarioRef.current;
              if (last) handleStart(last.type, last.params);
            }}
            onMainMenu={() => setScreen('settings')}
            onGradeReveal={() => soundEngine.playStartSound()}
            onPBFanfare={() => soundEngine.playKillSound()}
          />
          <TrialResults onBack={() => setScreen('settings')} />
        </main>
      )}

      {/* 캘리브레이션 설정 */}
      {currentScreen === 'calibration-setup' && (
        <main className="app-main">
          <CalibrationSetup
            onStart={handleCalibrationStart}
            onBack={() => setScreen('settings')}
          />
        </main>
      )}

      {/* 캘리브레이션 진행 */}
      {currentScreen === 'calibration-progress' && (
        <main className="app-main">
          <CalibrationProgress onCancel={handleCalibrationCancel} />
        </main>
      )}

      {/* 캘리브레이션 결과 */}
      {currentScreen === 'calibration-result' && (
        <main className="app-main">
          <CalibrationResult
            onBack={() => { resetCalibration(); setScreen('settings'); }}
            onApply={handleCalibrationApply}
          />
        </main>
      )}

      {/* 줌 캘리브레이션 설정 */}
      {currentScreen === 'zoom-calibration-setup' && (
        <main className="app-main">
          <ZoomCalibrationSetup
            onStart={handleZoomCalibrationStart}
            onBack={() => setScreen('settings')}
          />
        </main>
      )}

      {/* 줌 캘리브레이션 진행 */}
      {currentScreen === 'zoom-calibration-progress' && (
        <main className="app-main">
          <ZoomCalibrationProgress onCancel={handleZoomCalibrationCancel} />
        </main>
      )}

      {/* 줌 캘리브레이션 결과 (배율 곡선) */}
      {currentScreen === 'zoom-calibration-result' && kFitResult && (
        <main className="app-main">
          <h2>줌 캘리브레이션 결과</h2>
          <MultiplierCurve
            kFit={kFitResult}
            predictions={predictedMultipliers}
            hipfireFov={useSettingsStore.getState().hfov || 103}
            onAdjustK={handleAdjustK}
          />
          <div className="result-actions">
            <button className="btn-secondary" onClick={() => { resetZoomCalibration(); setScreen('settings'); }}>
              돌아가기
            </button>
            <button className="btn-primary" onClick={() => setScreen('comparator-result')}>
              방식 비교하기
            </button>
          </div>
        </main>
      )}

      {/* 비교기 결과 */}
      {currentScreen === 'comparator-result' && comparatorResult && (
        <main className="app-main">
          <ComparatorResult
            result={comparatorResult}
            onBack={() => setScreen('zoom-calibration-result')}
          />
        </main>
      )}

      {/* 배터리 진행 */}
      {currentScreen === 'battery-progress' && (
        <BatteryProgress
          onLaunchScenario={handleBatteryLaunchScenario}
          onCancel={handleBatteryCancel}
          onComplete={handleBatteryComplete}
        />
      )}

      {/* 배터리 결과 */}
      {currentScreen === 'battery-result' && (
        <BatteryResult
          onBack={() => { useBatteryStore.getState().resetBattery(); setScreen('settings'); }}
          onViewDna={() => setScreen('aim-dna-result')}
        />
      )}

      {/* Aim DNA 결과 */}
      {currentScreen === 'aim-dna-result' && (
        <AimDnaResult onBack={() => setScreen('battery-result')} />
      )}

      {/* 세션 히스토리 */}
      {currentScreen === 'session-history' && (
        <SessionHistory onBack={() => setScreen('settings')} />
      )}

      {/* 디스플레이 설정 */}
      {currentScreen === 'display-settings' && (
        <main className="app-main">
          <DisplaySettings onBack={() => setScreen('settings')} />
        </main>
      )}

      {/* 게임 프로필 */}
      {currentScreen === 'game-profiles' && (
        <main className="app-main">
          <GameProfileManager onBack={() => setScreen('settings')} />
        </main>
      )}

      {/* 루틴 목록 */}
      {currentScreen === 'routines' && editingRoutineId === null && (
        <main className="app-main">
          <RoutineList
            onBack={() => setScreen('settings')}
            onEdit={(id, name) => { setEditingRoutineId(id); setEditingRoutineName(name); }}
            onPlay={(id) => { setPlayingRoutineId(id); setScreen('routine-player'); }}
          />
        </main>
      )}

      {/* 루틴 편집 */}
      {currentScreen === 'routines' && editingRoutineId !== null && (
        <main className="app-main">
          <RoutineBuilder
            routineId={editingRoutineId}
            routineName={editingRoutineName}
            onBack={() => setEditingRoutineId(null)}
            onPlay={(id) => { setPlayingRoutineId(id); setEditingRoutineId(null); setScreen('routine-player'); }}
          />
        </main>
      )}

      {/* 루틴 플레이어 */}
      {currentScreen === 'routine-player' && playingRoutineId !== null && (
        <main className="app-main">
          <RoutinePlayer
            routineId={playingRoutineId}
            onComplete={() => { setPlayingRoutineId(null); setScreen('settings'); }}
            onCancel={() => { setPlayingRoutineId(null); setScreen('settings'); }}
          />
        </main>
      )}

      {/* 리더보드 */}
      {currentScreen === 'leaderboard' && (
        <main className="app-main">
          <Leaderboard onBack={() => setScreen('settings')} />
        </main>
      )}

      {/* 커뮤니티 공유 */}
      {currentScreen === 'community' && (
        <main className="app-main">
          <CommunityShare onBack={() => setScreen('settings')} />
        </main>
      )}

      {/* 데이터 관리 */}
      {currentScreen === 'data-management' && (
        <main className="app-main">
          <DataManagement onBack={() => setScreen('settings')} />
        </main>
      )}

      {currentScreen === 'cross-game-comparison' && (
        <main className="app-main">
          <CrossGameComparison onBack={() => setScreen('settings')} />
        </main>
      )}

      {currentScreen === 'training-prescription' && (
        <main className="app-main">
          <TrainingPrescription
            onBack={() => setScreen('settings')}
            onTrainingStart={(stageType, _params) => {
              handleTrainingStart({ stageType: stageType as StageType });
            }}
            profileId={1}
          />
        </main>
      )}

      {currentScreen === 'progress-dashboard' && (
        <main className="app-main">
          <ProgressDashboard onBack={() => setScreen('settings')} profileId={1} />
        </main>
      )}

      {currentScreen === 'trajectory-analysis' && (
        <main className="app-main">
          <TrajectoryAnalysis onBack={() => setScreen('settings')} />
        </main>
      )}

      {currentScreen === 'style-transition' && (
        <main className="app-main">
          <StyleTransition onBack={() => setScreen('settings')} profileId={1} />
        </main>
      )}

      {currentScreen === 'movement-editor' && (
        <main className="app-main">
          <MovementEditor onBack={() => setScreen('settings')} profileId={1} />
        </main>
      )}

      {currentScreen === 'fov-comparison' && (
        <main className="app-main">
          <FovComparison onBack={() => setScreen('settings')} profileId={1} />
        </main>
      )}

      {currentScreen === 'hardware-compare' && (
        <main className="app-main">
          <HardwareCompare onBack={() => setScreen('settings')} />
        </main>
      )}

      {currentScreen === 'dual-landscape' && (
        <main className="app-main">
          <DualLandscape onBack={() => setScreen('settings')} profileId={1} />
        </main>
      )}

      {currentScreen === 'recoil-editor' && (
        <main className="app-main">
          <RecoilEditor onBack={() => setScreen('settings')} />
        </main>
      )}

      {currentScreen === 'conversion-selector' && (
        <main className="app-main">
          <ConversionSelector onBack={() => setScreen('settings')} />
        </main>
      )}

      {/* 프로파일 생성 위저드 */}
      {currentScreen === 'profile-wizard' && (
        <main className="app-main">
          <ProfileWizard
            onClose={() => {
              useProfileWizardStore.getState().resetWizard();
              setScreen('settings');
            }}
            onStartCalibration={() => setScreen('calibration-setup')}
            onStartTraining={(stageType) => {
              handleTrainingStart({ stageType });
            }}
          />
        </main>
      )}

          </motion.div>
        )}
      </AnimatePresence>

      {/* 뷰포트 (항상 마운트, 설정 화면에서는 숨김) */}
      <div className={`viewport-wrapper ${currentScreen === 'viewport' ? 'visible' : 'hidden'}`}>
        <Viewport onEngineReady={handleEngineReady} />
        {/* 오버레이 */}
        {currentScreen === 'viewport' && (
          <>
            <Crosshair />
            <ScopeOverlay zoomLevel={currentZoom} active={scopeMultiplier > 1} />
            <ShootingFeedback />
            <FireModeIndicator />
            <GameHUD />
            {/* HUD */}
            <div className="hud">
              <div className="hud-item">{fps} FPS</div>
              <div className="hud-item">{cmPer360.toFixed(1)} cm/360</div>
              {!pointerLocked && (
                <div className="hud-overlay-message">
                  클릭하여 마우스 캡처 시작
                </div>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
}

export default App;
