/**
 * 퍼포먼스 오버레이 — FPS, frame time, input latency 실시간 표시
 * F3 키로 토글, 좌상단 반투명 HUD
 */
import { useEffect, useCallback } from 'react';
import { useEngineStore } from '../../stores/engineStore';

export function PerformanceOverlay() {
  const { perfOverlayVisible, togglePerfOverlay, perfData } = useEngineStore();

  // F3 토글 핸들러
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'F3') {
      e.preventDefault();
      togglePerfOverlay();
    }
  }, [togglePerfOverlay]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!perfOverlayVisible || !perfData) return null;

  const { fps, frameTimeMs, inputLatencyUs, geometries, textures } = perfData;

  return (
    <div className="perf-overlay">
      <div>FPS: {fps}</div>
      <div>Frame: {frameTimeMs.toFixed(2)}ms</div>
      <div>Input: {Math.round(inputLatencyUs)}µs</div>
      <div>Geo: {geometries} | Tex: {textures}</div>
    </div>
  );
}
