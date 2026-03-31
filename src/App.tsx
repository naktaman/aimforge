import { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEngineStore } from './stores/engineStore';
import { useSettingsStore } from './stores/settingsStore';
import { useSessionStore } from './stores/sessionStore';
import { useCalibrationStore, type CalibrationMode, type ConvergenceLevel } from './stores/calibrationStore';
import { useBatteryStore, BATTERY_SCENARIO_DEFAULTS } from './stores/batteryStore';
import { ScenarioSelect, type ScenarioParams, type BatteryParams } from './components/ScenarioSelect';
import { Viewport } from './components/Viewport';
import { TrialResults } from './components/TrialResults';
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
import { SessionHistory } from './components/SessionHistory';
import { useZoomCalibrationStore } from './stores/zoomCalibrationStore';
import { Crosshair } from './components/overlays/Crosshair';
import { ScopeOverlay } from './components/overlays/ScopeOverlay';
import { TargetManager } from './engine/TargetManager';
import { FlickScenario } from './engine/scenarios/FlickScenario';
import { TrackingScenario } from './engine/scenarios/TrackingScenario';
import { CircularTrackingScenario } from './engine/scenarios/CircularTrackingScenario';
import { StochasticTrackingScenario } from './engine/scenarios/StochasticTrackingScenario';
import { CounterStrafeFlickScenario } from './engine/scenarios/CounterStrafeFlickScenario';
import { MicroFlickScenario } from './engine/scenarios/MicroFlickScenario';
import { AudioManager } from './engine/AudioManager';
import { calculateFlickScore, calculateTrackingScore } from './engine/metrics/CompositeScore';
import type { GameEngine } from './engine/GameEngine';
import type { ScenarioType } from './utils/types';

/** 전역 오디오 매니저 */
const audioManager = new AudioManager();

function App() {
  const { currentScreen, setScreen, fps, pointerLocked } = useEngineStore();
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

  /** 엔진 준비 완료 시 호출 */
  const handleEngineReady = useCallback((engine: GameEngine) => {
    engineRef.current = engine;
    const tm = new TargetManager(engine.getScene());
    targetManagerRef.current = tm;
    engine.setTargetManager(tm);
  }, []);

  /** Flick 시나리오 완료 처리 (공통 헬퍼) */
  const handleFlickComplete = useCallback(
    (engine: GameEngine, results: ReturnType<FlickScenario['getResults']>) => {
      const byAngle: Record<number, typeof results.overall> = {};
      results.byAngle.forEach((v, k) => { byAngle[k] = v; });
      const byDirection: Record<string, typeof results.overall> = {};
      results.byDirection.forEach((v, k) => { byDirection[k] = v; });
      const byMotor: Record<string, typeof results.overall> = {};
      results.byMotor.forEach((v, k) => { byMotor[k] = v; });

      setFlickResult({ overall: results.overall, byAngle, byDirection, byMotor });
      endScenario();
      engine.setScenario(null);
      setScreen('results');
      audioManager.playHit();
    },
    [setFlickResult, endScenario, setScreen],
  );

  /** 시나리오 시작 */
  const handleStart = useCallback(
    (scenarioType: ScenarioType, params: ScenarioParams) => {
      const engine = engineRef.current;
      const tm = targetManagerRef.current;
      if (!engine || !tm) return;

      setScreen('viewport');
      startScenario(scenarioType);

      switch (scenarioType) {
        case 'flick': {
          const scenario = new FlickScenario(engine, tm, {
            type: 'flick',
            targetSizeDeg: params.targetSizeDeg,
            angleRange: params.angleRange,
            numTargets: params.numTargets,
            timeout: params.timeout,
          }, dpi);

          scenario.setOnComplete((results) => handleFlickComplete(engine, results));
          engine.setScenario(scenario);
          scenario.start();
          audioManager.playSpawn();
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
            engine.setScenario(null);
            setScreen('results');
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
            engine.setScenario(null);
            setScreen('results');
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
            engine.setScenario(null);
            setScreen('results');
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

          scenario.setOnComplete((results) => handleFlickComplete(engine, results));
          engine.setScenario(scenario);
          scenario.start();
          audioManager.playSpawn();
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
            engine.setScenario(null);
            setScreen('results');
          });

          engine.setScenario(scenario);
          scenario.start();
          audioManager.playSpawn();
          break;
        }

        default:
          break;
      }
    },
    [dpi, startScenario, endScenario, setFlickResult, setTrackingResult, setMicroFlickResult, setScreen, handleFlickComplete],
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

      /** 배터리 모드 시나리오 완료 콜백 */
      const onBatteryComplete = (score: number, rawMetrics: unknown) => {
        useBatteryStore.getState().recordComplete(scenarioType, score, rawMetrics);
        useBatteryStore.getState().advanceNext();
        endScenario();
        engine.setScenario(null);
        setScreen('battery-progress');
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
          audioManager.playSpawn();
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
          audioManager.playSpawn();
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
          audioManager.playSpawn();
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

  /** 배터리 완료 → 결과 화면 */
  const handleBatteryComplete = useCallback(() => {
    useBatteryStore.getState().finalizeBattery();
    setScreen('battery-result');
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

  return (
    <div className="app">
      {/* 설정 화면 */}
      {currentScreen === 'settings' && (
        <>
          <header className="app-header">
            <h1>AimForge</h1>
            <p className="subtitle">FPS Aim Calibration & Training</p>
          </header>
          <main className="app-main">
            <ScenarioSelect
              onStart={handleStart}
              onCalibration={() => setScreen('calibration-setup')}
              onZoomCalibration={() => setScreen('zoom-calibration-setup')}
              onBattery={handleBattery}
              onHistory={() => setScreen('session-history')}
            />
          </main>
        </>
      )}

      {/* 뷰포트 (항상 마운트, 설정 화면에서는 숨김) */}
      <div className={`viewport-wrapper ${currentScreen === 'viewport' ? 'visible' : 'hidden'}`}>
        <Viewport onEngineReady={handleEngineReady} />
        {/* 오버레이 */}
        {currentScreen === 'viewport' && (
          <>
            <Crosshair type="cross" color="#4ade80" size={20} thickness={2} gap={4} />
            <ScopeOverlay zoomLevel={currentZoom} active={scopeMultiplier > 1} />
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

      {/* 결과 화면 */}
      {currentScreen === 'results' && (
        <main className="app-main">
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
    </div>
  );
}

export default App;
