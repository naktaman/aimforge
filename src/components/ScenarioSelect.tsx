/**
 * 메인 허브 UI (재설계)
 * 탭 구조: 감도 프로파일 | 훈련 | 분석
 * 피드백 반영: 감도 최적화가 메인 컨셉임을 전면에 배치
 */
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'motion/react';
import { useSettingsStore } from '../stores/settingsStore';
import { useEngineStore, RECOIL_PRESETS, type RecoilPreset, type FireMode } from '../stores/engineStore';
import { useUiStore } from '../stores/uiStore';
import { useTranslation } from '../i18n';
import type { GamePreset, ScenarioType, BatteryPreset, StageType } from '../utils/types';
import { ConversionPanel } from './ConversionPanel';
import { CrosshairSettings } from './CrosshairSettings';

/** 시나리오 시작에 필요한 모든 파라미터 */
export interface ScenarioParams {
  // 공통
  targetSizeDeg: number;
  // Flick / CounterStrafe
  angleRange: [number, number];
  numTargets: number;
  timeout: number;
  // Tracking
  targetSpeedDegPerSec: number;
  directionChanges: number;
  duration: number;
  trajectoryType: 'horizontal' | 'vertical' | 'mixed';
  // Circular Tracking
  orbitRadiusDeg: number;
  orbitSpeedDegPerSec: number;
  radiusVariation: number;
  speedVariation: number;
  distance: number;
  // Stochastic Tracking
  noiseSpeed: number;
  amplitudeDeg: number;
  // Counter-Strafe
  stopTimeMs: number;
  strafeSpeedDegPerSec: number;
  // Micro-Flick
  switchFrequencyHz: number;
  flickAngleRange: [number, number];
}

/** 배터리 시작 파라미터 */
export interface BatteryParams {
  preset: BatteryPreset;
}

/** Training 시나리오 시작 파라미터 */
export interface TrainingStartParams {
  stageType: StageType;
}

interface ScenarioSelectProps {
  onStart: (scenarioType: ScenarioType, params: ScenarioParams) => void;
  onTrainingStart?: (params: TrainingStartParams) => void;
  onCalibration?: () => void;
  onZoomCalibration?: () => void;
  onBattery?: (params: BatteryParams) => void;
  onHistory?: () => void;
}

/** 카테고리 SVG 아이콘 (18px, currentColor) */
const CategoryIcons: Record<string, React.ReactNode> = {
  /* Flick — 십자선 아이콘 */
  Flick: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="9" cy="9" r="6" />
      <line x1="9" y1="1" x2="9" y2="5" />
      <line x1="9" y1="13" x2="9" y2="17" />
      <line x1="1" y1="9" x2="5" y2="9" />
      <line x1="13" y1="9" x2="17" y2="9" />
    </svg>
  ),
  /* Tracking — 웨이브 아이콘 */
  Tracking: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M1 9 C3 5, 5 5, 7 9 S11 13, 13 9 S15 5, 17 9" />
    </svg>
  ),
  /* Switching — 양방향 화살표 아이콘 */
  Switching: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="9" x2="16" y2="9" />
      <polyline points="5,6 2,9 5,12" />
      <polyline points="13,6 16,9 13,12" />
    </svg>
  ),
};

/** 9개 세분류 훈련 카탈로그 — desc 키는 i18n용 */
const TRAINING_CATALOG = [
  {
    category: 'Flick',
    items: [
      { type: 'flick_micro' as StageType, name: 'Micro Flick', descKey: 'training.flickMicroDesc', color: '#ff6b6b' },
      { type: 'flick_medium' as StageType, name: 'Medium Flick', descKey: 'training.flickMediumDesc', color: '#ffa500', star: true },
      { type: 'flick_macro' as StageType, name: 'Macro Flick', descKey: 'training.flickMacroDesc', color: '#e74c3c' },
    ],
  },
  {
    category: 'Tracking',
    items: [
      { type: 'tracking_close' as StageType, name: 'Close Range', descKey: 'training.trackCloseDesc', color: '#00b894' },
      { type: 'tracking_mid' as StageType, name: 'Mid Range', descKey: 'training.trackMidDesc', color: '#0984e3' },
      { type: 'tracking_long' as StageType, name: 'Long Range', descKey: 'training.trackLongDesc', color: '#6c5ce7' },
    ],
  },
  {
    category: 'Switching',
    items: [
      { type: 'switching_close' as StageType, name: 'Close Multi', descKey: 'training.switchCloseDesc', color: '#fdcb6e' },
      { type: 'switching_wide' as StageType, name: 'Wide Multi', descKey: 'training.switchWideDesc', color: '#e17055' },
    ],
  },
];

/** 시나리오 탭 정의 (커스텀 플레이용) */
const SCENARIO_TABS: Array<{ type: ScenarioType; label: string }> = [
  { type: 'flick', label: 'Static Flick' },
  { type: 'tracking', label: 'Linear Tracking' },
  { type: 'circular_tracking', label: 'Circular' },
  { type: 'stochastic_tracking', label: 'Stochastic' },
  { type: 'counter_strafe_flick', label: 'Counter-Strafe' },
  { type: 'micro_flick', label: 'Micro-Flick' },
];

/** 메인 탭: 감도 프로파일 → 훈련 → 분석 */
type MainTab = 'sensitivity' | 'training' | 'analysis';

/** 훈련 서브탭 */
type TrainingSub = 'catalog' | 'custom' | 'battery';

export function ScenarioSelect({ onStart, onTrainingStart, onCalibration, onZoomCalibration, onBattery, onHistory }: ScenarioSelectProps) {
  const [mainTab, setMainTab] = useState<MainTab>('sensitivity');
  const [trainingSub, setTrainingSub] = useState<TrainingSub>('catalog');
  const [showCrosshair, setShowCrosshair] = useState(false);
  const { mode } = useUiStore();
  const { t } = useTranslation();
  const { recoilEnabled, recoilPreset, toggleRecoil, setRecoilPreset, fireMode, fireRpm, setFireMode, setFireRpm } = useEngineStore();
  const {
    dpi, sensitivity, selectedGame,
    setDpi, setSensitivity, selectGame,
  } = useSettingsStore();

  const [games, setGames] = useState<GamePreset[]>([]);
  const [scenarioType, setScenarioType] = useState<ScenarioType>('flick');

  // 공통
  const [targetSize, setTargetSize] = useState(3);
  // Flick
  const [numTargets, setNumTargets] = useState(20);
  const [timeout, setTimeout] = useState(3000);
  const [angleMin, setAngleMin] = useState(10);
  const [angleMax, setAngleMax] = useState(180);
  // Tracking
  const [trackingSpeed, setTrackingSpeed] = useState(30);
  const [dirChanges, setDirChanges] = useState(4);
  const [duration, setDuration] = useState(15000);
  const [trajectory, setTrajectory] = useState<'horizontal' | 'vertical' | 'mixed'>('horizontal');
  // Circular
  const [orbitRadius, setOrbitRadius] = useState(10);
  const [orbitSpeed, setOrbitSpeed] = useState(40);
  const [radiusVar, setRadiusVar] = useState(0.3);
  const [speedVar, setSpeedVar] = useState(0.2);
  const [distance, setDistance] = useState(10);
  // Stochastic
  const [noiseSpeed, setNoiseSpeed] = useState(0.8);
  const [amplitude, setAmplitude] = useState(15);
  // Counter-Strafe
  const [stopTime, setStopTime] = useState(200);
  const [strafeSpeed, setStrafeSpeed] = useState(30);
  // Micro-Flick
  const [switchFreq, setSwitchFreq] = useState(0.5);
  const [flickAngleMin, setFlickAngleMin] = useState(10);
  const [flickAngleMax, setFlickAngleMax] = useState(60);
  // 배터리
  const [batteryPreset, setBatteryPreset] = useState<BatteryPreset>('TACTICAL');

  // 게임 프리셋 로드
  useEffect(() => {
    invoke<GamePreset[]>('get_available_games').then(setGames);
  }, []);

  /** 시나리오 시작 핸들러 */
  const handleStart = () => {
    onStart(scenarioType, {
      targetSizeDeg: targetSize,
      angleRange: [angleMin, angleMax],
      numTargets,
      timeout,
      targetSpeedDegPerSec: trackingSpeed,
      directionChanges: dirChanges,
      duration,
      trajectoryType: trajectory,
      orbitRadiusDeg: orbitRadius,
      orbitSpeedDegPerSec: orbitSpeed,
      radiusVariation: radiusVar,
      speedVariation: speedVar,
      distance,
      noiseSpeed,
      amplitudeDeg: amplitude,
      stopTimeMs: stopTime,
      strafeSpeedDegPerSec: strafeSpeed,
      switchFrequencyHz: switchFreq,
      flickAngleRange: [flickAngleMin, flickAngleMax],
    });
  };

  /** 시나리오별 파라미터 UI 렌더 */
  const renderParams = () => {
    switch (scenarioType) {
      case 'flick':
        return (
          <div className="settings-grid">
            <label>{t('param.targetSize')}<input type="number" value={targetSize} onChange={(e) => setTargetSize(Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>{t('param.numTargets')}<input type="number" value={numTargets} onChange={(e) => setNumTargets(Number(e.target.value))} min={5} max={100} /></label>
            <label>{t('param.timeout')}<input type="number" value={timeout} onChange={(e) => setTimeout(Number(e.target.value))} min={1000} max={10000} step={500} /></label>
            <label>{t('param.minAngle')}<input type="number" value={angleMin} onChange={(e) => setAngleMin(Number(e.target.value))} min={5} max={180} /></label>
            <label>{t('param.maxAngle')}<input type="number" value={angleMax} onChange={(e) => setAngleMax(Number(e.target.value))} min={10} max={180} /></label>
          </div>
        );

      case 'tracking':
        return (
          <div className="settings-grid">
            <label>{t('param.targetSize')}<input type="number" value={targetSize} onChange={(e) => setTargetSize(Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>{t('param.targetSpeed')}<input type="number" value={trackingSpeed} onChange={(e) => setTrackingSpeed(Number(e.target.value))} min={5} max={200} /></label>
            <label>{t('param.dirChanges')}<input type="number" value={dirChanges} onChange={(e) => setDirChanges(Number(e.target.value))} min={0} max={20} /></label>
            <label>{t('param.duration')}<input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={5000} max={60000} step={1000} /></label>
            <label>{t('param.trajectory')}<select value={trajectory} onChange={(e) => setTrajectory(e.target.value as 'horizontal' | 'vertical' | 'mixed')}><option value="horizontal">{t('param.horizontal')}</option><option value="vertical">{t('param.vertical')}</option><option value="mixed">{t('param.mixed')}</option></select></label>
          </div>
        );

      case 'circular_tracking':
        return (
          <div className="settings-grid">
            <label>{t('param.targetSize')}<input type="number" value={targetSize} onChange={(e) => setTargetSize(Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>{t('param.orbitRadius')}<input type="number" value={orbitRadius} onChange={(e) => setOrbitRadius(Number(e.target.value))} min={3} max={30} /></label>
            <label>{t('param.orbitSpeed')}<input type="number" value={orbitSpeed} onChange={(e) => setOrbitSpeed(Number(e.target.value))} min={10} max={120} /></label>
            <label>{t('param.radiusVariation')}<input type="number" value={radiusVar} onChange={(e) => setRadiusVar(Number(e.target.value))} min={0} max={1} step={0.1} /></label>
            <label>{t('param.speedVariation')}<input type="number" value={speedVar} onChange={(e) => setSpeedVar(Number(e.target.value))} min={0} max={1} step={0.1} /></label>
            <label>{t('param.distance')}<input type="number" value={distance} onChange={(e) => setDistance(Number(e.target.value))} min={5} max={30} /></label>
            <label>{t('param.duration')}<input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={5000} max={60000} step={1000} /></label>
          </div>
        );

      case 'stochastic_tracking':
        return (
          <div className="settings-grid">
            <label>{t('param.targetSize')}<input type="number" value={targetSize} onChange={(e) => setTargetSize(Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>{t('param.noiseSpeed')}<input type="number" value={noiseSpeed} onChange={(e) => setNoiseSpeed(Number(e.target.value))} min={0.1} max={3} step={0.1} /></label>
            <label>{t('param.amplitude')}<input type="number" value={amplitude} onChange={(e) => setAmplitude(Number(e.target.value))} min={3} max={30} /></label>
            <label>{t('param.distance')}<input type="number" value={distance} onChange={(e) => setDistance(Number(e.target.value))} min={5} max={30} /></label>
            <label>{t('param.duration')}<input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={5000} max={60000} step={1000} /></label>
          </div>
        );

      case 'counter_strafe_flick':
        return (
          <div className="settings-grid">
            <label>{t('param.targetSize')}<input type="number" value={targetSize} onChange={(e) => setTargetSize(Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>{t('param.stopTime')}<input type="number" value={stopTime} onChange={(e) => setStopTime(Number(e.target.value))} min={50} max={500} step={10} /></label>
            <label>{t('param.strafeSpeed')}<input type="number" value={strafeSpeed} onChange={(e) => setStrafeSpeed(Number(e.target.value))} min={10} max={100} /></label>
            <label>{t('param.numTargets')}<input type="number" value={numTargets} onChange={(e) => setNumTargets(Number(e.target.value))} min={5} max={50} /></label>
            <label>{t('param.minAngle')}<input type="number" value={angleMin} onChange={(e) => setAngleMin(Number(e.target.value))} min={5} max={90} /></label>
            <label>{t('param.maxAngle')}<input type="number" value={angleMax} onChange={(e) => setAngleMax(Number(e.target.value))} min={10} max={180} /></label>
            <label>{t('param.timeout')}<input type="number" value={timeout} onChange={(e) => setTimeout(Number(e.target.value))} min={1000} max={10000} step={500} /></label>
          </div>
        );

      case 'micro_flick':
        return (
          <div className="settings-grid">
            <label>{t('param.targetSize')}<input type="number" value={targetSize} onChange={(e) => setTargetSize(Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>{t('param.trackingSpeed')}<input type="number" value={trackingSpeed} onChange={(e) => setTrackingSpeed(Number(e.target.value))} min={5} max={100} /></label>
            <label>{t('param.switchFreq')}<input type="number" value={switchFreq} onChange={(e) => setSwitchFreq(Number(e.target.value))} min={0.1} max={2} step={0.1} /></label>
            <label>{t('param.flickMinAngle')}<input type="number" value={flickAngleMin} onChange={(e) => setFlickAngleMin(Number(e.target.value))} min={5} max={60} /></label>
            <label>{t('param.flickMaxAngle')}<input type="number" value={flickAngleMax} onChange={(e) => setFlickAngleMax(Number(e.target.value))} min={10} max={120} /></label>
            <label>{t('param.distance')}<input type="number" value={distance} onChange={(e) => setDistance(Number(e.target.value))} min={5} max={30} /></label>
            <label>{t('param.duration')}<input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={10000} max={120000} step={5000} /></label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="scenario-select">
      {/* ── 하드웨어/게임 설정 (항상 보임) ── */}
      <section className="settings-section">
        <h3>{t('scenario.basicSettings')}</h3>
        <div className="settings-grid">
          <label>
            {t('settings.game')}
            <select
              value={selectedGame?.id ?? ''}
              onChange={(e) => {
                const game = games.find((g) => g.id === e.target.value);
                if (game) selectGame(game);
              }}
            >
              <option value="">{t('common.selectPlaceholder')}</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
          <label>
            DPI
            <input
              type="number"
              value={dpi}
              onChange={(e) => setDpi(Number(e.target.value))}
              min={100}
              max={32000}
            />
          </label>
          <label>
            {t('settings.sensitivity')}
            <input
              type="number"
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
              step={0.01}
              min={0.01}
            />
          </label>
        </div>
      </section>

      {/* ── 사격 피드백 / 반동 설정 ── */}
      <section className="settings-section recoil-section">
        <div className="recoil-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={recoilEnabled}
              onChange={toggleRecoil}
            />
            {t('scenario.recoil')}
          </label>
          {recoilEnabled && (
            <select
              className="recoil-select"
              value={recoilPreset}
              onChange={(e) => setRecoilPreset(e.target.value as RecoilPreset)}
            >
              {(Object.entries(RECOIL_PRESETS) as [RecoilPreset, typeof RECOIL_PRESETS[RecoilPreset]][]).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* 발사 모드 + RPM 설정 */}
        <div className="fire-mode-settings">
          <label className="toggle-label">
            {t('scenario.fireMode')}
            <select
              className="recoil-select"
              value={fireMode}
              onChange={(e) => setFireMode(e.target.value as FireMode)}
            >
              <option value="semi">{t('scenario.fireSemi')}</option>
              <option value="auto">{t('scenario.fireAuto')}</option>
              <option value="burst">{t('scenario.fireBurst')}</option>
            </select>
          </label>
          {fireMode !== 'semi' && (
            <label className="toggle-label">
              {t('scenario.fireRate')}
              <input
                type="number"
                className="rpm-input"
                min={60}
                max={1200}
                step={30}
                value={fireRpm}
                onChange={(e) => setFireRpm(Number(e.target.value))}
              />
              <span className="rpm-unit">RPM</span>
            </label>
          )}
        </div>
      </section>

      {/* ── 메인 탭 네비게이션 (재설계) ── */}
      <div className="main-tabs">
        {([
          { key: 'sensitivity' as MainTab, label: t('scenario.tabSensitivity'), emoji: '' },
          { key: 'training' as MainTab, label: t('scenario.tabTraining'), emoji: '' },
          { key: 'analysis' as MainTab, label: t('scenario.tabAnalysis'), emoji: '' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            className={`main-tab ${mainTab === key ? 'active' : ''}`}
            onClick={() => setMainTab(key)}
          >
            {label}
          </button>
        ))}
        {/* 크로스헤어 토글 버튼 (독립 탭 → 접이식 패널) */}
        <button
          className={`main-tab main-tab-secondary ${showCrosshair ? 'active' : ''}`}
          onClick={() => setShowCrosshair(!showCrosshair)}
          title={t('scenario.crosshairSettings')}
        >
          +
        </button>
      </div>

      {/* ── 크로스헤어 접이식 패널 ── */}
      {showCrosshair && (
        <section className="crosshair-panel">
          <CrosshairSettings />
        </section>
      )}

      {/* ── 탭 콘텐츠 (fade 전환) ── */}
      <AnimatePresence mode="wait">
      <motion.div
        key={mainTab}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >

      {/* ══════════════════════════════════════════
          탭 1: 감도 프로파일 — 앱의 핵심 기능
          ══════════════════════════════════════════ */}
      {mainTab === 'sensitivity' && (
        <section className="sensitivity-hub">
          {/* 메인 CTA — 감도 캘리브레이션 */}
          <div className="sensitivity-hero">
            <h3>{t('scenario.findOptimalSens')}</h3>
            <p className="sensitivity-desc">
              {t('scenario.findOptimalSensDesc')}
            </p>
            <div className="sensitivity-actions">
              {onCalibration && (
                <button
                  className="btn-primary btn-lg"
                  onClick={onCalibration}
                  disabled={!selectedGame}
                >
                  {t('scenario.startCalibration')}
                </button>
              )}
              {onZoomCalibration && mode === 'advanced' && (
                <button
                  className="btn-secondary btn-lg"
                  onClick={onZoomCalibration}
                  disabled={!selectedGame}
                >
                  {t('scenario.zoomCalibration')}
                </button>
              )}
            </div>
          </div>

          {/* 감도 관련 도구 카드 */}
          <div className="sensitivity-tools">
            <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('game-profiles')}>
              <span className="tool-card-title">{t('nav.gameProfile')}</span>
              <span className="tool-card-desc">{t('scenario.gameProfileDesc')}</span>
            </button>
            <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('conversion-selector')}>
              <span className="tool-card-title">{t('nav.conversion')}</span>
              <span className="tool-card-desc">{t('scenario.conversionDesc')}</span>
            </button>
            {mode === 'advanced' && (
              <>
                <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('fov-comparison')}>
                  <span className="tool-card-title">{t('tool.fovComparison')}</span>
                  <span className="tool-card-desc">{t('scenario.fovDesc')}</span>
                </button>
                <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('hardware-compare')}>
                  <span className="tool-card-title">{t('tool.hardwareCompare')}</span>
                  <span className="tool-card-desc">{t('scenario.hardwareDesc')}</span>
                </button>
                <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('dual-landscape')}>
                  <span className="tool-card-title">{t('tool.dualLandscape')}</span>
                  <span className="tool-card-desc">{t('scenario.dualLandscapeDesc')}</span>
                </button>
                <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('movement-editor')}>
                  <span className="tool-card-title">{t('tool.movementEditor')}</span>
                  <span className="tool-card-desc">{t('scenario.movementDesc')}</span>
                </button>
              </>
            )}
          </div>

          {/* 인라인 감도 변환 패널 */}
          <ConversionPanel games={games} />
        </section>
      )}

      {/* ══════════════════════════════════════════
          탭 2: 훈련 — 카탈로그 + 커스텀 + 배터리
          ══════════════════════════════════════════ */}
      {mainTab === 'training' && (
        <>
          {/* 훈련 서브 탭 */}
          <div className="sub-tabs">
            {([
              { key: 'catalog' as TrainingSub, label: t('scenario.catalog') },
              { key: 'custom' as TrainingSub, label: t('scenario.customPlay') },
              { key: 'battery' as TrainingSub, label: t('scenario.batteryTest') },
            ]).map(({ key, label }) => (
              <button
                key={key}
                className={`sub-tab ${trainingSub === key ? 'active' : ''}`}
                onClick={() => setTrainingSub(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 카탈로그 — 8종 훈련 시나리오 */}
          {trainingSub === 'catalog' && (
            <section className="training-catalog">
              {TRAINING_CATALOG.map(({ category, items }) => (
                <div key={category} className="catalog-category">
                  <h3 className="category-header">
                    <span className="category-icon">{CategoryIcons[category]}</span> {category}
                  </h3>
                  <div className="catalog-items">
                    {items.map((item) => (
                      <button
                        key={item.type}
                        className="catalog-item"
                        style={{ borderLeftColor: item.color }}
                        disabled={!selectedGame}
                        onClick={() => onTrainingStart?.({ stageType: item.type })}
                      >
                        <div className="catalog-item-header">
                          <span className="catalog-item-name">
                            {item.name}
                            {'star' in item && item.star && <span className="star-badge">CORE</span>}
                          </span>
                        </div>
                        <span className="catalog-item-desc">{t(item.descKey)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* 커스텀 플레이 — 6종 시나리오 + 상세 파라미터 */}
          {trainingSub === 'custom' && (
            <section className="settings-section">
              <h3>{t('scenario.customScenario')}</h3>
              <div className="scenario-tabs">
                {SCENARIO_TABS.map(({ type, label }) => (
                  <button
                    key={type}
                    className={scenarioType === type ? 'active' : ''}
                    onClick={() => setScenarioType(type)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {renderParams()}
              <button
                className="start-button"
                onClick={handleStart}
                disabled={!selectedGame}
              >
                {t('scenario.startScenario')}
              </button>
            </section>
          )}

          {/* 배터리 테스트 — 종합 능력 측정 */}
          {trainingSub === 'battery' && (
            <section className="settings-section">
              <h3>{t('scenario.battery')}</h3>
              <p className="battery-desc">{t('scenario.batteryDesc')}</p>
              <div className="battery-presets">
                {(['TACTICAL', 'MOVEMENT', 'BR', 'CUSTOM'] as BatteryPreset[]).map((preset) => (
                  <label key={preset} className="battery-radio">
                    <input
                      type="radio"
                      name="battery"
                      value={preset}
                      checked={batteryPreset === preset}
                      onChange={() => setBatteryPreset(preset)}
                    />
                    {preset}
                  </label>
                ))}
              </div>
              {onBattery && (
                <button
                  className="battery-button"
                  onClick={() => onBattery({ preset: batteryPreset })}
                  disabled={!selectedGame}
                >
                  {t('scenario.startBattery')} ({batteryPreset})
                </button>
              )}
            </section>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════
          탭 3: 분석 — 진행 추적, 궤적, DNA, 히스토리
          ══════════════════════════════════════════ */}
      {mainTab === 'analysis' && (
        <section className="analysis-hub">
          <div className="analysis-cards">
            <button className="tool-card tool-card-wide" onClick={() => useEngineStore.getState().setScreen('progress-dashboard')}>
              <span className="tool-card-title">{t('tool.progressDashboard')}</span>
              <span className="tool-card-desc">{t('scenario.progressDesc')}</span>
            </button>
            {onHistory && (
              <button className="tool-card tool-card-wide" onClick={onHistory}>
                <span className="tool-card-title">{t('tool.history')}</span>
                <span className="tool-card-desc">{t('scenario.historyDesc')}</span>
              </button>
            )}
            {mode === 'advanced' && (
              <>
                <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('training-prescription')}>
                  <span className="tool-card-title">{t('tool.prescription')}</span>
                  <span className="tool-card-desc">{t('scenario.prescriptionDesc')}</span>
                </button>
                <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('trajectory-analysis')}>
                  <span className="tool-card-title">{t('tool.trajectory')}</span>
                  <span className="tool-card-desc">{t('scenario.trajectoryDesc')}</span>
                </button>
                <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('style-transition')}>
                  <span className="tool-card-title">{t('tool.styleTransition')}</span>
                  <span className="tool-card-desc">{t('scenario.styleDesc')}</span>
                </button>
              </>
            )}
          </div>
        </section>
      )}

      </motion.div>
      </AnimatePresence>
    </div>
  );
}
