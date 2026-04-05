/**
 * Zustand 스토어 공통 헬퍼
 * invoke + isLoading 토글 + 에러 로깅 패턴 중복 제거
 */
import { invoke } from '@tauri-apps/api/core';
import type { StoreApi } from 'zustand';

type SetState<T> = StoreApi<T>['setState'];

/**
 * 로딩 상태 토글 + invoke + set 패턴 래퍼
 * @param set Zustand set 함수
 * @param command IPC 커맨드 이름
 * @param args 커맨드 파라미터
 * @param onSuccess 성공 시 state 업데이트 (invoke 결과 → Partial<S>)
 * @param label 에러 로그용 한글 라벨
 * @param withLoading true면 isLoading 상태 자동 토글 (기본 true)
 */
export async function storeInvoke<S extends { isLoading?: boolean }, T>(
  set: SetState<S>,
  command: string,
  args: Record<string, unknown> | undefined,
  onSuccess: (result: T) => Partial<S>,
  label: string,
  withLoading = true,
): Promise<void> {
  if (withLoading) set({ isLoading: true } as Partial<S>);
  try {
    const result = await invoke<T>(command, args);
    const updates = onSuccess(result);
    if (withLoading) {
      set({ ...updates, isLoading: false } as Partial<S>);
    } else {
      set(updates as Partial<S>);
    }
  } catch (e) {
    console.error(`${label} 실패:`, e);
    if (withLoading) set({ isLoading: false } as Partial<S>);
  }
}
