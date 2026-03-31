/**
 * Pointer Lock API 래퍼
 * 마우스 커서 숨김 + 화면 가장자리 제한 해제
 * 실제 마우스 delta는 Rust WM_INPUT에서 가져오므로
 * 여기서는 커서 제어만 담당
 */

/** Pointer Lock 요청 */
export function requestPointerLock(canvas: HTMLCanvasElement): void {
  canvas.requestPointerLock();
}

/** Pointer Lock 해제 */
export function exitPointerLock(): void {
  document.exitPointerLock();
}

/** 현재 Pointer Lock 상태 */
export function isPointerLocked(): boolean {
  return document.pointerLockElement !== null;
}

/** Pointer Lock 상태 변경 콜백 등록 — 해제 함수 반환 */
export function onPointerLockChange(
  callback: (locked: boolean) => void,
): () => void {
  const handler = () => {
    callback(document.pointerLockElement !== null);
  };
  document.addEventListener('pointerlockchange', handler);
  return () => document.removeEventListener('pointerlockchange', handler);
}
