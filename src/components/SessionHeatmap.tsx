/**
 * 세션 히트맵 — Canvas 2D 기반 밀도 히트맵 + 궤적 + hit/miss 마커
 * 결과 화면에서 "히트맵 보기" 버튼으로 열림
 * PNG 다운로드 기능 포함
 */
import { useRef, useEffect, useCallback, useState } from 'react';

/** 히트맵에 표시할 클릭 데이터 */
export interface HeatmapClick {
  /** 화면 기준 정규화 X (0~1) */
  nx: number;
  /** 화면 기준 정규화 Y (0~1) */
  ny: number;
  /** 히트 여부 */
  hit: boolean;
  /** 타임스탬프 (ms) */
  t: number;
}

/** 히트맵에 표시할 궤적 프레임 */
export interface HeatmapFrame {
  nx: number;
  ny: number;
  t: number;
}

interface SessionHeatmapProps {
  /** 클릭 데이터 */
  clicks: HeatmapClick[];
  /** 마우스 궤적 프레임 (선택) */
  trajectory?: HeatmapFrame[];
  /** 캔버스 크기 */
  width?: number;
  height?: number;
  onClose: () => void;
}

/** 밀도 히트맵 색상 테이블 (파랑→초록→노랑→빨강) */
function densityColor(intensity: number): [number, number, number, number] {
  const t = Math.min(1, Math.max(0, intensity));
  if (t < 0.25) {
    const s = t / 0.25;
    return [0, 0, Math.round(128 + 127 * s), Math.round(80 * s)];
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    return [0, Math.round(255 * s), 255, Math.round(80 + 80 * s)];
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return [Math.round(255 * s), 255, Math.round(255 * (1 - s)), Math.round(160 + 40 * s)];
  }
  const s = (t - 0.75) / 0.25;
  return [255, Math.round(255 * (1 - s)), 0, Math.round(200 + 55 * s)];
}

export function SessionHeatmap({
  clicks,
  trajectory,
  width = 640,
  height = 480,
  onClose,
}: SessionHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showDensity, setShowDensity] = useState(true);

  /** 히트맵 렌더링 */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 배경
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // 그리드
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const x = (width * i) / 10;
      const y = (height * i) / 10;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // 센터 크로스헤어 기준선
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();

    // 밀도 히트맵 (가우시안 커널)
    if (showDensity && clicks.length > 0) {
      const gridSize = 4;
      const cols = Math.ceil(width / gridSize);
      const rows = Math.ceil(height / gridSize);
      const density = new Float32Array(cols * rows);
      const radius = 20;

      // 각 클릭 위치에 가우시안 분포 누적
      for (const click of clicks) {
        const cx = click.nx * width;
        const cy = click.ny * height;
        const gx0 = Math.max(0, Math.floor((cx - radius * 3) / gridSize));
        const gx1 = Math.min(cols - 1, Math.ceil((cx + radius * 3) / gridSize));
        const gy0 = Math.max(0, Math.floor((cy - radius * 3) / gridSize));
        const gy1 = Math.min(rows - 1, Math.ceil((cy + radius * 3) / gridSize));

        for (let gy = gy0; gy <= gy1; gy++) {
          for (let gx = gx0; gx <= gx1; gx++) {
            const dx = gx * gridSize + gridSize / 2 - cx;
            const dy = gy * gridSize + gridSize / 2 - cy;
            const dist2 = dx * dx + dy * dy;
            const weight = Math.exp(-dist2 / (2 * radius * radius));
            density[gy * cols + gx] += weight;
          }
        }
      }

      // 최대값 정규화 후 색상 매핑
      let maxDensity = 0;
      for (let i = 0; i < density.length; i++) {
        if (density[i] > maxDensity) maxDensity = density[i];
      }
      if (maxDensity > 0) {
        const imgData = ctx.createImageData(width, height);
        for (let gy = 0; gy < rows; gy++) {
          for (let gx = 0; gx < cols; gx++) {
            const intensity = density[gy * cols + gx] / maxDensity;
            if (intensity < 0.01) continue;
            const [r, g, b, a] = densityColor(intensity);

            // gridSize × gridSize 블록 채우기
            for (let dy = 0; dy < gridSize && gy * gridSize + dy < height; dy++) {
              for (let dx = 0; dx < gridSize && gx * gridSize + dx < width; dx++) {
                const px = (gy * gridSize + dy) * width + (gx * gridSize + dx);
                imgData.data[px * 4] = r;
                imgData.data[px * 4 + 1] = g;
                imgData.data[px * 4 + 2] = b;
                imgData.data[px * 4 + 3] = a;
              }
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }
    }

    // 궤적 라인
    if (showTrajectory && trajectory && trajectory.length > 1) {
      ctx.strokeStyle = 'rgba(100, 149, 237, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(trajectory[0].nx * width, trajectory[0].ny * height);
      for (let i = 1; i < trajectory.length; i++) {
        ctx.lineTo(trajectory[i].nx * width, trajectory[i].ny * height);
      }
      ctx.stroke();
    }

    // 클릭 마커 (히트=초록, 미스=빨강)
    for (const click of clicks) {
      const x = click.nx * width;
      const y = click.ny * height;
      ctx.beginPath();
      ctx.arc(x, y, click.hit ? 4 : 5, 0, Math.PI * 2);
      ctx.fillStyle = click.hit ? '#4ade80' : '#e94560';
      ctx.fill();
      if (!click.hit) {
        // 미스: X 마커
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4);
        ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4);
        ctx.stroke();
      }
    }

    // 통계 텍스트
    const hits = clicks.filter(c => c.hit).length;
    ctx.fillStyle = '#e0e0e0';
    ctx.font = '12px monospace';
    ctx.fillText(`Hits: ${hits}/${clicks.length} (${clicks.length > 0 ? ((hits / clicks.length) * 100).toFixed(1) : 0}%)`, 10, 20);
  }, [clicks, trajectory, width, height, showTrajectory, showDensity]);

  useEffect(() => { render(); }, [render]);

  /** PNG 다운로드 */
  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `aimforge-heatmap-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  return (
    <div className="heatmap-container">
      <div className="heatmap-header">
        <h3>세션 히트맵</h3>
        <div className="heatmap-controls">
          <label>
            <input type="checkbox" checked={showDensity} onChange={() => setShowDensity(!showDensity)} />
            밀도
          </label>
          <label>
            <input type="checkbox" checked={showTrajectory} onChange={() => setShowTrajectory(!showTrajectory)} />
            궤적
          </label>
          <button className="btn-secondary btn-sm" onClick={handleDownload}>PNG 저장</button>
          <button className="btn-secondary btn-sm" onClick={onClose}>닫기</button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="heatmap-canvas"
      />
    </div>
  );
}
