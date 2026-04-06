/**
 * Zustand 스토어 단위 테스트
 * 초기 상태, 액션, 상태 전이 검증
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEngineStore } from '../stores/engineStore';
import { useUiStore } from '../stores/uiStore';
import { useBatteryStore } from '../stores/batteryStore';
import { useSessionStore } from '../stores/sessionStore';
import { useCalibrationStore } from '../stores/calibrationStore';
import { useToastStore } from '../stores/toastStore';

describe('engineStore', () => {
  beforeEach(() => {
    useEngineStore.setState(useEngineStore.getInitialState());
  });

  it('초기 화면은 splash', () => {
    expect(useEngineStore.getState().currentScreen).toBe('splash');
  });

  it('setScreen으로 화면 전환', () => {
    useEngineStore.getState().setScreen('settings');
    expect(useEngineStore.getState().currentScreen).toBe('settings');
  });

  it('setFps로 FPS 업데이트', () => {
    useEngineStore.getState().setFps(144);
    expect(useEngineStore.getState().fps).toBe(144);
  });

  it('setFireMode로 발사 모드 변경', () => {
    useEngineStore.getState().setFireMode('burst');
    expect(useEngineStore.getState().fireMode).toBe('burst');
  });

  it('toggleRecoil로 반동 토글', () => {
    const before = useEngineStore.getState().recoilEnabled;
    useEngineStore.getState().toggleRecoil();
    expect(useEngineStore.getState().recoilEnabled).toBe(!before);
  });
});

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  it('초기 모드는 simple', () => {
    expect(useUiStore.getState().mode).toBe('simple');
  });

  it('toggleMode로 simple ↔ advanced 전환', () => {
    useUiStore.getState().toggleMode();
    expect(useUiStore.getState().mode).toBe('advanced');
    useUiStore.getState().toggleMode();
    expect(useUiStore.getState().mode).toBe('simple');
  });

  it('completeOnboarding 플래그 설정', () => {
    expect(useUiStore.getState().onboardingCompleted).toBe(false);
    useUiStore.getState().completeOnboarding();
    expect(useUiStore.getState().onboardingCompleted).toBe(true);
  });

  it('setLocale로 언어 변경', () => {
    useUiStore.getState().setLocale('en');
    expect(useUiStore.getState().locale).toBe('en');
  });
});

describe('batteryStore', () => {
  beforeEach(() => {
    useBatteryStore.getState().resetBattery();
  });

  it('초기 상태: 비활성', () => {
    const state = useBatteryStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.sessionId).toBeNull();
    expect(state.currentScenarioType).toBeNull();
  });

  it('startBattery로 배터리 시작', () => {
    useBatteryStore.getState().startBattery('TACTICAL', 42);
    const state = useBatteryStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.sessionId).toBe(42);
    expect(state.preset).toBe('TACTICAL');
    expect(state.currentScenarioType).not.toBeNull();
  });

  it('recordComplete로 점수 기록', () => {
    useBatteryStore.getState().startBattery('TACTICAL', 1);
    const first = useBatteryStore.getState().currentScenarioType!;
    useBatteryStore.getState().recordComplete(first, 85, {});
    expect(useBatteryStore.getState().completedScores[first]).toBe(85);
  });

  it('resetBattery로 초기화', () => {
    useBatteryStore.getState().startBattery('TACTICAL', 1);
    useBatteryStore.getState().resetBattery();
    expect(useBatteryStore.getState().isActive).toBe(false);
    expect(useBatteryStore.getState().currentScenarioType).toBeNull();
  });
});

describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().resetSession();
  });

  it('startScenario로 시나리오 활성화', () => {
    useSessionStore.getState().startScenario('flick');
    expect(useSessionStore.getState().scenarioType).toBe('flick');
    expect(useSessionStore.getState().isRunning).toBe(true);
  });

  it('endScenario로 시나리오 종료', () => {
    useSessionStore.getState().startScenario('flick');
    useSessionStore.getState().endScenario();
    expect(useSessionStore.getState().isRunning).toBe(false);
  });
});

describe('calibrationStore', () => {
  beforeEach(() => {
    useCalibrationStore.getState().resetCalibration();
  });

  it('초기 상태: 비활성', () => {
    const state = useCalibrationStore.getState();
    expect(state.isCalibrating).toBe(false);
    expect(state.stage).toBeNull();
  });

  it('startCalibration으로 캘리브레이션 시작', () => {
    useCalibrationStore.getState().startCalibration('explore', 123, 'quick');
    const state = useCalibrationStore.getState();
    expect(state.isCalibrating).toBe(true);
    expect(state.stage).toBe('screening');
    expect(state.sessionId).toBe(123);
    expect(state.mode).toBe('explore');
    expect(state.convergenceLevel).toBe('quick');
  });
});

describe('toastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('addToast로 토스트 추가', () => {
    useToastStore.getState().addToast('테스트 메시지', 'info');
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].message).toBe('테스트 메시지');
    expect(useToastStore.getState().toasts[0].type).toBe('info');
  });

  it('removeToast로 토스트 제거', () => {
    useToastStore.getState().addToast('삭제 대상', 'error');
    const id = useToastStore.getState().toasts[0].id;
    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
