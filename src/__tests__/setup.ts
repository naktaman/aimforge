/**
 * Vitest 테스트 환경 설정
 * happy-dom 환경 + Tauri IPC 모킹
 */
import { vi } from 'vitest';
import '@testing-library/jest-dom';

/** Tauri invoke 모킹 — 실제 IPC 없이 테스트 가능 */
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

/** Tauri window 모킹 */
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    close: vi.fn(),
    setFullscreen: vi.fn(),
    isFullscreen: vi.fn().mockResolvedValue(false),
  }),
}));

/** AudioContext 모킹 — SoundEngine 용 */
globalThis.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: vi.fn().mockReturnValue({
    connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
    frequency: { value: 0 }, type: 'sine',
  }),
  createGain: vi.fn().mockReturnValue({
    connect: vi.fn(),
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
  }),
  destination: {},
  currentTime: 0,
})) as any;

/** requestPointerLock 모킹 */
if (typeof document !== 'undefined') {
  document.exitPointerLock = vi.fn();
}
