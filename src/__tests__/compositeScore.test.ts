/**
 * CompositeScore.ts 복합 점수 계산 단위 테스트
 * 테스트되지 않은 함수들을 중심으로 검증
 */
import { describe, it, expect } from 'vitest';
import {
  calculateComposite,
  adjustOvershootPenalty,
  calculateZoomCompositeScore,
  calculateZoomCorrectionScore,
  calculateZoomReacquisitionScore,
  calculateMicroFlickScore,
  calculateBatteryScore,
  DEFAULT_WEIGHTS,
} from '../engine/metrics/CompositeScore';
import type { BatteryWeights } from '../utils/types';

// ────────────────────────────────────────────────────────
// calculateComposite
// ────────────────────────────────────────────────────────
describe('calculateComposite — 복합 점수 계산', () => {
  it('기본 가중치: flick=0.6, tracking=0.4 적용', () => {
    // 80×0.6 + 60×0.4 = 48 + 24 = 72
    expect(calculateComposite(80, 60)).toBeCloseTo(72, 6);
  });

  it('동일 점수면 가중치 무관하게 동일 점수 반환', () => {
    expect(calculateComposite(70, 70)).toBeCloseTo(70, 6);
  });

  it('커스텀 가중치 적용', () => {
    // 90×0.5 + 50×0.5 = 70
    const result = calculateComposite(90, 50, { flick: 0.5, tracking: 0.5 });
    expect(result).toBeCloseTo(70, 6);
  });

  it('flick 가중치=1.0, tracking=0.0 → flickScore 그대로', () => {
    const result = calculateComposite(85, 40, { flick: 1.0, tracking: 0.0 });
    expect(result).toBeCloseTo(85, 6);
  });

  it('경계값: 두 점수 모두 0 → 0', () => {
    expect(calculateComposite(0, 0)).toBe(0);
  });

  it('DEFAULT_WEIGHTS 확인: flick + tracking = 1.0', () => {
    expect(DEFAULT_WEIGHTS.flick + DEFAULT_WEIGHTS.tracking).toBeCloseTo(1.0, 6);
  });
});

// ────────────────────────────────────────────────────────
// adjustOvershootPenalty
// ────────────────────────────────────────────────────────
describe('adjustOvershootPenalty — overshoot 패널티 보정', () => {
  it('preFireRatio > 0.5 → 패널티 50% 할인 적용', () => {
    // rawPenalty=10, preFireRatio=0.6 → 10 × 0.5 = 5
    expect(adjustOvershootPenalty(10, 0.6)).toBeCloseTo(5, 6);
  });

  it('preFireRatio = 0.5 → 할인 미적용 (임계값 초과가 아님)', () => {
    expect(adjustOvershootPenalty(10, 0.5)).toBeCloseTo(10, 6);
  });

  it('preFireRatio < 0.5 → 원래 패널티 그대로', () => {
    expect(adjustOvershootPenalty(8, 0.3)).toBeCloseTo(8, 6);
  });

  it('preFireRatio=1.0 (항상 사전 발사) → 패널티 50% 할인', () => {
    expect(adjustOvershootPenalty(20, 1.0)).toBeCloseTo(10, 6);
  });

  it('패널티=0이면 어떤 비율에서도 0', () => {
    expect(adjustOvershootPenalty(0, 0.8)).toBe(0);
  });
});

// ────────────────────────────────────────────────────────
// calculateZoomCompositeScore
// ────────────────────────────────────────────────────────
describe('calculateZoomCompositeScore — Zoom 3-Phase 복합 점수', () => {
  it('기본 가중치(steady=0.5, correction=0.3, zoomout=0.2) 적용', () => {
    // 80×0.5 + 70×0.3 + 60×0.2 = 40 + 21 + 12 = 73
    expect(calculateZoomCompositeScore(80, 70, 60)).toBeCloseTo(73, 6);
  });

  it('커스텀 가중치 — steady에 전부 부여', () => {
    const result = calculateZoomCompositeScore(75, 50, 50, {
      steady: 1.0,
      correction: 0.0,
      zoomout: 0.0,
    });
    expect(result).toBeCloseTo(75, 6);
  });

  it('결과 범위 0~100 클램핑 — 초과값 100으로 제한', () => {
    const result = calculateZoomCompositeScore(100, 100, 100);
    expect(result).toBeLessThanOrEqual(100);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('모든 Phase 점수 0 → 결과 0', () => {
    expect(calculateZoomCompositeScore(0, 0, 0)).toBe(0);
  });
});

// ────────────────────────────────────────────────────────
// calculateZoomCorrectionScore
// ────────────────────────────────────────────────────────
describe('calculateZoomCorrectionScore — Zoom 보정 점수', () => {
  it('빠른 보정 (500ms, baseline=2000ms) → 높은 점수', () => {
    // hitRate=1.0, correctionTime=500ms → speedFactor=0.75 → score=100×(0.7+0.75×0.3)=100×0.925=92.5
    const fast = calculateZoomCorrectionScore(1.0, 500, 0);
    const slow = calculateZoomCorrectionScore(1.0, 1500, 0);
    expect(fast).toBeGreaterThan(slow);
  });

  it('느린 보정 (2000ms, baseline에 도달) → speedFactor=0 → 기본 점수만', () => {
    // correctionTime=2000ms → speedFactor=0 → score=hitRate×100×0.7
    const result = calculateZoomCorrectionScore(1.0, 2000, 0);
    expect(result).toBeCloseTo(70, 5);
  });

  it('과보정 패널티 적용 — overCorrectionRatio가 높을수록 점수 감소', () => {
    const noOvershoot = calculateZoomCorrectionScore(1.0, 0, 0);
    const withOvershoot = calculateZoomCorrectionScore(1.0, 0, 0.5);
    expect(withOvershoot).toBeLessThan(noOvershoot);
  });

  it('결과 범위 0~100 클램핑', () => {
    const result = calculateZoomCorrectionScore(0, 5000, 2.0);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});

// ────────────────────────────────────────────────────────
// calculateZoomReacquisitionScore
// ────────────────────────────────────────────────────────
describe('calculateZoomReacquisitionScore — Zoom 재획득 점수', () => {
  it('빠른 재획득 (0ms) → 최고 점수', () => {
    // score = 1.0×100 × (0.7 + 1.0×0.3) = 100
    const result = calculateZoomReacquisitionScore(1.0, 0);
    expect(result).toBeCloseTo(100, 5);
  });

  it('느린 재획득 (baseline=3000ms에서) → 기본 점수만', () => {
    // speedFactor=0 → score = 1.0×100×0.7 = 70
    const result = calculateZoomReacquisitionScore(1.0, 3000);
    expect(result).toBeCloseTo(70, 5);
  });

  it('재획득 실패 (rate=0) → 점수 0', () => {
    expect(calculateZoomReacquisitionScore(0, 0)).toBe(0);
  });

  it('결과 범위 0~100 내에 있음', () => {
    const result = calculateZoomReacquisitionScore(0.8, 1000);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it('재획득률이 높을수록 점수 높음', () => {
    const high = calculateZoomReacquisitionScore(0.9, 1000);
    const low = calculateZoomReacquisitionScore(0.5, 1000);
    expect(high).toBeGreaterThan(low);
  });
});

// ────────────────────────────────────────────────────────
// calculateMicroFlickScore
// ────────────────────────────────────────────────────────
describe('calculateMicroFlickScore — MicroFlick 하이브리드 점수', () => {
  it('tracking=60%, flick=30%, reacquire보너스=10% 가중 합산', () => {
    // trackingScore=80, flickScore=60, reacquireTime=0ms
    // reacquireBonus = max(0, 100 - 0/10) = 100
    // 80×0.6 + 60×0.3 + 100×0.1 = 48 + 18 + 10 = 76
    const result = calculateMicroFlickScore(80, 60, 0);
    expect(result).toBeCloseTo(76, 5);
  });

  it('재획득 시간이 길면 보너스 감소', () => {
    const fast = calculateMicroFlickScore(70, 70, 100);
    const slow = calculateMicroFlickScore(70, 70, 500);
    expect(fast).toBeGreaterThan(slow);
  });

  it('reacquireTime=1000ms → reacquireBonus=0 (divisor=10, 100-1000/10=0)', () => {
    // reacquireBonus = max(0, 100 - 1000/10) = max(0, 0) = 0
    const result = calculateMicroFlickScore(80, 60, 1000);
    // 80×0.6 + 60×0.3 + 0×0.1 = 48 + 18 = 66
    expect(result).toBeCloseTo(66, 5);
  });

  it('결과 범위 0~100 클램핑', () => {
    const result = calculateMicroFlickScore(100, 100, 0);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});

// ────────────────────────────────────────────────────────
// calculateBatteryScore
// ────────────────────────────────────────────────────────

/** 테스트용 균등 가중치 */
const EQUAL_WEIGHTS: BatteryWeights = {
  flick: 1,
  tracking: 1,
  circularTracking: 1,
  stochasticTracking: 1,
  counterStrafeFlick: 1,
  microFlick: 1,
  zoomComposite: 1,
};

describe('calculateBatteryScore — 시나리오 배터리 복합 점수', () => {
  it('빈 점수 → 0 반환', () => {
    expect(calculateBatteryScore({}, EQUAL_WEIGHTS)).toBe(0);
  });

  it('단일 시나리오 점수 → 해당 점수 그대로', () => {
    expect(calculateBatteryScore({ flick: 75 }, EQUAL_WEIGHTS)).toBeCloseTo(75, 6);
  });

  it('두 시나리오 균등 가중치 → 평균 점수', () => {
    // flick=80, tracking=60 → 평균 70
    const result = calculateBatteryScore({ flick: 80, tracking: 60 }, EQUAL_WEIGHTS);
    expect(result).toBeCloseTo(70, 6);
  });

  it('모든 시나리오 점수가 동일하면 해당 점수 반환', () => {
    const scores = {
      flick: 65,
      tracking: 65,
      circular_tracking: 65,
    };
    const result = calculateBatteryScore(scores, EQUAL_WEIGHTS);
    expect(result).toBeCloseTo(65, 6);
  });

  it('가중치=0인 시나리오는 결과에 영향 없음', () => {
    const weights: BatteryWeights = {
      ...EQUAL_WEIGHTS,
      tracking: 0, // tracking 제외
    };
    // flick=80만 반영 → 80
    const result = calculateBatteryScore({ flick: 80, tracking: 0 }, weights);
    expect(result).toBeCloseTo(80, 6);
  });

  it('결과 범위 0~100 클램핑', () => {
    const result = calculateBatteryScore(
      { flick: 100, tracking: 100, circular_tracking: 100 },
      EQUAL_WEIGHTS,
    );
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it('zoom_composite 시나리오 포함 — 정상 계산', () => {
    const result = calculateBatteryScore(
      { flick: 70, zoom_composite: 90 },
      EQUAL_WEIGHTS,
    );
    expect(result).toBeCloseTo(80, 6);
  });
});
