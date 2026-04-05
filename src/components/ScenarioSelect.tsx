/**
 * 메인 허브 UI — Silver Forge 레퍼런스 기반 3열 대시보드
 * 탭 구조: 감도 프로파일 | 훈련 | 분석
 * 100vh 꽉 채움, 스크롤 없는 프로페셔널 게이밍 대시보드
 */
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'motion/react';
import { useSettingsStore } from '../stores/settingsStore';
import { useEngineStore, RECOIL_PRESETS, type RecoilPreset, type FireMode } from '../stores/engineStore';
import { useUiStore } from '../stores/uiStore';
import { useTranslation } from '../i18n';
import { useTabKeyboard } from '../utils/useTabKeyboard';
import type { GamePreset, ScenarioType, BatteryPreset, StageType } from '../utils/types';
import { ConversionPanel } from './ConversionPanel';
import { CrosshairSettings } from './CrosshairSettings';

/** 시나리오 시작에 필요한 모든 파라미터 */
export interface ScenarioParams {
  targetSizeDeg: number;
  angleRange: [number, number];
  numTargets: number;
  timeout: number;
  targetSpeedDegPerSec: number;
  directionChanges: number;
  duration: number;
  trajectoryType: 'horizontal' | 'vertical' | 'mixed';
  orbitRadiusDeg: number;
  orbitSpeedDegPerSec: number;
  radiusVariation: number;
  speedVariation: number;
  distance: number;
  noiseSpeed: number;
  amplitudeDeg: number;
  stopTimeMs: number;
  strafeSpeedDegPerSec: number;
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
  Flick: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="9" cy="9" r="6" />
      <line x1="9" y1="1" x2="9" y2="5" />
      <line x1="9" y1="13" x2="9" y2="17" />
      <line x1="1" y1="9" x2="5" y2="9" />
      <line x1="13" y1="9" x2="17" y2="9" />
    </svg>
  ),
  Tracking: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M1 9 C3 5, 5 5, 7 9 S11 13, 13 9 S15 5, 17 9" />
    </svg>
  ),
  Switching: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="9" x2="16" y2="9" />
      <polyline points="5,6 2,9 5,12" />
      <polyline points="13,6 16,9 13,12" />
    </svg>
  ),
};

/** 9개 세분류 훈련 카탈로그 */
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

/** 메인 탭 타입 */
type MainTab = 'sensitivity' | 'training' | 'analysis';
/** 훈련 서브탭 */
type TrainingSub = 'catalog' | 'custom' | 'battery';

/** cm/360 계산 — DPI와 게임 감도 기반 */
function calcCm360(dpi: number, sens: number, yaw: number): number {
  const countsPerRev = 360 / (sens * yaw);
  return (countsPerRev / dpi) * 2.54;
}

/** cm/360 → 자연어 감도 분류 */
function getSensitivityLevel(cm360: number, t: (key: string) => string): string {
  if (cm360 >= 60) return t('dash.sensVeryLow');
  if (cm360 >= 40) return t('dash.sensLow');
  if (cm360 >= 25) return t('dash.sensMedium');
  if (cm360 >= 15) return t('dash.sensHigh');
  return t('dash.sensVeryHigh');
}

/* MiniBarChart 삭제됨 — 더미 바 차트 대신 empty state 사용 */

/** 프로그레스 바 아이템 — 우측 리스트용 */
function ProgressItem({ name, value, color }: { name: string; value: number; color: string }) {
  return (
    <div className="dash-progress-item">
      <div className="dash-progress-label">
        <span className="dash-progress-name">{name}</span>
        <span className="dash-progress-value">{value.toFixed(1)}%</span>
      </div>
      <div className="dash-progress-track">
        <div className="dash-progress-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export function ScenarioSelect({ onStart, onTrainingStart, onCalibration, onZoomCalibration, onBattery, onHistory }: ScenarioSelectProps) {
  const [mainTab, setMainTab] = useState<MainTab>('sensitivity');
  const [trainingSub, setTrainingSub] = useState<TrainingSub>('catalog');
  const [showCrosshair, setShowCrosshair] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { mode } = useUiStore();
  const { t } = useTranslation();
  const { recoilEnabled, recoilPreset, toggleRecoil, setRecoilPreset, fireMode, fireRpm, setFireMode, setFireRpm } = useEngineStore();
  const {
    dpi, sensitivity, selectedGame,
    setDpi, setSensitivity, selectGame,
  } = useSettingsStore();

  /* 감도 입력 — string으로 관리해야 타이핑 도중 빈 값/소수점 허용 */
  const [sensText, setSensText] = useState(String(sensitivity));
  useEffect(() => { setSensText(String(sensitivity)); }, [sensitivity]);

  const [games, setGames] = useState<GamePreset[]>([]);
  const [scenarioType, setScenarioType] = useState<ScenarioType>('flick');

  /** 메인 탭 키보드 네비게이션 */
  const MAIN_TAB_KEYS = ['sensitivity', 'training', 'analysis'] as const;
  const { containerRef: mainTabRef, onKeyDown: mainTabKeyDown } = useTabKeyboard<MainTab>(MAIN_TAB_KEYS, setMainTab);
  /** 훈련 서브탭 키보드 네비게이션 */
  const SUB_TAB_KEYS = ['catalog', 'custom', 'battery'] as const;
  const { containerRef: subTabRef, onKeyDown: subTabKeyDown } = useTabKeyboard<TrainingSub>(SUB_TAB_KEYS, setTrainingSub);

  /* 시나리오 파라미터 상태 */
  const [targetSize, setTargetSize] = useState(3);
  const [numTargets, setNumTargets] = useState(20);
  const [timeout, setTimeout] = useState(3000);
  const [angleMin, setAngleMin] = useState(10);
  const [angleMax, setAngleMax] = useState(180);
  const [trackingSpeed, setTrackingSpeed] = useState(30);
  const [dirChanges, setDirChanges] = useState(4);
  const [duration, setDuration] = useState(15000);
  const [trajectory, setTrajectory] = useState<'horizontal' | 'vertical' | 'mixed'>('horizontal');
  const [orbitRadius, setOrbitRadius] = useState(10);
  const [orbitSpeed, setOrbitSpeed] = useState(40);
  const [radiusVar, setRadiusVar] = useState(0.3);
  const [speedVar, setSpeedVar] = useState(0.2);
  const [distance, setDistance] = useState(10);
  const [noiseSpeed, setNoiseSpeed] = useState(0.8);
  const [amplitude, setAmplitude] = useState(15);
  const [stopTime, setStopTime] = useState(200);
  const [strafeSpeed, setStrafeSpeed] = useState(30);
  const [switchFreq, setSwitchFreq] = useState(0.5);
  const [flickAngleMin, setFlickAngleMin] = useState(10);
  const [flickAngleMax, setFlickAngleMax] = useState(60);
  const [batteryPreset, setBatteryPreset] = useState<BatteryPreset>('TACTICAL');

  /* 게임 프리셋 로드 */
  useEffect(() => {
    invoke<GamePreset[]>('get_available_games').then(setGames);
  }, []);

  /* cm/360 계산 */
  const cm360 = selectedGame ? calcCm360(dpi, sensitivity, selectedGame.yaw) : null;

  /* 더미 차트 데이터 제거됨 — 실데이터 없으면 empty state 표시 */

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

  /** 시나리오별 파라미터 UI */
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
    <div className="dash-root">
      {/* ── 상단 바: 탭 네비게이션 + 설정 요약 ── */}
      <header className="dash-topbar">
        <div className="dash-tabs" role="tablist" aria-label={t('scenario.tabSensitivity')} ref={mainTabRef} onKeyDown={mainTabKeyDown}>
          {([
            { key: 'sensitivity' as MainTab, label: t('scenario.tabSensitivity') },
            { key: 'training' as MainTab, label: t('scenario.tabTraining') },
            { key: 'analysis' as MainTab, label: t('scenario.tabAnalysis') },
          ]).map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={mainTab === key}
              tabIndex={mainTab === key ? 0 : -1}
              className={`dash-tab ${mainTab === key ? 'active' : ''}`}
              onClick={() => setMainTab(key)}
            >
              {label}
            </button>
          ))}
          {/* 크로스헤어 토글 */}
          <button
            className={`dash-tab dash-tab-icon ${showCrosshair ? 'active' : ''}`}
            onClick={() => setShowCrosshair(!showCrosshair)}
            title={t('scenario.crosshairSettings')}
          >
            +
          </button>
        </div>
        {/* 우측: DPI + 게임 + 감도 컴팩트 요약 */}
        <div className="dash-topbar-info">
          <select
            className="dash-compact-select"
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
          <div className="dash-compact-field">
            <span className="dash-compact-label">DPI</span>
            <input type="number" className="dash-compact-input" value={dpi} onChange={(e) => setDpi(Number(e.target.value))} min={100} max={32000} />
          </div>
          <div className="dash-compact-field">
            <span className="dash-compact-label">{t('settings.sensitivity')}</span>
            <input
              type="number"
              className="dash-compact-input"
              value={sensText}
              onChange={(e) => {
                setSensText(e.target.value);
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) setSensitivity(v);
              }}
              onBlur={() => {
                const v = parseFloat(sensText);
                if (isNaN(v) || v <= 0) setSensText(String(sensitivity));
              }}
              step={0.01}
              min={0.01}
            />
          </div>
        </div>
      </header>

      {/* ── 크로스헤어 접이식 패널 ── */}
      {showCrosshair && (
        <section className="crosshair-panel">
          <CrosshairSettings />
        </section>
      )}

      {/* ── 메인 콘텐츠 (탭별 3열 대시보드) ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={mainTab}
          className="dash-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >

          {/* ══════════════════════════════════════════
              탭 1: 감도 프로파일 — 3열 대시보드
              ══════════════════════════════════════════ */}
          {mainTab === 'sensitivity' && (
            <div className="dash-grid-3col">
              {/* 좌측 25% — 현재 감도 프로파일 */}
              <div className="dash-col-left">
                <div className="dash-section-label">{t('dash.currentProfile')}</div>
                {/* cm/360 대형 카드 + 자연어 설명 */}
                <div className="dash-stat-card dash-stat-accent">
                  <span className="dash-stat-label">cm/360</span>
                  <span className="dash-stat-value">{cm360 ? cm360.toFixed(1) : '—'}</span>
                  <span className="dash-stat-sub">{selectedGame ? selectedGame.name : t('dash.noGame')}</span>
                  {cm360 && <span className="dash-sens-desc">{getSensitivityLevel(cm360, t)}</span>}
                </div>
                {/* DPI 카드 */}
                <div className="dash-stat-card">
                  <span className="dash-stat-label">DPI</span>
                  <span className="dash-stat-value">{dpi}</span>
                  <span className="dash-stat-sub">{t('dash.mouseHardware')}</span>
                </div>
                {/* 게임 감도 카드 */}
                <div className="dash-stat-card">
                  <span className="dash-stat-label">{t('settings.sensitivity')}</span>
                  <span className="dash-stat-value">{sensitivity}</span>
                  <span className="dash-stat-sub">{t('dash.inGameValue')}</span>
                </div>

                {/* 사격 설정 컴팩트 */}
                <div className="dash-section-label" style={{ marginTop: 'var(--space-3)' }}>{t('scenario.fireMode')}</div>
                <div className="dash-fire-config">
                  <div className="dash-fire-row">
                    <label className="dash-mini-toggle">
                      <input type="checkbox" checked={recoilEnabled} onChange={toggleRecoil} />
                      {t('scenario.recoil')}
                    </label>
                    {recoilEnabled && (
                      <select className="dash-mini-select" value={recoilPreset} onChange={(e) => setRecoilPreset(e.target.value as RecoilPreset)}>
                        {(Object.entries(RECOIL_PRESETS) as [RecoilPreset, typeof RECOIL_PRESETS[RecoilPreset]][]).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="dash-fire-row">
                    <select className="dash-mini-select" value={fireMode} onChange={(e) => setFireMode(e.target.value as FireMode)}>
                      <option value="semi">{t('scenario.fireSemiShort')}</option>
                      <option value="auto">{t('scenario.fireAutoShort')}</option>
                      <option value="burst">{t('scenario.fireBurstShort')}</option>
                    </select>
                    {fireMode !== 'semi' && (
                      <div className="dash-rpm-field">
                        <input type="number" className="dash-compact-input" min={60} max={1200} step={30} value={fireRpm} onChange={(e) => setFireRpm(Number(e.target.value))} />
                        <span className="dash-rpm-unit">RPM</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 중앙 45% — 캘리브레이션 허브 */}
              <div className="dash-col-center">
                <div className="dash-section-label">{t('dash.sensitivityCalibration')}</div>
                {/* 히어로 CTA */}
                <div className="dash-hero">
                  <div className="dash-hero-icon">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="24" cy="24" r="20" opacity="0.3" />
                      <circle cx="24" cy="24" r="13" opacity="0.5" />
                      <circle cx="24" cy="24" r="6" />
                      <line x1="24" y1="0" x2="24" y2="10" />
                      <line x1="24" y1="38" x2="24" y2="48" />
                      <line x1="0" y1="24" x2="10" y2="24" />
                      <line x1="38" y1="24" x2="48" y2="24" />
                    </svg>
                  </div>
                  <h3 className="dash-hero-title">{t('scenario.findOptimalSens')}</h3>
                  <p className="dash-hero-desc">{t('scenario.findOptimalSensDesc')}</p>
                  <div className="dash-hero-actions">
                    {onCalibration && (
                      <button className="btn-primary btn-lg" onClick={onCalibration} disabled={!selectedGame}>
                        {t('dash.startCalibration')}
                      </button>
                    )}
                  </div>
                </div>

                {/* 줌 감도 설정 섹션 */}
                <div className="dash-zoom-section">
                  <div className="dash-zoom-title">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="8" cy="8" r="5" />
                      <line x1="12" y1="12" x2="16" y2="16" />
                    </svg>
                    {t('dash.zoomSensitivity')}
                  </div>
                  <p className="dash-zoom-desc">{t('dash.zoomSensDesc')}</p>
                  {onZoomCalibration && (
                    <button className="btn-secondary" onClick={onZoomCalibration} disabled={!selectedGame}>
                      {t('scenario.zoomCalibration')}
                    </button>
                  )}
                </div>

                {/* 캘리브레이션 히스토리 — 데이터 없으면 empty state */}
                <div className="dash-chart">
                  <div className="dash-chart-header">
                    <span className="dash-chart-title">{t('dash.calibrationTrend')}</span>
                  </div>
                  <div className="dash-empty-state">
                    <span className="dash-empty-text">{t('empty.calibrationData')}</span>
                    <button className="btn-secondary btn-sm" onClick={onCalibration}>
                      {t('empty.calibrationAction')}
                    </button>
                  </div>
                </div>
              </div>

              {/* 우측 30% — 도구 & 프로파일 */}
              <div className="dash-col-right">
                {/* 게임 프로파일 리스트 */}
                <div className="dash-section-label">{t('nav.gameProfile')}</div>
                <div className="dash-tool-list">
                  <button className="dash-tool-item" onClick={() => useEngineStore.getState().setScreen('game-profiles')}>
                    <span className="dash-tool-icon">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="2" /><line x1="5" y1="7" x2="11" y2="7" /><line x1="5" y1="10" x2="9" y2="10" /></svg>
                    </span>
                    <span className="dash-tool-name">{t('nav.gameProfile')}</span>
                  </button>
                  <button className="dash-tool-item" onClick={() => useEngineStore.getState().setScreen('conversion-selector')}>
                    <span className="dash-tool-icon">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4-4 4 4M4 10l4 4 4-4" /></svg>
                    </span>
                    <span className="dash-tool-name">{t('nav.conversion')}</span>
                  </button>
                  {mode === 'advanced' && (
                    <>
                      <button
                        className="dash-advanced-toggle"
                        onClick={() => setShowAdvanced(prev => !prev)}
                        aria-expanded={showAdvanced}
                      >
                        {t('dash.advancedTools')} {showAdvanced ? '▲' : '▼'}
                      </button>
                      {showAdvanced && (
                        <>
                          <button className="dash-tool-item" onClick={() => useEngineStore.getState().setScreen('fov-comparison')}>
                            <span className="dash-tool-icon">
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 8 L8 2 L15 8" /><line x1="8" y1="2" x2="8" y2="14" /></svg>
                            </span>
                            <span className="dash-tool-name">{t('tool.fovComparison')}</span>
                          </button>
                          <button className="dash-tool-item" onClick={() => useEngineStore.getState().setScreen('hardware-compare')}>
                            <span className="dash-tool-icon">
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="6" width="6" height="8" rx="1" /><rect x="9" y="2" width="6" height="12" rx="1" /></svg>
                            </span>
                            <span className="dash-tool-name">{t('tool.hardwareCompare')}</span>
                          </button>
                          <button className="dash-tool-item" onClick={() => useEngineStore.getState().setScreen('dual-landscape')}>
                            <span className="dash-tool-icon">
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6" /><path d="M8 2 Q12 6 8 14 Q4 6 8 2" /></svg>
                            </span>
                            <span className="dash-tool-name">{t('tool.dualLandscape')}</span>
                          </button>
                          <button className="dash-tool-item" onClick={() => useEngineStore.getState().setScreen('movement-editor')}>
                            <span className="dash-tool-icon">
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 14 L6 6 L10 10 L14 2" /></svg>
                            </span>
                            <span className="dash-tool-name">{t('tool.movementEditor')}</span>
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
                {/* 인라인 감도 변환 패널 */}
                <div className="dash-section-label" style={{ marginTop: 'var(--space-3)' }}>{t('nav.conversion')}</div>
                <div className="dash-conversion-wrap">
                  <ConversionPanel games={games} />
                </div>
              </div>

              {/* 하단: 카테고리 카드 3개 */}
              <div className="dash-bottom-cards">
                <button className="dash-cat-card" onClick={onCalibration} disabled={!selectedGame || !onCalibration}>
                  <span className="dash-cat-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
                    </svg>
                  </span>
                  <span className="dash-cat-label">{t('dash.calibration')}</span>
                </button>
                <button className="dash-cat-card" onClick={() => useEngineStore.getState().setScreen('game-profiles')}>
                  <span className="dash-cat-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <rect x="3" y="4" width="18" height="16" rx="3" /><line x1="7" y1="9" x2="17" y2="9" /><line x1="7" y1="13" x2="14" y2="13" />
                    </svg>
                  </span>
                  <span className="dash-cat-label">{t('nav.gameProfile')}</span>
                </button>
                <button className="dash-cat-card" onClick={() => useEngineStore.getState().setScreen('conversion-selector')}>
                  <span className="dash-cat-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M7 10l5-5 5 5M7 14l5 5 5-5" />
                    </svg>
                  </span>
                  <span className="dash-cat-label">{t('nav.conversion')}</span>
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              탭 2: 훈련 — 3열 대시보드
              ══════════════════════════════════════════ */}
          {mainTab === 'training' && (
            <div className="dash-grid-3col">
              {/* 좌측 25% — 훈련 요약 */}
              <div className="dash-col-left">
                <div className="dash-section-label">{t('dash.trainingStats')}</div>
                {/* 오늘 훈련 통계 */}
                <div className="dash-stat-card">
                  <span className="dash-stat-label">{t('dash.todaySessions')}</span>
                  <span className="dash-stat-value">—</span>
                  <span className="dash-stat-sub">{t('dash.todayNoTraining')}</span>
                </div>
                <div className="dash-stat-card">
                  <span className="dash-stat-label">{t('dash.avgScore')}</span>
                  <span className="dash-stat-value">—</span>
                  <span className="dash-stat-sub">{t('dash.recentAvg')}</span>
                </div>

                {/* AI 추천 시나리오 */}
                <div className="dash-ai-card">
                  <span className="dash-ai-label">{t('dash.aiRecommend')}</span>
                  <span className="dash-ai-text">{t('dash.aiRecommendText')}</span>
                </div>

                {/* 배터리 테스트 진입 */}
                {onBattery && (
                  <button
                    className="btn-secondary"
                    style={{ width: '100%', marginTop: 'var(--space-2)' }}
                    onClick={() => onBattery({ preset: 'TACTICAL' })}
                    disabled={!selectedGame}
                  >
                    {t('scenario.batteryTest')}
                  </button>
                )}

                {/* 서브탭: 카탈로그/커스텀/배터리 전환 */}
                <div className="dash-section-label" style={{ marginTop: 'var(--space-3)' }}>{t('dash.mode')}</div>
                <div className="dash-sub-tabs" role="tablist" ref={subTabRef} onKeyDown={subTabKeyDown}>
                  {([
                    { key: 'catalog' as TrainingSub, label: t('scenario.catalog') },
                    { key: 'custom' as TrainingSub, label: t('scenario.customPlay') },
                    { key: 'battery' as TrainingSub, label: t('scenario.batteryTest') },
                  ]).map(({ key, label }) => (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={trainingSub === key}
                      tabIndex={trainingSub === key ? 0 : -1}
                      className={`dash-sub-tab ${trainingSub === key ? 'active' : ''}`}
                      onClick={() => setTrainingSub(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 중앙 45% — 카탈로그/커스텀/배터리 콘텐츠 */}
              <div className="dash-col-center">
                <div className="dash-section-label">
                  {trainingSub === 'catalog' ? t('scenario.catalog') : trainingSub === 'custom' ? t('scenario.customScenario') : t('scenario.battery')}
                </div>

                {/* 카탈로그 — 카테고리 헤더 + 아이콘 + 2열 그리드 */}
                {trainingSub === 'catalog' && (
                  <div>
                    {TRAINING_CATALOG.map(({ category, items }) => (
                      <div key={category}>
                        {/* 카테고리 헤더 */}
                        <div className="dash-catalog-category">
                          <span className="dash-catalog-category-icon">{CategoryIcons[category]}</span>
                          <span className="dash-catalog-category-name">{category}</span>
                        </div>
                        {/* 시나리오 카드 그리드 */}
                        <div className="dash-catalog-grid">
                          {items.map((item) => (
                            <button
                              key={item.type}
                              className="dash-catalog-card"
                              disabled={!selectedGame}
                              onClick={() => onTrainingStart?.({ stageType: item.type })}
                            >
                              <div className="dash-catalog-color" style={{ background: item.color }} />
                              <span className="dash-catalog-name">
                                {item.name}
                                {'star' in item && item.star && <span className="star-badge">CORE</span>}
                              </span>
                              <span className="dash-catalog-desc">{t(item.descKey)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 커스텀 플레이 */}
                {trainingSub === 'custom' && (
                  <div className="dash-custom-play">
                    <div className="scenario-tabs">
                      {SCENARIO_TABS.map(({ type, label }) => (
                        <button key={type} className={scenarioType === type ? 'active' : ''} onClick={() => setScenarioType(type)}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {renderParams()}
                    <button className="btn-primary btn-lg" onClick={handleStart} disabled={!selectedGame} style={{ marginTop: 'var(--space-4)', width: '100%' }}>
                      {t('scenario.startScenario')}
                    </button>
                  </div>
                )}

                {/* 배터리 테스트 */}
                {trainingSub === 'battery' && (
                  <div className="dash-battery">
                    <p className="dash-battery-desc">{t('scenario.batteryDesc')}</p>
                    <div className="dash-battery-presets">
                      {(['TACTICAL', 'MOVEMENT', 'BR', 'CUSTOM'] as BatteryPreset[]).map((preset) => (
                        <label key={preset} className="dash-battery-radio">
                          <input type="radio" name="battery" value={preset} checked={batteryPreset === preset} onChange={() => setBatteryPreset(preset)} />
                          {preset}
                        </label>
                      ))}
                    </div>
                    {onBattery && (
                      <button className="btn-primary btn-lg" onClick={() => onBattery({ preset: batteryPreset })} disabled={!selectedGame} style={{ width: '100%' }}>
                        {t('scenario.startBattery')} ({batteryPreset})
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 우측 30% — 최근 기록 */}
              <div className="dash-col-right">
                <div className="dash-section-label">{t('dash.recentPlays')}</div>
                <div className="dash-recent-list">
                  {/* 더미 데이터 — 시각적 채움 (실제 히스토리 연동 시 교체) */}
                  <ProgressItem name="Medium Flick" value={78.5} color="var(--accent-primary)" />
                  <ProgressItem name="Close Range" value={65.2} color="var(--success)" />
                  <ProgressItem name="Micro Flick" value={82.1} color="var(--color-sky)" />
                  <ProgressItem name="Mid Range" value={71.8} color="var(--info)" />
                  <ProgressItem name="Wide Multi" value={59.4} color="var(--warning)" />
                  <ProgressItem name="Long Range" value={68.9} color="var(--accent-cyan)" />
                  <ProgressItem name="Close Multi" value={74.3} color="var(--accent-primary)" />
                  <ProgressItem name="Macro Flick" value={61.7} color="var(--danger)" />
                </div>

                {/* 미니 차트 */}
                {/* 점수 트렌드 — 데이터 없으면 empty state */}
                <div className="dash-chart">
                  <div className="dash-chart-header">
                    <span className="dash-chart-title">{t('dash.scoreTrend')}</span>
                  </div>
                  <div className="dash-empty-state">
                    <span className="dash-empty-text">{t('empty.sessionData')}</span>
                  </div>
                </div>
              </div>

              {/* 하단: 카테고리 카드 */}
              <div className="dash-bottom-cards">
                {(['Flick', 'Tracking', 'Switching'] as const).map((cat) => (
                  <button key={cat} className="dash-cat-card" onClick={() => { setTrainingSub('catalog'); }}>
                    <span className="dash-cat-icon" style={{ color: 'var(--accent-primary)' }}>
                      {CategoryIcons[cat]}
                    </span>
                    <span className="dash-cat-label">{cat}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              탭 3: 분석 — 레퍼런스 기반 3열 구조
              ══════════════════════════════════════════ */}
          {mainTab === 'analysis' && (
            <div className="dash-grid-3col">
              {/* 좌측 25% — 종합 통계 카드 */}
              <div className="dash-col-left">
                <div className="dash-section-label">{t('dash.globalMetrics')}</div>
                {/* 종합 점수 — 대형 히어로 카드 */}
                <div className="dash-stat-card dash-stat-hero">
                  <span className="dash-stat-label">{t('dash.overallScore')}</span>
                  <span className="dash-stat-value">—</span>
                  <span className="dash-stat-sub">{t('dash.noDataYet')}</span>
                </div>
                {/* 정확도 */}
                <div className="dash-stat-card dash-stat-accent">
                  <span className="dash-stat-label">{t('dash.overallAccuracy')}</span>
                  <span className="dash-stat-value">—</span>
                  <span className="dash-stat-sub">{t('dash.noDataYet')}</span>
                </div>
                {/* 평균 반응시간 */}
                <div className="dash-stat-card">
                  <span className="dash-stat-label">{t('dash.reactionTime')}</span>
                  <span className="dash-stat-value">—</span>
                  <span className="dash-stat-sub">{t('dash.noDataYet')}</span>
                </div>
                {/* 크리티컬 히트율 */}
                <div className="dash-stat-card">
                  <span className="dash-stat-label">{t('dash.criticalHitRatio')}</span>
                  <span className="dash-stat-value">—</span>
                  <span className="dash-stat-sub">{t('dash.noDataYet')}</span>
                </div>
              </div>

              {/* 중앙 45% — 세션 트렌드 + 분석 도구 */}
              <div className="dash-col-center">
                <div className="dash-section-label">{t('dash.sessionTrendline')}</div>
                {/* 세션 트렌드 — 데이터 없으면 empty state */}
                <div className="dash-chart">
                  <div className="dash-chart-header">
                    <span className="dash-chart-title">{t('dash.last90days')}</span>
                  </div>
                  <div className="dash-empty-state">
                    <span className="dash-empty-text">{t('empty.sessionData')}</span>
                  </div>
                </div>

                {/* 분석 도구 서브탭 카드 그리드 */}
                <div className="dash-section-label" style={{ marginTop: 'var(--space-4)' }}>{t('dash.analysisTools')}</div>
                <div className="dash-analysis-grid">
                  <button className="dash-analysis-card" onClick={() => useEngineStore.getState().setScreen('progress-dashboard')}>
                    <span className="dash-analysis-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 17 L3 8 L7 8 L7 17" /><path d="M8 17 L8 3 L12 3 L12 17" /><path d="M13 17 L13 10 L17 10 L17 17" /></svg>
                    </span>
                    <span className="dash-analysis-name">{t('tool.progressDashboard')}</span>
                  </button>
                  {onHistory && (
                    <button className="dash-analysis-card" onClick={onHistory}>
                      <span className="dash-analysis-icon">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="8" /><path d="M10 5 L10 10 L14 12" /></svg>
                      </span>
                      <span className="dash-analysis-name">{t('tool.history')}</span>
                    </button>
                  )}
                  {mode === 'advanced' && (
                    <>
                      <button className="dash-analysis-card" onClick={() => useEngineStore.getState().setScreen('training-prescription')}>
                        <span className="dash-analysis-icon">
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4 L16 4 L16 16 L4 16 Z" /><path d="M7 8 L13 8" /><path d="M7 12 L11 12" /></svg>
                        </span>
                        <span className="dash-analysis-name">{t('tool.prescription')}</span>
                      </button>
                      <button className="dash-analysis-card" onClick={() => useEngineStore.getState().setScreen('trajectory-analysis')}>
                        <span className="dash-analysis-icon">
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 18 Q6 6, 10 10 T18 2" /></svg>
                        </span>
                        <span className="dash-analysis-name">{t('tool.trajectory')}</span>
                      </button>
                      <button className="dash-analysis-card" onClick={() => useEngineStore.getState().setScreen('style-transition')}>
                        <span className="dash-analysis-icon">
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="10" r="4" /><circle cx="13" cy="10" r="4" /></svg>
                        </span>
                        <span className="dash-analysis-name">{t('tool.styleTransition')}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 우측 30% — 최근 시나리오 점수 리스트 */}
              <div className="dash-col-right">
                <div className="dash-section-label">{t('dash.recentScenarios')}</div>
                <div className="dash-recent-list">
                  {/* 더미 데이터 — Silver Forge 우측 패널 스타일 */}
                  <ProgressItem name="Medium Flick" value={91.3} color="var(--success)" />
                  <ProgressItem name="Close Range Tracking" value={85.7} color="var(--success)" />
                  <ProgressItem name="Micro Flick" value={78.4} color="var(--accent-primary)" />
                  <ProgressItem name="Mid Range" value={72.1} color="var(--info)" />
                  <ProgressItem name="Wide Multi" value={68.5} color="var(--warning)" />
                  <ProgressItem name="Counter-Strafe" value={64.2} color="var(--warning)" />
                  <ProgressItem name="Macro Flick" value={59.8} color="var(--danger)" />
                  <ProgressItem name="Stochastic Track" value={55.1} color="var(--danger)" />
                </div>
              </div>

              {/* 하단: 분석 카테고리 카드 */}
              <div className="dash-bottom-cards">
                <button className="dash-cat-card" onClick={() => useEngineStore.getState().setScreen('progress-dashboard')}>
                  <span className="dash-cat-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M3 20 L3 10 L8 10 L8 20" /><path d="M9 20 L9 4 L14 4 L14 20" /><path d="M15 20 L15 12 L20 12 L20 20" />
                    </svg>
                  </span>
                  <span className="dash-cat-label">{t('tool.progressDashboard')}</span>
                </button>
                {onHistory && (
                  <button className="dash-cat-card" onClick={onHistory}>
                    <span className="dash-cat-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10" /><path d="M12 6 L12 12 L16 14" />
                      </svg>
                    </span>
                    <span className="dash-cat-label">{t('tool.history')}</span>
                  </button>
                )}
                <button className="dash-cat-card" onClick={() => setMainTab('training')}>
                  <span className="dash-cat-icon">
                    {CategoryIcons.Flick}
                  </span>
                  <span className="dash-cat-label">{t('scenario.tabTraining')}</span>
                </button>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
