/**
 * 시나리오 파라미터 리듀서 훅
 */
import { useReducer } from 'react';
import type { ScenarioParamsState, ParamsAction } from '../types/scenarioSelect';
import { initialParamsState } from '../config/scenarioConstants';

/** 시나리오 파라미터 리듀서 — 단일 SET_FIELD 액션으로 모든 필드 갱신 */
export function paramsReducer(state: ScenarioParamsState, action: ParamsAction): ScenarioParamsState {
  if (action.type === 'SET_FIELD') return { ...state, [action.field]: action.value };
  return state;
}

/** 시나리오 파라미터 커스텀 훅 */
export function useScenarioParams() {
  const [params, dispatch] = useReducer(paramsReducer, initialParamsState);

  /** 파라미터 필드 갱신 헬퍼 */
  const setParam = <K extends keyof ScenarioParamsState>(field: K, value: ScenarioParamsState[K]) =>
    dispatch({ type: 'SET_FIELD', field, value });

  return { params, setParam };
}
