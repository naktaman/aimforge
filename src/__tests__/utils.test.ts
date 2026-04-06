/**
 * 유틸리티 함수 + 상수 단위 테스트
 * screenAccess, 점수 계산 상수 검증
 */
import { describe, it, expect } from 'vitest';
import { isScreenAccessible } from '../utils/screenAccess';
import {
  COMPOSITE_FLICK_WEIGHT,
  COMPOSITE_TRACKING_WEIGHT,
  ZOOM_PHASE_WEIGHTS,
  MICRO_FLICK_WEIGHTS,
  FLICK_ANGLE_BUCKETS,
} from '../config/constants';

describe('isScreenAccessible', () => {
  it('settings는 simple/advanced 모두 접근 가능', () => {
    expect(isScreenAccessible('settings', 'simple')).toBe(true);
    expect(isScreenAccessible('settings', 'advanced')).toBe(true);
  });

  it('viewport는 양쪽 모드에서 접근 가능', () => {
    expect(isScreenAccessible('viewport', 'simple')).toBe(true);
    expect(isScreenAccessible('viewport', 'advanced')).toBe(true);
  });

  it('advanced 전용 화면은 simple에서 차단', () => {
    const advancedOnly = ['trajectory-analysis', 'movement-editor', 'dual-landscape', 'recoil-editor'] as const;
    advancedOnly.forEach((screen) => {
      expect(isScreenAccessible(screen, 'simple'), screen).toBe(false);
      expect(isScreenAccessible(screen, 'advanced'), screen).toBe(true);
    });
  });
});

describe('점수 계산 상수 (constants)', () => {
  it('composite 가중치 합 = 1.0', () => {
    expect(COMPOSITE_FLICK_WEIGHT + COMPOSITE_TRACKING_WEIGHT).toBeCloseTo(1.0);
  });

  it('zoom phase 가중치 합 = 1.0', () => {
    const sum = ZOOM_PHASE_WEIGHTS.steady + ZOOM_PHASE_WEIGHTS.correction + ZOOM_PHASE_WEIGHTS.zoomout;
    expect(sum).toBeCloseTo(1.0);
  });

  it('microFlick 가중치 합 = 1.0', () => {
    const sum = MICRO_FLICK_WEIGHTS.tracking + MICRO_FLICK_WEIGHTS.flick + MICRO_FLICK_WEIGHTS.reacquire;
    expect(sum).toBeCloseTo(1.0);
  });

  it('flick 각도 버킷이 오름차순', () => {
    for (let i = 1; i < FLICK_ANGLE_BUCKETS.length; i++) {
      expect(FLICK_ANGLE_BUCKETS[i]).toBeGreaterThan(FLICK_ANGLE_BUCKETS[i - 1]);
    }
  });
});
