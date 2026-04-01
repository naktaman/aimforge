/**
 * 화면 접근 제어
 * Simple/Advanced 모드에 따라 접근 가능한 화면 결정
 */
import type { AppScreen } from '../stores/engineStore';
import type { AppMode } from '../stores/uiStore';

/** Advanced 모드에서만 접근 가능한 화면 목록 */
const ADVANCED_ONLY_SCREENS: ReadonlySet<AppScreen> = new Set([
  'movement-editor',
  'fov-comparison',
  'hardware-compare',
  'dual-landscape',
  'trajectory-analysis',
  'style-transition',
  'recoil-editor',
  'training-prescription',
  'zoom-calibration-setup',
  'zoom-calibration-progress',
  'zoom-calibration-result',
  'comparator-result',
  'routines',
  'routine-player',
  'cross-game-comparison',
  'leaderboard',
  'community',
  'data-management',
]);

/** 주어진 모드에서 화면 접근 가능 여부 */
export function isScreenAccessible(screen: AppScreen, mode: AppMode): boolean {
  if (mode === 'advanced') return true;
  return !ADVANCED_ONLY_SCREENS.has(screen);
}
