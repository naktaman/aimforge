/**
 * 커스텀 루틴 스토어 (zustand)
 * 시나리오 순서 구성, 저장/로드, 원클릭 실행
 * Rust SQLite routines, routine_steps 테이블과 동기화
 */
import { create } from 'zustand';
import { storeInvoke } from './storeHelpers';
import { safeInvoke } from '../utils/ipc';

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
  totalDurationSec: number;
  createdAt: string;
}

interface RoutineStepRow {
  id: number;
  routineId: number;
  scenarioType: string;
  configJson: string;
  durationSec: number;
  stepOrder: number;
}

interface RoutineState {
  routines: Routine[];
  currentSteps: RoutineStep[];
  isLoading: boolean;

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
    totalDurationSec: row.totalDurationSec,
    createdAt: row.createdAt,
  };
}

function toStep(row: RoutineStepRow): RoutineStep {
  return {
    id: row.id,
    routineId: row.routineId,
    scenarioType: row.scenarioType,
    config: row.configJson,
    durationSec: row.durationSec,
    stepOrder: row.stepOrder,
  };
}

export const useRoutineStore = create<RoutineState>((set) => ({
  routines: [],
  currentSteps: [],
  isLoading: false,

  /** 루틴 목록 로드 — storeInvoke로 로딩 상태 자동 관리 */
  loadRoutines: () =>
    storeInvoke<RoutineState, RoutineRow[]>(
      set, 'get_routines', undefined,
      (rows) => ({ routines: rows.map(toRoutine) }),
      '루틴 목록 로드',
    ),

  /** 생성 후 목록 재로드 — safeInvoke로 mutation 후 id 반환 */
  createRoutine: async (name, description) => {
    const id = await safeInvoke<number>('create_routine', { name, description });
    if (id !== null) {
      await storeInvoke<RoutineState, RoutineRow[]>(
        set, 'get_routines', undefined,
        (rows) => ({ routines: rows.map(toRoutine) }),
        '루틴 목록 재로드',
        false,
      );
    }
    return id;
  },

  /** 삭제 — 성공 시 로컬 상태에서 즉시 제거 */
  deleteRoutine: async (id) => {
    const ok = await safeInvoke('delete_routine', { id });
    if (ok !== null) {
      set((s) => ({ routines: s.routines.filter(r => r.id !== id) }));
    }
  },

  /** 스텝 로드 — 로딩 없이 조용히 로드 */
  loadSteps: (routineId) =>
    storeInvoke<RoutineState, RoutineStepRow[]>(
      set, 'get_routine_steps', { routineId },
      (rows) => ({ currentSteps: rows.map(toStep) }),
      '루틴 스텝 로드',
      false,
    ),

  /** 스텝 추가 후 재로드 */
  addStep: async (routineId, scenarioType, configJson, durationSec, stepOrder) => {
    const ok = await safeInvoke('add_routine_step', {
      routineId, scenarioType, configJson, durationSec, stepOrder,
    });
    if (ok !== null) {
      await storeInvoke<RoutineState, RoutineStepRow[]>(
        set, 'get_routine_steps', { routineId },
        (rows) => ({ currentSteps: rows.map(toStep) }),
        '루틴 스텝 재로드',
        false,
      );
    }
  },

  /** 스텝 삭제 후 재로드 */
  removeStep: async (stepId, routineId) => {
    const ok = await safeInvoke('remove_routine_step', { stepId, routineId });
    if (ok !== null) {
      await storeInvoke<RoutineState, RoutineStepRow[]>(
        set, 'get_routine_steps', { routineId },
        (rows) => ({ currentSteps: rows.map(toStep) }),
        '루틴 스텝 재로드',
        false,
      );
    }
  },

  /** 스텝 순서 교환 후 재로드 */
  swapStepOrder: async (routineId, stepIdA, stepIdB) => {
    const ok = await safeInvoke('swap_routine_step_order', { stepIdA, stepIdB, routineId });
    if (ok !== null) {
      await storeInvoke<RoutineState, RoutineStepRow[]>(
        set, 'get_routine_steps', { routineId },
        (rows) => ({ currentSteps: rows.map(toStep) }),
        '루틴 스텝 재로드',
        false,
      );
    }
  },
}));
