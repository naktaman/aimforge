/**
 * IPC 래퍼 + storeInvoke 헬퍼 단위 테스트
 * 에러 처리, 로딩 상태 관리 검증
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { safeInvoke } from '../utils/ipc';
import { storeInvoke } from '../stores/storeHelpers';

/** invoke 모킹은 setup.ts에서 전역 설정 */
const mockedInvoke = vi.mocked(invoke);

describe('safeInvoke', () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it('성공 시 결과 반환', async () => {
    mockedInvoke.mockResolvedValueOnce({ id: 1, name: 'test' });
    const result = await safeInvoke<{ id: number; name: string }>('test_command');
    expect(result).toEqual({ id: 1, name: 'test' });
    expect(mockedInvoke).toHaveBeenCalledWith('test_command', undefined);
  });

  it('실패 시 null 반환 + 에러 로깅', async () => {
    mockedInvoke.mockRejectedValueOnce(new Error('DB 연결 실패'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await safeInvoke('failing_command', undefined, true);
    expect(result).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('args 전달 확인', async () => {
    mockedInvoke.mockResolvedValueOnce(42);
    await safeInvoke('cmd', { params: { id: 1 } });
    expect(mockedInvoke).toHaveBeenCalledWith('cmd', { params: { id: 1 } });
  });
});

describe('storeInvoke', () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it('성공 시 onSuccess 콜백으로 상태 업데이트', async () => {
    mockedInvoke.mockResolvedValueOnce([1, 2, 3]);
    const setState = vi.fn();

    await storeInvoke<{ isLoading: boolean; items: number[] }, number[]>(
      setState,
      'get_items',
      undefined,
      (items) => ({ items }),
      '아이템 로드',
    );

    expect(setState).toHaveBeenCalledTimes(2); // isLoading=true, then { items, isLoading=false }
    expect(setState).toHaveBeenCalledWith({ isLoading: true });
    expect(setState).toHaveBeenCalledWith({ items: [1, 2, 3], isLoading: false });
  });

  it('실패 시 isLoading=false로 복원', async () => {
    mockedInvoke.mockRejectedValueOnce(new Error('실패'));
    const setState = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await storeInvoke<{ isLoading: boolean }, any>(
      setState,
      'failing_cmd',
      undefined,
      () => ({}),
      '실패 테스트',
    );

    expect(setState).toHaveBeenCalledWith({ isLoading: true });
    expect(setState).toHaveBeenCalledWith({ isLoading: false });
    spy.mockRestore();
  });

  it('withLoading=false면 isLoading 토글 없음', async () => {
    mockedInvoke.mockResolvedValueOnce('ok');
    const setState = vi.fn();

    await storeInvoke<{ isLoading: boolean }, string>(
      setState,
      'cmd',
      undefined,
      (r) => ({ lastResult: r } as any),
      '테스트',
      false,
    );

    expect(setState).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledWith({ lastResult: 'ok' });
  });
});
