/**
 * 크로스게임 DNA 비교 타입
 */

/** 크로스게임 비교 히스토리 요약 */
export interface CrossGameComparisonSummary {
  id: number;
  profileAId: number;
  profileBId: number;
  overallGap: number;
  predictedDays: number;
  createdAt: string;
}

/** 피처별 델타 */
export interface FeatureDelta {
  feature: string;
  refValue: number;
  targetValue: number;
  deltaPct: number;
  severity: string;
}

/** 갭 원인 */
export interface GapCause {
  causeType: string;
  description: string;
  contributingFeatures: string[];
  severity: number;
}

/** 개선 Phase */
export interface ImprovementPhase {
  phase: number;
  name: string;
  durationWeeks: string;
  actions: string[];
  targetMetrics: string[];
  scenarios: string[];
}

/** 크로스게임 비교 결과 */
export interface CrossGameComparison {
  refProfileId: number;
  targetProfileId: number;
  referenceGameId: number;
  deltas: FeatureDelta[];
  causes: GapCause[];
  overallGap: number;
  improvementPlan: { phases: ImprovementPhase[] };
  predictedDays: number;
  timeline: TimelinePrediction;
}

/** 타임라인 예측 */
export interface TimelinePrediction {
  totalDays: number;
  bottleneckFeature: string;
  perFeature: Array<{ feature: string; gapPct: number; estimatedDays: number }>;
  disclaimer: string;
}
