/**
 * 세션 스토어 (zustand)
 * 시나리오 실행 중 세션/트라이얼 상태 관리
 */
import { create } from 'zustand';
import type {
  FlickTrialMetrics,
  TrackingTrialMetrics,
  ZoomTrialMetrics,
  MicroFlickTrialMetrics,
  BatteryResult,
  ScenarioType,
} from '../utils/types';

/** 현재 활성 시나리오 타입 (null = 미실행) */
type ActiveScenario = ScenarioType | null;

interface SessionState {
  sessionId: number | null;
  scenarioType: ActiveScenario;
  isRunning: boolean;
  trialCount: number;

  // 최근 결과 — 시나리오별
  lastFlickResult: {
    overall: FlickTrialMetrics;
    byAngle: Record<number, FlickTrialMetrics>;
    byDirection: Record<string, FlickTrialMetrics>;
    byMotor: Record<string, FlickTrialMetrics>;
  } | null;
  lastTrackingResult: TrackingTrialMetrics | null;
  lastZoomResult: ZoomTrialMetrics | null;
  lastMicroFlickResult: MicroFlickTrialMetrics | null;
  lastBatteryResult: BatteryResult | null;

  // 액션
  setSessionId: (id: number | null) => void;
  startScenario: (type: ActiveScenario) => void;
  endScenario: () => void;
  setFlickResult: (result: SessionState['lastFlickResult']) => void;
  setTrackingResult: (result: TrackingTrialMetrics) => void;
  setZoomResult: (result: ZoomTrialMetrics) => void;
  setMicroFlickResult: (result: MicroFlickTrialMetrics) => void;
  setBatteryResult: (result: BatteryResult) => void;
  incrementTrialCount: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  scenarioType: null,
  isRunning: false,
  trialCount: 0,
  lastFlickResult: null,
  lastTrackingResult: null,
  lastZoomResult: null,
  lastMicroFlickResult: null,
  lastBatteryResult: null,

  setSessionId: (sessionId) => set({ sessionId }),
  startScenario: (scenarioType) => set({ scenarioType, isRunning: true }),
  endScenario: () => set({ isRunning: false }),
  setFlickResult: (lastFlickResult) => set({ lastFlickResult }),
  setTrackingResult: (lastTrackingResult) => set({ lastTrackingResult }),
  setZoomResult: (lastZoomResult) => set({ lastZoomResult }),
  setMicroFlickResult: (lastMicroFlickResult) => set({ lastMicroFlickResult }),
  setBatteryResult: (lastBatteryResult) => set({ lastBatteryResult }),
  incrementTrialCount: () => set((s) => ({ trialCount: s.trialCount + 1 })),
}));
