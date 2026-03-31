/**
 * Training Stage 시나리오 배럴 export
 * 3대 카테고리 × 8개 핵심 세분류 + Assessment + 레거시 호환
 */

// ── 카테고리 1: Flick (플릭 사격) — 3개 세분류 ──
export { FlickMicroScenario } from './FlickMicroScenario';     // 5-15° 손가락
export { FlickMediumScenario } from './FlickMediumScenario';   // 30-60° 손목 (최고 가중치)
export { FlickMacroScenario } from './FlickMacroScenario';     // 90-180° 팔

// ── 카테고리 2: Tracking (트래킹) — 3개 세분류 ──
export { TrackingCloseScenario } from './TrackingCloseScenario'; // 근거리 (팔, 10-15m)
export { TrackingMidScenario } from './TrackingMidScenario';     // 중거리 (손목+팔, 20-30m)
export { TrackingLongScenario } from './TrackingLongScenario';   // 원거리 (손목, 40-60m)

// ── 카테고리 3: Switching (타겟 전환) — 2개 세분류 ──
export { SwitchingCloseScenario } from './SwitchingCloseScenario'; // 근접 (15-45°)
export { SwitchingWideScenario } from './SwitchingWideScenario';   // 원거리 (60-150°)

// ── 이동 패턴 시스템 ──
export { MovementPatternSystem, RandomPatternScheduler } from './MovementPatternSystem';
export { getCloseRangePatterns, getMidRangePatterns, getLongRangePatterns } from './MovementPatternSystem';

// ── 카테고리 4: Assessment (평가) ──
export { AimDnaScanScenario } from './AimDnaScanScenario';

// ── 레거시 호환 ──
export { ReactionFlickScenario } from './ReactionFlickScenario';
export { MultiFlickScenario } from './MultiFlickScenario';
export { CloseRange180Scenario } from './CloseRange180Scenario';
export { AerialTrackingScenario } from './AerialTrackingScenario';
export { JumpTrackingScenario } from './JumpTrackingScenario';
export { StrafeTrackingScenario } from './StrafeTrackingScenario';
export { LongRangeScenario } from './LongRangeScenario';
export { ScopedFlickScenario } from './ScopedFlickScenario';
export { ZoomMultiFlickScenario } from './ZoomMultiFlickScenario';
export { CustomDrillScenario } from './CustomDrillScenario';
export type { CustomDrillConfig } from './CustomDrillScenario';
