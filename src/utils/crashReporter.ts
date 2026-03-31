/**
 * 크래시 리포터 — 로컬 SQLite 저장 + 서버 전송 (옵트인)
 * ErrorBoundary, window.onerror, WebGL contextlost에서 호출
 */
import { invoke } from '@tauri-apps/api/core';

/** 크래시 로그를 로컬 SQLite에 저장 */
export async function logCrash(
  errorType: string,
  errorMessage: string,
  stackTrace?: string,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    await invoke('log_crash', {
      params: {
        error_type: errorType,
        error_message: errorMessage,
        stack_trace: stackTrace ?? null,
        context: JSON.stringify(context ?? {}),
        app_version: '0.1.0',
      },
    });
  } catch (e) {
    // 크래시 리포팅 자체가 실패하면 콘솔에만 기록
    console.error('[CrashReporter] 로그 저장 실패:', e);
  }
}

/** 전역 에러 핸들러 등록 (main.tsx에서 호출) */
export function installGlobalErrorHandlers(): void {
  // 동기 에러
  window.addEventListener('error', (event) => {
    logCrash(
      'uncaught_error',
      event.message,
      event.error?.stack,
      { filename: event.filename, lineno: event.lineno, colno: event.colno },
    );
  });

  // Promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    logCrash(
      'unhandled_rejection',
      reason?.message ?? String(reason),
      reason?.stack,
    );
  });
}
