/**
 * 복합 점수 계산
 * 시나리오별 가중 합산 + overshoot penalty 보정
 */
import type {
  ZoomPhaseWeights,
  BatteryWeights,
  ScenarioType,
} from '../../utils/types';

export interface ScoreWeights {
  flick: number;
  tracking: number;
}

/** 기본 가중치 (게임 프리셋별로 오버라이드 가능) */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  flick: 0.6,
  tracking: 0.4,
};

/**
 * 복합 점수 계산
 * composite = sum(weight[i] × score[i])
 */
export function calculateComposite(
  flickScore: number,
  trackingScore: number,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): number {
  return flickScore * weights.flick + trackingScore * weights.tracking;
}

/**
 * Overshoot penalty 보정
 * pre_fire_ratio > 0.5 → penalty 50% 할인
 * (빠른 사격 스타일은 의도적 오버슛이므로 패널티 완화)
 */
export function adjustOvershootPenalty(
  rawPenalty: number,
  preFireRatio: number,
): number {
  if (preFireRatio > 0.5) {
    return rawPenalty * 0.5;
  }
  return rawPenalty;
}

/**
 * Flick 시나리오 점수 계산
 * hit_rate 기반 + TTT/overshoot 보정
 */
export function calculateFlickScore(
  hitRate: number,
  avgTtt: number,
  avgOvershoot: number,
  preFireRatio: number,
): number {
  // 기본 점수: 히트율 × 100
  let score = hitRate * 100;

  // TTT 보너스/패널티 (500ms 기준, 빠를수록 보너스)
  const tttFactor = Math.max(0, 1 - avgTtt / 3000);
  score *= 0.7 + tttFactor * 0.3;

  // 오버슛 패널티
  const overshootPenalty = avgOvershoot * 10; // 라디안 → 패널티
  score -= adjustOvershootPenalty(overshootPenalty, preFireRatio);

  return Math.max(0, Math.min(100, score));
}

/**
 * Tracking 시나리오 점수 계산
 * MAD 기반 (낮을수록 좋음)
 */
export function calculateTrackingScore(
  mad: number,
  velocityMatchRatio: number,
): number {
  // MAD → 점수 (0.01 rad ≈ 0.57° = 완벽, 0.2 rad ≈ 11.5° = 매우 나쁨)
  const madScore = Math.max(0, 100 - mad * 500);
  // velocity match 보너스
  const matchBonus = velocityMatchRatio * 20;
  return Math.max(0, Math.min(100, madScore + matchBonus));
}

/**
 * Zoom 3-Phase 복합 점수 계산
 * 각 Phase 점수의 가중 합
 */
export function calculateZoomCompositeScore(
  steadyScore: number,
  correctionScore: number,
  zoomoutScore: number,
  weights: ZoomPhaseWeights = { steady: 0.5, correction: 0.3, zoomout: 0.2 },
): number {
  return Math.max(
    0,
    Math.min(
      100,
      steadyScore * weights.steady +
        correctionScore * weights.correction +
        zoomoutScore * weights.zoomout,
    ),
  );
}

/**
 * Zoom 보정(Phase B) 점수 계산
 * 히트율 + 보정 속도 보너스 - 과보정 패널티
 */
export function calculateZoomCorrectionScore(
  hitRate: number,
  avgCorrectionTimeMs: number,
  overCorrectionRatio: number,
): number {
  // 히트율 기본 점수
  let score = hitRate * 100;
  // 보정 속도 보너스 (500ms 기준)
  const speedFactor = Math.max(0, 1 - avgCorrectionTimeMs / 2000);
  score *= 0.7 + speedFactor * 0.3;
  // 과보정 패널티
  score -= overCorrectionRatio * 15;
  return Math.max(0, Math.min(100, score));
}

/**
 * Zoom 재획득(Phase C) 점수 계산
 * 재획득 성공률 + 속도 보너스
 */
export function calculateZoomReacquisitionScore(
  reacquisitionRate: number,
  avgReacquisitionTimeMs: number,
): number {
  let score = reacquisitionRate * 100;
  // 재획득 속도 보너스 (1000ms 기준)
  const speedFactor = Math.max(0, 1 - avgReacquisitionTimeMs / 3000);
  score *= 0.7 + speedFactor * 0.3;
  return Math.max(0, Math.min(100, score));
}

/**
 * MicroFlick 하이브리드 점수 계산
 * tracking 60% + flick 30% + 재획득 보너스 10%
 */
export function calculateMicroFlickScore(
  trackingScore: number,
  flickScore: number,
  avgReacquireTimeMs: number,
): number {
  // 재획득 보너스: 빠를수록 높음 (1000ms 기준)
  const reacquireBonus = Math.max(0, 100 - avgReacquireTimeMs / 10);
  return Math.max(
    0,
    Math.min(100, trackingScore * 0.6 + flickScore * 0.3 + reacquireBonus * 0.1),
  );
}

/**
 * 시나리오 배터리 복합 점수 계산
 * 각 시나리오 점수의 가중 합
 */
export function calculateBatteryScore(
  scores: Partial<Record<ScenarioType, number>>,
  weights: BatteryWeights,
): number {
  let totalWeight = 0;
  let totalScore = 0;

  const weightMap: Record<string, number> = {
    flick: weights.flick,
    tracking: weights.tracking,
    circular_tracking: weights.circularTracking,
    stochastic_tracking: weights.stochasticTracking,
    counter_strafe_flick: weights.counterStrafeFlick,
    micro_flick: weights.microFlick,
    zoom_composite: weights.zoomComposite,
  };

  for (const [type, weight] of Object.entries(weightMap)) {
    const score = scores[type as ScenarioType];
    if (score !== undefined && weight > 0) {
      totalScore += score * weight;
      totalWeight += weight;
    }
  }

  // 가중치 정규화 (실행된 시나리오만 기준)
  return totalWeight > 0
    ? Math.max(0, Math.min(100, totalScore / totalWeight))
    : 0;
}
