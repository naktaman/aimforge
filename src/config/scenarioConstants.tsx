/**
 * ScenarioSelect 상수 정의
 * 카테고리 아이콘, 훈련 카탈로그, 시나리오 탭, 초기 파라미터
 */
import type { ScenarioType, StageType } from '../utils/types';
import type { ScenarioParamsState } from '../types/scenarioSelect';

/** 카테고리 SVG 아이콘 (18px, currentColor) */
export const CategoryIcons: Record<string, React.ReactNode> = {
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

/** 9개 세분류 훈련 카탈로그 — 색상은 CSS 변수 사용 */
export const TRAINING_CATALOG = [
  {
    category: 'Flick',
    items: [
      { type: 'flick_micro' as StageType, name: 'Micro Flick', descKey: 'training.flickMicroDesc', color: 'var(--danger)' },
      { type: 'flick_medium' as StageType, name: 'Medium Flick', descKey: 'training.flickMediumDesc', color: 'var(--warning)', star: true },
      { type: 'flick_macro' as StageType, name: 'Macro Flick', descKey: 'training.flickMacroDesc', color: 'var(--danger)' },
    ],
  },
  {
    category: 'Tracking',
    items: [
      { type: 'tracking_close' as StageType, name: 'Close Range', descKey: 'training.trackCloseDesc', color: 'var(--success)' },
      { type: 'tracking_mid' as StageType, name: 'Mid Range', descKey: 'training.trackMidDesc', color: 'var(--info)' },
      { type: 'tracking_long' as StageType, name: 'Long Range', descKey: 'training.trackLongDesc', color: 'var(--accent-cyan)' },
    ],
  },
  {
    category: 'Switching',
    items: [
      { type: 'switching_close' as StageType, name: 'Close Multi', descKey: 'training.switchCloseDesc', color: 'var(--warning)' },
      { type: 'switching_wide' as StageType, name: 'Wide Multi', descKey: 'training.switchWideDesc', color: 'var(--accent-primary)' },
    ],
  },
];

/** 시나리오 탭 정의 (커스텀 플레이용) */
export const SCENARIO_TABS: Array<{ type: ScenarioType; label: string }> = [
  { type: 'flick', label: 'Static Flick' },
  { type: 'tracking', label: 'Linear Tracking' },
  { type: 'circular_tracking', label: 'Circular' },
  { type: 'stochastic_tracking', label: 'Stochastic' },
  { type: 'counter_strafe_flick', label: 'Counter-Strafe' },
  { type: 'micro_flick', label: 'Micro-Flick' },
];

/** 시나리오 파라미터 초기값 */
export const initialParamsState: ScenarioParamsState = {
  targetSize: 3, numTargets: 20, timeout: 3000,
  angleMin: 10, angleMax: 180,
  trackingSpeed: 30, dirChanges: 4, duration: 15000,
  trajectory: 'horizontal',
  orbitRadius: 10, orbitSpeed: 40, radiusVar: 0.3, speedVar: 0.2,
  distance: 10, noiseSpeed: 0.8, amplitude: 15,
  stopTime: 200, strafeSpeed: 30,
  switchFreq: 0.5, flickAngleMin: 10, flickAngleMax: 60,
  batteryPreset: 'TACTICAL',
};
