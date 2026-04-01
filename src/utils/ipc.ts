/**
 * 안전한 Tauri IPC 호출 래퍼
 * try-catch + 에러 토스트 자동 표시
 */
import { invoke } from '@tauri-apps/api/core';
import { useToastStore } from '../stores/toastStore';

/**
 * invoke()를 래핑하여 에러 시 토스트 알림 + console.error
 * @param command IPC 커맨드 이름
 * @param args 커맨드 파라미터
 * @param silent true면 에러 토스트 표시하지 않음
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
  silent = false,
): Promise<T | null> {
  try {
    return await invoke<T>(command, args);
  } catch (e) {
    const msg = typeof e === 'string' ? e : (e as Error).message ?? String(e);
    console.error(`[IPC] ${command} 실패:`, msg);
    if (!silent) {
      useToastStore.getState().addToast(`${command} 실패: ${msg}`, 'error');
    }
    return null;
  }
}
