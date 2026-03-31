/**
 * 시나리오 배터리 시스템
 * 게임 카테고리별 프리셋 가중치 + 시나리오 큐 관리
 * TACTICAL / MOVEMENT / BR / CUSTOM 프리셋 제공
 * 각 시나리오 점수를 가중 합산하여 battery_score 계산
 */
import { calculateBatteryScore } from '../metrics/CompositeScore';
import type {
  BatteryPreset,
  BatteryWeights,
  BatteryResult,
  ScenarioType,
} from '../../utils/types';

/** 프리셋별 시나리오 가중치 정의 */
export const BATTERY_PRESETS: Record<BatteryPreset, BatteryWeights> = {
  // 택티컬: CS2, Valorant, R6 등 — 플릭 + 카운터스트레이프 비중 높음
  TACTICAL: {
    flick: 0.25,
    tracking: 0.10,
    circular_tracking: 0.05,
    stochastic_tracking: 0.05,
    counter_strafe_flick: 0.25,
    micro_flick: 0.15,
    zoom_composite: 0.15,
  },
  // 무브먼트: Apex, OW2, Finals — 트래킹 + 마이크로플릭 비중 높음
  MOVEMENT: {
    flick: 0.10,
    tracking: 0.15,
    circular_tracking: 0.15,
    stochastic_tracking: 0.15,
    counter_strafe_flick: 0.10,
    micro_flick: 0.20,
    zoom_composite: 0.15,
  },
  // 배틀로얄: Fortnite, PUBG, Apex — 줌 비중 가장 높음
  BR: {
    flick: 0.15,
    tracking: 0.10,
    circular_tracking: 0.05,
    stochastic_tracking: 0.10,
    counter_strafe_flick: 0.10,
    micro_flick: 0.15,
    zoom_composite: 0.35,
  },
  // 커스텀: 기본 균등 분배 (유저가 슬라이더로 조절)
  CUSTOM: {
    flick: 0.15,
    tracking: 0.15,
    circular_tracking: 0.10,
    stochastic_tracking: 0.10,
    counter_strafe_flick: 0.15,
    micro_flick: 0.15,
    zoom_composite: 0.20,
  },
};

/** 배터리에서 실행할 시나리오 순서 */
const SCENARIO_ORDER: ScenarioType[] = [
  'flick',
  'tracking',
  'circular_tracking',
  'stochastic_tracking',
  'counter_strafe_flick',
  'micro_flick',
  'zoom_composite',
];

export class ScenarioBattery {
  private preset: BatteryPreset;
  private weights: BatteryWeights;
  private scores: Partial<Record<ScenarioType, number>> = {};
  private queue: ScenarioType[];
  private currentIndex = 0;

  constructor(preset: BatteryPreset, customWeights?: BatteryWeights) {
    this.preset = preset;
    this.weights =
      preset === 'CUSTOM' && customWeights
        ? customWeights
        : BATTERY_PRESETS[preset];

    // 가중치 > 0인 시나리오만 큐에 추가
    this.queue = SCENARIO_ORDER.filter(
      (type) => (this.weights[type as keyof BatteryWeights] ?? 0) > 0,
    );
  }

  /** 다음 실행할 시나리오 타입 반환 (없으면 null = 배터리 완료) */
  nextScenarioType(): ScenarioType | null {
    if (this.currentIndex >= this.queue.length) return null;
    return this.queue[this.currentIndex];
  }

  /** 현재 시나리오 점수 기록 후 다음으로 진행 */
  recordScore(type: ScenarioType, score: number): void {
    this.scores[type] = score;
    this.currentIndex++;
  }

  /** 배터리 완료 여부 */
  isComplete(): boolean {
    return this.currentIndex >= this.queue.length;
  }

  /** 배터리 복합 점수 계산 */
  computeBatteryScore(): number {
    return calculateBatteryScore(this.scores, this.weights);
  }

  /** 전체 결과 반환 */
  getResults(): BatteryResult {
    return {
      preset: this.preset,
      scores: { ...this.scores },
      weightedComposite: this.computeBatteryScore(),
      weights: { ...this.weights },
    };
  }

  /** 진행률 (0~1) */
  getProgress(): number {
    return this.queue.length > 0
      ? this.currentIndex / this.queue.length
      : 1;
  }

  /** 현재 시나리오 인덱스 / 전체 수 */
  getProgressInfo(): { current: number; total: number } {
    return { current: this.currentIndex, total: this.queue.length };
  }

  /** 사용 가중치 조회 */
  getWeights(): BatteryWeights {
    return { ...this.weights };
  }

  /** 프리셋 조회 */
  getPreset(): BatteryPreset {
    return this.preset;
  }
}
