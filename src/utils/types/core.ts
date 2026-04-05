/**
 * 코어 타입 — IPC, 입력, 엔진 설정, 시나리오 기본
 */

/** Rust MouseEvent와 대응하는 프론트엔드 타입 */
export interface MouseEvent {
  deltaX: number;
  deltaY: number;
  timestampUs: number;
  button: 'Left' | 'Right' | 'Middle' | null;
}

/** Rust MouseBatch와 대응 — drain_mouse_batch 반환값 */
export interface MouseBatch {
  events: MouseEvent[];
  totalDx: number;
  totalDy: number;
  buttonEvents: MouseEvent[];
  /** 최신 이벤트의 QPC 타임스탬프 (µs) — 입력 레이턴시 계산용 */
  latestTimestampUs?: number;
}

/** 퍼포먼스 오버레이 데이터 */
export interface PerfData {
  fps: number;
  frameTimeMs: number;
  inputLatencyUs: number;
  geometries: number;
  textures: number;
}

/** 게임 프리셋 (Rust GamePreset 대응) */
export interface GamePreset {
  id: string;
  name: string;
  yaw: number;
  defaultFov: number;
  fovType: 'horizontal' | 'vertical';
  defaultAspectRatio: number;
  sensStep: number | null;
  movementRatio: number;
}

/** 방식별 변환 결과 */
export interface ConversionResult {
  cm360: number;
  sens: number;
  multiplier: number;
}

/** 6가지 변환 방식 동시 계산 결과 */
export interface AllMethodsConversion {
  srcGame: string;
  dstGame: string;
  srcCm360: number;
  srcFovH: number;
  dstFovH: number;
  results: Record<string, ConversionResult>;
}

/** sens_step 스냅 결과 */
export interface SnappedSensitivity {
  floorSens: number;
  floorCm360: number;
  ceilSens: number;
  ceilCm360: number;
  recommendedSens: number;
  recommendedCm360: number;
}

/** 변환 방식 이름 */
export type ConversionMethod = 'MDM_0' | 'MDM_56.25' | 'MDM_75' | 'MDM_100' | 'Viewspeed_H' | 'Viewspeed_V';

/** 엔진 설정 */
export interface EngineConfig {
  dpi: number;
  cmPer360: number;
  hfov: number;
  aspectRatio: number;
}

/** 시나리오 타입 유니온 */
export type ScenarioType =
  | 'flick'
  | 'tracking'
  | 'circular_tracking'
  | 'stochastic_tracking'
  | 'counter_strafe_flick'
  | 'micro_flick'
  | 'zoom_steady'
  | 'zoom_correction'
  | 'zoom_reacquisition'
  | 'zoom_composite';

/** 시나리오 공통 설정 */
export interface ScenarioConfig {
  type: ScenarioType;
  targetSizeDeg: number;
}

/** 8방향 */
export type Direction =
  | 'right'
  | 'upper_right'
  | 'up'
  | 'upper_left'
  | 'left'
  | 'lower_left'
  | 'down'
  | 'lower_right';

/** 운동체계 영역 */
export type MotorRegion = 'finger' | 'wrist' | 'arm';

/** 클릭 타이밍 분류 */
export type ClickType = 'PreAim' | 'PreFire' | 'Flick';

/** 타겟 타입 */
export type TargetType = 'sphere' | 'humanoid';

/** 3구역 히트존 */
export type HitZone = 'head' | 'upper_body' | 'lower_body';

/** 궤적 타입 */
export type TrajectoryType =
  | 'horizontal'
  | 'vertical'
  | 'mixed'
  | 'circular'
  | 'stochastic';

/** 세션 요약 */
export interface SessionSummary {
  id: number;
  mode: string;
  sessionType: string;
  startedAt: string;
  endedAt: string | null;
  totalTrials: number;
  avgFps: number | null;
}

/** 트라이얼 요약 */
export interface TrialSummary {
  id: number;
  scenarioType: string;
  cm360Tested: number;
  compositeScore: number;
  createdAt: string;
}

/** 세션 상세 */
export interface SessionDetail {
  session: SessionSummary;
  trials: TrialSummary[];
}

/** 레이더 차트 축 */
export interface RadarAxis {
  label: string;
  key: string;
  value: number;
}
