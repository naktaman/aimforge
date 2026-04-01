/**
 * 커스텀 루틴 스토어 (zustand)
 * 시나리오 순서 구성, 저장/로드, 원클릭 실행
 * Rust SQLite routines, routine_steps 테이블과 동기화
 */
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { useToastStore } from './toastStore';

/** 루틴 스텝 */
export interface RoutineStep {
  id: number;
  routineId: number;
  scenarioType: string;
  config: string;
  durationSec: number;
  stepOrder: number;
}

/** 루틴 */
export interface Routine {
  id: number;
  name: string;
  description: string;
  totalDurationSec: number;
  createdAt: string;
}

/** Rust row 타입 */
interface RoutineRow {
  id: number;
  name: string;
  description: string;
  total_duration_sec: number;
  created_at: string;
}

interface RoutineStepRow {
  id: number;
  routine_id: number;
  scenario_type: string;
  config_json: string;
  duration_sec: number;
  step_order: number;
}

interface RoutineState {
  routines: Routine[];
  currentSteps: RoutineStep[];
  loading: boolean;

  /** 루틴 목록 로드 */
  loadRoutines: () => Promise<void>;
  /** 루틴 생성 */
  createRoutine: (name: string, description: string) => Promise<number | null>;
  /** 루틴 삭제 */
  deleteRoutine: (id: number) => Promise<void>;
  /** 루틴 스텝 로드 */
  loadSteps: (routineId: number) => Promise<void>;
  /** 스텝 추가 */
  addStep: (routineId: number, scenarioType: string, configJson: string, durationSec: number, stepOrder: number) => Promise<void>;
  /** 스텝 삭제 */
  removeStep: (stepId: number, routineId: number) => Promise<void>;
  /** 두 스텝 순서 교환 */
  swapStepOrder: (routineId: number, stepIdA: number, stepIdB: number) => Promise<void>;
}

function toRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    totalDurationSec: row.total_duration_sec,
    createdAt: row.created_at,
  };
}

function toStep(row: RoutineStepRow): RoutineStep {
  return {
    id: row.id,
    routineId: row.routine_id,
    scenarioType: row.scenario_type,
    config: row.config_json,
    durationSec: row.duration_sec,
    stepOrder: row.step_order,
  };
}

export const useRoutineStore = create<RoutineState>((set) => ({
  routines: [],
  currentSteps: [],
  loading: false,

  loadRoutines: async () => {
    set({ loading: true });
    try {
      const rows = await invoke<RoutineRow[]>('get_routines');
      set({ routines: rows.map(toRoutine) });
    } catch (e) {
      console.error('[Routine] 로드 실패:', e);
    } finally {
      set({ loading: false });
    }
  },

  createRoutine: async (name, description) => {
    try {
      const id = await invoke<number>('create_routine', { name, description });
      const rows = await invoke<RoutineRow[]>('get_routines');
      set({ routines: rows.map(toRoutine) });
      return id;
    } catch (e) {
      console.error('[Routine] 생성 실패:', e);
      useToastStore.getState().addToast('루틴 생성 실패', 'error');
      return null;
    }
  },

  deleteRoutine: async (id) => {
    try {
      await invoke('delete_routine', { id });
      set((s) => ({ routines: s.routines.filter(r => r.id !== id) }));
    } catch (e) {
      console.error('[Routine] 삭제 실패:', e);
      useToastStore.getState().addToast('루틴 삭제 실패', 'error');
    }
  },

  loadSteps: async (routineId) => {
    try {
      const rows = await invoke<RoutineStepRow[]>('get_routine_steps', { routineId });
      set({ currentSteps: rows.map(toStep) });
    } catch (e) {
      console.error('[Routine] 스텝 로드 실패:', e);
      useToastStore.getState().addToast('루틴 스텝 로드 실패', 'error');
    }
  },

  addStep: async (routineId, scenarioType, configJson, durationSec, stepOrder) => {
    try {
      await invoke('add_routine_step', {
        routineId, scenarioType, configJson, durationSec, stepOrder,
      });
      // 스텝 재로드
      const rows = await invoke<RoutineStepRow[]>('get_routine_steps', { routineId });
      set({ currentSteps: rows.map(toStep) });
    } catch (e) {
      console.error('[Routine] 스텝 추가 실패:', e);
      useToastStore.getState().addToast('스텝 추가 실패', 'error');
    }
  },

  removeStep: async (stepId, routineId) => {
    try {
      await invoke('remove_routine_step', { stepId, routineId });
      const rows = await invoke<RoutineStepRow[]>('get_routine_steps', { routineId });
      set({ currentSteps: rows.map(toStep) });
    } catch (e) {
      console.error('[Routine] 스텝 삭제 실패:', e);
      useToastStore.getState().addToast('스텝 삭제 실패', 'error');
    }
  },

  swapStepOrder: async (routineId, stepIdA, stepIdB) => {
    try {
      await invoke('swap_routine_step_order', { stepIdA, stepIdB, routineId });
      const rows = await invoke<RoutineStepRow[]>('get_routine_steps', { routineId });
      set({ currentSteps: rows.map(toStep) });
    } catch (e) {
      console.error('[Routine] 스텝 순서 교환 실패:', e);
      useToastStore.getState().addToast('스텝 순서 변경 실패', 'error');
    }
  },
}));
