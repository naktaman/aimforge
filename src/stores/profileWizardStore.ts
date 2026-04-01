/**
 * 프로파일 위저드 스토어 (zustand)
 * 8단계 가이드 플로우 상태 관리:
 * Welcome → 게임 세팅 → 하드웨어 → 캘리브레이션 → 전체 점검 → 결과 분석 → 재테스트 → 완료
 */
import { create } from 'zustand';
import type { GamePreset, StageType, AimDnaProfile } from '../utils/types';

/** 위저드 단계 */
export type WizardStep =
  | 'welcome'
  | 'game-settings'
  | 'hardware'
  | 'calibration'
  | 'full-assessment'
  | 'analysis'
  | 'retest'
  | 'complete';

/** 단계 순서 배열 */
export const WIZARD_STEPS: WizardStep[] = [
  'welcome',
  'game-settings',
  'hardware',
  'calibration',
  'full-assessment',
  'analysis',
  'retest',
  'complete',
];

/** 전체 점검 시나리오 순서 */
export const ASSESSMENT_STAGES: StageType[] = [
  'flick_micro',
  'flick_medium',
  'flick_macro',
  'tracking_close',
  'tracking_mid',
  'tracking_long',
  'switching_close',
  'switching_wide',
];

/** 시나리오별 설명 */
export const STAGE_DESCRIPTIONS: Record<string, { name: string; description: string }> = {
  flick_micro: { name: 'Flick Micro', description: '5~15° 근거리 미세 에임 조정 능력을 측정합니다.' },
  flick_medium: { name: 'Flick Medium', description: '30~60° 중거리 플릭 정확도와 반응 속도를 측정합니다.' },
  flick_macro: { name: 'Flick Macro', description: '90~180° 대각도 에임 전환 능력을 측정합니다.' },
  tracking_close: { name: 'Tracking Close', description: '근거리 빠르게 움직이는 타겟 추적 능력을 측정합니다.' },
  tracking_mid: { name: 'Tracking Mid', description: '중거리 타겟 추적 정확도와 속도 매칭을 측정합니다.' },
  tracking_long: { name: 'Tracking Long', description: '원거리 느린 타겟의 정밀 추적 능력을 측정합니다.' },
  switching_close: { name: 'Switching Close', description: '15~45° 범위에서 타겟 간 빠른 전환 능력을 측정합니다.' },
  switching_wide: { name: 'Switching Wide', description: '60~150° 넓은 범위의 타겟 전환 능력을 측정합니다.' },
};

/** 게임별 감도 필드 정의 */
export interface GameSensField {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

/** 게임별 전용 감도 필드 */
export const GAME_SENS_FIELDS: Record<string, GameSensField[]> = {
  'Valorant': [
    { key: 'sensitivity', label: '감도', min: 0.01, max: 10, step: 0.001, defaultValue: 0.3 },
  ],
  'CS2': [
    { key: 'sensitivity', label: '감도', min: 0.01, max: 10, step: 0.01, defaultValue: 1.0 },
    { key: 'zoom_sensitivity_ratio', label: '줌 감도 비율', min: 0.1, max: 3, step: 0.01, defaultValue: 1.0 },
  ],
  'Apex Legends': [
    { key: 'sensitivity', label: '마우스 감도', min: 0.1, max: 20, step: 0.1, defaultValue: 3.0 },
    { key: 'ads_1x', label: 'ADS 1x 배율', min: 0.1, max: 5, step: 0.1, defaultValue: 1.0 },
    { key: 'ads_2x', label: 'ADS 2x 배율', min: 0.1, max: 5, step: 0.1, defaultValue: 1.0 },
    { key: 'ads_3x', label: 'ADS 3x 배율', min: 0.1, max: 5, step: 0.1, defaultValue: 1.0 },
    { key: 'ads_4x', label: 'ADS 4x~10x 배율', min: 0.1, max: 5, step: 0.1, defaultValue: 1.0 },
  ],
  'PUBG': [
    { key: 'sensitivity', label: '일반 감도', min: 1, max: 100, step: 1, defaultValue: 50 },
    { key: 'ads_sensitivity', label: '조준 (ADS)', min: 1, max: 100, step: 1, defaultValue: 50 },
    { key: 'scope_1x', label: '1배 조준경', min: 1, max: 100, step: 1, defaultValue: 50 },
    { key: 'scope_2x', label: '2배 조준경', min: 1, max: 100, step: 1, defaultValue: 50 },
    { key: 'scope_3x', label: '3배 조준경', min: 1, max: 100, step: 1, defaultValue: 50 },
    { key: 'scope_4x', label: '4배 조준경', min: 1, max: 100, step: 1, defaultValue: 50 },
    { key: 'scope_6x', label: '6배 조준경', min: 1, max: 100, step: 1, defaultValue: 50 },
    { key: 'scope_8x', label: '8배 조준경', min: 1, max: 100, step: 1, defaultValue: 50 },
    { key: 'scope_15x', label: '15배 조준경', min: 1, max: 100, step: 1, defaultValue: 50 },
    { key: 'freelook', label: '자유시점', min: 1, max: 100, step: 1, defaultValue: 50 },
  ],
  'Overwatch 2': [
    { key: 'sensitivity', label: '감도', min: 0.01, max: 100, step: 0.01, defaultValue: 5.0 },
    { key: 'zoom_sensitivity', label: '줌 감도', min: 1, max: 100, step: 1, defaultValue: 38 },
    { key: 'hero_specific', label: '영웅별 감도 (기본)', min: 0.01, max: 100, step: 0.01, defaultValue: 5.0 },
  ],
};

/** 게임별 yaw 값 (감도 변환용) */
export const GAME_YAW_VALUES: Record<string, number> = {
  'Valorant': 0.07,
  'CS2': 0.022,
  'Apex Legends': 0.022,
  'Overwatch 2': 0.0066,
  'PUBG': 0.002222,
};

/** 에임포지 내부 yaw */
export const AIMFORGE_YAW = 0.022;

/** 스테이지 점수 결과 */
export interface StageResult {
  stageType: StageType;
  score: number;
  accuracy?: number;
  rawMetrics?: unknown;
}

/** 감도 변환 결과 */
export interface SensConversion {
  gameName: string;
  yaw: number;
  convertedSens: number;
}

interface ProfileWizardState {
  /** 위저드 활성 여부 */
  isActive: boolean;
  /** 현재 단계 */
  currentStep: WizardStep;
  /** 현재 단계 인덱스 */
  currentStepIndex: number;

  /** 게임 세팅 */
  selectedGame: GamePreset | null;
  gameSensValues: Record<string, number>;

  /** 하드웨어 */
  dpi: number;
  monitorWidth: number;
  monitorHeight: number;
  refreshRate: number;

  /** 캘리브레이션 결과 */
  calibratedCm360: number | null;

  /** 전체 점검 */
  assessmentIndex: number;
  assessmentResults: StageResult[];
  assessmentRunning: boolean;

  /** 분석 결과 */
  aimDna: AimDnaProfile | null;
  suggestedCm360: number | null;

  /** 재테스트 */
  retestRound: number;
  weakStages: StageType[];
  retestResults: StageResult[];

  /** 완료 */
  finalCm360: number | null;
  sensConversions: SensConversion[];

  // === Actions ===
  /** 위저드 시작 */
  startWizard: () => void;
  /** 위저드 종료/리셋 */
  resetWizard: () => void;
  /** 다음 단계 */
  nextStep: () => void;
  /** 이전 단계 */
  prevStep: () => void;
  /** 특정 단계로 이동 */
  goToStep: (step: WizardStep) => void;

  /** 게임 선택 */
  setSelectedGame: (game: GamePreset) => void;
  /** 게임 감도 값 설정 */
  setGameSensValue: (key: string, value: number) => void;
  /** 하드웨어 설정 */
  setHardware: (dpi: number, width: number, height: number, refreshRate: number) => void;
  /** DPI만 설정 */
  setDpi: (dpi: number) => void;

  /** 캘리브레이션 완료 */
  setCalibrationResult: (cm360: number) => void;

  /** 점검 시나리오 완료 기록 */
  recordAssessmentResult: (result: StageResult) => void;
  /** 점검 시작 */
  startAssessment: () => void;
  /** 다음 시나리오로 진행 */
  advanceAssessment: () => void;

  /** 분석 결과 설정 */
  setAnalysisResult: (dna: AimDnaProfile, suggestedCm360: number | null) => void;

  /** 약한 스테이지 설정 + 재테스트 시작 */
  startRetest: (weakStages: StageType[]) => void;
  /** 재테스트 결과 기록 */
  recordRetestResult: (result: StageResult) => void;

  /** 최종 완료 */
  finalize: (cm360: number, conversions: SensConversion[]) => void;
}

export const useProfileWizardStore = create<ProfileWizardState>((set, get) => ({
  isActive: false,
  currentStep: 'welcome',
  currentStepIndex: 0,

  selectedGame: null,
  gameSensValues: {},

  dpi: 800,
  monitorWidth: 1920,
  monitorHeight: 1080,
  refreshRate: 144,

  calibratedCm360: null,

  assessmentIndex: 0,
  assessmentResults: [],
  assessmentRunning: false,

  aimDna: null,
  suggestedCm360: null,

  retestRound: 0,
  weakStages: [],
  retestResults: [],

  finalCm360: null,
  sensConversions: [],

  startWizard: () => set({
    isActive: true,
    currentStep: 'welcome',
    currentStepIndex: 0,
    selectedGame: null,
    gameSensValues: {},
    dpi: 800,
    monitorWidth: 1920,
    monitorHeight: 1080,
    refreshRate: 144,
    calibratedCm360: null,
    assessmentIndex: 0,
    assessmentResults: [],
    assessmentRunning: false,
    aimDna: null,
    suggestedCm360: null,
    retestRound: 0,
    weakStages: [],
    retestResults: [],
    finalCm360: null,
    sensConversions: [],
  }),

  resetWizard: () => set({
    isActive: false,
    currentStep: 'welcome',
    currentStepIndex: 0,
    selectedGame: null,
    gameSensValues: {},
    calibratedCm360: null,
    assessmentIndex: 0,
    assessmentResults: [],
    assessmentRunning: false,
    aimDna: null,
    suggestedCm360: null,
    retestRound: 0,
    weakStages: [],
    retestResults: [],
    finalCm360: null,
    sensConversions: [],
  }),

  nextStep: () => {
    const { currentStepIndex } = get();
    const next = Math.min(currentStepIndex + 1, WIZARD_STEPS.length - 1);
    set({ currentStep: WIZARD_STEPS[next], currentStepIndex: next });
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    const prev = Math.max(currentStepIndex - 1, 0);
    set({ currentStep: WIZARD_STEPS[prev], currentStepIndex: prev });
  },

  goToStep: (step) => {
    const idx = WIZARD_STEPS.indexOf(step);
    if (idx >= 0) set({ currentStep: step, currentStepIndex: idx });
  },

  setSelectedGame: (game) => {
    /** 게임 선택 시 기본 감도값 초기화 */
    const fields = GAME_SENS_FIELDS[game.name];
    const defaults: Record<string, number> = {};
    if (fields) {
      fields.forEach(f => { defaults[f.key] = f.defaultValue; });
    } else {
      defaults['sensitivity'] = 1.0;
    }
    set({ selectedGame: game, gameSensValues: defaults });
  },

  setGameSensValue: (key, value) => set(s => ({
    gameSensValues: { ...s.gameSensValues, [key]: value },
  })),

  setHardware: (dpi, width, height, refreshRate) => set({
    dpi, monitorWidth: width, monitorHeight: height, refreshRate,
  }),

  setDpi: (dpi) => set({ dpi }),

  setCalibrationResult: (cm360) => set({ calibratedCm360: cm360 }),

  startAssessment: () => set({
    assessmentIndex: 0,
    assessmentResults: [],
    assessmentRunning: true,
  }),

  recordAssessmentResult: (result) => set(s => ({
    assessmentResults: [...s.assessmentResults, result],
  })),

  advanceAssessment: () => {
    const { assessmentIndex } = get();
    const next = assessmentIndex + 1;
    if (next >= ASSESSMENT_STAGES.length) {
      set({ assessmentIndex: next, assessmentRunning: false });
    } else {
      set({ assessmentIndex: next });
    }
  },

  setAnalysisResult: (dna, suggestedCm360) => set({ aimDna: dna, suggestedCm360 }),

  startRetest: (weakStages) => set(s => ({
    weakStages,
    retestResults: [],
    retestRound: s.retestRound + 1,
  })),

  recordRetestResult: (result) => set(s => ({
    retestResults: [...s.retestResults, result],
  })),

  finalize: (cm360, conversions) => set({
    finalCm360: cm360,
    sensConversions: conversions,
  }),
}));
