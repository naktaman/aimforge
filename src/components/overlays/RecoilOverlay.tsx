/**
 * 반동 패턴 시각화 오버레이 (디버그/훈련용)
 * - 현재 반동 위치 (빨간 점)
 * - 이상적 보정 경로 (반투명 선)
 * - 발사 인덱스 표시
 *
 * z-index: 26 (Crosshair 20, FireMode 25 위, GameHUD 28 아래)
 */
import { useState, useEffect, useRef, type ReactElement } from 'react';
import type { RecoilPatternProcessor } from '../../engine/RecoilPattern';
import { UI_COLORS } from '../../config/theme';

interface RecoilOverlayProps {
  /** 패턴 프로세서 인스턴스 (없으면 미표시) */
  processor: RecoilPatternProcessor | null;
  /** 오버레이 표시 여부 */
  visible: boolean;
}

/** 오버레이 캔버스 크기 */
const SIZE = 160;
/** 중앙점 */
const CENTER = SIZE / 2;
/** 1도당 픽셀 스케일 */
const SCALE = 15;

export function RecoilOverlay({ processor, visible }: RecoilOverlayProps): ReactElement | null {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [shotIndex, setShotIndex] = useState(0);

  useEffect(() => {
    if (!visible || !processor || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /** 패턴 포인트를 누적 경로로 변환 */
    function getAccumulatedPath(): Array<{ x: number; y: number }> {
      if (!processor) return [];
      const config = processor.getConfig();
      const points = config.pattern;
      const path: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
      let cx = 0, cy = 0;
      for (const [dx, dy] of points) {
        cx += dx;
        cy += dy;
        path.push({ x: cx, y: cy });
      }
      return path;
    }

    function draw(): void {
      if (!ctx || !processor) return;
      ctx.clearRect(0, 0, SIZE, SIZE);

      // 배경 — 반투명 원형 영역
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, CENTER - 4, 0, Math.PI * 2);
      ctx.fill();

      // 십자선 가이드
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(CENTER, 4);
      ctx.lineTo(CENTER, SIZE - 4);
      ctx.moveTo(4, CENTER);
      ctx.lineTo(SIZE - 4, CENTER);
      ctx.stroke();

      // 이상적 보정 경로 (반투명 선)
      const path = getAccumulatedPath();
      if (path.length > 1) {
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        for (let i = 0; i < path.length; i++) {
          const px = CENTER + path[i].x * SCALE;
          // 보정 경로는 반동의 반대 방향 → y 반전
          const py = CENTER - path[i].y * SCALE;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // 패턴 포인트 (작은 점)
        ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
        for (let i = 1; i < path.length; i++) {
          ctx.beginPath();
          ctx.arc(
            CENTER + path[i].x * SCALE,
            CENTER - path[i].y * SCALE,
            2, 0, Math.PI * 2,
          );
          ctx.fill();
        }
      }

      // 현재 반동 위치 (빨간 점)
      const aim = processor.getAccumulatedAim();
      const currentX = CENTER + aim.dx * SCALE;
      const currentY = CENTER - aim.dy * SCALE;

      // 글로우 효과
      ctx.shadowColor = UI_COLORS.accentGold;
      ctx.shadowBlur = 8;
      ctx.fillStyle = UI_COLORS.accentGold;
      ctx.beginPath();
      ctx.arc(currentX, currentY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // 현재 인덱스 → 경로상 위치에 하이라이트
      const idx = processor.getShotIndex();
      setShotIndex(idx);
      if (idx > 0 && idx < path.length) {
        ctx.strokeStyle = UI_COLORS.accentGold;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(
          CENTER + path[idx].x * SCALE,
          CENTER - path[idx].y * SCALE,
          6, 0, Math.PI * 2,
        );
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible, processor]);

  if (!visible || !processor) return null;

  return (
    <div className="recoil-overlay">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="recoil-overlay__canvas"
      />
      <div className="recoil-overlay__info">
        Shot {shotIndex}
      </div>
    </div>
  );
}
