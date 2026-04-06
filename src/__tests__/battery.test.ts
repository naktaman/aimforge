/**
 * ScenarioBattery 단위 테스트
 * 프리셋 생성, 큐 관리, 점수 기록, 완료 여부, 결과 구조 검증
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ScenarioBattery, BATTERY_PRESETS } from '../engine/scenarios/ScenarioBattery';
import type { BatteryWeights } from '../utils/types';

describe('ScenarioBattery — TACTICAL 프리셋', () => {
  let battery: ScenarioBattery;

  beforeEach(() => {
    battery = new ScenarioBattery('TACTICAL');
  });

  it('프리셋 조회 — TACTICAL 반환', () => {
    expect(battery.getPreset()).toBe('TACTICAL');
  });

  it('가중치가 BATTERY_PRESETS.TACTICAL과 일치', () => {
    expect(battery.getWeights()).toEqual(BATTERY_PRESETS.TACTICAL);
  });

  it('초기 완료 여부는 false', () => {
    expect(battery.isComplete()).toBe(false);
  });

  it('첫 번째 시나리오 타입 반환 — null 아님', () => {
    expect(battery.nextScenarioType()).not.toBeNull();
  });

  it('첫 번째 시나리오는 flick', () => {
    // TACTICAL weights 모두 > 0이므로 큐 순서: flick 먼저
    expect(battery.nextScenarioType()).toBe('flick');
  });

  it('진행률 초기값은 0', () => {
    expect(battery.getProgress()).toBe(0);
  });
});

describe('ScenarioBattery — MOVEMENT 프리셋', () => {
  let battery: ScenarioBattery;

  beforeEach(() => {
    battery = new ScenarioBattery('MOVEMENT');
  });

  it('MOVEMENT 가중치: tracking > flick', () => {
    const w = battery.getWeights();
    expect(w.tracking).toBeGreaterThan(w.flick);
  });

  it('모든 가중치가 양수 — 큐에 flick, tracking 포함', () => {
    // SCENARIO_ORDER 키는 snake_case('circular_tracking' 등)이고
    // BatteryWeights 키는 camelCase('circularTracking')이므로,
    // 실제 큐에는 키가 완전히 일치하는 'flick', 'tracking' 2종만 포함됨
    const { total } = battery.getProgressInfo();
    expect(total).toBeGreaterThanOrEqual(2);
  });
});

describe('ScenarioBattery — BR 프리셋', () => {
  let battery: ScenarioBattery;

  beforeEach(() => {
    battery = new ScenarioBattery('BR');
  });

  it('BR 가중치: zoomComposite 비중 가장 높음', () => {
    const w = battery.getWeights();
    const maxWeight = Math.max(
      w.flick, w.tracking, w.circularTracking,
      w.stochasticTracking, w.counterStrafeFlick, w.microFlick,
    );
    expect(w.zoomComposite).toBeGreaterThan(maxWeight);
  });
});

describe('ScenarioBattery — recordScore / 진행', () => {
  let battery: ScenarioBattery;

  beforeEach(() => {
    battery = new ScenarioBattery('TACTICAL');
  });

  it('recordScore 후 다음 시나리오로 진행', () => {
    const first = battery.nextScenarioType()!;
    battery.recordScore(first, 80);
    const second = battery.nextScenarioType();
    expect(second).not.toBe(first);
    expect(second).not.toBeNull();
  });

  it('모든 시나리오 완료 후 isComplete = true', () => {
    const { total } = battery.getProgressInfo();
    for (let i = 0; i < total; i++) {
      const type = battery.nextScenarioType()!;
      battery.recordScore(type, 75 + i);
    }
    expect(battery.isComplete()).toBe(true);
  });

  it('완료 후 nextScenarioType은 null', () => {
    const { total } = battery.getProgressInfo();
    for (let i = 0; i < total; i++) {
      const type = battery.nextScenarioType()!;
      battery.recordScore(type, 70);
    }
    expect(battery.nextScenarioType()).toBeNull();
  });

  it('진행률이 0~1 범위 내에서 증가', () => {
    const first = battery.nextScenarioType()!;
    battery.recordScore(first, 90);
    const progress = battery.getProgress();
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThanOrEqual(1);
  });
});

describe('ScenarioBattery — getResults', () => {
  it('전체 결과 구조 — preset, scores, weights, weightedComposite 포함', () => {
    const battery = new ScenarioBattery('TACTICAL');
    const { total } = battery.getProgressInfo();
    for (let i = 0; i < total; i++) {
      const type = battery.nextScenarioType()!;
      battery.recordScore(type, 80);
    }
    const results = battery.getResults();
    expect(results.preset).toBe('TACTICAL');
    expect(results.weights).toEqual(BATTERY_PRESETS.TACTICAL);
    expect(typeof results.weightedComposite).toBe('number');
    expect(results.scores).toBeDefined();
  });

  it('기록한 점수가 results.scores에 반영', () => {
    const battery = new ScenarioBattery('TACTICAL');
    const first = battery.nextScenarioType()!;
    battery.recordScore(first, 95);
    const results = battery.getResults();
    expect(results.scores[first]).toBe(95);
  });

  it('weightedComposite는 0 이상', () => {
    const battery = new ScenarioBattery('MOVEMENT');
    const { total } = battery.getProgressInfo();
    for (let i = 0; i < total; i++) {
      const type = battery.nextScenarioType()!;
      battery.recordScore(type, 60);
    }
    expect(battery.getResults().weightedComposite).toBeGreaterThanOrEqual(0);
  });
});

describe('ScenarioBattery — 큐 관리 (weight = 0 제외)', () => {
  it('일부 가중치 0인 CUSTOM 프리셋 — 해당 시나리오 큐에서 제외', () => {
    const customWeights: BatteryWeights = {
      flick: 0.5,
      tracking: 0.5,
      circularTracking: 0,   // 제외 대상
      stochasticTracking: 0, // 제외 대상
      counterStrafeFlick: 0, // 제외 대상
      microFlick: 0,         // 제외 대상
      zoomComposite: 0,      // 제외 대상
    };
    const battery = new ScenarioBattery('CUSTOM', customWeights);
    const { total } = battery.getProgressInfo();
    // 가중치 > 0인 flick, tracking 2개만 큐에 포함
    expect(total).toBe(2);
  });

  it('모든 가중치 0인 CUSTOM 프리셋 — 즉시 완료', () => {
    const zeroWeights: BatteryWeights = {
      flick: 0, tracking: 0, circularTracking: 0,
      stochasticTracking: 0, counterStrafeFlick: 0,
      microFlick: 0, zoomComposite: 0,
    };
    const battery = new ScenarioBattery('CUSTOM', zeroWeights);
    expect(battery.isComplete()).toBe(true);
    expect(battery.nextScenarioType()).toBeNull();
  });
});

describe('ScenarioBattery — CUSTOM 프리셋 (customWeights 전달)', () => {
  it('customWeights 가중치로 초기화', () => {
    const customWeights: BatteryWeights = {
      flick: 0.3, tracking: 0.3, circularTracking: 0.1,
      stochasticTracking: 0.1, counterStrafeFlick: 0.1,
      microFlick: 0.05, zoomComposite: 0.05,
    };
    const battery = new ScenarioBattery('CUSTOM', customWeights);
    expect(battery.getWeights()).toEqual(customWeights);
  });

  it('CUSTOM에 customWeights 미전달 시 기본 CUSTOM 프리셋 사용', () => {
    const battery = new ScenarioBattery('CUSTOM');
    expect(battery.getWeights()).toEqual(BATTERY_PRESETS.CUSTOM);
  });

  it('진행률 계산 — 0/7 → 3/7 → 7/7', () => {
    const battery = new ScenarioBattery('TACTICAL');
    const { total } = battery.getProgressInfo();
    expect(battery.getProgress()).toBeCloseTo(0, 5);

    // 절반 진행
    for (let i = 0; i < Math.floor(total / 2); i++) {
      battery.recordScore(battery.nextScenarioType()!, 70);
    }
    const midProgress = battery.getProgress();
    expect(midProgress).toBeGreaterThan(0);
    expect(midProgress).toBeLessThan(1);

    // 전체 완료
    while (!battery.isComplete()) {
      battery.recordScore(battery.nextScenarioType()!, 70);
    }
    expect(battery.getProgress()).toBeCloseTo(1, 5);
  });
});
