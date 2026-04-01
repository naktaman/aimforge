/**
 * 메인 허브 UI (재설계)
 * 탭 구조: 감도 프로파일 | 훈련 | 분석
 * 피드백 반영: 감도 최적화가 메인 컨셉임을 전면에 배치
 */
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settingsStore';
import { useEngineStore, RECOIL_PRESETS, type RecoilPreset } from '../stores/engineStore';
import { useUiStore } from '../stores/uiStore';
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

/** 9개 세분류 훈련 카탈로그 */
const TRAINING_CATALOG = [
  {
    category: 'Flick',
    icon: '///',
    items: [
      { type: 'flick_micro' as StageType, name: 'Micro Flick', desc: '5-15° 손가락 정밀 플릭', color: '#ff6b6b' },
      { type: 'flick_medium' as StageType, name: 'Medium Flick', desc: '30-60° 손목 플릭 (핵심)', color: '#ffa500', star: true },
      { type: 'flick_macro' as StageType, name: 'Macro Flick', desc: '90-180° 팔 대각/턴샷', color: '#e74c3c' },
    ],
  },
  {
    category: 'Tracking',
    icon: '~~~',
    items: [
      { type: 'tracking_close' as StageType, name: 'Close Range', desc: '10-15m 근거리 (팔 움직임)', color: '#00b894' },
      { type: 'tracking_mid' as StageType, name: 'Mid Range', desc: '20-30m 중거리 (손목+팔)', color: '#0984e3' },
      { type: 'tracking_long' as StageType, name: 'Long Range', desc: '40-60m 원거리 (손목)', color: '#6c5ce7' },
    ],
  },
  {
    category: 'Switching',
    icon: '<->',
    items: [
      { type: 'switching_close' as StageType, name: 'Close Multi', desc: '15-45° 근접 타겟 전환', color: '#fdcb6e' },
      { type: 'switching_wide' as StageType, name: 'Wide Multi', desc: '60-150° 넓은 타겟 전환', color: '#e17055' },
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
  const { recoilEnabled, recoilPreset, toggleRecoil, setRecoilPreset } = useEngineStore();
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
            <label>타겟 크기 (°)<input type="number" value={targetSize} onChange={(e) => setTargetSize(Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>타겟 수<input type="number" value={numTargets} onChange={(e) => setNumTargets(Number(e.target.value))} min={5} max={100} /></label>
            <label>타임아웃 (ms)<input type="number" value={timeout} onChange={(e) => setTimeout(Number(e.target.value))} min={1000} max={10000} step={500} /></label>
            <label>최소 각도 (°)<input type="number" value={angleMin} onChange={(e) => setAngleMin(Number(e.target.value))} min={5} max={180} /></label>
            <label>최대 각도 (°)<input type="number" value={angleMax} onChange={(e) => setAngleMax(Number(e.target.value))} min={10} max={180} /></label>
          </div>
        );

      case 'tracking':
        return (
          <div className="settings-grid">
            <label>타겟 크기 (°)<input type="number" value={targetSize} onChange={(e) => setTargetSize(Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>타겟 속도 (°/s)<input type="number" value={trackingSpeed} onChange={(e) => setTrackingSpeed(Number(e.target.value))} min={5} max={200} /></label>
            <label>방향 전환 횟수<input type="number" value={dirChanges} onChange={(e) => setDirChanges(Number(e.target.value))} min={0} max={20} /></label>
            <label>지속 시간 (ms)<input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={5000} max={60000} step={1000} /></label>
            <label>궤적<select value={trajectory} onChange={(e) => setTrajectory(e.target.value as 'horizontal' | 'vertical' | 'mixed')}><option value="horizontal">수평</option><option value="vertical">수직</option><option value="mixed">혼합</option></select></label>
          </div>
        );

      case 'circular_tracking':
        return (
          <div className="settings-grid">
            <label>타겟 크기 (°)<input type="number" value={targetSize} onChange={(e) => setTargetSize(Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>궤도 반지름 (°)<input type="number" value={orbitRadius} onChange={(e) => setOrbitRadius(Number(e.target.value))} min={3} max={30} /></label>
            <label>궤도 속도 (°/s)<input type="number" value={orbitSpeed} onChange={(e) => setOrbitSpeed(Number(e.target.value))} min={10} max={120} /></label>
            <label>반지름 변동<input type="number" value={radiusVar} onChange={(e) => setRadiusVar(Number(e.target.value))} min={0} max={1} step={0.1} /></label>
            <label>속도 변동<input type="number" value={speedVar} onChange={(e) => setSpeedVar(Number(e.target.value))} min={0} max={1} step={0.1} /></label>
            <label>거리 (m)<input type="number" value={distance} onChange={(e) => setDistance(Number(e.target.value))} min={5} max={30} /></label>
            <label>지속 시간 (ms)<input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={5000} max={60000} step={1000} /></label>
          </div>
        );

      case 'stochastic_tracking':
        return (
          <div className="settings-grid">
            <label>타겟 크기 (°)<input type="number" value={targetSize} onChange={(e) => setTargetSize(Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>노이즈 속도<input type="number" value={noiseSpeed} onChange={(e) => setNoiseSpeed(Number(e.target.value))} min={0.1} max={3} step={0.1} /></label>
            <label>진폭 (°)<input type="number" value={amplitude} onChange={(e) => setAmplitude(Number(e.target.value))} min={3} max={30} /></label>
            <label>거리 (m)<input type="number" value={distance} onChange={(e) => setDistance(Number(e.target.value))} min={5} max={30} /></label>
            <label>지속 시간 (ms)<input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={5000} max={60000} step={1000} /></label>
          </div>
        );

      case 'counter_strafe_flick':
        return (
          <div className="settings-grid">
            <label>타겟 크기 (°)<input type="number" value={targetSize} onChange={(e) => setTargetSize(Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>정지 시간 (ms)<input type="number" value={stopTime} onChange={(e) => setStopTime(Number(e.target.value))} min={50} max={500} step={10} /></label>
            <label>스트레이프 속도 (°/s)<input type="number" value={strafeSpeed} onChange={(e) => setStrafeSpeed(Number(e.target.value))} min={10} max={100} /></label>
            <label>타겟 수<input type="number" value={numTargets} onChange={(e) => setNumTargets(Number(e.target.value))} min={5} max={50} /></label>
            <label>최소 각도 (°)<input type="number" value={angleMin} onChange={(e) => setAngleMin(Number(e.target.value))} min={5} max={90} /></label>
            <label>최대 각도 (°)<input type="number" value={angleMax} onChange={(e) => setAngleMax(Number(e.target.value))} min={10} max={180} /></label>
            <label>타임아웃 (ms)<input type="number" value={timeout} onChange={(e) => setTimeout(Number(e.target.value))} min={1000} max={10000} step={500} /></label>
          </div>
        );

      case 'micro_flick':
        return (
          <div className="settings-grid">
            <label>타겟 크기 (°)<input type="number" value={targetSize} onChange={(e) => setTargetSize(Number(e.target.value))} min={0.5} max={10} step={0.5} /></label>
            <label>트래킹 속도 (°/s)<input type="number" value={trackingSpeed} onChange={(e) => setTrackingSpeed(Number(e.target.value))} min={5} max={100} /></label>
            <label>인터럽트 주파수 (Hz)<input type="number" value={switchFreq} onChange={(e) => setSwitchFreq(Number(e.target.value))} min={0.1} max={2} step={0.1} /></label>
            <label>플릭 최소 각도 (°)<input type="number" value={flickAngleMin} onChange={(e) => setFlickAngleMin(Number(e.target.value))} min={5} max={60} /></label>
            <label>플릭 최대 각도 (°)<input type="number" value={flickAngleMax} onChange={(e) => setFlickAngleMax(Number(e.target.value))} min={10} max={120} /></label>
            <label>거리 (m)<input type="number" value={distance} onChange={(e) => setDistance(Number(e.target.value))} min={5} max={30} /></label>
            <label>지속 시간 (ms)<input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={10000} max={120000} step={5000} /></label>
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
        <h3>기본 설정</h3>
        <div className="settings-grid">
          <label>
            게임
            <select
              value={selectedGame?.id ?? ''}
              onChange={(e) => {
                const game = games.find((g) => g.id === e.target.value);
                if (game) selectGame(game);
              }}
            >
              <option value="">선택하세요</option>
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
            감도
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
            반동 (리코일)
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
      </section>

      {/* ── 메인 탭 네비게이션 (재설계) ── */}
      <div className="main-tabs">
        {([
          { key: 'sensitivity' as MainTab, label: '감도 프로파일', emoji: '' },
          { key: 'training' as MainTab, label: '훈련', emoji: '' },
          { key: 'analysis' as MainTab, label: '분석', emoji: '' },
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
          title="크로스헤어 설정"
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

      {/* ══════════════════════════════════════════
          탭 1: 감도 프로파일 — 앱의 핵심 기능
          ══════════════════════════════════════════ */}
      {mainTab === 'sensitivity' && (
        <section className="sensitivity-hub">
          {/* 메인 CTA — 감도 캘리브레이션 */}
          <div className="sensitivity-hero">
            <h3>나만의 최적 감도 찾기</h3>
            <p className="sensitivity-desc">
              Bayesian Optimization으로 당신에게 딱 맞는 cm/360을 찾아드립니다.
              여러 시나리오를 플레이하며 감도를 자동으로 조정합니다.
            </p>
            <div className="sensitivity-actions">
              {onCalibration && (
                <button
                  className="btn-primary btn-lg"
                  onClick={onCalibration}
                  disabled={!selectedGame}
                >
                  감도 캘리브레이션 시작
                </button>
              )}
              {onZoomCalibration && mode === 'advanced' && (
                <button
                  className="btn-secondary btn-lg"
                  onClick={onZoomCalibration}
                  disabled={!selectedGame}
                >
                  줌 감도 캘리브레이션
                </button>
              )}
            </div>
          </div>

          {/* 감도 관련 도구 카드 */}
          <div className="sensitivity-tools">
            <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('game-profiles')}>
              <span className="tool-card-title">게임 프로필</span>
              <span className="tool-card-desc">게임별 감도, DPI, FOV 설정 관리</span>
            </button>
            <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('conversion-selector')}>
              <span className="tool-card-title">감도 변환기</span>
              <span className="tool-card-desc">게임 간 감도를 cm/360 기준으로 변환</span>
            </button>
            {mode === 'advanced' && (
              <>
                <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('fov-comparison')}>
                  <span className="tool-card-title">FOV 비교</span>
                  <span className="tool-card-desc">시야각에 따른 에임 영향 분석</span>
                </button>
                <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('hardware-compare')}>
                  <span className="tool-card-title">하드웨어 비교</span>
                  <span className="tool-card-desc">마우스/패드 조합별 성능 비교</span>
                </button>
                <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('dual-landscape')}>
                  <span className="tool-card-title">퍼포먼스 맵</span>
                  <span className="tool-card-desc">정적/동적 환경 감도 최적 구간</span>
                </button>
                <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('movement-editor')}>
                  <span className="tool-card-title">무브먼트 에디터</span>
                  <span className="tool-card-desc">이동 물리 파라미터 조정</span>
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
              { key: 'catalog' as TrainingSub, label: '시나리오 카탈로그' },
              { key: 'custom' as TrainingSub, label: '커스텀 플레이' },
              { key: 'battery' as TrainingSub, label: '배터리 테스트' },
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
              {TRAINING_CATALOG.map(({ category, icon, items }) => (
                <div key={category} className="catalog-category">
                  <h3 className="category-header">
                    <span className="category-icon">{icon}</span> {category}
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
                        <span className="catalog-item-desc">{item.desc}</span>
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
              <h3>커스텀 시나리오</h3>
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
                시나리오 시작
              </button>
            </section>
          )}

          {/* 배터리 테스트 — 종합 능력 측정 */}
          {trainingSub === 'battery' && (
            <section className="settings-section">
              <h3>시나리오 배터리</h3>
              <p className="battery-desc">여러 시나리오를 연속으로 수행하여 종합 에임 능력을 측정합니다.</p>
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
                  배터리 시작 ({batteryPreset})
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
              <span className="tool-card-title">진행 대시보드</span>
              <span className="tool-card-desc">일간/주간 에임 성장 추이와 준비도 확인</span>
            </button>
            {onHistory && (
              <button className="tool-card tool-card-wide" onClick={onHistory}>
                <span className="tool-card-title">세션 히스토리</span>
                <span className="tool-card-desc">과거 훈련 기록과 상세 결과 열람</span>
              </button>
            )}
            {mode === 'advanced' && (
              <>
                <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('training-prescription')}>
                  <span className="tool-card-title">훈련 처방</span>
                  <span className="tool-card-desc">약점 기반 맞춤 훈련 추천</span>
                </button>
                <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('trajectory-analysis')}>
                  <span className="tool-card-title">궤적 분석</span>
                  <span className="tool-card-desc">마우스 이동 패턴과 GMM 클러스터링</span>
                </button>
                <button className="tool-card" onClick={() => useEngineStore.getState().setScreen('style-transition')}>
                  <span className="tool-card-title">스타일 전환</span>
                  <span className="tool-card-desc">에임 스타일 변화 추적</span>
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
