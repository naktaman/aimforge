/**
 * 세션 인사이트 생성기 — E-1
 * 현재 세션 결과와 이전 세션들을 비교하여 성과 변화/트렌드/추천 인사이트 생성
 */
import type { GameMetrics } from '../hooks/useGameMetrics';
import type { DailyStatRow } from './types';

/** 인사이트 타입 */
export type InsightType = 'improvement' | 'decline' | 'recommendation';

/** 단일 인사이트 */
export interface Insight {
  type: InsightType;
  /** 관련 메트릭 이름 */
  metric: string;
  /** 변화량 (퍼센트 또는 절대값) */
  value: number | null;
  /** 사용자에게 보여줄 메시지 */
  message: string;
  /** 아이콘 힌트 */
  icon: 'trending-up' | 'trending-down' | 'lightbulb' | 'target' | 'zap';
}

/** 트렌드 분석용 내부 유틸 — 최근 N개 평균 계산 */
function recentAvg(values: number[], n: number): number {
  const slice = values.slice(-n);
  if (slice.length === 0) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/** 퍼센트 변화 계산 */
function pctChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * 세션 인사이트 생성
 * @param currentMetrics 현재 세션의 게임 메트릭
 * @param previousStats 이전 일별 통계 (progressStore.dailyStats)
 * @param scenarioType 현재 시나리오 타입
 * @returns 정렬된 인사이트 배열 (최대 5개)
 */
export function generateSessionInsights(
  currentMetrics: GameMetrics,
  previousStats: DailyStatRow[],
  scenarioType: string | null,
): Insight[] {
  const insights: Insight[] = [];

  // 현재 시나리오와 동일한 타입의 이전 통계만 필터
  const relevantStats = scenarioType
    ? previousStats.filter(s => s.scenarioType === scenarioType)
    : previousStats;

  // 이전 데이터가 충분한지 확인
  const hasPreviousData = relevantStats.length > 0;

  if (hasPreviousData) {
    // ── 정확도 비교 ──
    const prevAccuracies = relevantStats.map(s => s.avgAccuracy);
    const recentAccAvg = recentAvg(prevAccuracies, 5);
    const currentAcc = currentMetrics.accuracy;

    if (recentAccAvg > 0) {
      const accChange = pctChange(currentAcc, recentAccAvg);
      if (accChange >= 5) {
        insights.push({
          type: 'improvement',
          metric: 'accuracy',
          value: accChange,
          message: `정확도가 최근 평균 대비 ${accChange.toFixed(1)}% 상승했습니다!`,
          icon: 'trending-up',
        });
      } else if (accChange <= -5) {
        insights.push({
          type: 'decline',
          metric: 'accuracy',
          value: accChange,
          message: `정확도가 최근 평균 대비 ${Math.abs(accChange).toFixed(1)}% 하락했습니다.`,
          icon: 'trending-down',
        });
      }
    }

    // ── 점수 비교 ──
    const prevScores = relevantStats.map(s => s.avgScore);
    const recentScoreAvg = recentAvg(prevScores, 5);
    const currentScore = currentMetrics.score;

    if (recentScoreAvg > 0) {
      const scoreChange = pctChange(currentScore, recentScoreAvg);
      if (scoreChange >= 10) {
        insights.push({
          type: 'improvement',
          metric: 'score',
          value: scoreChange,
          message: `점수가 최근 평균 대비 ${scoreChange.toFixed(0)}% 상승! 뛰어난 성과입니다.`,
          icon: 'trending-up',
        });
      } else if (scoreChange <= -10) {
        insights.push({
          type: 'decline',
          metric: 'score',
          value: scoreChange,
          message: `점수가 최근 평균보다 ${Math.abs(scoreChange).toFixed(0)}% 낮습니다.`,
          icon: 'trending-down',
        });
      }
    }

    // ── 트렌드 분석 (3일 이상 데이터) ──
    if (relevantStats.length >= 3) {
      const recent3 = recentAvg(prevScores, 3);
      const older3 = recentAvg(prevScores.slice(0, -3), 3);

      if (older3 > 0) {
        const trendPct = pctChange(recent3, older3);
        if (trendPct >= 8) {
          insights.push({
            type: 'improvement',
            metric: 'trend',
            value: trendPct,
            message: `최근 상승 트렌드를 보이고 있습니다. 현재 훈련 루틴을 유지하세요!`,
            icon: 'zap',
          });
        } else if (trendPct <= -8) {
          insights.push({
            type: 'decline',
            metric: 'trend',
            value: trendPct,
            message: `최근 하락 트렌드입니다. 휴식 후 다시 도전해보세요.`,
            icon: 'trending-down',
          });
        }
      }
    }

    // ── 최고 기록 근접도 ──
    const bestScore = Math.max(...relevantStats.map(s => s.maxScore), 0);
    if (bestScore > 0 && currentScore >= bestScore * 0.95 && currentScore < bestScore) {
      insights.push({
        type: 'improvement',
        metric: 'personal-best',
        value: bestScore - currentScore,
        message: `최고 기록까지 ${(bestScore - currentScore).toFixed(0)}점 차이! 거의 다 왔습니다.`,
        icon: 'target',
      });
    }
  }

  // ── 훈련 추천 (항상 생성) ──
  const recommendations = generateRecommendations(currentMetrics, scenarioType);
  insights.push(...recommendations);

  // 인사이트 정렬: improvement > recommendation > decline, 최대 5개
  const priority: Record<InsightType, number> = { improvement: 0, recommendation: 1, decline: 2 };
  insights.sort((a, b) => priority[a.type] - priority[b.type]);

  return insights.slice(0, 5);
}

/**
 * 메트릭 기반 훈련 추천 생성
 * 약점을 분석하여 개선할 시나리오를 제안
 */
function generateRecommendations(
  metrics: GameMetrics,
  scenarioType: string | null,
): Insight[] {
  const recs: Insight[] = [];

  // 정확도 기반 추천
  if (metrics.accuracy < 0.4 && metrics.shots >= 10) {
    recs.push({
      type: 'recommendation',
      metric: 'accuracy',
      value: metrics.accuracy * 100,
      message: scenarioType?.includes('flick')
        ? '정확도가 낮습니다. 감도를 낮추거나 Micro Flick 시나리오로 미세 조준을 연습해보세요.'
        : '정확도 개선이 필요합니다. Flick 시나리오에서 기초 조준을 연습해보세요.',
      icon: 'lightbulb',
    });
  }

  // 반응속도 기반 추천
  if (metrics.lastReactionTime > 400 && metrics.kills > 0) {
    recs.push({
      type: 'recommendation',
      metric: 'reaction-time',
      value: metrics.lastReactionTime,
      message: '반응속도가 느린 편입니다. Flick Speed 시나리오로 반응속도를 단련해보세요.',
      icon: 'lightbulb',
    });
  }

  // 시나리오별 특화 추천
  if (scenarioType?.includes('tracking') && metrics.accuracy < 0.6) {
    recs.push({
      type: 'recommendation',
      metric: 'tracking',
      value: null,
      message: '트래킹 정확도가 부족합니다. 느린 속도부터 점진적으로 올려보세요.',
      icon: 'lightbulb',
    });
  }

  // 콤보 기반 추천 (일관성 부족)
  if (metrics.comboCount < 3 && metrics.hits >= 10) {
    recs.push({
      type: 'recommendation',
      metric: 'consistency',
      value: metrics.comboCount,
      message: '연속 히트 콤보가 낮습니다. 속도보다 정확성에 집중해보세요.',
      icon: 'lightbulb',
    });
  }

  return recs.slice(0, 2); // 추천은 최대 2개
}
