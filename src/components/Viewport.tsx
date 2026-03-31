/**
 * Three.js 뷰포트 컴포넌트
 * 캔버스를 호스팅하고 GameEngine 라이프사이클 관리
 */
import { useEffect, useRef } from 'react';
import { GameEngine } from '../engine/GameEngine';
import { useSettingsStore } from '../stores/settingsStore';
import { useEngineStore } from '../stores/engineStore';
import type { EngineConfig } from '../utils/types';

interface ViewportProps {
  /** 엔진 인스턴스를 외부에서 접근할 수 있도록 ref 전달 */
  onEngineReady?: (engine: GameEngine) => void;
}

export function Viewport({ onEngineReady }: ViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const { dpi, cmPer360, hfov } = useSettingsStore();
  const { setEngineReady, setPointerLocked, setFps } = useEngineStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 엔진 설정
    const config: EngineConfig = {
      dpi,
      cmPer360,
      hfov,
      aspectRatio: canvas.clientWidth / canvas.clientHeight,
    };

    // GameEngine 생성
    const engine = new GameEngine(canvas, config);
    engineRef.current = engine;

    // 콜백 설정
    engine.setOnFpsUpdate((fps) => setFps(fps));
    engine.setOnPointerLockStateChange((locked) => setPointerLocked(locked));

    // 엔진 시작
    engine.start().then(() => {
      setEngineReady(true);
      onEngineReady?.(engine);
    });

    // 클린업
    return () => {
      engine.dispose();
      engineRef.current = null;
      setEngineReady(false);
    };
    // 의존성: 마운트 시 한 번만 실행 (설정 변경은 엔진 메서드로 반영)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 설정 변경 시 엔진에 실시간 반영
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSensitivity(cmPer360);
    }
  }, [cmPer360]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setDpi(dpi);
    }
  }, [dpi]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setFov(hfov);
    }
  }, [hfov]);

  return (
    <div className="viewport-container">
      <canvas ref={canvasRef} className="viewport-canvas" />
      {/* 오버레이 (크로스헤어, 스코프) 는 여기 위에 배치 */}
    </div>
  );
}
