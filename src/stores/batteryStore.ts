/**
 * 배터리 플로우 상태 스토어
 * ScenarioBattery 인스턴스 관리, 시나리오 순차 진행, 메트릭 축적
 */
import { create } from 'zustand';
import { ScenarioBattery } from '../engine/scenarios/ScenarioBattery';
import type {
  BatteryPreset,
  BatteryResult,
  BatteryWeights,
  ScenarioType,
} from '../utils/types';

/** 배터리 모드에서 각 시나리오 표준 파라미터 (결과 비교 가능) */
export const BATTERY_SCENARIO_DEFAULTS: Record<string, Record<string, unknown>> = {
  flick: {
    targetSizeDeg: 3, angleRange: [10, 180], numTargets: 20, timeout: 3000,
  },
  tracking: {
    targetSizeDeg: 3, targetSpeedDegPerSec: 60, directionChanges: 6, duration: 15000, trajectoryType: 'mixed',
  },
  circular_tracking: {
    targetSizeDeg: 3, orbitRadiusDeg: 15, orbitSpeedDegPerSec: 45,
    radiusVariation: 0.2, speedVariation: 0.2, duration: 15000, distance: 10,
  },
  stochastic_tracking: {
    targetSizeDeg: 3, noiseSpeed: 1.5, amplitudeDeg: 20, duration: 15000, distance: 10,
  },
  counter_strafe_flick: {
    targetSizeDeg: 3, stopTimeMs: 200, strafeSpeedDegPerSec: 60,
    numTargets: 15, angleRange: [10, 120], timeout: 3000,
  },
  micro_flick: {
    targetSizeDeg: 3, switchFrequencyHz: 0.5, targetSpeedDegPerSec: 40,
    flickAngleRange: [5, 30], duration: 20000, distance: 10,
  },
  zoom_composite: {},
};

interface BatteryState {
  /** 배터리 활성 여부 */
  isActive: boolean;
  /** 배터리 인스턴스 */
  battery: ScenarioBattery | null;
  /** 선택된 프리셋 */
  preset: BatteryPreset;
  /** 세션 ID (DB) */
  sessionId: number | null;
  /** 현재 실행 중인 시나리오 */
  currentScenarioType: ScenarioType | null;
  /** 완료된 시나리오 점수 */
  completedScores: Partial<Record<ScenarioType, number>>;
  /** 시나리오별 raw 메트릭 (Aim DNA 산출용) */
  scenarioRawMetrics: Partial<Record<ScenarioType, unknown>>;
  /** 최종 배터리 결과 */
  batteryResult: BatteryResult | null;

  // Actions
  /** 배터리 시작 */
  startBattery: (preset: BatteryPreset, sessionId: number, customWeights?: BatteryWeights) => void;
  /** 다음 시나리오로 진행 — 타입 반환 (null이면 완료) */
  advanceNext: () => ScenarioType | null;
  /** 시나리오 완료 기록 */
  recordComplete: (type: ScenarioType, score: number, rawMetrics: unknown) => void;
  /** 배터리 완료 처리 — BatteryResult 반환 */
  finalizeBattery: () => BatteryResult | null;
  /** 초기화 */
  resetBattery: () => void;
}

export const useBatteryStore = create<BatteryState>((set, get) => ({
  isActive: false,
  battery: null,
  preset: 'TACTICAL',
  sessionId: null,
  currentScenarioType: null,
  completedScores: {},
  scenarioRawMetrics: {},
  batteryResult: null,

  startBattery: (preset, sessionId, customWeights) => {
    const battery = new ScenarioBattery(preset, customWeights);
    const first = battery.nextScenarioType();
    set({
      isActive: true,
      battery,
      preset,
      sessionId,
      currentScenarioType: first,
      completedScores: {},
      scenarioRawMetrics: {},
      batteryResult: null,
    });
  },

  advanceNext: () => {
    const { battery } = get();
    if (!battery) return null;
    const next = battery.nextScenarioType();
    set({ currentScenarioType: next });
    return next;
  },

  recordComplete: (type, score, rawMetrics) => {
    const { battery, completedScores, scenarioRawMetrics } = get();
    if (!battery) return;
    battery.recordScore(type, score);
    set({
      completedScores: { ...completedScores, [type]: score },
      scenarioRawMetrics: { ...scenarioRawMetrics, [type]: rawMetrics },
    });
  },

  finalizeBattery: () => {
    const { battery } = get();
    if (!battery || !battery.isComplete()) return null;
    const result = battery.getResults();
    set({ batteryResult: result, isActive: false, currentScenarioType: null });
    return result;
  },

  resetBattery: () =>
    set({
      isActive: false,
      battery: null,
      preset: 'TACTICAL',
      sessionId: null,
      currentScenarioType: null,
      completedScores: {},
      scenarioRawMetrics: {},
      batteryResult: null,
    }),
}));
