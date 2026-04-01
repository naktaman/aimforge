/**
 * 메인 허브 화면 — 3탭 구조
 * [프로파일 점검] [훈련] [도구]
 * 감도 교정이 핵심 컨셉이므로 프로파일 점검을 기본 탭으로 배치
 */
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settingsStore';
import { useEngineStore } from '../stores/engineStore';
import { useUiStore } from '../stores/uiStore';
import type { GamePreset, ScenarioType, BatteryPreset, StageType } from '../utils/types';
import { ConversionPanel } from './ConversionPanel';

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

/** 9개 세분류 훈련 카탈로그 */
const TRAINING_CATALOG = [
  {
    category: 'Flick',
    icon: '⚡',
    items: [
      { type: 'flick_micro' as StageType, name: 'Micro Flick', desc: '5-15° 손가락 정밀 플릭', color: '#ff6b6b' },
      { type: 'flick_medium' as StageType, name: 'Medium Flick', desc: '30-60° 손목 플릭 (핵심)', color: '#ffa500', star: true },
      { type: 'flick_macro' as StageType, name: 'Macro Flick', desc: '90-180° 팔 대각/턴샷', color: '#e74c3c' },
    ],
  },
  {
    category: 'Tracking',
    icon: '◎',
    items: [
      { type: 'tracking_close' as StageType, name: 'Close Range', desc: '10-15m 근거리 (팔 움직임)', color: '#00b894' },
      { type: 'tracking_mid' as StageType, name: 'Mid Range', desc: '20-30m 중거리 (손목+팔)', color: '#0984e3' },
      { type: 'tracking_long' as StageType, name: 'Long Range', desc: '40-60m 원거리 (손목)', color: '#6c5ce7' },
    ],
  },
  {
    category: 'Switching',
    icon: '⇄',
    items: [
      { type: 'switching_close' as StageType, name: 'Close Multi', desc: '15-45° 근접 타겟 전환', color: '#fdcb6e' },
      { type: 'switching_wide' as StageType, name: 'Wide Multi', desc: '60-150° 넓은 타겟 전환', color: '#e17055' },
    ],
  },
];

/** 시나리오 탭 정의 */
const SCENARIO_TABS: Array<{ type: ScenarioType; label: string }> = [
  { type: 'flick', label: 'Static Flick' },
  { type: 'tracking', label: 'Linear Tracking' },
  { type: 'circular_tracking', label: 'Circular' },
  { type: 'stochastic_tracking', label: 'Stochastic' },
  { type: 'counter_strafe_flick', label: 'Counter-Strafe' },
  { type: 'micro_flick', label: 'Micro-Flick' },
];

/** 메인 메뉴 탭 */
type MainTab = 'profile' | 'training' | 'tools';

export function ScenarioSelect({ onStart, onTrainingStart, onCalibration, onZoomCalibration, onBattery, onHistory }: ScenarioSelectProps) {
  const [mainTab, setMainTab] = useState<MainTab>('profile');
  const { mode } = useUiStore();
  const {
    dpi, sensitivity, selectedGame,
    setDpi, setSensitivity, selectGame,
  } = useSettingsStore();

  const [games, setGames] = useState<GamePreset[]>([]);
  const [scenarioType, setScenarioType] = useState<ScenarioType>('flick');

  // ── 커스텀 시나리오 파라미터 ──
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

  // 배터리
  const [batteryPreset, setBatteryPreset] = useState<BatteryPreset>('TACTICAL');
  // 훈련 서브탭
  const [trainingSubTab, setTrainingSubTab] = useState<'catalog' | 'custom'>('catalog');

  /** 게임 프리셋 로드 */
  useEffect(() => {
    invoke<GamePreset[]>('get_available_games').then(setGames);
  }, []);

  /** 커스텀 시나리오 시작 */
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
      <h2>AimForge</h2>

      {/* ── 하드웨어/게임 설정 (항상 보임) ── */}
      <section className="settings-section">
        <h3>설정</h3>
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
            <input type="number" value={dpi} onChange={(e) => setDpi(Number(e.target.value))} min={100} max={32000} />
          </label>
          <label>
            감도
            <input type="number" value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} step={0.01} min={0.01} />
          </label>
        </div>
      </section>

      {/* ── 메인 탭 네비게이션 ── */}
      <div className="main-tabs">
        {([
          { key: 'profile' as MainTab, label: '프로파일 점검' },
          { key: 'training' as MainTab, label: '훈련' },
          { key: 'tools' as MainTab, label: '도구' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            className={`main-tab ${mainTab === key ? 'active' : ''}`}
            onClick={() => setMainTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          탭 1: 프로파일 점검 (메인)
          ════════════════════════════════════════════ */}
      {mainTab === 'profile' && (
        <>
          {/* 전체 점검 CTA */}
          <div className="profile-cta">
            <div className="profile-cta__title">에임 프로파일 점검</div>
            <div className="profile-cta__desc">
              Flick · Tracking · Switching 전체 시나리오를 진행하여<br />
              나만의 Aim DNA 프로파일을 생성합니다.<br />
              프로파일이 있어야 감도 추천과 훈련 처방이 가능합니다.
            </div>

            {/* 배터리 프리셋 선택 */}
            <div className="battery-presets" style={{ justifyContent: 'center', marginBottom: 16 }}>
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
                className="btn btn--primary btn--lg"
                onClick={() => onBattery({ preset: batteryPreset })}
                disabled={!selectedGame}
              >
                전체 점검 시작 ({batteryPreset})
              </button>
            )}
          </div>

          {/* 감도 캘리브레이션 */}
          <div className="page-section">
            <div className="page-section__title">감도 캘리브레이션</div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              {onCalibration && (
                <button className="btn btn--success" onClick={onCalibration} disabled={!selectedGame}>
                  Quick Calibration
                </button>
              )}
              {onZoomCalibration && mode === 'advanced' && (
                <button className="btn btn--secondary" onClick={onZoomCalibration} disabled={!selectedGame}>
                  Zoom Calibration
                </button>
              )}
            </div>
          </div>

          {/* 내 프로파일 요약 (향후 데이터 연동) */}
          <div className="page-section">
            <div className="page-section__title">내 프로파일</div>
            <div className="profile-summary">
              <div
                className="profile-summary__card"
                onClick={() => useEngineStore.getState().setScreen('aim-dna-result')}
              >
                <div className="profile-summary__label">Aim DNA</div>
                <div className="text-sm text-muted">점검 완료 후 확인 가능</div>
              </div>
              <div
                className="profile-summary__card"
                onClick={() => useEngineStore.getState().setScreen('progress-dashboard')}
              >
                <div className="profile-summary__label">진행 현황</div>
                <div className="text-sm text-muted">훈련 기록 보기</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          탭 2: 훈련
          ════════════════════════════════════════════ */}
      {mainTab === 'training' && (
        <>
          {/* 서브탭: 카탈로그 / 커스텀 */}
          <div className="tab-group" style={{ marginBottom: 'var(--space-5)' }}>
            <button
              className={`tab-item ${trainingSubTab === 'catalog' ? 'active' : ''}`}
              onClick={() => setTrainingSubTab('catalog')}
            >
              훈련 카탈로그
            </button>
            <button
              className={`tab-item ${trainingSubTab === 'custom' ? 'active' : ''}`}
              onClick={() => setTrainingSubTab('custom')}
            >
              커스텀 시나리오
            </button>
          </div>

          {/* 훈련 카탈로그 */}
          {trainingSubTab === 'catalog' && (
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

              {/* 루틴 바로가기 (Advanced) */}
              {mode === 'advanced' && (
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <button
                    className="btn btn--secondary btn--full"
                    onClick={() => useEngineStore.getState().setScreen('routines')}
                  >
                    루틴 관리
                  </button>
                </div>
              )}
            </section>
          )}

          {/* 커스텀 시나리오 */}
          {trainingSubTab === 'custom' && (
            <section className="settings-section">
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
                className="btn btn--primary btn--full"
                onClick={handleStart}
                disabled={!selectedGame}
                style={{ marginTop: 'var(--space-4)' }}
              >
                시나리오 시작
              </button>
            </section>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════
          탭 3: 도구 (맥락별 그룹핑)
          ════════════════════════════════════════════ */}
      {mainTab === 'tools' && (
        <>
          {/* 분석 도구 */}
          <div className="tool-group">
            <div className="tool-group__title">분석</div>
            <div className="tool-grid">
              <button className="tool-btn" onClick={() => useEngineStore.getState().setScreen('progress-dashboard')}>
                <span className="tool-btn__icon">📊</span> 진행 대시보드
              </button>
              {mode === 'advanced' && (
                <>
                  <button className="tool-btn" onClick={() => useEngineStore.getState().setScreen('training-prescription')}>
                    <span className="tool-btn__icon">💊</span> 훈련 처방
                  </button>
                  <button className="tool-btn" onClick={() => useEngineStore.getState().setScreen('trajectory-analysis')}>
                    <span className="tool-btn__icon">🔬</span> 궤적 분석
                  </button>
                  <button className="tool-btn" onClick={() => useEngineStore.getState().setScreen('style-transition')}>
                    <span className="tool-btn__icon">🔄</span> 스타일 전환
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 감도 변환 */}
          <div className="tool-group">
            <div className="tool-group__title">감도 변환</div>
            <ConversionPanel games={games} />
            {mode === 'advanced' && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <button className="tool-btn" style={{ width: '100%' }} onClick={() => useEngineStore.getState().setScreen('conversion-selector')}>
                  <span className="tool-btn__icon">⚖️</span> 상세 변환 선택기 (6가지 방식 비교)
                </button>
              </div>
            )}
          </div>

          {/* 장비/환경 (Advanced) */}
          {mode === 'advanced' && (
            <div className="tool-group">
              <div className="tool-group__title">장비 / 환경</div>
              <div className="tool-grid">
                <button className="tool-btn" onClick={() => useEngineStore.getState().setScreen('movement-editor')}>
                  <span className="tool-btn__icon">🏃</span> 무브먼트 에디터
                </button>
                <button className="tool-btn" onClick={() => useEngineStore.getState().setScreen('fov-comparison')}>
                  <span className="tool-btn__icon">👁</span> FOV 비교
                </button>
                <button className="tool-btn" onClick={() => useEngineStore.getState().setScreen('hardware-compare')}>
                  <span className="tool-btn__icon">🖱</span> 하드웨어 비교
                </button>
                <button className="tool-btn" onClick={() => useEngineStore.getState().setScreen('dual-landscape')}>
                  <span className="tool-btn__icon">📈</span> 듀얼 랜드스케이프
                </button>
              </div>
            </div>
          )}

          {/* 기타 */}
          <div className="tool-group">
            <div className="tool-group__title">기타</div>
            <div className="tool-grid">
              {onHistory && (
                <button className="tool-btn" onClick={onHistory}>
                  <span className="tool-btn__icon">📋</span> 히스토리
                </button>
              )}
              <button className="tool-btn" onClick={() => useEngineStore.getState().setScreen('cross-game-comparison')}>
                <span className="tool-btn__icon">🎮</span> 크로스게임 비교
              </button>
              <button className="tool-btn" onClick={() => useEngineStore.getState().setScreen('display-settings')}>
                <span className="tool-btn__icon">⚙️</span> 크로스헤어 설정
              </button>
              {mode === 'advanced' && (
                <button className="tool-btn" onClick={() => useEngineStore.getState().setScreen('recoil-editor')}>
                  <span className="tool-btn__icon">💥</span> 리코일 에디터
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
