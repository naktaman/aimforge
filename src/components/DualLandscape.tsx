/**
 * 듀얼 랜드스케이프 화면
 * 정적/무빙 퍼포먼스 커브 + 가중 최적점 + movement_ratio 실시간 조정
 * D3 이중 라인 차트
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useMovementStore } from '../stores/movementStore';
import { useTranslation } from '../i18n';
import { UI_COLORS } from '../config/theme';

interface Props {
  onBack: () => void;
  profileId: number;
}

/** 데모용 가상 landscape 데이터 생성 */
function generateDemoCurve(optimal: number, spread: number): [number, number][] {
  const points: [number, number][] = [];
  for (let x = 15; x <= 55; x += 1) {
    // 가우시안 유사 커브
    const score = 100 * Math.exp(-0.5 * ((x - optimal) / spread) ** 2);
    points.push([x, score]);
  }
  return points;
}

export default function DualLandscape({ onBack }: Props) {
  const { t } = useTranslation();
  const { recommendation, calculateRecommendation } = useMovementStore();

  const [staticOpt, setStaticOpt] = useState(35);
  const [movingOpt, setMovingOpt] = useState(30);
  const [ratio, setRatio] = useState(0.3);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 비율 변경 시 추천 재계산
  useEffect(() => {
    calculateRecommendation(staticOpt, movingOpt, ratio);
  }, [staticOpt, movingOpt, ratio, calculateRecommendation]);

  // Canvas 기반 듀얼 라인 차트 렌더링
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const pad = { top: 30, right: 20, bottom: 40, left: 50 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = UI_COLORS.bgDeep;
    ctx.fillRect(0, 0, W, H);

    const staticCurve = generateDemoCurve(staticOpt, 8);
    const movingCurve = generateDemoCurve(movingOpt, 10);

    // X축: 15~55 cm/360, Y축: 0~100 score
    const xMin = 15, xMax = 55;
    const toX = (v: number) => pad.left + ((v - xMin) / (xMax - xMin)) * chartW;
    const toY = (v: number) => pad.top + chartH - (v / 100) * chartH;

    // 격자
    ctx.strokeStyle = UI_COLORS.borderSubtle;
    ctx.lineWidth = 0.5;
    for (let y = 0; y <= 100; y += 20) {
      ctx.beginPath();
      ctx.moveTo(pad.left, toY(y));
      ctx.lineTo(pad.left + chartW, toY(y));
      ctx.stroke();
      ctx.fillStyle = UI_COLORS.chartTickText;
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(y.toString(), pad.left - 6, toY(y) + 4);
    }
    for (let x = 15; x <= 55; x += 5) {
      ctx.beginPath();
      ctx.moveTo(toX(x), pad.top);
      ctx.lineTo(toX(x), pad.top + chartH);
      ctx.stroke();
      ctx.fillStyle = UI_COLORS.chartTickText;
      ctx.textAlign = 'center';
      ctx.fillText(x.toString(), toX(x), pad.top + chartH + 16);
    }

    // 정적 커브 (파란색)
    ctx.beginPath();
    ctx.strokeStyle = UI_COLORS.infoHighlight;
    ctx.lineWidth = 2;
    staticCurve.forEach(([x, y], i) => {
      const px = toX(x), py = toY(y);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();

    // 무빙 커브 (주황색)
    ctx.beginPath();
    ctx.strokeStyle = UI_COLORS.metalChrome;
    ctx.lineWidth = 2;
    movingCurve.forEach(([x, y], i) => {
      const px = toX(x), py = toY(y);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();

    // 가중 최적점 (빨간 수직선 + 원)
    if (recommendation) {
      const wx = toX(recommendation.finalCm360);
      ctx.beginPath();
      ctx.strokeStyle = UI_COLORS.accentGold;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.moveTo(wx, pad.top);
      ctx.lineTo(wx, pad.top + chartH);
      ctx.stroke();
      ctx.setLineDash([]);

      // 최적점 마커
      ctx.beginPath();
      ctx.fillStyle = UI_COLORS.accentGold;
      ctx.arc(wx, toY(80), 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = UI_COLORS.accentGold;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${recommendation.finalCm360.toFixed(1)}`, wx, pad.top - 8);
    }

    // 정적/무빙 최적점 마커
    ctx.fillStyle = UI_COLORS.infoHighlight;
    ctx.beginPath();
    ctx.arc(toX(staticOpt), toY(100), 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = UI_COLORS.metalChrome;
    ctx.beginPath();
    ctx.arc(toX(movingOpt), toY(100), 5, 0, Math.PI * 2);
    ctx.fill();

    // 축 라벨
    ctx.fillStyle = UI_COLORS.chartLabel;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('cm/360', pad.left + chartW / 2, H - 4);
    ctx.save();
    ctx.translate(12, pad.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Score', 0, 0);
    ctx.restore();

    // 범례
    const legendY = 14;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = UI_COLORS.infoHighlight;
    ctx.fillRect(pad.left + 10, legendY - 8, 12, 3);
    ctx.fillText(t('landscape.static'), pad.left + 28, legendY);
    ctx.fillStyle = UI_COLORS.metalChrome;
    ctx.fillRect(pad.left + 80, legendY - 8, 12, 3);
    ctx.fillText(t('landscape.moving'), pad.left + 98, legendY);
    ctx.fillStyle = UI_COLORS.accentGold;
    ctx.fillRect(pad.left + 150, legendY - 8, 12, 3);
    ctx.fillText(t('landscape.weighted'), pad.left + 168, legendY);
  }, [staticOpt, movingOpt, ratio, recommendation, t]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>{t('landscape.dualLandscape')}</h2>
        <button onClick={onBack}>← {t('common.back')}</button>
      </div>

      {/* 차트 */}
      <div style={{ background: UI_COLORS.bgDeep, borderRadius: 8, padding: 10, marginBottom: 20 }}>
        <canvas ref={canvasRef} width={800} height={400} style={{ width: '100%', height: 'auto' }} />
      </div>

      {/* 컨트롤 */}
      <div style={{ background: UI_COLORS.bgPanel, padding: 20, borderRadius: 8, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>{t('landscape.paramAdjust')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          <div>
            <label>{t('landscape.staticOpt')}: {staticOpt}</label>
            <input type="range" min={15} max={55} step={0.5} value={staticOpt}
              onChange={(e) => setStaticOpt(Number(e.target.value))} style={{ width: '100%' }} />
          </div>
          <div>
            <label>{t('landscape.movingOpt')}: {movingOpt}</label>
            <input type="range" min={15} max={55} step={0.5} value={movingOpt}
              onChange={(e) => setMovingOpt(Number(e.target.value))} style={{ width: '100%' }} />
          </div>
          <div>
            <label>Movement Ratio: {(ratio * 100).toFixed(0)}%</label>
            <input type="range" min={0} max={1} step={0.05} value={ratio}
              onChange={(e) => setRatio(Number(e.target.value))} style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      {/* 결과 표시 */}
      {recommendation && (
        <div style={{ background: '#0f3460', padding: 16, borderRadius: 8, display: 'flex', gap: 32 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{t('landscape.staticOpt')}</div>
            <div style={{ fontSize: 20, color: 'var(--color-sky)' }}>{recommendation.staticOptimal.toFixed(1)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{t('landscape.movingOpt')}</div>
            <div style={{ fontSize: 20, color: 'var(--color-amber)' }}>{recommendation.movingOptimal.toFixed(1)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{t('landscape.weightedRecommended')}</div>
            <div style={{ fontSize: 20, color: 'var(--accent)', fontWeight: 'bold' }}>
              {recommendation.finalCm360.toFixed(1)} cm/360
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', opacity: 0.8 }}>
            {recommendation.direction}
          </div>
        </div>
      )}
    </div>
  );
}
