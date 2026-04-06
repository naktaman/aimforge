/**
 * ScenarioSelect 관련 타입 정의
 */
import type { BatteryPreset, StageType } from '../utils/types';

/** 시나리오 시작에 필요한 모든 파라미터 */
export interface ScenarioParams {
  targetSizeDeg: number;
  angleRange: [number, number];
  numTargets: number;
  timeout: number;
  targetSpeedDegPerSec: number;
  directionChanges: number;
  duration: number;
  trajectoryType: 'horizontal' | 'vertical' | 'mixed';
  orbitRadiusDeg: number;
  orbitSpeedDegPerSec: number;
  radiusVariation: number;
  speedVariation: number;
  distance: number;
  noiseSpeed: number;
  amplitudeDeg: number;
  stopTimeMs: number;
  strafeSpeedDegPerSec: number;
  switchFrequencyHz: number;
  flickAngleRange: [number, number];
}

/** 배터리 시작 파라미터 */
export interface BatteryParams {
  preset: BatteryPreset;
}

/** Training 시나리오 시작 파라미터 */
export interface TrainingStartParams {
  stageType: StageType;
}

/** 시나리오 파라미터 상태 — 22개 useState를 useReducer로 통합 */
export interface ScenarioParamsState {
  targetSize: number;
  numTargets: number;
  timeout: number;
  angleMin: number;
  angleMax: number;
  trackingSpeed: number;
  dirChanges: number;
  duration: number;
  trajectory: 'horizontal' | 'vertical' | 'mixed';
  orbitRadius: number;
  orbitSpeed: number;
  radiusVar: number;
  speedVar: number;
  distance: number;
  noiseSpeed: number;
  amplitude: number;
  stopTime: number;
  strafeSpeed: number;
  switchFreq: number;
  flickAngleMin: number;
  flickAngleMax: number;
  batteryPreset: BatteryPreset;
}

export type ParamsAction = { type: 'SET_FIELD'; field: keyof ScenarioParamsState; value: ScenarioParamsState[keyof ScenarioParamsState] };
