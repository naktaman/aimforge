/**
 * 시나리오 설정 UI
 * 게임 선택, DPI, 감도, 시나리오 파라미터 설정 후 시작
 * Day 8~9: 6종 시나리오 + 배터리 프리셋 추가
 */
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settingsStore';
import type { GamePreset, ScenarioType, BatteryPreset } from '../utils/types';
import { ConversionPanel } from './ConversionPanel';

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

interface ScenarioSelectProps {
  onStart: (scenarioType: ScenarioType, params: ScenarioParams) => void;
  onCalibration?: () => void;
  onZoomCalibration?: () => void;
  onBattery?: (params: BatteryParams) => void;
  onHistory?: () => void;
}

/** 시나리오 탭 정의 */
const SCENARIO_TABS: Array<{ type: ScenarioType; label: string }> = [
  { type: 'flick', label: 'Static Flick' },
  { type: 'tracking', label: 'Linear Tracking' },
  { type: 'circular_tracking', label: 'Circular Tracking' },
  { type: 'stochastic_tracking', label: 'Stochastic Tracking' },
  { type: 'counter_strafe_flick', label: 'Counter-Strafe' },
  { type: 'micro_flick', label: 'Micro-Flick' },
];

export function ScenarioSelect({ onStart, onCalibration, onZoomCalibration, onBattery, onHistory }: ScenarioSelectProps) {
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

  /** 시나리오 타입별 시작 버튼 텍스트 */
  const getStartLabel = (): string => {
    const labels: Record<string, string> = {
      flick: 'Flick 시나리오 시작',
      tracking: 'Tracking 시나리오 시작',
      circular_tracking: 'Circular Tracking 시작',
      stochastic_tracking: 'Stochastic Tracking 시작',
      counter_strafe_flick: 'Counter-Strafe 시작',
      micro_flick: 'Micro-Flick 시작',
    };
    return labels[scenarioType] ?? '시나리오 시작';
  };

  return (
    <div className="scenario-select">
      <h2>AimForge Test Engine</h2>

      {/* 하드웨어/게임 설정 */}
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

      {/* 시나리오 선택 */}
      <section className="settings-section">
        <h3>시나리오</h3>
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
      </section>

      {/* 배터리 프리셋 */}
      <section className="settings-section">
        <h3>시나리오 배터리</h3>
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

      {/* 감도 변환기 */}
      <ConversionPanel games={games} />

      <div className="action-buttons">
        <button
          className="start-button"
          onClick={handleStart}
          disabled={!selectedGame}
        >
          {getStartLabel()}
        </button>
        {onCalibration && (
          <button
            className="calibration-button"
            onClick={onCalibration}
            disabled={!selectedGame}
          >
            Quick Calibration
          </button>
        )}
        {onZoomCalibration && (
          <button
            className="calibration-button"
            onClick={onZoomCalibration}
            disabled={!selectedGame}
          >
            Zoom Calibration
          </button>
        )}
        {onHistory && (
          <button
            className="calibration-button"
            onClick={onHistory}
          >
            히스토리
          </button>
        )}
      </div>
    </div>
  );
}
