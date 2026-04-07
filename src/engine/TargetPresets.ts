/**
 * 타겟 프리셋 정의
 * 훈련 시나리오별 사전 정의된 타겟 설정
 * TargetConfig를 기반으로 빠른 타겟 생성 지원
 */
import { TARGET_COLORS } from '../config/theme';
import type { TargetConfig, TargetShape } from './Target';

/** 프리셋 이름 */
export type TargetPresetName =
  | 'training_flick'
  | 'training_tracking'
  | 'training_humanoid'
  | 'training_strafe'
  | 'training_vertical'
  | 'training_cube';

/** 프리셋 메타데이터 */
export interface TargetPreset {
  /** 프리셋 이름 */
  name: TargetPresetName;
  /** 설명 (한국어) */
  description: string;
  /** 타겟 설정 */
  config: TargetConfig;
  /** humanoid 타겟 여부 */
  isHumanoid: boolean;
}

/**
 * training_flick — 정적 구체 타겟
 * 플릭 에임 연습용, 빨간색 구체, 움직이지 않음
 */
const TRAINING_FLICK: TargetPreset = {
  name: 'training_flick',
  description: '플릭 에임 연습 — 정적 구체 타겟',
  config: {
    angularSizeDeg: 3.0,
    distanceM: 15,
    shape: 'sphere' as TargetShape,
    color: TARGET_COLORS.flickRed,
    movement: { pattern: 'static' },
  },
  isHumanoid: false,
};

/**
 * training_tracking — 수평 이동 구체 타겟
 * 트래킹 에임 연습용, 초록색 구체, 좌우 왕복 이동
 */
const TRAINING_TRACKING: TargetPreset = {
  name: 'training_tracking',
  description: '트래킹 에임 연습 — 좌우 이동 구체 타겟',
  config: {
    angularSizeDeg: 4.0,
    distanceM: 12,
    shape: 'sphere' as TargetShape,
    color: TARGET_COLORS.trackingGreen,
    movement: {
      pattern: 'linear',
      speed: 3.0,
      range: 3.0,
      axis: 'horizontal',
    },
  },
  isHumanoid: false,
};

/**
 * training_humanoid — 정적 인체형 타겟
 * 히트존 연습용, 인체 모양, 움직이지 않음
 */
const TRAINING_HUMANOID: TargetPreset = {
  name: 'training_humanoid',
  description: '히트존 연습 — 정적 인체형 타겟',
  config: {
    angularSizeDeg: 6.0,
    distanceM: 15,
    color: TARGET_COLORS.flickRed,
    movement: { pattern: 'static' },
  },
  isHumanoid: true,
};

/**
 * training_strafe — ADAD 스트레이프 인체형 타겟
 * 실전 시뮬레이션, 랜덤 방향 전환
 */
const TRAINING_STRAFE: TargetPreset = {
  name: 'training_strafe',
  description: 'ADAD 스트레이프 — 인체형 이동 타겟',
  config: {
    angularSizeDeg: 6.0,
    distanceM: 12,
    color: TARGET_COLORS.flickRed,
    movement: {
      pattern: 'strafe',
      speed: 4.0,
      range: 2.5,
      strafeMinInterval: 0.3,
      strafeMaxInterval: 1.0,
    },
  },
  isHumanoid: true,
};

/**
 * training_vertical — 수직 이동 구체 타겟
 * 상하 트래킹 연습
 */
const TRAINING_VERTICAL: TargetPreset = {
  name: 'training_vertical',
  description: '수직 트래킹 연습 — 상하 이동 구체 타겟',
  config: {
    angularSizeDeg: 3.5,
    distanceM: 12,
    shape: 'sphere' as TargetShape,
    color: TARGET_COLORS.trackingTeal,
    movement: {
      pattern: 'linear',
      speed: 2.5,
      range: 2.0,
      axis: 'vertical',
    },
  },
  isHumanoid: false,
};

/**
 * training_cube — 정적 큐브 타겟
 * 정밀 에임 연습용, 작은 큐브 형상
 */
const TRAINING_CUBE: TargetPreset = {
  name: 'training_cube',
  description: '정밀 에임 연습 — 정적 큐브 타겟',
  config: {
    angularSizeDeg: 2.5,
    distanceM: 15,
    shape: 'cube' as TargetShape,
    color: TARGET_COLORS.alertRed,
    movement: { pattern: 'static' },
  },
  isHumanoid: false,
};

/** 전체 프리셋 목록 */
export const TARGET_PRESETS: ReadonlyArray<TargetPreset> = [
  TRAINING_FLICK,
  TRAINING_TRACKING,
  TRAINING_HUMANOID,
  TRAINING_STRAFE,
  TRAINING_VERTICAL,
  TRAINING_CUBE,
];

/** 이름으로 프리셋 검색 */
export function getTargetPreset(name: TargetPresetName): TargetPreset | undefined {
  return TARGET_PRESETS.find(p => p.name === name);
}
