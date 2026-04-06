/**
 * 점수 계산 로직 단위 테스트
 * CompositeScore 공식 검증 — 경계값 + 일반 케이스
 */
import { describe, it, expect } from 'vitest';
import { calculateFlickScore, calculateTrackingScore } from '../engine/metrics/CompositeScore';

describe('calculateFlickScore', () => {
  it('완벽 정확도 + 빠른 반응 → 높은 점수', () => {
    const score = calculateFlickScore(1.0, 200, 0, 0);
    expect(score).toBeGreaterThan(80);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('0% 정확도 → 낮은 점수', () => {
    const score = calculateFlickScore(0, 500, 10, 0);
    expect(score).toBeLessThan(20);
  });

  it('높은 오버슈트 → 점수 감소', () => {
    const high = calculateFlickScore(0.8, 300, 0, 0);
    const low = calculateFlickScore(0.8, 300, 20, 0);
    expect(high).toBeGreaterThan(low);
  });

  it('높은 프리파이어 비율은 오버슛 패널티 할인 (임계값 초과 시)', () => {
    // preFireRatio > 0.5 → 오버슛 패널티 50% 할인 (빠른 사격 스타일 보정)
    const noPrefire = calculateFlickScore(0.8, 300, 5, 0);
    const highPrefire = calculateFlickScore(0.8, 300, 5, 0.6);
    expect(highPrefire).toBeGreaterThan(noPrefire);
  });

  it('결과가 0~100 범위', () => {
    const score = calculateFlickScore(0.5, 400, 10, 0.1);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('calculateTrackingScore', () => {
  it('낮은 MAD + 높은 속도 매칭 → 높은 점수', () => {
    // MAD 단위: 라디안 (0.02 rad ≈ 1.1°, 매우 정밀한 추적)
    const score = calculateTrackingScore(0.02, 0.95);
    expect(score).toBeGreaterThan(80);
  });

  it('높은 MAD → 낮은 점수', () => {
    // 0.05 rad ≈ 2.9° vs 0.15 rad ≈ 8.6°
    const good = calculateTrackingScore(0.05, 0.9);
    const bad = calculateTrackingScore(0.15, 0.9);
    expect(good).toBeGreaterThan(bad);
  });

  it('결과가 0~100 범위', () => {
    const score = calculateTrackingScore(0.1, 0.7);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
