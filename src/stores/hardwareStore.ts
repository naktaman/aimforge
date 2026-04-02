/**
 * 하드웨어 콤보 비교 스토어
 * 콤보 CRUD, 비교 실행
 */
import { create } from 'zustand';
import { safeInvoke } from '../utils/ipc';
import type { HardwareComboRow, HardwareComparison } from '../utils/types';

interface HardwareState {
  /** 전체 하드웨어 콤보 목록 */
  combos: HardwareComboRow[];
  /** 비교 결과 */
  comparison: HardwareComparison | null;
  /** 로딩 상태 */
  isLoading: boolean;

  /** 콤보 목록 로드 */
  loadCombos: () => Promise<void>;
  /** 콤보 등록 */
  saveCombo: (params: {
    mouseModel: string;
    dpi: number;
    verifiedDpi?: number;
    pollingRate?: number;
    mousepadModel?: string;
  }) => Promise<number>;
  /** 콤보 수정 */
  updateCombo: (params: {
    id: number;
    mouseModel: string;
    dpi: number;
    verifiedDpi?: number;
    pollingRate?: number;
    mousepadModel?: string;
  }) => Promise<void>;
  /** 콤보 삭제 */
  deleteCombo: (id: number) => Promise<void>;
  /** 두 프로필의 하드웨어 비교 */
  compare: (profileAId: number, profileBId: number) => Promise<void>;
  /** 초기화 */
  clear: () => void;
}

export const useHardwareStore = create<HardwareState>((set) => ({
  combos: [],
  comparison: null,
  isLoading: false,

  loadCombos: async () => {
    const combos = await safeInvoke<HardwareComboRow[]>('get_hardware_combos');
    set({ combos: combos ?? [] });
  },

  saveCombo: async (params) => {
    const id = await safeInvoke<number>('save_hardware_combo', {
      params: {
        mouseModel: params.mouseModel,
        dpi: params.dpi,
        verifiedDpi: params.verifiedDpi ?? null,
        pollingRate: params.pollingRate ?? null,
        mousepadModel: params.mousepadModel ?? null,
      },
    });
    return id ?? 0;
  },

  updateCombo: async (params) => {
    await safeInvoke('update_hardware_combo', {
      params: {
        id: params.id,
        mouseModel: params.mouseModel,
        dpi: params.dpi,
        verifiedDpi: params.verifiedDpi ?? null,
        pollingRate: params.pollingRate ?? null,
        mousepadModel: params.mousepadModel ?? null,
      },
    });
  },

  deleteCombo: async (id) => {
    await safeInvoke('delete_hardware_combo', { params: { id } });
  },

  compare: async (profileAId, profileBId) => {
    set({ isLoading: true });
    const comparison = await safeInvoke<HardwareComparison>('compare_hardware_combos', {
      params: {
        profile_a_id: profileAId,
        profile_b_id: profileBId,
      },
    });
    set({ comparison: comparison ?? null, isLoading: false });
  },

  clear: () => set({ combos: [], comparison: null, isLoading: false }),
}));
