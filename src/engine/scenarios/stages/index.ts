/**
 * Training Stage 시나리오 배럴 export
 * 6 카테고리 × 15개 시나리오 + DNA 스캔 + 커스텀 드릴
 */

// ── 카테고리 1: Flick (플릭 사격) ──
export { ReactionFlickScenario } from './ReactionFlickScenario';
export { MultiFlickScenario } from './MultiFlickScenario';
export { CloseRange180Scenario } from './CloseRange180Scenario';

// ── 카테고리 2: Tracking (트래킹) ──
export { AerialTrackingScenario } from './AerialTrackingScenario';
export { JumpTrackingScenario } from './JumpTrackingScenario';
export { StrafeTrackingScenario } from './StrafeTrackingScenario';

// ── 카테고리 3: Precision (정밀 사격) ──
export { LongRangeScenario } from './LongRangeScenario';

// ── 카테고리 4: Scoped (줌 사격) ──
export { ScopedFlickScenario } from './ScopedFlickScenario';
export { ZoomMultiFlickScenario } from './ZoomMultiFlickScenario';

// ── 카테고리 5: Assessment (평가) ──
export { AimDnaScanScenario } from './AimDnaScanScenario';

// ── 카테고리 6: Custom (커스텀) ──
export { CustomDrillScenario } from './CustomDrillScenario';
export type { CustomDrillConfig } from './CustomDrillScenario';
