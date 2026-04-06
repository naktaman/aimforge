/**
 * 메인 허브 UI — Silver Forge 레퍼런스 기반 3열 대시보드
 * 탭 구조: 감도 프로파일 | 훈련 | 분석
 * 100vh 꽉 채움, 스크롤 없는 프로페셔널 게이밍 대시보드
 */
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'motion/react';
import { useSettingsStore } from '../stores/settingsStore';
import { useEngineStore } from '../stores/engineStore';
import { useUiStore } from '../stores/uiStore';
import { useTranslation } from '../i18n';
import { useTabKeyboard } from '../utils/useTabKeyboard';
import type { GamePreset, ScenarioType } from '../utils/types';
import { CrosshairSettings } from './CrosshairSettings';
import { useScenarioParams } from '../hooks/useScenarioParams';
import { SensitivityTab } from './dashboard/SensitivityTab';
import { TrainingTab } from './dashboard/TrainingTab';
import { AnalysisTab } from './dashboard/AnalysisTab';
import { DashboardHero } from './dashboard/DashboardHero';

/* 하위 호환성을 위한 타입 재수출 */
export type { ScenarioParams, BatteryParams, TrainingStartParams } from '../types/scenarioSelect';

/** ScenarioSelect Props */
interface ScenarioSelectProps {
  onStart: (scenarioType: ScenarioType, params: import('../types/scenarioSelect').ScenarioParams) => void;
  onTrainingStart?: (params: import('../types/scenarioSelect').TrainingStartParams) => void;
  onCalibration?: () => void;
  onZoomCalibration?: () => void;
  onBattery?: (params: import('../types/scenarioSelect').BatteryParams) => void;
  onHistory?: () => void;
}

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

/** 메인 허브 컴포넌트 */
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

  /* 시나리오 파라미터 — useReducer 커스텀 훅으로 통합 관리 */
  const { params, setParam } = useScenarioParams();

  /* 게임 프리셋 로드 */
  useEffect(() => {
    invoke<GamePreset[]>('get_available_games').then(setGames);
  }, []);

  /* cm/360 계산 */
  const cm360 = selectedGame ? calcCm360(dpi, sensitivity, selectedGame.yaw) : null;

  /** 시나리오 시작 핸들러 */
  const handleStart = () => {
    onStart(scenarioType, {
      targetSizeDeg: params.targetSize,
      angleRange: [params.angleMin, params.angleMax],
      numTargets: params.numTargets,
      timeout: params.timeout,
      targetSpeedDegPerSec: params.trackingSpeed,
      directionChanges: params.dirChanges,
      duration: params.duration,
      trajectoryType: params.trajectory,
      orbitRadiusDeg: params.orbitRadius,
      orbitSpeedDegPerSec: params.orbitSpeed,
      radiusVariation: params.radiusVar,
      speedVariation: params.speedVar,
      distance: params.distance,
      noiseSpeed: params.noiseSpeed,
      amplitudeDeg: params.amplitude,
      stopTimeMs: params.stopTime,
      strafeSpeedDegPerSec: params.strafeSpeed,
      switchFrequencyHz: params.switchFreq,
      flickAngleRange: [params.flickAngleMin, params.flickAngleMax],
    });
  };

  /** 시나리오별 파라미터 UI */
  const renderParams = () => {
    switch (scenarioType) {
      case 'flick':
        return (
          <div className="settings-grid">
            <label>{t('param.targetSize')}<input type="number" value={params.targetSize} onChange={(e) => setParam('targetSize', Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>{t('param.numTargets')}<input type="number" value={params.numTargets} onChange={(e) => setParam('numTargets', Number(e.target.value))} min={5} max={100} /></label>
            <label>{t('param.timeout')}<input type="number" value={params.timeout} onChange={(e) => setParam('timeout', Number(e.target.value))} min={1000} max={10000} step={500} /></label>
            <label>{t('param.minAngle')}<input type="number" value={params.angleMin} onChange={(e) => setParam('angleMin', Number(e.target.value))} min={5} max={180} /></label>
            <label>{t('param.maxAngle')}<input type="number" value={params.angleMax} onChange={(e) => setParam('angleMax', Number(e.target.value))} min={10} max={180} /></label>
          </div>
        );
      case 'tracking':
        return (
          <div className="settings-grid">
            <label>{t('param.targetSize')}<input type="number" value={params.targetSize} onChange={(e) => setParam('targetSize', Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>{t('param.targetSpeed')}<input type="number" value={params.trackingSpeed} onChange={(e) => setParam('trackingSpeed', Number(e.target.value))} min={5} max={200} /></label>
            <label>{t('param.dirChanges')}<input type="number" value={params.dirChanges} onChange={(e) => setParam('dirChanges', Number(e.target.value))} min={0} max={20} /></label>
            <label>{t('param.duration')}<input type="number" value={params.duration} onChange={(e) => setParam('duration', Number(e.target.value))} min={5000} max={60000} step={1000} /></label>
            <label>{t('param.trajectory')}<select value={params.trajectory} onChange={(e) => setParam('trajectory', e.target.value as 'horizontal' | 'vertical' | 'mixed')}><option value="horizontal">{t('param.horizontal')}</option><option value="vertical">{t('param.vertical')}</option><option value="mixed">{t('param.mixed')}</option></select></label>
          </div>
        );
      case 'circular_tracking':
        return (
          <div className="settings-grid">
            <label>{t('param.targetSize')}<input type="number" value={params.targetSize} onChange={(e) => setParam('targetSize', Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>{t('param.orbitRadius')}<input type="number" value={params.orbitRadius} onChange={(e) => setParam('orbitRadius', Number(e.target.value))} min={3} max={30} /></label>
            <label>{t('param.orbitSpeed')}<input type="number" value={params.orbitSpeed} onChange={(e) => setParam('orbitSpeed', Number(e.target.value))} min={10} max={120} /></label>
            <label>{t('param.radiusVariation')}<input type="number" value={params.radiusVar} onChange={(e) => setParam('radiusVar', Number(e.target.value))} min={0} max={1} step={0.1} /></label>
            <label>{t('param.speedVariation')}<input type="number" value={params.speedVar} onChange={(e) => setParam('speedVar', Number(e.target.value))} min={0} max={1} step={0.1} /></label>
            <label>{t('param.distance')}<input type="number" value={params.distance} onChange={(e) => setParam('distance', Number(e.target.value))} min={5} max={30} /></label>
            <label>{t('param.duration')}<input type="number" value={params.duration} onChange={(e) => setParam('duration', Number(e.target.value))} min={5000} max={60000} step={1000} /></label>
          </div>
        );
      case 'stochastic_tracking':
        return (
          <div className="settings-grid">
            <label>{t('param.targetSize')}<input type="number" value={params.targetSize} onChange={(e) => setParam('targetSize', Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>{t('param.noiseSpeed')}<input type="number" value={params.noiseSpeed} onChange={(e) => setParam('noiseSpeed', Number(e.target.value))} min={0.1} max={3} step={0.1} /></label>
            <label>{t('param.amplitude')}<input type="number" value={params.amplitude} onChange={(e) => setParam('amplitude', Number(e.target.value))} min={3} max={30} /></label>
            <label>{t('param.distance')}<input type="number" value={params.distance} onChange={(e) => setParam('distance', Number(e.target.value))} min={5} max={30} /></label>
            <label>{t('param.duration')}<input type="number" value={params.duration} onChange={(e) => setParam('duration', Number(e.target.value))} min={5000} max={60000} step={1000} /></label>
          </div>
        );
      case 'counter_strafe_flick':
        return (
          <div className="settings-grid">
            <label>{t('param.targetSize')}<input type="number" value={params.targetSize} onChange={(e) => setParam('targetSize', Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>{t('param.stopTime')}<input type="number" value={params.stopTime} onChange={(e) => setParam('stopTime', Number(e.target.value))} min={50} max={500} step={10} /></label>
            <label>{t('param.strafeSpeed')}<input type="number" value={params.strafeSpeed} onChange={(e) => setParam('strafeSpeed', Number(e.target.value))} min={10} max={100} /></label>
            <label>{t('param.numTargets')}<input type="number" value={params.numTargets} onChange={(e) => setParam('numTargets', Number(e.target.value))} min={5} max={50} /></label>
            <label>{t('param.minAngle')}<input type="number" value={params.angleMin} onChange={(e) => setParam('angleMin', Number(e.target.value))} min={5} max={90} /></label>
            <label>{t('param.maxAngle')}<input type="number" value={params.angleMax} onChange={(e) => setParam('angleMax', Number(e.target.value))} min={10} max={180} /></label>
            <label>{t('param.timeout')}<input type="number" value={params.timeout} onChange={(e) => setParam('timeout', Number(e.target.value))} min={1000} max={10000} step={500} /></label>
          </div>
        );
      case 'micro_flick':
        return (
          <div className="settings-grid">
            <label>{t('param.targetSize')}<input type="number" value={params.targetSize} onChange={(e) => setParam('targetSize', Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>{t('param.trackingSpeed')}<input type="number" value={params.trackingSpeed} onChange={(e) => setParam('trackingSpeed', Number(e.target.value))} min={5} max={100} /></label>
            <label>{t('param.switchFreq')}<input type="number" value={params.switchFreq} onChange={(e) => setParam('switchFreq', Number(e.target.value))} min={0.1} max={2} step={0.1} /></label>
            <label>{t('param.flickMinAngle')}<input type="number" value={params.flickAngleMin} onChange={(e) => setParam('flickAngleMin', Number(e.target.value))} min={5} max={60} /></label>
            <label>{t('param.flickMaxAngle')}<input type="number" value={params.flickAngleMax} onChange={(e) => setParam('flickAngleMax', Number(e.target.value))} min={10} max={120} /></label>
            <label>{t('param.distance')}<input type="number" value={params.distance} onChange={(e) => setParam('distance', Number(e.target.value))} min={5} max={30} /></label>
            <label>{t('param.duration')}<input type="number" value={params.duration} onChange={(e) => setParam('duration', Number(e.target.value))} min={10000} max={120000} step={5000} /></label>
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
        <div className="dash-tabs rail-tabs" role="tablist" aria-label={t('scenario.tabSensitivity')} ref={mainTabRef} onKeyDown={mainTabKeyDown}>
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
              className={`dash-tab rail-tab ${mainTab === key ? 'active' : ''}`}
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

      {/* ── 상태 기반 CTA 히어로 ── */}
      <DashboardHero
        t={t}
        onCalibration={onCalibration}
        onTrainingStart={() => { setMainTab('training'); setTrainingSub('catalog'); }}
        onBattery={onBattery ? () => onBattery({ preset: 'TACTICAL' }) : undefined}
        hasSelectedGame={!!selectedGame}
      />

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
          {/* 탭 1: 감도 프로파일 */}
          {mainTab === 'sensitivity' && (
            <SensitivityTab
              sensitivity={sensitivity}
              dpi={dpi}
              cm360={cm360}
              selectedGame={selectedGame}
              games={games}
              selectGame={selectGame}
              recoilEnabled={recoilEnabled}
              recoilPreset={recoilPreset}
              toggleRecoil={toggleRecoil}
              setRecoilPreset={setRecoilPreset}
              fireMode={fireMode}
              fireRpm={fireRpm}
              setFireMode={setFireMode}
              setFireRpm={setFireRpm}
              onCalibration={onCalibration}
              onZoomCalibration={onZoomCalibration}
              mode={mode}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
              t={t}
              getSensitivityLevel={getSensitivityLevel}
            />
          )}

          {/* 탭 2: 훈련 */}
          {mainTab === 'training' && (
            <TrainingTab
              trainingSub={trainingSub}
              setTrainingSub={setTrainingSub}
              subTabRef={subTabRef}
              subTabKeyDown={subTabKeyDown}
              selectedGame={selectedGame}
              onBattery={onBattery}
              onTrainingStart={onTrainingStart}
              scenarioType={scenarioType}
              setScenarioType={setScenarioType}
              renderParams={renderParams}
              handleStart={handleStart}
              params={params}
              setParam={setParam}
              t={t}
              mode={mode}
            />
          )}

          {/* 탭 3: 분석 */}
          {mainTab === 'analysis' && (
            <AnalysisTab
              onHistory={onHistory}
              onCalibration={onCalibration}
              mode={mode}
              t={t}
              setMainTab={setMainTab}
            />
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
