import { useCallback, useRef, useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEngineStore } from './stores/engineStore';
import { usePageTransition } from './hooks/usePageTransition';
import { useSettingsStore } from './stores/settingsStore';
import { useUiStore } from './stores/uiStore';
import { isScreenAccessible } from './utils/screenAccess';
import { useCalibrationStore, type CalibrationMode, type ConvergenceLevel } from './stores/calibrationStore';
import { useBatteryStore } from './stores/batteryStore';
import { ScenarioSelect, type ScenarioParams } from './components/ScenarioSelect';
import { Viewport } from './components/Viewport';
import { PerformanceOverlay } from './components/overlays/PerformanceOverlay';
import { SteamLogin } from './components/SteamLogin';
import { Toast } from './components/Toast';
import { useToastStore } from './stores/toastStore';
import { Onboarding } from './components/Onboarding';
import { SplashScreen } from './components/screens/SplashScreen';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { Crosshair } from './components/overlays/Crosshair';
import { ScopeOverlay } from './components/overlays/ScopeOverlay';
import { ShootingFeedback, triggerShootingFeedback, getComboState } from './components/overlays/ShootingFeedback';
import { FireModeIndicator } from './components/overlays/FireModeIndicator';
import { GameHUD } from './components/overlays/GameHUD';
import { useGameMetricsStore } from './hooks/useGameMetrics';
import { TargetManager } from './engine/TargetManager';
import { SoundEngine } from './engine/SoundEngine';
import { isPointerLocked } from './engine/PointerLock';
import { useScenarioLauncher } from './hooks/useScenarioLauncher';
import { useBatteryHandlers } from './hooks/useBatteryHandlers';
import { useProfileWizardStore } from './stores/profileWizardStore';
import { useZoomCalibrationStore } from './stores/zoomCalibrationStore';
import type { GameEngine } from './engine/GameEngine';
import type { ScenarioType, StageType } from './utils/types';
import { useTranslation } from './i18n';

// ── React.lazy 코드 스플리팅 — 화면별 지연 로딩 ──
/** named export를 React.lazy로 감싸는 헬퍼 */
function namedLazy<T extends Record<string, any>, K extends keyof T>(
  loader: () => Promise<T>, name: K,
): React.LazyExoticComponent<React.ComponentType<any>> {
  return lazy(() => loader().then(m => ({ default: m[name] as React.ComponentType<any> })));
}

const TrialResults = namedLazy(() => import('./components/TrialResults'), 'TrialResults');
const ResultScreen = namedLazy(() => import('./components/screens/ResultScreen'), 'ResultScreen');
const CalibrationSetup = namedLazy(() => import('./components/CalibrationSetup'), 'CalibrationSetup');
const CalibrationProgress = namedLazy(() => import('./components/CalibrationProgress'), 'CalibrationProgress');
const CalibrationResult = namedLazy(() => import('./components/CalibrationResult'), 'CalibrationResult');
const ZoomCalibrationSetup = namedLazy(() => import('./components/ZoomCalibrationSetup'), 'ZoomCalibrationSetup');
const ZoomCalibrationProgress = namedLazy(() => import('./components/ZoomCalibrationProgress'), 'ZoomCalibrationProgress');
const MultiplierCurve = namedLazy(() => import('./components/MultiplierCurve'), 'MultiplierCurve');
const ComparatorResult = namedLazy(() => import('./components/ComparatorResult'), 'ComparatorResult');
const BatteryProgress = namedLazy(() => import('./components/BatteryProgress'), 'BatteryProgress');
const BatteryResult = namedLazy(() => import('./components/BatteryResult'), 'BatteryResult');
const AimDnaResult = namedLazy(() => import('./components/AimDnaResult'), 'AimDnaResult');
const CrossGameComparison = namedLazy(() => import('./components/CrossGameComparison'), 'CrossGameComparison');
const SessionHistory = namedLazy(() => import('./components/SessionHistory'), 'SessionHistory');
const DisplaySettings = namedLazy(() => import('./components/DisplaySettings'), 'DisplaySettings');
const GameProfileManager = namedLazy(() => import('./components/GameProfileManager'), 'GameProfileManager');
const RoutineList = namedLazy(() => import('./components/RoutineList'), 'RoutineList');
const RoutineBuilder = namedLazy(() => import('./components/RoutineBuilder'), 'RoutineBuilder');
const RoutinePlayer = namedLazy(() => import('./components/RoutinePlayer'), 'RoutinePlayer');
const Leaderboard = namedLazy(() => import('./components/Leaderboard'), 'Leaderboard');
const CommunityShare = namedLazy(() => import('./components/CommunityShare'), 'CommunityShare');
const DataManagement = namedLazy(() => import('./components/DataManagement'), 'DataManagement');
const SensitivityDashboard = namedLazy(() => import('./components/screens/SensitivityDashboard'), 'SensitivityDashboard');
const ProfileWizard = namedLazy(() => import('./components/ProfileWizard'), 'ProfileWizard');
const TrainingPrescription = lazy(() => import('./components/TrainingPrescription'));
const ProgressDashboard = lazy(() => import('./components/ProgressDashboard'));
const TrajectoryAnalysis = lazy(() => import('./components/TrajectoryAnalysis'));
const StyleTransition = lazy(() => import('./components/StyleTransition'));
const MovementEditor = lazy(() => import('./components/MovementEditor'));
const FovComparison = lazy(() => import('./components/FovComparison'));
const HardwareCompare = lazy(() => import('./components/HardwareCompare'));
const DualLandscape = lazy(() => import('./components/DualLandscape'));
const RecoilEditor = lazy(() => import('./components/RecoilEditor'));
const ConversionSelector = lazy(() => import('./components/ConversionSelector'));

/** 전역 사운드 엔진 (히트/헤드샷/콤보/UI 사운드 통합) */
const soundEngine = new SoundEngine();

function App() {
  const { currentScreen, setScreen, fps, pointerLocked } = useEngineStore();
  const { variants: pageVariants } = usePageTransition(currentScreen);
  const { mode, locale, onboardingCompleted, loaded: uiLoaded, toggleMode, setLocale, loadFromDb } = useUiStore();
  const { t } = useTranslation();

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
  const { cmPer360, currentZoom, scopeMultiplier } = useSettingsStore();
  const { startCalibration, resetCalibration } = useCalibrationStore();
  const {
    kFitResult, predictedMultipliers, comparatorResult, resetZoomCalibration,
    startZoomCalibration: startZoomCal, selectedProfileIds,
    convergenceMode: zoomConvergenceMode, availableProfiles,
  } = useZoomCalibrationStore();

  const engineRef = useRef<GameEngine | null>(null);
  const targetManagerRef = useRef<TargetManager | null>(null);
  const lastScenarioRef = useRef<{ type: ScenarioType; params: ScenarioParams } | null>(null);

  // ── 시나리오/배터리 런처 훅 ──
  const { handleStart, handleTrainingStart, syncRecoilToEngine } = useScenarioLauncher({
    engineRef, targetManagerRef, lastScenarioRef, soundEngine,
  });
  const { handleBattery, handleBatteryLaunchScenario, handleBatteryCancel, handleBatteryComplete } = useBatteryHandlers({
    engineRef, targetManagerRef, soundEngine, syncRecoilToEngine,
  });

  /** 엔진 준비 완료 시 호출 */
  const handleEngineReady = useCallback((engine: GameEngine) => {
    engineRef.current = engine;
    const tm = new TargetManager(engine.getScene());
    targetManagerRef.current = tm;
    engine.setTargetManager(tm);

    // 사격 피드백 연결
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
        useGameMetricsStore.getState().syncCombo(count);
      } else {
        soundEngine.playMissSound();
        useGameMetricsStore.getState().syncCombo(0);
      }

      useGameMetricsStore.getState().recordShot({
        hit, headshot: hit && hitZone === 'head',
      });
    });

    // 발사 모드 + 무기 표시 상태 동기화
    const { fireMode, fireRpm, weaponVisible } = useEngineStore.getState();
    engine.setFireMode(fireMode);
    engine.setFireRpm(fireRpm);
    engine.setWeaponVisible(weaponVisible);
  }, []);

  /** 캘리브레이션 시작 */
  const handleCalibrationStart = useCallback(
    async (mode: CalibrationMode, convergence: ConvergenceLevel = 'quick') => {
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
  const handleCalibrationCancel = useCallback(async () => {
    try { await invoke('cancel_calibration'); } catch (_) { /* 이미 없을 수 있음 */ }
    resetCalibration();
    setScreen('settings');
  }, [resetCalibration, setScreen]);

  /** 줌 캘리브레이션 시작 */
  const handleZoomCalibrationStart = useCallback(async () => {
    try {
      const hfov = useSettingsStore.getState().hfov || 103;
      await invoke('start_zoom_calibration', {
        params: {
          profile_id: 1, game_id: 1, hipfire_fov: hfov, base_cm360: cmPer360,
          selected_profile_ids: selectedProfileIds, convergence_mode: zoomConvergenceMode,
        },
      });
      const statuses = selectedProfileIds.map((id) => {
        const p = availableProfiles.find((ap) => ap.id === id);
        return {
          scopeName: p?.scopeName || `${id}`, zoomRatio: p?.zoomRatio || 1,
          completed: false, iteration: 0, bestMultiplier: null, bestScore: null,
        };
      });
      startZoomCal(statuses);
      setScreen('zoom-calibration-progress');
    } catch (e) {
      console.error('줌 캘리브레이션 시작 실패:', e);
      useToastStore.getState().addToast(t('cal.startFailed') + ': ' + String(e), 'error');
    }
  }, [cmPer360, selectedProfileIds, zoomConvergenceMode, availableProfiles, startZoomCal, setScreen, t]);

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
        kValue: result.kValue,
      });
      useZoomCalibrationStore.getState().setPredictedMultipliers(result.predictions);
    } catch (e) {
      console.error('K 조정 실패:', e);
    }
  }, []);

  /** 캘리브레이션 결과 감도 적용 */
  const handleCalibrationApply = useCallback(
    (_cm360: number) => { resetCalibration(); setScreen('settings'); },
    [resetCalibration, setScreen],
  );

  /* UI 설정 로드 전 빈 화면 */
  if (!uiLoaded) return null;

  /** 스플래시 완료 → 첫 실행이면 welcome, 재방문이면 settings */
  const handleSplashComplete = () => {
    setScreen(!onboardingCompleted ? 'welcome' : 'settings');
  };

  if (currentScreen === 'splash') return <SplashScreen onComplete={handleSplashComplete} />;
  if (currentScreen === 'welcome') return <WelcomeScreen onGetStarted={() => setScreen('settings')} />;
  if (!onboardingCompleted) return <Onboarding />;

  return (
    <div className="app">
      <Toast />
      <PerformanceOverlay />

      <Suspense fallback={null}>
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
            <p className="subtitle">{t('app.subtitle')}</p>
            <div className="header-right">
              <div className="header-controls">
                <div className="mode-pill">
                  <button className={mode === 'simple' ? 'active' : ''} onClick={() => mode !== 'simple' && toggleMode()}>Simple</button>
                  <button className={mode === 'advanced' ? 'active' : ''} onClick={() => mode !== 'advanced' && toggleMode()}>Advanced</button>
                </div>
                <select className="lang-select" value={locale} onChange={(e) => setLocale(e.target.value as 'ko' | 'en')}>
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                </select>
                <SteamLogin />
                <button className="icon-btn" onClick={() => setScreen('display-settings')} title="설정" aria-label="설정">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16.17 7.24a1 1 0 0 0 .2-1.1l-.9-1.55a1 1 0 0 0-1-.49l-1.34.26a5.96 5.96 0 0 0-.95-.55l-.34-1.31A1 1 0 0 0 10.88 2h-1.76a1 1 0 0 0-.96.73l-.34 1.31a5.96 5.96 0 0 0-.95.55L5.53 4.1a1 1 0 0 0-1 .49l-.9 1.55a1 1 0 0 0 .2 1.1l.95.88a6.07 6.07 0 0 0 0 1.1l-.95.88a1 1 0 0 0-.2 1.1l.9 1.55a1 1 0 0 0 1 .49l1.34-.26c.3.2.62.38.95.55l.34 1.31c.18.43.6.73 1.07.73h1.76a1 1 0 0 0 .96-.73l.34-1.31a5.96 5.96 0 0 0 .95-.55l1.34.26a1 1 0 0 0 1-.49l.9-1.55a1 1 0 0 0-.2-1.1l-.95-.88a6.07 6.07 0 0 0 0-1.1l.95-.88Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="icon-btn icon-btn-close" onClick={() => getCurrentWindow().close()} title="종료" aria-label="종료">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </header>
          <main className="app-main">
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

      {currentScreen === 'results' && (
        <main className="app-main">
          <ResultScreen
            onRetry={() => { const last = lastScenarioRef.current; if (last) handleStart(last.type, last.params); }}
            onMainMenu={() => setScreen('settings')}
            onGradeReveal={() => soundEngine.playStartSound()}
            onPBFanfare={() => soundEngine.playKillSound()}
          />
          <TrialResults onBack={() => setScreen('settings')} />
        </main>
      )}

      {currentScreen === 'calibration-setup' && (
        <main className="app-main"><CalibrationSetup onStart={handleCalibrationStart} onBack={() => setScreen('settings')} /></main>
      )}
      {currentScreen === 'calibration-progress' && (
        <main className="app-main"><CalibrationProgress onCancel={handleCalibrationCancel} /></main>
      )}
      {currentScreen === 'calibration-result' && (
        <main className="app-main">
          <CalibrationResult
            onBack={() => { resetCalibration(); setScreen('settings'); }}
            onApply={handleCalibrationApply}
            onNextZoom={() => { resetCalibration(); setScreen('zoom-calibration-setup'); }}
          />
        </main>
      )}
      {currentScreen === 'zoom-calibration-setup' && (
        <main className="app-main"><ZoomCalibrationSetup onStart={handleZoomCalibrationStart} onBack={() => setScreen('settings')} /></main>
      )}
      {currentScreen === 'zoom-calibration-progress' && (
        <main className="app-main"><ZoomCalibrationProgress onCancel={handleZoomCalibrationCancel} /></main>
      )}
      {currentScreen === 'zoom-calibration-result' && kFitResult && (
        <main className="app-main">
          <h2>줌 캘리브레이션 결과</h2>
          <MultiplierCurve kFit={kFitResult} predictions={predictedMultipliers} hipfireFov={useSettingsStore.getState().hfov || 103} onAdjustK={handleAdjustK} />
          <div className="result-actions">
            <button className="btn-secondary" onClick={() => { resetZoomCalibration(); setScreen('settings'); }}>돌아가기</button>
            <button className="btn-primary" onClick={() => setScreen('comparator-result')}>방식 비교하기</button>
          </div>
        </main>
      )}
      {currentScreen === 'comparator-result' && comparatorResult && (
        <main className="app-main"><ComparatorResult result={comparatorResult} onBack={() => setScreen('zoom-calibration-result')} /></main>
      )}
      {currentScreen === 'battery-progress' && (
        <BatteryProgress onLaunchScenario={handleBatteryLaunchScenario} onCancel={handleBatteryCancel} onComplete={handleBatteryComplete} />
      )}
      {currentScreen === 'battery-result' && (
        <BatteryResult onBack={() => { useBatteryStore.getState().resetBattery(); setScreen('settings'); }} onViewDna={() => setScreen('aim-dna-result')} />
      )}
      {currentScreen === 'aim-dna-result' && <AimDnaResult onBack={() => setScreen('battery-result')} />}
      {currentScreen === 'session-history' && <SessionHistory onBack={() => setScreen('settings')} />}
      {currentScreen === 'display-settings' && (<main className="app-main"><DisplaySettings onBack={() => setScreen('settings')} /></main>)}
      {currentScreen === 'game-profiles' && (<main className="app-main"><GameProfileManager onBack={() => setScreen('settings')} /></main>)}

      {currentScreen === 'routines' && editingRoutineId === null && (
        <main className="app-main">
          <RoutineList onBack={() => setScreen('settings')} onEdit={(id: number, name: string) => { setEditingRoutineId(id); setEditingRoutineName(name); }} onPlay={(id: number) => { setPlayingRoutineId(id); setScreen('routine-player'); }} />
        </main>
      )}
      {currentScreen === 'routines' && editingRoutineId !== null && (
        <main className="app-main">
          <RoutineBuilder routineId={editingRoutineId} routineName={editingRoutineName} onBack={() => setEditingRoutineId(null)} onPlay={(id: number) => { setPlayingRoutineId(id); setEditingRoutineId(null); setScreen('routine-player'); }} />
        </main>
      )}
      {currentScreen === 'routine-player' && playingRoutineId !== null && (
        <main className="app-main">
          <RoutinePlayer routineId={playingRoutineId} onComplete={() => { setPlayingRoutineId(null); setScreen('settings'); }} onCancel={() => { setPlayingRoutineId(null); setScreen('settings'); }} />
        </main>
      )}
      {currentScreen === 'leaderboard' && (<main className="app-main"><Leaderboard onBack={() => setScreen('settings')} /></main>)}
      {currentScreen === 'community' && (<main className="app-main"><CommunityShare onBack={() => setScreen('settings')} /></main>)}
      {currentScreen === 'data-management' && (<main className="app-main"><DataManagement onBack={() => setScreen('settings')} /></main>)}
      {currentScreen === 'cross-game-comparison' && (<main className="app-main"><CrossGameComparison onBack={() => setScreen('settings')} /></main>)}
      {currentScreen === 'training-prescription' && (
        <main className="app-main">
          <TrainingPrescription onBack={() => setScreen('settings')} onTrainingStart={(stageType, _params) => { handleTrainingStart({ stageType: stageType as StageType }); }} profileId={1} />
        </main>
      )}
      {currentScreen === 'progress-dashboard' && (<main className="app-main"><ProgressDashboard onBack={() => setScreen('settings')} profileId={1} /></main>)}
      {currentScreen === 'trajectory-analysis' && (<main className="app-main"><TrajectoryAnalysis onBack={() => setScreen('settings')} /></main>)}
      {currentScreen === 'style-transition' && (<main className="app-main"><StyleTransition onBack={() => setScreen('settings')} profileId={1} /></main>)}
      {currentScreen === 'movement-editor' && (<main className="app-main"><MovementEditor onBack={() => setScreen('settings')} profileId={1} /></main>)}
      {currentScreen === 'fov-comparison' && (<main className="app-main"><FovComparison onBack={() => setScreen('settings')} profileId={1} /></main>)}
      {currentScreen === 'hardware-compare' && (<main className="app-main"><HardwareCompare onBack={() => setScreen('settings')} /></main>)}
      {currentScreen === 'dual-landscape' && (<main className="app-main"><DualLandscape onBack={() => setScreen('settings')} profileId={1} /></main>)}
      {currentScreen === 'recoil-editor' && (<main className="app-main"><RecoilEditor onBack={() => setScreen('settings')} /></main>)}
      {currentScreen === 'conversion-selector' && (<main className="app-main"><ConversionSelector onBack={() => setScreen('settings')} /></main>)}
      {currentScreen === 'sensitivity-dashboard' && (<main className="app-main"><SensitivityDashboard /></main>)}
      {currentScreen === 'profile-wizard' && (
        <main className="app-main">
          <ProfileWizard
            onClose={() => { useProfileWizardStore.getState().resetWizard(); setScreen('settings'); }}
            onStartCalibration={() => setScreen('calibration-setup')}
            onStartTraining={(stageType: StageType) => { handleTrainingStart({ stageType }); }}
          />
        </main>
      )}

          </motion.div>
        )}
      </AnimatePresence>
      </Suspense>

      {/* 뷰포트 (항상 마운트, 설정 화면에서는 숨김) */}
      <div className={`viewport-wrapper ${currentScreen === 'viewport' ? 'visible' : 'hidden'}`}>
        <Viewport onEngineReady={handleEngineReady} />
        {currentScreen === 'viewport' && (
          <>
            <Crosshair />
            <ScopeOverlay zoomLevel={currentZoom} active={scopeMultiplier > 1} />
            <ShootingFeedback />
            <FireModeIndicator />
            <GameHUD />
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
