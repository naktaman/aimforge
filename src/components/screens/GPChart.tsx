/**
 * GP 시각화 차트 — SVG 기반
 * X축: 감도 (cm/360), Y축: 성능 점수 (0~1)
 * 관측점 + Mean curve + Confidence band + EI 추천점
 */
import { useMemo } from 'react';
import { motion } from 'motion/react';
import type { GPCurvePoint, Observation, EIRecommendation } from '../../utils/gpTypes';

interface GPChartProps {
  curve: GPCurvePoint[];
  observations: Observation[];
  bestCm360: number | null;
  eiRecommendation: EIRecommendation | null;
  width?: number;
  height?: number;
}

/** 패딩/마진 설정 */
const PADDING = { top: 20, right: 30, bottom: 45, left: 55 };

/** 축 범위 계산 */
function computeDomain(curve: GPCurvePoint[], observations: Observation[]) {
  const allX = [
    ...curve.map(p => p.x),
    ...observations.map(o => o.cm360),
  ];
  const allY = [
    ...curve.map(p => p.mean + Math.sqrt(p.variance) * 2),
    ...curve.map(p => p.mean - Math.sqrt(p.variance) * 2),
    ...observations.map(o => o.score),
  ];

  if (allX.length === 0) return { xMin: 15, xMax: 60, yMin: 0, yMax: 1 };

  const xMin = Math.floor(Math.min(...allX) - 1);
  const xMax = Math.ceil(Math.max(...allX) + 1);
  const yMin = Math.max(0, Math.floor((Math.min(...allY) - 0.05) * 20) / 20);
  const yMax = Math.min(1, Math.ceil((Math.max(...allY) + 0.05) * 20) / 20);

  return { xMin, xMax, yMin, yMax };
}

export function GPChart({
  curve,
  observations,
  bestCm360,
  eiRecommendation,
  width = 700,
  height = 360,
}: GPChartProps) {
  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;

  const { xMin, xMax, yMin, yMax } = useMemo(
    () => computeDomain(curve, observations),
    [curve, observations],
  );

  /** 데이터 → SVG 좌표 변환 */
  const scaleX = (v: number) => PADDING.left + ((v - xMin) / (xMax - xMin)) * plotW;
  const scaleY = (v: number) => PADDING.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  /** Mean curve path */
  const meanPath = useMemo(() => {
    if (curve.length === 0) return '';
    return curve.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${scaleX(p.x).toFixed(1)},${scaleY(p.mean).toFixed(1)}`
    ).join(' ');
  }, [curve, xMin, xMax, yMin, yMax, plotW, plotH]);

  /** Confidence band path (mean ± 2σ) */
  const bandPath = useMemo(() => {
    if (curve.length === 0) return '';
    const upper = curve.map(p => {
      const sigma = Math.sqrt(p.variance);
      return `${scaleX(p.x).toFixed(1)},${scaleY(p.mean + 2 * sigma).toFixed(1)}`;
    });
    const lower = [...curve].reverse().map(p => {
      const sigma = Math.sqrt(p.variance);
      return `${scaleX(p.x).toFixed(1)},${scaleY(p.mean - 2 * sigma).toFixed(1)}`;
    });
    return `M${upper.join(' L')} L${lower.join(' L')} Z`;
  }, [curve, xMin, xMax, yMin, yMax, plotW, plotH]);

  /** X축 틱 */
  const xTicks = useMemo(() => {
    const step = Math.ceil((xMax - xMin) / 8);
    const ticks: number[] = [];
    for (let v = Math.ceil(xMin / step) * step; v <= xMax; v += step) {
      ticks.push(v);
    }
    return ticks;
  }, [xMin, xMax]);

  /** Y축 틱 */
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = 0.1;
    for (let v = Math.ceil(yMin / step) * step; v <= yMax + 0.001; v += step) {
      ticks.push(Math.round(v * 100) / 100);
    }
    return ticks;
  }, [yMin, yMax]);

  return (
    <svg
      className="gp-chart-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 그리드 라인 */}
      {xTicks.map(v => (
        <line
          key={`gx-${v}`}
          x1={scaleX(v)} y1={PADDING.top}
          x2={scaleX(v)} y2={PADDING.top + plotH}
          className="gp-chart-grid"
        />
      ))}
      {yTicks.map(v => (
        <line
          key={`gy-${v}`}
          x1={PADDING.left} y1={scaleY(v)}
          x2={PADDING.left + plotW} y2={scaleY(v)}
          className="gp-chart-grid"
        />
      ))}

      {/* Confidence band */}
      {bandPath && (
        <motion.path
          d={bandPath}
          className="gp-chart-band"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
      )}

      {/* Mean curve */}
      {meanPath && (
        <motion.path
          d={meanPath}
          className="gp-chart-mean"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      )}

      {/* EI 추천점 수직선 */}
      {eiRecommendation && (
        <line
          x1={scaleX(eiRecommendation.cm360)}
          y1={PADDING.top}
          x2={scaleX(eiRecommendation.cm360)}
          y2={PADDING.top + plotH}
          className="gp-chart-ei-line"
        />
      )}

      {/* 최적점 수직선 */}
      {bestCm360 !== null && (
        <line
          x1={scaleX(bestCm360)}
          y1={PADDING.top}
          x2={scaleX(bestCm360)}
          y2={PADDING.top + plotH}
          className="gp-chart-best-line"
        />
      )}

      {/* 관측점 */}
      {observations.map((obs, i) => (
        <motion.circle
          key={`obs-${i}`}
          cx={scaleX(obs.cm360)}
          cy={scaleY(obs.score)}
          r={obs.isLatest ? 6 : 4.5}
          className={obs.isLatest ? 'gp-chart-obs-latest' : 'gp-chart-obs'}
          initial={obs.isLatest ? { scale: 0, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
      ))}

      {/* X축 라벨 */}
      {xTicks.map(v => (
        <text
          key={`xl-${v}`}
          x={scaleX(v)}
          y={PADDING.top + plotH + 18}
          className="gp-chart-tick-label"
          textAnchor="middle"
        >
          {v}
        </text>
      ))}
      <text
        x={PADDING.left + plotW / 2}
        y={height - 5}
        className="gp-chart-axis-label"
        textAnchor="middle"
      >
        감도 (cm/360)
      </text>

      {/* Y축 라벨 */}
      {yTicks.map(v => (
        <text
          key={`yl-${v}`}
          x={PADDING.left - 10}
          y={scaleY(v) + 4}
          className="gp-chart-tick-label"
          textAnchor="end"
        >
          {(v * 100).toFixed(0)}
        </text>
      ))}
      <text
        x={15}
        y={PADDING.top + plotH / 2}
        className="gp-chart-axis-label"
        textAnchor="middle"
        transform={`rotate(-90, 15, ${PADDING.top + plotH / 2})`}
      >
        성능 점수
      </text>

      {/* 범례 */}
      <g transform={`translate(${PADDING.left + 10}, ${PADDING.top + 10})`}>
        <rect x={0} y={0} width={12} height={3} fill="#D4960A" rx={1} />
        <text x={16} y={5} className="gp-chart-legend">예측 곡선</text>
        <circle cx={6} cy={16} r={4} className="gp-chart-obs" />
        <text x={16} y={19} className="gp-chart-legend">관측점</text>
        <circle cx={6} cy={30} r={5} className="gp-chart-obs-latest" />
        <text x={16} y={33} className="gp-chart-legend">최신 관측</text>
      </g>
    </svg>
  );
}
